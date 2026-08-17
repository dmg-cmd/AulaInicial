const fs = require('fs');
const path = require('path');
const { xlsx, getOrInitWorkingWorkbook, obtenerNombreAlumno, withCourseLock,
    writeWorkbookSafely, consolidarPresentismo, saveStudentFoto, findFotoForStudent, deleteStudentFoto } = require('../data/xlsx');
const { getActiveCourse } = require('../data/courses');
const { requireAdmin } = require('../core/auth');
const { state, registeredIPs } = require('../core/state');
const { generateStudentToken, verifyStudentToken } = require('../core/tokens');
const { normalizeClientIP, rateLimitExceeded, validateFotoBase64, isFullyRegistered } = require('../utils/validation');
const { leerCfgTardanza, leerHoraTomaLista, horaAminutos, evaluarTarde } = require('../features/late');


// Localiza la fila del alumno a partir del token verificado.
function obtenerFilaPorToken(data, verified) {
    if (verified && verified.studentId !== null && Number.isInteger(verified.studentId) && data[verified.studentId] !== undefined) {
        const candidate = data[verified.studentId];
        if (obtenerNombreAlumno(candidate).toLowerCase() === verified.studentName) {
            return { index: verified.studentId, row: candidate };
        }
    }
    const index = data.findIndex(row => obtenerNombreAlumno(row).toLowerCase() === verified.studentName);
    if (index !== -1) return { index, row: data[index] };
    return { index: -1, row: null };
}

