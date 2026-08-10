import httpx
import asyncio
import logging
from typing import Optional, List, Dict, Any
from app.core.config import settings
from app.models.schemas import (
    SteamPlayerSummary, PlayerBans, OwnedGame, RustStats, PlayerRiskLevel
)

logger = logging.getLogger(__name__)


class SteamAPIService:
    BASE_URL = "https://api.steampowered.com"

    def __init__(self, api_key: str = None, max_concurrency: int = 4):
        self.api_key = api_key or settings.steam_api_key
        self.client = httpx.AsyncClient(timeout=30.0)
        # Steam rate-limita a peticiones concurrentes; 420 = throttling
        self._semaphore = asyncio.Semaphore(max_concurrency)
    
    async def close(self):
        await self.client.aclose()
    
    async def _request(self, url: str, params: dict) -> Optional[httpx.Response]:
        """Petición con semáforo, retry con backoff y manejo de rate limit (420)"""
        for attempt in range(3):
            async with self._semaphore:
                try:
                    response = await self.client.get(url, params=params)
                    if response.status_code == 420:
                        await asyncio.sleep(1.5 * (attempt + 1))
                        continue
                    return response
                except httpx.HTTPError as e:
                    logger.warning(f"Steam request error (attempt {attempt + 1}): {e}")
                    await asyncio.sleep(0.5 * (attempt + 1))
        return None
    
    async def get_player_summaries(self, steam_ids: List[str]) -> List[SteamPlayerSummary]:
        """Obtiene información básica de perfiles de Steam"""
        if not steam_ids:
            return []
        
        try:
            url = f"{self.BASE_URL}/ISteamUser/GetPlayerSummaries/v0002/"
            params = {
                "key": self.api_key,
                "steamids": ",".join(steam_ids)
            }
            response = await self._request(url, params)
            if response is None:
                return []
            response.raise_for_status()
            data = response.json()
            
            players = data.get("response", {}).get("players", [])
            return [SteamPlayerSummary(**p) for p in players]
        except httpx.HTTPStatusError as e:
            logger.error(f"Error getting player summaries: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in get_player_summaries: {e}")
            return []
    
    # Steam devuelve claves en PascalCase en GetPlayerBans
    BAN_KEY_MAP = {
        'SteamId': 'steamid',
        'CommunityBanned': 'communitybanned',
        'VACBanned': 'vacbanned',
        'NumberOfVACBans': 'numberofvacbans',
        'DaysSinceLastBan': 'dayssincelastban',
        'NumberOfGameBans': 'numberofgamebans',
        'EconomyBan': 'economyban',
    }

    async def get_player_bans(self, steam_ids: List[str]) -> List[PlayerBans]:
        """Obtiene información de baneos (VAC, Game Bans)"""
        if not steam_ids:
            return []
        
        try:
            url = f"{self.BASE_URL}/ISteamUser/GetPlayerBans/v1/"
            params = {
                "key": self.api_key,
                "steamids": ",".join(steam_ids)
            }
            response = await self._request(url, params)
            if response is None:
                return []
            response.raise_for_status()
            data = response.json()
            
            bans = data.get("players", [])
            return [
                PlayerBans(**{self.BAN_KEY_MAP.get(k, k): v for k, v in b.items()})
                for b in bans
            ]
        except httpx.HTTPStatusError as e:
            logger.error(f"Error getting player bans: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in get_player_bans: {e}")
            return []
    
    async def get_owned_games(self, steam_id: str) -> List[OwnedGame]:
        """Obtiene juegos poseídos y tiempo de juego (filtra Rust en cliente)"""
        try:
            url = f"{self.BASE_URL}/IPlayerService/GetOwnedGames/v1/"
            params = {
                "key": self.api_key,
                "steamid": steam_id,
                "include_appinfo": True,
                "include_played_free_games": True
            }
            response = await self._request(url, params)
            if response is None:
                return []
            response.raise_for_status()
            data = response.json()
            
            games = data.get("response", {}).get("games", [])
            return [OwnedGame(**g) for g in games]
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 403:
                logger.warning(f"Private profile for steam_id: {steam_id}")
            else:
                logger.error(f"Error getting owned games: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in get_owned_games: {e}")
            return []
    
    async def get_rust_stats(self, steam_id: str) -> Optional[RustStats]:
        """Obtiene estadísticas específicas de Rust"""
        try:
            url = f"{self.BASE_URL}/ISteamUserStats/GetUserStatsForGame/v0002/"
            params = {
                "key": self.api_key,
                "appid": settings.rust_app_id,
                "steamid": steam_id
            }
            response = await self._request(url, params)
            
            if response is None:
                return None

            if response.status_code == 403:
                logger.warning(f"Private profile for steam_id: {steam_id}")
                return None
            
            response.raise_for_status()
            data = response.json()
            
            stats_list = data.get("playerstats", {}).get("stats", [])
            stats_dict = {stat["name"]: stat["value"] for stat in stats_list}
            
            kills = stats_dict.get("kill_player", 0)
            deaths = stats_dict.get("deaths", 0)
            headshots = stats_dict.get("headshot", 0)
            bullets_fired = stats_dict.get("bullet_fired", 0)
            bullets_hit = stats_dict.get("bullet_hit_player", 0)
            
            kda = round(kills / deaths, 2) if deaths > 0 else float(kills)
            accuracy = round((bullets_hit / bullets_fired) * 100, 2) if bullets_fired > 0 else 0
            hs_ratio = round((headshots / kills) * 100, 2) if kills > 0 else 0
            fsd_ratio = round((kills / deaths) * 100, 2) if deaths > 0 else 0

            return RustStats(
                kills=kills,
                deaths=deaths,
                headshots=headshots,
                bullets_fired=bullets_fired,
                bullets_hit=bullets_hit,
                kda=kda,
                accuracy_percent=accuracy,
                hs_ratio=hs_ratio,
                fsd_ratio=fsd_ratio
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 403:
                logger.warning(f"Private profile for steam_id: {steam_id}")
            elif e.response.status_code == 400:
                # 400 = sin stats públicas de Rust (normal para cuentas nuevas o stats ocultas)
                logger.debug(f"No public Rust stats for steam_id: {steam_id}")
            else:
                logger.error(f"Error getting Rust stats: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error in get_rust_stats: {e}")
            return None
    
    async def get_full_player_data(self, steam_id: str) -> Dict[str, Any]:
        """Obtiene todos los datos de un jugador en paralelo"""
        import asyncio
        
        # Ejecutar todas las peticiones en paralelo
        summaries_task = self.get_player_summaries([steam_id])
        bans_task = self.get_player_bans([steam_id])
        games_task = self.get_owned_games(steam_id)
        stats_task = self.get_rust_stats(steam_id)
        
        summaries, bans, games, stats = await asyncio.gather(
            summaries_task, bans_task, games_task, stats_task,
            return_exceptions=True
        )
        
        # Manejar excepciones
        if isinstance(summaries, Exception):
            summaries = []
        if isinstance(bans, Exception):
            bans = []
        if isinstance(games, Exception):
            games = []
        if isinstance(stats, Exception):
            stats = None
        
        summary = summaries[0] if summaries else None
        ban = bans[0] if bans else None
        rust_game = next((g for g in games if g.appid == settings.rust_app_id), None)
        
        return {
            "summary": summary,
            "ban": ban,
            "rust_playtime_hours": round(rust_game.playtime_forever / 60, 1) if rust_game else 0.0,
            "rust_stats": stats,
            "is_private": summary.communityvisibilitystate != 3 if summary else True
        }


steam_service = SteamAPIService()