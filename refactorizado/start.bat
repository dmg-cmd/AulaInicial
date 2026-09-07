@echo off
cd /d "%~dp0"
echo Iniciando AulaInicial Refactorizado...
echo.

REM 1) Binario ya presente (compilado con pkg)
if exist bin\AulaInicial.exe goto :run_exe

REM 2) Node del sistema CON dependencias instaladas
where node >nul 2>nul
if %errorlevel%==0 (
    if exist node_modules goto :run_dev
)

REM 3) Node del sistema - instalar dependencias y compilar
where node >nul 2>nul
if %errorlevel%==0 (
    echo =============================================================
    echo   AVISO: Primera ejecucion. Instalando dependencias y
    echo   compilando TypeScript (puede tardar varios minutos).
    echo =============================================================
    timeout /t 2 >nul
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install fallo. Verifique su conexion a internet
        echo         y que Node.js este correctamente instalado.
        pause
        goto :eof
    )
    echo [INFO] Dependencias instaladas. Compilando...
    call npm run build
    if errorlevel 1 (
        echo.
        echo [ERROR] Build fallo. Verifique la salida anterior.
        pause
        goto :eof
    )
    echo [INFO] Build completado. Iniciando servidor...
    call npm start
    goto :eof
)

REM 4) Intentar descargar el binario desde Releases
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

REM 5) Nada funciono: mostrar error
echo.
echo [ERROR] No se pudo obtener el programa.
echo         Instale Node.js desde https://nodejs.org
echo         o descargue el binario manualmente desde GitHub Releases.
pause
goto :eof

:run_exe
echo [INFO] Ejecutando binario AulaInicial.exe...
bin\AulaInicial.exe
goto :exe_cerrado

:run_dev
echo [INFO] Ejecutando en modo desarrollo con Node.js...
npm run dev
goto :exe_cerrado

:exe_cerrado
echo.
echo [AVISO] El programa se cerro.
pause
goto :eof