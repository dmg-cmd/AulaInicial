// Entry point para Panel de Control (Admin)
import './styles/main.css';

// ============================================================
// Tipos
// ============================================================
interface Alumno {
  id: number;
  nombreCompleto: string;
  completado: boolean;
  borrado: boolean;
  presenteHoy: boolean;
  tardeHoy: boolean;
  llegadaTardiaHoy: boolean;
  presentes: number;
  ausentes: number;
  tardes: number;
  totalClases: number;
  porcentajePresentismo: number;
  fotoUrl: string | null;
  datos?: Record<string, string>;
}

interface CampoConfig {
  label: string;
  enabled: boolean;
  required: boolean;
  category: string;
  type?: string;
  options?: string[];
}

interface CustomField {
  id: string;
  label: string;
  name?: string;
  type?: string;
  options?: string[];
  required?: boolean;
  enabled?: boolean;
  category?: string;
}

interface FormConfig {
  standardFields: Record<string, CampoConfig>;
  customFields: CustomField[];
  asistencia: { permitirPresenteTardio: boolean; horaLimite: string };
  cursoPreferido: string;
}

interface StatsData {
  availableFields: Array<{ id: string; label: string }>;
  selectedField: string;
  selectedGroup: string;
  totalAlumnosSheet: number;
  totalCount: number;
  data: Array<{ name: string; count: number; percentage: number }>;
}

interface AusenciasData {
  mesesDisponibles: string[];
  alumnos: Array<{
    nombreCompleto: string;
    dni: string;
    grupo: string;
    fotoUrl: string | null;
    porMes: Record<string, { presentes: number; tardes: number; ausentes: number; total: number; pctAusencia: number }>;
    totales: { presentes: number; tardes: number; ausentes: number; totalClases: number; pctPresentismo: number; pctAusencia: number };
  }>;
  totalesGenerales: { presentes: number; tardes: number; ausentes: number; totalClases: number; pctPresentismo: number; pctAusencia: number } | null;
}

// ============================================================
// Estado global
// ============================================================
let currentFormConfig: FormConfig | null = null;
let cfgTardanza: { modo: string; horaInicio: string; margenGracia: number; minDespues: number } = { modo: 'manual', horaInicio: '', margenGracia: 0, minDespues: 30 };
let horaTomaListaHoy = '';
let listaDirty = false;
let mostrarBorrados = false;
let ausSortKey = 'pctAusencia';
let ausSortDir: 1 | -1 = -1;
let activeEditingField: { type: string; keyOrIndex: string } | null = null;
let tempEditingOptions: string[] = [];
let dynamicChartInstance: any = null;

// ============================================================
// Helpers
// ============================================================
function esc(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function localISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function claseEstado(texto: string): string {
  const t = (texto || '').toUpperCase();
  if (t.includes('PRESENTE') || t === 'PRESENTES' || t.includes('LLEGÓ TARDE')) return 'stat-pres';
  if (t.includes('TARDE')) return 'stat-tar';
  return 'stat-aus';
}

function colorEstado(texto: string): string {
  const t = (texto || '').toUpperCase();
  if (t.includes('PRESENTE') || t === 'PRESENTES') return 'rgba(34,197,94,0.85)';
  if (t.includes('TARDE')) return 'rgba(245,158,11,0.85)';
  return 'rgba(239,68,68,0.85)';
}

const $ = (id: string): HTMLElement | null => document.getElementById(id);

function getCurso(): string {
  const select = $('curso-select') as HTMLSelectElement | null;
  return select?.value || '';
}

async function api<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...opts });
  if (res.status === 401 || res.status === 403) {
    handleAuthError();
    throw new Error('No autorizado');
  }
  return res.json() as Promise<T>;
}

// ============================================================
// Autenticación
// ============================================================
function showScreen(screenId: string) {
  document.querySelectorAll('#login-screen, #change-pass-screen, #admin-app').forEach(el => el.classList.add('hidden'));
  const screen = $(screenId);
  if (screen) screen.classList.remove('hidden');
}

function showError(elementId: string, message: string) {
  const el = $(elementId);
  if (el) {
    el.textContent = message;
    el.style.display = 'block';
  }
}

function hideError(elementId: string) {
  const el = $(elementId);
  if (el) el.style.display = 'none';
}

function showDefaultPasswordHint() {
  fetch('/api/admin/info', { credentials: 'include' })
    .then(r => r.json())
    .then((data: { usingDefaultPassword: boolean; defaultPassword: string }) => {
      if (data.usingDefaultPassword && data.defaultPassword) {
        showError('login-default-hint', `🔑 Estás usando la contraseña por defecto (${data.defaultPassword}). En el primer ingreso será obligatorio cambiarla.`);
      }
    })
    .catch(() => {});
}

function setupPasswordToggle(inputId: string, buttonId: string) {
  const input = $(inputId) as HTMLInputElement | null;
  const button = $(buttonId);
  if (!input || !button) return;
  button.addEventListener('click', () => {
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    button.textContent = showing ? '👁️' : '🙈';
    button.title = showing ? 'Ocultar contraseña' : 'Mostrar contraseña';
  });
}

function showChangePasswordScreen(forced: boolean) {
  const title = $('change-pass-title');
  const cancelBtn = $('btn-cancel-change-pass');
  if (title) title.textContent = forced ? 'Para continuar es obligatorio cambiar la contraseña por defecto.' : 'Ingresá la contraseña actual y definí una nueva.';
  if (cancelBtn) cancelBtn.style.display = forced ? 'none' : '';
  showScreen('change-pass-screen');
}

function resetChangePasswordForm() {
  ($('change-pass-form') as HTMLFormElement | null)?.reset();
  const err = $('change-pass-error');
  const ok = $('change-pass-success');
  if (err) err.textContent = '';
  if (ok) ok.textContent = '';
}

function handleAuthError() {
  showScreen('login-screen');
  showError('login-error', 'Tu sesión expiró. Ingresá la contraseña nuevamente.');
}

async function doLogin(password: string) {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
    credentials: 'include'
  });
  return res.json();
}

async function doChangePassword(currentPassword: string, newPassword: string) {
  const res = await fetch('/api/admin/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
    credentials: 'include'
  });
  return res.json();
}

async function bootAdmin() {
  try {
    const res = await fetch('/api/admin/check', { credentials: 'include' });
    const data = await res.json();
    if (data.authenticated) {
      showScreen('admin-app');
      initAdmin();
      if (data.mustChangePassword) showChangePasswordScreen(true);
    } else {
      showScreen('login-screen');
      showDefaultPasswordHint();
    }
  } catch {
    showScreen('login-screen');
  }
}

// ============================================================
// Navegación por pestañas
// ============================================================
function switchTab(tabId: string) {
  document.querySelectorAll('.tab-button[data-tab]').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  const btn = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('active');
  const content = $(tabId);
  if (content) content.classList.add('active');

  switch (tabId) {
    case 'tab-alumnos': refreshAlumnosList(); break;
    case 'tab-formulario': loadAdminFormConfig(); break;
    case 'tab-asistencia': loadServerInfo(); cargarCfgTardanza(); prefijarPanelTardanza(); actualizarRelojTardanza(); refreshAlumnosList(); break;
    case 'tab-asist-historica': loadFechasDisponibles(); consultarAsistenciaHistorica(); break;
    case 'tab-estadisticas': switchEstadisticaPanel('presentismo'); loadFechasDisponibles(); break;
    case 'tab-grupos': loadGruposView(); break;
  }
}

// ============================================================
// Cursos / Servidor / Grupos
// ============================================================
async function loadCursos() {
  try {
    const cursos = await api<string[]>('/api/cursos');
    const activeRes = await api<{ activeCourse: string }>('/api/active-course');
    const select = $('curso-select') as HTMLSelectElement | null;
    if (!select) return;
    select.innerHTML = '<option value="">-- Seleccionar curso --</option>';
    cursos.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c.replace(/\.(xlsx|xls|csv)$/i, '');
      select.appendChild(opt);
    });
    let target = activeRes.activeCourse || '';
    if (!target && cursos.length > 0) target = cursos[0];
    if (target) {
      select.value = target;
      await fetch('/api/active-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course: target }),
        credentials: 'include'
      });
      const status = $('active-status');
      if (status) status.textContent = `✅ Curso activo: ${target.replace(/\.(xlsx|xls|csv)$/i, '')}`;
    }
    refreshAlumnosList();
    loadFechasDisponibles();
    loadStatsGroupOptions();
  } catch (e) {
    console.error('Error cargando cursos:', e);
  }
}

async function loadServerInfo() {
  try {
    const info = await api<{ url: string; qr: string }>('/api/server-info');
    const qr = $('qr-image') as HTMLImageElement | null;
    const qrLarge = $('qr-image-large') as HTMLImageElement | null;
    if (qr) qr.src = info.qr;
    if (qrLarge) qrLarge.src = info.qr;
  } catch { /* servidor-info aún no disponible */ }
}

async function loadStatsGroupOptions(intentos = 1) {
  try {
    const grupos = await api<string[]>(`/api/grupos?curso=${encodeURIComponent(getCurso())}&t=${Date.now()}`);
    poblarSelectoresGrupo(grupos);
  } catch {
    if (intentos < 3) setTimeout(() => loadStatsGroupOptions(intentos + 1), 500);
  }
}

