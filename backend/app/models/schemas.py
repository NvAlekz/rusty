from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class PlayerRiskLevel(str, Enum):
    LOW = "low"           # Verde - Jugador normal
    MEDIUM = "medium"     # Amarillo - Estadísticas inusuales
    HIGH = "high"         # Rojo - Posible cheater / VAC Ban / Nuevo con stats altas
    PRIVATE = "private"   # Gris - Perfil privado


class ServerInfo(BaseModel):
    ip: str
    port: int = 28015
    name: Optional[str] = None
    map: Optional[str] = None
    players_current: int = 0
    players_max: int = 0
    protocol: Optional[int] = None


class SteamPlayerSummary(BaseModel):
    steamid: str
    personaname: str
    profileurl: str
    avatar: str
    avatarmedium: str
    avatarfull: str
    personastate: int
    communityvisibilitystate: int
    profilestate: Optional[int] = None
    lastlogoff: Optional[int] = None
    timecreated: Optional[int] = None
    realname: Optional[str] = None
    primaryclanid: Optional[str] = None
    gameextrainfo: Optional[str] = None
    gameid: Optional[str] = None
    loccountrycode: Optional[str] = None
    locstatecode: Optional[str] = None
    loccityid: Optional[int] = None


class PlayerBans(BaseModel):
    steamid: str
    communitybanned: bool
    vacbanned: bool
    numberofvacbans: int
    dayssincelastban: int
    numberofgamebans: int
    economyban: str


class OwnedGame(BaseModel):
    appid: int
    name: Optional[str] = None
    playtime_forever: Optional[int] = 0
    playtime_windows_forever: Optional[int] = None
    playtime_mac_forever: Optional[int] = None
    playtime_linux_forever: Optional[int] = None
    rtime_last_played: Optional[int] = None


class RustStats(BaseModel):
    kills: int = 0
    deaths: int = 0
    headshots: int = 0
    bullets_fired: int = 0
    bullets_hit: int = 0
    kda: float = 0.0
    accuracy_percent: float = 0.0
    hs_ratio: float = 0.0
    fsd_ratio: float = 0.0
    playtime_hours: float = 0.0


class PlayerData(BaseModel):
    steamid: str
    name: str
    avatar: str = ""
    avatar_medium: str = ""
    avatar_full: str = ""
    profile_url: str = ""
    is_private: bool
    risk_level: PlayerRiskLevel = PlayerRiskLevel.LOW
    risk_reasons: List[str] = Field(default_factory=list)

    # Rust Stats
    rust_stats: Optional[RustStats] = None

    # Bans
    vac_banned: bool = False
    game_bans: int = 0
    days_since_last_ban: int = 0

    # Playtime
    rust_playtime_hours: float = 0.0

    # Account age in days (if profile is public)
    account_age_days: Optional[float] = None

    # Connection info
    connected_at: datetime = Field(default_factory=datetime.now)
    score: Optional[int] = None
    ping: Optional[int] = None

    # Cache metadata (not serialized to frontend)
    last_fetched: float = Field(default=0.0, exclude=True)


class ServerPlayersResponse(BaseModel):
    server: ServerInfo
    players: List[PlayerData]
    total_players: int
    fetched_at: datetime = Field(default_factory=datetime.now)


class LogEvent(BaseModel):
    timestamp: datetime
    event_type: str
    raw_line: str
    server_ip: Optional[str] = None
    server_port: Optional[int] = None


class WebSocketMessage(BaseModel):
    type: str
    payload: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.now)