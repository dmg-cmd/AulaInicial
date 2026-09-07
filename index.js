let currentAlumnos = [];
let selectedAlumnoId = null;
let currentActiveCourseName = ''; // Almacenar el nombre del curso actual
const courseTitle = document.getElementById('course-title');
const alumnoSearch = document.getElementById('alumno-search');
const resultsList = document.getElementById('results-list');
const formSection = document.getElementById('form-section');
const searchSection = document.getElementById('search-section');
const registroForm = document.getElementById('registro-form');
const feedbackMsg = document.getElementById('msg-feedback');
const selectedAlumnoLabel = document.getElementById('selected-alumno-name');

let currentStudentFormConfig = null;
let currentAutoAlumnoId = null;
let currentSelectedFotoData = null;

function processImageFile(file, maxWidth = 300) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            return reject(new Error('Archivo no es una imagen válida'));
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                resolve(dataUrl);
            };
            img.onerror = () => reject(new Error('Error al decodificar la imagen'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        reader.readAsDataURL(file);
    });
}

function getSavedStudentToken() {
    return localStorage.getItem('aula_inicial_token') || getCookie('aula_inicial_token');
}

function saveStudentToken(token) {
    if (!token) return;
    localStorage.setItem('aula_inicial_token', token);
    document.cookie = `aula_inicial_token=${token}; path=/; max-age=31536000; SameSite=Lax`;
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

async function loadAppVersion() {
    try {
        const res = await fetch('/api/version');
        if (res.ok) {
            const data = await res.json();
            const vText = data.version ? `v${data.version}` : '';
            const badge = document.getElementById('app-version-badge');
            const footer = document.getElementById('footer-version');
            if (badge) badge.textContent = vText;
            if (footer) footer.textContent = vText;
        }
    } catch (err) {
        // Fallback silencioso
    }
}

async function initStudent() {
    loadAppVersion();
    setupAutoFormHandler();
    setupAutoPresenteTardio();
    await loadStudentFormConfig();
    await checkActiveCourse();
    const autoDone = await checkAutoPresente();
    if (!autoDone) {
        await checkRegistrationStatus();
    }
}

async function loadStudentFormConfig() {
    try {
        const res = await fetch('/api/form-config');
        currentStudentFormConfig = await res.json();
        applyStudentFormConfig();
    } catch (err) {
        console.error('Error al cargar la configuración del formulario', err);
    }
}

function applyStudentFormConfig() {
    if (!currentStudentFormConfig) return;
    const std = currentStudentFormConfig.standardFields || {};

    const fieldMap = {
        email: { fg: 'fg-email', input: 'email' },
        dni: { fg: 'fg-dni', input: 'dni' },
        titulo: { fg: 'fg-titulo', input: 'titulo' },
        tecnologia: { fg: 'fg-tecnologia', input: 'tecnologia' },
        grupo: { fg: 'fg-grupo', input: 'grupo' },
        telefono: { fg: 'fg-telefono', input: 'telefono' },
        foto: { fg: 'fg-foto', input: 'foto-input' }
    };

    Object.keys(fieldMap).forEach(key => {
        const config = std[key];
        const fg = document.getElementById(fieldMap[key].fg);
        const input = document.getElementById(fieldMap[key].input);

        if (fg && input) {
            if (config && config.enabled === false) {
                fg.style.display = 'none';
                input.removeAttribute('required');
            } else {
                fg.style.display = 'block';
                if (config && config.required !== false) {
                    input.setAttribute('required', 'true');
                } else {
                    input.removeAttribute('required');
                }
            }
        }
    });

    // Poblar dinámicamente las opciones del selector de Título
    const tituloInput = document.getElementById('titulo');
    if (tituloInput && std.titulo && Array.isArray(std.titulo.options) && std.titulo.options.length > 0) {
        const currentVal = tituloInput.value;
        tituloInput.innerHTML = '<option value="" disabled selected>Selecciona tu Título / Especialidad...</option>';
        std.titulo.options.forEach(optVal => {
            const opt = document.createElement('option');
            opt.value = optVal;
            opt.textContent = optVal;
            if (optVal === currentVal) opt.selected = true;
            tituloInput.appendChild(opt);
        });
    }

    // Poblar dinámicamente las opciones del selector de Tecnología
    const tecInput = document.getElementById('tecnologia');
    if (tecInput && std.tecnologia && Array.isArray(std.tecnologia.options) && std.tecnologia.options.length > 0) {
        const currentVal = tecInput.value;
        tecInput.innerHTML = '<option value="" disabled selected>Selecciona tu Relación con la Tecnología...</option>';
        std.tecnologia.options.forEach(optVal => {
            const opt = document.createElement('option');
            opt.value = optVal;
            opt.textContent = optVal;
            if (optVal === currentVal) opt.selected = true;
            tecInput.appendChild(opt);
        });
    }

    const customContainer = document.getElementById('custom-fields-student-container');
    if (!customContainer) return;
    customContainer.innerHTML = '';

    const customFields = currentStudentFormConfig.customFields || [];
    customFields.forEach(field => {
        if (field.enabled === false) return;

        const fg = document.createElement('div');
        fg.className = 'form-group';

        const header = document.createElement('div');
        header.className = 'field-header';

        const label = document.createElement('label');
        label.setAttribute('for', field.id);
        label.textContent = field.label + (field.required ? ' *' : '');

        const badge = document.createElement('span');
        badge.id = `badge-custom-${field.id}`;
        badge.className = 'field-status-badge badge-nuevo-dato';
        badge.textContent = '⭐ Nuevo';

        header.appendChild(label);
        header.appendChild(badge);
        fg.appendChild(header);

        let input;
        if (field.type === 'select') {
            input = document.createElement('select');
            input.id = field.id;
            input.style.cssText = 'width: 100%; padding: 0.8rem 1rem; border-radius: 12px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); color: #fff; font-size: 1rem; font-family: inherit;';
            
            const defOpt = document.createElement('option');
            defOpt.value = '';
            defOpt.disabled = true;
            defOpt.selected = true;
            defOpt.textContent = `Selecciona ${field.label}...`;
            input.appendChild(defOpt);

            (field.options || []).forEach(optVal => {
                const opt = document.createElement('option');
                opt.value = optVal;
                opt.textContent = optVal;
                input.appendChild(opt);
            });
        } else {
            input = document.createElement('input');
            input.type = field.type === 'number' ? 'number' : 'text';
            input.id = field.id;
            input.placeholder = `Ingresa tu ${field.label.toLowerCase()}...`;
        }

        if (field.required) {
            input.setAttribute('required', 'true');
        }

        fg.appendChild(input);
        customContainer.appendChild(fg);
    });
}

async function checkRegistrationStatus() {
    try {
        const isDemo = new URLSearchParams(window.location.search).get('demo') === 'true';
        if (isDemo) {
            console.log('🔴 MODO DEMO ACTIVADO: No se bloqueará la vista.');
            return; 
        }

        // Configurar botón "Ver y Modificar Mis Datos" si registered-section llega a mostrarse
        const btnVerModificar = document.getElementById('btn-ver-modificar-datos');
        if (btnVerModificar && btnVerModificar.dataset.ready !== 'true') {
            btnVerModificar.dataset.ready = 'true';
            btnVerModificar.addEventListener('click', () => {
                document.getElementById('registered-section').style.display = 'none';
                document.getElementById('search-section').style.display = 'block';
                if (selectedAlumnoId !== null) {
                    document.getElementById('form-section').style.display = 'block';
                }
            });
        }

        const token = getSavedStudentToken();
        if (token) {
            // Si el alumno tiene token guardado en este dispositivo, precargar su ficha directamente
            try {
                const fichaRes = await fetch('/api/alumno/mi-ficha', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, curso: currentActiveCourseName })
                });
                const fichaData = await fichaRes.json();
                if (fichaData.success && fichaData.alumno) {
                    document.getElementById('search-section').style.display = 'none';
                    document.getElementById('registered-section').style.display = 'none';
                    cargarDatosEnFormulario(fichaData.alumno);
                    document.getElementById('form-section').style.display = 'block';
                    return;
                }
            } catch (errFicha) {
                console.warn('No se pudo precargar ficha automáticamente por token:', errFicha);
            }
        }

        // Si no hay token o falló la precarga, NO bloqueamos con pantalla ciega;
        // dejamos search-section visible para que el alumno pueda buscar su nombre y ver sus datos.
    } catch (err) {
        console.error('Error checking registration status', err);
    }
}

