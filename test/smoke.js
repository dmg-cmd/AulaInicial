// Smoke test mínimo de AulaInicial.
// Arranca el server en un puerto aislado y verifica endpoints de lectura críticos.
// No modifica cursos/registros reales.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = process.env.TEST_PORT || 3999;
const BASE = `http://localhost:${PORT}`;

function get(relPath) {
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForServer(tries = 40) {
    for (let i = 0; i < tries; i++) {
        try {
            const r = await get('/api/cursos');
            if (r.status === 200) return true;
        } catch (_) { /* aún no */ }
        await sleep(250);
    }
    return false;
}

(async () => {
    const server = spawn('node', [path.join(__dirname, '..', 'server.js')], {
        env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test' },
        stdio: 'ignore'
    });

    let failed = false;
    const fail = msg => { failed = true; console.error('❌ ' + msg); };
    const ok = msg => console.log('✅ ' + msg);

    try {
        const up = await waitForServer();
        if (!up) { fail('El servidor no arrancó en el puerto ' + PORT); throw new Error('no-up'); }

        const cursos = await get('/api/cursos');
        if (cursos.status === 200 && Array.isArray(cursos.json)) ok('GET /api/cursos responde lista');
        else fail('GET /api/cursos no respondió correctamente');

        const fechas = await get('/api/fechas-disponibles');
        if (fechas.status === 200 && Array.isArray(fechas.json) && fechas.json.some(f => f.id === 'TODAS')) ok('GET /api/fechas-disponibles incluye TODAS');
        else fail('GET /api/fechas-disponibles malformado');

        const active = await get('/api/active-course');
        if (active.status === 200 && 'activeCourse' in active.json) ok('GET /api/active-course responde');
        else fail('GET /api/active-course malformado');

        const pkg = require('../package.json');
        const versionRes = await get('/api/version');
        if (versionRes.status === 200 && versionRes.json && versionRes.json.version === pkg.version) ok(`GET /api/version responde ${pkg.version}`);
        else fail('GET /api/version no respondió versión esperada: ' + JSON.stringify(versionRes.json));

        const serverInfoRes = await get('/api/server-info');
        if (serverInfoRes.status === 200 && serverInfoRes.json && serverInfoRes.json.version === pkg.version) ok(`GET /api/server-info incluye version ${pkg.version}`);
        else fail('GET /api/server-info no incluye versión: ' + JSON.stringify(serverInfoRes.json));

        // CORS: un origen no permitido NO debe reflejarse como habilitado
        await new Promise((resolve) => {
            const req = http.request(BASE + '/api/active-course', { headers: { Origin: 'http://origen-malicioso.test' } }, res => {
                const allow = res.headers['access-control-allow-origin'];
                if (!allow || allow !== 'http://origen-malicioso.test') ok('CORS no refleja origen ajeno');
                else fail('CORS refleja un origen no permitido: ' + allow);
                res.resume(); res.on('end', resolve);
            });
            req.on('error', () => { ok('CORS: servidor no accesible desde origen ajeno (rechazado)'); resolve(); });
            req.end();
        });

        // Verificación de /api/stats con campos personalizados de formulario
        await new Promise((resolve) => {
            const fs = require('fs');
            const passFile = path.join(__dirname, '..', '.adminpass');
            const adminPass = (fs.existsSync(passFile) ? fs.readFileSync(passFile, 'utf8').trim() : (process.env.ADMIN_PASS || 'admin123')) || 'admin123';
            const postData = JSON.stringify({ password: adminPass });
            const loginReq = http.request(BASE + '/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            }, res => {
                const cookie = res.headers['set-cookie'];
                let sessionCookie = '';
                if (cookie && Array.isArray(cookie)) {
                    const match = cookie.find(c => c.startsWith('aula_admin_session='));
                    if (match) sessionCookie = match.split(';')[0];
                }
                res.resume();
                res.on('end', () => {
                    if (sessionCookie) {
                        http.get(BASE + '/api/stats', {
                            headers: { Cookie: sessionCookie }
                        }, statsRes => {
                            let sBody = '';
                            statsRes.on('data', c => (sBody += c));
                            statsRes.on('end', () => {
                                try {
                                    const json = JSON.parse(sBody);
                                    if (statsRes.statusCode === 200 && Array.isArray(json.availableFields)) {
                                        const hasCustom = json.availableFields.some(f => f.id.startsWith('custom_') || f.label.includes('tarea'));
                                        const customField = json.availableFields.find(f => f.id.startsWith('custom_'));
                                        if (hasCustom && customField) {
                                            ok('GET /api/stats responde 200 e incluye campos personalizados (customFields)');
                                            http.get(BASE + `/api/stats?campo=${encodeURIComponent(customField.id)}`, {
                                                headers: { Cookie: sessionCookie }
                                            }, customStatsRes => {
                                                let csBody = '';
                                                customStatsRes.on('data', c => (csBody += c));
                                                customStatsRes.on('end', () => {
                                                    try {
                                                        const csJson = JSON.parse(csBody);
                                                        if (customStatsRes.statusCode === 200 && Array.isArray(csJson.data)) {
                                                            ok(`GET /api/stats?campo=${customField.id} procesa y responde estadísticas correctamente`);
                                                        } else {
                                                            fail('GET /api/stats con campo personalizado falló');
                                                        }
                                                    } catch (e) {
                                                        fail('Error al parsear estadísticas de campo personalizado: ' + e.message);
                                                    }
                                                    resolve();
                                                });
                                            }).on('error', e => { fail('Llamada a stats con customField falló: ' + e.message); resolve(); });
                                            return;
                                        } else if (!hasCustom) {
                                            fail('GET /api/stats no incluye campos personalizados');
                                        }
                                    } else {
                                        fail(`GET /api/stats falló (status ${statsRes.statusCode})`);
                                    }
                                } catch (err) {
                                    fail('GET /api/stats respuesta JSON inválida: ' + err.message);
                                }
                                resolve();
                            });
                        }).on('error', e => { fail('GET /api/stats falló: ' + e.message); resolve(); });
                    } else {
                        fail('No se pudo autenticar para probar /api/stats');
                        resolve();
                    }
                });
            });
            loginReq.on('error', e => { fail('Login admin falló: ' + e.message); resolve(); });
            loginReq.write(postData);
            loginReq.end();
        });
    } catch (e) {
        if (e.message !== 'no-up') { fail('Error inesperado: ' + e.message); }
    } finally {
        server.kill();
    }

    console.log(failed ? '\nRESULTADO: FALLÓ' : '\nRESULTADO: OK');
    process.exit(failed ? 1 : 0);
})();