function poblarSelectoresGrupo(grupos: string[]) {
  ['stats-group-select', 'aus-grupo-select'].forEach(id => {
    const sel = $(id) as HTMLSelectElement | null;
    if (!sel) return;
    sel.innerHTML = '<option value="TODOS">🌐 Todos los Grupos (General)</option>';
    (grupos || []).forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      sel.appendChild(opt);
    });
  });
}

// ============================================================
// Fechas disponibles / Asistencia histórica
// ============================================================
async function loadFechasDisponibles() {
  try {
    const fechas = await api<Array<{ id: string; label: string }>>(`/api/fechas-disponibles?curso=${encodeURIComponent(getCurso())}&t=${Date.now()}`);
    const statsDate = $('stats-date-select') as HTMLSelectElement | null;
    const borrarFecha = $('borrar-fecha-select') as HTMLSelectElement | null;
    const consultar = $('consultar-asistencia-select') as HTMLSelectElement | null;
    if (statsDate) {
      statsDate.innerHTML = '';
      fechas.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.label;
        statsDate.appendChild(opt);
      });
    }
    if (borrarFecha) {
      borrarFecha.innerHTML = '<option value="">Selecciona una fecha guardada</option>';
      fechas.filter(f => f.id !== 'TODAS').forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.label.replace('📅 Fecha: ', '');
        borrarFecha.appendChild(opt);
      });
    }
    if (consultar) {
      consultar.innerHTML = '<option value="">-- Seleccionar fecha previa --</option>';
      fechas.filter(f => f.id !== 'TODAS').forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.label.replace('📅 Fecha: ', '');
        consultar.appendChild(opt);
      });
      const realFechas = fechas.filter(f => f.id !== 'TODAS');
      if (realFechas.length > 0) {
        consultar.value = realFechas[realFechas.length - 1].id;
        consultarAsistenciaHistorica(realFechas[realFechas.length - 1].id);
      }
    }
  } catch { /* sin fechas */ }
}

async function consultarAsistenciaHistorica(targetFecha = '') {
  if (!targetFecha) {
    const sel = $('consultar-asistencia-select') as HTMLSelectElement | null;
    targetFecha = sel?.value || '';
  }
  if (!targetFecha) return;
  try {
    const data = await api<{
      fecha: string | null;
      alumnos: Array<{ dni: string; alumno: string; asistencia: string; esTardioAuto: boolean; grupo: string; hora: string }>;
      totalPresentes: number;
      totalTardes: number;
      totalAusentes: number;
      totalAlumnos: number;
    }>(`/api/asistencia/consultar?curso=${encodeURIComponent(getCurso())}&fecha=${encodeURIComponent(targetFecha)}&t=${Date.now()}`);

    const badge = $('resumen-asistencia-badge');
    if (badge) {
      badge.innerHTML = `<strong>📅 ${data.fecha}</strong> — ✅ Presentes: <span class="stat-pres">${data.totalPresentes}</span> · 🟡 Tardes: <span class="stat-tar">${data.totalTardes}</span> · ❌ Ausentes: <span class="stat-aus">${data.totalAusentes}</span>`;
    }

    const tbody = $('tabla-asistencia-historica-body');
    const container = $('tabla-asistencia-historica-container');
    if (tbody && container) {
      if (!data.alumnos.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No hay registros para esta fecha.</td></tr>';
        container.style.display = 'block';
      } else {
        tbody.innerHTML = data.alumnos.map(a => {
          const cls = a.esTardioAuto ? 'stat-pres' : claseEstado(a.asistencia);
          return `<tr>
            <td>${esc(a.alumno)}</td>
            <td>${esc(a.dni)}</td>
            <td>${esc(a.grupo)}</td>
            <td><span class="stat-pill ${cls}">${esc(a.asistencia)}</span></td>
            <td>${esc(a.hora)}</td>
          </tr>`;
        }).join('');
        container.style.display = 'block';
      }
    }
  } catch { /* error consulta */ }
}

// ============================================================
// Estadísticas dinámicas
// ============================================================
const PALETA = [
  'rgba(99,102,241,0.85)', 'rgba(14,165,233,0.85)', 'rgba(34,197,94,0.85)',
  'rgba(245,158,11,0.85)', 'rgba(239,68,68,0.85)', 'rgba(168,85,247,0.85)',
  'rgba(236,72,153,0.85)', 'rgba(20,184,166,0.85)', 'rgba(250,204,21,0.85)'
];

async function updateStats() {
  const campo = ($('stats-field-select') as HTMLSelectElement | null)?.value || 'titulo';
  const grupo = ($('stats-group-select') as HTMLSelectElement | null)?.value || 'TODOS';
  const formato = ($('stats-format-select') as HTMLSelectElement | null)?.value || 'bar';
  const fecha = ($('stats-date-select') as HTMLSelectElement | null)?.value || 'TODOS';

  try {
    const stats = await api<StatsData>(`/api/stats?curso=${encodeURIComponent(getCurso())}&campo=${encodeURIComponent(campo)}&grupo=${encodeURIComponent(grupo)}&fecha=${encodeURIComponent(fecha)}&t=${Date.now()}`);

    const fieldSelect = $('stats-field-select') as HTMLSelectElement | null;
    if (fieldSelect && Array.isArray(stats.availableFields) && stats.availableFields.length > 0) {
      const current = fieldSelect.value;
      const existingIds = Array.from(fieldSelect.querySelectorAll('option')).map(o => o.value);
      const newIds = stats.availableFields.map(f => f.id);
      const hasOptgroups = fieldSelect.querySelector('optgroup') !== null;

      if (JSON.stringify(existingIds) !== JSON.stringify(newIds) || !hasOptgroups) {
        fieldSelect.innerHTML = '';
        const stdGroup = document.createElement('optgroup');
        stdGroup.label = '📌 Campos Estándar del Sistema';
        const customGroup = document.createElement('optgroup');
        customGroup.label = '📚 Preguntas del Docente y Encuestas';

        stats.availableFields.forEach(f => {
          if (f.id.toLowerCase().includes('no especificado')) return;
          const opt = document.createElement('option');
          opt.value = f.id;
          opt.textContent = f.id.startsWith('custom_') ? `📝 ${f.label}` : f.label;
          if (f.id.startsWith('custom_')) customGroup.appendChild(opt);
          else stdGroup.appendChild(opt);
        });

        if (stdGroup.children.length > 0) fieldSelect.appendChild(stdGroup);
        if (customGroup.children.length > 0) fieldSelect.appendChild(customGroup);
      }

      if (Array.from(fieldSelect.options).some(o => o.value === current)) fieldSelect.value = current;
      else if (newIds.length > 0) fieldSelect.value = newIds[0];
    }

    const header = $('stats-dynamic-header');
    if (header) header.textContent = `📊 Muestra: ${stats.totalAlumnosSheet} alumno(s) (${stats.totalCount} respuestas)`;

    renderStatsTable(stats.data);
    if (formato === 'table') {
      const chartContainer = $('dynamicChartContainer');
      const tableContainer = $('dynamicTableContainer');
      if (chartContainer) chartContainer.style.display = 'none';
      if (tableContainer) tableContainer.style.display = 'block';
    } else {
      const chartContainer = $('dynamicChartContainer');
      const tableContainer = $('dynamicTableContainer');
      if (chartContainer) chartContainer.style.display = 'block';
      if (tableContainer) tableContainer.style.display = 'none';
      renderChart(stats.data, formato, stats.selectedField);
    }
  } catch (e) {
    console.error('Error en updateStats:', e);
  }
}