async function checkAutoPresente() {
    const isDemo = new URLSearchParams(window.location.search).get('demo') === 'true';
    if (isDemo) return false;

    // Asegurarnos de que la config del formulario esté cargada antes de renderizar campos de clase
    if (!currentStudentFormConfig) {
        await loadStudentFormConfig();
    }

    const token = getSavedStudentToken();
    if (!token) return false;

    try {
        const res = await fetch('/api/auto-presente', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, curso: currentActiveCourseName })
        });
        const data = await res.json();

        if (data.success && data.autoPresente) {
            if (data.token) saveStudentToken(data.token);
            currentAutoAlumnoId = data.alumnoId;

            document.getElementById('search-section').style.display = 'none';
            document.getElementById('form-section').style.display = 'none';
            document.getElementById('registered-section').style.display = 'none';

            const autoSec = document.getElementById('auto-registered-section');
            const welcomeTitle = document.getElementById('auto-welcome-title');
            const autoMsg = document.getElementById('auto-presente-msg');
            const photoImg = document.getElementById('auto-student-photo-img');
            const reUploadBox = document.getElementById('re-upload-photo-box');

            if (welcomeTitle) welcomeTitle.textContent = `¡Hola ${data.nombreAlumno}!`;
            if (autoMsg) {
                autoMsg.innerHTML = '';
                if (data.esTardioAuto) {
                    // El alumno ya se marcó como llegada tardía hoy
                    const strong = document.createElement('strong');
                    strong.textContent = 'PRESENTE';
                    autoMsg.appendChild(document.createTextNode('✅ Tu '));
                    autoMsg.appendChild(strong);
                    autoMsg.appendChild(document.createTextNode(' (llegada tardía) para la clase de hoy ya fue registrado.'));
                } else if (data.autoPresenteAplicado === false) {
                    // El docente dejó al alumno como AUSENTE/TARDE hoy: no lucir como presente.
                    const strong = document.createElement('strong');
                    strong.textContent = data.estadoHoy || 'AUSENTE';
                    autoMsg.appendChild(document.createTextNode('⚠️ Tu estado de hoy fue registrado por el docente como '));
                    autoMsg.appendChild(strong);
                    autoMsg.appendChild(document.createTextNode('. Si ya llegaste, podés marcarte como presente.'));
                } else {
                    const strong = document.createElement('strong');
                    strong.textContent = 'PRESENTE';
                    autoMsg.appendChild(document.createTextNode('✅ Tu '));
                    autoMsg.appendChild(strong);
                    autoMsg.appendChild(document.createTextNode(' para la clase de hoy ha sido registrado automáticamente.'));
                }
                const fechaSpan = document.createElement('br');
                autoMsg.appendChild(fechaSpan);
                const sub = document.createElement('span');
                sub.style.cssText = 'font-size:0.85rem; font-weight: normal; opacity:0.8;';
                sub.textContent = `(Fecha: ${data.fechaRegistro || 'hoy'})`;
                autoMsg.appendChild(sub);
            }

            if (data.fotoUrl && photoImg) {
                photoImg.src = data.fotoUrl;
                photoImg.style.display = 'block';
            } else if (photoImg) {
                photoImg.style.display = 'none';
            }

            if (data.requiereFoto && reUploadBox) {
                reUploadBox.style.display = 'block';
                setupReFotoInput(token);
            } else if (reUploadBox) {
                reUploadBox.style.display = 'none';
            }

            if (autoSec) autoSec.style.display = 'block';

            // Botón de presente tardío (llegó después de la toma de lista)
            const tardioBox = document.getElementById('auto-tardio-box');
            const tardioBtn = document.getElementById('btn-auto-presente-tardio');
            const tardioFeedback = document.getElementById('auto-tardio-feedback');
            if (tardioBox) {
                if (data.puedeRemarcarTardio && tardioBtn) {
                    tardioBox.style.display = 'block';
                    tardioBtn.style.display = 'block';
                    if (tardioFeedback) {
                        tardioFeedback.textContent = '';
                        tardioFeedback.className = 'feedback';
                    }
                } else if (data.autoPresenteAplicado === false && !data.esTardioAuto) {
                    tardioBox.style.display = 'block';
                    if (tardioBtn) tardioBtn.style.display = 'none';
                    let nota = '';
                    if (data.permitePresenteTardio === false) {
                        nota = 'El docente deshabilitó el presente tardío. Consultá a tu docente.';
                    } else if (data.horaLimite) {
                        nota = `El horario límite para registrarse (${data.horaLimite}) ya pasó. Consultá a tu docente.`;
                    }
                    if (tardioFeedback) {
                        tardioFeedback.textContent = nota;
                        tardioFeedback.className = 'feedback error';
                    }
                } else {
                    tardioBox.style.display = 'none';
                }
            }

            // Cargar los datos actuales del alumno y mostrar el formulario editable precargado
            try {
                const perfilRes = await fetch('/api/mi-perfil', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, curso: currentActiveCourseName })
                });
                const perfil = await perfilRes.json();
                if (perfil.success) {
                    renderAutoFormulario(perfil);
                }
            } catch (err) {
                console.error('Error al cargar el perfil del alumno en auto-presente:', err);
            }
            return true;
        } else if (data.invalidToken) {
            console.warn('Token inválido o corrupto. Limpiando almacenamiento local.');
            localStorage.removeItem('aula_inicial_token');
            localStorage.removeItem(`registered_${currentActiveCourseName}`);
            document.cookie = "aula_inicial_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            if (data.necesitaRegistro) {
                console.log('🆕 El alumno fue re-agregado sin datos: se muestra el formulario para que complete sus datos de nuevo.');
            }
        }
    } catch (err) {
        console.error('Error al verificar auto-presente:', err);
    }
    return false;
}

