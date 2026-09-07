import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;

let serverProcess: ChildProcess;

function get(relPath: string): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    http.get(BASE + relPath, res => {
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: body ? JSON.parse(body) : null }); }
        catch (e) { resolve({ status: res.statusCode, json: null }); }
      });
    }).on('error', reject);
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function waitForServer(tries = 40): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await get('/api/cursos');
      if (r.status === 200) return true;
    } catch { /* still starting */ }
    await sleep(250);
  }
  return false;
}

describe('Smoke tests', () => {
  beforeAll(async () => {
    serverProcess = spawn('npm', ['run', 'dev'], {
      cwd: join(__dirname, '..'),
      env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test' },
      stdio: 'ignore'
    });

    const up = await waitForServer();
    if (!up) {
      serverProcess.kill();
      throw new Error('El servidor no arrancó en el puerto ' + PORT);
    }
  }, 30000);

  afterAll(() => {
    serverProcess.kill();
  });

  it('GET /api/cursos responde lista', async () => {
    const r = await get('/api/cursos');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.json)).toBe(true);
  });

  it('GET /api/fechas-disponibles incluye TODAS', async () => {
    const r = await get('/api/fechas-disponibles');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.json)).toBe(true);
    expect(r.json.some((f: any) => f.id === 'TODAS')).toBe(true);
  });

  it('GET /api/active-course responde', async () => {
    const r = await get('/api/active-course');
    expect(r.status).toBe(200);
    expect(r.json).toHaveProperty('activeCourse');
  });

  it('CORS no refleja origen ajeno', async () => {
    await new Promise<void>((resolve) => {
      const req = http.request(BASE + '/api/active-course', { headers: { Origin: 'http://origen-malicioso.test' } }, res => {
        const allow = res.headers['access-control-allow-origin'];
        if (!allow || allow !== 'http://origen-malicioso.test') {
          // OK
        } else {
          throw new Error('CORS refleja un origen no permitido: ' + allow);
        }
        res.resume(); res.on('end', resolve);
      });
      req.on('error', () => resolve()); // rejected by server
      req.end();
    });
  });
});