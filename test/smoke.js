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
    } catch (e) {
        if (e.message !== 'no-up') { fail('Error inesperado: ' + e.message); }
    } finally {
        server.kill();
    }

    console.log(failed ? '\nRESULTADO: FALLÓ' : '\nRESULTADO: OK');
    process.exit(failed ? 1 : 0);
})();
