import './styles/main.css';

interface AlumnoPublico {
  id: string;
  nombreCompleto: string;
}

interface StandardFieldConfig {
  enabled?: boolean;
  required?: boolean;
  label?: string;
  type?: string;
  options?: string[];
}

interface CustomFieldConfig {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select';
  required?: boolean;
  enabled?: boolean;
  options?: string[];
}

interface FormConfig {
  standardFields: Record<string, StandardFieldConfig>;
  customFields: CustomFieldConfig[];
}

interface AutoPresenteData {
  success: boolean;
  autoPresente: boolean;
  token?: string;
  alumnoId?: string;
  nombreAlumno?: string;
  esTardioAuto?: boolean;
  autoPresenteAplicado?: boolean;
  estadoHoy?: string;
  fechaRegistro?: string;
  fotoUrl?: string;
  requiereFoto?: boolean;
  puedeRemarcarTardio?: boolean;
  permitePresenteTardio?: boolean;
  horaLimite?: string;
  invalidToken?: boolean;
  necesitaRegistro?: boolean;
  hora?: string;
  error?: string;
}

interface PerfilData {
  success: boolean;
  datos: Record<string, string>;
  customValues: Record<string, string>;
}

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function val(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  return el ? el.value.trim() : '';
}

let currentAlumnos: AlumnoPublico[] = [];
let selectedAlumnoId: string | null = null;
let currentActiveCourseName = '';
let currentStudentFormConfig: FormConfig | null = null;
let currentAutoAlumnoId: string | null = null;
let currentSelectedFotoData: string | null = null;

const AUTO_INPUT_STYLE = 'width: 100%; padding: 0.85rem 1rem; border-radius: 12px; background: #030712; border: 1.5px solid #475569; color: #ffffff; font-size: 1rem; font-family: inherit; font-weight: 600;';

function isDemo(): boolean {
  return new URLSearchParams(window.location.search).get('demo') === 'true';
}