function renderStatsTable(data: Array<{ name: string; count: number; percentage: number }>) {
  const tbody = $('statsTableBody');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">Sin datos.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(d => {
    const barWidth = Math.min(d.percentage, 100);
    return `<tr>
      <td>${esc(d.name)}</td>
      <td>${d.count} alumno(s)</td>
      <td>
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <div style="flex:1;height:10px;background:var(--bg-tertiary);border-radius:5px;overflow:hidden;">
            <div style="width:${barWidth}%;height:100%;background:linear-gradient(90deg,#6366f1,#8b5cf6);"></div>
          </div>
          <span>${d.percentage}%</span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderChart(data: Array<{ name: string; count: number; percentage: number }>, formato: string, selectedField: string) {
  const container = $('dynamicChartContainer');
  const canvas = $('dynamicChart') as HTMLCanvasElement | null;
  if (!container || !canvas) return;

  const labels = data.map(d => d.name);
  const values = data.map(d => d.count);
  const percentages = data.map(d => d.percentage);

  if (typeof (window as any).Chart === 'undefined') {
    renderHtmlBars(data, container);
    return;
  }

  if (dynamicChartInstance) {
    dynamicChartInstance.destroy();
    dynamicChartInstance = null;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const esAsistencia = selectedField.toLowerCase() === 'asistencia';
  const colors = labels.map((l, i) => esAsistencia ? colorEstado(l) : PALETA[i % PALETA.length]);

  const isBarLike = ['bar', 'line'].includes(formato);
  const config: any = {
    type: formato === 'radar' ? 'radar' : formato,
    data: {
      labels,
      datasets: [{
        label: 'Alumnos',
        data: values,
        backgroundColor: isBarLike || formato === 'doughnut' || formato === 'pie' || formato === 'polarArea' ? colors : 'rgba(99,102,241,0.2)',
        borderColor: colors,
        borderWidth: 2,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: (formato === 'bar' && labels.length > 5) ? 'y' : 'x',
      plugins: {
        legend: { display: ['doughnut', 'pie', 'polarArea', 'radar'].includes(formato), labels: { color: '#e2e8f0', font: { family: 'Outfit' } } },
        tooltip: {
          callbacks: {
            label: (c: any) => ` ${c.label || ''}: ${c.raw} alumno(s) (${percentages[c.dataIndex] ?? 0}%)`
          }
        }
      },
      scales: (['bar', 'line'].includes(formato)) ? {
        x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#e2e8f0' } },
        y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#e2e8f0' } }
      } : undefined
    }
  };

  try {
    dynamicChartInstance = new (window as any).Chart(ctx, config);
  } catch (e) {
    console.error('Error creando Chart:', e);
    renderHtmlBars(data, container);
  }
}

function renderHtmlBars(data: Array<{ name: string; count: number; percentage: number }>, container: HTMLElement) {
  const max = Math.max(...data.map(d => d.percentage), 1);
  container.innerHTML = `<div style="display:flex;flex-direction:column;gap:0.5rem;">
    ${data.map(d => `
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <span style="width:140px;text-align:right;color:var(--text-secondary);font-size:0.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(d.name)}</span>
        <div style="flex:1;height:16px;background:var(--bg-tertiary);border-radius:6px;overflow:hidden;">
          <div style="width:${(d.percentage / max) * 100}%;height:100%;background:linear-gradient(90deg,#6366f1,#8b5cf6);"></div>
        </div>
        <span style="width:90px;color:var(--text-primary);font-size:0.8rem;">${d.count} (${d.percentage}%)</span>
      </div>`).join('')}
  </div>`;
}

// ============================================================
// Tardanza
// ============================================================
function calcularLimiteMin(cfg: any, horaTomaLista: string): number | null {
  if (cfg.modo === 'manual') return null;
  if (cfg.modo === 'horario') {
    if (!cfg.horaInicio) return null;
    const [h, m] = cfg.horaInicio.split(':').map(Number);
    return h * 60 + m + (parseInt(cfg.margenGracia, 10) || 0);
  }
  if (cfg.modo === 'desplist') {
    if (!horaTomaLista) return null;
    const [h, m] = horaTomaLista.split(':').map(Number);
    return h * 60 + m + (parseInt(cfg.minDespues, 10) || 0);
  }
  return null;
}

function pasoLimiteAhora(cfg: any, horaTomaLista: string): boolean {
  const limite = calcularLimiteMin(cfg, horaTomaLista);
  if (limite === null) return false;
  const ahora = new Date();
  const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes();
  return ahoraMin > limite;
}

async function cargarCfgTardanza() {
  try {
    const data = await api<{ cfg: any; horaTomaListaHoy: string }>(`/api/asistencia/cfg?curso=${encodeURIComponent(getCurso())}&t=${Date.now()}`);
    cfgTardanza = data.cfg || { modo: 'manual', horaInicio: '', margenGracia: 0, minDespues: 30 };
    horaTomaListaHoy = data.horaTomaListaHoy || '';
    const estado = $('toma-lista-estado');
    if (estado) estado.textContent = horaTomaListaHoy ? `📋 Lista tomada a las ${horaTomaListaHoy}` : '';
  } catch { /* sin cfg */ }
}

function actualizarRelojTardanza() {
  const reloj = $('reloj-tardanza');
  if (!reloj) return;
  const ahora = new Date();
  const hora = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const limite = calcularLimiteMin(cfgTardanza, horaTomaListaHoy);
  let extra = '';
  if (limite !== null) {
    const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes();
    const diff = limite - ahoraMin;
    if (diff > 0) extra = ` · ⏳ Faltan ${diff} min para el límite`;
    else extra = ` · ⚠️ Vencido hace ${Math.abs(diff)} min`;
  }
  reloj.textContent = `🕒 ${hora}${extra}`;
}

function prefijarPanelTardanza() {
  const modoRadio = document.querySelector(`input[name="tardanza-modo"][value="${cfgTardanza.modo}"]`) as HTMLInputElement | null;
  if (modoRadio) modoRadio.checked = true;
  const hInicio = $('tardanza-hora-inicio') as HTMLInputElement | null;
  const margen = $('tardanza-margen') as HTMLInputElement | null;
  const minDespues = $('tardanza-min-despues') as HTMLInputElement | null;
  if (hInicio) hInicio.value = cfgTardanza.horaInicio || '';
  if (margen) margen.value = String(cfgTardanza.margenGracia || 0);
  if (minDespues) minDespues.value = String(cfgTardanza.minDespues || 30);
  toggleSubPanelesTardanza();
}

function toggleSubPanelesTardanza() {
  const modo = (document.querySelector('input[name="tardanza-modo"]:checked') as HTMLInputElement | null)?.value || 'manual';
  const horario = $('tardanza-horario');
  const desplist = $('tardanza-desplist');
  if (horario) horario.hidden = modo !== 'horario';
  if (desplist) desplist.hidden = modo !== 'desplist';
}

async function guardarCfgTardanza() {
  const modo = (document.querySelector('input[name="tardanza-modo"]:checked') as HTMLInputElement | null)?.value || 'manual';
  const horaInicio = ($('tardanza-hora-inicio') as HTMLInputElement | null)?.value || '';
  const margenGracia = parseInt(($('tardanza-margen') as HTMLInputElement | null)?.value || '0', 10) || 0;
  const minDespues = parseInt(($('tardanza-min-despues') as HTMLInputElement | null)?.value || '30', 10) || 30;
  try {
    await api(`/api/asistencia/cfg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ curso: getCurso(), modo, horaInicio, margenGracia, minDespues })
    });
    const msg = $('tardanza-guardado');
    if (msg) {
      msg.textContent = '✅ Configuración guardada';
      setTimeout(() => { if (msg) msg.textContent = ''; }, 2500);
    }
    cfgTardanza = { modo, horaInicio, margenGracia, minDespues };
    cargarCfgTardanza();
    refreshAlumnosList();
  } catch { /* error */ }
}

async function tomarLista() {
  try {
    const res = await fetch('/api/asistencia/tomar-lista', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ curso: getCurso() }),
      credentials: 'include'
    });
    const data = await res.json();
    const estado = $('toma-lista-estado');
    if (estado && data.hora) estado.textContent = `📋 Lista tomada a las ${data.hora}`;
    cargarCfgTardanza();
  } catch { /* error */ }
}

// ============================================================
// Estadísticas: presentismo / ausencias
// ============================================================
function switchEstadisticaPanel(panel: string) {
  const datosBtn = $('btn-estad-datos');
  const presBtn = $('btn-estad-presentismo');
  const datosPanel = $('estad-datos-panel');
  const presPanel = $('estad-presentismo-panel');
  if (panel === 'datos') {
    datosBtn?.classList.add('active');
    presBtn?.classList.remove('active');
    if (datosPanel) datosPanel.style.display = 'block';
    if (presPanel) presPanel.style.display = 'none';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      updateStats();
      if (dynamicChartInstance) dynamicChartInstance.resize();
    }));
  } else {
    presBtn?.classList.add('active');
    datosBtn?.classList.remove('active');
    if (presPanel) presPanel.style.display = 'block';
    if (datosPanel) datosPanel.style.display = 'none';
    loadStatsGroupOptions();
    cargarAusencias();
  }
}