function dentroDeHoraLimite(horaStr) {
    const m = (horaStr || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return true;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const limitMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    return nowMin <= limitMin;
}

function registerRegistrationRoutes(app) {

    app.post('/api/registro', (req, res) => {
        const { alumnoId, email, titulo, telefono, dni, curso: clientCurso, demo, customValues } = req.body;
        const curso = clientCurso || getActiveCourse();
        const clientIP = normalizeClientIP(req.ip || req.connection.remoteAddress);

        if (!curso) return res.status(400).json({ error: 'No hay un curso activo.' });

        const safeCurso = path.basename(curso);
        const filePath = getOrInitWorkingWorkbook(curso);

        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'El archivo del curso no existe.' });
        }

        if (demo) {
            console.log(`📡 MODO DEMO: Se procesó un registro ficticio en [${safeCurso}]`);
            return res.json({ success: true, demo: true });
        }

        if (!Number.isInteger(alumnoId) || alumnoId < 0) {
            return res.status(400).json({ error: 'Índice de alumno inválido.' });
        }
        if (typeof email === 'string' && email.length > 254) {
            return res.status(400).json({ error: 'El email es demasiado largo.' });
        }
        if (typeof dni === 'string' && dni.length > 64) {
            return res.status(400).json({ error: 'El DNI/ID es demasiado largo.' });
        }
        if (req.body.fotoData) {
            const fotoValidation = validateFotoBase64(req.body.fotoData);
            if (!fotoValidation.valid) return res.status(400).json({ error: fotoValidation.error });
        }
        if (rateLimitExceeded(clientIP, 'registro')) {
            return res.status(429).json({ error: 'Demasiadas solicitudes de registro. Espera unos segundos e inténtalo de nuevo.' });
        }

        withCourseLock(filePath, () => {
            try {
                const workbook = xlsx.readFile(filePath);
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const data = xlsx.utils.sheet_to_json(sheet);

                if (data[alumnoId] === undefined || typeof data[alumnoId] !== 'object') {
                    // alumnoId suele ser índice 0-based del array; el frontend cuenta desde 1 (fila A7=índice6) -> ajuste
                    return res.status(400).json({ error: 'Alumno no encontrado en el índice del curso.' });
                }
                const alumno = data[alumnoId];

                if (registeredIPs.has(clientIP) && isFullyRegistered(alumno)) {
                    return res.status(403).json({ error: 'Este dispositivo ya ha realizado un registro en esta sesión.' });
                }

                if (state.formConfig.standardFields.email?.enabled !== false) alumno['Email Privado'] = email || '';
                if (state.formConfig.standardFields.titulo?.enabled !== false) alumno['Título'] = titulo || '';
                if (state.formConfig.standardFields.tecnologia?.enabled !== false) alumno['Tecnología'] = req.body.tecnologia || 'NO ESPECIFICADO';
                if (state.formConfig.standardFields.telefono?.enabled !== false) alumno['Teléfono'] = telefono || '';
                if (state.formConfig.standardFields.dni?.enabled !== false) alumno['DNI'] = dni || '';
                if (state.formConfig.standardFields.grupo?.enabled !== false) alumno['Grupo'] = req.body.grupo || '';
                alumno['Fecha Registro'] = new Date().toLocaleString('es-AR');

                if (customValues && typeof customValues === 'object') {
                    state.formConfig.customFields.forEach(field => {
                        if (field.enabled !== false && customValues[field.id] !== undefined) {
                            const keyName = field.label || field.name;
                            alumno[keyName] = customValues[field.id];
                        }
                    });
                }

                const alumnoName = obtenerNombreAlumno(alumno);
                if (req.body.fotoData) saveStudentFoto(alumnoName, dni || alumno['DNI'], req.body.fotoData);
                console.log(`✅ Registro actualizado: ${alumnoName} en [${safeCurso}]`);

                const hoy = new Date();
                const dateSheetName = `${hoy.getDate().toString().padStart(2, '0')}-${(hoy.getMonth() + 1).toString().padStart(2, '0')}-${hoy.getFullYear()}`;
                const horaActual = hoy.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

                let dateData = [];
                if (workbook.SheetNames.includes(dateSheetName)) {
                    dateData = xlsx.utils.sheet_to_json(workbook.Sheets[dateSheetName]);
                }
                const idxInDate = dateData.findIndex(r => (r['Alumno'] || r['Nombre'] || '').toString().trim().toLowerCase() === alumnoName.toLowerCase());
                const filaFechaObj = {
                    'DNI': dni || alumno['DNI'] || 'SIN DNI',
                    'Alumno': alumnoName,
                    'Asistencia': 'PRESENTES',
                    'Grupo': (alumno['Grupo'] || req.body.grupo || 'SIN GRUPO').toString().toUpperCase().trim(),
                    'Hora Registro': horaActual
                };
                if (idxInDate >= 0) dateData[idxInDate] = filaFechaObj;
                else dateData.push(filaFechaObj);
                const dateSheet = xlsx.utils.json_to_sheet(dateData);
                if (workbook.SheetNames.includes(dateSheetName)) workbook.Sheets[dateSheetName] = dateSheet;
                else xlsx.utils.book_append_sheet(workbook, dateSheet, dateSheetName);

                consolidarPresentismo(workbook, data);
                workbook.Sheets[sheetName] = xlsx.utils.json_to_sheet(data);

                const writeErr = writeWorkbookSafely(workbook, filePath);
                if (writeErr) return res.status(500).json({ error: writeErr.error });

                registeredIPs.add(clientIP);
                const token = generateStudentToken(alumnoName, alumnoId);
                const fotoUrl = findFotoForStudent(alumnoName, dni || alumno['DNI']);
                res.json({ success: true, token, fotoUrl });
            } catch (error) {
                console.error('Error al guardar en Excel:', error);
                res.status(500).json({ error: 'Error interno al guardar los datos en el Excel.' });
            }
        }).catch(() => {
            if (!res.headersSent) return res.status(500).json({ error: 'Error interno al procesar el registro.' });
        });
    });

    app.post('/api/auto-presente', (req, res) => {
        const { token, curso: clientCurso } = req.body;
        const curso = clientCurso || getActiveCourse();
        const clientIP = normalizeClientIP(req.ip || req.connection.remoteAddress);

        if (!curso) return res.status(400).json({ error: 'No hay un curso activo cargado.' });
        const verified = verifyStudentToken(token);
        if (!verified) return res.status(401).json({ error: 'Token de alumno inválido o alterado.', invalidToken: true });

        const filePath = getOrInitWorkingWorkbook(curso);
        if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'El archivo del curso no existe.' });

        if (req.body.fotoData) {
            const fotoValidation = validateFotoBase64(req.body.fotoData);
            if (!fotoValidation.valid) return res.status(400).json({ error: fotoValidation.error });
        }
        if (rateLimitExceeded(clientIP, 'auto-presente')) {
            return res.status(429).json({ error: 'Demasiadas solicitudes. Espera unos segundos e inténtalo de nuevo.' });
        }

        withCourseLock(filePath, () => {
            try {
                const workbook = xlsx.readFile(filePath);
                const sheetName = workbook.SheetNames[0];
                const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

                let targetIndex = -1;
                let alumnoRow = null;
                if (verified.studentId !== null && Number.isInteger(verified.studentId) && data[verified.studentId] !== undefined) {
                    const candidate = data[verified.studentId];
                    if (obtenerNombreAlumno(candidate).toLowerCase() === verified.studentName) {
                        targetIndex = verified.studentId;
                        alumnoRow = candidate;
                    }
                }
                if (!alumnoRow) {
                    targetIndex = data.findIndex(row => obtenerNombreAlumno(row).toLowerCase() === verified.studentName);
                    if (targetIndex !== -1) alumnoRow = data[targetIndex];
                }
                if (!alumnoRow) return res.status(404).json({ error: 'Alumno no encontrado en el curso activo.' });

                const displayName = obtenerNombreAlumno(alumnoRow);
                const studentDni = alumnoRow['DNI'] || '';
                const hoy = new Date();

                if (!isFullyRegistered(alumnoRow)) {
                    console.log(`🆕 Alumno [${displayName}] sin datos completados: se omite auto-presente (debe registrarse de nuevo).`);
                    return res.json({ success: false, invalidToken: true, necesitaRegistro: true });
                }

                const dateSheetName = `${hoy.getDate().toString().padStart(2, '0')}-${(hoy.getMonth() + 1).toString().padStart(2, '0')}-${hoy.getFullYear()}`;
                const horaActual = hoy.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
                let dateData = [];
                const cfgTardanzaAP = leerCfgTardanza(workbook);
                const horaTomaListaAP = leerHoraTomaLista(workbook, dateSheetName);
                const ahoraMinAP = hoy.getHours() * 60 + hoy.getMinutes();
                const tardeAutoAP = evaluarTarde(cfgTardanzaAP, ahoraMinAP, horaAminutos(horaTomaListaAP));
                if (workbook.SheetNames.includes(dateSheetName)) {
                    dateData = xlsx.utils.sheet_to_json(workbook.Sheets[dateSheetName]);
                }
                const idxInDate = dateData.findIndex(r => (r['Alumno'] || r['Nombre'] || '').toString().trim().toLowerCase() === displayName.toLowerCase());
                const estadoPrevio = idxInDate >= 0
                    ? (dateData[idxInDate]['Asistencia'] || dateData[idxInDate]['Estado'] || '').toString().trim().toUpperCase()
                    : '';
                const esTardioAuto = estadoPrevio === 'PRESENTE TARDÍO';
                const estadoDocente = (!esTardioAuto && (estadoPrevio.includes('TARDE') || estadoPrevio.includes('AUSENTE'))) ? estadoPrevio : '';

                if (idxInDate >= 0 && (estadoDocente || esTardioAuto)) {
                    if (esTardioAuto) {
                        dateData[idxInDate]['Hora Registro'] = horaActual;
                        workbook.Sheets[dateSheetName] = xlsx.utils.json_to_sheet(dateData);
                    }
                    if (estadoDocente) {
                        console.log(`🚫 Auto-presente respetado: ${displayName} quedó ${estadoDocente} por decisión del docente, NO se remarca.`);
                    }
                } else {
                    const filaFechaObj = {
                        'DNI': studentDni || 'SIN DNI',
                        'Alumno': displayName,
                        'Asistencia': tardeAutoAP ? 'PRESENTE TARDÍO' : 'PRESENTES',
                        'Grupo': (alumnoRow['Grupo'] || 'SIN GRUPO').toString().toUpperCase().trim(),
                        'Hora Registro': horaActual
                    };
                    if (idxInDate >= 0) dateData[idxInDate] = filaFechaObj;
                    else dateData.push(filaFechaObj);
                    const dateSheet = xlsx.utils.json_to_sheet(dateData);
                    if (workbook.SheetNames.includes(dateSheetName)) workbook.Sheets[dateSheetName] = dateSheet;
                    else xlsx.utils.book_append_sheet(workbook, dateSheet, dateSheetName);
                }

                consolidarPresentismo(workbook, data);
                workbook.Sheets[sheetName] = xlsx.utils.json_to_sheet(data);

                const writeErr = writeWorkbookSafely(workbook, filePath);
                if (writeErr) return res.status(500).json({ error: writeErr.error });

                if (req.body.fotoData) saveStudentFoto(displayName, studentDni, req.body.fotoData);

                const fotoConfig = state.formConfig.standardFields && state.formConfig.standardFields.foto;
                const fotoHabilitada = !fotoConfig || fotoConfig.enabled !== false;
                const fotoUrl = findFotoForStudent(displayName, studentDni);
                const requiereFoto = fotoHabilitada && !fotoUrl;
                const newToken = generateStudentToken(displayName, targetIndex);
                const configAsist = state.formConfig.asistencia || {};
                const permiteTardio = configAsist.permitirPresenteTardio !== false;
                const horaLimite = typeof configAsist.horaLimite === 'string' ? configAsist.horaLimite.trim() : '';
                const puedeRemarcarTardio = !!(estadoDocente && permiteTardio && dentroDeHoraLimite(horaLimite));

                console.log(`🟢 Auto-presente registrado para: ${displayName} en [${path.basename(curso)}] ${requiereFoto ? '(Pide foto de rostro)' : ''}`);
                res.json({
                    success: true, autoPresente: true,
                    autoPresenteAplicado: !estadoDocente && !esTardioAuto,
                    estadoHoy: estadoDocente || (esTardioAuto ? 'PRESENTE TARDÍO' : (tardeAutoAP ? 'PRESENTE TARDÍO' : 'PRESENTES')),
                    esTardioAuto: !!esTardioAuto, puedeRemarcarTardio, permitePresenteTardio: permiteTardio,
                    horaLimite, nombreAlumno: displayName, alumnoId: targetIndex,
                    fechaRegistro: alumnoRow['Fecha Registro'], token: newToken, fotoUrl, requiereFoto
                });
            } catch (error) {
                console.error('Error al registrar auto-presente:', error);
                res.status(500).json({ error: 'Error interno al registrar el presente.' });
            }
        }).catch(() => {
            if (!res.headersSent) res.status(500).json({ error: 'Error interno al procesar el auto-presente.' });
        });
    });

    app.post('/api/mi-perfil', (req, res) => {
        const { token, curso: clientCurso } = req.body;
        const curso = clientCurso || getActiveCourse();
        const clientIP = normalizeClientIP(req.ip || req.connection.remoteAddress);

        if (!curso) return res.status(400).json({ error: 'No hay un curso activo cargado.' });
        const verified = verifyStudentToken(token);
        if (!verified) return res.status(401).json({ error: 'Token de alumno inválido o alterado.', invalidToken: true });

        const filePath = getOrInitWorkingWorkbook(curso);
        if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'El archivo del curso no existe.' });
        if (rateLimitExceeded(clientIP, 'mi-perfil')) {
            return res.status(429).json({ error: 'Demasiadas solicitudes. Espera unos segundos e inténtalo de nuevo.' });
        }

        withCourseLock(filePath, () => {
            try {
                const workbook = xlsx.readFile(filePath);
                const sheetName = workbook.SheetNames[0];
                const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
                const { index: targetIndex, row: alumnoRow } = obtenerFilaPorToken(data, verified);
                if (!alumnoRow || targetIndex < 0) return res.status(404).json({ error: 'Alumno no encontrado en el curso activo.' });

                const nombreAlumno = obtenerNombreAlumno(alumnoRow);
                const datos = {
                    email: alumnoRow['Email Privado'] || '',
                    dni: alumnoRow['DNI'] || '',
                    titulo: alumnoRow['Título'] || '',
                    tecnologia: alumnoRow['Tecnología'] || '',
                    grupo: alumnoRow['Grupo'] || '',
                    telefono: alumnoRow['Teléfono'] || '',
                    fecha: alumnoRow['Fecha Registro'] || ''
                };
                const customValues = {};
                (state.formConfig.customFields || []).forEach(field => {
                    if (field.enabled === false) return;
                    const keyName = field.label || field.name;
                    customValues[field.id] = alumnoRow[keyName] !== undefined ? alumnoRow[keyName] : '';
                });
                const fotoUrl = findFotoForStudent(nombreAlumno, datos.dni);
                res.json({ success: true, nombreAlumno, alumnoId: targetIndex, datos, customValues, fotoUrl });
            } catch (error) {
                console.error('Error al leer el perfil del alumno:', error);
                res.status(500).json({ error: 'Error interno al leer los datos del alumno.' });
            }
        }).catch(() => {
            if (!res.headersSent) res.status(500).json({ error: 'Error interno al obtener el perfil.' });
        });
    });

    app.post('/api/mi-perfil/guardar', (req, res) => {
        const { token, curso: clientCurso, email, dni, titulo, tecnologia, grupo, telefono, customValues, fotoData } = req.body;
        const curso = clientCurso || getActiveCourse();
        const clientIP = normalizeClientIP(req.ip || req.connection.remoteAddress);

        if (!curso) return res.status(400).json({ error: 'No hay un curso activo cargado.' });
        const verified = verifyStudentToken(token);
        if (!verified) return res.status(401).json({ error: 'Token de alumno inválido o alterado.', invalidToken: true });

        const filePath = getOrInitWorkingWorkbook(curso);
        if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'El archivo del curso no existe.' });
        if (typeof email === 'string' && email.length > 254) return res.status(400).json({ error: 'El email es demasiado largo.' });
        if (typeof dni === 'string' && dni.length > 64) return res.status(400).json({ error: 'El DNI/ID es demasiado largo.' });
        if (fotoData) {
            const fotoValidation = validateFotoBase64(fotoData);
            if (!fotoValidation.valid) return res.status(400).json({ error: fotoValidation.error });
        }
        if (rateLimitExceeded(clientIP, 'mi-perfil')) {
            return res.status(429).json({ error: 'Demasiadas solicitudes. Espera unos segundos e inténtalo de nuevo.' });
        }

        withCourseLock(filePath, () => {
            try {
                const workbook = xlsx.readFile(filePath);
                const sheetName = workbook.SheetNames[0];
                const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
                const { index: targetIndex, row: alumno } = obtenerFilaPorToken(data, verified);
                if (!alumno || targetIndex < 0) return res.status(404).json({ error: 'Alumno no encontrado en el curso activo.' });

                if (state.formConfig.standardFields.email?.enabled !== false) alumno['Email Privado'] = typeof email === 'string' ? email.trim() : '';
                if (state.formConfig.standardFields.titulo?.enabled !== false) alumno['Título'] = typeof titulo === 'string' ? titulo.trim() : '';
                if (state.formConfig.standardFields.tecnologia?.enabled !== false) alumno['Tecnología'] = typeof tecnologia === 'string' ? tecnologia.trim() : '';
                if (state.formConfig.standardFields.telefono?.enabled !== false) alumno['Teléfono'] = typeof telefono === 'string' ? telefono.trim() : '';
                if (state.formConfig.standardFields.dni?.enabled !== false) alumno['DNI'] = typeof dni === 'string' ? dni.trim() : '';
                if (state.formConfig.standardFields.grupo?.enabled !== false) alumno['Grupo'] = typeof grupo === 'string' ? grupo.trim() : '';

                if (customValues && typeof customValues === 'object') {
                    (state.formConfig.customFields || []).forEach(field => {
                        if (field.enabled !== false && customValues[field.id] !== undefined) {
                            const keyName = field.label || field.name;
                            alumno[keyName] = customValues[field.id];
                        }
                    });
                }
                const alumnoName = obtenerNombreAlumno(alumno);
                if (fotoData) saveStudentFoto(alumnoName, dni || alumno['DNI'], fotoData);

                consolidarPresentismo(workbook, data);
                workbook.Sheets[sheetName] = xlsx.utils.json_to_sheet(data);
                const writeErr = writeWorkbookSafely(workbook, filePath);
                if (writeErr) return res.status(500).json({ error: writeErr.error });

                console.log(`💾 Perfil actualizado por el alumno: ${alumnoName} en [${path.basename(curso)}].`);
                const newFotoUrl = fotoData ? findFotoForStudent(alumnoName, dni || alumno['DNI']) : null;
                res.json({ success: true, fotoUrl: newFotoUrl });
            } catch (error) {
                console.error('Error al guardar perfil del alumno:', error);
                res.status(500).json({ error: 'Error interno al guardar los datos del alumno.' });
            }
        }).catch(() => {
            if (!res.headersSent) res.status(500).json({ error: 'Error interno al actualizar el perfil.' });
        });
    });

    app.post('/api/mi-presente/remarcar', (req, res) => {
        const { token, curso: clientCurso } = req.body;
        const curso = clientCurso || getActiveCourse();
        const clientIP = normalizeClientIP(req.ip || req.connection.remoteAddress);

        if (!curso) return res.status(400).json({ error: 'No hay un curso activo cargado.' });
        const verified = verifyStudentToken(token);
        if (!verified) return res.status(401).json({ error: 'Token de alumno inválido o alterado.', invalidToken: true });

        const filePath = getOrInitWorkingWorkbook(curso);
        if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'El archivo del curso no existe.' });

        const configAsist = state.formConfig.asistencia || {};
        const permiteTardio = configAsist.permitirPresenteTardio !== false;
        const horaLimite = typeof configAsist.horaLimite === 'string' ? configAsist.horaLimite.trim() : '';
        if (!permiteTardio) return res.status(403).json({ error: 'El presente tardío está deshabilitado por el docente.' });
        if (!dentroDeHoraLimite(horaLimite)) {
            return res.status(403).json({ error: `Ya pasó el horario límite para registrarse como presente tardío (${horaLimite || 'sin horario'}).` });
        }
        if (rateLimitExceeded(clientIP, 'mi-presente')) {
            return res.status(429).json({ error: 'Demasiadas solicitudes. Espera unos segundos e inténtalo de nuevo.' });
        }

        withCourseLock(filePath, () => {
            try {
                const workbook = xlsx.readFile(filePath);
                const sheetName = workbook.SheetNames[0];
                const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
                const { index: targetIndex, row: alumnoRow } = obtenerFilaPorToken(data, verified);
                if (!alumnoRow || targetIndex < 0) return res.status(404).json({ error: 'Alumno no encontrado en el curso activo.' });

                const displayName = obtenerNombreAlumno(alumnoRow);
                const studentDni = alumnoRow['DNI'] || '';
                const hoy = new Date();
                const dateSheetName = `${hoy.getDate().toString().padStart(2, '0')}-${(hoy.getMonth() + 1).toString().padStart(2, '0')}-${hoy.getFullYear()}`;
                const horaActual = hoy.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

                let dateData = [];
                if (workbook.SheetNames.includes(dateSheetName)) {
                    dateData = xlsx.utils.sheet_to_json(workbook.Sheets[dateSheetName]);
                }
                const idxInDate = dateData.findIndex(r => (r['Alumno'] || r['Nombre'] || '').toString().trim().toLowerCase() === displayName.toLowerCase());
                const filaFechaObj = {
                    'DNI': studentDni || 'SIN DNI',
                    'Alumno': displayName,
                    'Asistencia': 'PRESENTE TARDÍO',
                    'Grupo': (alumnoRow['Grupo'] || 'SIN GRUPO').toString().toUpperCase().trim(),
                    'Hora Registro': horaActual
                };
                if (idxInDate >= 0) dateData[idxInDate] = filaFechaObj;
                else dateData.push(filaFechaObj);
                workbook.Sheets[dateSheetName] = xlsx.utils.json_to_sheet(dateData);

                consolidarPresentismo(workbook, data);
                workbook.Sheets[sheetName] = xlsx.utils.json_to_sheet(data);
                const writeErr = writeWorkbookSafely(workbook, filePath);
                if (writeErr) return res.status(500).json({ error: writeErr.error });

                const fotoUrl = findFotoForStudent(displayName, studentDni);
                console.log(`🟠 Presente tardío auto-registrado por ${displayName} a las ${horaActual} en [${path.basename(curso)}].`);
                res.json({ success: true, estado: 'PRESENTE TARDÍO', hora: horaActual, fotoUrl });
            } catch (error) {
                console.error('Error al registrar presente tardío:', error);
                res.status(500).json({ error: 'Error interno al registrar el presente tardío.' });
            }
        }).catch(() => {
            if (!res.headersSent) res.status(500).json({ error: 'Error interno al procesar el presente tardío.' });
        });
    });

    app.post('/api/borrar-foto-alumno', requireAdmin, (req, res) => {
        const { nombreCompleto, dni } = req.body;
        if (!nombreCompleto) return res.status(400).json({ error: 'Nombre de alumno no especificado' });
        const deleted = deleteStudentFoto(nombreCompleto, dni);
        res.json({ success: true, deleted });
    });

    app.get('/api/check-registration', (req, res) => {
        const clientIP = normalizeClientIP(req.ip || req.connection.remoteAddress);
        res.json({ registered: registeredIPs.has(clientIP) });
    });
}

module.exports = { registerRegistrationRoutes };
