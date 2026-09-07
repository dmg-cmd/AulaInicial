#!/bin/bash
# Cambiar al directorio exacto donde se encuentra este script
cd "$(dirname "$0")"

echo "Iniciando AulaInicial Refactorizado..."

# 1) Binario ya presente (compilado con pkg)
if [ -f "./bin/AulaInicial-linux" ]; then
    chmod +x ./bin/AulaInicial-linux 2>/dev/null
    ./bin/AulaInicial-linux
    exit 0
fi

# 2) Node del sistema con dependencias instaladas
if command -v node >/dev/null 2>&1; then
    if [ -d "./node_modules" ]; then
        echo "[INFO] Ejecutando con Node.js instalado (modo desarrollo)..."
        npm run dev
        exit 0
    fi
fi

# 3) Node del sistema - instalar dependencias y compilar
if command -v node >/dev/null 2>&1; then
    echo "============================================================="
    echo "  AVISO: Primera ejecución. Instalando dependencias y"
    echo "  compilando TypeScript (puede tardar unos minutos)."
    echo "============================================================="
    sleep 2
    npm install
    if [ $? -eq 0 ]; then
        echo "[INFO] Dependencias instaladas. Compilando..."
        npm run build
        if [ $? -eq 0 ]; then
            echo "[INFO] Build completado. Iniciando servidor..."
            npm start
            exit 0
        fi
    fi
    echo "[ERROR] Fallo en npm install o build."
    read -p "Presiona ENTER para salir..."
    exit 1
fi

# 4) Faltan ambos: auto-descargar el binario desde Releases
echo "============================================================="
echo "  AVISO: Este programa necesita Node.js instalado o"
echo "  descargar el binario precompilado desde GitHub Releases."
echo "============================================================="
sleep 2

URL="https://github.com/dmg-cmd/AulaInicial/releases/latest/download/AulaInicial-linux"
mkdir -p bin
echo "[INFO] Descargando binario precompilado (no cierre esta ventana)..."
if command -v curl >/dev/null 2>&1; then
    curl -L --progress-bar -o bin/AulaInicial-linux "$URL"
elif command -v wget >/dev/null 2>&1; then
    wget -O bin/AulaInicial-linux "$URL"
else
    echo "[ERROR] No se encontro curl ni wget para descargar."
    echo "         Instale Node.js (https://nodejs.org) o descargue el"
    echo "         binario AulaInicial-linux desde GitHub Releases"
    echo "         a la carpeta bin/."
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