const AUTO_INPUT_STYLE = 'width: 100%; padding: 0.8rem 1rem; border-radius: 12px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); color: #fff; font-size: 1rem; font-family: inherit;';

// Construye la lista de campos habilitados (estándar + custom, sin importar la categoría)
// que se mostrarán en el auto-formulario editable del alumno.
function buildAutoFieldConfig() {
    if (!currentStudentFormConfig) return [];
    const std = currentStudentFormConfig.standardFields || {};

    const stdMap = {
        email: { label: 'Email Privado', type: 'email' },
        dni: { label: 'DNI / ID', type: 'text' },
        titulo: { label: 'Título Profesional / Especialidad', type: 'select' },
        tecnologia: { label: 'Relación con la Tecnología', type: 'select' },
        grupo: { label: 'Grupo', type: 'select' },
        telefono: { label: 'Teléfono', type: 'tel' }
    };

    const fields = [];
    Object.keys(stdMap).forEach(key => {
        const cfg = std[key];
        if (cfg && cfg.enabled === false) return;
        fields.push({
            id: 'std_' + key,
            key: key,
            label: (cfg && cfg.label) || stdMap[key].label,
            type: (cfg && cfg.type) || stdMap[key].type,
            options: (cfg && Array.isArray(cfg.options) && cfg.options.length > 0) ? cfg.options : [],
            required: !!(cfg && cfg.required)
        });
    });

    (currentStudentFormConfig.customFields || []).forEach(f => {
        if (f.enabled === false) return;
        fields.push({
            id: 'auto_' + f.id,
            key: f.id,
            custom: true,
            label: f.label,
            type: f.type || 'text',
            options: (f.options && Array.isArray(f.options)) ? f.options : [],
            required: !!f.required
        });
    });

    return fields;
}