function nombreMes(mesKey: string): string {
  const [mm, yyyy] = mesKey.split('-');
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${meses[parseInt(mm, 10) - 1] || mesKey} ${yyyy}`;
}

function buildAusAvatar(alumno: any) {
  if (alumno.fotoUrl) return `<img class="student-avatar" src="${alumno.fotoUrl}" alt="">`;
  const iniciales = (alumno.nombreCompleto || '?').split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();
  return `<div class="student-avatar">${esc(iniciales || '?')}</div>`;
}

function valorOrdenAus(alumno: any): number {
  if (ausSortKey === 'alumno') return 0;
  if (ausSortKey === 'presentes') return alumno.totales.presentes;
  if (ausSortKey === 'tardes') return alumno.totales.tardes;
  if (ausSortKey === 'ausencias') return alumno.totales.ausentes;
  if (ausSortKey === 'total') return alumno.totales.totalClases;
  if (ausSortKey === 'pctPresentismo') return alumno.totales.pctPresentismo;
  return alumno.totales.pctAusencia;
}

function ordenarAusAlumnos(alumnos: any[]) {
  const sorted = [...alumnos].sort((a, b) => {
    const va = valorOrdenAus(a);
    const vb = valorOrdenAus(b);
    if (ausSortKey === 'alumno') return a.nombreCompleto.localeCompare(b.nombreCompleto) * ausSortDir;
    return (vb - va) * ausSortDir;
  });
  return sorted;
}

let currentAusencias: AusenciasData | null = null;

function sortAusPorColumna(key: string) {
  if (ausSortKey === key) ausSortDir = (ausSortDir === 1 ? -1 : 1) as 1 | -1;
  else { ausSortKey = key; ausSortDir = -1; }
  if (currentAusencias) renderAusencias(currentAusencias);
}

function renderAusencias(data: AusenciasData) {
  currentAusencias = data;
  const head = $('aus-tabla-alumno-head');
  if (head) {
    const keys = ['alumno', 'presentes', 'tardes', 'ausencias', 'total', 'pctPresentismo', 'pctAusencia'];
    const labels: Record<string, string> = { alumno: 'Alumno', presentes: 'Presentes', tardes: 'Tardes', ausencias: 'Ausencias', total: 'Total', pctPresentismo: '% Presentismo', pctAusencia: '% Ausencia' };
    head.innerHTML = `<tr>${keys.map(k => `<th class="aus-sortable ${ausSortKey === k ? 'sorted' : ''}" data-key="${k}">${labels[k]} ${ausSortKey === k ? (ausSortDir === 1 ? '▲' : '▼') : ''}</th>`).join('')}</tr>`;
    head.querySelectorAll('th').forEach(th => {
      th.addEventListener('click', () => sortAusPorColumna(th.getAttribute('data-key')!));
    });
  }

  const tbody = $('aus-tabla-alumno-body');
  const tfoot = $('aus-tabla-alumno-tfoot');
  const alumnosOrdenados = ordenarAusAlumnos(data.alumnos);
  if (tbody) {
    if (!alumnosOrdenados.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Sin datos de asistencia.</td></tr>';
    } else {
      tbody.innerHTML = alumnosOrdenados.map(a => {
        const pctAus = a.totales.pctAusencia;
        const barColor = pctAus >= 30 ? 'var(--color-danger)' : 'var(--color-success)';
        return `<tr>
          <td>${buildAusAvatar(a)} ${esc(a.nombreCompleto)}</td>
          <td>${a.totales.presentes}</td>
          <td>${a.totales.tardes}</td>
          <td>${a.totales.ausentes}</td>
          <td>${a.totales.totalClases}</td>
          <td>${a.totales.pctPresentismo}%</td>
          <td>
            <div style="display:flex;align-items:center;gap:0.4rem;">
              <div style="flex:1;height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden;">
                <div style="width:${Math.min(pctAus, 100)}%;height:100%;background:${barColor};"></div>
              </div>
              <span>${pctAus}%</span>
            </div>
          </td>
        </tr>`;
      }).join('');
    }
  }

  if (tfoot && data.totalesGenerales) {
    const t = data.totalesGenerales;
    tfoot.innerHTML = `<tr style="font-weight:700;border-top:2px solid var(--border-color);">
      <td>TOTALES</td><td>${t.presentes}</td><td>${t.tardes}</td><td>${t.ausentes}</td>
      <td>${t.totalClases}</td><td>${t.pctPresentismo}%</td><td>${t.pctAusencia}%</td>
    </tr>`;
  }

  renderAusMatriz(data);
}

function renderAusMatriz(data: AusenciasData) {
  const meses = data.mesesDisponibles || [];
  const head = $('aus-matriz-head');
  const body = $('aus-matriz-body');
  if (head) {
    head.innerHTML = `<tr><th>Alumno</th>${meses.map(m => `<th title="${nombreMes(m)}">${m.slice(0, 2)}/${m.slice(3)}</th>`).join('')}<th>% Aus. Total</th></tr>`;
  }
  if (body) {
    const alumnos = ordenarAusAlumnos(data.alumnos);
    body.innerHTML = alumnos.map(a => {
      return `<tr>
        <td>${esc(a.nombreCompleto)}</td>
        ${meses.map(m => {
          const slot = a.porMes[m];
          const aus = slot?.ausentes || 0;
          return `<td class="${aus > 0 ? 'stat-aus' : ''}">${aus || ''}</td>`;
        }).join('')}
        <td>${a.totales.pctAusencia}%</td>
      </tr>`;
    }).join('');
  }
}

async function cargarAusencias() {
  const mes = ($('aus-mes-select') as HTMLSelectElement | null)?.value || '';
  const grupo = ($('aus-grupo-select') as HTMLSelectElement | null)?.value || 'TODOS';
  try {
    const data = await api<AusenciasData>(`/api/ausencias?curso=${encodeURIComponent(getCurso())}&mes=${encodeURIComponent(mes)}&grupo=${encodeURIComponent(grupo)}&t=${Date.now()}`);
    const mesSelect = $('aus-mes-select') as HTMLSelectElement | null;
    if (mesSelect) {
      const current = mesSelect.value;
      mesSelect.innerHTML = '<option value="">🌐 Todos los Meses</option>';
      (data.mesesDisponibles || []).forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = nombreMes(m);
        mesSelect.appendChild(opt);
      });
      if (Array.from(mesSelect.options).some(o => o.value === current)) mesSelect.value = current;
    }
    renderAusencias(data);
  } catch (e) {
    console.error('Error cargando ausencias:', e);
  }
}

// ============================================================
// Nómina de alumnos
// ============================================================
function buildStatusItem(alumno: Alumno, esListaAsistencia: boolean): string {
  if (esListaAsistencia) {
    const clase = alumno.presenteHoy ? 'completed' : (alumno.tardeHoy || alumno.llegadaTardiaHoy) ? 'late' : 'pending';
    const presugerirTarde = !alumno.presenteHoy && !alumno.tardeHoy && pasoLimiteAhora(cfgTardanza, horaTomaListaHoy);
    const tardeChecked = (alumno.tardeHoy || alumno.llegadaTardiaHoy || presugerirTarde) ? 'checked' : '';
    const tardeData = (alumno.tardeHoy || alumno.llegadaTardiaHoy || presugerirTarde) ? 'true' : 'false';
    const avatar = alumno.fotoUrl ? `<img class="student-avatar" src="${alumno.fotoUrl}" alt="">` : `<div class="student-avatar">${esc((alumno.nombreCompleto || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || '?')}</div>`;
    return `<div class="status-item compact ${clase}" data-nombre="${esc(alumno.nombreCompleto)}">
      <label class="alumno-checkbox-wrapper">
        <input type="checkbox" class="alumno-checkbox-presente" data-nombre="${esc(alumno.nombreCompleto)}" data-dni="${esc(alumno.datos?.dni || '')}" data-grupo="${esc(alumno.datos?.grupo || '')}" data-tarde="${tardeData}" ${tardeChecked}>
      </label>
      <div class="status-item-body" style="cursor:pointer;" onclick="window.showStudentDetails&&showStudentDetails(${JSON.stringify(alumno).replace(/"/g, '&quot;')})">
        ${avatar}
        <div>
          <div class="status-compact-name">${esc(alumno.nombreCompleto)}</div>
          <button type="button" class="btn-tarde ${tardeData === 'true' ? 'active' : ''}" data-nombre="${esc(alumno.nombreCompleto)}">⏰</button>
        </div>
      </div>
      <span class="status-dot ${clase}"></span>
    </div>`;
  }

  const clase = alumno.borrado ? 'pending' : alumno.presenteHoy ? 'completed' : (alumno.tardeHoy || alumno.llegadaTardiaHoy) ? 'late' : 'pending';
  const avatar = alumno.fotoUrl ? `<img class="student-avatar" src="${alumno.fotoUrl}" alt="">` : `<div class="student-avatar">${esc((alumno.nombreCompleto || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || '?')}</div>`;
  const borradoBadge = alumno.borrado ? `<span class="badge-danger">🚫 Borrado</span>` : '';
  const pendienteBadge = !alumno.completado ? `<span class="badge-warning">⚠️ Pendiente registro</span>` : '';
  const restoreBtn = alumno.borrado ? `<button class="btn-secondary btn-sm" data-action="restaurar" data-nombre="${esc(alumno.nombreCompleto)}">♻️ Restaurar</button>` : '';
  return `<div class="status-item ${clase}" data-nombre="${esc(alumno.nombreCompleto)}">
    <div class="status-item-header">
      ${avatar}
      <div>
        <div class="status-name">${esc(alumno.nombreCompleto)}</div>
        ${alumno.datos?.grupo ? `<div class="status-group">${esc(alumno.datos.grupo)}</div>` : ''}
        ${borradoBadge} ${pendienteBadge}
      </div>
    </div>
    <div class="status-counts">
      <span class="stat-pill stat-pres">✅ ${alumno.presentes}</span>
      <span class="stat-pill stat-tar">🟡 ${alumno.tardes}</span>
      <span class="stat-pill stat-aus">❌ ${alumno.ausentes}</span>
      <span class="stat-pill">🎯 ${alumno.porcentajePresentismo}%</span>
    </div>
    <div class="status-actions">
      ${alumno.fotoUrl ? `<button class="btn-delete-foto btn-sm" data-action="borrar-foto" data-nombre="${esc(alumno.nombreCompleto)}" data-dni="${esc(alumno.datos?.dni || '')}">🗑️ Foto</button>` : ''}
      ${alumno.completado ? `<button class="btn-secondary btn-sm" data-action="ficha" data-nombre="${esc(alumno.nombreCompleto)}">🔍 Ficha</button>` : ''}
      <button class="btn-secondary btn-sm" data-action="editar" data-nombre="${esc(alumno.nombreCompleto)}">✏️</button>
      <button class="btn-danger btn-sm" data-action="borrar" data-nombre="${esc(alumno.nombreCompleto)}">🗑️</button>
      ${restoreBtn}
    </div>
    <span class="status-dot ${clase}"></span>
  </div>`;
}

async function refreshAlumnosList() {
  if (!getCurso()) return;
  try {
    const url = `/api/alumnos?curso=${encodeURIComponent(getCurso())}&full=true&t=${Date.now()}${mostrarBorrados ? '&incluirBorrados=true' : ''}`;
    const alumnos = await api<Alumno[]>(url);
    alumnosCache = alumnos;

    const statusList = $('alumnos-status-list');
    const asistList = $('alumnos-status-list-asistencia');
    if (statusList) {
      const presentesHoy = alumnos.filter(a => a.presenteHoy || a.llegadaTardiaHoy).length;
      const tardesHoy = alumnos.filter(a => a.tardeHoy).length;
      statusList.innerHTML = `<div class="status-header-count">
        <span>📅 Presentes HOY: <span class="presentes">${presentesHoy}</span> · 🟡 Tardes: <span class="tardes">${tardesHoy}</span> / ${alumnos.length}</span>
        <span class="leyenda">✅ verde = presente hoy · 🟡 ámbar = llegó tarde · ⬜ gris = pendiente</span>
      </div>`;
      if (!alumnos.length) {
        statusList.innerHTML += '<p style="text-align:center;color:var(--text-muted);padding:2rem;">No hay alumnos en este curso.</p>';
      } else {
        statusList.innerHTML += alumnos.map(a => buildStatusItem(a, false)).join('');
      }
      wireAlumnosActions(statusList);
    }
    if (asistList) {
      const presA = alumnos.filter(a => a.presenteHoy || a.llegadaTardiaHoy).length;
      const tardA = alumnos.filter(a => a.tardeHoy).length;
      asistList.innerHTML = `<div class="status-header-count">
        <span>📅 Presentes HOY: <span class="presentes">${presA}</span> · 🟡 Tardes: <span class="tardes">${tardA}</span> / ${alumnos.length}</span>
        <span class="leyenda">✅ verde = presente hoy · 🟡 ámbar = llegó tarde · ⬜ gris = pendiente</span>
      </div>`;
      if (!alumnos.length) {
        asistList.innerHTML += '<p style="text-align:center;color:var(--text-muted);padding:2rem;">No hay alumnos en este curso.</p>';
      } else {
        asistList.innerHTML += alumnos.map(a => buildStatusItem(a, true)).join('');
      }
      wireAsistenciaActions(asistList);
    }
  } catch (e) {
    console.error('Error refrescando alumnos:', e);
  }
}

function wireAlumnosActions(container: HTMLElement) {
  container.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const action = btn.getAttribute('data-action');
      const nombre = btn.getAttribute('data-nombre') || '';
      if (action === 'borrar') { await borrarAlumno(nombre, false); }
      else if (action === 'restaurar') { await restaurarAlumno(nombre); }
      else if (action === 'borrar-foto') {
        const dni = btn.getAttribute('data-dni') || '';
        if (confirm('¿Borrar la foto de rostro de este alumno?')) {
          await api('/api/borrar-foto-alumno', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombreCompleto: nombre, dni })
          });
          refreshAlumnosList();
        }
      }
      else if (action === 'editar') {
        const al = buscarAlumnoPorNombre(nombre);
        if (al) abrirModalEdicionAlumno(al);
      }
      else if (action === 'ficha') {
        const al = buscarAlumnoPorNombre(nombre);
        if (al) showStudentDetails(al);
      }
    });
  });
}

let alumnosCache: Alumno[] = [];

function buscarAlumnoPorNombre(nombre: string): Alumno | null {
  return alumnosCache.find(a => a.nombreCompleto === nombre) || null;
}

function wireAsistenciaActions(container: HTMLElement) {
  container.querySelectorAll('.alumno-checkbox-presente').forEach(cb => {
    cb.addEventListener('change', () => {
      listaDirty = true;
      updateCardFromCheckbox(cb as HTMLInputElement);
    });
  });
  container.querySelectorAll('.btn-tarde').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const nombre = btn.getAttribute('data-nombre') || '';
      const card = container.querySelector(`.status-item[data-nombre="${CSS.escape(nombre)}"]`) as HTMLElement | null;
      const cb = card?.querySelector('.alumno-checkbox-presente') as HTMLInputElement | null;
      if (cb) {
        const esTarde = cb.dataset.tarde === 'true';
        cb.dataset.tarde = esTarde ? 'false' : 'true';
        btn.classList.toggle('active', !esTarde);
        cb.checked = true;
        if (!esTarde) btn.classList.add('active');
        listaDirty = true;
      }
    });
  });
  container.querySelectorAll('.status-item[data-nombre]').forEach(card => {
    card.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement).closest('.btn-tarde, .alumno-checkbox-wrapper')) return;
      const cb = card.querySelector('.alumno-checkbox-presente') as HTMLInputElement | null;
      if (cb) {
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change'));
      }
    });
  });
}

function updateCardFromCheckbox(cb: HTMLInputElement) {
  const card = cb.closest('.status-item') as HTMLElement | null;
  if (!card) return;
  const checked = cb.checked;
  card.classList.toggle('completed', checked);
  card.classList.toggle('pending', !checked);
  const dot = card.querySelector('.status-dot');
  if (dot) dot.className = `status-dot ${checked ? 'completed' : 'pending'}`;
}

async function guardarAsistenciaFecha() {
  const fecha = ($('asistencia-fecha-input') as HTMLInputElement | null)?.value || localISODate();
  const container = $('alumnos-status-list-asistencia') || $('alumnos-status-list');
  if (!container) return;
  const asistencias: Array<{ nombreCompleto: string; dni: string; grupo: string; presente: boolean; tarde: boolean }> = [];
  container.querySelectorAll('.alumno-checkbox-presente').forEach(cb => {
    const c = cb as HTMLInputElement;
    const tarde = c.dataset.tarde === 'true';
    asistencias.push({
      nombreCompleto: c.dataset.nombre || '',
      dni: c.dataset.dni || '',
      grupo: c.dataset.grupo || '',
      presente: c.checked,
      tarde
    });
  });
  if (!asistencias.length) return;
  try {
    await api('/api/asistencia/tomar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ curso: getCurso(), fecha, asistencias })
    });
    listaDirty = false;
    refreshAlumnosList();
    loadFechasDisponibles();
  } catch { /* error */ }
}

// ============================================================
// Alta de alumno manual
// ============================================================
async function guardarNuevoAlumnoManual() {
  const nombre = ($('add-alumno-nombre') as HTMLInputElement | null)?.value?.trim() || '';
  const apellido = ($('add-alumno-apellido') as HTMLInputElement | null)?.value?.trim() || '';
  const dni = ($('add-alumno-dni') as HTMLInputElement | null)?.value?.trim() || '';
  const grupo = ($('add-alumno-grupo') as HTMLInputElement | null)?.value?.trim() || '';
  const titulo = ($('add-alumno-titulo') as HTMLSelectElement | null)?.value || '';
  const tecnologia = ($('add-alumno-tecnologia') as HTMLSelectElement | null)?.value || '';
  const presente = ($('add-alumno-marcar-presente') as HTMLInputElement | null)?.checked || false;
  const fecha = ($('asistencia-fecha-input') as HTMLInputElement | null)?.value || localISODate();

  if (!nombre && !apellido) {
    alert('Debes ingresar al menos el nombre o apellido del alumno.');
    return;
  }
  try {
    await api('/api/agregar-alumno', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ curso: getCurso(), nombre, apellido, dni, grupo, titulo, tecnologia, presente, fecha })
    });
    const form = $('form-add-alumno-container');
    if (form) form.style.display = 'none';
    ($('add-alumno-nombre') as HTMLInputElement).value = '';
    ($('add-alumno-apellido') as HTMLInputElement).value = '';
    ($('add-alumno-dni') as HTMLInputElement).value = '';
    ($('add-alumno-grupo') as HTMLInputElement).value = '';
    ($('add-alumno-marcar-presente') as HTMLInputElement).checked = false;
    refreshAlumnosList();
  } catch { /* error */ }
}

// ============================================================
// Modal detalle de alumno
// ============================================================
async function showStudentDetails(alumno: Alumno) {
  try {
    const alumnos = await api<Alumno[]>(`/api/alumnos?curso=${encodeURIComponent(getCurso())}&full=true&t=${Date.now()}`);
    alumnosCache = alumnos;
    const full = alumnos.find(a => a.nombreCompleto === alumno.nombreCompleto) || alumno;
    const d = full.datos || {};
    ($('modal-student-name') as HTMLElement).textContent = full.nombreCompleto;
    const img = $('modal-student-photo-img') as HTMLImageElement | null;
    const ph = $('modal-student-photo-placeholder') as HTMLElement | null;
    if (full.fotoUrl && img) {
      img.src = full.fotoUrl;
      img.style.display = '';
      if (ph) ph.style.display = 'none';
    } else {
      if (img) img.style.display = 'none';
      if (ph) {
        ph.style.display = '';
        ph.textContent = (full.nombreCompleto || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
      }
    }
    const delPhoto = $('btn-modal-delete-photo');
    if (delPhoto) delPhoto.style.display = full.fotoUrl ? '' : 'none';
    setText('det-email', d.email || '-');
    setText('det-dni', d.dni || '-');
    setText('det-titulo', d.titulo || '-');
    setText('det-tecnologia', d.tecnologia || '-');
    setText('det-grupo', d.grupo || '-');
    setText('det-tel', d.telefono || '-');
    setText('det-fecha', d.fecha || '-');
    const pres = $('det-presentismo');
    if (pres) {
      pres.innerHTML = `<span class="stat-pill stat-pres">✅ ${full.presentes}</span><span class="stat-pill stat-tar">🟡 ${full.tardes}</span><span class="stat-pill stat-aus">❌ ${full.ausentes}</span><span class="stat-pill">🎯 ${full.porcentajePresentismo}%</span>`;
    }
    const modal = $('student-modal');
    if (modal) modal.classList.add('show');
    (window as any).activeModalAlumno = full;
  } catch { /* error */ }
}

function setText(id: string, text: string) {
  const el = $(id);
  if (el) el.textContent = text;
}

function abrirModalEdicionAlumno(alumno: Alumno) {
  const d = alumno.datos || {};
  ($('edit-nombre-original') as HTMLInputElement).value = alumno.nombreCompleto;
  const partes = alumno.nombreCompleto.split(' ');
  ($('edit-nombre') as HTMLInputElement).value = d.nombre || partes[0] || '';
  ($('edit-apellido') as HTMLInputElement).value = d.apellido || partes.slice(1).join(' ') || '';
  ($('edit-dni') as HTMLInputElement).value = d.dni || '';
  ($('edit-grupo') as HTMLInputElement).value = d.grupo || '';
  ($('edit-titulo') as HTMLInputElement).value = d.titulo || '';
  ($('edit-email') as HTMLInputElement).value = d.email || '';
  const modal = $('edit-student-modal');
  if (modal) modal.classList.add('show');
}

async function guardarEdicionAlumnoBackend() {
  const nombreOriginal = ($('edit-nombre-original') as HTMLInputElement).value;
  const nombre = ($('edit-nombre') as HTMLInputElement).value.trim();
  const apellido = ($('edit-apellido') as HTMLInputElement).value.trim();
  const dni = ($('edit-dni') as HTMLInputElement).value.trim();
  const grupo = ($('edit-grupo') as HTMLInputElement).value.trim();
  const titulo = ($('edit-titulo') as HTMLInputElement).value.trim();
  const email = ($('edit-email') as HTMLInputElement).value.trim();
  try {
    await api('/api/modificar-alumno', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ curso: getCurso(), nombreOriginal, nombre, apellido, dni, grupo, titulo, email })
    });
    const modal = $('edit-student-modal');
    if (modal) modal.classList.remove('show');
    const sm = $('student-modal');
    if (sm) sm.classList.remove('show');
    refreshAlumnosList();
  } catch { /* error */ }
}

async function borrarAlumno(nombreAlumno: string, definitivo = false) {
  const msg = definitivo
    ? `⚠️ ¿BORRAR DEFINITIVAMENTE a "${nombreAlumno}"? Se eliminará de todas las hojas y se borrará su foto. Esta acción NO se puede deshacer.`
    : `¿Marcar como BORRADO a "${nombreAlumno}"? Se ocultará de la nómina y estadísticas.`;
  if (!confirm(msg)) return;
  try {
    await api('/api/borrar-alumno', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ curso: getCurso(), nombreAlumno, definitivo })
    });
    const sm = $('student-modal');
    if (sm) sm.classList.remove('show');
    refreshAlumnosList();
  } catch { /* error */ }
}

async function restaurarAlumno(nombreAlumno: string) {
  if (!confirm(`¿Restaurar a "${nombreAlumno}"?`)) return;
  try {
    await api('/api/restaurar-alumno', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ curso: getCurso(), nombreAlumno })
    });
    refreshAlumnosList();
  } catch { /* error */ }
}

// ============================================================
// Grupos (módulo)
// ============================================================
async function loadGruposView() {
  try {
    const gruposMap = await api<Record<string, Array<{ nombreCompleto: string; titulo: string; email: string; tecnologia: string }>>>(`/api/grupos-miembros?curso=${encodeURIComponent(getCurso())}&t=${Date.now()}`);
    const container = $('grupos-cards-container');
    if (!container) return;
    const grupos = Object.keys(gruposMap).sort();
    if (!grupos.length) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">No hay grupos definidos en este curso.</p>';
      return;
    }
    container.innerHTML = grupos.map(g => {
      const miembros = gruposMap[g];
      return `<div class="card glass">
        <div class="section-header">
          <h3>Grupo: ${esc(g)}</h3>
          <span class="badge-secondary">${miembros.length} integrante(s)</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:0.5rem;">
          ${miembros.map(m => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;background:var(--bg-tertiary);border-radius:var(--radius-sm);">
              <div>
                <strong>${esc(m.nombreCompleto)}</strong>
                <div style="font-size:0.8rem;color:var(--text-muted);">${esc(m.titulo)} • ${esc(m.tecnologia)}</div>
              </div>
              <button class="btn-secondary btn-sm" data-edit-grupo="${esc(m.nombreCompleto)}" data-grupo="${esc(g)}">✏️ Cambiar</button>
            </div>`).join('')}
        </div>
      </div>`;
    }).join('');
    container.querySelectorAll('button[data-edit-grupo]').forEach(btn => {
      btn.addEventListener('click', () => {
        const nombre = btn.getAttribute('data-edit-grupo') || '';
        const nuevo = prompt('Nuevo grupo para el alumno:', btn.getAttribute('data-grupo') || '');
        if (nuevo === null || !nuevo.trim()) return;
        const limpio = nuevo.trim().toUpperCase().replace(/\s/g, '');
        api('/api/update-alumno-grupo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ curso: getCurso(), nombreAlumno: nombre, nuevoGrupo: limpio })
        }).then(() => loadGruposView());
      });
    });
  } catch { /* error */ }
}

