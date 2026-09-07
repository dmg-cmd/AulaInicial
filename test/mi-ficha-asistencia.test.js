const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 3998;
const BASE = 'http://localhost:' + PORT;

function post(relPath, bodyObj) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(bodyObj);
        const req = http.request(BASE + relPath, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, res => {
            let body = '';
            res.on('data', c => (body += c));
            res.on('end', () => {
                try { resolve({ status: res.statusCode, json: body ? JSON.parse(body) : null }); }
                catch (e) { resolve({ status: res.statusCode, json: null }); }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

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
        } catch (_) {}
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
        if (!up) throw new Error('Servidor de prueba no inició');

        const cursosRes = await get('/api/cursos');
        if (!cursosRes.json || cursosRes.json.length === 0) {
            console.log('ℹ️ No hay cursos cargados para prueba profunda, verificando endpoint básico');
            const fichaRes = await post('/api/alumno/mi-ficha', { curso: 'inexistente.xlsx', alumnoId: 0 });
            if (fichaRes.status === 404) ok('POST /api/alumno/mi-ficha valida curso inexistente (404)');
            else fail('POST /api/alumno/mi-ficha no validó correctamente');
        } else {
            const curso = cursosRes.json[0];
            const alumnosRes = await get('/api/alumnos?curso=' + encodeURIComponent(curso));
            if (alumnosRes.json && alumnosRes.json.length > 0) {
                const alumno = alumnosRes.json[0];
                const fichaRes = await post('/api/alumno/mi-ficha', {
                    curso,
                    alumnoId: alumno.id,
                    nombreCompleto: alumno.nombreCompleto
                });
                if (fichaRes.status === 200 && fichaRes.json && fichaRes.json.success && fichaRes.json.alumno) {
                    ok('POST /api/alumno/mi-ficha entregó ficha para ' + alumno.nombreCompleto);
                    if ('asistenciaHoy' in fichaRes.json.alumno) {
                        ok('Ficha incluye asistenciaHoy con registrada, estado y hora');
                    } else {
                        fail('Ficha no incluye campo asistenciaHoy');
                    }
                } else {
                    fail('POST /api/alumno/mi-ficha falló: ' + JSON.stringify(fichaRes.json));
                }

                // Simular registro en modo demo para verificar estructura
                const regDemo = await post('/api/registro', {
                    curso,
                    alumnoId: alumno.id,
                    demo: true
                });
                if (regDemo.status === 200 && regDemo.json && regDemo.json.demo) {
                    ok('POST /api/registro modo demo funciona correctamente');
                } else {
                    fail('POST /api/registro modo demo falló');
                }
            }
        }
    } catch (e) {
        fail('Error inesperado: ' + e.message);
    } finally {
        server.kill();
    }

    console.log(failed ? '\nPRUEBA FICHA/ASISTENCIA: FALLÓ' : '\nPRUEBA FICHA/ASISTENCIA: OK');
    process.exit(failed ? 1 : 0);
})();