// Renderiza en la vista auto el MISMO formulario que el de registro inicial, pero precargado
// con los datos actuales del alumno para que pueda verlos y modificarlos.
function renderAutoFormulario(perfil) {
    const formContainer = document.getElementById('auto-form-container');
    const container = document.getElementById('auto-fields-container');
    if (!formContainer || !container) return;

    const fields = buildAutoFieldConfig();
    if (fields.length === 0) {
        formContainer.style.display = 'none';
        return;
    }

    container.innerHTML = '';
    const datos = perfil.datos || {};
    const customValues = perfil.customValues || {};

    fields.forEach(field => {
        const fg = document.createElement('div');
        fg.className = 'form-group';

        const header = document.createElement('div');
        header.className = 'field-header';

        const label = document.createElement('label');
        label.setAttribute('for', field.id);
        label.textContent = field.label;

        const badge = document.createElement('span');
        badge.className = 'field-status-badge';

        const valor = field.custom ? customValues[field.key] : datos[field.key];
        const tieneValor = valor !== undefined && valor !== null && String(valor).trim() !== '' && String(valor).trim() !== 'NO ESPECIFICADO' && String(valor).trim() !== 'SIN DNI' && String(valor).trim() !== 'SIN GRUPO';

        if (tieneValor) {
            badge.classList.add('badge-incorporado');
            badge.textContent = '✓ Guardado';
        } else {
            badge.classList.add('badge-nuevo-dato');
            badge.textContent = '⭐ Nuevo';
        }

        header.appendChild(label);
        header.appendChild(badge);
        fg.appendChild(header);

        let input;
        if (field.type === 'select') {
            input = document.createElement('select');
            input.id = field.id;
            input.name = field.key;
            input.style.cssText = AUTO_INPUT_STYLE;

            const defOpt = document.createElement('option');
            defOpt.value = '';
            if (!valor) {
                defOpt.disabled = true;
                defOpt.selected = true;
                defOpt.textContent = `Selecciona ${field.label.toLowerCase()}...`;
            } else {
                defOpt.textContent = 'Sin completar';
            }
            input.appendChild(defOpt);

            const opciones = Array.isArray(field.options) && field.options.length > 0 ? field.options : [];
            const yaTieneValor = opciones.some(o => String(o).trim().toUpperCase() === String(valor || '').trim().toUpperCase());
            if (valor && !yaTieneValor) {
                const extra = document.createElement('option');
                extra.value = valor;
                extra.textContent = valor;
                extra.selected = true;
                input.appendChild(extra);
            }
            opciones.forEach(optVal => {
                const opt = document.createElement('option');
                opt.value = optVal;
                opt.textContent = optVal;
                if (String(optVal).trim().toUpperCase() === String(valor || '').trim().toUpperCase()) {
                    opt.selected = true;
                }
                input.appendChild(opt);
            });
        } else {
            input = document.createElement('input');
            input.type = field.type === 'number' ? 'number' : (field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text');
            input.id = field.id;
            input.name = field.key;
            input.value = valor || '';
            input.placeholder = `Ingresa ${field.label.toLowerCase()}...`;
        }

        if (tieneValor) {
            input.classList.add('input-highlight-guardado');
        } else {
            input.classList.add('input-highlight-nuevo');
        }

        if (field.required && !valor) {
            input.setAttribute('required', 'true');
            label.textContent += ' *';
        }

        fg.appendChild(input);
        container.appendChild(fg);
    });

    formContainer.style.display = 'block';

    // Completar las opciones del selector de grupo con los grupos reales del curso
    const grupoSelect = document.getElementById('std_grupo');
    if (grupoSelect) {
        cargarGruposAuto(grupoSelect);
    }
}

async function cargarGruposAuto(select) {
    if (!currentActiveCourseName) return;
    try {
        const res = await fetch(`/api/grupos?curso=${encodeURIComponent(currentActiveCourseName)}`);
        const grupos = await res.json();
        if (!Array.isArray(grupos)) return;
        const actual = select.value;
        grupos.forEach(g => {
            const existe = Array.from(select.options).some(o => o.value === g);
            if (!existe) {
                const opt = document.createElement('option');
                opt.value = g;
                opt.textContent = g;
                select.appendChild(opt);
            }
        });
        if (actual && grupos.includes(actual)) select.value = actual;
    } catch (err) {
        console.error('Error al cargar grupos para el auto-formulario', err);
    }
}

// Maneja el botón "DAR MI PRESENTE (LLEGUÉ TARDE)": marca el presente tardío del alumno.
function setupAutoPresenteTardio() {
    const btn = document.getElementById('btn-auto-presente-tardio');
    if (!btn || btn.dataset.handlerReady === 'true') return;
    btn.dataset.handlerReady = 'true';

    btn.addEventListener('click', async () => {
        const token = getSavedStudentToken();
        const feedback = document.getElementById('auto-tardio-feedback');
        const box = document.getElementById('auto-tardio-box');
        if (!token) return;

        if (feedback) {
            feedback.textContent = 'Registrando tu presente tardío...';
            feedback.className = 'feedback info';
        }
        btn.disabled = true;

        try {
            const res = await fetch('/api/mi-presente/remarcar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, curso: currentActiveCourseName })
            });
            const result = await res.json();
            if (result.success) {
                if (feedback) {
                    feedback.textContent = `✅ ¡Presente registrado con éxito! (${result.hora})`;
                    feedback.className = 'feedback success';
                }
                if (box) box.style.display = 'none';

                const autoMsg = document.getElementById('auto-presente-msg');
                if (autoMsg) {
                    autoMsg.innerHTML = '';
                    const strong = document.createElement('strong');
                    strong.textContent = 'PRESENTE';
                    autoMsg.appendChild(document.createTextNode('✅ Tu '));
                    autoMsg.appendChild(strong);
                    autoMsg.appendChild(document.createTextNode(' (llegada tardía) para la clase de hoy fue registrado.'));
                    const br = document.createElement('br');
                    autoMsg.appendChild(br);
                    const sub = document.createElement('span');
                    sub.style.cssText = 'font-size:0.85rem; font-weight: normal; opacity:0.8;';
                    sub.textContent = `(Hora de llegada: ${result.hora})`;
                    autoMsg.appendChild(sub);
                }
            } else {
                if (feedback) {
                    feedback.textContent = result.error || 'Error al registrar el presente.';
                    feedback.className = 'feedback error';
                }
            }
        } catch (err) {
            console.error('Error al registrar presente tardío:', err);
            if (feedback) {
                feedback.textContent = 'Error de conexión con el servidor.';
                feedback.className = 'feedback error';
            }
        } finally {
            btn.disabled = false;
        }
    });
}

