const fs = require('fs');
const path = require('path');
const { CURSOS_DIR } = require('../config/paths');
const { state } = require('../core/state');
const { requireAdmin, isAdminAuthenticated } = require('../core/auth');
const { saveFormConfig } = require('../config/formConfig');
const { xlsx, getOrInitWorkingWorkbook, obtenerNombreAlumno, withCourseLock, writeWorkbookSafely } = require('./xlsx');

// Obtener el curso activo (auto-selecciona preferido o el primero disponible)
function getActiveCourse() {
    if (state.activeCourse && fs.existsSync(path.join(CURSOS_DIR, state.activeCourse))) {
        return state.activeCourse;
    }
    try {
        const targetPreferred = (state.formConfig && state.formConfig.cursoPreferido || '').toString().trim();
        if (targetPreferred && fs.existsSync(path.join(CURSOS_DIR, targetPreferred))) {
            state.activeCourse = targetPreferred;
            console.log(`💡 Auto-seleccionado curso preferido por el docente: ${state.activeCourse}`);
            return state.activeCourse;
        }
        const files = fs.readdirSync(CURSOS_DIR).filter(f => {
            const low = f.toLowerCase();
            return (low.endsWith('.xlsx') || low.endsWith('.xls') || low.endsWith('.csv')) && !f.startsWith('~$');
        });
        if (files.length > 0) {
            state.activeCourse = files[0];
            console.log(`💡 Auto-seleccionado curso por defecto: ${state.activeCourse}`);
        }
    } catch (e) {
        console.error('Error al detectar curso por defecto:', e);
    }
    return state.activeCourse;
}

function registerCoursesRoutes(app) {
    app.get('/api/cursos', (req, res) => {
        try {
            const files = fs.readdirSync(CURSOS_DIR).filter(f => {
                const low = f.toLowerCase();
                return (low.endsWith('.xlsx') || low.endsWith('.xls') || low.endsWith('.csv')) && !f.startsWith('~$');
            });
            console.log(`📂 Cursos detectados en la carpeta: ${files.length} archivos`);
            res.json(files);
        } catch (error) {
            console.error('Error al leer cursos:', error);
            res.status(500).json({ error: 'Error al leer la carpeta de cursos' });
        }
    });

    app.get('/api/active-course', (req, res) => {
        res.json({ activeCourse: getActiveCourse() });
    });

    app.post('/api/active-course', requireAdmin, (req, res) => {
        state.activeCourse = req.body.course;
        state.registeredIPs.clear();
        try {
            if (state.activeCourse) {
                state.formConfig.cursoPreferido = state.activeCourse;
                saveFormConfig(state.formConfig);
            }
        } catch (e) {
            console.error('No se pudo persistir el curso preferido:', e);
        }
        console.log(`\n📘 Curso activo cambiado a: ${state.activeCourse}. Lista de IPs reiniciada.`);
        res.json({ success: true, activeCourse: state.activeCourse });
    });

    app.get('/api/grupos', (req, res) => {
        const curso = req.query.curso || state.activeCourse;
        if (!curso) return res.json([]);
        const filePath = getOrInitWorkingWorkbook(curso);
        if (!filePath || !fs.existsSync(filePath)) return res.json([]);
        try {
            const workbook = xlsx.readFile(filePath);
            const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            const grupos = [...new Set(data.map(row => row['Grupo']).filter(g => g))];
            res.json(grupos.sort());
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener grupos' });
        }
    });

    app.get('/api/grupos-miembros', (req, res) => {
        const curso = req.query.curso || state.activeCourse;
        if (!curso) return res.json({});
        const filePath = getOrInitWorkingWorkbook(curso);
        if (!filePath || !fs.existsSync(filePath)) return res.json({});
        try {
            const workbook = xlsx.readFile(filePath);
            const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            const gruposMap = {};
            data.forEach(row => {
                const name = obtenerNombreAlumno(row);
                if (!name || name.toLowerCase() === 'nombre' || name.toLowerCase() === 'full name') return;
                const grupo = (row['Grupo'] || '').toString().trim().toUpperCase();
                if (!grupo) return;
                if (!gruposMap[grupo]) gruposMap[grupo] = [];
                gruposMap[grupo].push({
                    nombreCompleto: name.trim(),
                    titulo: row['Título'] || row['Titulo'] || 'Sin Título',
                    email: row['Email Privado'] || '',
                    tecnologia: row['Tecnología'] || row['Tecnologia'] || ''
                });
            });
            res.json(gruposMap);
        } catch (error) {
            res.status(500).json({ error: 'Error al procesar grupos e integrantes' });
        }
    });
}

module.exports = { getActiveCourse, registerCoursesRoutes };
