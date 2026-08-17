const fs = require('fs');
const { CONFIG_PATH } = require('./paths');
const { state } = require('../core/state');
const { requireAdmin } = require('../core/auth');

const defaultTituloOptions = [
    'LICENCIADO', 'ABOGADO', 'ARQUITECTO', 'COMUNICADOR', 'CONTADOR',
    'DOCENTE', 'ENFERMERO', 'IMAGENOLOGO', 'INGENIERO', 'MEDICO',
    'NUTRICIONISTA', 'POLITOLOGO', 'PSICOLOGO', 'RADIOLOGO',
    'SISTEMAS', 'VETERINARIO', 'OTRO'
];

const defaultConfig = {
    standardFields: {
        email: { label: 'Email Privado', enabled: true, required: true, category: 'personal' },
        dni: { label: 'DNI / ID', enabled: true, required: true, category: 'personal' },
        titulo: { label: 'Título Profesional / Especialidad', enabled: true, required: true, category: 'personal', type: 'select', options: defaultTituloOptions },
        tecnologia: { label: 'Relación con la Tecnología', enabled: true, required: true, category: 'personal', type: 'select', options: ['AVANZADO', 'MODERADO', 'TEMEROSO'] },
        grupo: { label: 'Grupo (Una sola palabra)', enabled: true, required: true, category: 'personal' },
        telefono: { label: 'Teléfono (Opcional)', enabled: true, required: false, category: 'personal' },
        foto: { label: 'Foto Real del Rostro (Identificación Visual)', enabled: true, required: false, category: 'personal' }
    },
    customFields: [],
    cursoPreferido: '',
    asistencia: {
        permitirPresenteTardio: true,
        horaLimite: ''
    }
};

function loadFormConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
            const parsed = JSON.parse(raw);
            const std = {};
            Object.keys(defaultConfig.standardFields).forEach(k => {
                const def = defaultConfig.standardFields[k];
                const stored = (parsed.standardFields && parsed.standardFields[k]) || {};
                std[k] = {
                    ...def,
                    ...stored,
                    category: stored.category || def.category || 'personal',
                    options: (stored.options && stored.options.length > 0) ? stored.options : (def.options || [])
                };
            });

            const custom = (Array.isArray(parsed.customFields) ? parsed.customFields : []).map(f => ({
                ...f,
                category: f.category || 'clase',
                options: f.options || []
            }));

            const asistencia = {
                permitirPresenteTardio: parsed.asistencia?.permitirPresenteTardio !== false,
                horaLimite: typeof parsed.asistencia?.horaLimite === 'string' ? parsed.asistencia.horaLimite.trim() : ''
            };

            return {
                standardFields: std,
                customFields: custom,
                asistencia,
                cursoPreferido: typeof parsed.cursoPreferido === 'string' ? parsed.cursoPreferido.trim() : ''
            };
        }
    } catch (err) {
        console.error('Error al cargar form-config.json:', err);
    }
    return JSON.parse(JSON.stringify(defaultConfig));
}

function saveFormConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
        state.formConfig = config;
        return true;
    } catch (err) {
        console.error('Error al guardar form-config.json:', err);
        return false;
    }
}

// Cargar al iniciar para que state.formConfig esté disponible
state.formConfig = loadFormConfig();

function registerFormConfigRoutes(app) {
    app.get('/api/form-config', (req, res) => {
        res.json(state.formConfig);
    });

    app.post('/api/form-config', requireAdmin, (req, res) => {
        const { standardFields, customFields, asistencia, cursoPreferido } = req.body;
        if (!standardFields) return res.status(400).json({ error: 'Configuración inválida' });

        const newConfig = {
            standardFields: { ...defaultConfig.standardFields, ...standardFields },
            customFields: Array.isArray(customFields) ? customFields : [],
            asistencia: {
                permitirPresenteTardio: asistencia?.permitirPresenteTardio !== false,
                horaLimite: typeof asistencia?.horaLimite === 'string' ? asistencia.horaLimite.trim() : ''
            },
            cursoPreferido: typeof cursoPreferido === 'string' ? cursoPreferido.trim() : (state.formConfig.cursoPreferido || '')
        };

        if (saveFormConfig(newConfig)) {
            console.log('⚙️ Configuración del formulario actualizada y guardada en form-config.json');
            res.json({ success: true, formConfig: newConfig });
        } else {
            res.status(500).json({ error: 'Error al guardar la configuración en disco' });
        }
    });
}

module.exports = { defaultConfig, loadFormConfig, saveFormConfig, registerFormConfigRoutes };