// Maneja el envío del formulario editable: actualiza el perfil del alumno por token.
function setupAutoFormHandler() {
    const autoForm = document.getElementById('auto-form');
    if (!autoForm || autoForm.dataset.handlerReady === 'true') return;
    autoForm.dataset.handlerReady = 'true';

    autoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const feedback = document.getElementById('auto-msg-feedback');
        const btn = document.getElementById('auto-form-submit');

        const customValues = {};
        if (currentStudentFormConfig && currentStudentFormConfig.customFields) {
            currentStudentFormConfig.customFields.forEach(f => {
                if (f.enabled === false) return;
                const el = document.getElementById('auto_' + f.id);
                if (el) customValues[f.id] = el.value.trim();
            });
        }

        const leer = (id) => {
            const el = document.getElementById(id);
            return el ? el.value.trim() : '';
        };

        const body = {
            token: getSavedStudentToken(),
            curso: currentActiveCourseName,
            email: leer('std_email'),
            dni: leer('std_dni'),
            titulo: leer('std_titulo'),
            tecnologia: leer('std_tecnologia'),
            grupo: leer('std_grupo').toUpperCase(),
            telefono: leer('std_telefono'),
            customValues: customValues
        };

        if (feedback) {
            feedback.textContent = 'Guardando tus datos...';
            feedback.className = 'feedback info';
        }
        if (btn) btn.disabled = true;

        try {
            const res = await fetch('/api/mi-perfil/guardar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await res.json();
            if (feedback) {
                if (result.success) {
                    feedback.textContent = '💾 ¡Tus datos fueron guardados correctamente!';
                    feedback.className = 'feedback success';
                } else {
                    feedback.textContent = result.error || 'Error al guardar los datos.';
                    feedback.className = 'feedback error';
                }
            }
        } catch (err) {
            console.error('Error al guardar datos del alumno:', err);
            if (feedback) {
                feedback.textContent = 'Error de conexión con el servidor.';
                feedback.className = 'feedback error';
            }
        } finally {
            if (btn) btn.disabled = false;
        }
    });
}

function setupReFotoInput(token) {
    const reInput = document.getElementById('re-foto-input');
    const feedback = document.getElementById('re-foto-feedback');
    if (!reInput) return;

    reInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            if (feedback) {
                feedback.textContent = 'Procesando y subiendo foto...';
                feedback.className = 'feedback info';
            }
            const fotoData = await processImageFile(file, 300);
            const res = await fetch('/api/auto-presente', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, curso: currentActiveCourseName, fotoData })
            });
            const data = await res.json();
            if (data.success && data.fotoUrl) {
                if (feedback) {
                    feedback.textContent = '¡Foto actualizada correctamente!';
                    feedback.className = 'feedback success';
                }
                const photoImg = document.getElementById('auto-student-photo-img');
                const reUploadBox = document.getElementById('re-upload-photo-box');
                if (photoImg) {
                    photoImg.src = data.fotoUrl;
                    photoImg.style.display = 'block';
                }
                if (reUploadBox) reUploadBox.style.display = 'none';
            } else {
                if (feedback) {
                    feedback.textContent = data.error || 'Error al subir la foto.';
                    feedback.className = 'feedback error';
                }
            }
        } catch (err) {
            if (feedback) {
                feedback.textContent = 'Error al procesar la foto.';
                feedback.className = 'feedback error';
            }
        }
    };
}

async function checkActiveCourse() {
    try {
        const res = await fetch('/api/active-course');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data && data.activeCourse) {
            const cleanName = data.activeCourse.replace(/\.xlsx$/i, '').replace(/\.xls$/i, '');
            if (currentActiveCourseName !== data.activeCourse || currentAlumnos.length === 0) {
                currentActiveCourseName = data.activeCourse;
                courseTitle.textContent = `Registrándose en: ${cleanName}`;

                formSection.style.display = 'none';
                alumnoSearch.value = '';

                await loadAlumnos();
            }
        } else {
            currentActiveCourseName = '';
            courseTitle.textContent = 'Esperando a que el docente inicie el curso...';
            currentAlumnos = [];
        }
    } catch (err) {
        console.error('Error checking active course', err);
        if (!currentActiveCourseName) {
            courseTitle.textContent = '⚠️ Buscando servidor... Revisa estar conectado al Wi-Fi local';
        }
    }
    // Seguir chequeando por si el profe cambia el curso
    setTimeout(checkActiveCourse, 3000);
}

async function loadAlumnos() {
    try {
        const res = await fetch(`/api/alumnos?curso=${encodeURIComponent(currentActiveCourseName)}`);
        currentAlumnos = await res.json();
        console.log('Alumnos cargados:', currentAlumnos.length);
        showFilteredResults('');
        await loadGrupos();
    } catch (err) {
        console.error('Error loading alumnos', err);
    }
}

async function loadGrupos() {
    try {
        const res = await fetch(`/api/grupos?curso=${encodeURIComponent(currentActiveCourseName)}`);
        const grupos = await res.json();
        const select = document.getElementById('grupo');
        if (select) {
            const valorActual = select.value;
            select.innerHTML = '<option value="" disabled selected>Selecciona tu grupo...</option>';
            grupos.forEach(g => {
                const option = document.createElement('option');
                option.value = g;
                option.textContent = g;
                select.appendChild(option);
            });
            if (valorActual && grupos.includes(valorActual)) {
                select.value = valorActual;
            }
        }
    } catch (err) {
        console.error('Error loading grupos', err);
    }
}

