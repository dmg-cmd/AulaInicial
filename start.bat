@echo off
cd /d "%~dp0"
echo Iniciando Servidor de Registro de Alumnos...

REM 1) Binario ya presente (incluido el descargado antes)
if exist bin\AulaInicial.exe (
    bin\AulaInicial.exe
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] El binario termino con error (codigo %errorlevel%).
        pause
    )
    goto :eof
)
if exist bin\FormInicial.exe (
    bin\FormInicial.exe
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] El binario termino con error (codigo %errorlevel%).
        pause
    )
    goto :eof
)

REM 2) Node del sistema
where node >nul 2>nul
if %errorlevel%==0 (
    echo [INFO] Ejecutando con Node.js...

    REM Verificar que las dependencias estén instaladas
    if not exist node_modules (
        echo [INFO] Instalando dependencias por primera vez (npm install)...
        npm install
        if %errorlevel% neq 0 (
            echo.
            echo [ERROR] npm install fallo. Verifique su conexion a internet
            echo         y que Node.js este correctamente instalado.
            pause
            goto :eof
        )
        echo [INFO] Dependencias instaladas correctamente.
    )

    node server.js
    echo.
    echo [AVISO] El servidor se detuvo inesperadamente (codigo %errorlevel%).
    pause
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
powershell -NoProfile -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%URL%' -OutFile 'bin\AulaInicial.exe' -MaximumRedirection 10 } catch { Write-Error $_.Exception.Message; exit 1 }"

if exist bin\AulaInicial.exe (
    bin\AulaInicial.exe
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] El binario descargado termino con error (codigo %errorlevel%).
        pause
    )
) else (
    echo [ERROR] No se pudo descargar el binario. Verifique su conexion
    echo         o descarguelo manualmente desde GitHub Releases
    echo         (AulaInicial.exe) en la carpeta bin\.
    pause
)
