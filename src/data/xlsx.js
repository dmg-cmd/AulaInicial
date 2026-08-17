const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const { CURSOS_DIR, REGISTROS_DIR, FOTOS_DIR } = require('../config/paths');

// ───────────────────────────────────────────────────────────────
// LOCK POR CURSO / CONCURRENCIA SOBRE EXCEL (A4)
// Encadena operaciones read-modify-write por archivo para evitar
// pérdida de datos cuando varios alumnos registran a la vez.
// ───────────────────────────────────────────────────────────────
const courseLocks = new Map(); // filePath -> Promise encadenada

function withCourseLock(filePath, fn) {
    const prev = courseLocks.get(filePath) || Promise.resolve();
    const next = prev.then(fn, fn);
    // Mantener la cadena viva aunque falle la operación
    courseLocks.set(filePath, next.catch(() => {}));
    return next;
}

function writeWorkbookSafely(workbook, filePath) {
    try {
        xlsx.writeFile(workbook, filePath);
        return null;
    } catch (writeErr) {
        if (writeErr.code === 'EBUSY' || (writeErr.message && (writeErr.message.includes('busy') || writeErr.message.includes('locked')))) {
            return { busy: true, error: 'El archivo Excel del curso está abierto en Microsoft Excel o en otro programa. Por favor ciérralo y vuelve a intentarlo.' };
        }
        return { busy: false, error: 'No se pudo guardar los cambios en la planilla Excel: ' + writeErr.message };
    }
}

// ───────────────────────────────────────────────────────────────
// RATE-LIMIT SUAVE (A7)
// ───────────────────────────────────────────────────────────────
const rateBuckets = new Map(); // "accion:ip" -> { count, resetAt }
const RATE_LIMIT_MAX = 12;
const RATE_LIMIT_WINDOW_MS = 20000;

