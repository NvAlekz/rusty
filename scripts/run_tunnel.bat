@echo off
setlocal
REM ============================================================
REM  Rusty - Tunel Cloudflare (PC antigua)
REM  Expone el backend local (127.0.0.1:8000) a internet sin
REM  necesitar IP publica ni abrir puertos en el router.
REM
REM  Al arrancar imprime una URL tipo:
REM      https://XXXX-YYYY.trycloudflare.com
REM  Esa URL es la que la gente usara para ver el estado del servidor.
REM ============================================================

where cloudflared >nul 2>nul
if errorlevel 1 (
    echo [1/2] Instalando cloudflared (Cloudflare Tunnel)...
    powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%TEMP%\cloudflared.exe'; Move-Item -Force '%TEMP%\cloudflared.exe' '%~dp0cloudflared.exe'"
    if errorlevel 1 goto :error
)

echo [2/2] Abriendo tunel hacia http://127.0.0.1:8000 ...
echo       Copia la URL https://xxxx.trycloudflare.com que aparecera abajo
"%~dp0cloudflared.exe" tunnel --url http://127.0.0.1:8000
goto :eof

:error
echo.
echo ERROR: no se pudo instalar cloudflared. Revisa conexion a internet.
pause