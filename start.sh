#!/bin/bash
# Cambiar al directorio exacto donde se encuentra este script
cd "$(dirname "$0")"

echo "Iniciando Servidor de Registro de Alumnos..."

if [ -f "./bin/AulaInicial-linux" ]; then
    chmod +x ./bin/AulaInicial-linux 2>/dev/null
    ./bin/AulaInicial-linux
elif [ -f "./bin/FormInicial-linux" ]; then
    chmod +x ./bin/FormInicial-linux 2>/dev/null
    ./bin/FormInicial-linux
elif command -v node >/dev/null 2>&1; then
    echo "[INFO] Ejecutando mediante Node.js instalado..."
    node server.js
else
    echo "[ERROR] No se encontró ./bin/AulaInicial-linux ni Node.js en el sistema."
    read -p "Presiona ENTER para salir..."
fi

