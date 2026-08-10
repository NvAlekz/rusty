from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # Steam API
    steam_api_key: str
    rust_app_id: int = 252490

    # Rust Log Paths
    rust_log_paths: List[str] = []

    # Query Settings
    query_timeout: int = 5
    query_retries: int = 2

    # Backend
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000

    # Frontend
    frontend_url: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    def get_expanded_log_paths(self) -> List[str]:
        """Expande variables de entorno en las rutas de logs"""
        expanded = []
        for path in self.rust_log_paths:
            expanded_path = os.path.expandvars(path)
            expanded_path = os.path.expanduser(expanded_path)
            if os.path.exists(expanded_path):
                expanded.append(expanded_path)
        return expanded


settings = Settings()