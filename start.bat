@echo off
cd /d "%~dp0"
echo Iniciando Servidor de Registro de Alumnos...

REM 1) Binario ya presente (incluido el descargado antes)
if exist bin\AulaInicial.exe (
    bin\AulaInicial.exe
    goto :eof
)
if exist bin\FormInicial.exe (
    bin\FormInicial.exe
    goto :eof
)

REM 2) Node del sistema
where node >nul 2>nul
if %errorlevel%==0 (
    echo [INFO] Ejecutando con Node.js...
    node server.js
    goto :eof
)

REM 3) Faltan ambos: auto-descargar el binario desde Releases (latest)
echo =============================================================
echo   AVISO: Este programa necesita descargar un componente la
echo   primera vez (requiere conexion a internet). Solo tardara
echo   unos minutos y luego quedara guardado en su USB.
echo =============================================================
timeout /t 2 >nul

set "URL=https://github.com/dmg-cmd/AulaInicial/releases/latest/download/AulaInicial.exe"
if not exist bin mkdir bin
echo [INFO] Descargando AulaInicial (no cierre esta ventana)...
powershell -NoProfile -Command "Invoke-WebRequest -Uri '%URL%' -OutFile 'bin\AulaInicial.exe' -MaximumRedirection 10"

if exist bin\AulaInicial.exe (
    bin\AulaInicial.exe
) else (
    echo [ERROR] No se pudo descargar el binario. Verifique su conexion
    echo          o descarguelo manualmente desde GitHub Releases
    echo          (AulaInicial.exe) en la carpeta bin\.
    pause
)
