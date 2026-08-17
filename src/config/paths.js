const path = require('path');
const fs = require('fs');

const ROOT_DIR = process.cwd();
const EXEC_DIR = path.dirname(process.execPath);

// Buscar la carpeta 'cursos' en la ubicación actual, junto al ejecutable o en la carpeta raíz del proyecto
let CURSOS_DIR = path.join(ROOT_DIR, 'cursos');
if (!fs.existsSync(CURSOS_DIR)) {
    if (fs.existsSync(path.join(EXEC_DIR, 'cursos'))) {
        CURSOS_DIR = path.join(EXEC_DIR, 'cursos');
    } else if (fs.existsSync(path.join(EXEC_DIR, '..', 'cursos'))) {
        CURSOS_DIR = path.join(EXEC_DIR, '..', 'cursos');
    }
}

// Carpeta de registros donde la aplicación guarda de forma autónoma todos los datos modificados/asistencias
const REGISTROS_DIR = path.join(ROOT_DIR, 'registros');
const FOTOS_DIR = path.join(REGISTROS_DIR, 'fotos');

const CONFIG_PATH = path.join(ROOT_DIR, 'form-config.json');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

module.exports = { ROOT_DIR, EXEC_DIR, CURSOS_DIR, REGISTROS_DIR, FOTOS_DIR, CONFIG_PATH, PUBLIC_DIR };
