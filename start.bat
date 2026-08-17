@echo off
cd /d "%~dp0"
echo Iniciando Servidor de Registro de Alumnos...

if exist bin\AulaInicial.exe (
    bin\AulaInicial.exe
) else if exist bin\FormInicial.exe (
    bin\FormInicial.exe
) else (
    where node >nul 2>nul
    if %errorlevel%==0 (
        echo [INFO] Ejecutando mediante Node.js...
        node server.js
    ) else (
        echo [ERROR] No se encontro el ejecutable en bin\ ni Node.js instalado.
    )
)

pause


