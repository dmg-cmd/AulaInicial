const fs = require('fs');
const { REGISTROS_DIR, FOTOS_DIR } = require('../config/paths');

// Asegurar que la carpeta de registros y fotos existen
if (!fs.existsSync(REGISTROS_DIR)) {
    fs.mkdirSync(REGISTROS_DIR, { recursive: true });
}
if (!fs.existsSync(FOTOS_DIR)) {
    fs.mkdirSync(FOTOS_DIR, { recursive: true });
}

// Estado compartido de la aplicación (mutable). Los módulos de rutas importan este objeto.
const state = {
    activeCourse: '',               // Archivo .xlsx seleccionado
    formConfig: null,               // Configuración del formulario (cargada desde form-config.json)
    registeredIPs: new Set(),       // IPs que ya se registraron en esta sesión
    serverInfo: { url: '', qr: '' },// URL/QR mostrados en pantalla
    sessions: new Map()             // token de sesión docente -> expiración (ms)
};

module.exports = { state };