function rateLimitExceeded(ip, action) {
    if (!ip) return false;
    const key = `${action}:${ip}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || now > bucket.resetAt) {
        rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return false;
    }
    bucket.count++;
    return bucket.count > RATE_LIMIT_MAX;
}

// ───────────────────────────────────────────────────────────────
// VALIDACIÓN DE FOTOS (A5)
// ───────────────────────────────────────────────────────────────
const MAX_FOTO_BYTES = 5 * 1024 * 1024; // 5 MB

function validateFotoBase64(base64Data) {
    if (!base64Data || typeof base64Data !== 'string') {
        return { valid: false, error: 'Datos de foto inválidos.' };
    }
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches) {
        return { valid: false, error: 'Formato de imagen no reconocido.' };
    }
    const mime = matches[1].toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
        return { valid: false, error: 'Solo se permiten imágenes JPEG, PNG o WebP.' };
    }
    const buffer = Buffer.from(matches[2], 'base64');
    if (buffer.length === 0) {
        return { valid: false, error: 'La imagen está vacía.' };
    }
    if (buffer.length > MAX_FOTO_BYTES) {
        return { valid: false, error: 'La imagen supera el tamaño máximo de 5 MB.' };
    }
    const magicOk =
        (mime === 'image/jpeg' && buffer.length > 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) ||
        (mime === 'image/png' && buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) ||
        (mime === 'image/webp' && buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP');
    if (!magicOk) {
        return { valid: false, error: 'El archivo no es una imagen real (firma de bytes no válida).' };
    }
    return { valid: true, buffer, error: null };
}

function getFotoFilename(studentName, dni) {
    const cleanName = (studentName || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    const cleanDni = (dni || '').toString().trim().replace(/[^a-z0-9]/g, '');
    return `foto_${cleanName}_${cleanDni || 'nodni'}.jpg`;
}

function getStudentFotoUrl(studentName, dni) {
    const filename = getFotoFilename(studentName, dni);
    const fullPath = path.join(FOTOS_DIR, filename);
    if (fs.existsSync(fullPath)) {
        return `/registros/fotos/${filename}?v=${fs.statSync(fullPath).mtimeMs}`;
    }
    return null;
}

function findFotoForStudent(studentName, dni) {
    const exact = getStudentFotoUrl(studentName, dni);
    if (exact) return exact;
    try {
        if (!fs.existsSync(FOTOS_DIR)) return null;
        const dniClean = (dni || '').toString().trim().replace(/[^a-z0-9]/g, '');
        const nameSlug = (studentName || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
        const matches = fs.readdirSync(FOTOS_DIR).filter(f => /^foto_.+\.jpg$/i.test(f));
        if (dniClean) {
            const byDni = matches.find(f => f.toLowerCase().includes(`_${dniClean}.jpg`));
            if (byDni) {
                const full = path.join(FOTOS_DIR, byDni);
                return `/registros/fotos/${byDni}?v=${fs.statSync(full).mtimeMs}`;
            }
        }
        if (nameSlug) {
            const byName = matches.find(f => f.toLowerCase().includes(nameSlug));
            if (byName) {
                const full = path.join(FOTOS_DIR, byName);
                return `/registros/fotos/${byName}?v=${fs.statSync(full).mtimeMs}`;
            }
        }
    } catch (e) {
        console.error('Error al buscar foto por fallback:', e);
    }
    return null;
}

function saveStudentFoto(studentName, dni, base64Data) {
    const validation = validateFotoBase64(base64Data);
    if (!validation.valid) {
        console.error(`📵 Foto rechazada para [${studentName}]: ${validation.error}`);
        return false;
    }
    try {
        const filename = getFotoFilename(studentName, dni);
        const fullPath = path.join(FOTOS_DIR, filename);
        fs.writeFileSync(fullPath, validation.buffer);
        console.log(`📸 Foto real guardada para [${studentName}] en ${filename}`);
        return true;
    } catch (err) {
        console.error('Error al guardar foto del alumno:', err);
        return false;
    }
}

function deleteStudentFoto(studentName, dni) {
    const filename = getFotoFilename(studentName, dni);
    const fullPath = path.join(FOTOS_DIR, filename);
    let targetPath = fullPath;
    if (!fs.existsSync(targetPath)) {
        try {
            if (fs.existsSync(FOTOS_DIR)) {
                const dniClean = (dni || '').toString().trim().replace(/[^a-z0-9]/g, '');
                const nameSlug = (studentName || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
                const matches = fs.readdirSync(FOTOS_DIR).filter(f => /^foto_.+\.jpg$/i.test(f));
                const byDni = dniClean ? matches.find(f => f.toLowerCase().includes(`_${dniClean}.jpg`)) : null;
                const byName = !byDni && nameSlug ? matches.find(f => f.toLowerCase().includes(nameSlug)) : null;
                if (byDni || byName) targetPath = path.join(FOTOS_DIR, byDni || byName);
            }
        } catch (err) {
            console.error('Error al buscar foto para eliminar:', err);
        }
    }
    if (fs.existsSync(targetPath)) {
        try {
            fs.unlinkSync(targetPath);
            console.log(`🗑️ Foto eliminada para [${studentName}]`);
            return true;
        } catch (err) {
            console.error('Error al eliminar foto:', err);
        }
    }
    return false;
}

function findActualFileInCursos(curso) {
    if (!curso) return null;
    const safeName = path.basename(curso).trim().toLowerCase();
    if (!fs.existsSync(CURSOS_DIR)) return null;
    try {
        const files = fs.readdirSync(CURSOS_DIR);
        for (const f of files) {
            if (f.trim().toLowerCase() === safeName) {
                return path.join(CURSOS_DIR, f);
            }
        }
    } catch (e) {
        console.error('Error al buscar archivo en cursos:', e);
    }
    return null;
}

// Función para obtener la ruta del archivo de trabajo en registros/, inicializándolo desde cursos/ si no existe aún
function getOrInitWorkingWorkbook(curso) {
    if (!curso) return null;
    const safeCurso = path.basename(curso).trim();
    if (!fs.existsSync(REGISTROS_DIR)) {
        fs.mkdirSync(REGISTROS_DIR, { recursive: true });
    }
    try {
        const registroFiles = fs.readdirSync(REGISTROS_DIR);
        const matchRegistro = registroFiles.find(f => f.trim().toLowerCase() === safeCurso.toLowerCase());
        if (matchRegistro) {
            return path.join(REGISTROS_DIR, matchRegistro);
        }
    } catch (err) {
        console.error('Error al leer registros/:', err);
    }
    const cursoOriginalPath = findActualFileInCursos(safeCurso);
    if (cursoOriginalPath && fs.existsSync(cursoOriginalPath)) {
        try {
            const destName = path.basename(cursoOriginalPath);
            const destPath = path.join(REGISTROS_DIR, destName);
            fs.copyFileSync(cursoOriginalPath, destPath);
            console.log(`📁 Nuevo archivo operativo inicializado en registros/ para [${destName}]`);
            return destPath;
        } catch (err) {
            console.error(`Error al inicializar registro para [${safeCurso}]:`, err);
        }
    }
    return null;
}

function normalizeSheetDate(raw) {
    if (!raw) return '';
    const s = raw.toString().trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); // YYYY-MM-DD
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/); // DD-MM-YYYY
    if (m) return s;
    return s.replace(/[\/\\]/g, '-');
}

function isFullyRegistered(row) {
    return !!(row && row['Fecha Registro']);
}

function todaySheetName() {
    const hoy = new Date();
    return `${hoy.getDate().toString().padStart(2, '0')}-${(hoy.getMonth() + 1).toString().padStart(2, '0')}-${hoy.getFullYear()}`;
}

function obtenerNombreAlumno(row) {
    if (!row || typeof row !== 'object') return '';
    const full =
        row['Full Name'] || row['Full name'] || row['Name'] || row['Nombre y Apellido'] ||
        row['Alumno'] || row['Display name'] || row['User Name'] || '';
    if (full) return full.trim();
    const first = row['First name'] || row['First Name'] || row['Nombre'] || '';
    const last = row['Last name'] || row['Last Name'] || row['Apellido'] || '';
    return `${first} ${last}`.trim();
}

function parseSheetDate(sName) {
    const m = (sName || '').toString().match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!m) return null;
    return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
}

// Re-consolida los totales de presentismo en la Hoja 1 a partir de las pestañas de fecha
function consolidarPresentismo(workbook, mainData) {
    const dateSheets = workbook.SheetNames.filter(s => parseSheetDate(s) !== null);
    const totalClases = dateSheets.length;
    const asistenciaAcumulada = {};

    dateSheets.forEach(sName => {
        const sData = xlsx.utils.sheet_to_json(workbook.Sheets[sName]);
        sData.forEach(r => {
            const nombreItem = (r['Alumno'] || r['Nombre'] || '').toString().trim().toLowerCase();
            if (!nombreItem) return;
            if (!asistenciaAcumulada[nombreItem]) {
                asistenciaAcumulada[nombreItem] = { presentes: 0, ausentes: 0, tardes: 0 };
            }
            const st = (r['Asistencia'] || r['Estado'] || '').toString().trim().toUpperCase();
            if (st.includes('PRESENTE')) {
                asistenciaAcumulada[nombreItem].presentes++;
            } else if (st.includes('TARDE')) {
                asistenciaAcumulada[nombreItem].tardes++;
            } else {
                asistenciaAcumulada[nombreItem].ausentes++;
            }
        });
    });

    mainData.forEach(row => {
        if (row['Borrado'] === 'SI') return;
        const key = obtenerNombreAlumno(row).toLowerCase();
        const stats = asistenciaAcumulada[key] || { presentes: 0, ausentes: 0, tardes: 0 };
        row['Total Clases'] = totalClases;
        row['Presentes'] = stats.presentes;
        row['Ausentes'] = stats.ausentes;
        row['Tardes'] = stats.tardes;
        row['% Presentismo'] = totalClases > 0 ? parseFloat(((stats.presentes / totalClases) * 100).toFixed(1)) : 0;
    });

    return totalClases;
}

// Asegura que todo alumno ACTIVO de la Hoja 1 tenga una fila en cada hoja de fecha
function reconciliarAusentes(workbook, mainData, soloDesdeHoy) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    workbook.SheetNames.forEach((sName) => {
        if (parseSheetDate(sName) === null) return;
        if (soloDesdeHoy) {
            const d = parseSheetDate(sName);
            if (!d || d < hoy) return;
        }
        const sData = xlsx.utils.sheet_to_json(workbook.Sheets[sName]);
        const nombresEnHoja = new Set(
            sData.map(r => (r['Alumno'] || r['Nombre'] || '').toString().trim().toLowerCase()).filter(Boolean)
        );
        let modificado = false;
        mainData.forEach(row => {
            if (row['Borrado'] === 'SI') return;
            const nombre = obtenerNombreAlumno(row);
            if (!nombre) return;
            if (!nombresEnHoja.has(nombre.toLowerCase())) {
                sData.push({
                    'DNI': row['DNI'] || 'SIN DNI',
                    'Alumno': nombre,
                    'Asistencia': 'AUSENTES',
                    'Grupo': (row['Grupo'] || 'SIN GRUPO').toString().toUpperCase().trim(),
                    'Hora Registro': '-'
                });
                modificado = true;
            }
        });
        if (modificado) {
            workbook.Sheets[sName] = xlsx.utils.json_to_sheet(sData);
        }
    });
}

module.exports = {
    xlsx,
    withCourseLock,
    writeWorkbookSafely,
    rateLimitExceeded,
    validateFotoBase64,
    getFotoFilename,
    getStudentFotoUrl,
    findFotoForStudent,
    saveStudentFoto,
    deleteStudentFoto,
    findActualFileInCursos,
    getOrInitWorkingWorkbook,
    normalizeSheetDate,
    isFullyRegistered,
    todaySheetName,
    obtenerNombreAlumno,
    parseSheetDate,
    consolidarPresentismo,
    reconciliarAusentes
};
