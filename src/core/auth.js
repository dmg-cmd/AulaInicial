const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ROOT_DIR } = require('../config/paths');
const { state } = require('./state');

// ───────────────────────────────────────────────────────────────
// AUTENTICACIÓN DEL PANEL DOCENTE (A1)
// ───────────────────────────────────────────────────────────────
const DEFAULT_ADMIN_PASS = 'admin123';
const ADMIN_PASS_FILE = path.join(ROOT_DIR, '.adminpass');
// Prioridad de contraseña: archivo .adminpass > env ADMIN_PASS > 'admin123'
let ADMIN_PASS = DEFAULT_ADMIN_PASS;
try {
    if (fs.existsSync(ADMIN_PASS_FILE)) {
        const stored = fs.readFileSync(ADMIN_PASS_FILE, 'utf8').trim();
        if (stored) ADMIN_PASS = stored;
        else ADMIN_PASS = process.env.ADMIN_PASS || DEFAULT_ADMIN_PASS;
    } else {
        ADMIN_PASS = process.env.ADMIN_PASS || DEFAULT_ADMIN_PASS;
    }
} catch (err) {
    console.error('No se pudo leer la contraseña del archivo, se usa la del entorno o la por defecto:', err);
    ADMIN_PASS = process.env.ADMIN_PASS || DEFAULT_ADMIN_PASS;
}

function isUsingDefaultPassword() {
    return ADMIN_PASS === DEFAULT_ADMIN_PASS;
}
function saveAdminPassword() {
    try {
        fs.writeFileSync(ADMIN_PASS_FILE, ADMIN_PASS, { encoding: 'utf8', mode: 0o600 });
        return true;
    } catch (err) {
        console.error('No se pudo persistir la contraseña en .adminpass:', err);
        return false;
    }
}
if (isUsingDefaultPassword()) {
    console.log(`🔑 Panel docente: contraseña por defecto [${ADMIN_PASS}]. Será obligatorio cambiarla en el primer ingreso.`);
}
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas

function signSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

function parseCookies(req) {
    const header = req.headers.cookie || '';
    const out = {};
    header.split(';').forEach(part => {
        const idx = part.indexOf('=');
        if (idx > 0) {
            const key = part.slice(0, idx).trim();
            const val = part.slice(idx + 1).trim();
            out[key] = decodeURIComponent(val);
        }
    });
    return out;
}

function isAdminAuthenticated(req) {
    const cookies = parseCookies(req);
    const token = cookies.aula_admin_session;
    if (!token) return false;
    const exp = state.sessions.get(token);
    if (!exp) return false;
    if (Date.now() > exp) {
        state.sessions.delete(token);
        return false;
    }
    return true;
}

function requireAdmin(req, res, next) {
    if (isAdminAuthenticated(req)) return next();
    return res.status(401).json({ error: 'No autorizado. Debes iniciar sesión en el panel docente.', adminRequired: true });
}

function registerAuthRoutes(app) {
    app.post('/api/admin/login', (req, res) => {
        const { password } = req.body || {};
        if (!ADMIN_PASS) {
            return res.status(500).json({ error: 'ADMIN_PASS no configurado en el entorno.' });
        }
        if (typeof password !== 'string' || !password) {
            return res.status(400).json({ error: 'Contraseña requerida.' });
        }
        const userBuf = Buffer.from(password, 'utf8');
        const passBuf = Buffer.from(ADMIN_PASS, 'utf8');
        const ok = userBuf.length === passBuf.length && crypto.timingSafeEqual(userBuf, passBuf);
        if (!ok) {
            return res.status(401).json({ error: 'Contraseña incorrecta.' });
        }
        const token = signSessionToken();
        state.sessions.set(token, Date.now() + SESSION_TTL_MS);
        res.setHeader('Set-Cookie', `aula_admin_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`);
        res.json({ success: true, mustChangePassword: isUsingDefaultPassword() });
    });

    app.post('/api/admin/logout', (req, res) => {
        const cookies = parseCookies(req);
        if (cookies.aula_admin_session) state.sessions.delete(cookies.aula_admin_session);
        res.setHeader('Set-Cookie', 'aula_admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
        res.json({ success: true });
    });

    app.get('/api/admin/check', (req, res) => {
        res.json({ authenticated: isAdminAuthenticated(req), mustChangePassword: isUsingDefaultPassword() });
    });

    app.get('/api/admin/info', (req, res) => {
        res.json({
            usingDefaultPassword: isUsingDefaultPassword(),
            defaultPassword: DEFAULT_ADMIN_PASS
        });
    });

    app.post('/api/admin/change-password', requireAdmin, (req, res) => {
        const { currentPassword, newPassword } = req.body || {};
        if (typeof currentPassword !== 'string' || !currentPassword) {
            return res.status(400).json({ error: 'Ingresá la contraseña actual.' });
        }
        if (typeof newPassword !== 'string' || !newPassword.trim()) {
            return res.status(400).json({ error: 'Ingresá la nueva contraseña.' });
        }
        const newPass = newPassword.trim();
        const curBuf = Buffer.from(currentPassword, 'utf8');
        const passBuf = Buffer.from(ADMIN_PASS, 'utf8');
        const ok = curBuf.length === passBuf.length && crypto.timingSafeEqual(curBuf, passBuf);
        if (!ok) {
            return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
        }
        if (newPass === ADMIN_PASS) {
            return res.status(400).json({ error: 'La nueva contraseña debe ser distinta de la actual.' });
        }
        const previous = ADMIN_PASS;
        ADMIN_PASS = newPass;
        const saved = saveAdminPassword();
        if (!saved) {
            ADMIN_PASS = previous;
            return res.status(500).json({ error: 'No se pudo guardar la contraseña. Revisá los permisos de escritura.' });
        }
        res.json({ success: true });
    });
}

module.exports = { requireAdmin, isAdminAuthenticated, isUsingDefaultPassword, registerAuthRoutes };
