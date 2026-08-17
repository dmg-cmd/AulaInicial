const fs = require('fs');
const path = require('path');
const { xlsx, getOrInitWorkingWorkbook, obtenerNombreAlumno, withCourseLock,
    writeWorkbookSafely, consolidarPresentismo, findFotoForStudent } = require('../data/xlsx');
const { getActiveCourse } = require('../data/courses');
const { requireAdmin } = require('../core/auth');
const { state } = require('../core/state');
const { isFullyRegistered } = require('../utils/validation');
const { todaySheetName, normalizeSheetDate, leerCfgTardanza, leerHoraTomaLista,
    guardarCfgTardanza, guardarHoraTomaLista } = require('../features/late');


function normalizeGrupoStr(g) {
    if (!g) return '';
    return g.toString().toUpperCase().replace(/^GRUPO\s*[-_]?\s*/, '').trim();
}

function registerAttendanceRoutes(app) {
    app.get('/api/fechas-disponibles', (req, res) => {
        const curso = req.query.curso || getActiveCourse();
        if (!curso) return res.json([{ id: 'TODAS', label: '🌐 Acumulado General (Todas las Fechas)' }]);
        const filePath = getOrInitWorkingWorkbook(curso);
        if (!filePath || !fs.existsSync(filePath)) return res.json([{ id: 'TODAS', label: '🌐 Acumulado General (Todas las Fechas)' }]);
        try {
            const workbook = xlsx.readFile(filePath);
            const sheetNames = workbook.SheetNames;
            const list = [{ id: 'TODAS', label: '🌐 Acumulado General (Todas las Fechas)' }];
            sheetNames.forEach((sName, idx) => {
                if (idx === 0) return;
                list.push({ id: sName, label: `📅 Fecha: ${sName}` });
            });
            res.json(list);
        } catch (err) {
            console.error('Error al obtener fechas disponibles:', err);
            res.json([{ id: 'TODAS', label: '🌐 Acumulado General (Todas las Fechas)' }]);
        }
    });

    app.get('/api/stats', requireAdmin, (req, res) => {
        const curso = req.query.curso || getActiveCourse();
        const targetField = (req.query.campo || 'titulo').toString().trim();
        const filterGroup = (req.query.grupo || 'TODOS').toString().trim().toUpperCase();
        const filterFecha = (req.query.fecha || 'TODOS').toString().trim();

        if (!curso) return res.json({ availableFields: [], data: [], totalCount: 0 });
        const filePath = getOrInitWorkingWorkbook(curso);
        if (!filePath || !fs.existsSync(filePath)) return res.json({ availableFields: [], data: [], totalCount: 0 });

        function normalizeTitle(t) {
            if (!t) return '';
            let normalized = t.toString().trim().toUpperCase();
            const equivalents = {
                'ABOGADA': 'ABOGADO', 'INGENIERA': 'INGENIERO', 'TECNICA': 'TECNICO', 'LICENCIADA': 'LICENCIADO',
                'MEDICA': 'MEDICO', 'ADMINISTRATIVA': 'ADMINISTRATIVO', 'ARQUITECTA': 'ARQUITECTO', 'PSICOLOGA': 'PSICOLOGO',
                'ENFERMERA': 'ENFERMERO', 'NUTRICIONISTAS': 'NUTRICIONISTA', 'RADIOLOGA': 'RADIOLOGO', 'POLITOLOGA': 'POLITOLOGO',
                'COMUNICADORA': 'COMUNICADOR', 'MAESTRA': 'DOCENTE', 'PROFESORA': 'DOCENTE'
            };
            return equivalents[normalized] || normalized;
        }

        try {
            const workbook = xlsx.readFile(filePath);
            const sheetNames = workbook.SheetNames;
            const mainSheetName = sheetNames[0];
            const mainRows = xlsx.utils.sheet_to_json(workbook.Sheets[mainSheetName]);

            const mainAlumnosMap = new Map();
            mainRows.forEach(row => {
                const dni = (row['DNI'] || row['ID'] || '').toString().trim();
                const name = obtenerNombreAlumno(row);
                const nameKey = name.trim().toLowerCase();
                if (dni) mainAlumnosMap.set(`dni:${dni}`, row);
                if (nameKey) mainAlumnosMap.set(`name:${nameKey}`, row);
            });

            let rowsToAnalyze = [];
            if (filterFecha && filterFecha !== 'TODOS' && sheetNames.includes(filterFecha)) {
                const dateRows = xlsx.utils.sheet_to_json(workbook.Sheets[filterFecha]);
                rowsToAnalyze = dateRows.map(dateRow => {
                    const dni = (dateRow['DNI'] || dateRow['ID'] || '').toString().trim();
                    const alumnoName = (dateRow['Alumno'] || dateRow['Nombre'] || '').toString().trim().toLowerCase();
                    let mainData = null;
                    if (dni && mainAlumnosMap.has(`dni:${dni}`)) mainData = mainAlumnosMap.get(`dni:${dni}`);
                    else if (alumnoName && mainAlumnosMap.has(`name:${alumnoName}`)) mainData = mainAlumnosMap.get(`name:${alumnoName}`);
                    return { ...(mainData || {}), ...dateRow };
                });
            } else {
                rowsToAnalyze = mainRows;
            }

            const fieldsMap = new Map();
            fieldsMap.set('titulo', 'Título Profesional / Especialidad');
            fieldsMap.set('tecnologia', 'Relación con la Tecnología');
            fieldsMap.set('grupo', 'Grupo');
            fieldsMap.set('asistencia', 'Asistencia (Presente / Tarde / Ausente)');
            fieldsMap.set('dni', 'DNI / ID');
            fieldsMap.set('email', 'Email Privado');
            fieldsMap.set('telefono', 'Teléfono');
            if (formConfig && Array.isArray(state.formConfig.customFields)) {
                state.formConfig.customFields.forEach(f => {
                    const keyId = (f.label || f.name || f.id || '').toString().toLowerCase().trim();
                    if (keyId) fieldsMap.set(keyId, f.label || f.name || keyId);
                });
            }
            const availableFields = Array.from(fieldsMap.entries()).map(([id, label]) => ({ id, label }));

            const cleanFilterGroup = normalizeGrupoStr(filterGroup);
            const filteredRows = rowsToAnalyze.filter(row => {
                if ((row['Borrado'] || 'NO') === 'SI') return false;
                if (cleanFilterGroup === 'TODOS' || !cleanFilterGroup) return true;
                const rowGrupo = normalizeGrupoStr(row['Grupo'] || row['grupo'] || '');
                return rowGrupo === cleanFilterGroup;
            });

            const dynamicCounts = {};
            let validAnswersCount = 0;
            filteredRows.forEach(row => {
                let rawValue = null;
                const targetClean = targetField.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
                if (targetClean === 'titulo') rawValue = row['Título'] || row['Titulo'] || row['Título Profesional / Especialidad'] || row['Titulo Profesional'] || row['Especialidad'];
                else if (targetClean === 'tecnologia') rawValue = row['Tecnología'] || row['Tecnologia'] || row['Relación con la Tecnología'];
                else if (targetClean === 'grupo') rawValue = row['Grupo'] || row['grupo'];
                else if (targetClean === 'asistencia') {
                    rawValue = row['Asistencia'] || row['Estado'] || row['Presentismo'];
                    if (!rawValue && row['Presentes'] !== undefined) {
                        const pres = parseInt(row['Presentes'], 10) || 0;
                        const aus = parseInt(row['Ausentes'], 10) || 0;
                        const tar = parseInt(row['Tardes'], 10) || 0;
                        const tot = parseInt(row['Total Clases'], 10) || 0;
                        if (pres > 0) rawValue = 'PRESENTES';
                        else if (tar > 0) rawValue = 'TARDE';
                        else if (aus > 0 || tot > 0) rawValue = 'AUSENTES';
                    }
                } else if (targetClean === 'dni') rawValue = row['DNI'] || row['ID'];
                else if (targetClean === 'email') rawValue = row['Email Privado'] || row['Email address'] || row['Email'];
                else if (targetClean === 'telefono') rawValue = row['Teléfono'] || row['Telefono'];

                if (rawValue === null || rawValue === undefined || rawValue.toString().trim() === '') {
                    for (const key of Object.keys(row)) {
                        const kClean = key.toString().trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
                        if (kClean === targetClean || kClean.includes(targetClean) || targetClean.includes(kClean)) {
                            rawValue = row[key];
                            if (rawValue !== null && rawValue !== undefined && rawValue.toString().trim() !== '') break;
                        }
                    }
                }

                if (rawValue !== null && rawValue !== undefined && rawValue.toString().trim() !== '') {
                    let valStr = rawValue.toString().trim();
                    if (targetClean === 'titulo') valStr = normalizeTitle(valStr);
                    else if (targetClean === 'tecnologia') {
                        const u = valStr.toUpperCase();
                        if (u.includes('AVANZADO')) valStr = 'AVANZADO';
                        else if (u.includes('MODERADO')) valStr = 'MODERADO';
                        else if (u.includes('TEMEROSO')) valStr = 'TEMEROSO';
                        else valStr = u;
                    } else valStr = valStr.toUpperCase();
                    dynamicCounts[valStr] = (dynamicCounts[valStr] || 0) + 1;
                    validAnswersCount++;
                }
            });

            const sortedData = Object.entries(dynamicCounts)
                .map(([name, count]) => ({ name, count, percentage: validAnswersCount > 0 ? parseFloat(((count / validAnswersCount) * 100).toFixed(1)) : 0 }))
                .sort((a, b) => b.count - a.count);

            res.json({ availableFields, selectedField: targetField, selectedGroup: filterGroup, totalAlumnosSheet: filteredRows.length, totalCount: validAnswersCount, data: sortedData });
        } catch (error) {
            console.error('Error en /api/stats:', error);
            res.status(500).json({ error: 'Error al generar estadísticas para el curso: ' + curso });
        }
    });

    app.get('/api/ausencias', requireAdmin, (req, res) => {
        const curso = req.query.curso || getActiveCourse();
        const filterMes = (req.query.mes || '').toString().trim().toUpperCase();
        const filterGrupo = (req.query.grupo || 'TODOS').toString().trim().toUpperCase();

        if (!curso) return res.json({ mesesDisponibles: [], alumnos: [], totalesGenerales: null });
        const filePath = getOrInitWorkingWorkbook(curso);
        if (!filePath || !fs.existsSync(filePath)) return res.json({ mesesDisponibles: [], alumnos: [], totalesGenerales: null });

        function mesDeSheetName(sName) {
            const parts = sName.toString().trim().split('-');
            if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) return `${parts[1]}-${parts[2]}`;
            return '';
        }

        try {
            const workbook = xlsx.readFile(filePath);
            const sheetNames = workbook.SheetNames;
            const mainSheetName = sheetNames[0];
            const mainRows = xlsx.utils.sheet_to_json(workbook.Sheets[mainSheetName]);

            const alumnosMap = new Map();
            mainRows.forEach(row => {
                const name = obtenerNombreAlumno(row);
                const clean = name.trim().toLowerCase();
                if (!clean) return;
                if (!alumnosMap.has(clean)) {
                    alumnosMap.set(clean, {
                        nombreCompleto: name.trim(),
                        dni: (row['DNI'] || row['ID'] || '').toString().trim(),
                        grupo: normalizeGrupoStr(row['Grupo'] || row['grupo'] || ''),
                        fotoUrl: findFotoForStudent(name.trim(), row['DNI']),
                        porMes: {},
                        totales: { presentes: 0, tardes: 0, ausentes: 0, totalClases: 0, pctPresentismo: 0, pctAusencia: 0 }
                    });
                }
            });

            const mesesSet = new Set();
            const clasesPorMes = {};
            sheetNames.forEach((sName, idx) => {
                if (idx === 0) return;
                const mes = mesDeSheetName(sName);
                if (!mes) return;
                if (filterMes && filterMes !== mes) return;
                mesesSet.add(mes);
                clasesPorMes[mes] = (clasesPorMes[mes] || 0) + 1;
                xlsx.utils.sheet_to_json(workbook.Sheets[sName]).forEach(r => {
                    const key = (r['Alumno'] || r['Nombre'] || '').toString().trim().toLowerCase();
                    if (!key || !alumnosMap.has(key)) return;
                    const st = (r['Asistencia'] || r['Estado'] || '').toString().trim().toUpperCase();
                    const alumno = alumnosMap.get(key);
                    if (!alumno.porMes[mes]) alumno.porMes[mes] = { presentes: 0, tardes: 0, ausentes: 0, total: 0, pctAusencia: 0 };
                    const slot = alumno.porMes[mes];
                    slot.total++;
                    if (st.includes('TARDE')) slot.tardes++;
                    else if (st.includes('PRESENTE')) slot.presentes++;
                    else slot.ausentes++;
                    alumno.totales.totalClases++;
                    if (st.includes('TARDE')) alumno.totales.tardes++;
                    else if (st.includes('PRESENTE')) alumno.totales.presentes++;
                    else alumno.totales.ausentes++;
                });
            });

            const mesesDisponibles = Array.from(mesesSet).sort();
            const alumnosList = Array.from(alumnosMap.values())
                .filter(a => {
                    if (a.totales.totalClases === 0) return false;
                    if (filterGrupo !== 'TODOS' && a.grupo !== normalizeGrupoStr(filterGrupo)) return false;
                    return true;
                })
                .map(a => {
                    Object.keys(a.porMes).forEach(m => {
                        const s = a.porMes[m];
                        s.pctAusencia = s.total > 0 ? parseFloat(((s.ausentes / s.total) * 100).toFixed(1)) : 0;
                    });
                    const t = a.totales;
                    t.pctPresentismo = t.totalClases > 0 ? parseFloat(((t.presentes / t.totalClases) * 100).toFixed(1)) : 0;
                    t.pctAusencia = t.totalClases > 0 ? parseFloat(((t.ausentes / t.totalClases) * 100).toFixed(1)) : 0;
                    return a;
                });

            let totPres = 0, totTar = 0, totAus = 0, totClases = 0;
            alumnosList.forEach(a => {
                totPres += a.totales.presentes;
                totTar += a.totales.tardes;
                totAus += a.totales.ausentes;
                totClases += a.totales.totalClases;
            });
            alumnosList.sort((a, b) => b.totales.pctAusencia - a.totales.pctAusencia);
            res.json({
                mesesDisponibles,
                alumnos: alumnosList,
                totalesGenerales: {
                    presentes: totPres, tardes: totTar, ausentes: totAus, totalClases: totClases,
                    pctPresentismo: totClases > 0 ? parseFloat(((totPres / totClases) * 100).toFixed(1)) : 0,
                    pctAusencia: totClases > 0 ? parseFloat(((totAus / totClases) * 100).toFixed(1)) : 0
                }
            });
        } catch (error) {
            console.error('Error en /api/ausencias:', error);
            res.status(500).json({ error: 'Error al generar ausencias por mes para el curso: ' + curso });
        }
    });

    app.post('/api/asistencia/tomar', requireAdmin, (req, res) => {
        const { curso: clientCurso, fecha: rawFecha, asistencias } = req.body;
        const curso = clientCurso || getActiveCourse();
        if (!curso) return res.status(400).json({ error: 'No hay un curso activo.' });
        if (!Array.isArray(asistencias)) return res.status(400).json({ error: 'Listado de asistencias inválido.' });
        const safeCurso = path.basename(curso);
        const filePath = getOrInitWorkingWorkbook(curso);
        if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo de curso no encontrado.' });
        const targetFecha = normalizeSheetDate(rawFecha || todaySheetName());
        withCourseLock(filePath, () => {
            try {
                const workbook = xlsx.readFile(filePath);
                const sheetNames = workbook.SheetNames;
                const mainSheetName = sheetNames[0];
                const horaActual = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
                const dateRows = asistencias.map(a => ({
                    'DNI': a.dni || 'SIN DNI',
                    'Alumno': a.nombreCompleto || 'ALUMNO',
                    'Asistencia': a.tarde ? 'TARDE' : (a.presente ? 'PRESENTES' : 'AUSENTES'),
                    'Grupo': a.grupo || 'SIN GRUPO',
                    'Hora Registro': horaActual
                }));
                const dateSheet = xlsx.utils.json_to_sheet(dateRows);
                if (sheetNames.includes(targetFecha)) workbook.Sheets[targetFecha] = dateSheet;
                else xlsx.utils.book_append_sheet(workbook, dateSheet, targetFecha);
                const mainData = xlsx.utils.sheet_to_json(workbook.Sheets[mainSheetName]);
                consolidarPresentismo(workbook, mainData);
                workbook.Sheets[mainSheetName] = xlsx.utils.json_to_sheet(mainData);
                const writeErr = writeWorkbookSafely(workbook, filePath);
                if (writeErr) return res.status(500).json({ error: writeErr.error });
                console.log(`📋 Asistencia guardada para la fecha [${targetFecha}] en [${safeCurso}].`);
                res.json({ success: true, fecha: targetFecha });
            } catch (err) {
                console.error('Error al guardar asistencia:', err);
                res.status(500).json({ error: 'Error al actualizar el Excel con la asistencia por fecha.' });
            }
        }).catch(() => {
            if (!res.headersSent) res.status(500).json({ error: 'Error interno al guardar la asistencia.' });
        });
    });

    app.get('/api/asistencia/cfg', requireAdmin, (req, res) => {
        const { curso: clientCurso } = req.query;
        const curso = clientCurso || getActiveCourse();
        if (!curso) return res.status(400).json({ error: 'No hay un curso activo.' });
        const filePath = getOrInitWorkingWorkbook(curso);
        if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo de curso no encontrado.' });
        try {
            const workbook = xlsx.readFile(filePath);
            const cfg = leerCfgTardanza(workbook);
            const fechaHoy = todaySheetName();
            const horaTomaListaHoy = leerHoraTomaLista(workbook, fechaHoy);
            res.json({ success: true, cfg, horaTomaListaHoy, fecha: fechaHoy });
        } catch (e) {
            console.error('Error leyendo cfg de tardanza:', e);
            res.status(500).json({ error: 'Error al leer la configuración de tardanza.' });
        }
    });

    app.post('/api/asistencia/cfg', requireAdmin, (req, res) => {
        const { curso: clientCurso, modo, horaInicio, margenGracia, minDespues } = req.body;
        const curso = clientCurso || getActiveCourse();
        if (!curso) return res.status(400).json({ error: 'No hay un curso activo.' });
        const filePath = getOrInitWorkingWorkbook(curso);
        if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo de curso no encontrado.' });
        const nuevo = {
            modo: (modo === 'horario' || modo === 'desplist') ? modo : 'manual',
            horaInicio: (typeof horaInicio === 'string') ? horaInicio.trim() : '',
            margenGracia: parseInt(margenGracia, 10) || 0,
            minDespues: parseInt(minDespues, 10) || 30
        };
        withCourseLock(filePath, () => {
            try {
                const workbook = xlsx.readFile(filePath);
                guardarCfgTardanza(workbook, nuevo);
                const writeErr = writeWorkbookSafely(workbook, filePath);
                if (writeErr) return res.status(500).json({ error: writeErr ? writeErr.error : 'Error al guardar' });
                res.json({ success: true, cfg: nuevo });
            } catch (e) {
                console.error('Error guardando cfg de tardanza:', e);
                res.status(500).json({ error: 'Error al guardar la configuración de tardanza.' });
            }
        }).catch(() => {
            if (!res.headersSent) res.status(500).json({ error: 'Error interno al guardar la configuración.' });
        });
    });

    app.post('/api/asistencia/tomar-lista', requireAdmin, (req, res) => {
        const { curso: clientCurso, fecha: rawFecha } = req.body;
        const curso = clientCurso || getActiveCourse();
        if (!curso) return res.status(400).json({ error: 'No hay un curso activo.' });
        const targetFecha = normalizeSheetDate(rawFecha || todaySheetName());
        const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        const filePath = getOrInitWorkingWorkbook(curso);
        if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo de curso no encontrado.' });
        withCourseLock(filePath, () => {
            try {
                const workbook = xlsx.readFile(filePath);
                guardarHoraTomaLista(workbook, targetFecha, hora);
                const writeErr = writeWorkbookSafely(workbook, filePath);
                if (writeErr) return res.status(500).json({ error: writeErr.error });
                res.json({ success: true, fecha: targetFecha, hora });
            } catch (e) {
                console.error('Error al registrar toma de lista:', e);
                res.status(500).json({ error: 'Error al registrar la toma de lista.' });
            }
        }).catch(() => {
            if (!res.headersSent) res.status(500).json({ error: 'Error interno al registrar la toma de lista.' });
        });
    });

    app.post('/api/asistencia/borrar-dia', requireAdmin, (req, res) => {
        const { curso: clientCurso, fecha: rawFecha } = req.body;
        const curso = clientCurso || getActiveCourse();
        if (!curso) return res.status(400).json({ error: 'No hay un curso activo.' });
        if (!rawFecha) return res.status(400).json({ error: 'Debe indicar la fecha a borrar.' });
        const safeCurso = path.basename(curso);
        const filePath = getOrInitWorkingWorkbook(curso);
        if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo de curso no encontrado.' });
        const targetFecha = normalizeSheetDate(rawFecha);
        if (!targetFecha) return res.status(400).json({ error: 'Fecha inválida.' });
        withCourseLock(filePath, () => {
            try {
                const workbook = xlsx.readFile(filePath);
                const sheetNames = workbook.SheetNames;
                if (!sheetNames.includes(targetFecha)) {
                    return res.status(404).json({ error: `La fecha ${targetFecha} no existe en este curso. Usa el selector de fechas guardadas para elegir un día que sí tenga asistencia registrada.` });
                }
                const idx = sheetNames.indexOf(targetFecha);
                if (idx === 0) return res.status(400).json({ error: 'No se puede borrar el Resumen General.' });
                delete workbook.Sheets[targetFecha];
                workbook.SheetNames = sheetNames.filter(s => s !== targetFecha);
                const mainSheetName = sheetNames[0];
                const mainData = xlsx.utils.sheet_to_json(workbook.Sheets[mainSheetName]);
                consolidarPresentismo(workbook, mainData);
                workbook.Sheets[mainSheetName] = xlsx.utils.json_to_sheet(mainData);
                const writeErr = writeWorkbookSafely(workbook, filePath);
                if (writeErr) return res.status(500).json({ error: writeErr.error });
                const fechasRestantes = workbook.SheetNames.filter((s, i) => i > 0);
                console.log(`🗑️ Día de asistencia [${targetFecha}] eliminado del curso [${safeCurso}]. Quedan ${fechasRestantes.length} día(s).`);
                res.json({ success: true, fecha: targetFecha, fechasRestantes });
            } catch (err) {
                console.error('Error al borrar día de asistencia:', err);
                res.status(500).json({ error: 'Error al eliminar el día de asistencia del Excel.' });
            }
        }).catch(() => {
            if (!res.headersSent) res.status(500).json({ error: 'Error interno al borrar el día de asistencia.' });
        });
    });

    app.get('/api/asistencia/consultar', (req, res) => {
        const curso = req.query.curso || getActiveCourse();
        const rawFecha = (req.query.fecha || '').toString().trim();
        if (!curso) return res.status(400).json({ error: 'No hay curso activo.' });
        const safeCurso = path.basename(curso);
        const filePath = getOrInitWorkingWorkbook(curso);
        if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo de curso no encontrado.' });
        try {
            const workbook = xlsx.readFile(filePath);
            const sheetNames = workbook.SheetNames;
            const targetFecha = normalizeSheetDate(rawFecha);
            let sheetToRead = targetFecha;
            if (!sheetToRead || !sheetNames.includes(sheetToRead)) {
                const dateSheets = sheetNames.filter((s, idx) => idx > 0);
                if (dateSheets.length > 0) sheetToRead = dateSheets[dateSheets.length - 1];
                else sheetToRead = null;
            }
            if (!sheetToRead || !sheetNames.includes(sheetToRead)) {
                return res.json({ fecha: null, alumnos: [], totalPresentes: 0, totalAusentes: 0, mensaje: 'No hay registros de asistencia por fecha guardados aún.' });
            }
            const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetToRead]);
            let totalPresentes = 0, totalTardes = 0, totalAusentes = 0;
            const list = rows.map(r => {
                const st = (r['Asistencia'] || r['Estado'] || 'AUSENTES').toString().trim().toUpperCase();
                const esTardioAuto = st === 'PRESENTE TARDÍO';
                const esTarde = !esTardioAuto && st.includes('TARDE');
                const esPresente = esTardioAuto || st.includes('PRESENTE');
                if (esPresente) totalPresentes++;
                else if (esTarde) totalTardes++;
                else totalAusentes++;
                return {
                    dni: r['DNI'] || 'SIN DNI',
                    alumno: r['Alumno'] || r['Nombre'] || 'Sin nombre',
                    asistencia: esTardioAuto ? 'PRESENTE TARDÍO' : (esTarde ? 'TARDE' : (esPresente ? 'PRESENTES' : 'AUSENTES')),
                    esTardioAuto: !!esTardioAuto,
                    grupo: r['Grupo'] || 'Sin Grupo',
                    hora: r['Hora Registro'] || '-'
                };
            });
            res.json({
                fecha: sheetToRead, totalPresentes, totalTardes, totalAusentes, totalAlumnos: list.length, alumnos: list
            });
        } catch (err) {
            console.error('Error al consultar asistencia por fecha:', err);
            res.status(500).json({ error: 'Error al leer la asistencia por fecha.' });
        }
    });

    app.get('/api/server-info', (req, res) => {
        res.json(state.serverInfo);
    });
}

module.exports = { registerAttendanceRoutes };
