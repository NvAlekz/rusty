# Rust Tracker

Overlay estilo "Valorant Tracker" para Rust. Detecta el servidor al que te conectas (leyendo los logs del juego), consulta los jugadores conectados vía Source Engine Query y muestra sus estadísticas de Steam en tiempo real con un indicador de riesgo.

## Estructura de carpetas

```
Rusty/
├── backend/
│   ├── .env                      # Configuración (API key de Steam, rutas de logs)
│   ├── requirements.txt
│   └── app/
│       ├── main.py               # Entry point FastAPI
│       ├── api/
│       │   └── routes.py         # Endpoints REST + WebSocket
│       ├── core/
│       │   └── config.py         # Settings desde .env
│       ├── models/
│       │   └── schemas.py        # Modelos Pydantic (PlayerData, ServerInfo, etc.)
│       ├── services/
│       │   ├── log_parser.py     # Lee client.txt/output_log.txt en tiempo real
│       │   ├── source_query.py   # Protocolo Source Engine (A2S_INFO / A2S_PLAYER)
│       │   ├── steam_api.py      # Steam Web API (stats, horas, bans, perfiles)
│       │   ├── steamid_resolver.py # Nombre → SteamID64 (búsqueda comunidad)
│       │   ├── risk_evaluator.py # Calcula el nivel de riesgo de cada jugador
│       │   └── tracker.py        # Orquestador principal + WebSocket
│       └── utils/
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── electron/
│   │   ├── main.cjs             # Ventana overlay transparente
│   │   └── preload.cjs
│   └── src/
│       ├── main.jsx
│       ├── App.jsx              # Decide entre Control Panel y Overlay
│       ├── hooks/
│       │   └── useTrackerWebSocket.jsx
│       ├── components/
│       │   └── PlayerTable.jsx  # Tabla de jugadores + detalles
│       ├── utils/
│       │   ├── format.js
│       │   └── risk.js
│       └── styles/
│           └── global.css
└── README.md
```

## Backend (FastAPI)

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/status` | Estado del tracker (¿conectado a servidor? ¿log encontrado?) |
| GET | `/api/server` | Información del servidor actual |
| GET | `/api/players` | Lista completa de jugadores con stats, bans y riesgo |
| POST | `/api/refresh` | Fuerza actualización manual |
| GET | `/api/query/{ip}:{port}` | Consulta manual de un servidor específico |
| WS | `/api/ws` | Actualizaciones en tiempo real al overlay |

### Flujo de trabajo

1. **`log_parser.py`** vigila `client.txt` / `output_log.txt` con `watchdog`.
2. Al detectar `Connecting to [IP]:[PORT]`, se guarda el servidor actual.
3. **`source_query.py`** consulta el servidor con A2S_INFO (nombre/mapa/jugadores) y A2S_PLAYER (nombres/scores).
4. **`steamid_resolver.py`** convierte cada nombre en SteamID64 (búsqueda en Steam Community).
5. **`steam_api.py`** consulta en paralelo:
   - `GetUserStatsForGame` → KDA, headshots, precisión
   - `GetOwnedGames` (AppID 252490) → horas jugadas
   - `GetPlayerBans` → VAC/Game bans
   - `GetPlayerSummaries` → nombre, avatar, privacidad, edad de cuenta
6. **`risk_evaluator.py`** asigna riesgo:
   - 🔴 **Peligro**: VAC/Game ban, o cuenta nueva (<4 semanas) con KDA ≥ 5 y ≥50 kills
   - 🟡 **Sospechoso**: KDA ≥ 3.5, tasa de headshots ≥ 35%, precisión ≥ 40%
   - 🟢 **Seguro**: sin señales
   - ⚪ **Privado**: perfil privado
7. **`tracker.py`** envía el estado por WebSocket al overlay.

## Instalación

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Edita `backend/.env` con tu Steam API Key (https://steamcommunity.com/dev/apikey) y verifica la ruta de tus logs.

Ejecuta:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Prueba: http://127.0.0.1:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev            # Solo React en navegador (http://localhost:5173)
npm run electron:dev   # React + ventana overlay de Electron
```

Para construir el instalador de Windows:

```bash
npm run electron:build
```

## Librerías adicionales

### Backend
| Librería | Uso |
|----------|-----|
| `fastapi` | Framework API |
| `uvicorn[standard]` | Servidor ASGI |
| `httpx` | Peticiones async a Steam Web API |
| `pydantic-settings` | Config desde `.env` |
| `watchdog` | Vigilar el archivo de log en tiempo real |
| `websockets` | Comunicación con el overlay |

Nota: la implementación de Source Engine Query está hecha a mano con `socket` (sin dependencias externas) para que sea async-friendly.

### Frontend
| Librería | Uso |
|----------|-----|
| `react`, `react-dom` | UI |
| `vite` + `@vitejs/plugin-react` | Build/dev server |
| `electron` | Shell de escritorio |
| `electron-builder` | Empaquetar instalador |
| `concurrently`, `wait-on` | Lanzar Vite + Electron juntos |

## Sobre el overlay

- Ventana **transparente**, **sin bordes**, **siempre encima** (`electron/main.cjs`).
- `focusable: false` para no robar el foco al juego.
- `setAlwaysOnTop(true, 'screen-saver')` + `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` para flotar sobre juegos a pantalla completa.
- Se abre en el monitor primario a la derecha; puedes moverla con los handlers IPC (`overlay:move`).

## Limitaciones y notas

- **SteamID por nombre**: A2S_PLAYER solo devuelve nombres. La resolución nombre→SteamID es heurística. Para un funcionamiento 100% fiable, usa RCON (`playerlist`) o un endpoint del servidor que exponga SteamIDs.
- **Rate limits de Steam**: Steam limita a ~100.000 peticiones/día por API key. Para servidores con muchos jugadores, el tracker cachea datos 5 minutos.
- **Perfiles privados**: no devuelven stats ni horas; el overlay los marca como "Privado".
- Los logs de Rust pueden tardar un momento en escribirse; el parser usa posiciones de archivo para no re-leer.
