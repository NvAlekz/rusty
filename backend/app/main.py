import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import settings
from app.services.tracker import tracker_service


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Iniciar el tracker (monitoreo del log de Rust) al arrancar
    await tracker_service.start_tracker()
    logging.info("Rust Tracker backend started")
    yield
    tracker_service.stop_tracker()
    logging.info("Rust Tracker backend stopped")


app = FastAPI(
    title="Rust Tracker Backend",
    description="API para trackear jugadores de Rust en tiempo real",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS para el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
async def root():
    return {
        "app": "Rust Tracker Backend",
        "docs": "/docs",
        "status": "/api/status",
        "players": "/api/players",
        "websocket": "/api/ws",
    }