// ============================================================
// Configuración del formulario
// ============================================================
async function loadAdminFormConfig() {
  try {
    const config = await api<FormConfig>('/api/form-config');
    currentFormConfig = config;
    renderStandardFields();
    renderCustomFields();
    syncAsistenciaConfigUI();
  } catch { /* error */ }
}

function syncAsistenciaConfigUI() {
  if (!currentFormConfig) return;
  const permitir = $('asistencia-permitir-tardio') as HTMLInputElement | null;
  const horaLimite = $('asistencia-hora-limite') as HTMLInputElement | null;
  if (permitir) permitir.checked = currentFormConfig.asistencia?.permitirPresenteTardio !== false;
  if (horaLimite) horaLimite.value = currentFormConfig.asistencia?.horaLimite || '';
}

function readAsistenciaConfigFromUI() {
  if (!currentFormConfig) return;
  const permitir = $('asistencia-permitir-tardio') as HTMLInputElement | null;
  const horaLimite = $('asistencia-hora-limite') as HTMLInputElement | null;
  currentFormConfig.asistencia = {
    permitirPresenteTardio: permitir?.checked !== false,
    horaLimite: horaLimite?.value || ''
  };
}

function renderStandardFields() {
  const container = $('standard-fields-container');
  if (!container || !currentFormConfig) return;
  const keys = Object.keys(currentFormConfig.standardFields);
  container.innerHTML = keys.map(key => {
    const f = currentFormConfig!.standardFields[key];
    const isSelect = f.type === 'select' || (f.options && f.options.length > 0);
    return `<div class="config-field-card">
      <div class="config-field-info">
        <strong>${esc(f.label)}</strong>
        <span class="text-muted">${esc(key)}</span>
      </div>
      <div class="config-field-controls">
        <select id="std_cat_${key}" class="form-select-sm">
          <option value="personal" ${f.category === 'personal' ? 'selected' : ''}>👤 Personal</option>
          <option value="clase" ${f.category === 'clase' ? 'selected' : ''}>📚 Clase</option>
        </select>
        <label class="checkbox-label"><input type="checkbox" id="std_enable_${key}" ${f.enabled ? 'checked' : ''}> Solicitar</label>
        <label class="checkbox-label"><input type="checkbox" id="std_req_${key}" ${f.required ? 'checked' : ''}> Obligatorio</label>
        ${isSelect ? `<button class="btn-secondary btn-sm" data-open-options="standard|${key}">⚙️ Opciones (${f.options?.length || 0})</button>` : ''}
      </div>
    </div>`;
  }).join('');
  container.querySelectorAll('button[data-open-options]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [type, key] = (btn.getAttribute('data-open-options') || '|').split('|');
      openOptionsModal(type, key);
    });
  });
}

