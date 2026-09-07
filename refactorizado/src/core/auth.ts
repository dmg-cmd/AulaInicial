import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { PATHS } from '../config/index.js';
import { ENV } from '../config/env.js';
import { stateManager } from './StateManager.js';
import { SESION, MENSAJES, CFG_TARDANZA_DEFAULTS } from '../config/constants.js';

const DEFAULT_ADMIN_PASS = 'admin123';

function loadAdminPassword(): string {
  try {
    if (existsSync(PATHS.ADMIN_PASS_PATH)) {
      const stored = readFileSync(PATHS.ADMIN_PASS_PATH, 'utf8').trim();
      if (stored) return stored;
    }
    return process.env.ADMIN_PASS || DEFAULT_ADMIN_PASS;
  } catch {
    return process.env.ADMIN_PASS || DEFAULT_ADMIN_PASS;
  }
}

let ADMIN_PASS = loadAdminPassword();

function isUsingDefaultPassword(): boolean {
  return ADMIN_PASS === DEFAULT_ADMIN_PASS;
}

function saveAdminPassword(): boolean {
  try {
    writeFileSync(PATHS.ADMIN_PASS_PATH, ADMIN_PASS, { encoding: 'utf8', mode: 0o600 });
    return true;
  } catch (err) {
    console.error('No se pudo persistir la contraseña en .adminpass:', err);
    return false;
  }
}

function signSessionToken(): string {
  return randomBytes(32).toString('hex');
}

function parseCookies(req: { headers: { cookie?: string } }): Record<string, string> {
  const header = req.headers.cookie || '';
  const out: Record<string, string> = {};
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

export function isAdminAuthenticated(req: { headers: { cookie?: string } }): boolean {
  const cookies = parseCookies(req);
  const token = cookies[SESION.COOKIE_NAME];
  if (!token) return false;
  return stateManager.validateSession(token);
}

export function requireAdmin(
  req: { headers: { cookie?: string } },
  res: { status: (code: number) => { json: (body: object) => void } },
  next: () => void
): void {
  if (isAdminAuthenticated(req)) return next();
  res.status(401).json({ error: MENSAJES.NO_AUTORIZADO, adminRequired: true });
}

function verifyPassword(input: string, stored: string): boolean {
  const inputBuf = Buffer.from(input, 'utf8');
  const storedBuf = Buffer.from(stored, 'utf8');
  return inputBuf.length === storedBuf.length && timingSafeEqual(inputBuf, storedBuf);
}

export function registerAuthRoutes(app: {
  post: (path: string, handler: (req: any, res: any) => void) => void;
  get: (path: string, handler: (req: any, res: any) => void) => void;
}): void {
  app.post('/api/admin/login', (req, res) => {
    const { password } = req.body || {};
    if (!ADMIN_PASS) {
      return res.status(500).json({ error: 'ADMIN_PASS no configurado en el entorno.' });
    }
    if (typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'Contraseña requerida.' });
    }
    if (!verifyPassword(password, ADMIN_PASS)) {
      return res.status(401).json({ error: MENSAJES.CONTRASEÑA_INCORRECTA });
    }
    const token = signSessionToken();
    stateManager.createSession(token, SESION.TTL_MS);
    res.setHeader('Set-Cookie', `${SESION.COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESION.TTL_MS / 1000}`);
    res.json({ success: true, mustChangePassword: isUsingDefaultPassword() });
  });

  app.post('/api/admin/logout', (req, res) => {
    const cookies = parseCookies(req);
    if (cookies[SESION.COOKIE_NAME]) stateManager.deleteSession(cookies[SESION.COOKIE_NAME]);
    res.setHeader('Set-Cookie', `${SESION.COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
    res.json({ success: true });
  });

  app.get('/api/admin/check', (req, res) => {
    res.json({ authenticated: isAdminAuthenticated(req), mustChangePassword: isUsingDefaultPassword() });
  });

  app.get('/api/admin/session', (req, res) => {
    const authenticated = isAdminAuthenticated(req);
    res.json({ 
      authenticated, 
      usingDefaultPassword: isUsingDefaultPassword(),
      defaultPassword: authenticated && isUsingDefaultPassword() ? DEFAULT_ADMIN_PASS : undefined
    });
  });

  app.get('/api/admin/info', (req, res) => {
    res.json({
      usingDefaultPassword: isUsingDefaultPassword(),
      defaultPassword: DEFAULT_ADMIN_PASS
    });
  });

  app.post('/api/admin/change-password', (req, res) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: MENSAJES.NO_AUTORIZADO });
    }
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || !currentPassword) {
      return res.status(400).json({ error: 'Ingresá la contraseña actual.' });
    }
    if (typeof newPassword !== 'string' || !newPassword.trim()) {
      return res.status(400).json({ error: 'Ingresá la nueva contraseña.' });
    }
    const newPass = newPassword.trim();
    if (!verifyPassword(currentPassword, ADMIN_PASS)) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
    }
    if (newPass === ADMIN_PASS) {
      return res.status(400).json({ error: 'La nueva contraseña debe ser distinta de la actual.' });
    }
    const previous = ADMIN_PASS;
    ADMIN_PASS = newPass;
    if (!saveAdminPassword()) {
      ADMIN_PASS = previous;
      return res.status(500).json({ error: 'No se pudo guardar la contraseña. Revisá los permisos de escritura.' });
    }
    res.json({ success: true });
  });
}

export { isUsingDefaultPassword, DEFAULT_ADMIN_PASS };