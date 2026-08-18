@echo off
cd /d "%~dp0"
echo Iniciando Servidor de Registro de Alumnos...
echo.

REM 1) Binario ya presente (incluido el descargado antes)
if exist bin\AulaInicial.exe goto :run_exe
if exist bin\FormInicial.exe goto :run_exe_form

REM 2) Node del sistema
where node >nul 2>nul
if %errorlevel%==0 goto :run_node

REM 3) Sin binario y sin Node: intentar descargar desde Releases
echo =============================================================
echo   AVISO: Este programa necesita descargar un componente la
echo   primera vez (requiere conexion a internet). Solo tardara
echo   unos minutos y luego quedara guardado en su USB.
echo =============================================================
timeout /t 2 >nul
set "URL=https://github.com/dmg-cmd/AulaInicial/releases/latest/download/AulaInicial.exe"
if not exist bin mkdir bin
echo [INFO] Descargando AulaInicial (no cierre esta ventana)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri '%URL%' -OutFile 'bin\AulaInicial.exe' -MaximumRedirection 10 -ErrorAction Stop } catch { Write-Host $_.Exception.Message; exit 1 }"
if exist bin\AulaInicial.exe goto :run_exe
echo.
echo [ERROR] No se pudo descargar el binario. Verifique su conexion
echo         a internet o descargue AulaInicial.exe manualmente
echo         desde GitHub Releases y coloquelo en la carpeta bin\.
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

:run_node
echo [INFO] Node.js detectado en el sistema.
if exist node_modules goto :start_server
echo [INFO] Instalando dependencias por primera vez...
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

:start_server
echo [INFO] Iniciando servidor...
echo.
node server.js
echo.
echo [AVISO] El servidor se detuvo inesperadamente.
pause