function renderCustomFields() {
  const container = $('custom-fields-container');
  if (!container || !currentFormConfig) return;
  const fields = currentFormConfig.customFields || [];
  if (!fields.length) {
    container.innerHTML = '<p class="text-muted">No hay campos personalizados creados.</p>';
    return;
  }
  container.innerHTML = fields.map((f, i) => {
    const tipoLabel = f.type === 'select' ? 'Desplegable' : f.type === 'number' ? 'Número' : 'Texto';
    return `<div class="config-field-card">
      <div class="config-field-info">
        <strong>🟠 ${esc(f.label)}</strong>
        <span class="text-muted">${tipoLabel}</span>
      </div>
      <div class="config-field-controls">
        <select id="cust_cat_${i}" class="form-select-sm">
          <option value="clase" ${f.category === 'clase' ? 'selected' : ''}>📚 Clase</option>
          <option value="personal" ${f.category === 'personal' ? 'selected' : ''}>👤 Personal</option>
        </select>
        <label class="checkbox-label"><input type="checkbox" id="cust_enable_${i}" ${f.enabled !== false ? 'checked' : ''}> Solicitar</label>
        <label class="checkbox-label"><input type="checkbox" id="cust_req_${i}" ${f.required ? 'checked' : ''}> Obligatorio</label>
        ${f.type === 'select' ? `<button class="btn-secondary btn-sm" data-open-options="custom|${i}">⚙️ Opciones (${f.options?.length || 0})</button>` : ''}
        <button class="btn-danger btn-sm" data-remove-custom="${i}">×</button>
      </div>
    </div>`;
  }).join('');
  container.querySelectorAll('button[data-open-options]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [type, key] = (btn.getAttribute('data-open-options') || '|').split('|');
      openOptionsModal(type, key);
    });
  });
  container.querySelectorAll('button[data-remove-custom]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.getAttribute('data-remove-custom') || '-1', 10);
      if (i >= 0 && confirm('¿Eliminar este campo personalizado?')) {
        currentFormConfig!.customFields.splice(i, 1);
        renderCustomFields();
        saveCurrentFormConfig(false);
      }
    });
  });
}

