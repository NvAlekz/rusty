import asyncio
import socket
import struct
import logging
from typing import Optional, List, Dict, Any
from app.core.config import settings
from app.models.schemas import ServerInfo, PlayerData

logger = logging.getLogger(__name__)


class SourceQueryService:
    """Servicio para consultar servidores de Source Engine (Rust usa una variante)"""
    
    def __init__(self, timeout: int = None, retries: int = None):
        self.timeout = timeout or settings.query_timeout
        self.retries = retries or settings.query_retries
    
    async def query_server(self, ip: str, port: int = 28015) -> Optional[ServerInfo]:
        """Consulta información básica del servidor (A2S_INFO)"""
        for attempt in range(self.retries):
            try:
                return await self._query_server_info(ip, port)
            except Exception as e:
                logger.warning(f"Attempt {attempt + 1} failed for {ip}:{port}: {e}")
                if attempt < self.retries - 1:
                    await asyncio.sleep(0.5)
        return None
    
    def _recv_full(self, sock: socket.socket, buffer_size: int = 65535):
        """
        Recibe un datagrama completo, ensamblando split packets si es necesario.
        Protocolo Source: header 0xFFFFFFFF = paquete único,
        0xFFFFFFFE = paquete dividido (se deben reensamblar por número de paquete).
        """
        data, addr = sock.recvfrom(buffer_size)

        # Paquete único
        if data[:4] == b'\xFF\xFF\xFF\xFF':
            return data, addr

        # Split packet: 0xFFFFFFFE + packetID(4) + total(1) + number(1) + size(2)
        if data[:4] == b'\xFF\xFF\xFF\xFE' and len(data) >= 12:
            packet_id = struct.unpack('<l', data[4:8])[0]
            total = data[8]
            packets = {data[9]: data[12:]}

            while len(packets) < total:
                more, addr = sock.recvfrom(buffer_size)
                if (more[:4] == b'\xFF\xFF\xFF\xFE'
                        and len(more) >= 12
                        and struct.unpack('<l', more[4:8])[0] == packet_id):
                    packets[more[9]] = more[12:]

            full = b''.join(packets[i] for i in sorted(packets))
            # El mensaje reensamblado necesita el header de paquete único
            return b'\xFF\xFF\xFF\xFF' + full, addr

        return data, addr
    
    async def _query_server_info(self, ip: str, port: int) -> ServerInfo:
        """Implementa el protocolo A2S_INFO"""
        loop = asyncio.get_event_loop()
        
        def _query():
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(self.timeout)
            try:
                # A2S_INFO request: 0xFFFFFFFF + 'T' + 'Source Engine Query\0'
                request = b'\xFF\xFF\xFF\xFFTSource Engine Query\0'
                sock.sendto(request, (ip, port))
                response, _ = self._recv_full(sock)

                # Handshake de challenge (obligatorio en Rust):
                # el servidor responde 'A' (0x41) + challenge(4 bytes);
                # se reenvía la petición con el challenge pegado al string.
                if len(response) >= 9 and response[4] == 0x41:
                    challenge = struct.unpack('<I', response[5:9])[0]
                    request = b'\xFF\xFF\xFF\xFFTSource Engine Query\0' + struct.pack('<I', challenge)
                    sock.sendto(request, (ip, port))
                    response, _ = self._recv_full(sock)

                return self._parse_server_info(response, ip, port)
            finally:
                sock.close()
        
        return await loop.run_in_executor(None, _query)
    
    def _parse_server_info(self, data: bytes, ip: str, port: int) -> ServerInfo:
        """Parsea la respuesta A2S_INFO"""
        if len(data) < 6 or data[:4] != b'\xFF\xFF\xFF\xFF':
            raise ValueError("Invalid response header")

        # Respuesta válida de A2S_INFO: 'I' (0x49). Si es 'A' (0x41) es
        # el challenge y no debe parsearse como info.
        if data[4] != 0x49:
            raise ValueError(f"Unexpected response type 0x{data[4]:02X} (expected 0x49)")

        # Saltar header (4 bytes) + response type (1 byte) = 5 bytes
        offset = 5
        
        # Protocol version (1 byte)
        protocol = data[offset]
        offset += 1
        
        # Server name (null-terminated string)
        name_end = data.find(b'\x00', offset)
        name = data[offset:name_end].decode('utf-8', errors='ignore')
        offset = name_end + 1
        
        # Map name
        map_end = data.find(b'\x00', offset)
        map_name = data[offset:map_end].decode('utf-8', errors='ignore')
        offset = map_end + 1
        
        # Folder (game directory)
        folder_end = data.find(b'\x00', offset)
        offset = folder_end + 1
        
        # Game name
        game_end = data.find(b'\x00', offset)
        offset = game_end + 1
        
        # Steam App ID (2 bytes)
        app_id = struct.unpack('<H', data[offset:offset+2])[0]
        offset += 2
        
        # Players
        players_current = data[offset]
        offset += 1
        players_max = data[offset]
        offset += 1
        
        # Bots
        offset += 1
        
        # Server type, environment, visibility, VAC
        offset += 4
        
        # Version
        version_end = data.find(b'\x00', offset)
        # version = data[offset:version_end].decode('utf-8', errors='ignore')
        
        return ServerInfo(
            ip=ip,
            port=port,
            name=name,
            map=map_name,
            players_current=players_current,
            players_max=players_max,
            protocol=protocol
        )
    
    async def query_players(self, ip: str, port: int = 28015) -> List[Dict[str, Any]]:
        """Consulta la lista de jugadores conectados (A2S_PLAYER)"""
        for attempt in range(self.retries):
            try:
                return await self._query_players(ip, port)
            except Exception as e:
                logger.warning(f"Player query attempt {attempt + 1} failed for {ip}:{port}: {e}")
                if attempt < self.retries - 1:
                    await asyncio.sleep(0.5)
        return []
    
    async def _query_players(self, ip: str, port: int) -> List[Dict[str, Any]]:
        """Implementa el protocolo A2S_PLAYER con handshake de challenge"""
        loop = asyncio.get_event_loop()
        
        def _query():
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(self.timeout)
            try:
                # Handshake de challenge:
                # 1. Enviar A2S_PLAYER con challenge 0xFFFFFFFF
                # 2. Si responde 'A' + challenge, reenviar con el challenge nuevo
                # 3. Si responde 'D', parsear la lista de jugadores
                challenge = 0xFFFFFFFF
                for _ in range(3):
                    request = b'\xFF\xFF\xFF\xFFU' + struct.pack('<I', challenge)
                    sock.sendto(request, (ip, port))
                    response, _ = self._recv_full(sock)

                    if len(response) < 5:
                        continue

                    response_type = response[4]
                    if response_type == 0x41 and len(response) >= 9:
                        # 'A' = nuevo challenge requerido
                        challenge = struct.unpack('<I', response[5:9])[0]
                        continue
                    if response_type == 0x44:
                        # 'D' = respuesta con datos de jugadores
                        return self._parse_players(response)
                    # Otro tipo de respuesta, reintentar
                    continue
                return []
            finally:
                sock.close()
        
        return await loop.run_in_executor(None, _query)
    
    def _parse_players(self, data: bytes) -> List[Dict[str, Any]]:
        """Parsea la respuesta A2S_PLAYER"""
        if len(data) < 6 or data[:4] != b'\xFF\xFF\xFF\xFF':
            return []
        
        if data[4] != 0x44:  # 'D' = player response
            return []
        
        players = []
        offset = 5
        num_players = data[offset]
        offset += 1
        
        for _ in range(num_players):
            if offset >= len(data):
                break
            
            # Player index (1 byte)
            index = data[offset]
            offset += 1
            
            # Name (null-terminated)
            name_end = data.find(b'\x00', offset)
            if name_end == -1:
                break
            name = data[offset:name_end].decode('utf-8', errors='ignore')
            offset = name_end + 1
            
            # Score (4 bytes, int32)
            if offset + 4 > len(data):
                break
            score = struct.unpack('<i', data[offset:offset+4])[0]
            offset += 4
            
            # Duration (4 bytes, float)
            if offset + 4 > len(data):
                break
            duration = struct.unpack('<f', data[offset:offset+4])[0]
            offset += 4
            
            players.append({
                "index": index,
                "name": name,
                "score": score,
                "duration": duration
            })
        
        return players


source_query_service = SourceQueryService()