function showFilteredResults(term) {
    if (!resultsList) return;
    resultsList.innerHTML = '';

    const filtered = term
        ? currentAlumnos.filter(a => a.nombreCompleto && a.nombreCompleto.toLowerCase().includes(term))
        : currentAlumnos;

    if (filtered.length === 0) {
        if (term) {
            resultsList.innerHTML = '<div class="result-item" style="pointer-events: none; opacity: 0.5;">No se encontraron resultados</div>';
        } else if (currentAlumnos.length === 0) {
            resultsList.innerHTML = '<div class="result-item" style="pointer-events: none; opacity: 0.5;">Cargando lista de alumnos...</div>';
        }
        return;
    }

    filtered.slice(0, 30).forEach(a => {
        const div = document.createElement('div');
        div.className = 'result-item';
        div.textContent = a.nombreCompleto;
        div.addEventListener('click', () => selectAlumno(a));
        resultsList.appendChild(div);
    });
}

alumnoSearch.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    showFilteredResults(term);
});

// Mostrar al hacer click o focus
alumnoSearch.addEventListener('focus', () => {
    const term = alumnoSearch.value.toLowerCase().trim();
    showFilteredResults(term);
});

// Cerrar lista si se hace click fuera
document.addEventListener('click', (e) => {
    if (!searchSection.contains(e.target)) {
        resultsList.innerHTML = '';
    }
});

function actualizarBadgesDeCampos(datos = {}, customValues = {}) {
    const stdFields = [
        { key: 'email', badgeId: 'badge-email', inputId: 'email' },
        { key: 'dni', badgeId: 'badge-dni', inputId: 'dni' },
        { key: 'titulo', badgeId: 'badge-titulo', inputId: 'titulo' },
        { key: 'tecnologia', badgeId: 'badge-tecnologia', inputId: 'tecnologia' },
        { key: 'grupo', badgeId: 'badge-grupo', inputId: 'grupo' },
        { key: 'telefono', badgeId: 'badge-telefono', inputId: 'telefono' }
    ];

    stdFields.forEach(f => {
        const badge = document.getElementById(f.badgeId);
        const input = document.getElementById(f.inputId);
        const val = datos[f.key];
        const tieneValor = val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== 'NO ESPECIFICADO' && String(val).trim() !== 'SIN DNI' && String(val).trim() !== 'SIN GRUPO';

        if (badge) {
            if (tieneValor) {
                badge.className = 'field-status-badge badge-incorporado';
                badge.textContent = '✓ Guardado';
            } else {
                badge.className = 'field-status-badge badge-nuevo-dato';
                badge.textContent = '⭐ Nuevo';
            }
        }
        if (input) {
            if (tieneValor) {
                input.classList.remove('input-highlight-nuevo');
                input.classList.add('input-highlight-guardado');
            } else {
                input.classList.remove('input-highlight-guardado');
                input.classList.add('input-highlight-nuevo');
            }
        }
    });

    if (currentStudentFormConfig && currentStudentFormConfig.customFields) {
        currentStudentFormConfig.customFields.forEach(cf => {
            const badge = document.getElementById(`badge-custom-${cf.id}`);
            const input = document.getElementById(cf.id);
            const val = customValues[cf.id];
            const tieneValor = val !== undefined && val !== null && String(val).trim() !== '';

            if (badge) {
                if (tieneValor) {
                    badge.className = 'field-status-badge badge-incorporado';
                    badge.textContent = '✓ Guardado';
                } else {
                    badge.className = 'field-status-badge badge-nuevo-dato';
                    badge.textContent = '⭐ Nuevo dato pedido';
                }
            }
            if (input) {
                if (tieneValor) {
                    input.classList.remove('input-highlight-nuevo');
                    input.classList.add('input-highlight-guardado');
                } else {
                    input.classList.remove('input-highlight-guardado');
                    input.classList.add('input-highlight-nuevo');
                }
            }
        });
    }
}