function openOptionsModal(fieldType: string, keyOrIndex: string) {
  activeEditingField = { type: fieldType, keyOrIndex };
  const title = $('options-modal-title');
  if (title) {
    const f = fieldType === 'standard' ? currentFormConfig!.standardFields[keyOrIndex] : currentFormConfig!.customFields[parseInt(keyOrIndex, 10)];
    title.textContent = `⚙️ Gestionar Opciones - ${f?.label || keyOrIndex}`;
  }
  const target = fieldType === 'standard' ? currentFormConfig!.standardFields[keyOrIndex] : currentFormConfig!.customFields[parseInt(keyOrIndex, 10)];
  tempEditingOptions = [...(target?.options || [])];
  renderOptionsList();
  const modal = $('options-editor-modal');
  if (modal) modal.classList.add('show');
}

function renderOptionsList() {
  const list = $('options-items-list');
  if (!list) return;
  if (!tempEditingOptions.length) {
    list.innerHTML = '<p class="text-muted">Sin opciones. Agregá una abajo.</p>';
    return;
  }
  list.innerHTML = tempEditingOptions.map((opt, i) => `
    <div style="display:flex;gap:0.5rem;align-items:center;">
      <input type="text" value="${esc(opt)}" data-opt-index="${i}" class="form-input-sm">
      <button class="btn-danger btn-sm" data-del-opt="${i}">×</button>
    </div>`).join('');
  list.querySelectorAll('input[data-opt-index]').forEach(input => {
    input.addEventListener('change', () => {
      const i = parseInt(input.getAttribute('data-opt-index')!, 10);
      tempEditingOptions[i] = (input as HTMLInputElement).value;
    });
  });
  list.querySelectorAll('button[data-del-opt]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.getAttribute('data-del-opt')!, 10);
      tempEditingOptions.splice(i, 1);
      renderOptionsList();
    });
  });
}

function saveCurrentFormConfig(showAlert = true): boolean {
  if (!currentFormConfig) return false;
  readAsistenciaConfigFromUI();
  Object.keys(currentFormConfig.standardFields).forEach(key => {
    const f = currentFormConfig!.standardFields[key];
    f.enabled = ($(`std_enable_${key}`) as HTMLInputElement | null)?.checked ?? f.enabled;
    f.required = ($(`std_req_${key}`) as HTMLInputElement | null)?.checked ?? f.required;
    f.category = ($(`std_cat_${key}`) as HTMLSelectElement | null)?.value || f.category;
  });
  (currentFormConfig.customFields || []).forEach((f, i) => {
    f.enabled = ($(`cust_enable_${i}`) as HTMLInputElement | null)?.checked ?? f.enabled;
    f.required = ($(`cust_req_${i}`) as HTMLInputElement | null)?.checked ?? f.required;
    f.category = ($(`cust_cat_${i}`) as HTMLSelectElement | null)?.value || f.category;
  });
  fetch('/api/form-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(currentFormConfig),
    credentials: 'include'
  }).then(r => r.json()).then(data => {
    if (data.success && showAlert) alert('✅ Configuración guardada correctamente.');
  }).catch(() => {});
  return true;
}

function exportData(type: 'excel' | 'word' | 'texto') {
  window.open(`/api/export/${type}?curso=${encodeURIComponent(getCurso())}`, '_blank');
}

