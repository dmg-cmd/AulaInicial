const path = require('path');
const fs = require('fs');

const ROOT_DIR = process.cwd();
const EXEC_DIR = path.dirname(process.execPath);

// Buscar la carpeta 'cursos' en la ubicación actual, junto al ejecutable, en la carpeta raíz del proyecto o vía variable de entorno para pruebas
let CURSOS_DIR = process.env.TEST_CURSOS_DIR || path.join(ROOT_DIR, 'cursos');
if (!process.env.TEST_CURSOS_DIR && !fs.existsSync(CURSOS_DIR)) {
    if (fs.existsSync(path.join(EXEC_DIR, 'cursos'))) {
        CURSOS_DIR = path.join(EXEC_DIR, 'cursos');
    } else if (fs.existsSync(path.join(EXEC_DIR, '..', 'cursos'))) {
        CURSOS_DIR = path.join(EXEC_DIR, '..', 'cursos');
    }
}

// Carpeta de registros donde la aplicación guarda de forma autónoma todos los datos modificados/asistencias
const REGISTROS_DIR = process.env.TEST_REGISTROS_DIR || path.join(ROOT_DIR, 'registros');
const FOTOS_DIR = path.join(REGISTROS_DIR, 'fotos');

const CONFIG_PATH = path.join(ROOT_DIR, 'form-config.json');
const CONFIG_BACKUP_PATH = path.join(ROOT_DIR, 'form-config.backup.json');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

// Búsqueda resiliente de la carpeta 'assets' en ROOT_DIR, EXEC_DIR o en la raíz del código fuente
let ASSETS_DIR = path.join(ROOT_DIR, 'assets');
if (!fs.existsSync(ASSETS_DIR)) {
    if (fs.existsSync(path.join(EXEC_DIR, 'assets'))) {
        ASSETS_DIR = path.join(EXEC_DIR, 'assets');
    } else if (fs.existsSync(path.join(__dirname, '..', '..', 'assets'))) {
        ASSETS_DIR = path.join(__dirname, '..', '..', 'assets');
    }
}

module.exports = { ROOT_DIR, EXEC_DIR, CURSOS_DIR, REGISTROS_DIR, FOTOS_DIR, CONFIG_PATH, CONFIG_BACKUP_PATH, PUBLIC_DIR, ASSETS_DIR };

