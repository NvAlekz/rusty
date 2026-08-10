from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from typing import Optional

from app.services.tracker import tracker_service
from app.services.log_parser import rust_log_parser
from app.services.source_query import source_query_service
from app.models.schemas import ServerInfo, ServerPlayersResponse

router = APIRouter(prefix="/api", tags=["rust-tracker"])


@router.get("/status")
async def get_status():
    """Estado del tracker: ¿está conectado a un servidor? ¿monitoreando logs?"""
    log_file = rust_log_parser.find_log_file()
    state = await tracker_service.get_state()
    return {
        "tracking": tracker_service._is_running,
        "log_file": log_file,
        "connected_to_server": tracker_service.current_server is not None,
        "server": state.server if state else None,
        "players_count": state.total_players if state else 0,
    }


@router.get("/server")
async def get_server_info():
    """Devuelve la información del servidor actual"""
    state = await tracker_service.get_state()
    if not state:
        raise HTTPException(status_code=404, detail="No connected to a server yet")
    return state.server


@router.get("/players", response_model=ServerPlayersResponse)
async def get_players():
    """Devuelve la lista completa de jugadores con sus datos"""
    state = await tracker_service.get_state()
    if not state:
        raise HTTPException(status_code=404, detail="No connected to a server yet")
    return state


@router.post("/refresh")
async def refresh():
    """Fuerza un re-escaneo del log y actualización de los datos del servidor"""
    await tracker_service.rescan_log()
    return {"message": "Refresh completed"}


@router.get("/query/{ip}:{port}")
async def query_server_direct(ip: str, port: int = 28015):
    """Consulta manualmente un servidor específico (sin esperar al log)"""
    info = await source_query_service.query_server(ip, port)
    if not info:
        raise HTTPException(status_code=404, detail="Server not reachable")
    players = await source_query_service.query_players(ip, port)
    return {"server": info, "players": players}


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket para enviar actualizaciones en tiempo real al overlay"""
    await tracker_service.register_ws(websocket)
    try:
        while True:
            # Esperar mensajes del cliente (e.g. "refresh")
            data = await websocket.receive_text()
            if data == "refresh":
                await tracker_service.rescan_log()
    except WebSocketDisconnect:
        await tracker_service.unregister_ws(websocket)