function processImageFile(file: File, maxWidth = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Archivo no es una imagen válida'));
      return;
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
        if (!ctx) {
          reject(new Error('Canvas no disponible'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Error al decodificar la imagen'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()!.split(';').shift()!;
  return null;
}

function getSavedStudentToken(): string | null {
  return localStorage.getItem('aula_inicial_token') || getCookie('aula_inicial_token');
}

function saveStudentToken(token: string): void {
  if (!token) return;
  localStorage.setItem('aula_inicial_token', token);
  document.cookie = `aula_inicial_token=${token}; path=/; max-age=31536000; SameSite=Lax`;
}

function clearStudentToken(): void {
  localStorage.removeItem('aula_inicial_token');
  localStorage.removeItem(`registered_${currentActiveCourseName}`);
  document.cookie = 'aula_inicial_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
}

function showFeedback(el: HTMLElement | null, msg: string, type: 'success' | 'error' | 'info'): void {
  if (!el) return;
  el.textContent = msg;
  el.className = `feedback ${type}`;
}

async function loadStudentFormConfig(): Promise<void> {
  try {
    const res = await fetch('/api/form-config');
    currentStudentFormConfig = await res.json();
    applyStudentFormConfig();
  } catch (err) {
    console.error('Error al cargar la configuración del formulario', err);
  }
}

function applyStudentFormConfig(): void {
  if (!currentStudentFormConfig) return;
  const std = currentStudentFormConfig.standardFields || {};

  const fieldMap: Record<string, { fg: string; input: string }> = {
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
    const input = document.getElementById(fieldMap[key].input) as HTMLInputElement | null;

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

  poblarSelector('titulo', std.titulo, 'Selecciona tu Título / Especialidad...');
  poblarSelector('tecnologia', std.tecnologia, 'Selecciona tu Relación con la Tecnología...');

  const customContainer = $('custom-fields-student-container');
  if (!customContainer) return;
  customContainer.innerHTML = '';

  (currentStudentFormConfig.customFields || []).forEach(field => {
    if (field.enabled === false) return;

    const fg = document.createElement('div');
    fg.className = 'form-group';

    const label = document.createElement('label');
    label.setAttribute('for', field.id);
    label.textContent = field.label + (field.required ? ' *' : '');

    let input: HTMLInputElement | HTMLSelectElement | HTMLElement;
    if (field.type === 'multiselect') {
      const multiselectBox = document.createElement('div');
      multiselectBox.id = field.id;
      multiselectBox.className = 'custom-multiselect-container';
      multiselectBox.style.cssText = 'display: flex; flex-direction: column; gap: 0.5rem; width: 100%; padding: 0.85rem 1rem; border-radius: 12px; background: #030712; border: 1.5px solid #475569; color: #ffffff;';

      (field.options || []).forEach(optVal => {
        const optLabel = document.createElement('label');
        optLabel.style.cssText = 'display: flex; align-items: center; gap: 0.75rem; cursor: pointer; padding: 0.5rem 0.6rem; border-radius: 8px; font-size: 0.95rem; user-select: none; transition: background 0.15s ease, border-color 0.15s ease; border: 1px solid transparent; color: #ffffff;';

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.name = `${field.id}[]`;
        chk.value = optVal;
        chk.style.cssText = 'width: 18px; height: 18px; accent-color: #6366f1; cursor: pointer; flex-shrink: 0;';

        const span = document.createElement('span');
        span.textContent = optVal;
        span.style.cssText = 'color: #ffffff; line-height: 1.3; font-weight: 500;';

        chk.addEventListener('change', () => {
          if (chk.checked) {
            optLabel.style.background = 'rgba(99, 102, 241, 0.25)';
            optLabel.style.borderColor = '#6366f1';
          } else {
            optLabel.style.background = 'transparent';
            optLabel.style.borderColor = 'transparent';
          }
        });

        optLabel.appendChild(chk);
        optLabel.appendChild(span);
        multiselectBox.appendChild(optLabel);
      });
      input = multiselectBox;
    } else if (field.type === 'select') {
      input = document.createElement('select');
      input.id = field.id;
      input.style.cssText = AUTO_INPUT_STYLE;

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

    if (field.required && field.type !== 'multiselect') input.setAttribute('required', 'true');

    fg.appendChild(label);
    fg.appendChild(input);
    customContainer.appendChild(fg);
  });
}

function poblarSelector(id: string, config: StandardFieldConfig | undefined, placeholder: string): void {
  const input = document.getElementById(id) as HTMLSelectElement | null;
  if (!input || !config || !Array.isArray(config.options) || config.options.length === 0) return;
  const currentVal = input.value;
  input.innerHTML = `<option value="" disabled selected>${placeholder}</option>`;
  config.options.forEach(optVal => {
    const opt = document.createElement('option');
    opt.value = optVal;
    opt.textContent = optVal;
    if (optVal === currentVal) opt.selected = true;
    input.appendChild(opt);
  });
}

async function checkRegistrationStatus(): Promise<void> {
  try {
    if (isDemo()) return;
    const res = await fetch('/api/check-registration');
    const data = await res.json();
    const localRegistered = localStorage.getItem(`registered_${currentActiveCourseName}`);

    if (data.registered || localRegistered) {
      const searchSection = $('search-section');
      const formSection = $('form-section');
      const registeredSection = $('registered-section');
      if (searchSection) searchSection.style.display = 'none';
      if (formSection) formSection.style.display = 'none';
      if (registeredSection) registeredSection.style.display = 'block';
    }
  } catch (err) {
    console.error('Error checking registration status', err);
  }
}

function renderAutoMensaje(data: AutoPresenteData): void {
  const autoMsg = $('auto-presente-msg');
  if (!autoMsg) return;

  const strong = document.createElement('strong');
  let msg = '';
  if (data.esTardioAuto) {
    strong.textContent = 'PRESENTE';
    msg = '✅ Tu (llegada tardía) para la clase de hoy ya fue registrado.';
  } else if (data.autoPresenteAplicado === false) {
    strong.textContent = data.estadoHoy || 'AUSENTE';
    msg = '⚠️ Tu estado de hoy fue registrado por el docente como . Si ya llegaste, podés marcarte como presente.';
  } else {
    strong.textContent = 'PRESENTE';
    msg = '✅ Tu para la clase de hoy ha sido registrado automáticamente.';
  }
  autoMsg.innerHTML = '';
  autoMsg.appendChild(document.createTextNode(msg));
  autoMsg.insertBefore(strong, autoMsg.childNodes[1]);

  const fechaSpan = document.createElement('br');
  autoMsg.appendChild(fechaSpan);
  const sub = document.createElement('span');
  sub.style.cssText = 'font-size:0.85rem; font-weight: normal; opacity:0.8;';
  sub.textContent = `(Fecha: ${data.fechaRegistro || 'hoy'})`;
  autoMsg.appendChild(sub);
}

function mostrarAutoSeccion(data: AutoPresenteData): void {
  const searchSection = $('search-section');
  const formSection = $('form-section');
  const registeredSection = $('registered-section');
  const autoSec = $('auto-registered-section');
  if (searchSection) searchSection.style.display = 'none';
  if (formSection) formSection.style.display = 'none';
  if (registeredSection) registeredSection.style.display = 'none';

  const welcomeTitle = $('auto-welcome-title');
  const photoImg = $('auto-student-photo-img') as HTMLImageElement | null;
  const reUploadBox = $('re-upload-photo-box');

  if (welcomeTitle) welcomeTitle.textContent = `¡Hola ${data.nombreAlumno}!`;
  renderAutoMensaje(data);

  if (data.fotoUrl && photoImg) {
    photoImg.src = data.fotoUrl;
    photoImg.style.display = 'block';
  } else if (photoImg) {
    photoImg.style.display = 'none';
  }

  if (data.requiereFoto && reUploadBox) {
    reUploadBox.style.display = 'block';
    setupReFotoInput(data.token || getSavedStudentToken() || '');
  } else if (reUploadBox) {
    reUploadBox.style.display = 'none';
  }

  if (autoSec) autoSec.style.display = 'block';

  const tardioBox = $('auto-tardio-box');
  const tardioBtn = $('btn-auto-presente-tardio') as HTMLButtonElement | null;
  const tardioFeedback = $('auto-tardio-feedback');
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
      showFeedback(tardioFeedback, nota, 'error');
    } else {
      tardioBox.style.display = 'none';
    }
  }
}

async function checkAutoPresente(): Promise<boolean> {
  if (isDemo()) return false;

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
    const data: AutoPresenteData = await res.json();

    if (data.success && data.autoPresente) {
      if (data.token) saveStudentToken(data.token);
      currentAutoAlumnoId = data.alumnoId || null;
      mostrarAutoSeccion(data);

      try {
        const perfilRes = await fetch('/api/mi-perfil', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: data.token || token, curso: currentActiveCourseName })
        });
        const perfil = await perfilRes.json();
        if (perfil.success) {
          renderAutoFormulario(perfil as PerfilData);
        }
      } catch (err) {
        console.error('Error al cargar el perfil del alumno en auto-presente:', err);
      }
      return true;
    } else if (data.invalidToken) {
      console.warn('Token inválido o corrupto. Limpiando almacenamiento local.');
      clearStudentToken();
      if (data.necesitaRegistro) {
        console.warn('El alumno fue re-agregado sin datos: se muestra el formulario para que complete sus datos de nuevo.');
      }
    }
  } catch (err) {
    console.error('Error al verificar auto-presente:', err);
  }
  return false;
}

