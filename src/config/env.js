const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { ROOT_DIR } = require('./paths');

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

// Secreto HMAC: exigir variable de entorno o generarlo y persistirlo en .secret (fuera del árbol estático)
function loadOrCreateHmacSecret() {
    if (process.env.AULA_INICIAL_SECRET && process.env.AULA_INICIAL_SECRET.trim()) {
        return process.env.AULA_INICIAL_SECRET.trim();
    }
    const secretFile = path.join(ROOT_DIR, '.secret');
    try {
        if (fs.existsSync(secretFile)) {
            const stored = fs.readFileSync(secretFile, 'utf8').trim();
            if (stored) return stored;
        }
        const generated = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(secretFile, generated, { encoding: 'utf8', mode: 0o600 });
        console.log('🔑 Secreto HMAC generado y persistido en .secret');
        return generated;
    } catch (err) {
        console.error('No se pudo persistir el secreto HMAC, se genera uno en memoria:', err);
        return crypto.randomBytes(32).toString('hex');
    }
}

const HMAC_SECRET = loadOrCreateHmacSecret();

// Obtener IPs disponibles priorizando adaptadores físicos de Wi-Fi/LAN y omitiendo tarjetas virtuales
function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const devName in interfaces) {
        const devLow = devName.toLowerCase();
        if (devLow.includes('vmware') || devLow.includes('virtualbox') || devLow.includes('vbox') || devLow.includes('vethernet') || devLow.includes('wsl') || devLow.includes('bluetooth') || devLow.includes('hyper-v')) {
            continue;
        }
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                if (!alias.address.startsWith('169.254.')) {
                    ips.push(alias.address);
                }
            }
        }
    }
    if (ips.length === 0) {
        for (const devName in interfaces) {
            const iface = interfaces[devName];
            for (let i = 0; i < iface.length; i++) {
                const alias = iface[i];
                if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal && !alias.address.startsWith('169.254.')) {
                    ips.push(alias.address);
                }
            }
        }
    }
    return ips;
}

module.exports = { PORT, ROOT_DIR, ALLOWED_ORIGINS, HMAC_SECRET, getLocalIPs };
