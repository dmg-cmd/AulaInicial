#!/bin/bash
# Cambiar al directorio exacto donde se encuentra este script
cd "$(dirname "$0")"

echo "Iniciando Servidor de Registro de Alumnos..."

# 1) Binario ya presente (incluido el descargado en ejecuciones previas)
if [ -f "./bin/AulaInicial-linux" ]; then
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
    echo "[INFO] Ejecutando con Node.js instalado..."
    node server.js
    exit 0
fi

# 3) Faltan ambos: auto-descargar el binario desde Releases (latest)
OS="$(uname -s 2>/dev/null)"
if [ "$OS" = "Darwin" ]; then
    echo "============================================================="
    echo "  AVISO: En Mac este programa requiere Node.js instalado."
    echo "  Instalelo desde https://nodejs.org (boton verde) y vuelva"
    echo "  a ejecutar este script. Si ya lo tiene, verifique que"
    echo "  'node' este disponible en la terminal."
    echo "============================================================="
    read -p "Presiona ENTER para salir..."
    exit 1
fi

echo "============================================================="
echo "  AVISO: Este programa necesita descargar un componente la"
echo "  primera vez (requiere conexion a internet). Solo tardara"
echo "  unos minutos y luego quedara guardado en su USB."
echo "============================================================="
sleep 2

URL="https://github.com/dmg-cmd/AulaInicial/releases/latest/download/AulaInicial-linux"
mkdir -p bin
echo "[INFO] Descargando AulaInicial (no cierre esta ventana)..."
if command -v curl >/dev/null 2>&1; then
    curl -L --progress-bar -o bin/AulaInicial-linux "$URL"
elif command -v wget >/dev/null 2>&1; then
    wget -O bin/AulaInicial-linux "$URL"
else
    echo "[ERROR] No se encontro curl ni wget para descargar."
    echo "         Instale Node.js o descargue el binario AulaInicial-linux"
    echo "         desde GitHub Releases a la carpeta bin/."
    read -p "Presiona ENTER para salir..."
    exit 1
fi

# Verificacion basica del archivo descargado
if [ -f "./bin/AulaInicial-linux" ] && [ -s "./bin/AulaInicial-linux" ]; then
    chmod +x ./bin/AulaInicial-linux
    ./bin/AulaInicial-linux
else
    echo "[ERROR] No se pudo descargar el binario. Verifique su conexion"
    echo "         o descarguelo manualmente desde GitHub Releases"
    echo "         (AulaInicial-linux) en la carpeta bin/."
    read -p "Presiona ENTER para salir..."
    exit 1
fi