function cargarDatosEnFormulario(alumnoData) {
    if (!alumnoData) return;
    selectedAlumnoId = alumnoData.id;
    selectedAlumnoLabel.textContent = `Ficha de: ${alumnoData.nombreCompleto}`;
    if (alumnoSearch) alumnoSearch.value = alumnoData.nombreCompleto;

    const datos = alumnoData.datos || {};
    const customValues = alumnoData.customValues || {};
    const asist = alumnoData.asistenciaHoy || {};

    const emailEl = document.getElementById('email');
    if (emailEl) emailEl.value = datos.email || '';

    const dniEl = document.getElementById('dni');
    if (dniEl) dniEl.value = datos.dni || '';

    const telEl = document.getElementById('telefono');
    if (telEl) telEl.value = datos.telefono || '';

    const titEl = document.getElementById('titulo');
    if (titEl && datos.titulo) {
        const existe = Array.from(titEl.options).some(o => o.value.trim().toUpperCase() === datos.titulo.trim().toUpperCase());
        if (!existe && datos.titulo.trim()) {
            const opt = document.createElement('option');
            opt.value = datos.titulo.trim().toUpperCase();
            opt.textContent = datos.titulo.trim().toUpperCase();
            titEl.appendChild(opt);
        }
        titEl.value = datos.titulo.trim().toUpperCase();
    }

    const tecEl = document.getElementById('tecnologia');
    if (tecEl && datos.tecnologia) {
        const existe = Array.from(tecEl.options).some(o => o.value.trim().toUpperCase() === datos.tecnologia.trim().toUpperCase());
        if (!existe && datos.tecnologia.trim()) {
            const opt = document.createElement('option');
            opt.value = datos.tecnologia.trim().toUpperCase();
            opt.textContent = datos.tecnologia.trim().toUpperCase();
            tecEl.appendChild(opt);
        }
        tecEl.value = datos.tecnologia.trim().toUpperCase();
    }

    const grpEl = document.getElementById('grupo');
    if (grpEl && datos.grupo) {
        const existe = Array.from(grpEl.options).some(o => o.value.trim().toUpperCase() === datos.grupo.trim().toUpperCase());
        if (!existe && datos.grupo.trim()) {
            const opt = document.createElement('option');
            opt.value = datos.grupo.trim().toUpperCase();
            opt.textContent = datos.grupo.trim().toUpperCase();
            grpEl.appendChild(opt);
        }
        grpEl.value = datos.grupo.trim().toUpperCase();
    }

    if (currentStudentFormConfig && currentStudentFormConfig.customFields) {
        currentStudentFormConfig.customFields.forEach(f => {
            const inp = document.getElementById(f.id);
            if (inp) {
                const val = customValues[f.id];
                if (val !== undefined && val !== null) {
                    inp.value = val;
                }
            }
        });
    }

    if (alumnoData.fotoUrl) {
        const img = document.getElementById('foto-preview-img');
        const box = document.getElementById('foto-preview-box');
        if (img && box) {
            img.src = alumnoData.fotoUrl;
            box.style.display = 'block';
        }
        const fotoBadge = document.getElementById('badge-foto');
        if (fotoBadge) {
            fotoBadge.className = 'field-status-badge badge-incorporado';
            fotoBadge.textContent = '✓ Foto guardada';
        }
    } else {
        const fotoBadge = document.getElementById('badge-foto');
        if (fotoBadge) {
            fotoBadge.className = 'field-status-badge badge-nuevo-dato';
            fotoBadge.textContent = '⭐ Foto requerida';
        }
    }

    actualizarBadgesDeCampos(datos, customValues);

    const banner = document.getElementById('asistencia-status-banner');
    const submitBtn = document.getElementById('btn-submit-registro');
    const noteText = document.getElementById('form-attendance-note');

    if (asist.registrada) {
        if (banner) {
            banner.style.display = 'flex';
            banner.className = 'asistencia-banner asistencia-banner-success';
            banner.innerHTML = `<span>✅</span> <div><strong>Asistencia de hoy registrada:</strong> Tu presente fue asentado como <strong>${asist.estado || 'PRESENTES'}</strong> a las <strong>${asist.hora || ''}</strong>.<br><small style="opacity:0.9;">Podés verificar o actualizar tus datos y responder preguntas de clase sin duplicar tu presente.</small></div>`;
        }
        if (submitBtn) {
            submitBtn.textContent = '💾 GUARDAR CAMBIOS EN MIS DATOS';
        }
        if (noteText) {
            noteText.innerHTML = `🔒 <strong>Tu asistencia de hoy ya está asegurada (${asist.estado || 'PRESENTES'}).</strong> Al guardar, se actualizarán tus datos en la planilla sin duplicar el presente.`;
        }
    } else {
        if (banner) {
            banner.style.display = 'flex';
            banner.className = 'asistencia-banner asistencia-banner-pending';
            banner.innerHTML = `<span>📝</span> <div><strong>Asistencia del día pendiente:</strong> Revisa o completa tus datos y envía el formulario para registrar tu presente hoy.</div>`;
        }
        if (submitBtn) {
            submitBtn.textContent = '✅ DAR MI PRESENTE Y GUARDAR DATOS';
        }
        if (noteText) {
            noteText.innerHTML = `📌 <strong>Al enviar este formulario se registrará automáticamente tu estado de PRESENTE para la clase de hoy.</strong>`;
        }
    }

    formSection.style.display = 'block';
}

async function selectAlumno(alumno) {
    selectedAlumnoId = alumno.id;
    selectedAlumnoLabel.textContent = `Cargando datos para: ${alumno.nombreCompleto}...`;
    alumnoSearch.value = alumno.nombreCompleto;
    resultsList.innerHTML = '';
    formSection.style.display = 'block';
    formSection.scrollIntoView({ behavior: 'smooth' });
    showFeedback('Verificando datos guardados en la planilla...', 'info');

    try {
        const token = getSavedStudentToken();
        const res = await fetch('/api/alumno/mi-ficha', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                curso: currentActiveCourseName,
                alumnoId: alumno.id,
                nombreCompleto: alumno.nombreCompleto,
                token
            })
        });
        const data = await res.json();
        if (data.success && data.alumno) {
            cargarDatosEnFormulario(data.alumno);
            showFeedback('', '');
        } else {
            showFeedback('Listo. Completa tus datos a continuación.', 'info');
        }
    } catch (err) {
        console.error('Error al consultar ficha del alumno:', err);
        showFeedback('Listo. Completa tus datos a continuación.', 'info');
    }
}

registroForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const isDemo = new URLSearchParams(window.location.search).get('demo') === 'true';

    const customValues = {};
    if (currentStudentFormConfig && currentStudentFormConfig.customFields) {
        currentStudentFormConfig.customFields.forEach(field => {
            if (field.enabled !== false) {
                const inputEl = document.getElementById(field.id);
                if (inputEl) {
                    customValues[field.id] = inputEl.value.trim();
                }
            }
        });
    }

    const data = {
        curso: currentActiveCourseName,
        alumnoId: selectedAlumnoId,
        email: document.getElementById('email')?.value?.trim() || '',
        dni: document.getElementById('dni')?.value?.trim() || '',
        titulo: document.getElementById('titulo')?.value?.trim() || '',
        tecnologia: document.getElementById('tecnologia')?.value?.trim() || '',
        grupo: document.getElementById('grupo')?.value?.trim()?.toUpperCase() || '',
        telefono: document.getElementById('telefono')?.value?.trim() || '',
        customValues: customValues,
        fotoData: currentSelectedFotoData,
        demo: isDemo
    };

    const submitBtn = document.getElementById('btn-submit-registro');
    if (submitBtn) submitBtn.disabled = true;
    showFeedback('Guardando datos y verificando asistencia...', 'info');

    try {
        const res = await fetch('/api/registro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await res.json();
        if (result.success) {
            if (result.token) {
                saveStudentToken(result.token);
            }

            if (!isDemo) {
                localStorage.setItem(`registered_${currentActiveCourseName}`, 'true');
            }

            if (result.yaTeniaPresente) {
                showFeedback(`💾 ¡Tus datos fueron actualizados con éxito! Tu presente de hoy se mantiene registrado (${result.estadoAsistencia || 'PRESENTE'} a las ${result.horaRegistro || ''}).`, 'success');
            } else {
                showFeedback(`✅ ¡Presente registrado (${result.estadoAsistencia || 'PRESENTE'} a las ${result.horaRegistro || ''}) y datos guardados con éxito!`, 'success');
            }

            // Actualizar en caliente la ficha del alumno en el formulario
            try {
                const fichaRes = await fetch('/api/alumno/mi-ficha', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        curso: currentActiveCourseName,
                        alumnoId: selectedAlumnoId,
                        token: result.token || getSavedStudentToken()
                    })
                });
                const fichaData = await fichaRes.json();
                if (fichaData.success && fichaData.alumno) {
                    cargarDatosEnFormulario(fichaData.alumno);
                }
            } catch (errRecarga) {
                console.warn('Error al refrescar ficha post-envío:', errRecarga);
            }
        } else {
            showFeedback(result.error || 'Error al guardar datos. Intenta de nuevo.', 'error');
        }
    } catch (err) {
        showFeedback('Error de conexión con el servidor.', 'error');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
});

function showFeedback(msg, type) {
    feedbackMsg.textContent = msg;
    feedbackMsg.className = `feedback ${type}`;
}


document.getElementById('grupo').addEventListener('focus', () => {
    loadGrupos();
});

const btnPublicGrupos = document.getElementById('btn-public-grupos');
const publicGruposModal = document.getElementById('public-grupos-modal');
const closePublicGruposModal = document.getElementById('close-public-grupos-modal');
const publicGruposContainer = document.getElementById('public-grupos-container');

if (btnPublicGrupos) {
    btnPublicGrupos.addEventListener('click', () => {
        publicGruposModal.style.display = 'flex';
        loadPublicGrupos();
    });
}

if (closePublicGruposModal) {
    closePublicGruposModal.addEventListener('click', () => {
        publicGruposModal.style.display = 'none';
    });
}

// Event listener para captura y vista previa de foto real del rostro
const fotoInputEl = document.getElementById('foto-input');
if (fotoInputEl) {
    fotoInputEl.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            currentSelectedFotoData = await processImageFile(file, 300);
            const box = document.getElementById('foto-preview-box');
            const img = document.getElementById('foto-preview-img');
            if (box && img) {
                img.src = currentSelectedFotoData;
                box.style.display = 'block';
            }
        } catch (err) {
            console.error('Error al procesar foto:', err);
            alert('Error al procesar la foto seleccionada. Por favor intenta de nuevo.');
        }
    });
}

window.addEventListener('click', (e) => {
    if (e.target === publicGruposModal) {
        publicGruposModal.style.display = 'none';
    }
});

async function loadPublicGrupos() {
    try {
        if (!currentActiveCourseName) {
            publicGruposContainer.innerHTML = '<p style="opacity:0.5; grid-column:1/-1;">No hay un curso activo cargado.</p>';
            return;
        }

        const res = await fetch(`/api/grupos-miembros?curso=${encodeURIComponent(currentActiveCourseName)}&t=${Date.now()}`);
        const gruposData = await res.json();

        publicGruposContainer.innerHTML = '';

        const gruposKeys = Object.keys(gruposData).sort();

        if (gruposKeys.length === 0) {
            publicGruposContainer.innerHTML = '<p style="opacity:0.5; grid-column:1/-1;">Aún no se han registrado grupos para este curso.</p>';
            return;
        }

        gruposKeys.forEach(grupoName => {
            const miembros = gruposData[grupoName];
            
            const card = document.createElement('div');
            card.style.background = 'rgba(255,255,255,0.05)';
            card.style.border = '1px solid rgba(255,255,255,0.15)';
            card.style.borderRadius = '1rem';
            card.style.padding = '1.2rem';

            const title = document.createElement('h3');
            title.style.margin = '0 0 0.8rem 0';
            title.style.color = '#4ade80';
            title.style.fontSize = '1.1rem';
            title.textContent = `Grupo: ${grupoName} (${miembros.length})`;

            const ul = document.createElement('ul');
            ul.style.listStyle = 'none';
            ul.style.padding = '0';
            ul.style.margin = '0';
            ul.style.display = 'flex';
            ul.style.flexDirection = 'column';
            ul.style.gap = '0.4rem';

            miembros.forEach(m => {
                const li = document.createElement('li');
                li.style.fontSize = '0.9rem';
                li.style.borderBottom = '1px dashed rgba(255,255,255,0.1)';
                li.style.paddingBottom = '0.3rem';

                const strong = document.createElement('strong');
                strong.textContent = m.nombreCompleto || '';
                li.appendChild(strong);
                li.appendChild(document.createTextNode(' '));
                const span = document.createElement('span');
                span.style.cssText = 'opacity:0.6; font-size:0.8rem;';
                span.textContent = `(${m.titulo || ''})`;
                li.appendChild(span);
                ul.appendChild(li);
            });

            card.appendChild(title);
            card.appendChild(ul);
            publicGruposContainer.appendChild(card);
        });
    } catch (err) {
        console.error('Error cargando grupos públicos', err);
    }
}

initStudent();
