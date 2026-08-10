# Rusty — Despliegue del servidor (PC antigua)

Guía para montar el backend en tu PC servidora: la gente descarga la app y
ve el estado del servidor de Rust sin configurar nada.

## Requisitos (una sola vez en la PC antigua)

1. Windows 10/11 (también vale Windows 7+ con Python instalado a mano)
2. Python 3.11+ desde https://www.python.org/downloads/ —
   marcar **"Add Python to PATH"** durante la instalación.

## Configuración

1. Copia todo el proyecto (o clona el repo) a la PC antigua.
2. Edita `backend/.env` (si no existe, copia `backend/.env.example` a `backend/.env`):
   ```ini
   STEAM_API_KEY=tu_clave_steam
   TARGET_SERVER_IP=1.2.3.4        # IP del servidor de Rust a monitorizar
   TARGET_SERVER_PORT=28015        # puerto de query del servidor
   BACKEND_HOST=0.0.0.0
   BACKEND_PORT=8000
   ```

## Arranque

Doble clic en `scripts\run_server.bat`. Esto crea el entorno Python,
instala dependencias y deja el backend escuchando en el puerto 8000.
Deja esa ventana abierta.

## Exponer a internet (Cloudflare Tunnel)

Doble clic en `scripts\run_tunnel.bat`. Imprime una URL tipo
`https://xxxx-yyyy.trycloudflare.com`. **Esa URL es la dirección pública**
del backend.

- Funciona aunque el router use CGNAT (IP compartida) — no hay que
  abrir puertos ni tener IP pública.
- La URL cambia en cada reinicio del túnel (gratis). Para una URL
  fija necesitas `cloudflared tunnel login` con una cuenta Cloudflare,
  o un dominio propio.

## Publicar la app con la URL del túnel

Cuando tengas la URL del túnel (ej. `https://abc-123.trycloudflare.com`),
compila la app para que la gente la descargue apuntando ahí:

```powershell
cd frontend
$env:VITE_WS_URL="wss://abc-123.trycloudflare.com/api/ws"   # <-- tu URL
npm run electron:build
```

Luego sube el `.exe` resultante (`frontend\release\Rusty Setup X.X.X.exe`)
como Release en GitHub → los usuarios verán la actualización automática.

## Verificar que funciona

Con el backend corriendo, abre en un navegador:
- `http://127.0.0.1:8000/api/status` → estado del tracker
- `http://127.0.0.1:8000/docs` → documentación interactiva

Y desde fuera (con el túnel activo):
- `https://xxxx.trycloudflare.com/api/status`