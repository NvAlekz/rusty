@echo off
setlocal
REM ============================================================
REM  Rusty Backend - Iniciar servidor (PC antigua)
REM  1) Crea el entorno virtual e instala dependencias (1a vez)
REM  2) Arranca el backend en 0.0.0.0:8000 (accesible para el tunel)
REM ============================================================

cd /d "%~dp0.."

if not exist ".venv\Scripts\python.exe" (
    echo [1/2] Creando entorno virtual...
    python -m venv .venv
    if errorlevel 1 goto :error
)

echo [1/2] Instalando dependencias...
".venv\Scripts\python.exe" -m pip install --upgrade pip
".venv\Scripts\python.exe" -m pip install -r backend\requirements.txt
if errorlevel 1 goto :error

echo [2/2] Arrancando backend en http://0.0.0.0:8000 ...
echo       (deja esta ventana abierta)
cd backend
".venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000
goto :eof

:error
echo.
echo ERROR: algo fallo. Revisa que Python este instalado y en el PATH.
pause