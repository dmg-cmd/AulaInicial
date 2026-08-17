const fs = require('fs');
const path = require('path');
const { requireAdmin, isAdminAuthenticated } = require('../core/auth');
const { CURSOS_DIR } = require('../config/paths');
const { state } = require('../core/state');
const { getActiveCourse } = require('./courses');
const { isFullyRegistered } = require('../utils/validation');
const { todaySheetName, normalizeSheetDate } = require('../features/late');
const {
    xlsx, getOrInitWorkingWorkbook, obtenerNombreAlumno, withCourseLock,
    writeWorkbookSafely, consolidarPresentismo, reconciliarAusentes,
    deleteStudentFoto, findFotoForStudent
} = require('./xlsx');


function registerStudentsRoutes(app) {
    // Agregar alumno a la lista general (Hoja 1). El presente se registra en /api/registro;
    // aquí solo se marca asistencia manual si el docente lo solicita (presente === true).
    app.post(['/api/agregar-alumno', '/api/alumnos/agregar', '/api/alumno/agregar'], requireAdmin, (req, res) => {
        const { curso: clientCurso, nombre, apellido, dni, grupo, titulo, email, presente, fecha: rawFecha } = req.body;
        let curso = (clientCurso || getActiveCourse() || '').toString().trim();
        if (!curso) {
            try {
                const available = fs.readdirSync(CURSOS_DIR).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
                if (available.length > 0) curso = available[0];
            } catch (e) {}
        }
        if (!curso) return res.status(400).json({ error: 'No hay un curso activo seleccionado.' });
        if (!nombre && !apellido) return res.status(400).json({ error: 'Debes proporcionar al menos el nombre o apellido del alumno.' });

        const safeCurso = path.basename(curso);
        const filePath = getOrInitWorkingWorkbook(curso);
        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(400).json({ error: `No se encontró la planilla del curso [${curso}]. Selecciona un curso válido.` });
        }

        withCourseLock(filePath, () => {
            try {
                const workbook = xlsx.readFile(filePath);
                const sheetNames = workbook.SheetNames;
                const mainSheetName = sheetNames[0];
                const mainData = xlsx.utils.sheet_to_json(workbook.Sheets[mainSheetName]);

                const nomClean = (nombre || '').toString().trim().slice(0, 100);
                const apeClean = (apellido || '').toString().trim().slice(0, 100);
                const nombreCompleto = `${nomClean} ${apeClean}`.trim();

                const existe = mainData.some(row => obtenerNombreAlumno(row).toLowerCase() === nombreCompleto.toLowerCase());
                const hoy = new Date();

                if (!existe) {
                    const nuevaFila = {
                        'Last name': apeClean,
                        'First name': nomClean,
                        'Email address': email || '',
                        'Email Privado': email || '',
                        'DNI': dni || '',
                        'Grupo': (grupo || 'SIN GRUPO').toString().toUpperCase().trim()
                    };
                    if (titulo) nuevaFila['Título'] = titulo.toString().toUpperCase().trim();
                    if (req.body.tecnologia) nuevaFila['Tecnología'] = req.body.tecnologia.toString().toUpperCase().trim();
                    mainData.push(nuevaFila);
                    console.log(`➕ Alumno agregado a la lista de [${safeCurso}]: ${nombreCompleto}${presente === true ? ' (marcado presente manualmente)' : ' (pendiente de completar sus datos)'}`);
                }

                const esPresente = presente === true;
                const horaActual = hoy.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
                const defaultFecha = `${hoy.getDate().toString().padStart(2, '0')}-${(hoy.getMonth() + 1).toString().padStart(2, '0')}-${hoy.getFullYear()}`;
                const targetFecha = (rawFecha || defaultFecha).toString().trim().replace(/[\/\\]/g, '-');

                if (esPresente && targetFecha) {
                    let dateSheetName = targetFecha;
                    let dateData = [];
                    if (sheetNames.includes(dateSheetName)) {
                        dateData = xlsx.utils.sheet_to_json(workbook.Sheets[dateSheetName]);
                    }
                    const idxInDate = dateData.findIndex(r => (r['Alumno'] || '').toString().trim().toLowerCase() === nombreCompleto.toLowerCase());
                    const filaFechaObj = {
                        'DNI': dni || 'SIN DNI',
                        'Alumno': nombreCompleto,
                        'Asistencia': 'PRESENTES',
                        'Grupo': (grupo || 'SIN GRUPO').toString().toUpperCase().trim(),
                        'Hora Registro': horaActual
                    };
                    if (idxInDate >= 0) dateData[idxInDate] = filaFechaObj;
                    else dateData.push(filaFechaObj);
                    const dateSheet = xlsx.utils.json_to_sheet(dateData);
                    if (sheetNames.includes(dateSheetName)) workbook.Sheets[dateSheetName] = dateSheet;
                    else xlsx.utils.book_append_sheet(workbook, dateSheet, dateSheetName);
                }

                reconciliarAusentes(workbook, mainData, true);
                const totalClasesTomadas = consolidarPresentismo(workbook, mainData);
                workbook.Sheets[mainSheetName] = xlsx.utils.json_to_sheet(mainData);

                const writeErr = writeWorkbookSafely(workbook, filePath);
                if (writeErr) return res.status(500).json({ error: writeErr.error });
                res.json({ success: true, nombreCompleto, presente: esPresente, fecha: targetFecha });
            } catch (err) {
                console.error('Error al agregar alumno manualmente:', err);
                res.status(500).json({ error: 'Error interno al agregar el alumno en la planilla Excel: ' + (err.message || '') });
            }
        }).catch(() => {
            if (!res.headersSent) res.status(500).json({ error: 'Error interno al agregar el alumno.' });
        });
    });

    app.post('/api/borrar-alumno', requireAdmin, (req, res) => {
        const { curso: clientCurso, nombreAlumno, definitivo } = req.body;
        const curso = clientCurso || getActiveCourse();
        if (!curso) return res.status(400).json({ error: 'No hay un curso activo seleccionado.' });
        if (!nombreAlumno) return res.status(400).json({ error: 'Nombre de alumno no especificado.' });
        const safeCurso = path.basename(curso);
        const filePath = getOrInitWorkingWorkbook(curso);
        if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo de curso no encontrado.' });

        withCourseLock(filePath, () => {
            try {
                const workbook = xlsx.readFile(filePath);
                const targetClean = nombreAlumno.toString().trim().toLowerCase();
                const mainSheetName = workbook.SheetNames[0];
                const mainData = xlsx.utils.sheet_to_json(workbook.Sheets[mainSheetName]);

                if (definitivo === true) {
                    const removedDni = [];
                    const newMainData = mainData.filter(row => {
                        const coincide = obtenerNombreAlumno(row).toLowerCase() === targetClean;
                        if (coincide) removedDni.push((row['DNI'] || '').toString().trim());
                        return !coincide;
                    });
                    workbook.Sheets[mainSheetName] = xlsx.utils.json_to_sheet(newMainData);
                    workbook.SheetNames.forEach((sName, idx) => {
                        if (idx === 0) return;
                        const sData = xlsx.utils.sheet_to_json(workbook.Sheets[sName]);
                        const newSData = sData.filter(r => (r['Alumno'] || r['Nombre'] || '').toString().trim().toLowerCase() !== targetClean);
                        workbook.Sheets[sName] = xlsx.utils.json_to_sheet(newSData);
                    });
                    deleteStudentFoto(nombreAlumno, removedDni[0] || '');
                    consolidarPresentismo(workbook, newMainData);
                    workbook.Sheets[mainSheetName] = xlsx.utils.json_to_sheet(newMainData);
                    const writeErr = writeWorkbookSafely(workbook, filePath);
                    if (writeErr) return res.status(500).json({ error: writeErr.error });
                    console.log(`🗑️ Alumno [${nombreAlumno}] eliminado DEFINITIVAMENTE de [${safeCurso}]`);
                    return res.json({ success: true, nombreAlumno, definitivo: true });
                }

                let marcado = false;
                mainData.forEach(row => {
                    if (obtenerNombreAlumno(row).toLowerCase() === targetClean) {
                        row['Borrado'] = 'SI';
                        marcado = true;
                    }
                });
                if (!marcado) return res.status(404).json({ error: 'Alumno no encontrado en el curso.' });
                consolidarPresentismo(workbook, mainData);
                workbook.Sheets[mainSheetName] = xlsx.utils.json_to_sheet(mainData);
                const writeErr = writeWorkbookSafely(workbook, filePath);
                if (writeErr) return res.status(500).json({ error: writeErr.error });
                console.log(`🚫 Alumno [${nombreAlumno}] marcado como BORRADO (lógico) en [${safeCurso}] - historial conservado`);
                res.json({ success: true, nombreAlumno, borrado: true });
            } catch (err) {
                console.error('Error al borrar alumno:', err);
                res.status(500).json({ error: 'Error al borrar el alumno del archivo Excel.' });
            }
        }).catch(() => {
            if (!res.headersSent) res.status(500).json({ error: 'Error interno al borrar el alumno.' });
        });
    });

    app.post('/api/restaurar-alumno', requireAdmin, (req, res) => {
        const { curso: clientCurso, nombreAlumno } = req.body;
        const curso = clientCurso || getActiveCourse();
        if (!curso) return res.status(400).json({ error: 'No hay un curso activo seleccionado.' });
        if (!nombreAlumno) return res.status(400).json({ error: 'Nombre de alumno no especificado.' });
        const safeCurso = path.basename(curso);
        const filePath = getOrInitWorkingWorkbook(curso);
        if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo de curso no encontrado.' });

        withCourseLock(filePath, () => {
            try {
                const workbook = xlsx.readFile(filePath);
                const targetClean = nombreAlumno.toString().trim().toLowerCase();
                const mainSheetName = workbook.SheetNames[0];
                const mainData = xlsx.utils.sheet_to_json(workbook.Sheets[mainSheetName]);
                let restaurado = false;
                mainData.forEach(row => {
                    if (obtenerNombreAlumno(row).toLowerCase() === targetClean) {
                        row['Borrado'] = 'NO';
                        restaurado = true;
                    }
                });
                if (!restaurado) return res.status(404).json({ error: 'Alumno no encontrado en el curso.' });
                consolidarPresentismo(workbook, mainData);
                workbook.Sheets[mainSheetName] = xlsx.utils.json_to_sheet(mainData);
                const writeErr = writeWorkbookSafely(workbook, filePath);
                if (writeErr) return res.status(500).json({ error: writeErr.error });
                console.log(`♻️ Alumno [${nombreAlumno}] restaurado en [${safeCurso}]`);
                res.json({ success: true, nombreAlumno });
            } catch (err) {
                console.error('Error al restaurar alumno:', err);
                res.status(500).json({ error: 'Error al restaurar el alumno.' });
            }
        }).catch(() => {
            if (!res.headersSent) res.status(500).json({ error: 'Error interno al restaurar el alumno.' });
        });
    });

    app.post('/api/admin/reconciliar-ausentes', requireAdmin, (req, res) => {
        const { curso: clientCurso } = req.body;
        const curso = clientCurso || getActiveCourse();
        if (!curso) return res.status(400).json({ error: 'No hay un curso activo seleccionado.' });
        const safeCurso = path.basename(curso);
        const filePath = getOrInitWorkingWorkbook(curso);
        if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo de curso no encontrado.' });

        withCourseLock(filePath, () => {
            try {
                const workbook = xlsx.readFile(filePath);
                const mainSheetName = workbook.SheetNames[0];
                const mainData = xlsx.utils.sheet_to_json(workbook.Sheets[mainSheetName]);
                reconciliarAusentes(workbook, mainData, true);
                consolidarPresentismo(workbook, mainData);
                workbook.Sheets[mainSheetName] = xlsx.utils.json_to_sheet(mainData);
                const writeErr = writeWorkbookSafely(workbook, filePath);
                if (writeErr) return res.status(500).json({ error: writeErr.error });
                console.log(`🔄 Ausentes faltantes reconciliados en [${safeCurso}] (desde hoy)`);
                res.json({ success: true });
            } catch (err) {
                console.error('Error al reconciliar ausentes:', err);
                res.status(500).json({ error: 'Error al reconciliar ausentes.' });
            }
        }).catch(() => {
            if (!res.headersSent) res.status(500).json({ error: 'Error interno al reconciliar ausentes.' });
        });
    });

    app.post('/api/modificar-alumno', requireAdmin, (req, res) => {
        const { curso: clientCurso, nombreOriginal, nuevoNombre, nuevoApellido, nuevoDni, nuevoGrupo, nuevoTitulo, nuevoEmail } = req.body;
        const curso = clientCurso || getActiveCourse();
        if (!curso) return res.status(400).json({ error: 'No hay un curso activo seleccionado.' });
        if (!nombreOriginal) return res.status(400).json({ error: 'Nombre original de alumno no especificado.' });
        const safeCurso = path.basename(curso);
        const filePath = getOrInitWorkingWorkbook(curso);
        if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo de curso no encontrado.' });

        withCourseLock(filePath, () => {
            try {
                const workbook = xlsx.readFile(filePath);
                const targetClean = nombreOriginal.toString().trim().toLowerCase();
                const nomClean = (nuevoNombre || '').toString().trim().slice(0, 100);
                const apeClean = (nuevoApellido || '').toString().trim().slice(0, 100);
                const nuevoNombreCompleto = (nomClean || apeClean) ? `${nomClean} ${apeClean}`.trim() : nombreOriginal;

                const mainSheetName = workbook.SheetNames[0];
                const mainData = xlsx.utils.sheet_to_json(workbook.Sheets[mainSheetName]);
                let modificado = false;

                mainData.forEach(row => {
                    const n = obtenerNombreAlumno(row);
                    if (n.toLowerCase() === targetClean) {
                        if (nomClean) row['First name'] = nomClean;
                        if (apeClean) row['Last name'] = apeClean;
                        if (row['Full Name'] !== undefined) row['Full Name'] = nuevoNombreCompleto;
                        if (row['Full name'] !== undefined) row['Full name'] = nuevoNombreCompleto;
                        if (row['Alumno'] !== undefined) row['Alumno'] = nuevoNombreCompleto;
                        if (row['Nombre y Apellido'] !== undefined) row['Nombre y Apellido'] = nuevoNombreCompleto;
                        if (nuevoDni !== undefined) row['DNI'] = nuevoDni;
                        if (nuevoGrupo !== undefined) row['Grupo'] = nuevoGrupo.toString().toUpperCase().trim();
                        if (nuevoTitulo !== undefined) row['Título'] = nuevoTitulo;
                        if (nuevoEmail !== undefined) {
                            row['Email Privado'] = nuevoEmail;
                            row['Email address'] = nuevoEmail;
                        }
                        modificado = true;
                    }
                });
                workbook.Sheets[mainSheetName] = xlsx.utils.json_to_sheet(mainData);

                workbook.SheetNames.forEach((sName, idx) => {
                    if (idx === 0) return;
                    const sData = xlsx.utils.sheet_to_json(workbook.Sheets[sName]);
                    sData.forEach(r => {
                        const nomItem = (r['Alumno'] || r['Nombre'] || '').toString().trim().toLowerCase();
                        if (nomItem === targetClean) {
                            r['Alumno'] = nuevoNombreCompleto;
                            if (nuevoDni !== undefined) r['DNI'] = nuevoDni;
                            if (nuevoGrupo !== undefined) r['Grupo'] = nuevoGrupo.toString().toUpperCase().trim();
                        }
                    });
                    workbook.Sheets[sName] = xlsx.utils.json_to_sheet(sData);
                });

                const writeErr = writeWorkbookSafely(workbook, filePath);
                if (writeErr) return res.status(500).json({ error: writeErr.error });
                console.log(`✏️ Alumno [${nombreOriginal}] actualizado exitosamente a [${nuevoNombreCompleto}] en [${safeCurso}]`);
                res.json({ success: true, nombreOriginal, nuevoNombreCompleto });
            } catch (err) {
                console.error('Error al modificar alumno:', err);
                res.status(500).json({ error: 'Error interno al actualizar datos del alumno en Excel.' });
            }
        }).catch(() => {
            if (!res.headersSent) res.status(500).json({ error: 'Error interno al modificar al alumno.' });
        });
    });

    app.get('/api/alumnos', (req, res) => {
        if (req.query.full === 'true' && !isAdminAuthenticated(req)) {
            return res.status(401).json({ error: 'No autorizado. Debes iniciar sesión en el panel docente.', adminRequired: true });
        }
        const curso = req.query.curso || getActiveCourse();
        if (!curso) return res.status(400).json({ error: 'Curso no seleccionado' });
        const filePath = getOrInitWorkingWorkbook(curso);
        if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado' });

        try {
            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

            const estadoHoy = new Map();
            const hoySheet = todaySheetName();
            if (workbook.SheetNames.includes(hoySheet)) {
                xlsx.utils.sheet_to_json(workbook.Sheets[hoySheet]).forEach(r => {
                    const st = (r['Asistencia'] || r['Estado'] || '').toString().trim().toUpperCase();
                    const n = (r['Alumno'] || r['Nombre'] || '').toString().trim().toLowerCase();
                    if (n) estadoHoy.set(n, st);
                });
            }

            const rawAlumnos = data.map((row, index) => {
                const name = obtenerNombreAlumno(row);
                const status = isFullyRegistered(row);
                const estadoHoyAlumno = estadoHoy.get(name.trim().toLowerCase()) || '';
                const pres = parseInt(row['Presentes'], 10) || 0;
                const aus = parseInt(row['Ausentes'], 10) || 0;
                const tar = parseInt(row['Tardes'], 10) || 0;
                const tot = parseInt(row['Total Clases'], 10) || 0;
                const pctRaw = parseFloat(row['% Presentismo']);
                const pct = isNaN(pctRaw) && tot > 0 ? parseFloat(((pres / tot) * 100).toFixed(1)) : (pctRaw || 0);
                const result = {
                    id: index,
                    nombreCompleto: name.trim(),
                    completado: status,
                    borrado: (row['Borrado'] || 'NO') === 'SI',
                    presenteHoy: estadoHoyAlumno.includes('PRESENTE'),
                    tardeHoy: estadoHoyAlumno === 'TARDE',
                    llegadaTardiaHoy: estadoHoyAlumno === 'PRESENTE TARDÍO',
                    presentes: pres,
                    ausentes: aus,
                    tardes: tar,
                    totalClases: tot,
                    porcentajePresentismo: pct,
                    fotoUrl: findFotoForStudent(name.trim(), row['DNI'])
                };

                if (req.query.full === 'true' && status) {
                    result.datos = {
                        email: row['Email Privado'],
                        dni: row['DNI'],
                        titulo: row['Título'] || row['Titulo'],
                        tecnologia: row['Tecnología'] || row['Tecnologia'],
                        grupo: row['Grupo'],
                        telefono: row['Teléfono'],
                        fecha: row['Fecha Registro']
                    };
                state.formConfig.customFields.forEach(field => {
                    const keyName = field.label || field.name;
                    if (row[keyName] !== undefined) result.datos[keyName] = row[keyName];
                });
                }
                return result;
            });

            const incluirBorrados = req.query.incluirBorrados === 'true';
            const seen = new Set();
            const alumnos = rawAlumnos.filter(a => {
                if (!a.nombreCompleto || a.nombreCompleto.toLowerCase() === 'nombre' || a.nombreCompleto.toLowerCase() === 'full name') return false;
                if (seen.has(a.nombreCompleto)) return false;
                seen.add(a.nombreCompleto);
                if (a.borrado && !incluirBorrados) return false;
                return true;
            });
            res.json(alumnos);
        } catch (error) {
            res.status(500).json({ error: 'Error al procesar el archivo Excel' });
        }
    });

    app.post('/api/update-alumno-grupo', requireAdmin, (req, res) => {
        const { curso: clientCurso, nombreAlumno, nuevoGrupo } = req.body;
        const curso = clientCurso || getActiveCourse();
        if (!curso) return res.status(400).json({ error: 'No hay un curso activo seleccionado.' });
        const safeCurso = path.basename(curso);
        const filePath = getOrInitWorkingWorkbook(curso);
        if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo de curso no encontrado.' });
        if (!nombreAlumno || (typeof nombreAlumno !== 'string' && typeof nombreAlumno !== 'number')) {
            return res.status(400).json({ error: 'Nombre de alumno no válido.' });
        }

        withCourseLock(filePath, () => {
            try {
                const workbook = xlsx.readFile(filePath);
                const sheetName = workbook.SheetNames[0];
                const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
                let updated = false;
                const targetGrupo = (nuevoGrupo || '').toString().trim().toUpperCase().replace(/\s/g, '');
                data.forEach(row => {
                    if (obtenerNombreAlumno(row).trim().toLowerCase() === nombreAlumno.trim().toLowerCase()) {
                        row['Grupo'] = targetGrupo;
                        updated = true;
                    }
                });
                if (updated) {
                    workbook.Sheets[sheetName] = xlsx.utils.json_to_sheet(data);
                    const writeErr = writeWorkbookSafely(workbook, filePath);
                    if (writeErr) return res.status(500).json({ error: writeErr.error });
                    console.log(`✏️ Docente actualizó el grupo de [${nombreAlumno}] a [${targetGrupo}] en [${safeCurso}]`);
                    return res.json({ success: true, grupo: targetGrupo });
                }
                return res.status(404).json({ error: 'Alumno no encontrado en el curso.' });
            } catch (error) {
                console.error('Error al actualizar grupo del alumno:', error);
                res.status(500).json({ error: 'Error al actualizar el Excel.' });
            }
        }).catch(() => {
            if (!res.headersSent) res.status(500).json({ error: 'Error interno al actualizar el grupo.' });
        });
    });
}

module.exports = { registerStudentsRoutes };
