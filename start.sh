#!/bin/bash
# Cambiar al directorio exacto donde se encuentra este script
cd "$(dirname "$0")"

echo "Iniciando Servidor de Registro de Alumnos..."

OS="$(uname -s 2>/dev/null)"
ARCH="$(uname -m 2>/dev/null)"

# Determinar nombre del binario segun Sistema Operativo y Arquitectura
if [ "$OS" = "Darwin" ]; then
    if [ "$ARCH" = "arm64" ]; then
        BIN_NAME="AulaInicial-macos-arm64"
    else
        BIN_NAME="AulaInicial-macos-x64"
    fi
else
    BIN_NAME="AulaInicial-linux"
fi

# 1) Binario ya presente (incluido el descargado en ejecuciones previas)
if [ -f "./bin/$BIN_NAME" ]; then
    chmod +x "./bin/$BIN_NAME" 2>/dev/null
    "./bin/$BIN_NAME"
    exit 0
fi

# Fallback si existe un binario alternativo ya presente
if [ "$OS" = "Darwin" ] && [ -f "./bin/AulaInicial-macos" ]; then
    chmod +x ./bin/AulaInicial-macos 2>/dev/null
    ./bin/AulaInicial-macos
    exit 0
fi
if [ -f "./bin/AulaInicial-linux" ] && [ "$OS" != "Darwin" ]; then
    chmod +x ./bin/AulaInicial-linux 2>/dev/null
    ./bin/AulaInicial-linux
    exit 0
fi
if [ -f "./bin/FormInicial-linux" ]; then
    chmod +x ./bin/FormInicial-linux 2>/dev/null
    ./bin/FormInicial-linux
    exit 0
fi

# 2) Node del sistema
if command -v node >/dev/null 2>&1; then
    echo "[INFO] Ejecutando con Node.js instalado en el sistema..."
    node server.js
    exit 0
fi

# 3) Faltan ambos: auto-descargar el binario desde Releases (latest)
echo "============================================================="
echo "  AVISO: Este programa necesita descargar un componente la"
echo "  primera vez (requiere conexion a internet). Solo tardara"
echo "  unos minutos y luego quedara guardado en su USB."
echo "  Plataforma detectada: $OS ($ARCH) -> $BIN_NAME"
echo "============================================================="
sleep 2

URL="https://github.com/dmg-cmd/AulaInicial/releases/latest/download/$BIN_NAME"
mkdir -p bin
echo "[INFO] Descargando AulaInicial ($BIN_NAME) (no cierre esta ventana)..."
if command -v curl >/dev/null 2>&1; then
    curl -L --progress-bar -o "bin/$BIN_NAME" "$URL"
elif command -v wget >/dev/null 2>&1; then
    wget -O "bin/$BIN_NAME" "$URL"
else
    echo "[ERROR] No se encontro curl ni wget para descargar."
    echo "         Instale Node.js o descargue el binario $BIN_NAME"
    echo "         desde GitHub Releases a la carpeta bin/."
    read -p "Presiona ENTER para salir..."
    exit 1
fi

# Verificacion basica del archivo descargado
if [ -f "./bin/$BIN_NAME" ] && [ -s "./bin/$BIN_NAME" ]; then
    chmod +x "./bin/$BIN_NAME"
    "./bin/$BIN_NAME"
else
    echo "[ERROR] No se pudo descargar el binario. Verifique su conexion"
    echo "         o descarguelo manualmente desde GitHub Releases"
    echo "         ($BIN_NAME) en la carpeta bin/."
    read -p "Presiona ENTER para salir..."
    exit 1
fi