interface AutoFieldConfig {
  id: string;
  key: string;
  label: string;
  type: string;
  options: string[];
  required: boolean;
  custom?: boolean;
}

function buildAutoFieldConfig(): AutoFieldConfig[] {
  if (!currentStudentFormConfig) return [];
  const std = currentStudentFormConfig.standardFields || {};

  const stdMap: Record<string, { label: string; type: string }> = {
    email: { label: 'Email Privado', type: 'email' },
    dni: { label: 'DNI / ID', type: 'text' },
    titulo: { label: 'Título Profesional / Especialidad', type: 'select' },
    tecnologia: { label: 'Relación con la Tecnología', type: 'select' },
    grupo: { label: 'Grupo', type: 'select' },
    telefono: { label: 'Teléfono', type: 'tel' }
  };

  const fields: AutoFieldConfig[] = [];
  Object.keys(stdMap).forEach(key => {
    const cfg = std[key];
    if (cfg && cfg.enabled === false) return;
    fields.push({
      id: 'std_' + key,
      key,
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

function renderAutoFormulario(perfil: PerfilData): void {
  const formContainer = $('auto-form-container');
  const container = $('auto-fields-container');
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

    const label = document.createElement('label');
    label.setAttribute('for', field.id);
    label.textContent = field.label;

    const valor = field.custom ? customValues[field.key] || '' : datos[field.key] || '';

    let input: HTMLInputElement | HTMLSelectElement | HTMLElement;
    if (field.type === 'multiselect') {
      const multiselectBox = document.createElement('div');
      multiselectBox.id = field.id;
      multiselectBox.className = 'custom-multiselect-container';
      multiselectBox.style.cssText = 'display: flex; flex-direction: column; gap: 0.5rem; width: 100%; padding: 0.85rem 1rem; border-radius: 12px; background: #030712; border: 1.5px solid #475569; color: #ffffff;';

      const valorParts = valor ? String(valor).split(/[,;]/).map(s => s.trim().toLowerCase()) : [];

      (field.options || []).forEach(optVal => {
        const optLabel = document.createElement('label');
        const isChecked = valorParts.includes(String(optVal).trim().toLowerCase());
        optLabel.style.cssText = `display: flex; align-items: center; gap: 0.75rem; cursor: pointer; padding: 0.5rem 0.6rem; border-radius: 8px; font-size: 0.95rem; user-select: none; transition: background 0.15s ease, border-color 0.15s ease; border: 1.5px solid ${isChecked ? '#6366f1' : 'transparent'}; background: ${isChecked ? 'rgba(99, 102, 241, 0.25)' : 'transparent'}; color: #ffffff;`;

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.name = `${field.id}[]`;
        chk.value = optVal;
        chk.checked = isChecked;
        chk.style.cssText = 'width: 18px; height: 18px; accent-color: #6366f1; cursor: pointer; flex-shrink: 0;';

        chk.addEventListener('change', () => {
          if (chk.checked) {
            optLabel.style.background = 'rgba(99, 102, 241, 0.25)';
            optLabel.style.borderColor = '#6366f1';
          } else {
            optLabel.style.background = 'transparent';
            optLabel.style.borderColor = 'transparent';
          }
        });

        const txt = document.createElement('span');
        txt.textContent = optVal;
        txt.style.cssText = 'color: #ffffff; line-height: 1.3; font-weight: 500;';

        optLabel.appendChild(chk);
        optLabel.appendChild(txt);
        multiselectBox.appendChild(optLabel);
      });
      input = multiselectBox;
    } else if (field.type === 'select') {
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

      const opciones = field.options;
      const yaTieneValor = opciones.some(o => String(o).trim().toUpperCase() === String(valor).trim().toUpperCase());
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
        if (String(optVal).trim().toUpperCase() === String(valor).trim().toUpperCase()) {
          opt.selected = true;
        }
        input.appendChild(opt);
      });
    } else {
      input = document.createElement('input');
      input.type = field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text';
      input.id = field.id;
      input.name = field.key;
      input.value = valor;
      input.placeholder = `Ingresa ${field.label.toLowerCase()}...`;
    }

    if (field.required && !valor && field.type !== 'multiselect') {
      input.setAttribute('required', 'true');
      label.textContent += ' *';
    }

    fg.appendChild(label);
    fg.appendChild(input);
    container.appendChild(fg);
  });

  formContainer.style.display = 'block';

  const grupoSelect = $('std_grupo') as HTMLSelectElement | null;
  if (grupoSelect) {
    cargarGruposAuto(grupoSelect);
  }
}

async function cargarGruposAuto(select: HTMLSelectElement): Promise<void> {
  if (!currentActiveCourseName) return;
  try {
    const res = await fetch(`/api/grupos?curso=${encodeURIComponent(currentActiveCourseName)}`);
    const grupos = await res.json();
    if (!Array.isArray(grupos)) return;
    const actual = select.value;
    grupos.forEach((g: string) => {
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

function setupAutoPresenteTardio(): void {
  const btn = $('btn-auto-presente-tardio') as HTMLButtonElement | null;
  if (!btn || btn.dataset.handlerReady === 'true') return;
  btn.dataset.handlerReady = 'true';

  btn.addEventListener('click', async () => {
    const token = getSavedStudentToken();
    const feedback = $('auto-tardio-feedback');
    const box = $('auto-tardio-box');
    if (!token) return;

    showFeedback(feedback, 'Registrando tu presente tardío...', 'info');
    btn.disabled = true;

    try {
      const res = await fetch('/api/mi-presente/remarcar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, curso: currentActiveCourseName })
      });
      const result = await res.json();
      if (result.success) {
        showFeedback(feedback, `✅ ¡Presente registrado con éxito! (${result.hora})`, 'success');
        if (box) box.style.display = 'none';

        const autoMsg = $('auto-presente-msg');
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
        showFeedback(feedback, result.error || 'Error al registrar el presente.', 'error');
      }
    } catch (err) {
      console.error('Error al registrar presente tardío:', err);
      showFeedback(feedback, 'Error de conexión con el servidor.', 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

function setupAutoFormHandler(): void {
  const autoForm = $('auto-form') as HTMLFormElement | null;
  if (!autoForm || autoForm.dataset.handlerReady === 'true') return;
  autoForm.dataset.handlerReady = 'true';

  autoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const feedback = $('auto-msg-feedback');
    const btn = $('auto-form-submit') as HTMLButtonElement | null;

    const customValues: Record<string, string> = {};
    if (currentStudentFormConfig && currentStudentFormConfig.customFields) {
      currentStudentFormConfig.customFields.forEach(f => {
        if (f.enabled === false) return;
        if (f.type === 'multiselect') {
          const checked = Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="auto_${f.id}[]"]:checked`)).map(c => c.value.trim()).filter(Boolean);
          customValues[f.id] = checked.join(', ');
        } else {
          const el = document.getElementById('auto_' + f.id) as HTMLInputElement | HTMLSelectElement | null;
          if (el) customValues[f.id] = el.value.trim();
        }
      });
    }

    const body = {
      token: getSavedStudentToken(),
      curso: currentActiveCourseName,
      email: val('std_email'),
      dni: val('std_dni'),
      titulo: val('std_titulo'),
      tecnologia: val('std_tecnologia'),
      grupo: val('std_grupo').toUpperCase(),
      telefono: val('std_telefono'),
      customValues
    };

    showFeedback(feedback, 'Guardando tus datos...', 'info');
    if (btn) btn.disabled = true;

    try {
      const res = await fetch('/api/mi-perfil/guardar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await res.json();
      if (result.success) {
        showFeedback(feedback, '💾 ¡Tus datos fueron guardados correctamente!', 'success');
      } else {
        showFeedback(feedback, result.error || 'Error al guardar los datos.', 'error');
      }
    } catch (err) {
      console.error('Error al guardar datos del alumno:', err);
      showFeedback(feedback, 'Error de conexión con el servidor.', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

function setupReFotoInput(token: string): void {
  const reInput = $('re-foto-input') as HTMLInputElement | null;
  const feedback = $('re-foto-feedback');
  if (!reInput) return;

  reInput.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      showFeedback(feedback, 'Procesando y subiendo foto...', 'info');
      const fotoData = await processImageFile(file, 300);
      const res = await fetch('/api/auto-presente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, curso: currentActiveCourseName, fotoData })
      });
      const data: AutoPresenteData = await res.json();
      if (data.success && data.fotoUrl) {
        showFeedback(feedback, '¡Foto actualizada correctamente!', 'success');
        const photoImg = $('auto-student-photo-img') as HTMLImageElement | null;
        const reUploadBox = $('re-upload-photo-box');
        if (photoImg) {
          photoImg.src = data.fotoUrl;
          photoImg.style.display = 'block';
        }
        if (reUploadBox) reUploadBox.style.display = 'none';
      } else {
        showFeedback(feedback, data.error || 'Error al subir la foto.', 'error');
      }
    } catch (err) {
      console.error('Error al subir foto:', err);
      showFeedback(feedback, 'Error al procesar la foto.', 'error');
    }
  };
}

async function checkActiveCourse(): Promise<void> {
  try {
    const res = await fetch('/api/active-course');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const courseTitle = $('course-title');
    const formSection = $('form-section');

    if (data && data.activeCourse) {
      const cleanName = data.activeCourse.replace(/\.xlsx$/i, '').replace(/\.xls$/i, '');
      if (currentActiveCourseName !== data.activeCourse || currentAlumnos.length === 0) {
        currentActiveCourseName = data.activeCourse;
        if (courseTitle) courseTitle.textContent = `Registrándose en: ${cleanName}`;

        if (formSection) formSection.style.display = 'none';
        const search = $('alumno-search') as HTMLInputElement | null;
        if (search) search.value = '';

        await loadAlumnos();
      }
    } else {
      currentActiveCourseName = '';
      if (courseTitle) courseTitle.textContent = 'Esperando a que el docente inicie el curso...';
      currentAlumnos = [];
    }
  } catch (err) {
    console.error('Error checking active course', err);
    if (!currentActiveCourseName) {
      const courseTitle = $('course-title');
      if (courseTitle) courseTitle.textContent = '⚠️ Buscando servidor... Revisa estar conectado al Wi-Fi local';
    }
  }
  setTimeout(checkActiveCourse, 3000);
}

async function loadAlumnos(): Promise<void> {
  try {
    const res = await fetch(`/api/alumnos?curso=${encodeURIComponent(currentActiveCourseName)}`);
    currentAlumnos = await res.json();
    showFilteredResults('');
    await loadGrupos();
  } catch (err) {
    console.error('Error loading alumnos', err);
  }
}

async function loadGrupos(): Promise<void> {
  try {
    const res = await fetch(`/api/grupos?curso=${encodeURIComponent(currentActiveCourseName)}`);
    const grupos = await res.json();
    const select = $('grupo') as HTMLSelectElement | null;
    if (select) {
      const valorActual = select.value;
      select.innerHTML = '<option value="" disabled selected>Selecciona tu grupo...</option>';
      grupos.forEach((g: string) => {
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

function showFilteredResults(term: string): void {
  const resultsList = $('results-list');
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

function selectAlumno(alumno: AlumnoPublico): void {
  selectedAlumnoId = alumno.id;
  const label = $('selected-alumno-name');
  const search = $('alumno-search') as HTMLInputElement | null;
  const formSection = $('form-section');
  const resultsList = $('results-list');
  if (label) label.textContent = `Datos para: ${alumno.nombreCompleto}`;
  if (search) search.value = alumno.nombreCompleto;
  if (resultsList) resultsList.innerHTML = '';
  if (formSection) {
    formSection.style.display = 'block';
    formSection.scrollIntoView({ behavior: 'smooth' });
  }
}

function setupRegistroForm(): void {
  const registroForm = $('registro-form') as HTMLFormElement | null;
  if (!registroForm) return;

  registroForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const customValues: Record<string, string> = {};
    if (currentStudentFormConfig && currentStudentFormConfig.customFields) {
      for (const field of currentStudentFormConfig.customFields) {
        if (field.enabled !== false) {
          if (field.type === 'multiselect') {
            const checked = Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="${field.id}[]"]:checked`)).map(c => c.value.trim()).filter(Boolean);
            const joined = checked.join(', ');
            if (field.required && !joined) {
              alert(`Por favor selecciona al menos una opción para "${field.label}".`);
              return;
            }
            customValues[field.id] = joined;
          } else {
            const inputEl = document.getElementById(field.id) as HTMLInputElement | HTMLSelectElement | null;
            if (inputEl) customValues[field.id] = inputEl.value.trim();
          }
        }
      }
    }

    const data = {
      curso: currentActiveCourseName,
      alumnoId: selectedAlumnoId,
      email: val('email'),
      dni: val('dni'),
      titulo: val('titulo'),
      tecnologia: val('tecnologia'),
      grupo: val('grupo').toUpperCase(),
      telefono: val('telefono'),
      customValues,
      fotoData: currentSelectedFotoData,
      demo: isDemo()
    };

    const feedback = $('msg-feedback');
    try {
      const res = await fetch('/api/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await res.json();
      if (result.success) {
        if (result.token) saveStudentToken(result.token);

        if (!isDemo()) {
          localStorage.setItem(`registered_${currentActiveCourseName}`, 'true');
        }

        showFeedback(feedback, isDemo() ? '¡DEMO COMPLETADA! No se guardaron datos.' : '¡Registro completado con éxito! Gracias.', 'success');
        registroForm.reset();
        setTimeout(() => {
          location.reload();
        }, 2000);
      } else {
        showFeedback(feedback, result.error || 'Error al guardar datos. Intenta de nuevo.', 'error');
      }
    } catch (err) {
      showFeedback(feedback, 'Error de conexión con el servidor.', 'error');
    }
  });
}

function setupBusqueda(): void {
  const searchInput = $('alumno-search') as HTMLInputElement | null;
  const searchSection = $('search-section');
  const resultsList = $('results-list');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = (e.target as HTMLInputElement).value.toLowerCase().trim();
      showFilteredResults(term);
    });
    searchInput.addEventListener('focus', () => {
      const term = searchInput.value.toLowerCase().trim();
      showFilteredResults(term);
    });
  }

  document.addEventListener('click', (e) => {
    if (searchSection && !searchSection.contains(e.target as Node) && resultsList) {
      resultsList.innerHTML = '';
    }
  });
}

function setupFotoPreview(): void {
  const fotoInput = $('foto-input') as HTMLInputElement | null;
  if (!fotoInput) return;

  fotoInput.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      currentSelectedFotoData = await processImageFile(file, 300);
      const box = $('foto-preview-box');
      const img = $('foto-preview-img') as HTMLImageElement | null;
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

function setupPublicGrupos(): void {
  const btn = $('btn-public-grupos');
  const modal = $('public-grupos-modal');
  const closeBtn = $('close-public-grupos-modal');
  const container = $('public-grupos-container');

  if (btn && modal) {
    btn.addEventListener('click', () => {
      modal.style.display = 'flex';
      loadPublicGrupos();
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  window.addEventListener('click', (e) => {
    if (modal && e.target === modal) modal.style.display = 'none';
  });

  void container;
}

async function loadPublicGrupos(): Promise<void> {
  const container = $('public-grupos-container');
  if (!container) return;
  try {
    if (!currentActiveCourseName) {
      container.innerHTML = '<p style="opacity:0.5; grid-column:1/-1;">No hay un curso activo cargado.</p>';
      return;
    }

    const res = await fetch(`/api/grupos-miembros?curso=${encodeURIComponent(currentActiveCourseName)}&t=${Date.now()}`);
    const gruposData = await res.json();

    container.innerHTML = '';
    const gruposKeys = Object.keys(gruposData).sort();

    if (gruposKeys.length === 0) {
      container.innerHTML = '<p style="opacity:0.5; grid-column:1/-1;">Aún no se han registrado grupos para este curso.</p>';
      return;
    }

    gruposKeys.forEach(grupoName => {
      const miembros = gruposData[grupoName];

      const card = document.createElement('div');
      card.style.background = '#1e293b';
      card.style.border = '1.5px solid rgba(255,255,255,0.22)';
      card.style.borderRadius = '1rem';
      card.style.padding = '1.2rem';
      card.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)';

      const title = document.createElement('h3');
      title.style.margin = '0 0 0.8rem 0';
      title.style.color = '#4ade80';
      title.style.fontSize = '1.15rem';
      title.style.fontWeight = '700';
      title.textContent = `Grupo: ${grupoName} (${miembros.length})`;

      const ul = document.createElement('ul');
      ul.style.listStyle = 'none';
      ul.style.padding = '0';
      ul.style.margin = '0';
      ul.style.display = 'flex';
      ul.style.flexDirection = 'column';
      ul.style.gap = '0.45rem';

      miembros.forEach((m: { nombreCompleto?: string; titulo?: string }) => {
        const li = document.createElement('li');
        li.style.fontSize = '0.95rem';
        li.style.color = '#ffffff';
        li.style.borderBottom = '1px dashed rgba(255,255,255,0.2)';
        li.style.paddingBottom = '0.35rem';

        const strong = document.createElement('strong');
        strong.style.color = '#ffffff';
        strong.textContent = m.nombreCompleto || '';
        li.appendChild(strong);
        li.appendChild(document.createTextNode(' '));
        const span = document.createElement('span');
        span.style.cssText = 'color: #cbd5e1; font-size: 0.85rem; font-weight: 500;';
        span.textContent = `(${m.titulo || ''})`;
        li.appendChild(span);
        ul.appendChild(li);
      });

      card.appendChild(title);
      card.appendChild(ul);
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Error cargando grupos públicos', err);
  }
}

async function initStudent(): Promise<void> {
  setupAutoFormHandler();
  setupAutoPresenteTardio();
  setupRegistroForm();
  setupBusqueda();
  setupFotoPreview();
  setupPublicGrupos();
  await loadStudentFormConfig();
  await checkActiveCourse();
  const autoDone = await checkAutoPresente();
  if (!autoDone) {
    await checkRegistrationStatus();
  }
}

initStudent();