import asyncio
import logging
import time
from typing import Dict, Optional, List
from datetime import datetime

from app.models.schemas import (
    ServerInfo, PlayerData, ServerPlayersResponse, LogEvent, WebSocketMessage,
    SteamPlayerSummary, PlayerBans
)
from app.services.source_query import SourceQueryService, source_query_service
from app.services.steam_api import steam_service
from app.services.steamid_resolver import steamid_resolver
from app.services.risk_evaluator import risk_evaluator
from app.services.log_parser import rust_log_parser
from app.core.config import settings

logger = logging.getLogger(__name__)


class TrackerService:
    """Orquestador principal: une log parsing + server query + Steam API + riesgo"""

    def __init__(self):
        self.current_server: Optional[ServerInfo] = None
        self.players: List[PlayerData] = []
        self._player_cache: Dict[str, PlayerData] = {}
        self._websocket_connections = []
        self._query_task: Optional[asyncio.Task] = None
        self._refresh_task: Optional[asyncio.Task] = None
        self._scheduled_task: Optional[asyncio.Task] = None
        self._connected_port: Optional[int] = None
        self._is_running = False
        self._lock = asyncio.Lock()

    # ----------------------------------------------------------------
    # WebSocket management
    # ----------------------------------------------------------------
    async def register_ws(self, websocket):
        await websocket.accept()
        self._websocket_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total: {len(self._websocket_connections)}")
        # Enviar estado actual inmediatamente
        await self._send_status()
        if self.current_server:
            await self._send_state()

    async def unregister_ws(self, websocket):
        if websocket in self._websocket_connections:
            self._websocket_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Total: {len(self._websocket_connections)}")

    async def broadcast(self, message: WebSocketMessage):
        to_remove = []
        for ws in self._websocket_connections:
            try:
                await ws.send_json(message.model_dump(mode="json"))
            except Exception as e:
                logger.warning(f"WS send failed ({e}), removing client")
                to_remove.append(ws)
        for ws in to_remove:
            self._websocket_connections.remove(ws)

    # ----------------------------------------------------------------
    # Log handling
    # ----------------------------------------------------------------
    async def _on_log_event(self, event: LogEvent):
        if event.event_type == "server_connect":
            # Ya conectado al mismo servidor (comparado con el puerto del log,
            # no con el puerto de query que puede diferir): ignorar para no
            # resetear datos ni relanzar el crawl al re-leer el log.
            if self.current_server and (
                self.current_server.ip == event.server_ip
                and self._connected_port == event.server_port
            ):
                logger.debug("Already connected to same server, ignoring connect event")
                return
            logger.info(f"Detected connection to {event.server_ip}:{event.server_port}")
            self.current_server = ServerInfo(ip=event.server_ip, port=event.server_port)
            self._connected_port = event.server_port
            self.players = []
            await self.broadcast(WebSocketMessage(
                type="server_connect",
                payload={"server": self.current_server.model_dump(mode="json")}
            ))
            await self.refresh_players(background=True)
        elif event.event_type == "server_disconnect":
            logger.info("Player disconnected from server")
            self.current_server = None
            self._connected_port = None
            self.players = []
            await self.broadcast(WebSocketMessage(
                type="server_disconnect",
                payload={}
            ))

    async def start_tracker(self):
        """Inicia el monitoreo del log de Rust"""
        if self._is_running:
            return
        self._is_running = True

        # Modo servidor fijo: monitoriza siempre el servidor configurado,
        # sin depender del log del cliente local. Refresca periódicamente.
        if settings.target_server_ip:
            logger.info(f"Modo servidor fijo: monitorizando {settings.target_server_ip}:{settings.target_server_port}")
            self.current_server = ServerInfo(ip=settings.target_server_ip, port=settings.target_server_port)
            self._connected_port = settings.target_server_port
            self.players = []
            await self.broadcast(WebSocketMessage(
                type="server_connect",
                payload={"server": self.current_server.model_dump(mode="json")}
            ))

            async def periodic_refresh():
                interval = max(10, settings.refresh_interval)
                while self._is_running:
                    await asyncio.sleep(interval)
                    try:
                        await self.refresh_players(background=True)
                    except Exception as e:
                        logger.error(f"Periodic refresh failed: {e}")

            self._scheduled_task = asyncio.create_task(periodic_refresh())
            await self.refresh_players(background=True)
            return

        async def handle(event: LogEvent):
            await self._on_log_event(event)

        rust_log_parser.set_callback(handle)
        await rust_log_parser.start_watching()

    def stop_tracker(self):
        self._is_running = False
        if self._scheduled_task and not self._scheduled_task.done():
            self._scheduled_task.cancel()
            self._scheduled_task = None
        rust_log_parser.stop_watching()

    # ----------------------------------------------------------------
    # Player refresh
    # ----------------------------------------------------------------
    async def _query_with_port_fallback(self, server: ServerInfo):
        """
        Consulta el servidor probando puertos de query alternativos.
        Muchos servidores de Rust usan puerto de juego 28010 pero
        responden a A2S en 28015 (o 28016).
        """
        candidate_ports = [server.port]
        for fallback in (28015, 28016):
            if fallback not in candidate_ports:
                candidate_ports.append(fallback)

        # El puerto del log usa timeout completo; los fallbacks, timeout corto
        info = await source_query_service.query_server(server.ip, server.port)
        if info:
            return info, server.port

        fast_service = SourceQueryService(timeout=3, retries=1)
        for port in candidate_ports[1:]:
            info = await fast_service.query_server(server.ip, port)
            if info:
                logger.info(f"Server responded on query port {port} (game port was {server.port})")
                return info, port
        return None, server.port

    async def refresh_players(self, background: bool = False):
        """Obtiene y procesa la lista de jugadores del servidor actual"""
        if not self.current_server:
            return

        # Si ya hay un refresh en curso (crawl largo), no lanzar otro
        if self._refresh_task and not self._refresh_task.done():
            logger.info("Refresh already in progress, skipping")
            return

        async def _do_refresh():
            async with self._lock:
                server = self.current_server

                # 1. Obtener info del servidor (nombre, mapa, etc.)
                info, query_port = await self._query_with_port_fallback(server)
                if info:
                    self.current_server = info
                    server = info

                # 2. Obtener lista de jugadores (solo nombres y scores)
                raw_players = await source_query_service.query_players(server.ip, query_port)
                logger.info(f"Found {len(raw_players)} players on server")

                # 3. Resolver SteamIDs y obtener datos completos, de forma
                #    INCREMENTAL: la tabla se llena en vivo mientras el crawl
                #    avanza (un crawl de 200+ jugadores tarda minutos).
                built: List[PlayerData] = []
                for i, raw in enumerate(raw_players):
                    player = await self._build_single_player(raw)
                    if player:
                        built.append(player)
                        self.players = built
                    if len(built) > 0 and len(built) % 15 == 0:
                        await self._send_state()

                # 4. Enviar estado actualizado
                await self._send_state()

        if background:
            self._refresh_task = asyncio.create_task(_do_refresh())
        else:
            await _do_refresh()

    async def rescan_log(self):
        """
        Re-lee el log completo para detectar el servidor aunque la conexión
        ocurriera antes de iniciar el tracker. Luego refresca los datos.
        En modo servidor fijo, simplemente refresca el estado del servidor.
        """
        if settings.target_server_ip:
            await self.refresh_players(background=True)
            return
        await rust_log_parser.rescan()
        await self.refresh_players(background=True)

    async def _build_single_player(self, raw: dict) -> Optional[PlayerData]:
        """Convierte un jugador crudo del query en PlayerData completo"""
        name = raw.get("name", "")
        steamid = raw.get("steamid")

        # Resolver SteamID si no viene en el query
        if not steamid:
            steamid = await steamid_resolver.resolve(name)

        if not steamid:
            # No se pudo resolver, crear entrada básica
            return PlayerData(
                steamid="unknown",
                name=name,
                avatar="",
                is_private=True,
                risk_level="private",
                risk_reasons=["No se pudo resolver el SteamID"],
                score=raw.get("score"),
                ping=raw.get("ping"),
            )

        # Reutilizar cache si ya tenemos los datos completos
        cached = self._player_cache.get(steamid)
        if cached and time.time() - cached.last_fetched < 1800:  # 30 min cache
            player = cached.model_copy(deep=True)
            player.score = raw.get("score")
            player.ping = raw.get("ping")
            player.connected_at = datetime.now()
            return player

        player = await self._fetch_player(steamid, raw)
        if player:
            player.last_fetched = time.time()
            self._player_cache[steamid] = player
            return player
        return None

    async def _build_players(self, raw_players, server: ServerInfo) -> List[PlayerData]:
        """Convierte jugadores crudos del query en PlayerData completos"""
        players: List[PlayerData] = []
        for raw in raw_players:
            player = await self._build_single_player(raw)
            if player:
                players.append(player)
        return players

    async def _fetch_player(self, steamid: str, raw: dict) -> Optional[PlayerData]:
        """Obtiene todos los datos de Steam de un jugador"""
        try:
            data = await steam_service.get_full_player_data(steamid)

            summary: SteamPlayerSummary = data.get("summary")
            ban: PlayerBans = data.get("ban")

            if not summary:
                return None

            # Calcular edad de la cuenta en días
            account_age_days = None
            if summary.timecreated:
                account_age_days = (time.time() - summary.timecreated) / 86400

            player = PlayerData(
                steamid=steamid,
                name=summary.personaname or raw.get("name", ""),
                avatar=summary.avatar,
                avatar_medium=summary.avatarmedium,
                avatar_full=summary.avatarfull,
                profile_url=summary.profileurl,
                is_private=data.get("is_private", True),
                rust_stats=data.get("rust_stats"),
                vac_banned=ban.vacbanned if ban else False,
                game_bans=ban.numberofgamebans if ban else 0,
                days_since_last_ban=ban.dayssincelastban if ban else 0,
                rust_playtime_hours=data.get("rust_playtime_hours", 0.0),
                account_age_days=account_age_days,
                score=raw.get("score"),
                ping=raw.get("ping"),
                connected_at=datetime.now(),
            )

            # Evaluar riesgo
            player = risk_evaluator.evaluate(player)
            return player
        except Exception as e:
            logger.error(f"Error fetching player {steamid}: {e}")
            return None

    async def _send_status(self):
        """Envía el estado del tracker (log, conexión) a los clientes"""
        await self.broadcast(WebSocketMessage(
            type="tracker_status",
            payload={
                "tracking": self._is_running,
                "log_file": rust_log_parser.active_log_file,
                "connected_to_server": self.current_server is not None,
                "server": self.current_server.model_dump() if self.current_server else None,
                "players_count": len(self.players),
            }
        ))

    async def _send_state(self):
        """Envía el estado actual del servidor a todos los clientes WebSocket"""
        if not self.current_server:
            return

        response = ServerPlayersResponse(
            server=self.current_server,
            players=self.players,
            total_players=len(self.players),
        )
        await self.broadcast(WebSocketMessage(
            type="server_state",
            payload=response.model_dump()
        ))

    async def get_state(self) -> Optional[ServerPlayersResponse]:
        """Devuelve el estado actual (para peticiones HTTP)"""
        if not self.current_server:
            return None
        return ServerPlayersResponse(
            server=self.current_server,
            players=self.players,
            total_players=len(self.players),
        )


tracker_service = TrackerService()