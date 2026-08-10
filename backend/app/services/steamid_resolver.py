import httpx
import re
import time
import json
import asyncio
import logging
from typing import Optional, Dict, Tuple
from app.core.config import settings

logger = logging.getLogger(__name__)


class SteamIDResolver:
    """
    Resuelve un nombre de jugador a su SteamID64.

    Nota: A2S_PLAYER solo devuelve nombres, no SteamIDs. Para obtener el ID real
    se usan heurísticas:
      1. Si el servidor permite RCON, se usa `playerlist` (SteamIDs exactos).
      2. Como fallback, se busca el perfil en Steam Community por nombre exacto.
    """

    BASE_URL = "https://api.steampowered.com"
    COMMUNITY_SEARCH = "https://steamcommunity.com/search/SearchCommunityResults"
    CACHE_TTL = 3600  # 60 min para resultados y fallos

    def __init__(self, api_key: str = None):
        self.api_key = api_key or settings.steam_api_key
        self.client = httpx.AsyncClient(timeout=30.0, follow_redirects=True)
        # Cache por nombre: resultado (o None) + timestamp. Evita re-resolver
        # los mismos nombres en cada refresh del tracker.
        self._cache: Dict[str, Tuple[Optional[str], float]] = {}
        self._search_semaphore = asyncio.Semaphore(4)

    async def close(self):
        await self.client.aclose()

    async def resolve_vanity(self, vanity_name: str) -> Optional[str]:
        """Resuelve un nombre vanity/custom URL a SteamID64 (exacto, sin scraping)"""
        if not vanity_name:
            return None

        try:
            url = f"{self.BASE_URL}/ISteamUser/ResolveVanityURL/v0001/"
            params = {"key": self.api_key, "vanityurl": vanity_name}
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            result = response.json().get("response", {})
            if result.get("success") == 1:
                return result.get("steamid")
            return None
        except Exception as e:
            logger.error(f"Error resolving vanity URL: {e}")
            return None

    async def search_community(self, name: str) -> Optional[str]:
        """Busca el SteamID64 por nombre exacto en Steam Community (fallback)"""
        if not name:
            return None

        async with self._search_semaphore:
            try:
                params = {
                    "text": name,
                    "category": "players",
                    "sessiondata": "",
                    "filter": "players",
                    "search_type": "users",
                }
                response = await self.client.get(self.COMMUNITY_SEARCH, params=params)
                if response.status_code != 200:
                    return None

                html = response.text
                # Buscar todos los SteamID64 en la página
                steamids = set(re.findall(r'steamID64["\']?\s*[:=]\s*["\']?(\d{17})', html))
                steamids.update(re.findall(r'/profiles/(\d{17})', html))

                if not steamids:
                    return None

                # El nombre exacto debería aparecer en la entrada correcta
                # Buscar bloques de usuarios
                blocks = re.split(r'<div class="search_row', html)[1:]
                for block in blocks:
                    block_steamids = re.findall(r'/profiles/(\d{17})', block)
                    if not block_steamids:
                        block_steamids = re.findall(r'(\d{17})', block)
                    if not block_steamids:
                        continue
                    # Normalizar nombre: quitar tags HTML
                    text = re.sub(r'<[^>]+>', ' ', block)
                    text = text.replace('&amp;', '&').strip()
                    if name.lower() in text.lower():
                        return block_steamids[0]

                # Fallback: primer resultado
                if steamids:
                    return list(steamids)[0]
                return None
            except Exception as e:
                logger.error(f"Error searching community for {name}: {e}")
                return None

    async def resolve(self, player_name: str) -> Optional[str]:
        """Intenta resolver un nombre a SteamID64 usando todas las estrategias"""
        now = time.time()
        cached = self._cache.get(player_name)
        if cached and now - cached[1] < self.CACHE_TTL:
            return cached[0]

        steamid = None
        # 1. Si el nombre parece ser una custom URL válida (solo alfanumérica)
        if re.fullmatch(r'[A-Za-z0-9_-]{3,32}', player_name):
            steamid = await self.resolve_vanity(player_name)
            if steamid:
                self._cache[player_name] = (steamid, now)
                return steamid

        # 2. Búsqueda en comunidad
        steamid = await self.search_community(player_name)

        self._cache[player_name] = (steamid, now)
        return steamid


steamid_resolver = SteamIDResolver()