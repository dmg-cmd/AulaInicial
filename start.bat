@echo off
cd /d "%~dp0"
echo Iniciando Servidor de Registro de Alumnos...
echo.

REM 1) Binario ya presente (incluido el descargado antes)
if exist bin\AulaInicial.exe goto :run_exe
if exist bin\FormInicial.exe goto :run_exe_form

REM 2) Node del sistema CON dependencias instaladas
where node >nul 2>nul
if %errorlevel%==0 (
    if exist node_modules goto :start_server
)

REM 3) Intentar descargar el binario desde Releases (un solo archivo, mas rapido que npm install)
echo =============================================================
echo   AVISO: Este programa necesita descargar un componente la
echo   primera vez. Solo tardara unos minutos y luego quedara
echo   guardado en su USB.
echo =============================================================
timeout /t 2 >nul
set "URL=https://github.com/dmg-cmd/AulaInicial/releases/latest/download/AulaInicial.exe"
if not exist bin mkdir bin
echo [INFO] Descargando AulaInicial (no cierre esta ventana)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri '%URL%' -OutFile 'bin\AulaInicial.exe' -MaximumRedirection 10 -ErrorAction Stop } catch { Write-Host $_.Exception.Message; exit 1 }"
if exist bin\AulaInicial.exe goto :run_exe
echo [AVISO] No se pudo descargar el binario automaticamente.

REM 4) Si hay Node pero fallo la descarga, intentar npm install como ultimo recurso
where node >nul 2>nul
if %errorlevel%==0 goto :run_node_install

REM Nada funciono: mostrar error
echo.
echo [ERROR] No se pudo obtener el programa. Verifique su conexion
echo         a internet o pida ayuda para instalarlo.
pause
goto :eof

:run_exe
echo [INFO] Ejecutando binario AulaInicial.exe...
bin\AulaInicial.exe
goto :exe_cerrado

:run_exe_form
echo [INFO] Ejecutando binario FormInicial.exe...
bin\FormInicial.exe
goto :exe_cerrado

:exe_cerrado
echo.
echo [AVISO] El programa se cerro.
pause
goto :eof

:start_server
echo [INFO] Iniciando servidor...
echo.
node server.js
echo.
echo [AVISO] El servidor se detuvo inesperadamente.
pause
goto :eof

:run_node_install
echo [INFO] Node.js detectado pero sin dependencias.
echo.
echo =============================================================
echo   Por favor tenga paciencia, la instalacion de dependencias
echo   puede tardar varios minutos la primera vez.
echo   NO cierre esta ventana.
echo =============================================================
echo.
call npm install
if errorlevel 1 (
    echo.
    echo [ERROR] npm install fallo. Verifique su conexion a internet
    echo         y que Node.js este correctamente instalado.
    pause
    goto :eof
)
echo [INFO] Dependencias instaladas correctamente.
echo.
goto :start_server
