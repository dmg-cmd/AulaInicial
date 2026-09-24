const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

const PORT = 3998;
const BASE = `http://localhost:${PORT}`;

// Directorio temporal aislado para pruebas
const TMP_TEST_DIR = path.join(__dirname, '..', '.tmp_test_guardar');
const TMP_CURSOS = path.join(TMP_TEST_DIR, 'cursos');
const TMP_REGISTROS = path.join(TMP_TEST_DIR, 'registros');

function crearCursoMock() {
    if (fs.existsSync(TMP_TEST_DIR)) {
        fs.rmSync(TMP_TEST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TMP_CURSOS, { recursive: true });
    fs.mkdirSync(TMP_REGISTROS, { recursive: true });

    // Planilla mock con dos alumnos ficticios
    const mockData = [
        {
            'Last name': 'Pérez',
            'First name': 'Juan',
            'Email address': 'juan.perez@test.edu.ar'
        },
        {
            'Last name': 'Gómez',
            'First name': 'María',
            'Email address': 'maria.gomez@test.edu.ar'
        }
    ];
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(mockData);
    xlsx.utils.book_append_sheet(wb, ws, 'Digital Activity');
    xlsx.writeFile(wb, path.join(TMP_CURSOS, 'Curso_Mock_Test.xlsx'));
}

function limpiarEntornoTest() {
    try {
        if (fs.existsSync(TMP_TEST_DIR)) {
            fs.rmSync(TMP_TEST_DIR, { recursive: true, force: true });
        }
    } catch (_) {}
}

function request(method, relPath, data = null) {
    return new Promise((resolve, reject) => {
        const u = new URL(BASE + relPath);
        const postBody = data ? JSON.stringify(data) : null;
        const req = http.request({
            hostname: u.hostname,
            port: u.port,
            path: u.pathname + u.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(postBody ? { 'Content-Length': Buffer.byteLength(postBody) } : {})
            }
        }, res => {
            let body = '';
            res.on('data', c => (body += c));
            res.on('end', () => {
                try { resolve({ status: res.statusCode, json: body ? JSON.parse(body) : null }); }
                catch (e) { resolve({ status: res.statusCode, json: body }); }
            });
        });
        req.on('error', reject);
        if (postBody) req.write(postBody);
        req.end();
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForServer(tries = 40) {
    for (let i = 0; i < tries; i++) {
        try {
            const r = await request('GET', '/api/cursos');
            if (r.status === 200) return true;
        } catch (_) {}
        await sleep(250);
    }
    return false;
}

(async () => {
    crearCursoMock();

    const server = spawn('node', [path.join(__dirname, '..', 'server.js')], {
        env: {
            ...process.env,
            PORT: String(PORT),
            NODE_ENV: 'test',
            TEST_CURSOS_DIR: TMP_CURSOS,
            TEST_REGISTROS_DIR: TMP_REGISTROS
        },
        stdio: 'ignore'
    });

    let failed = false;
    const fail = msg => { failed = true; console.error('❌ ' + msg); };
    const ok = msg => console.log('✅ ' + msg);

    try {
        const up = await waitForServer();
        if (!up) throw new Error('El servidor no arrancó');

        // 1. Verificar /api/check-registration
        const checkRes = await request('GET', '/api/check-registration');
        if (checkRes.status === 200 && typeof checkRes.json.registered === 'boolean') {
            ok('GET /api/check-registration responde correctamente sin excepción');
        } else {
            fail('GET /api/check-registration falló: ' + JSON.stringify(checkRes.json));
        }

        // 2. Obtener lista de alumnos del curso mock
        const alumnosRes = await request('GET', '/api/alumnos');
        if (alumnosRes.status === 200 && Array.isArray(alumnosRes.json) && alumnosRes.json.length > 0) {
            const alumno = alumnosRes.json[0];
            const activeRes = await request('GET', '/api/active-course');
            const curso = activeRes.json.activeCourse;

            // 3. Ejecutar POST /api/registro sobre el curso mock
            const regRes = await request('POST', '/api/registro', {
                curso,
                alumnoId: alumno.id,
                email: 'test_student@example.com',
                dni: '12345678',
                titulo: 'Docente',
                tecnologia: 'ALTA',
                grupo: 'GRUPO 1',
                telefono: '1122334455',
                demo: false
            });

            if (regRes.status === 200 && regRes.json && regRes.json.success) {
                ok('POST /api/registro mock ejecutado con éxito sin error de Excel o add()');
            } else {
                fail('POST /api/registro mock falló con error: ' + JSON.stringify(regRes.json));
            }

            // 4. Verificar que check-registration reconozca la IP registrada
            const checkAfter = await request('GET', '/api/check-registration');
            if (checkAfter.status === 200 && checkAfter.json.registered === true) {
                ok('GET /api/check-registration confirma registeredIPs.has() == true');
            } else {
                fail('registeredIPs no registró la IP: ' + JSON.stringify(checkAfter.json));
            }
        } else {
            fail('No se obtuvieron alumnos mock para la prueba');
        }
    } catch (e) {
        fail('Error inesperado en prueba: ' + e.message);
    } finally {
        server.kill();
        limpiarEntornoTest();
    }

    console.log(failed ? '\nPRUEBA REGISTRO REAL (AISLADA): FALLÓ' : '\nPRUEBA REGISTRO REAL (AISLADA): OK');
    process.exit(failed ? 1 : 0);
})();