// ============================================================
// Init
// ============================================================
function initAdmin() {
  // Navegación por pestañas
  document.querySelectorAll('.tab-button[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      if (tabId) switchTab(tabId);
    });
  });

  // Sub-tabs estadísticas
  $('btn-estad-datos')?.addEventListener('click', () => switchEstadisticaPanel('datos'));
  $('btn-estad-presentismo')?.addEventListener('click', () => switchEstadisticaPanel('presentismo'));

  // Curso select
  const cursoSelect = $('curso-select') as HTMLSelectElement | null;
  cursoSelect?.addEventListener('change', async () => {
    const curso = cursoSelect.value;
    if (!curso) return;
    await fetch('/api/active-course', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course: curso }),
      credentials: 'include'
    });
    const status = $('active-status');
    if (status) status.textContent = `✅ Curso activo: ${curso.replace(/\.(xlsx|xls|csv)$/i, '')}`;
    cargarCfgTardanza();
    refreshAlumnosList();
    loadFechasDisponibles();
    loadStatsGroupOptions();
  });

  // Fecha por defecto
  const fechaInput = $('asistencia-fecha-input') as HTMLInputElement | null;
  if (fechaInput) fechaInput.value = localISODate();

  // Tardanza
  document.querySelectorAll('input[name="tardanza-modo"]').forEach(r => r.addEventListener('change', toggleSubPanelesTardanza));
  $('btn-guardar-tardanza')?.addEventListener('click', guardarCfgTardanza);
  $('btn-tomar-lista')?.addEventListener('click', tomarLista);

  // Stats selects
  ['stats-field-select', 'stats-group-select', 'stats-format-select', 'stats-date-select'].forEach(id => {
    $(id)?.addEventListener('change', updateStats);
  });
  ['aus-mes-select', 'aus-grupo-select'].forEach(id => {
    $(id)?.addEventListener('change', cargarAusencias);
  });

  // Asistencia
  $('btn-marcar-todos-presentes')?.addEventListener('click', () => {
    const container = $('alumnos-status-list-asistencia') || $('alumnos-status-list');
    container?.querySelectorAll('.alumno-checkbox-presente').forEach(cb => {
      const c = cb as HTMLInputElement;
      c.checked = true;
      c.dataset.tarde = 'false';
      updateCardFromCheckbox(c);
    });
    listaDirty = true;
  });
  $('btn-guardar-asistencia-fecha')?.addEventListener('click', guardarAsistenciaFecha);
  $('btn-borrar-dia-asistencia')?.addEventListener('click', async () => {
    const fecha = ($('borrar-fecha-select') as HTMLSelectElement | null)?.value;
    if (!fecha) { alert('Seleccioná una fecha para borrar.'); return; }
    if (!confirm(`¿Borrar la asistencia del día ${fecha}? Esta acción no se puede deshacer.`)) return;
    try {
      await api('/api/asistencia/borrar-dia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curso: getCurso(), fecha })
      });
      loadFechasDisponibles();
      refreshAlumnosList();
    } catch { /* error */ }
  });
  $('btn-sync-ausentes')?.addEventListener('click', async () => {
    if (!confirm('¿Sincronizar los ausentes faltantes desde hoy? Se agregarán como AUSENTES a los alumnos sin registro.')) return;
    try {
      await api('/api/admin/reconciliar-ausentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curso: getCurso() })
      });
      loadFechasDisponibles();
      refreshAlumnosList();
    } catch { /* error */ }
  });

  // Nómina
  $('btn-toggle-borrados')?.addEventListener('click', () => {
    mostrarBorrados = !mostrarBorrados;
    const btn = $('btn-toggle-borrados');
    if (btn) btn.textContent = mostrarBorrados ? '🙈 Ocultar borrados' : '🚫 Mostrar borrados';
    refreshAlumnosList();
  });
  $('btn-toggle-add-alumno')?.addEventListener('click', () => {
    const form = $('form-add-alumno-container');
    if (form) form.style.display = form.style.display === 'none' ? '' : 'none';
  });
  $('btn-guardar-nuevo-alumno')?.addEventListener('click', guardarNuevoAlumnoManual);

  // Asistencia histórica
  $('btn-consultar-asistencia')?.addEventListener('click', () => consultarAsistenciaHistorica());
  ($('consultar-asistencia-select') as HTMLSelectElement | null)?.addEventListener('change', (e) => {
    consultarAsistenciaHistorica((e.target as HTMLSelectElement).value);
  });

  // Vista alumno (demo)
  $('btn-student-view')?.addEventListener('click', () => {
    saveCurrentFormConfig(false);
    window.open('/index.html?demo=true', '_blank');
  });

  // Exportar
  $('btn-export-excel')?.addEventListener('click', () => exportData('excel'));
  $('btn-export-word')?.addEventListener('click', () => exportData('word'));
  $('btn-export-txt')?.addEventListener('click', () => exportData('texto'));

  // Config formulario
  $('btn-uncheck-all')?.addEventListener('click', () => {
    if (!currentFormConfig) return;
    Object.keys(currentFormConfig.standardFields).forEach(k => { currentFormConfig!.standardFields[k].enabled = false; });
    (currentFormConfig.customFields || []).forEach(f => { f.enabled = false; });
    renderStandardFields();
    renderCustomFields();
  });
  $('btn-check-standard')?.addEventListener('click', () => {
    if (!currentFormConfig) return;
    Object.keys(currentFormConfig.standardFields).forEach(k => { currentFormConfig!.standardFields[k].enabled = true; });
    renderStandardFields();
  });
  $('btn-check-custom')?.addEventListener('click', () => {
    if (!currentFormConfig) return;
    (currentFormConfig.customFields || []).forEach(f => { f.enabled = true; });
    renderCustomFields();
  });
  $('btn-check-latest')?.addEventListener('click', () => {
    if (!currentFormConfig) return;
    const cList = currentFormConfig.customFields || [];
    if (cList.length > 0) {
      const start = Math.max(0, cList.length - 2);
      for (let i = start; i < cList.length; i++) cList[i].enabled = true;
      renderCustomFields();
    }
  });
  $('btn-save-config-top')?.addEventListener('click', () => saveCurrentFormConfig(true));
  $('btn-add-custom-field')?.addEventListener('click', () => {
    const label = ($('new-field-label') as HTMLInputElement | null)?.value?.trim();
    const type = ($('new-field-type') as HTMLSelectElement | null)?.value || 'text';
    const category = ($('new-field-category') as HTMLSelectElement | null)?.value || 'clase';
    const optionsRaw = ($('new-field-options') as HTMLInputElement | null)?.value || '';
    const required = ($('new-field-required') as HTMLInputElement | null)?.checked || false;
    if (!label) { alert('Ingresá el nombre del campo.'); return; }
    const field: CustomField = {
      id: 'custom_' + Date.now(),
      label,
      name: label,
      type,
      category,
      enabled: true,
      required,
      options: type === 'select' ? optionsRaw.split(',').map(o => o.trim()).filter(Boolean) : []
    };
    currentFormConfig!.customFields.push(field);
    renderCustomFields();
    ($('new-field-label') as HTMLInputElement).value = '';
    ($('new-field-options') as HTMLInputElement).value = '';
    ($('new-field-required') as HTMLInputElement).checked = false;
  });
  ($('new-field-type') as HTMLSelectElement | null)?.addEventListener('change', (e) => {
    const group = $('new-field-options-group');
    if (group) group.style.display = (e.target as HTMLSelectElement).value === 'select' ? '' : 'none';
  });
  $('btn-save-config')?.addEventListener('click', () => saveCurrentFormConfig(true));

  // Opciones modal
  $('btn-add-option-item')?.addEventListener('click', () => {
    const input = $('options-new-item') as HTMLInputElement | null;
    const val = input?.value?.trim();
    if (!val) return;
    tempEditingOptions.push(val);
    if (input) input.value = '';
    renderOptionsList();
  });
  $('btn-guardar-opciones-modal')?.addEventListener('click', () => {
    if (!activeEditingField) return;
    if (activeEditingField.type === 'standard') {
      currentFormConfig!.standardFields[activeEditingField.keyOrIndex].options = [...tempEditingOptions];
    } else {
      currentFormConfig!.customFields[parseInt(activeEditingField.keyOrIndex, 10)].options = [...tempEditingOptions];
    }
    const modal = $('options-editor-modal');
    if (modal) modal.classList.remove('show');
    renderStandardFields();
    renderCustomFields();
  });
  $('close-options-modal')?.addEventListener('click', () => $('options-editor-modal')?.classList.remove('show'));

  // Modales
  $('close-student-modal')?.addEventListener('click', () => $('student-modal')?.classList.remove('show'));
  $('close-edit-modal')?.addEventListener('click', () => $('edit-student-modal')?.classList.remove('show'));
  $('btn-cancelar-edicion')?.addEventListener('click', () => $('edit-student-modal')?.classList.remove('show'));
  $('btn-guardar-edicion-alumno')?.addEventListener('click', guardarEdicionAlumnoBackend);
  $('btn-modal-editar-alumno')?.addEventListener('click', () => {
    const al = (window as any).activeModalAlumno as Alumno | undefined;
    if (al) { $('student-modal')?.classList.remove('show'); abrirModalEdicionAlumno(al); }
  });
  $('btn-modal-borrar-alumno')?.addEventListener('click', () => {
    const al = (window as any).activeModalAlumno as Alumno | undefined;
    if (al) borrarAlumno(al.nombreCompleto, false);
  });
  $('btn-modal-borrar-definitivo')?.addEventListener('click', () => {
    const al = (window as any).activeModalAlumno as Alumno | undefined;
    if (al) borrarAlumno(al.nombreCompleto, true);
  });
  $('btn-modal-delete-photo')?.addEventListener('click', async () => {
    const al = (window as any).activeModalAlumno as Alumno | undefined;
    if (!al) return;
    if (!confirm('¿Borrar la foto de rostro de este alumno?')) return;
    await api('/api/borrar-foto-alumno', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombreCompleto: al.nombreCompleto, dni: al.datos?.dni || '' })
    });
    $('student-modal')?.classList.remove('show');
    refreshAlumnosList();
  });

  // QR modal
  $('qr-container')?.addEventListener('click', () => $('qr-modal')?.classList.add('show'));
  document.querySelectorAll('.close-modal').forEach(el => {
    el.addEventListener('click', () => {
      (el.closest('.modal') as HTMLElement | null)?.classList.remove('show');
    });
  });
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target === m) m.classList.remove('show');
    });
  });

  // Cambio de contraseña
  $('btn-cancel-change-pass')?.addEventListener('click', () => {
    showScreen('login-screen');
    resetChangePasswordForm();
  });
  $('btn-change-pass-header')?.addEventListener('click', () => {
    showChangePasswordScreen(false);
    resetChangePasswordForm();
  });

  // Auto-refresco cada 10s
  setInterval(() => {
    if (listaDirty) return;
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab) return;
    const id = activeTab.id;
    if (id === 'tab-estadisticas') {
      const presVisible = $('estad-presentismo-panel')?.style.display !== 'none';
      if (presVisible) cargarAusencias(); else updateStats();
    } else if (id === 'tab-grupos') {
      loadGruposView();
    } else if (id === 'tab-alumnos' || id === 'tab-asistencia') {
      refreshAlumnosList();
    }
  }, 10000);

  // Carga inicial
  loadCursos();
  loadServerInfo();
  cargarCfgTardanza();
  prefijarPanelTardanza();
  actualizarRelojTardanza();
  setInterval(actualizarRelojTardanza, 1000);
  refreshAlumnosList();
  loadFechasDisponibles();
}

// ============================================================
// Boot
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  setupPasswordToggle('login-pass', 'btn-toggle-pass');
  setupPasswordToggle('change-pass-current', 'btn-toggle-pass-2');
  setupPasswordToggle('change-pass-new', 'btn-toggle-pass-2');
  setupPasswordToggle('change-pass-confirm', 'btn-toggle-pass-2');

  // Login form
  $('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const passInput = $('login-pass') as HTMLInputElement | null;
    const password = passInput?.value?.trim();
    if (!password) { showError('login-error', 'Ingresá la contraseña.'); return; }
    hideError('login-error');
    hideError('login-default-hint');
    const result = await doLogin(password);
    if (passInput) passInput.value = '';
    if (result.success) {
      showScreen('admin-app');
      initAdmin();
      if (result.mustChangePassword) showChangePasswordScreen(true);
    } else {
      showError('login-error', result.error || 'Contraseña incorrecta.');
    }
  });

  // Change password form
  $('change-pass-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const current = ($('change-pass-current') as HTMLInputElement | null)?.value || '';
    const newPass = ($('change-pass-new') as HTMLInputElement | null)?.value || '';
    const confirm = ($('change-pass-confirm') as HTMLInputElement | null)?.value || '';
    hideError('change-pass-error');
    if (newPass !== confirm) {
      showError('change-pass-error', 'Las contraseñas no coinciden.');
      return;
    }
    const result = await doChangePassword(current, newPass);
    if (result.success) {
      const ok = $('change-pass-success');
      if (ok) ok.textContent = '✅ Contraseña cambiada correctamente.';
      ($('change-pass-form') as HTMLFormElement | null)?.reset();
      setTimeout(() => { if (ok) ok.textContent = ''; }, 3000);
      showScreen('admin-app');
      initAdmin();
    } else {
      showError('change-pass-error', result.error || 'No se pudo cambiar la contraseña.');
    }
  });

  bootAdmin();
});