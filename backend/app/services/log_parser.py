import re
import os
import asyncio
from pathlib import Path
from typing import Optional, List, Callable, Awaitable
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import logging
from app.models.schemas import LogEvent
from app.core.config import settings

logger = logging.getLogger(__name__)


class RustLogParser:
    """Parsea los logs de Rust para detectar conexiones a servidores"""
    
    # Patrones para detectar conexión a servidor
    CONNECTION_PATTERNS = [
        # Formato real del cliente de Rust (Raknet): "Connecting: 1.2.3.4:28010 (Raknet)"
        re.compile(r'Connecting: ([\d.]+):(\d+)'),
        # Patrón común: "Connecting to [IP]:[PORT]"
        re.compile(r'Connecting to ([\d.]+):(\d+)'),
        # Patrón alternativo: "Joining server at [IP]:[PORT]"
        re.compile(r'Joining server at ([\d.]+):(\d+)'),
        # Patrón de carga de nivel: "Loading level [IP]:[PORT]"
        re.compile(r'Loading level ([\d.]+):(\d+)'),
        # Patrón de red: "Client connected to ([\d.]+):(\d+)"
        re.compile(r'Client connected to ([\d.]+):(\d+)'),
    ]
    
    # Patrón para detectar desconexión
    DISCONNECT_PATTERNS = [
        re.compile(r'Disconnected from ([\d.]+):(\d+)'),
        re.compile(r'Connection lost'),
        re.compile(r'Leaving server'),
    ]
    
    def __init__(self, log_paths: List[str] = None):
        self.log_paths = log_paths or settings.get_expanded_log_paths()
        self.observer: Optional[Observer] = None
        self.callback: Optional[Callable[[LogEvent], Awaitable[None]]] = None
        self._file_positions: dict = {}
        self.active_log_file: Optional[str] = None
    
    def set_callback(self, callback: Callable[[LogEvent], Awaitable[None]]):
        """Establece el callback para cuando se detecta un evento"""
        self.callback = callback
    
    def find_log_file(self) -> Optional[str]:
        """Encuentra el archivo de log más reciente"""
        for path in self.log_paths:
            p = Path(path)
            if p.exists():
                self.active_log_file = str(p)
                return str(p)
        self.active_log_file = None
        return None
    
    def parse_line(self, line: str) -> Optional[LogEvent]:
        """Parsea una línea del log buscando eventos de conexión"""
        from datetime import datetime
        
        # Buscar patrones de conexión
        for pattern in self.CONNECTION_PATTERNS:
            match = pattern.search(line)
            if match:
                ip, port = match.groups()
                return LogEvent(
                    timestamp=datetime.now(),
                    event_type="server_connect",
                    raw_line=line.strip(),
                    server_ip=ip,
                    server_port=int(port)
                )
        
        # Buscar patrones de desconexión
        for pattern in self.DISCONNECT_PATTERNS:
            if pattern.search(line):
                return LogEvent(
                    timestamp=datetime.now(),
                    event_type="server_disconnect",
                    raw_line=line.strip()
                )
        
        return None
    
    def read_new_lines(self, file_path: str) -> List[str]:
        """Lee líneas nuevas desde la última posición conocida"""
        if file_path not in self._file_positions:
            self._file_positions[file_path] = 0
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                f.seek(self._file_positions[file_path])
                lines = f.readlines()
                self._file_positions[file_path] = f.tell()
                return lines
        except Exception as e:
            logger.error(f"Error reading log file {file_path}: {e}")
            return []

    def parse_events(self, lines) -> List[LogEvent]:
        """Parsea una lista de líneas devolviendo todos los eventos detectados"""
        return [ev for line in lines if (ev := self.parse_line(line))]

    async def rescan(self) -> int:
        """
        Re-lee el log completo desde el principio y dispara SOLO el último
        evento detectado (el estado actual real). Re-disparar eventos antiguos
        (servidores previos, desconexiones pasadas) reseteaba el estado.
        Devuelve cuántos eventos se encontraron.
        """
        log_file = self.find_log_file()
        if not log_file:
            return 0

        self._file_positions[log_file] = 0
        events = 0
        try:
            with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            found = self.parse_events(lines)
            if found and self.callback:
                await self.callback(found[-1])
                events = len(found)
            with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                f.seek(0, 2)
                self._file_positions[log_file] = f.tell()
        except Exception as e:
            logger.error(f"Error rescanning log file {log_file}: {e}")
        if events:
            logger.info(f"Log rescan found {events} event(s)")
        return events
    
    async def start_watching(self):
        """Inicia el monitoreo del archivo de log"""
        log_file = self.find_log_file()
        if not log_file:
            logger.warning("No Rust log file found. Checked paths:")
            for p in self.log_paths:
                logger.warning(f"  - {p}")
            return
        
        logger.info(f"Watching Rust log: {log_file}")
        
        # Leer contenido existente primero: solo importa el ÚLTIMO evento
        # (estado actual); los anteriores corresponden a sesiones pasadas.
        lines = self.read_new_lines(log_file)
        found = self.parse_events(lines)
        if found and self.callback:
            await self.callback(found[-1])
        
        # Configurar watchdog para cambios futuros
        event_handler = LogFileHandler(self, log_file)
        self.observer = Observer()
        self.observer.schedule(event_handler, os.path.dirname(log_file), recursive=False)
        self.observer.start()
    
    def stop_watching(self):
        """Detiene el monitoreo"""
        if self.observer:
            self.observer.stop()
            self.observer.join()


class LogFileHandler(FileSystemEventHandler):
    """Manejador de eventos de sistema de archivos para el log"""
    
    def __init__(self, parser: RustLogParser, log_file: str):
        self.parser = parser
        self.log_file = log_file
        super().__init__()
    
    def on_modified(self, event):
        if not event.is_directory and event.src_path == self.log_file:
            asyncio.create_task(self._process_new_lines())
    
    async def _process_new_lines(self):
        lines = self.parser.read_new_lines(self.log_file)
        for line in lines:
            log_event = self.parser.parse_line(line)
            if log_event and self.parser.callback:
                await self.parser.callback(log_event)


rust_log_parser = RustLogParser()