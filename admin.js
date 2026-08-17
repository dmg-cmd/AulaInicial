let statsChart = null;
let techChart = null;
let dynamicChartInstance = null;
let listaDirty = false; // True si el docente está editando las casillas de presente sin guardar
let cfgTardanza = { modo: 'manual', horaInicio: '', margenGracia: 0, minDespues: 30 };
let horaTomaListaHoy = ''; // Hora en que el docente "tomó lista" hoy (modo desplist)

function esc(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Fecha local del navegador en formato YYYY-MM-DD (igual criterio que el servidor,
// que usa la fecha local para nombrar las pestañas de asistencia). Evita el
// desfase de un día que genera toISOString() (UTC) en zonas como Argentina (UTC-3).
function localISODate(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// Devuelve la clase de color según la categoría de asistencia:
// verde = presentes, ámbar = tardes, rojo = ausentes. Fondo claro + número oscuro.
function claseEstado(nombre) {
    const n = String(nombre || '').toUpperCase();
    if (n.includes('TARDE')) return 'stat-tar';
    if (n.includes('AUSEN') || n.includes('AUSENT') || n.includes('FALTA')) return 'stat-aus';
    return 'stat-pres';
}

// Color sólido para gráficos Chart.js (mismo criterio de verde/ámbar/rojo).
function colorEstado(nombre) {
    const n = String(nombre || '').toUpperCase();
    if (n.includes('TARDE')) return 'rgba(251, 191, 36, 0.85)';
    if (n.includes('AUSEN') || n.includes('AUSENT') || n.includes('FALTA')) return 'rgba(239, 68, 68, 0.85)';
    return 'rgba(34, 197, 94, 0.85)';
}

const cursoSelect = document.getElementById('curso-select');
const activeStatus = document.getElementById('active-status');
const qrImage = document.getElementById('qr-image');
const qrImageLarge = document.getElementById('qr-image-large');
const qrModal = document.getElementById('qr-modal');
const qrContainer = document.getElementById('qr-container');
const closeModal = document.querySelector('.close-modal');
const studentModal = document.getElementById('student-modal');
const closeStudentModal = document.getElementById('close-student-modal');
const viewGestion = document.getElementById('view-gestion');
const viewStats = document.getElementById('view-stats');
const btnShowStats = document.getElementById('btn-show-stats');
const viewGrupos = document.getElementById('view-grupos');
const btnShowGrupos = document.getElementById('btn-show-grupos');
const gruposCardsContainer = document.getElementById('grupos-cards-container');

// Elementos del Panel Dinámico de Estadísticas
const statsFieldSelect = document.getElementById('stats-field-select');
const statsGroupSelect = document.getElementById('stats-group-select');
const statsFormatSelect = document.getElementById('stats-format-select');
const statsDynamicHeader = document.getElementById('stats-dynamic-header');
const dynamicChartContainer = document.getElementById('dynamicChartContainer');
const dynamicTableContainer = document.getElementById('dynamicTableContainer');
const statsTableBody = document.getElementById('statsTableBody');

async function loadFechasDisponibles() {
    try {
        const cursoSel    = document.getElementById('curso-select');
        const dateSel     = document.getElementById('stats-date-select');
        const consultSel  = document.getElementById('consultar-asistencia-select');
        const borrarSel   = document.getElementById('borrar-fecha-select');
        if (!cursoSel) return;

        const currentCourse = cursoSel.value;
        if (!currentCourse) return;

        const res = await fetch(`/api/fechas-disponibles?curso=${encodeURIComponent(currentCourse)}&t=${Date.now()}`);
        const fechas = await res.json();

        if (borrarSel) {
            const currentBorrar = borrarSel.value;
            borrarSel.innerHTML = '<option value="">Selecciona una fecha guardada</option>';
            const dateFechas = fechas.filter(f => f.id !== 'TODAS');
            dateFechas.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = `📅 ${f.id}`;
                borrarSel.appendChild(opt);
            });
            if (currentBorrar && Array.from(borrarSel.options).some(o => o.value === currentBorrar)) {
                borrarSel.value = currentBorrar;
            }
        }

        if (dateSel) {
            const currentVal = dateSel.value || 'TODOS';
            dateSel.innerHTML = '';
            fechas.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = f.label;
                dateSel.appendChild(opt);
            });
            if (Array.from(dateSel.options).some(o => o.value === currentVal)) {
                dateSel.value = currentVal;
            }
        }

        if (consultSel) {
            const currentCons = consultSel.value;
            consultSel.innerHTML = '<option value="">-- Seleccionar fecha previa --</option>';
            const dateFechas = fechas.filter(f => f.id !== 'TODOS');
            dateFechas.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = `📅 ${f.id}`;
                consultSel.appendChild(opt);
            });
            if (currentCons && Array.from(consultSel.options).some(o => o.value === currentCons)) {
                consultSel.value = currentCons;
            } else if (dateFechas.length > 0) {
                // Seleccionar por defecto la fecha más reciente
                consultSel.value = dateFechas[dateFechas.length - 1].id;
            }
            if (consultSel.value) {
                consultarAsistenciaHistorica(consultSel.value);
            }
        }
    } catch (err) {
        console.error('Error al cargar fechas disponibles:', err);
    }
}

async function consultarAsistenciaHistorica(targetFecha = '') {
    try {
        const cursoSel   = document.getElementById('curso-select');
        const consultSel = document.getElementById('consultar-asistencia-select');
        const tableWrap  = document.getElementById('tabla-asistencia-historica-container');
        const tableBody  = document.getElementById('tabla-asistencia-historica-body');
        const badge      = document.getElementById('resumen-asistencia-badge');

        const currentCourse = cursoSel ? cursoSel.value : '';
        if (!currentCourse) {
            alert('Selecciona un curso activo primero.');
            return;
        }

        const fechaReq = targetFecha || (consultSel ? consultSel.value : '');

        const res = await fetch(`/api/asistencia/consultar?curso=${encodeURIComponent(currentCourse)}&fecha=${encodeURIComponent(fechaReq)}&t=${Date.now()}`);
        const data = await res.json();

        if (!data.fecha || !Array.isArray(data.alumnos) || data.alumnos.length === 0) {
            if (badge) badge.textContent = 'Sin asistencia guardada aún';
            if (tableWrap) tableWrap.style.display = 'none';
            return;
        }

        if (badge) {
            badge.innerHTML = `<span style="color:#38bdf8;">📅 Fecha: ${data.fecha}</span> | <span style="color:#34d399;">Presentes: ${data.totalPresentes}</span> | <span style="color:#fbbf24;">Tardes: ${data.totalTardes || 0}</span> | <span style="color:#f87171;">Ausentes: ${data.totalAusentes}</span>`;
        }

        if (tableBody) {
            tableBody.innerHTML = '';
            data.alumnos.forEach(item => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid rgba(255,255,255,0.08)';
                const estado = item.asistencia === 'PRESENTE TARDÍO' ? 'tardio' : (item.asistencia === 'TARDE' ? 'tarde' : (item.asistencia === 'PRESENTES' ? 'presente' : 'ausente'));
                const color = estado === 'presente' ? '#34d399' : (estado === 'tarde' ? '#fbbf24' : (estado === 'tardio' ? '#fb923c' : '#f87171'));
                const bg = estado === 'presente' ? 'rgba(52,211,153,0.2)' : (estado === 'tarde' ? 'rgba(251,191,36,0.2)' : (estado === 'tardio' ? 'rgba(251,146,60,0.2)' : 'rgba(248,113,113,0.2)'));
                const border = estado === 'presente' ? 'rgba(52,211,153,0.4)' : (estado === 'tarde' ? 'rgba(251,191,36,0.4)' : (estado === 'tardio' ? 'rgba(251,146,60,0.4)' : 'rgba(248,113,113,0.4)'));
                const label = estado === 'presente' ? '✅ PRESENTE' : (estado === 'tarde' ? '🟡 TARDE' : (estado === 'tardio' ? '🟠 LLEGÓ TARDE' : '❌ AUSENTE'));

                const tdNombre = document.createElement('td');
                tdNombre.style.cssText = 'padding: 0.6rem 0.8rem; font-weight: 600; color: #f8fafc;';
                tdNombre.textContent = item.alumno;
                const tdDni = document.createElement('td');
                tdDni.style.cssText = 'padding: 0.6rem 0.8rem;';
                tdDni.textContent = item.dni;
                const tdGrupo = document.createElement('td');
                tdGrupo.style.cssText = 'padding: 0.6rem 0.8rem;';
                tdGrupo.textContent = item.grupo;
                const tdEstado = document.createElement('td');
                tdEstado.style.cssText = 'padding: 0.6rem 0.8rem; text-align: center;';
                const badge = document.createElement('span');
                badge.style.cssText = `display: inline-block; padding: 0.2rem 0.6rem; border-radius: 4px; font-weight: 700; font-size: 0.8rem; background: ${bg}; color: ${color}; border: 1px solid ${border};`;
                badge.textContent = label;
                tdEstado.appendChild(badge);
                const tdHora = document.createElement('td');
                tdHora.style.cssText = 'padding: 0.6rem 0.8rem; text-align: center; opacity: 0.8;';
                tdHora.textContent = item.hora;

                tr.appendChild(tdNombre);
                tr.appendChild(tdDni);
                tr.appendChild(tdGrupo);
                tr.appendChild(tdEstado);
                tr.appendChild(tdHora);
                tableBody.appendChild(tr);
            });
        }

        if (tableWrap) tableWrap.style.display = 'block';

    } catch (err) {
        console.error('Error al consultar asistencia histórica:', err);
    }
}

async function updateStats() {
    try {
        // Siempre releer del DOM en el momento de ejecución
        const fieldSel   = document.getElementById('stats-field-select');
        const groupSel   = document.getElementById('stats-group-select');
        const formatSel  = document.getElementById('stats-format-select');
        const dateSel    = document.getElementById('stats-date-select');
        const dynHeader  = document.getElementById('stats-dynamic-header');
        const chartWrap  = document.getElementById('dynamicChartContainer');
        const tableWrap  = document.getElementById('dynamicTableContainer');
        const tableBody  = document.getElementById('statsTableBody');
        const cursoSel   = document.getElementById('curso-select');

        // Determinar el curso activo
        let currentCourse = cursoSel ? cursoSel.value : '';
        if (!currentCourse && cursoSel) {
            for (let i = 0; i < cursoSel.options.length; i++) {
                if (cursoSel.options[i].value) {
                    currentCourse = cursoSel.options[i].value;
                    cursoSel.selectedIndex = i;
                    break;
                }
            }
        }

        if (!currentCourse) {
            if (dynHeader) dynHeader.textContent = '⚠️ Selecciona un curso activo para visualizar estadísticas';
            if (chartWrap) chartWrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;opacity:0.7;padding:2rem;"><p>Selecciona un curso en el panel superior para cargar los datos.</p></div>';
            return;
        }

        const selectedField  = fieldSel  ? (fieldSel.value  || 'titulo') : 'titulo';
        const selectedGroup  = groupSel  ? (groupSel.value  || 'TODOS')  : 'TODOS';
        const selectedFormat = formatSel ? (formatSel.value || 'bar')    : 'bar';
        const selectedDate   = dateSel   ? (dateSel.value   || 'TODOS')  : 'TODOS';

        // Llamar a la API de estadísticas con parámetro t para evitar caché
        const res = await fetch(`/api/stats?curso=${encodeURIComponent(currentCourse)}&campo=${encodeURIComponent(selectedField)}&grupo=${encodeURIComponent(selectedGroup)}&fecha=${encodeURIComponent(selectedDate)}&t=${Date.now()}`);
        if (!res.ok) {
            console.error('Error HTTP en /api/stats:', res.status);
            if (dynHeader) dynHeader.textContent = '❌ Error al consultar las estadísticas en el servidor';
            if (chartWrap) chartWrap.innerHTML = `<div style="padding:2rem;text-align:center;color:#f87171;"><p>No se pudo obtener las estadísticas (Error HTTP ${res.status}). Verifica el curso activo o reinicia el servidor.</p></div>`;
            return;
        }
        const statsRes = await res.json();

        // Actualizar las opciones del selector de campo si cambiaron
        if (fieldSel && Array.isArray(statsRes.availableFields) && statsRes.availableFields.length > 0) {
            const currentVal = fieldSel.value;
            const newIds = statsRes.availableFields.map(f => f.id);
            const existingIds = Array.from(fieldSel.options).map(o => o.value);
            if (JSON.stringify(existingIds) !== JSON.stringify(newIds)) {
                fieldSel.innerHTML = '';
                statsRes.availableFields.forEach(f => {
                    const opt = document.createElement('option');
                    opt.value = f.id;
                    opt.textContent = f.label;
                    fieldSel.appendChild(opt);
                });
            }
            if (currentVal && newIds.includes(currentVal)) {
                fieldSel.value = currentVal;
            } else if (newIds.length > 0) {
                fieldSel.value = newIds[0];
            }
        }

        let dataItems = statsRes.data || [];
        const realItems = dataItems.filter(item => item.name !== 'NO ESPECIFICADO');
        if (realItems.length > 0) dataItems = realItems;

        const totalCount = dataItems.reduce((a, b) => a + b.count, 0);
        const totalAlumnosEnHoja = statsRes.totalAlumnosSheet || totalCount;

        const fieldObj   = (statsRes.availableFields || []).find(f => f.id === (fieldSel ? fieldSel.value : selectedField));
        const fieldLabel = fieldObj ? fieldObj.label : (fieldSel ? fieldSel.value : selectedField).toUpperCase();
        const groupLabel = selectedGroup === 'TODOS' ? 'Todos los Grupos' : `Grupo ${selectedGroup}`;
        const dateLabel  = selectedDate === 'TODOS' ? 'Resumen Acumulado' : `Fecha: ${selectedDate}`;

        if (dynHeader) {
            dynHeader.textContent = `📊 Muestra: ${fieldLabel} | ${dateLabel} | ${groupLabel} — Total Alumnos: ${totalAlumnosEnHoja} (${totalCount} respuestas)`;
        }

        // Si no hay datos registrados
        if (dataItems.length === 0) {
            if (tableWrap) tableWrap.style.display = 'none';
            if (chartWrap) {
                chartWrap.style.display = 'block';
                const esAsistencia = selectedField === 'asistencia';
                const mensajePrincipal = esAsistencia
                    ? 'Aún no se registró asistencia para este curso.'
                    : `Este curso no tiene respuestas de formulario para «${esc(fieldLabel)}».`;
                const mensajeSecundario = esAsistencia
                    ? 'Tomá la asistencia en la pestaña "📋 Asistencia" para generar esta estadística.'
                    : 'Es normal si al crear el curso no se habilitaron estos campos. La estadística de Asistencia sí está disponible en la pestaña "📋 Presentismo / Ausencias". También podés probar otro campo (ej. Tecnología o Grupo) o cambiar el filtro de grupo/fecha.';
                chartWrap.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;opacity:0.85;padding:2rem;text-align:center;">
                        <span style="font-size:3rem;margin-bottom:0.5rem;">📭</span>
                        <p style="font-size:1.1rem;font-weight:600;margin:0;color:#f8fafc;">${mensajePrincipal}</p>
                        <p style="font-size:0.85rem;opacity:0.85;margin-top:0.5rem;color:#cbd5e1;max-width:520px;">${mensajeSecundario}</p>
                    </div>`;
            }
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="3" style="padding:2rem;text-align:center;opacity:0.6;">Sin datos registrados aún.</td></tr>';
            }
            return;
        }

        // ── RENDERING TABLA ───────────────────────────────────────────────
        if (selectedFormat === 'table') {
            if (chartWrap) chartWrap.style.display = 'none';
            if (tableWrap) tableWrap.style.display = 'block';
            if (tableBody) {
                tableBody.innerHTML = '';
                dataItems.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid rgba(255,255,255,0.08)';

                    const tdName = document.createElement('td');
                    tdName.className = (item.count > 0) ? claseEstado(item.name) : '';
                    tdName.style.cssText = 'padding:0.8rem 1rem;text-align:center;font-weight:700;';
                    tdName.textContent = item.name;
                    const tdCount = document.createElement('td');
                    tdCount.style.cssText = 'padding:0.8rem 1rem;text-align:center;font-weight:600;';
                    tdCount.textContent = `${item.count} alumno(s)`;
                    const tdPct = document.createElement('td');
                    tdPct.style.cssText = 'padding:0.8rem 1rem;text-align:center;';
                    const pctWrap = document.createElement('div');
                    pctWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:0.8rem;';
                    const pctSpan = document.createElement('span');
                    pctSpan.style.cssText = `font-weight:700;color:${colorEstado(item.name)};min-width:42px;text-align:right;`;
                    pctSpan.textContent = `${item.percentage}%`;
                    const barWrap = document.createElement('div');
                    barWrap.style.cssText = 'flex:1;max-width:120px;background:rgba(255,255,255,0.1);height:8px;border-radius:4px;overflow:hidden;';
                    const bar = document.createElement('div');
                    bar.style.cssText = `width:${item.percentage}%;background:linear-gradient(90deg,#6366f1,#a855f7);height:100%;`;
                    barWrap.appendChild(bar);
                    pctWrap.appendChild(pctSpan);
                    pctWrap.appendChild(barWrap);
                    tdPct.appendChild(pctWrap);

                    tr.appendChild(tdName);
                    tr.appendChild(tdCount);
                    tr.appendChild(tdPct);
                    tableBody.appendChild(tr);
                });
            }
            return;
        }

        // ── RENDERING GRÁFICO (Chart.js / Fallback HTML) ───────────────────
        if (tableWrap) tableWrap.style.display = 'none';
        if (chartWrap) chartWrap.style.display = 'block';

        // Si Chart.js no está disponible (ej. sin internet o fallo de CDN), usar fallback de barras HTML estilizadas
        if (typeof Chart === 'undefined') {
            if (chartWrap) {
                chartWrap.innerHTML = '';
                const container = document.createElement('div');
                container.style.cssText = 'padding:1rem;height:100%;overflow-y:auto;display:flex;flex-direction:column;gap:0.8rem;';
                dataItems.forEach(item => {
                    const barRow = document.createElement('div');
                    const header = document.createElement('div');
                    header.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:0.3rem;font-size:0.9rem;font-weight:600;';
                    const nameSpan = document.createElement('span');
                    nameSpan.textContent = item.name;
                    const countSpan = document.createElement('span');
                    countSpan.style.color = colorEstado(item.name);
                    countSpan.textContent = `${item.count} alumno(s) (${item.percentage}%)`;
                    header.appendChild(nameSpan);
                    header.appendChild(countSpan);
                    const track = document.createElement('div');
                    track.style.cssText = 'background:rgba(255,255,255,0.1);height:14px;border-radius:7px;overflow:hidden;';
                    const fill = document.createElement('div');
                    fill.style.cssText = `width:${item.percentage}%;background:${colorEstado(item.name)};height:100%;transition:width 0.5s ease;`;
                    track.appendChild(fill);
                    barRow.appendChild(header);
                    barRow.appendChild(track);
                    container.appendChild(barRow);
                });
                chartWrap.appendChild(container);
            }
            return;
        }

        // Destruir instancia previa de Chart.js
        if (dynamicChartInstance) {
            dynamicChartInstance.destroy();
            dynamicChartInstance = null;
        }

        // Recrear canvas dinámico
        if (chartWrap) {
            chartWrap.innerHTML = '';
            const newCanvas = document.createElement('canvas');
            newCanvas.id = 'dynamicChart';
            newCanvas.style.width  = '100%';
            newCanvas.style.height = '100%';
            chartWrap.appendChild(newCanvas);
        }

        const ctxCanvas = document.getElementById('dynamicChart');
        if (!ctxCanvas) return;

        const labels  = dataItems.map(d => d.name);
        const counts  = dataItems.map(d => d.count);
        const pcts    = dataItems.map(d => d.percentage);

        const palette = [
            'rgba(99,102,241,0.85)',
            'rgba(168,85,247,0.85)',
            'rgba(236,72,153,0.85)',
            'rgba(52,211,153,0.85)',
            'rgba(251,191,36,0.85)',
            'rgba(56,189,248,0.85)',
            'rgba(248,113,113,0.85)',
            'rgba(147,51,234,0.85)',
            'rgba(34,197,94,0.85)'
        ];
        const borders = palette.map(c => c.replace('0.85', '1'));
        // Para el campo de asistencia, colorear cada barra según su categoría
        // (verde= Presentes, ámbar= Tardes, rojo= Ausentes). En otro caso, paleta genérica.
        const usarColorAsistencia = (typeof selectedField !== 'undefined' && selectedField === 'asistencia');
        const bgColors = usarColorAsistencia
            ? labels.map(l => colorEstado(l))
            : palette.slice(0, labels.length);
        const bdColors = usarColorAsistencia
            ? labels.map(l => colorEstado(l).replace('0.85', '1'))
            : borders.slice(0, labels.length);

        const isFill = selectedFormat === 'line' || selectedFormat === 'radar';
        let indexAxis = 'x';
        if (selectedFormat === 'bar') indexAxis = labels.length > 5 ? 'y' : 'x';

        const chartConfig = {
            type: selectedFormat,
            data: {
                labels,
                datasets: [{
                    label: 'Alumnos',
                    data: counts,
                    backgroundColor: isFill ? 'rgba(99,102,241,0.2)' : bgColors,
                    borderColor:     isFill ? 'rgba(99,102,241,1)'   : bdColors,
                    borderWidth: 2,
                    borderRadius: selectedFormat === 'bar' ? 6 : 0,
                    fill: isFill
                }]
            },
            options: {
                indexAxis,
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: ['doughnut','pie','polarArea','radar'].includes(selectedFormat),
                        position: 'bottom',
                        labels: { color: 'white', font: { family: 'Outfit', size: 12 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${counts[ctx.dataIndex]} alumno(s) (${pcts[ctx.dataIndex]}%)`
                        }
                    }
                }
            }
        };

        if (['bar','line'].includes(selectedFormat)) {
            chartConfig.options.scales = {
                x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: 'white', font: { family: 'Outfit' } } },
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: 'white', stepSize: 1, font: { family: 'Outfit' } } }
            };
        } else if (['radar','polarArea'].includes(selectedFormat)) {
            chartConfig.options.scales = {
                r: {
                    grid: { color: 'rgba(255,255,255,0.15)' },
                    ticks: { color: 'white', backdropColor: 'transparent' },
                    pointLabels: { color: 'white', font: { family: 'Outfit', size: 12 } }
                }
            };
        }

        dynamicChartInstance = new Chart(ctxCanvas, chartConfig);

    } catch (err) {
        console.error('Error en updateStats:', err);
    }
};

let currentFormConfig = {
    standardFields: {},
    customFields: []
};

const viewConfig = document.getElementById('view-config');
const btnShowConfig = document.getElementById('btn-show-config');
const btnSaveConfig = document.getElementById('btn-save-config');
const btnAddCustomField = document.getElementById('btn-add-custom-field');
const newFieldType = document.getElementById('new-field-type');
const newFieldOptionsGroup = document.getElementById('new-field-options-group');

function switchTab(tabId) {
    const tabButtons = document.querySelectorAll('.tab-button[data-tab]');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    tabContents.forEach(content => {
        if (content.id === tabId) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });

    // Refrescos dinámicos según la pestaña activa
    if (tabId === 'tab-alumnos') {
        refreshAlumnosList();
    } else if (tabId === 'tab-formulario') {
        loadAdminFormConfig();
    } else if (tabId === 'tab-asistencia') {
        loadServerInfo();
        cargarCfgTardanza().then(() => {
            prefijarPanelTardanza();
            actualizarRelojTardanza();
        });
        refreshAlumnosList();
    } else if (tabId === 'tab-asist-historica') {
        loadFechasDisponibles();
        consultarAsistenciaHistorica();
    } else if (tabId === 'tab-estadisticas') {
        switchEstadisticaPanel('presentismo');
        loadFechasDisponibles();
    } else if (tabId === 'tab-grupos') {
        loadGruposView();
    }
}

// --- Tardanza automática: reloj en vivo + config por curso (guardada en el xlsx) ---
async function cargarCfgTardanza() {
    const curso = cursoSelect ? cursoSelect.value : '';
    if (!curso) return;
    try {
        const res = await fetch(`/api/asistencia/cfg?curso=${encodeURIComponent(curso)}&t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        cfgTardanza = data.cfg || { modo: 'manual', horaInicio: '', margenGracia: 0, minDespues: 30 };
        horaTomaListaHoy = data.horaTomaListaHoy || '';
        const estado = document.getElementById('toma-lista-estado');
        if (estado) {
            estado.textContent = horaTomaListaHoy
                ? `Lista tomada hoy a las ${horaTomaListaHoy}`
                : 'Aún no se tomó lista hoy';
        }
    } catch (e) {
        console.error('Error cargando cfg de tardanza:', e);
    }
}

function calcularLimiteMin(cfg, horaTomaLista) {
    if (!cfg || cfg.modo === 'manual') return null;
    if (cfg.modo === 'horario') {
        const m = (cfg.horaInicio || '').match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return null;
        return parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + (parseInt(cfg.margenGracia, 10) || 0);
    }
    if (cfg.modo === 'desplist') {
        const m = (horaTomaLista || '').match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return null;
        return parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + (parseInt(cfg.minDespues, 10) || 30);
    }
    return null;
}

function pasoLimiteAhora(cfg, horaTomaLista) {
    const lim = calcularLimiteMin(cfg, horaTomaLista);
    if (lim === null) return false;
    const ahora = new Date();
    return (ahora.getHours() * 60 + ahora.getMinutes()) > lim;
}

function actualizarRelojTardanza() {
    const el = document.getElementById('reloj-tardanza');
    if (!el) return;
    const ahora = new Date();
    const hh = String(ahora.getHours()).padStart(2, '0');
    const mm = String(ahora.getMinutes()).padStart(2, '0');
    const ss = String(ahora.getSeconds()).padStart(2, '0');
    const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes();
    let limiteTxt = '—';
    let estadoTxt = '';
    const lim = calcularLimiteMin(cfgTardanza, horaTomaListaHoy);
    if (lim === null) {
        limiteTxt = 'sin detección automática';
    } else {
        const lh = String(Math.floor(lim / 60)).padStart(2, '0');
        const lm = String(lim % 60).padStart(2, '0');
        limiteTxt = `${lh}:${lm}`;
        const diff = ahoraMin - lim;
        estadoTxt = diff <= 0 ? `⏳ Faltan ${(-diff)} min para límite` : `⚠️ Vencido hace ${diff} min`;
    }
    el.innerHTML = `<span class="reloj-hora">🕒 ${hh}:${mm}:${ss}</span><span class="reloj-limite">Límite: ${limiteTxt}</span><span class="reloj-estado">${estadoTxt}</span>`;
}

function prefijarPanelTardanza() {
    const modo = cfgTardanza.modo || 'manual';
    document.querySelectorAll('input[name="tardanza-modo"]').forEach(r => { r.checked = (r.value === modo); });
    const hIni = document.getElementById('tardanza-hora-inicio');
    const margen = document.getElementById('tardanza-margen');
    const minDesp = document.getElementById('tardanza-min-despues');
    if (hIni) hIni.value = cfgTardanza.horaInicio || '';
    if (margen) margen.value = cfgTardanza.margenGracia || 0;
    if (minDesp) minDesp.value = cfgTardanza.minDespues || 30;
    toggleSubPanelesTardanza();
}

function toggleSubPanelesTardanza() {
    const sel = document.querySelector('input[name="tardanza-modo"]:checked');
    const modo = sel ? sel.value : 'manual';
    const hor = document.getElementById('tardanza-horario');
    const des = document.getElementById('tardanza-desplist');
    if (hor) hor.hidden = (modo !== 'horario');
    if (des) des.hidden = (modo !== 'desplist');
}

function wireTardanzaUI() {
    document.querySelectorAll('input[name="tardanza-modo"]').forEach(r => {
        r.addEventListener('change', toggleSubPanelesTardanza);
    });
    const btnGuardar = document.getElementById('btn-guardar-tardanza');
    if (btnGuardar) btnGuardar.addEventListener('click', guardarCfgTardanza);
    const btnTomar = document.getElementById('btn-tomar-lista');
    if (btnTomar) btnTomar.addEventListener('click', tomarLista);
}

async function guardarCfgTardanza() {
    const curso = cursoSelect ? cursoSelect.value : '';
    if (!curso) { alert('Selecciona un curso primero.'); return; }
    const sel = document.querySelector('input[name="tardanza-modo"]:checked');
    const modo = sel ? sel.value : 'manual';
    const hIni = document.getElementById('tardanza-hora-inicio');
    const margen = document.getElementById('tardanza-margen');
    const minDesp = document.getElementById('tardanza-min-despues');
    const payload = {
        curso,
        modo,
        horaInicio: hIni ? hIni.value : '',
        margenGracia: margen ? parseInt(margen.value, 10) || 0 : 0,
        minDespues: minDesp ? parseInt(minDesp.value, 10) || 30 : 30
    };
    try {
        const res = await fetch('/api/asistencia/cfg', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            cfgTardanza = data.cfg;
            const g = document.getElementById('tardanza-guardado');
            if (g) { g.textContent = '✅ Guardado'; setTimeout(() => { g.textContent = ''; }, 2500); }
            await cargarCfgTardanza();
            actualizarRelojTardanza();
            refreshAlumnosList();
        } else {
            alert('Error: ' + (data.error || 'No se pudo guardar.'));
        }
    } catch (e) {
        console.error('Error guardando cfg tardanza:', e);
        alert('Error de red al guardar la configuración.');
    }
}

async function tomarLista() {
    const curso = cursoSelect ? cursoSelect.value : '';
    if (!curso) { alert('Selecciona un curso primero.'); return; }
    try {
        const res = await fetch('/api/asistencia/tomar-lista', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ curso })
        });
        const data = await res.json();
        if (data.success) {
            horaTomaListaHoy = data.hora;
            const estado = document.getElementById('toma-lista-estado');
            if (estado) estado.textContent = `Lista tomada hoy a las ${data.hora}`;
            actualizarRelojTardanza();
            refreshAlumnosList();
        } else {
            alert('Error: ' + (data.error || 'No se pudo registrar.'));
        }
    } catch (e) {
        console.error('Error al tomar lista:', e);
        alert('Error de red al tomar lista.');
    }
}

function switchEstadisticaPanel(panel) {
    const datosPanel = document.getElementById('estad-datos-panel');
    const presPanel = document.getElementById('estad-presentismo-panel');
    const btnDatos = document.getElementById('btn-estad-datos');
    const btnPres = document.getElementById('btn-estad-presentismo');

    const showDatos = panel === 'datos';
    if (datosPanel) datosPanel.style.display = showDatos ? 'block' : 'none';
    if (presPanel) presPanel.style.display = showDatos ? 'none' : 'block';
    if (btnDatos) btnDatos.classList.toggle('active', showDatos);
    if (btnPres) btnPres.classList.toggle('active', !showDatos);

    if (showDatos) {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => updateStats());
        });
        setTimeout(() => {
            if (typeof Chart !== 'undefined') {
                try {
                    if (typeof dynamicChartInstance !== 'undefined' && dynamicChartInstance) dynamicChartInstance.resize();
                } catch (e) { /* sin gráfico aún */ }
            }
        }, 120);
    } else {
        loadStatsGroupOptions();
        cargarAusencias();
    }
}

async function initAdmin() {
    await loadCursos();
    await loadServerInfo();
    await loadStatsGroupOptions();
    await loadFechasDisponibles();
    refreshAlumnosList();
    consultarAsistenciaHistorica();
    updateStats();
    cargarAusencias();

    // Listeners para las pestañas de navegación superiores
    document.querySelectorAll('.tab-button[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            if (targetTab) switchTab(targetTab);
        });
    });

    // Establecer la fecha de hoy por defecto en el input de asistencia
    const fechaInput = document.getElementById('asistencia-fecha-input');
    if (fechaInput && !fechaInput.value) {
        fechaInput.value = localISODate();
    }

    // Tardanza automática: cablear panel, reloj en vivo y recarga al cambiar de curso
    wireTardanzaUI();
    setInterval(actualizarRelojTardanza, 1000);
    if (cursoSelect) {
        cursoSelect.addEventListener('change', () => {
            cargarCfgTardanza().then(() => {
                prefijarPanelTardanza();
                actualizarRelojTardanza();
            });
        });
    }

    // Listeners para cambio interactivo en los controles de estadísticas
    const statsDateSel = document.getElementById('stats-date-select');
    if (statsFieldSelect) statsFieldSelect.addEventListener('change', () => updateStats());
    if (statsGroupSelect) statsGroupSelect.addEventListener('change', () => updateStats());
    if (statsFormatSelect) statsFormatSelect.addEventListener('change', () => updateStats());
    if (statsDateSel) statsDateSel.addEventListener('change', () => updateStats());

    // Listeners para el panel de ausencias por mes
    const ausMesSel = document.getElementById('aus-mes-select');
    const ausGrupoSel = document.getElementById('aus-grupo-select');
    if (ausMesSel) ausMesSel.addEventListener('change', () => cargarAusencias());
    if (ausGrupoSel) ausGrupoSel.addEventListener('change', () => cargarAusencias());

    // Botón para marcar todos presentes
    const btnMarcarTodos = document.getElementById('btn-marcar-todos-presentes');
    if (btnMarcarTodos) {
        btnMarcarTodos.addEventListener('click', () => {
            const container = document.getElementById('alumnos-status-list-asistencia') || document.getElementById('alumnos-status-list');
            if (container) {
                container.querySelectorAll('.alumno-checkbox-presente').forEach(chk => {
                    chk.checked = true;
                    chk.dataset.tarde = 'false';
                });
                container.querySelectorAll('.btn-tarde').forEach(btn => btn.classList.remove('active'));
                container.querySelectorAll('.status-item.late').forEach(item => item.classList.remove('late'));
                container.querySelectorAll('.status-item.compact').forEach(item => {
                    item.classList.add('completed');
                    item.classList.remove('late');
                    item.classList.remove('pending');
                });
            }
            listaDirty = true;
        });
    }

    // Botón para borrar un día de asistencia (día de prueba o curso equivocado)
    const btnBorrarDia = document.getElementById('btn-borrar-dia-asistencia');
    if (btnBorrarDia) {
        btnBorrarDia.addEventListener('click', async () => {
            const borrarSel = document.getElementById('borrar-fecha-select');
            const fechaHoja = borrarSel ? borrarSel.value.trim() : '';
            if (!fechaHoja) {
                alert('Selecciona primero una fecha guardada de la lista para borrar.');
                if (borrarSel) borrarSel.focus();
                return;
            }

            if (!confirm(`¿Estás seguro de borrar TODO el día de asistencia ${fechaHoja}?\n\nEsta acción no se puede deshacer y se recalcularán los totales del curso.`)) {
                return;
            }

            try {
                const res = await fetch('/api/asistencia/borrar-dia', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fecha: fechaHoja })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    alert(`✅ Día ${data.fecha} borrado correctamente.`);
                    if (borrarSel) borrarSel.value = '';
                    await loadFechasDisponibles();
                    consultarAsistenciaHistorica();
                    refreshAlumnosList();
                } else {
                    alert('❌ No se pudo borrar el día: ' + (data.error || 'Error desconocido'));
                }
            } catch (err) {
                console.error('Error al borrar día:', err);
                alert('❌ Error de red al borrar el día de asistencia.');
            }
        });
    }

    // Botón para sincronizar ausentes faltantes (asegura AUSENTES desde hoy, sin retroactividad)
    const btnSyncAusentes = document.getElementById('btn-sync-ausentes');
    if (btnSyncAusentes) {
        btnSyncAusentes.addEventListener('click', async () => {
            if (!confirm('¿Sincronizar ausentes faltantes?\n\nSe agregará una fila AUSENTE (desde hoy en adelante) en el historial para los alumnos de la Nómina que aún no tengan registro en cada día. Los días pasados no se modifican.')) {
                return;
            }
            try {
                const currentCourse = cursoSelect.value;
                const res = await fetch('/api/admin/reconciliar-ausentes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ curso: currentCourse })
                });
                const data = await res.json();
                if (data.success) {
                    alert('✅ Ausentes faltantes sincronizados (desde hoy).');
                    await refreshAlumnosList();
                    loadFechasDisponibles();
                    updateStats();
                } else {
                    alert('❌ No se pudo sincronizar: ' + (data.error || 'Error desconocido'));
                }
            } catch (err) {
                console.error('Error al sincronizar ausentes:', err);
                alert('❌ Error de red al sincronizar ausentes.');
            }
        });
    }

    // Botón para mostrar/ocultar alumnos borrados (lógicamente) en la Nómina
    const btnToggleBorrados = document.getElementById('btn-toggle-borrados');
    if (btnToggleBorrados) {
        btnToggleBorrados.addEventListener('click', () => {
            mostrarBorrados = !mostrarBorrados;
            btnToggleBorrados.textContent = mostrarBorrados ? '✅ Ocultar borrados' : '🚫 Mostrar borrados';
            btnToggleBorrados.style.opacity = mostrarBorrados ? '1' : '0.85';
            refreshAlumnosList();
        });
    }

    // Botones para consultar asistencias guardadas por fecha
    const btnConsultarAsis = document.getElementById('btn-consultar-asistencia');
    const consultSel       = document.getElementById('consultar-asistencia-select');
    if (btnConsultarAsis) {
        btnConsultarAsis.addEventListener('click', () => consultarAsistenciaHistorica());
    }
    if (consultSel) {
        consultSel.addEventListener('change', () => consultarAsistenciaHistorica());
    }

    // Botón para desplegar formulario de agregar alumno manualmente
    const btnToggleAdd = document.getElementById('btn-toggle-add-alumno');
    const containerAdd = document.getElementById('form-add-alumno-container');
    if (btnToggleAdd && containerAdd) {
        btnToggleAdd.addEventListener('click', () => {
            const estaOculto = containerAdd.style.display === 'none';
            containerAdd.style.display = estaOculto ? 'block' : 'none';
            btnToggleAdd.textContent = estaOculto ? '❌ Cerrar Formulario' : '➕ Abrir Formulario';
        });
    }

    // Botón para guardar nuevo alumno manual
    const btnGuardarNuevo = document.getElementById('btn-guardar-nuevo-alumno');
    if (btnGuardarNuevo) {
        btnGuardarNuevo.addEventListener('click', async () => {
            await guardarNuevoAlumnoManual();
        });
    }

    const btnStudentView = document.getElementById('btn-student-view');
    if (btnStudentView) {
        btnStudentView.addEventListener('click', async () => {
            if (typeof saveCurrentFormConfig === 'function') {
                await saveCurrentFormConfig(false);
            }
            window.open('/index.html?demo=true', '_blank');
        });
    }

    // Eventos de Exportación
    document.getElementById('btn-export-excel')?.addEventListener('click', () => exportData('excel'));
    document.getElementById('btn-export-word')?.addEventListener('click', () => exportData('word'));
    document.getElementById('btn-export-txt')?.addEventListener('click', () => exportData('texto'));

    document.getElementById('btn-estad-datos')?.addEventListener('click', () => switchEstadisticaPanel('datos'));
    document.getElementById('btn-estad-presentismo')?.addEventListener('click', () => switchEstadisticaPanel('presentismo'));

    initAusSortableHeaders();

    setInterval(() => {
        const activeTab = document.querySelector('.tab-content.active');
        if (!activeTab) return;
        if (activeTab.id === 'tab-estadisticas') {
            const datosPanel = document.getElementById('estad-datos-panel');
            const isDatos = datosPanel && datosPanel.style.display !== 'none';
            if (isDatos) updateStats();
            else {
                loadStatsGroupOptions();
                cargarAusencias();
            }
        } else if (activeTab.id === 'tab-grupos') {
            loadGruposView();
        } else if (activeTab.id === 'tab-alumnos' || activeTab.id === 'tab-asistencia') {
            if (!listaDirty) refreshAlumnosList();
        }
    }, 10000);
}

async function loadCursos() {
    try {
        const res = await fetch('/api/cursos');
        const cursos = await res.json();

        cursoSelect.innerHTML = '<option value="">-- Seleccionar curso para hoy --</option>';
        cursos.forEach(curso => {
            const opt = document.createElement('option');
            opt.value = curso;
            opt.textContent = curso;
            cursoSelect.appendChild(opt);
        });

        // Ver si hay uno activo ya
        const activeRes = await fetch('/api/active-course');
        const activeData = await activeRes.json();
        
        let targetCourse = activeData.activeCourse;
        if (!targetCourse && cursos.length > 0) {
            targetCourse = cursos[0];
        }

        if (targetCourse) {
            const optionsArr = Array.from(cursoSelect.options);
            const foundOpt = optionsArr.find(o => o.value === targetCourse || o.value.trim() === targetCourse.trim());
            if (foundOpt) {
                cursoSelect.value = foundOpt.value;
            } else if (cursoSelect.options.length > 1) {
                cursoSelect.selectedIndex = 1;
            }
        } else if (cursoSelect.options.length > 1) {
            cursoSelect.selectedIndex = 1;
        }

        if (cursoSelect.value) {
            activeStatus.textContent = `Curso actual: ${cursoSelect.value}`;
            await fetch('/api/active-course', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ course: cursoSelect.value })
            });
        }
    } catch (err) {
        console.error('Error cargando cursos', err);
    }
}

cursoSelect.addEventListener('change', async (e) => {
    const course = e.target.value;
    if (!course) return;

    try {
        const res = await fetch('/api/active-course', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ course })
        });
        const data = await res.json();
        if (data.success) {
            activeStatus.textContent = `Curso activado correctamente: ${course}`;
            await loadFechasDisponibles();
            await loadStatsGroupOptions();
            updateStats();
            refreshAlumnosList();
            consultarAsistenciaHistorica();
            cargarAusencias();
        }
    } catch (err) {
        console.error('Error al cambiar curso', err);
    }
});

async function loadServerInfo() {
    try {
        const res = await fetch('/api/server-info');
        const info = await res.json();
        if (info.qr) {
            qrImage.src = info.qr;
            qrImageLarge.src = info.qr;
        }
    } catch (err) {
        console.error('Error cargando info del servidor', err);
    }
}

async function loadStatsGroupOptions(intentos = 1) {
    try {
        const currentCourse = cursoSelect.value;
        if (!currentCourse) {
            if (intentos < 2) {
                setTimeout(() => loadStatsGroupOptions(intentos + 1), 300);
            }
            return;
        }

        let res;
        try {
            res = await fetch(`/api/grupos?curso=${encodeURIComponent(currentCourse)}&t=${Date.now()}`);
        } catch (fetchErr) {
            console.error('[grupos] Error de red en /api/grupos:', fetchErr);
            if (intentos < 2) setTimeout(() => loadStatsGroupOptions(intentos + 1), 300);
            return;
        }

        let grupos;
        try {
            grupos = await res.json();
        } catch (e) {
            const texto = await res.text();
            console.error('[grupos] Respuesta no JSON:', res.status, String(texto).slice(0, 300));
            grupos = null;
        }

        if (!Array.isArray(grupos)) {
            console.error('[grupos] Respuesta inesperada:', res.status, grupos);
            if (intentos < 2) {
                console.warn('[grupos] Reintentando en 300ms...');
                setTimeout(() => loadStatsGroupOptions(intentos + 1), 300);
            } else {
                poblarSelectoresGrupo([]);
            }
            return;
        }

        poblarSelectoresGrupo(grupos);
        console.log(`[grupos] Poblados ${grupos.length} grupos en los selectores (${currentCourse})`);
    } catch (err) {
        console.error('Error cargando grupos para selector de estadísticas', err);
        if (intentos < 2) setTimeout(() => loadStatsGroupOptions(intentos + 1), 300);
    }
}

function poblarSelectoresGrupo(grupos) {
    const ausGrupo = document.getElementById('aus-grupo-select');
    const currentSel = statsGroupSelect ? (statsGroupSelect.value || 'TODOS') : 'TODOS';
    const currentAusSel = ausGrupo ? (ausGrupo.value || 'TODOS') : 'TODOS';

    if (!Array.isArray(grupos)) grupos = [];

    const llenar = (sel) => {
        if (!sel) return;
        sel.innerHTML = '';
        sel.appendChild(new Option('🌐 Todos los Grupos (General)', 'TODOS'));
        grupos.forEach(g => sel.appendChild(new Option(`👥 ${g}`, g)));
    };
    llenar(statsGroupSelect);
    llenar(ausGrupo);

    if (statsGroupSelect) statsGroupSelect.value = currentSel;
    if (ausGrupo) ausGrupo.value = currentAusSel;
}

// ── AUSENCIAS POR ALUMNO Y POR MES ────────────────────────────────
function nombreMes(mesKey) {
    const partes = String(mesKey).split('-');
    if (partes.length !== 2) return mesKey;
    const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const mm = parseInt(partes[0], 10);
    return `${meses[mm] || partes[0]} ${partes[1]}`;
}

function nombreMesCorto(mesKey) {
    const partes = String(mesKey).split('-');
    if (partes.length !== 2) return mesKey;
    const meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const mm = parseInt(partes[0], 10);
    return `${meses[mm] || partes[0]} '${partes[1].slice(2)}`;
}

function buildAusAvatar(alumno) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:0.6rem;min-width:0;';
    let av;
    if (alumno.fotoUrl) {
        av = document.createElement('img');
        av.src = alumno.fotoUrl;
        av.alt = alumno.nombreCompleto;
        av.style.cssText = 'width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.2);flex-shrink:0;cursor:pointer;background:#334155;';
    } else {
        av = document.createElement('div');
        av.className = 'student-avatar';
        const parts = alumno.nombreCompleto.split(' ').filter(Boolean);
        av.textContent = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (parts[0] ? parts[0][0].toUpperCase() : '👤');
        av.style.cursor = 'pointer';
    }
    av.title = 'Ver foto y ficha del alumno';
    av.addEventListener('click', (e) => {
        e.stopPropagation();
        showStudentDetails(alumno);
    });
    wrap.appendChild(av);
    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'font-weight:600;color:#f8fafc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    nameSpan.textContent = alumno.nombreCompleto;
    wrap.appendChild(nameSpan);
    return wrap;
}

// ── ORDENAMIENTO DE LA TABLA DE AUSENCIAS ─────────────────────────
let ausSortKey = 'pctAusencia';
let ausSortDir = 'desc';

function valorOrdenAus(alumno) {
    const t = alumno.totales || {};
    switch (ausSortKey) {
        case 'alumno': return String(alumno.nombreCompleto || '').toLowerCase();
        case 'presentes': return Number(t.presentes) || 0;
        case 'tardes': return Number(t.tardes) || 0;
        case 'ausencias': return Number(t.ausentes) || 0;
        case 'total': return Number(t.totalClases) || 0;
        case 'pctPresentismo': return Number(t.pctPresentismo) || 0;
        case 'pctAusencia': return Number(t.pctAusencia) || 0;
        default: return 0;
    }
}

function ordenarAusAlumnos(alumnos) {
    const direccion = ausSortDir === 'asc' ? 1 : -1;
    return [...alumnos].sort((a, b) => {
        const va = valorOrdenAus(a);
        const vb = valorOrdenAus(b);
        if (ausSortKey === 'alumno') {
            return va.localeCompare(vb, 'es', { sensitivity: 'base' }) * direccion;
        }
        if (va < vb) return -1 * direccion;
        if (va > vb) return 1 * direccion;
        return 0;
    });
}

function sortAusPorColumna(key) {
    if (ausSortKey === key) {
        ausSortDir = ausSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        ausSortKey = key;
        ausSortDir = key === 'alumno' ? 'asc' : 'desc';
    }
    cargarAusencias();
}

function actualizarIndicadoresOrden() {
    const head = document.getElementById('aus-tabla-alumno-head');
    if (!head) return;
    const ths = head.querySelectorAll('.aus-sortable');
    ths.forEach(th => {
        const baseText = (th.getAttribute('data-label') || th.textContent).replace(/[▲▼]\s*$/, '');
        th.setAttribute('data-label', baseText);
        const active = th.getAttribute('data-key') === ausSortKey;
        th.style.color = active ? '#f9a8d4' : '';
        th.textContent = baseText + (active ? (ausSortDir === 'asc' ? ' ▲' : ' ▼') : '');
    });
}

function initAusSortableHeaders() {
    const head = document.getElementById('aus-tabla-alumno-head');
    if (!head) return;
    head.querySelectorAll('.aus-sortable').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.getAttribute('data-key');
            if (key) sortAusPorColumna(key);
        });
    });
    actualizarIndicadoresOrden();
}

function renderAusencias(data) {
    const tablaBody = document.getElementById('aus-tabla-alumno-body');
    const tablaFoot = document.getElementById('aus-tabla-alumno-tfoot');
    const matrizHead = document.getElementById('aus-matriz-head');
    const matrizBody = document.getElementById('aus-matriz-body');

    const meses = Array.isArray(data.mesesDisponibles) ? data.mesesDisponibles : [];
    const alumnos = Array.isArray(data.alumnos) ? ordenarAusAlumnos(data.alumnos) : [];
    const totales = data.totalesGenerales || null;

    // ── Tabla resumen por alumno ──
    if (tablaBody) {
        if (alumnos.length === 0) {
            tablaBody.innerHTML = '<tr><td colspan="7" style="padding:1.5rem;text-align:center;opacity:0.6;">Sin clases registradas para el filtro seleccionado.</td></tr>';
        } else {
            tablaBody.innerHTML = '';
            alumnos.forEach(a => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid rgba(255,255,255,0.08)';

                const tdNombre = document.createElement('td');
                tdNombre.style.cssText = 'padding:0.5rem 0.8rem;';
                tdNombre.appendChild(buildAusAvatar(a));

                const t = a.totales || {};
                const tdPres = document.createElement('td');
                tdPres.className = (t.presentes > 0) ? 'stat-pres' : '';
                tdPres.style.cssText = 'padding:0.5rem 0.8rem;text-align:center;font-weight:600;';
                tdPres.textContent = t.presentes || 0;
                const tdTar = document.createElement('td');
                tdTar.className = (t.tardes > 0) ? 'stat-tar' : '';
                tdTar.style.cssText = 'padding:0.5rem 0.8rem;text-align:center;font-weight:600;';
                tdTar.textContent = t.tardes || 0;
                const tdAus = document.createElement('td');
                tdAus.className = (t.ausentes > 0) ? 'stat-aus' : '';
                tdAus.style.cssText = 'padding:0.5rem 0.8rem;text-align:center;font-weight:600;';
                tdAus.textContent = t.ausentes || 0;
                const tdTot = document.createElement('td');
                tdTot.style.cssText = 'padding:0.5rem 0.8rem;text-align:center;';
                tdTot.textContent = t.totalClases || 0;
                const tdPctPres = document.createElement('td');
                tdPctPres.className = (t.pctPresentismo > 0) ? 'stat-pres' : '';
                tdPctPres.style.cssText = 'padding:0.5rem 0.8rem;text-align:center;font-weight:600;';
                tdPctPres.textContent = `${t.pctPresentismo || 0}%`;
                const tdPctAus = document.createElement('td');
                tdPctAus.className = (t.pctAusencia > 0) ? 'stat-aus' : '';
                tdPctAus.style.cssText = 'padding:0.5rem 0.8rem;text-align:center;';

                const pctWrap = document.createElement('div');
                pctWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:0.6rem;';
                const pctSpan = document.createElement('span');
                pctSpan.style.cssText = 'font-weight:700;min-width:40px;text-align:right;';
                const pctVal = t.pctAusencia || 0;
                pctSpan.textContent = `${pctVal}%`;
                pctSpan.style.color = pctVal >= 30 ? '#f87171' : (pctVal > 0 ? '#fbbf24' : '#4ade80');
                const barWrap = document.createElement('div');
                barWrap.style.cssText = 'flex:1;max-width:90px;background:rgba(255,255,255,0.1);height:8px;border-radius:4px;overflow:hidden;';
                const bar = document.createElement('div');
                const barColor = pctVal >= 30 ? '#ef4444' : (pctVal > 0 ? '#f59e0b' : '#22c55e');
                bar.style.cssText = `width:${Math.min(100, pctVal)}%;background:${barColor};height:100%;`;
                barWrap.appendChild(bar);
                pctWrap.appendChild(pctSpan);
                pctWrap.appendChild(barWrap);
                tdPctAus.appendChild(pctWrap);

                tr.appendChild(tdNombre);
                tr.appendChild(tdPres);
                tr.appendChild(tdTar);
                tr.appendChild(tdAus);
                tr.appendChild(tdTot);
                tr.appendChild(tdPctPres);
                tr.appendChild(tdPctAus);
                tablaBody.appendChild(tr);
            });
        }
    }

    if (tablaFoot) {
        if (totales) {
            tablaFoot.innerHTML = `
                <tr style="background: rgba(255,255,255,0.06); border-top: 2px solid rgba(255,255,255,0.25); font-weight: 700;">
                    <td style="padding:0.6rem 0.8rem;color:#a5b4fc;">TOTALES</td>
                    <td class="${totales.presentes > 0 ? 'stat-pres' : ''}" style="padding:0.6rem 0.8rem;text-align:center;font-weight:700;">${totales.presentes || 0}</td>
                    <td class="${totales.tardes > 0 ? 'stat-tar' : ''}" style="padding:0.6rem 0.8rem;text-align:center;font-weight:700;">${totales.tardes || 0}</td>
                    <td class="${totales.ausentes > 0 ? 'stat-aus' : ''}" style="padding:0.6rem 0.8rem;text-align:center;font-weight:700;">${totales.ausentes || 0}</td>
                    <td style="padding:0.6rem 0.8rem;text-align:center;">${totales.totalClases || 0}</td>
                    <td class="${totales.pctPresentismo > 0 ? 'stat-pres' : ''}" style="padding:0.6rem 0.8rem;text-align:center;font-weight:700;">${totales.pctPresentismo || 0}%</td>
                    <td class="${totales.pctAusencia > 0 ? 'stat-aus' : ''}" style="padding:0.6rem 0.8rem;text-align:center;font-weight:700;">${totales.pctAusencia || 0}%</td>
                </tr>`;
        } else {
            tablaFoot.innerHTML = '';
        }
    }

    // ── Matriz de ausencias por mes ──
    if (matrizHead) {
        let headHtml = '<tr style="background: rgba(99, 102, 241, 0.3); color: white; border-bottom: 1px solid rgba(255,255,255,0.2);">'
            + '<th style="padding:0.6rem 0.8rem;text-align:left;">Alumno</th>';
        if (meses.length > 0) {
            meses.forEach(m => {
                headHtml += `<th style="padding:0.6rem 0.6rem;" title="${nombreMes(m)}">${nombreMesCorto(m)}</th>`;
            });
        } else {
            headHtml += '<th style="padding:0.6rem 0.8rem;">Aus.</th>';
        }
        headHtml += '<th style="padding:0.6rem 0.8rem;">% Aus. Total</th></tr>';
        matrizHead.innerHTML = headHtml;
    }

    if (matrizBody) {
        if (alumnos.length === 0) {
            matrizBody.innerHTML = `<tr><td colspan="${meses.length + 2}" style="padding:1.5rem;text-align:center;opacity:0.6;">Sin clases registradas para el filtro seleccionado.</td></tr>`;
        } else {
            matrizBody.innerHTML = '';
            alumnos.forEach(a => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid rgba(255,255,255,0.08)';

                const tdNombre = document.createElement('td');
                tdNombre.style.cssText = 'padding:0.5rem 0.8rem;text-align:left;';
                tdNombre.appendChild(buildAusAvatar(a));
                tr.appendChild(tdNombre);

                if (meses.length > 0) {
                    meses.forEach(m => {
                        const slot = (a.porMes && a.porMes[m]) || null;
                        const td = document.createElement('td');
                        td.style.cssText = 'padding:0.5rem 0.6rem;text-align:center;font-weight:700;';
                        const aus = slot ? (slot.ausentes || 0) : 0;
                        td.textContent = aus;
                        if (aus > 0) {
                            td.className = 'stat-aus';
                            td.style.cssText += 'border-radius:4px;';
                        }
                        tr.appendChild(td);
                    });
                } else {
                    const t = a.totales || {};
                    const td = document.createElement('td');
                    td.style.cssText = 'padding:0.5rem 0.8rem;text-align:center;font-weight:700;';
                    const aus = t.ausentes || 0;
                    td.textContent = aus;
                    if (aus > 0) {
                        td.className = 'stat-aus';
                        td.style.cssText += 'border-radius:4px;';
                    }
                    tr.appendChild(td);
                }

                const tdPct = document.createElement('td');
                tdPct.style.cssText = 'padding:0.5rem 0.8rem;text-align:center;font-weight:700;';
                const pctTotal = (a.totales && a.totales.pctAusencia) || 0;
                tdPct.textContent = `${pctTotal}%`;
                tdPct.className = pctTotal > 0 ? (pctTotal >= 30 ? 'stat-aus' : 'stat-tar') : '';
                tr.appendChild(tdPct);

                matrizBody.appendChild(tr);
            });
        }
    }

    actualizarIndicadoresOrden();
}

async function cargarAusencias() {
    try {
        const currentCourse = cursoSelect.value;
        const contenedores = ['aus-tabla-alumno-body', 'aus-tabla-alumno-tfoot', 'aus-matriz-head', 'aus-matriz-body']
            .map(id => document.getElementById(id))
            .filter(Boolean);
        if (contenedores.length === 0) return;

        const mesSel = document.getElementById('aus-mes-select');
        const grupoSel = document.getElementById('aus-grupo-select');
        const mes = mesSel ? mesSel.value : '';
        const grupo = grupoSel ? grupoSel.value : 'TODOS';

        if (!currentCourse) {
            contenedores.forEach(c => c.innerHTML = '');
            if (mesSel) mesSel.innerHTML = '<option value="">🌐 Todos los Meses</option>';
            return;
        }

        const res = await fetch(`/api/ausencias?curso=${encodeURIComponent(currentCourse)}&mes=${encodeURIComponent(mes)}&grupo=${encodeURIComponent(grupo)}&t=${Date.now()}`);
        if (res.status === 401 || res.status === 403) {
            handleAuthError();
            return;
        }
        if (!res.ok) {
            console.error('Error HTTP en /api/ausencias:', res.status);
            return;
        }
        const data = await res.json();

        // Actualizar el selector de meses si cambió
        if (mesSel && Array.isArray(data.mesesDisponibles)) {
            const currentMes = mesSel.value;
            const newMeses = data.mesesDisponibles;
            const existingMeses = Array.from(mesSel.options).map(o => o.value).filter(Boolean);
            if (JSON.stringify(existingMeses) !== JSON.stringify(newMeses)) {
                mesSel.innerHTML = '<option value="">🌐 Todos los Meses</option>';
                newMeses.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m;
                    opt.textContent = `📅 ${nombreMes(m)}`;
                    mesSel.appendChild(opt);
                });
            }
            if (currentMes && newMeses.includes(currentMes)) {
                mesSel.value = currentMes;
            } else {
                mesSel.value = '';
            }
        }

        renderAusencias(data);
    } catch (err) {
        console.error('Error cargando ausencias:', err);
    }
}



let mostrarBorrados = false;

async function refreshAlumnosList() {
    try {
        const currentCourse = cursoSelect.value;
        const listContainers = ['alumnos-status-list', 'alumnos-status-list-asistencia']
            .map(id => document.getElementById(id))
            .filter(Boolean);

        if (listContainers.length === 0) return;

        if (!currentCourse) {
            listContainers.forEach(c => c.innerHTML = '<p style="opacity: 0.5;">Selecciona un curso para ver el estado...</p>');
            return;
        }

        const res = await fetch(`/api/alumnos?curso=${encodeURIComponent(currentCourse)}&full=true${mostrarBorrados ? '&incluirBorrados=true' : ''}&t=${Date.now()}`);
        if (res.status === 401 || res.status === 403) {
            handleAuthError();
            return;
        }
        const alumnos = await res.json();

        listContainers.forEach(c => c.innerHTML = '');

        if (!Array.isArray(alumnos) || alumnos.length === 0) {
            listContainers.forEach(c => c.innerHTML = '<p style="opacity: 0.6; padding: 1rem;">No se encontraron alumnos en la planilla del curso seleccionado.</p>');
            return;
        }

        const presentesHoy = alumnos.filter(a => a.presenteHoy).length;
        const tardesHoy = alumnos.filter(a => a.tardeHoy).length;

        listContainers.forEach(container => {
            const header = document.createElement('div');
            header.style.cssText = 'grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.5rem;';
            header.innerHTML = `
                <span style="font-weight: 600; color: #38bdf8; font-size: 0.95rem;">📅 Presentes HOY: <span style="color: #4ade80;">${presentesHoy}</span> · 🟡 Tardes: <span style="color: #fbbf24;">${tardesHoy}</span> / ${alumnos.length}</span>
                <span style="font-size: 0.75rem; opacity: 0.7;">✅ verde = presente hoy · 🟡 ámbar = llegó tarde · ⬜ gris = pendiente</span>`;
            container.appendChild(header);
        });

        alumnos.forEach(alumno => {
            listContainers.forEach(c => {
                c.appendChild(buildStatusItem(alumno, c.id === 'alumnos-status-list-asistencia'));
            });
        });

        // Tarjeta compacta del presente en vivo (Lista y QR): foto + nombre, click = presente, ⏰ = tarde
        function buildStatusItem(alumno, esListaAsistencia) {
            if (!esListaAsistencia) {
                return buildStatusItemNormal(alumno, esListaAsistencia);
            }
            const estaHoy = !!alumno.presenteHoy;
            const estaTarde = !!alumno.tardeHoy;
            // Pre-sugerencia automática de tardanza en proyección (el docente puede anular con ⏰)
            const sugerirTarde = !estaHoy && pasoLimiteAhora(cfgTardanza, horaTomaListaHoy);
            const tardePreview = estaTarde || sugerirTarde;
            const item = document.createElement('div');
            item.className = `status-item compact ${tardePreview ? 'late' : (estaHoy ? 'completed' : 'pending')}`;
            item.title = alumno.nombreCompleto;

            // Checkbox oculto pero funcional (Marcar Todos Presentes / Guardar Asistencia lo siguen usando)
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.className = 'alumno-checkbox-presente';
            chk.dataset.nombre = alumno.nombreCompleto;
            chk.dataset.dni = (alumno.datos && alumno.datos.dni) ? alumno.datos.dni : '';
            chk.dataset.grupo = (alumno.datos && alumno.datos.grupo) ? alumno.datos.grupo : '';
            chk.dataset.tarde = tardePreview ? 'true' : 'false';
            chk.checked = estaHoy;
            chk.title = estaHoy ? 'Presente hoy' : 'Marcar presente';
            chk.addEventListener('change', () => {
                listaDirty = true;
                if (!chk.checked && chk.dataset.tarde === 'true') {
                    chk.dataset.tarde = 'false';
                    const btnT = item.querySelector('.btn-tarde');
                    if (btnT) btnT.classList.remove('active');
                }
                const esTarde = chk.dataset.tarde === 'true';
                item.classList.toggle('late', esTarde);
                item.classList.toggle('completed', chk.checked && !esTarde);
                item.classList.toggle('pending', !chk.checked && !esTarde);
            });
            item.appendChild(chk);

            // Foto del rostro / avatar, clicable para ver la ficha
            let avatarEl;
            if (alumno.fotoUrl) {
                avatarEl = document.createElement('img');
                avatarEl.src = alumno.fotoUrl;
                avatarEl.alt = alumno.nombreCompleto;
                avatarEl.className = 'student-avatar';
            } else {
                avatarEl = document.createElement('div');
                avatarEl.className = 'student-avatar';
                const parts = alumno.nombreCompleto.split(' ').filter(Boolean);
                const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (parts[0] ? parts[0][0].toUpperCase() : '👤');
                avatarEl.textContent = initials;
            }
            avatarEl.addEventListener('click', (e) => {
                e.stopPropagation();
                showStudentDetails(alumno);
            });
            item.appendChild(avatarEl);

            // Nombre (sin grupo ni contadores)
            const nameSpan = document.createElement('span');
            nameSpan.className = 'status-compact-name';
            nameSpan.textContent = alumno.nombreCompleto;
            item.appendChild(nameSpan);

            // Botón pequeño ⏰ = llegó tarde
            const btnTarde = document.createElement('button');
            btnTarde.type = 'button';
            btnTarde.className = 'btn-tarde';
            btnTarde.innerHTML = '⏰';
            btnTarde.title = 'Marcar que el alumno llegó tarde';
            if (tardePreview) btnTarde.classList.add('active');
            btnTarde.addEventListener('click', (e) => {
                e.stopPropagation();
                const activo = btnTarde.classList.toggle('active');
                listaDirty = true;
                if (activo) {
                    chk.checked = true;
                    chk.dataset.tarde = 'true';
                    item.classList.add('late');
                    item.classList.add('completed');
                    item.classList.remove('pending');
                } else {
                    chk.dataset.tarde = 'false';
                    item.classList.remove('late');
                    item.classList.toggle('completed', chk.checked);
                    item.classList.toggle('pending', !chk.checked);
                }
            });
            item.appendChild(btnTarde);

            // Click en la tarjeta = alternar PRESENTE
            item.addEventListener('click', (e) => {
                if (e.target !== chk) {
                    chk.checked = !chk.checked;
                    chk.dispatchEvent(new Event('change'));
                }
            });

            return item;
        }

        function buildStatusItemNormal(alumno, esListaAsistencia) {
            const estaHoy = !!alumno.presenteHoy;
            const estaTarde = !!alumno.tardeHoy;
            const item = document.createElement('div');
            item.className = `status-item ${estaTarde ? 'late' : (estaHoy ? 'completed' : 'pending')}`;
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.justifyContent = 'space-between';

            const leftDiv = document.createElement('div');
            leftDiv.style.display = 'flex';
            leftDiv.style.alignItems = 'center';
            leftDiv.style.gap = '0.5rem';
            leftDiv.style.minWidth = '0';

            let chk = null;
            if (esListaAsistencia) {
                // Checkbox de asistencia (solo en Lista y QR)
                chk = document.createElement('input');
                chk.type = 'checkbox';
                chk.className = 'alumno-checkbox-presente';
                chk.dataset.nombre = alumno.nombreCompleto;
                chk.dataset.dni = (alumno.datos && alumno.datos.dni) ? alumno.datos.dni : '';
                chk.dataset.grupo = (alumno.datos && alumno.datos.grupo) ? alumno.datos.grupo : '';
                chk.dataset.tarde = estaTarde ? 'true' : 'false';
                chk.checked = estaHoy; // Presente marcado según el presente REAL de hoy
                chk.addEventListener('change', () => {
                    listaDirty = true;
                    if (!chk.checked && chk.dataset.tarde === 'true') {
                        chk.dataset.tarde = 'false';
                        const btnTarde = item.querySelector('.btn-tarde');
                        if (btnTarde) btnTarde.classList.remove('active');
                        item.classList.remove('late');
                    }
                });
                leftDiv.appendChild(chk);
            }

            // Elemento de Foto Real del Rostro / Avatar (solo en Manejo de Alumnos)
            if (!esListaAsistencia) {
                let avatarEl;
                if (alumno.fotoUrl) {
                    avatarEl = document.createElement('img');
                    avatarEl.src = alumno.fotoUrl;
                    avatarEl.className = 'student-avatar';
                    avatarEl.alt = alumno.nombreCompleto;
                } else {
                    avatarEl = document.createElement('div');
                    avatarEl.className = 'student-avatar';
                    const parts = alumno.nombreCompleto.split(' ').filter(Boolean);
                    const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (parts[0] ? parts[0][0].toUpperCase() : '👤');
                    avatarEl.textContent = initials;
                }
                avatarEl.style.cursor = 'pointer';
                avatarEl.title = 'Ver foto y ficha del alumno';
                avatarEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showStudentDetails(alumno);
                });
                leftDiv.appendChild(avatarEl);
            }

            // Bloque nombre + contadores acumulados
            const infoDiv = document.createElement('div');
            infoDiv.style.minWidth = '0';
            const nameSpan = document.createElement('span');
            nameSpan.style.display = 'block';
            nameSpan.style.fontSize = '0.9rem';
            nameSpan.style.fontWeight = '600';
            nameSpan.style.overflow = 'hidden';
            nameSpan.style.textOverflow = 'ellipsis';
            nameSpan.style.whiteSpace = 'nowrap';
            nameSpan.textContent = alumno.nombreCompleto;
            if (alumno.datos && alumno.datos.grupo) {
                nameSpan.textContent += ` (Grupo: ${alumno.datos.grupo})`;
            }
            infoDiv.appendChild(nameSpan);

            const counts = document.createElement('span');
            counts.className = 'status-counts';
            counts.style.display = 'flex';
            counts.style.flexWrap = 'wrap';
            counts.style.gap = '0.35rem';

            const pillPres = document.createElement('span');
            pillPres.className = 'stat-pill' + (alumno.presentes > 0 ? ' stat-pres' : '');
            pillPres.textContent = `✅ ${alumno.presentes}`;
            const pillTar = document.createElement('span');
            pillTar.className = 'stat-pill' + (alumno.tardes > 0 ? ' stat-tar' : '');
            pillTar.textContent = `🟡 ${alumno.tardes}`;
            const pillAus = document.createElement('span');
            pillAus.className = 'stat-pill' + (alumno.ausentes > 0 ? ' stat-aus' : '');
            pillAus.textContent = `❌ ${alumno.ausentes}`;
            counts.appendChild(pillPres);
            counts.appendChild(pillTar);
            counts.appendChild(pillAus);

            if (alumno.totalClases > 0) {
                const pct = alumno.porcentajePresentismo || 0;
                const pillPct = document.createElement('span');
                pillPct.className = 'stat-pill ' + (pct >= 70 ? 'stat-pres' : pct >= 50 ? 'stat-tar' : 'stat-aus');
                pillPct.textContent = `🎯 ${pct}%`;
                counts.appendChild(pillPct);
            }
            infoDiv.appendChild(counts);

            leftDiv.appendChild(infoDiv);
            item.appendChild(leftDiv);

            const rightDiv = document.createElement('div');
            rightDiv.style.display = 'flex';
            rightDiv.style.alignItems = 'center';
            rightDiv.style.gap = '0.6rem';

            if (alumno.borrado) {
                item.style.opacity = '0.55';
                const badge = document.createElement('span');
                badge.textContent = '🚫 Borrado';
                badge.style.fontSize = '0.75rem';
                badge.style.color = '#f87171';
                rightDiv.appendChild(badge);

                const btnRestaurar = document.createElement('button');
                btnRestaurar.type = 'button';
                btnRestaurar.className = 'btn-secondary';
                btnRestaurar.innerHTML = '♻️ Restaurar';
                btnRestaurar.title = 'Restaurar alumno (deshacer borrado lógico)';
                btnRestaurar.addEventListener('click', (e) => {
                    e.stopPropagation();
                    restaurarAlumno(alumno.nombreCompleto);
                });
                rightDiv.appendChild(btnRestaurar);
            }

            if (esListaAsistencia) {
                // Botón "Llegó tarde" (solo en Lista y QR)
                const btnTarde = document.createElement('button');
                btnTarde.type = 'button';
                btnTarde.className = 'btn-tarde';
                btnTarde.innerHTML = '⏰ Tarde';
                btnTarde.title = 'Marcar que el alumno llegó tarde (cuenta aparte, no suma a presentes)';
                if (estaTarde) btnTarde.classList.add('active');
                btnTarde.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const activo = btnTarde.classList.toggle('active');
                    item.classList.toggle('late', activo);
                    if (chk) {
                        if (activo) {
                            chk.checked = true;
                            chk.dataset.tarde = 'true';
                        } else {
                            chk.dataset.tarde = 'false';
                        }
                        listaDirty = true;
                    }
                });
                rightDiv.appendChild(btnTarde);
            } else {
                // Acciones de gestión (solo en Manejo de Alumnos)
                if (alumno.fotoUrl) {
                    const btnDelFoto = document.createElement('button');
                    btnDelFoto.type = 'button';
                    btnDelFoto.className = 'btn-delete-foto';
                    btnDelFoto.innerHTML = '🗑️ Foto';
                    btnDelFoto.title = 'Borrar foto no válida y solicitar foto de rostro nuevamente';
                    btnDelFoto.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (confirm(`¿Deseas eliminar la foto de [${alumno.nombreCompleto}] y solicitarle que suba una foto real de su rostro?`)) {
                            try {
                                const res = await fetch('/api/borrar-foto-alumno', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        nombreCompleto: alumno.nombreCompleto,
                                        dni: (alumno.datos && alumno.datos.dni) ? alumno.datos.dni : ''
                                    })
                                });
                                const result = await res.json();
                                if (result.success) {
                                    refreshAlumnosList();
                                } else {
                                    alert('Error al borrar la foto.');
                                }
                            } catch (err) {
                                console.error('Error al borrar foto:', err);
                            }
                        }
                    });
                    rightDiv.appendChild(btnDelFoto);
                }

                if (alumno.completado) {
                    const btnDet = document.createElement('span');
                    btnDet.textContent = '🔍 Ficha';
                    btnDet.style.fontSize = '0.8rem';
                    btnDet.style.cursor = 'pointer';
                    btnDet.style.opacity = '0.85';
                    btnDet.title = 'Ver ficha completa del alumno';
                    btnDet.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showStudentDetails(alumno);
                    });
                    rightDiv.appendChild(btnDet);
                }

                // Botón de Edición del Docente
                const btnEdit = document.createElement('span');
                btnEdit.textContent = '✏️';
                btnEdit.style.cursor = 'pointer';
                btnEdit.style.fontSize = '0.9rem';
                btnEdit.title = 'Modificar datos del alumno';
                btnEdit.addEventListener('click', (e) => {
                    e.stopPropagation();
                    abrirModalEdicionAlumno(alumno);
                });
                rightDiv.appendChild(btnEdit);

                // Botón de Eliminar del Docente
                const btnDel = document.createElement('span');
                btnDel.textContent = '🗑️';
                btnDel.style.cursor = 'pointer';
                btnDel.style.fontSize = '0.9rem';
                btnDel.title = 'Eliminar alumno del archivo Excel';
                btnDel.addEventListener('click', (e) => {
                    e.stopPropagation();
                    borrarAlumno(alumno.nombreCompleto);
                });
                rightDiv.appendChild(btnDel);
            }

            const dot = document.createElement('div');
            dot.className = `status-dot ${estaTarde ? 'late' : (estaHoy ? 'completed' : 'pending')}`;
            rightDiv.appendChild(dot);

            item.appendChild(rightDiv);
            return item;
        }
    } catch (err) {
        console.error('Error refreshing alumnos list', err);
    }
}

async function guardarAsistenciaFecha() {
    try {
        const currentCourse = cursoSelect.value;
        if (!currentCourse) {
            alert('Por favor, selecciona un curso activo primero.');
            return;
        }

        const fechaInput = document.getElementById('asistencia-fecha-input');
        const rawFecha = fechaInput ? fechaInput.value : '';
        if (!rawFecha) {
            alert('Por favor, selecciona una fecha para la asistencia.');
            return;
        }

        // Usar la lista visible de la pestaña de Asistencia (o la de Alumnos como respaldo)
        const listContainer = document.getElementById('alumnos-status-list-asistencia') || document.getElementById('alumnos-status-list');
        const checkboxes = listContainer ? listContainer.querySelectorAll('.alumno-checkbox-presente') : [];
        if (checkboxes.length === 0) {
            alert('No hay alumnos listados para registrar asistencia.');
            return;
        }

        const asistencias = Array.from(checkboxes).map(chk => ({
            nombreCompleto: chk.dataset.nombre,
            dni: chk.dataset.dni || '',
            grupo: chk.dataset.grupo || '',
            presente: chk.checked,
            tarde: chk.dataset.tarde === 'true'
        }));

        const res = await fetch('/api/asistencia/tomar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                curso: currentCourse,
                fecha: rawFecha,
                asistencias
            })
        });

        const data = await res.json();
        if (data.success) {
            alert(`✅ Asistencia guardada con éxito en la pestaña [${data.fecha}] del archivo Excel.\nSe actualizaron los porcentajes de presentismo en la Hoja 1 (Resumen General).`);
            listaDirty = false;
            await refreshAlumnosList();
            await loadFechasDisponibles();
            updateStats();
        } else {
            alert('Error al guardar asistencia: ' + (data.error || 'Error desconocido'));
        }
    } catch (err) {
        console.error('Error guardando asistencia:', err);
        alert('Ocurrió un error al enviar la asistencia al servidor.');
    }
}

async function guardarNuevoAlumnoManual() {
    try {
        const cursoSel = document.getElementById('curso-select');
        const currentCourse = cursoSel ? cursoSel.value : '';
        if (!currentCourse) {
            alert('Por favor, selecciona un curso activo primero.');
            return;
        }

        const inputNombre     = document.getElementById('add-alumno-nombre');
        const inputApellido   = document.getElementById('add-alumno-apellido');
        const inputDni        = document.getElementById('add-alumno-dni');
        const inputGrupo      = document.getElementById('add-alumno-grupo');
        const inputTitulo     = document.getElementById('add-alumno-titulo');
        const inputTecnologia = document.getElementById('add-alumno-tecnologia');
        const chkPresente     = document.getElementById('add-alumno-marcar-presente');
        const fechaInput      = document.getElementById('asistencia-fecha-input');

        const nombre     = inputNombre ? inputNombre.value.trim() : '';
        const apellido   = inputApellido ? inputApellido.value.trim() : '';
        const dni        = inputDni ? inputDni.value.trim() : '';
        const grupo      = inputGrupo ? inputGrupo.value.trim() : '';
        const titulo     = inputTitulo ? inputTitulo.value.trim() : '';
        const tecnologia = inputTecnologia ? inputTecnologia.value.trim() : 'MODERADO';
        const presente   = chkPresente ? chkPresente.checked : false;
        const fecha      = fechaInput ? fechaInput.value : '';

        if (!nombre && !apellido) {
            alert('Por favor, ingresa al menos el nombre o el apellido del alumno.');
            return;
        }

        const res = await fetch('/api/agregar-alumno', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                curso: currentCourse,
                nombre,
                apellido,
                dni,
                grupo,
                titulo,
                tecnologia,
                presente,
                fecha
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            alert('⚠️ ' + (errData.error || `No se pudo agregar el alumno al servidor (Error HTTP ${res.status}).`));
            return;
        }

        const data = await res.json();
        if (data.success) {
            alert(`✅ Alumno [${data.nombreCompleto}] agregado a la lista del curso.\n${data.presente ? 'Se le asignó PRESENTE para la fecha ' + data.fecha + '.' : 'Quedó pendiente: el PRESENTE se registrará cuando el alumno complete sus datos desde el celular.'}`);

            // Limpiar campos del formulario
            if (inputNombre) inputNombre.value = '';
            if (inputApellido) inputApellido.value = '';
            if (inputDni) inputDni.value = '';
            if (inputGrupo) inputGrupo.value = '';
            if (inputTitulo) inputTitulo.selectedIndex = 0;
            if (inputTecnologia) inputTecnologia.selectedIndex = 0;

            // Ocultar formulario
            const containerAdd = document.getElementById('form-add-alumno-container');
            const btnToggleAdd = document.getElementById('btn-toggle-add-alumno');
            if (containerAdd) containerAdd.style.display = 'none';
            if (btnToggleAdd) btnToggleAdd.textContent = '➕ Abrir Formulario';

            // Actualizar vista y datos
            await refreshAlumnosList();
            await loadFechasDisponibles();
            updateStats();
        } else {
            alert('⚠️ Error al agregar alumno: ' + (data.error || 'Error desconocido'));
        }
    } catch (err) {
        console.error('Error al agregar nuevo alumno manual:', err);
        alert('⚠️ Ocurrió un fallo al comunicarse con el servidor: ' + (err.message || 'Error de red'));
    }
}

async function showStudentDetails(alumno) {
    try {
        const currentCourse = cursoSelect.value;
        const res = await fetch(`/api/alumnos?curso=${encodeURIComponent(currentCourse)}&full=true&t=${Date.now()}`);
        const fullAlumnos = await res.json();

        const target = fullAlumnos.find(a => a.nombreCompleto === alumno.nombreCompleto);

        if (target) {
            document.getElementById('modal-student-name').textContent = target.nombreCompleto;
            const modalImg = document.getElementById('modal-student-photo-img');
            const modalPlaceholder = document.getElementById('modal-student-photo-placeholder');
            const btnDelPhoto = document.getElementById('btn-modal-delete-photo');

            if (target.fotoUrl) {
                if (modalImg) {
                    modalImg.src = target.fotoUrl;
                    modalImg.style.display = 'block';
                }
                if (modalPlaceholder) modalPlaceholder.style.display = 'none';
                if (btnDelPhoto) {
                    btnDelPhoto.style.display = 'inline-flex';
                    btnDelPhoto.onclick = async () => {
                        if (confirm(`¿Deseas borrar la foto de [${target.nombreCompleto}] y solicitarle una foto real de su rostro?`)) {
                            try {
                                await fetch('/api/borrar-foto-alumno', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        nombreCompleto: target.nombreCompleto,
                                        dni: target.datos ? target.datos.dni : ''
                                    })
                                });
                                studentModal.style.display = 'none';
                                refreshAlumnosList();
                            } catch (err) {
                                console.error('Error al borrar foto:', err);
                            }
                        }
                    };
                }
            } else {
                if (modalImg) modalImg.style.display = 'none';
                if (modalPlaceholder) {
                    const parts = target.nombreCompleto.split(' ').filter(Boolean);
                    const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (parts[0] ? parts[0][0].toUpperCase() : '👤');
                    modalPlaceholder.textContent = initials;
                    modalPlaceholder.style.display = 'flex';
                }
                if (btnDelPhoto) btnDelPhoto.style.display = 'none';
            }

            if (target.datos) {
                document.getElementById('det-email').textContent = target.datos.email || 'No cargado';
                document.getElementById('det-dni').textContent = target.datos.dni || 'No cargado';
                document.getElementById('det-titulo').textContent = target.datos.titulo || 'No cargado';
                document.getElementById('det-tecnologia').textContent = target.datos.tecnologia || 'No especificado';
                document.getElementById('det-grupo').textContent = target.datos.grupo || 'Sin grupo';
                document.getElementById('det-tel').textContent = target.datos.telefono || 'No cargado';
                document.getElementById('det-fecha').textContent = target.datos.fecha || 'No cargada';
            } else {
                document.getElementById('det-email').textContent = 'No cargado';
                document.getElementById('det-dni').textContent = 'No cargado';
                document.getElementById('det-titulo').textContent = 'No cargado';
                document.getElementById('det-tecnologia').textContent = 'No especificado';
                document.getElementById('det-grupo').textContent = 'Sin grupo';
                document.getElementById('det-tel').textContent = 'No cargado';
                document.getElementById('det-fecha').textContent = 'No cargada';
            }

            // Bloque de presentismo (pills verde/ámbar/rojo)
            const detPres = document.getElementById('det-presentismo');
            if (detPres) {
                detPres.innerHTML = '';
                const tieneClases = (target.totalClases > 0) || target.presentes || target.ausentes || target.tardes;
                if (tieneClases) {
                    const pct = target.porcentajePresentismo || 0;
                    const countPills = [];
                    if ((target.presentes || 0) > 0) countPills.push({ cls: 'stat-pres', label: `✅ ${target.presentes || 0} Presentes` });
                    if ((target.tardes || 0) > 0)    countPills.push({ cls: 'stat-tar',  label: `🟡 ${target.tardes || 0} Tardes` });
                    if ((target.ausentes || 0) > 0)  countPills.push({ cls: 'stat-aus',  label: `❌ ${target.ausentes || 0} Ausentes` });
                    if (countPills.length === 0) {
                        detPres.textContent = 'Sin clases registradas todavía.';
                    } else {
                        const pctCls = pct >= 70 ? 'stat-pres' : pct >= 50 ? 'stat-tar' : 'stat-aus';
                        countPills.push({ cls: pctCls, label: `🎯 ${pct}% Presentismo` });
                        countPills.forEach(p => {
                            const s = document.createElement('span');
                            s.className = 'stat-pill ' + p.cls;
                            s.textContent = p.label;
                            detPres.appendChild(s);
                        });
                    }
                } else {
                    detPres.textContent = 'Sin clases registradas todavía.';
                }
            }

            studentModal.style.display = 'flex';

            // Asociar botones del modal de detalles
            const btnModalEdit = document.getElementById('btn-modal-editar-alumno');
            const btnModalDel = document.getElementById('btn-modal-borrar-alumno');

            if (btnModalEdit) {
                btnModalEdit.onclick = () => {
                    studentModal.style.display = 'none';
                    abrirModalEdicionAlumno(target);
                };
            }
            if (btnModalDel) {
                btnModalDel.onclick = () => {
                    studentModal.style.display = 'none';
                    borrarAlumno(target.nombreCompleto);
                };
            }
            const btnModalDelDef = document.getElementById('btn-modal-borrar-definitivo');
            if (btnModalDelDef) {
                btnModalDelDef.onclick = () => {
                    studentModal.style.display = 'none';
                    borrarAlumno(target.nombreCompleto, true);
                };
            }
        } else {
            alert('No se pudieron recuperar los datos extra de este alumno.');
        }
    } catch (err) {
        console.error('Error mostrando detalles', err);
    }
}

async function abrirModalEdicionAlumno(alumno) {
    try {
        const editModal = document.getElementById('edit-student-modal');
        if (!editModal) return;

        const currentCourse = cursoSelect.value;
        const res = await fetch(`/api/alumnos?curso=${encodeURIComponent(currentCourse)}&full=true&t=${Date.now()}`);
        const fullAlumnos = await res.json();
        const target = fullAlumnos.find(a => a.nombreCompleto === alumno.nombreCompleto) || alumno;

        const datos = target.datos || {};
        const partes = (target.nombreCompleto || '').split(' ');
        const nom = partes[0] || '';
        const ape = partes.slice(1).join(' ') || '';

        document.getElementById('edit-nombre-original').value = target.nombreCompleto || '';
        document.getElementById('edit-nombre').value = nom;
        document.getElementById('edit-apellido').value = ape;
        document.getElementById('edit-dni').value = datos.dni || '';
        document.getElementById('edit-grupo').value = datos.grupo || '';
        document.getElementById('edit-titulo').value = datos.titulo || '';
        document.getElementById('edit-email').value = datos.email || '';

        editModal.style.display = 'flex';
    } catch (err) {
        console.error('Error al abrir modal de edición:', err);
    }
}

async function guardarEdicionAlumnoBackend() {
    try {
        const currentCourse = cursoSelect.value;
        if (!currentCourse) {
            alert('Selecciona un curso activo primero.');
            return;
        }

        const nombreOriginal = document.getElementById('edit-nombre-original').value;
        const nuevoNombre    = document.getElementById('edit-nombre').value.trim();
        const nuevoApellido  = document.getElementById('edit-apellido').value.trim();
        const nuevoDni       = document.getElementById('edit-dni').value.trim();
        const nuevoGrupo     = document.getElementById('edit-grupo').value.trim();
        const nuevoTitulo    = document.getElementById('edit-titulo').value.trim();
        const nuevoEmail     = document.getElementById('edit-email').value.trim();

        if (!nombreOriginal) return;

        const res = await fetch('/api/modificar-alumno', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                curso: currentCourse,
                nombreOriginal,
                nuevoNombre,
                nuevoApellido,
                nuevoDni,
                nuevoGrupo,
                nuevoTitulo,
                nuevoEmail
            })
        });

        const data = await res.json();
        if (data.success) {
            alert(`✅ Datos del alumno [${data.nuevoNombreCompleto}] actualizados correctamente en el archivo Excel.`);
            const editModal = document.getElementById('edit-student-modal');
            if (editModal) editModal.style.display = 'none';

            await refreshAlumnosList();
            await loadFechasDisponibles();
            await loadStatsGroupOptions();
            updateStats();
        } else {
            alert('Error al modificar alumno: ' + (data.error || 'Error desconocido'));
        }
    } catch (err) {
        console.error('Error guardando edición de alumno:', err);
        alert('Ocurrió un error al guardar los cambios del alumno.');
    }
}

async function borrarAlumno(nombreAlumno, definitivo = false) {
    if (!nombreAlumno) return;
    const mensaje = definitivo
        ? `⚠️ BORRADO DEFINITIVO de [${nombreAlumno}].\n\nSe eliminará de la lista, de TODAS las asistencias y su foto. Esta acción NO se puede deshacer. ¿Continuar?`
        : `¿Marcar a [${nombreAlumno}] como borrado?\n\nSe ocultará de la Nómina y de las estadísticas, pero su historial de asistencia se conservará por las dudas.`;
    const confirmacion = confirm(mensaje);
    if (!confirmacion) return;

    try {
        const currentCourse = cursoSelect.value;
        const res = await fetch('/api/borrar-alumno', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                curso: currentCourse,
                nombreAlumno,
                definitivo
            })
        });

        const data = await res.json();
        if (data.success) {
            alert(definitivo
                ? `🗑️ El alumno [${nombreAlumno}] fue eliminado definitivamente.`
                : `🚫 El alumno [${nombreAlumno}] fue marcado como borrado. Su historial se conserva.`);
            await refreshAlumnosList();
            await loadFechasDisponibles();
            await loadStatsGroupOptions();
            updateStats();
        } else {
            alert('Error al borrar alumno: ' + (data.error || 'Error desconocido'));
        }
    } catch (err) {
        console.error('Error al eliminar alumno:', err);
        alert('Ocurrió un error al eliminar al alumno.');
    }
}

async function restaurarAlumno(nombreAlumno) {
    if (!nombreAlumno) return;
    if (!confirm(`¿Restaurar a [${nombreAlumno}]? Volverá a aparecer en la Nómina y en las estadísticas (su historial ya estaba conservado).`)) return;

    try {
        const currentCourse = cursoSelect.value;
        const res = await fetch('/api/restaurar-alumno', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ curso: currentCourse, nombreAlumno })
        });
        const data = await res.json();
        if (data.success) {
            alert(`♻️ Alumno [${nombreAlumno}] restaurado correctamente.`);
            await refreshAlumnosList();
            await loadFechasDisponibles();
            await loadStatsGroupOptions();
            updateStats();
        } else {
            alert('Error al restaurar alumno: ' + (data.error || 'Error desconocido'));
        }
    } catch (err) {
        console.error('Error al restaurar alumno:', err);
        alert('Ocurrió un error al restaurar al alumno.');
    }
}

// Modal logic
qrContainer.addEventListener('click', () => {
    qrModal.style.display = 'flex';
});

closeModal.addEventListener('click', () => {
    qrModal.style.display = 'none';
});

closeStudentModal.addEventListener('click', () => {
    studentModal.style.display = 'none';
});

const closeEditModal = document.getElementById('close-edit-modal');
const btnCancelarEdicion = document.getElementById('btn-cancelar-edicion');
const btnGuardarEdicion = document.getElementById('btn-guardar-edicion-alumno');
const editModalEl = document.getElementById('edit-student-modal');

if (closeEditModal && editModalEl) {
    closeEditModal.addEventListener('click', () => editModalEl.style.display = 'none');
}
if (btnCancelarEdicion && editModalEl) {
    btnCancelarEdicion.addEventListener('click', () => editModalEl.style.display = 'none');
}
if (btnGuardarEdicion) {
    btnGuardarEdicion.addEventListener('click', () => guardarEdicionAlumnoBackend());
}

window.addEventListener('click', (e) => {
    if (e.target === qrModal) qrModal.style.display = 'none';
    if (e.target === studentModal) studentModal.style.display = 'none';
    if (e.target === editModalEl) editModalEl.style.display = 'none';
});

async function loadGruposView() {
    try {
        const currentCourse = cursoSelect.value;
        if (!currentCourse) {
            gruposCardsContainer.innerHTML = '<p style="opacity:0.5;">Selecciona un curso activo para visualizar los grupos.</p>';
            return;
        }

        const res = await fetch(`/api/grupos-miembros?curso=${encodeURIComponent(currentCourse)}&t=${Date.now()}`);
        const gruposData = await res.json();

        gruposCardsContainer.innerHTML = '';

        const gruposKeys = Object.keys(gruposData).sort();

        if (gruposKeys.length === 0) {
            gruposCardsContainer.innerHTML = '<p style="opacity:0.5; grid-column: 1/-1;">Aún no hay ningún grupo registrado en este curso.</p>';
            return;
        }

        gruposKeys.forEach(grupoName => {
            const miembros = gruposData[grupoName];
            
            const card = document.createElement('div');
            card.className = 'card glass';
            card.style.padding = '1.5rem';
            card.style.margin = '0';
            card.style.border = '1px solid rgba(255,255,255,0.15)';

            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.marginBottom = '1rem';
            header.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
            header.style.paddingBottom = '0.5rem';

            const title = document.createElement('h3');
            title.style.margin = '0';
            title.style.fontSize = '1.2rem';
            title.style.color = '#4ade80';
            title.textContent = `Grupo: ${grupoName}`;

            const badge = document.createElement('span');
            badge.style.fontSize = '0.8rem';
            badge.style.opacity = '0.7';
            badge.style.background = 'rgba(255,255,255,0.1)';
            badge.style.padding = '0.2rem 0.6rem';
            badge.style.borderRadius = '1rem';
            badge.textContent = `${miembros.length} integrante(s)`;

            header.appendChild(title);
            header.appendChild(badge);
            card.appendChild(header);

            const list = document.createElement('div');
            list.style.display = 'flex';
            list.style.flexDirection = 'column';
            list.style.gap = '0.6rem';

            miembros.forEach(m => {
                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.justifyContent = 'space-between';
                item.style.alignItems = 'center';
                item.style.background = 'rgba(255,255,255,0.03)';
                item.style.padding = '0.6rem 0.8rem';
                item.style.borderRadius = '0.5rem';
                item.style.border = '1px solid rgba(255,255,255,0.05)';

                const memberInfo = document.createElement('div');
                memberInfo.style.display = 'flex';
                memberInfo.style.flexDirection = 'column';

                const nameText = document.createElement('span');
                nameText.style.fontWeight = '600';
                nameText.style.fontSize = '0.9rem';
                nameText.textContent = m.nombreCompleto;

                const detailText = document.createElement('span');
                detailText.style.fontSize = '0.75rem';
                detailText.style.opacity = '0.6';
                detailText.textContent = `${m.titulo} ${m.tecnologia ? '• ' + m.tecnologia : ''}`;

                memberInfo.appendChild(nameText);
                memberInfo.appendChild(detailText);

                const btnEdit = document.createElement('button');
                btnEdit.textContent = '✏️ Cambiar';
                btnEdit.style.background = 'rgba(255,255,255,0.1)';
                btnEdit.style.border = '1px solid rgba(255,255,255,0.2)';
                btnEdit.style.color = '#fff';
                btnEdit.style.padding = '0.3rem 0.6rem';
                btnEdit.style.borderRadius = '0.4rem';
                btnEdit.style.fontSize = '0.75rem';
                btnEdit.style.cursor = 'pointer';

                btnEdit.addEventListener('click', () => editAlumnoGrupo(m.nombreCompleto, grupoName));

                item.appendChild(memberInfo);
                item.appendChild(btnEdit);
                list.appendChild(item);
            });

            card.appendChild(list);
            gruposCardsContainer.appendChild(card);
        });

    } catch (err) {
        console.error('Error cargando tarjetas de grupos', err);
    }
}

async function editAlumnoGrupo(nombreAlumno, grupoActual) {
    const nuevoGrupo = prompt(`Modificar grupo para "${nombreAlumno}":\n(Grupo actual: ${grupoActual})\n\nIngresa el nombre del nuevo grupo (una sola palabra):`, grupoActual);
    
    if (nuevoGrupo === null) return; // Cancelado por docente

    const cleanGrupo = nuevoGrupo.trim().toUpperCase().replace(/\s/g, '');

    if (!cleanGrupo) {
        alert('El nombre del grupo no puede estar vacío.');
        return;
    }

    try {
        const currentCourse = cursoSelect.value;
        const res = await fetch('/api/update-alumno-grupo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                curso: currentCourse,
                nombreAlumno: nombreAlumno,
                nuevoGrupo: cleanGrupo
            })
        });

        const result = await res.json();
        if (result.success) {
            alert(`✅ ${nombreAlumno} ahora pertenece al grupo [${result.grupo}]. Guardado en Excel.`);
            loadGruposView();
            refreshAlumnosList();
        } else {
            alert(result.error || 'Error al cambiar de grupo.');
        }
    } catch (err) {
        alert('Error de conexión al guardar en el servidor.');
    }
}

async function loadAdminFormConfig() {
    try {
        const res = await fetch('/api/form-config');
        currentFormConfig = await res.json();
        renderStandardFields();
        renderCustomFields();
        syncAsistenciaConfigUI();
    } catch (err) {
        console.error('Error cargando configuración del formulario', err);
    }
}

// Rellena los controles de "Asistencia tardía" con la configuración actual
function syncAsistenciaConfigUI() {
    const asist = (currentFormConfig && currentFormConfig.asistencia) || {};
    const chk = document.getElementById('asistencia-permitir-tardio');
    const hora = document.getElementById('asistencia-hora-limite');
    if (chk) chk.checked = asist.permitirPresenteTardio !== false;
    if (hora) hora.value = (asist.horaLimite || '').trim();
}

// Lee los controles de "Asistencia tardía" y los guarda en currentFormConfig
function readAsistenciaConfigFromUI() {
    const chk = document.getElementById('asistencia-permitir-tardio');
    const hora = document.getElementById('asistencia-hora-limite');
    if (!currentFormConfig.asistencia) currentFormConfig.asistencia = {};
    if (chk) currentFormConfig.asistencia.permitirPresenteTardio = chk.checked;
    if (hora) currentFormConfig.asistencia.horaLimite = hora.value || '';
}

let activeEditingField = null; // { type: 'standard'|'custom', key: string|number }
let tempEditingOptions = [];

function renderStandardFields() {
    const container = document.getElementById('standard-fields-container');
    if (!container) return;
    container.innerHTML = '';

    const labelsMap = {
        email: 'Email Privado',
        dni: 'DNI / ID',
        titulo: 'Título Profesional / Especialidad',
        tecnologia: 'Relación con la Tecnología',
        grupo: 'Grupo',
        telefono: 'Teléfono',
        foto: '📷 Foto Real del Rostro'
    };

    Object.keys(currentFormConfig.standardFields || {}).forEach(key => {
        const field = currentFormConfig.standardFields[key];
        const card = document.createElement('div');
        card.style.cssText = 'background: rgba(255,255,255,0.06); padding: 1rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.15); display: flex; flex-direction: column; gap: 0.5rem;';
        
        const isSelect = field.type === 'select' || key === 'titulo' || key === 'tecnologia';
        const optionsCount = (field.options && Array.isArray(field.options)) ? field.options.length : 0;
        const currentCategory = field.category || 'personal';

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-weight: bold; font-size: 1rem; color: #fff;">${esc(labelsMap[key] || field.label || key)}</div>
                <select id="std_cat_${key}" style="padding: 0.2rem 0.5rem; border-radius: 6px; background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.2); color: #fbbf24; font-size: 0.8rem; font-weight: 600;">
                    <option value="personal" ${currentCategory === 'personal' ? 'selected' : ''}>👤 Personal</option>
                    <option value="clase" ${currentCategory === 'clase' ? 'selected' : ''}>📚 Clase</option>
                </select>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.4rem;">
                <input type="checkbox" id="std_enable_${key}" ${field.enabled !== false ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
                <label for="std_enable_${key}" style="cursor: pointer;">Solicitar en Formulario</label>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <input type="checkbox" id="std_req_${key}" ${field.required !== false ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
                <label for="std_req_${key}" style="cursor: pointer;">Obligatorio</label>
            </div>
            ${isSelect ? `
                <div style="margin-top: 0.3rem;">
                    <button type="button" onclick="openOptionsModal('standard', '${key}')" class="btn-secondary" style="width: 100%; padding: 0.35rem 0.6rem; font-size: 0.8rem; background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.4); color: #a5b4fc;">
                        ⚙️ Opciones Desplegable (${optionsCount})
                    </button>
                </div>
            ` : ''}
        `;
        container.appendChild(card);
    });
}

function renderCustomFields() {
    const container = document.getElementById('custom-fields-container');
    if (!container) return;
    container.innerHTML = '';

    if (!currentFormConfig.customFields || currentFormConfig.customFields.length === 0) {
        container.innerHTML = '<p style="opacity: 0.6; grid-column: 1/-1;">No has creado campos personalizados aún.</p>';
        return;
    }

    currentFormConfig.customFields.forEach((field, index) => {
        const card = document.createElement('div');
        card.style.cssText = 'background: rgba(255,255,255,0.06); padding: 1rem; border-radius: 12px; border: 1px solid rgba(245, 158, 11, 0.4); display: flex; flex-direction: column; gap: 0.5rem; position: relative;';
        
        const isSelect = field.type === 'select';
        const optionsCount = (field.options && Array.isArray(field.options)) ? field.options.length : 0;
        const currentCategory = field.category || 'clase';

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
                <div style="font-weight: bold; font-size: 1rem; color: #f59e0b; flex: 1;">${esc(field.label)}</div>
                <select id="cust_cat_${index}" style="padding: 0.2rem 0.4rem; border-radius: 6px; background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.2); color: #fbbf24; font-size: 0.75rem; font-weight: 600;">
                    <option value="clase" ${currentCategory === 'clase' ? 'selected' : ''}>📚 Clase</option>
                    <option value="personal" ${currentCategory === 'personal' ? 'selected' : ''}>👤 Personal</option>
                </select>
                <button onclick="removeCustomField(${index})" style="background: none; border: none; color: #ef4444; font-size: 1.2rem; cursor: pointer; padding: 0 0.2rem;" title="Eliminar campo">&times;</button>
            </div>
            <div style="font-size: 0.85rem; opacity: 0.7;">Tipo: ${field.type === 'select' ? 'Desplegable' : field.type === 'number' ? 'Número' : 'Texto'}</div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.4rem;">
                <input type="checkbox" id="cust_enable_${index}" ${field.enabled !== false ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
                <label for="cust_enable_${index}" style="cursor: pointer;">Solicitar en Formulario</label>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <input type="checkbox" id="cust_req_${index}" ${field.required ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
                <label for="cust_req_${index}" style="cursor: pointer;">Obligatorio</label>
            </div>
            ${isSelect ? `
                <div style="margin-top: 0.3rem;">
                    <button type="button" onclick="openOptionsModal('custom', ${index})" class="btn-secondary" style="width: 100%; padding: 0.35rem 0.6rem; font-size: 0.8rem; background: rgba(245,158,11,0.2); border: 1px solid rgba(245,158,11,0.4); color: #fbbf24;">
                        ⚙️ Opciones Desplegable (${optionsCount})
                    </button>
                </div>
            ` : ''}
        `;
        container.appendChild(card);
    });
}

async function removeCustomField(index) {
    if (confirm('¿Deseas eliminar este campo personalizado?')) {
        currentFormConfig.customFields.splice(index, 1);
        renderCustomFields();
        await saveCurrentFormConfig(false);
    }
}

// ── BOTÓN LIMPIEZA / DESMARCADO DE TILDES ─────────────────────────────
document.getElementById('btn-uncheck-all')?.addEventListener('click', async () => {
    if (confirm('¿Deseas desmarcar la solicitud de todos los campos?\n\nLos campos NO se borrarán del sistema, solo se desactivarán para que puedas activarlos nuevamente cuando lo requieras.')) {
        Object.keys(currentFormConfig.standardFields || {}).forEach(k => {
            currentFormConfig.standardFields[k].enabled = false;
        });
        (currentFormConfig.customFields || []).forEach(f => {
            f.enabled = false;
        });
        renderStandardFields();
        renderCustomFields();
        await saveCurrentFormConfig(false);
        alert('🧹 Todas las casillas han sido desmarcadas y guardadas.\nEn la vista del alumno sólo se solicitará la selección de su nombre para dar el presente.');
    }
});

// ── GESTOR DE OPCIONES EN MODAL DE DESPLEGABLES ──────────────────────
function openOptionsModal(fieldType, keyOrIndex) {
    activeEditingField = { type: fieldType, key: keyOrIndex };
    let fieldObj = null;
    if (fieldType === 'standard') {
        fieldObj = currentFormConfig.standardFields[keyOrIndex];
    } else {
        fieldObj = currentFormConfig.customFields[keyOrIndex];
    }

    if (!fieldObj) return;

    const modal = document.getElementById('options-editor-modal');
    const modalTitle = document.getElementById('options-modal-title');
    const newItemInput = document.getElementById('options-new-item');

    if (modalTitle) modalTitle.textContent = `⚙️ Opciones para "${fieldObj.label || keyOrIndex}"`;
    if (newItemInput) newItemInput.value = '';

    tempEditingOptions = Array.from(fieldObj.options || []);
    renderOptionsList();

    if (modal) modal.style.display = 'block';
}

function renderOptionsList() {
    const listContainer = document.getElementById('options-items-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (tempEditingOptions.length === 0) {
        listContainer.innerHTML = '<p style="opacity: 0.6; padding: 0.5rem; text-align: center;">No hay opciones cargadas aún.</p>';
        return;
    }

    tempEditingOptions.forEach((optText, i) => {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; background: rgba(0,0,0,0.3); padding: 0.4rem 0.6rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);';
        
        row.innerHTML = `
            <input type="text" value="${esc(optText)}" onchange="updateTempOption(${i}, this.value)" style="flex: 1; padding: 0.3rem 0.5rem; border-radius: 4px; background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.2); color: white; font-size: 0.9rem;">
            <button onclick="deleteTempOption(${i})" style="background: none; border: none; color: #f87171; cursor: pointer; font-size: 1.1rem;" title="Eliminar opción">&times;</button>
        `;
        listContainer.appendChild(row);
    });
}

function updateTempOption(index, newText) {
    const clean = newText.trim();
    if (clean) {
        tempEditingOptions[index] = clean;
    } else {
        tempEditingOptions.splice(index, 1);
    }
    renderOptionsList();
}

function deleteTempOption(index) {
    tempEditingOptions.splice(index, 1);
    renderOptionsList();
}

document.getElementById('btn-add-option-item')?.addEventListener('click', () => {
    const input = document.getElementById('options-new-item');
    if (!input) return;
    const text = input.value.trim();
    if (!text) {
        alert('Escribe una opción primero.');
        return;
    }
    if (tempEditingOptions.includes(text)) {
        alert('Esa opción ya existe en la lista.');
        return;
    }
    tempEditingOptions.push(text);
    input.value = '';
    renderOptionsList();
});

document.getElementById('close-options-modal')?.addEventListener('click', () => {
    const modal = document.getElementById('options-editor-modal');
    if (modal) modal.style.display = 'none';
});

document.getElementById('btn-guardar-opciones-modal')?.addEventListener('click', () => {
    if (!activeEditingField) return;
    const { type, key } = activeEditingField;

    const cleanList = tempEditingOptions.map(o => o.trim()).filter(o => o);

    if (type === 'standard') {
        if (!currentFormConfig.standardFields[key].options) currentFormConfig.standardFields[key].options = [];
        currentFormConfig.standardFields[key].options = cleanList;
    } else {
        if (!currentFormConfig.customFields[key].options) currentFormConfig.customFields[key].options = [];
        currentFormConfig.customFields[key].options = cleanList;
    }

    const modal = document.getElementById('options-editor-modal');
    if (modal) modal.style.display = 'none';

    renderStandardFields();
    renderCustomFields();
    alert('✅ Opciones actualizadas. Recuerda presionar "Guardar Configuración" para aplicar los cambios en el servidor.');
});

newFieldType?.addEventListener('change', (e) => {
    if (e.target.value === 'select') {
        newFieldOptionsGroup.style.display = 'block';
    } else {
        newFieldOptionsGroup.style.display = 'none';
    }
});

btnAddCustomField?.addEventListener('click', () => {
    const labelInput = document.getElementById('new-field-label');
    const typeInput = document.getElementById('new-field-type');
    const catInput = document.getElementById('new-field-category');
    const optionsInput = document.getElementById('new-field-options');
    const reqInput = document.getElementById('new-field-required');

    const label = labelInput.value.trim();
    if (!label) {
        alert('Por favor ingresa el nombre o etiqueta del nuevo campo.');
        return;
    }

    const type = typeInput.value;
    const category = catInput ? catInput.value : 'clase';
    let options = [];
    if (type === 'select') {
        options = optionsInput.value.split(',').map(o => o.trim()).filter(o => o);
        if (options.length === 0) {
            alert('Para un campo de tipo Desplegable, debes ingresar al menos una opción.');
            return;
        }
    }

    const id = 'custom_' + Date.now();
    const newField = {
        id,
        label,
        name: label,
        type,
        category,
        options,
        enabled: true,
        required: reqInput.checked
    };

    if (!currentFormConfig.customFields) currentFormConfig.customFields = [];
    currentFormConfig.customFields.push(newField);

    labelInput.value = '';
    optionsInput.value = '';
    reqInput.checked = false;
    newFieldType.value = 'text';
    newFieldOptionsGroup.style.display = 'none';

    renderCustomFields();
    saveCurrentFormConfig(false);
});

async function saveCurrentFormConfig(showAlert = true) {
    if (!currentFormConfig) return false;

    Object.keys(currentFormConfig.standardFields || {}).forEach(key => {
        const enCb = document.getElementById(`std_enable_${key}`);
        const reqCb = document.getElementById(`std_req_${key}`);
        const catSel = document.getElementById(`std_cat_${key}`);
        if (enCb) currentFormConfig.standardFields[key].enabled = enCb.checked;
        if (reqCb) currentFormConfig.standardFields[key].required = reqCb.checked;
        if (catSel) currentFormConfig.standardFields[key].category = catSel.value;
    });

    (currentFormConfig.customFields || []).forEach((field, index) => {
        const enCb = document.getElementById(`cust_enable_${index}`);
        const reqCb = document.getElementById(`cust_req_${index}`);
        const catSel = document.getElementById(`cust_cat_${index}`);
        if (enCb) field.enabled = enCb.checked;
        if (reqCb) field.required = reqCb.checked;
        if (catSel) field.category = catSel.value;
    });

    readAsistenciaConfigFromUI();

    try {
        const res = await fetch('/api/form-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentFormConfig)
        });
        const data = await res.json();
        if (data.success) {
            if (showAlert) alert('✅ Configuración del formulario guardada con éxito.');
            return true;
        } else {
            if (showAlert) alert('Error al guardar la configuración.');
        }
    } catch (err) {
        console.error('Error al guardar configuración del formulario', err);
        if (showAlert) alert('Ocurrió un error al enviar la configuración al servidor.');
    }
    return false;
}

btnSaveConfig?.addEventListener('click', async () => {
    await saveCurrentFormConfig(true);
});

function exportData(type) {
    const curso = cursoSelect.value;
    if (!curso) {
        alert('Por favor selecciona un curso activo para exportar.');
        return;
    }
    const url = `/api/export/${type}?curso=${encodeURIComponent(curso)}`;
    window.open(url, '_blank');
}

// ── AUTENTICACIÓN DEL PANEL (A1) ────────────────────────────────────────
const loginScreen = document.getElementById('login-screen');
const adminApp = document.getElementById('admin-app');
const loginForm = document.getElementById('login-form');
const loginPass = document.getElementById('login-pass');
const loginError = document.getElementById('login-error');
const btnTogglePass = document.getElementById('btn-toggle-pass');
const loginDefaultHint = document.getElementById('login-default-hint');

if (btnTogglePass && loginPass) {
    btnTogglePass.addEventListener('click', () => {
        const showing = loginPass.type === 'text';
        loginPass.type = showing ? 'password' : 'text';
        btnTogglePass.textContent = showing ? '👁️' : '🙈';
        btnTogglePass.title = showing ? 'Mostrar contraseña' : 'Ocultar contraseña';
        loginPass.focus();
    });
}

async function showDefaultPasswordHint() {
    try {
        const res = await fetch('/api/admin/info');
        const data = await res.json();
        if (loginDefaultHint && data && data.usingDefaultPassword && data.defaultPassword) {
            loginDefaultHint.textContent = `🔑 Estás usando la contraseña por defecto (${data.defaultPassword}). En el primer ingreso será obligatorio cambiarla.`;
            loginDefaultHint.style.display = 'block';
        }
    } catch (err) {
        console.error('Error consultando info del login:', err);
    }
}

function showLogin() {
    if (loginScreen) loginScreen.style.display = 'flex';
    if (changePassScreen) changePassScreen.style.display = 'none';
    if (adminApp) adminApp.style.display = 'none';
}

function showAdmin() {
    if (loginScreen) loginScreen.style.display = 'none';
    if (changePassScreen) changePassScreen.style.display = 'none';
    if (adminApp) adminApp.style.display = 'block';
}

// ── CAMBIO DE CONTRASEÑA (A1) ─────────────────────────────────────
const changePassScreen = document.getElementById('change-pass-screen');
const changePassForm = document.getElementById('change-pass-form');
const changePassCurrent = document.getElementById('change-pass-current');
const changePassNew = document.getElementById('change-pass-new');
const changePassConfirm = document.getElementById('change-pass-confirm');
const changePassError = document.getElementById('change-pass-error');
const changePassSuccess = document.getElementById('change-pass-success');
const changePassTitle = document.getElementById('change-pass-title');
const btnCancelChangePass = document.getElementById('btn-cancel-change-pass');
const btnChangePassHeader = document.getElementById('btn-change-pass-header');
const changePassMode = { forced: false };

document.querySelectorAll('.btn-toggle-pass-2').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = btn.parentElement.querySelector('input');
        if (!input) return;
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        btn.textContent = showing ? '👁️' : '🙈';
        btn.title = showing ? 'Mostrar contraseña' : 'Ocultar contraseña';
        input.focus();
    });
});

function showChangePasswordScreen(forced) {
    changePassMode.forced = !!forced;
    resetChangePasswordForm();
    if (changePassTitle) {
        changePassTitle.textContent = forced
            ? 'Para continuar es obligatorio cambiar la contraseña por defecto.'
            : 'Ingresá la contraseña actual y definí una nueva.';
    }
    if (btnCancelChangePass) btnCancelChangePass.style.display = forced ? 'none' : 'block';
    if (changePassError) changePassError.style.display = 'none';
    if (changePassSuccess) changePassSuccess.style.display = 'none';
    if (loginScreen) loginScreen.style.display = 'none';
    if (adminApp) adminApp.style.display = 'none';
    if (changePassScreen) changePassScreen.style.display = 'flex';
    if (changePassCurrent) changePassCurrent.focus();
}

function resetChangePasswordForm() {
    if (changePassCurrent) changePassCurrent.value = '';
    if (changePassNew) changePassNew.value = '';
    if (changePassConfirm) changePassConfirm.value = '';
}

btnCancelChangePass?.addEventListener('click', () => {
    if (changePassScreen) changePassScreen.style.display = 'none';
    if (adminApp) adminApp.style.display = 'block';
    resetChangePasswordForm();
});

btnChangePassHeader?.addEventListener('click', () => {
    showChangePasswordScreen(false);
});

changePassForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (changePassError) changePassError.style.display = 'none';
    if (changePassSuccess) changePassSuccess.style.display = 'none';
    const current = changePassCurrent.value;
    const nuevo = changePassNew.value;
    const confirm = changePassConfirm.value;
    if (!current || !nuevo || !confirm) {
        if (changePassError) { changePassError.textContent = 'Completá todos los campos.'; changePassError.style.display = 'block'; }
        return;
    }
    if (nuevo !== confirm) {
        if (changePassError) { changePassError.textContent = 'La nueva contraseña no coincide con la repetición.'; changePassError.style.display = 'block'; }
        return;
    }
    try {
        const res = await fetch('/api/admin/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword: current, newPassword: nuevo })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            if (changePassSuccess) { changePassSuccess.textContent = '✅ Contraseña cambiada con éxito.'; changePassSuccess.style.display = 'block'; }
            setTimeout(() => {
                resetChangePasswordForm();
                showAdmin();
                initAdmin();
            }, 800);
        } else {
            if (changePassError) { changePassError.textContent = data.error || 'No se pudo cambiar la contraseña.'; changePassError.style.display = 'block'; }
        }
    } catch (err) {
        console.error('Error cambiando contraseña:', err);
        if (changePassError) { changePassError.textContent = 'No se pudo conectar con el servidor.'; changePassError.style.display = 'block'; }
    }
});

function handleAuthError() {
    showLogin();
    if (loginError) loginError.textContent = 'Tu sesión expiró. Ingresá nuevamente.';
    if (loginError) loginError.style.display = 'block';
}

function isAuthError(res) {
    return res && (res.status === 401 || res.status === 403);
}

loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!loginPass) return;
    const pass = loginPass.value;
    if (!pass) {
        if (loginError) { loginError.textContent = 'Ingresá la contraseña.'; loginError.style.display = 'block'; }
        return;
    }
    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pass })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            loginPass.value = '';
            if (loginError) loginError.style.display = 'none';
            if (data.mustChangePassword) {
                showChangePasswordScreen(true);
            } else {
                showAdmin();
                await initAdmin();
            }
        } else {
            if (loginError) { loginError.textContent = data.error || 'Contraseña incorrecta.'; loginError.style.display = 'block'; }
        }
    } catch (err) {
        console.error('Error en login:', err);
        if (loginError) { loginError.textContent = 'No se pudo conectar con el servidor.'; loginError.style.display = 'block'; }
    }
});

async function bootAdmin() {
    try {
        const res = await fetch('/api/admin/check');
        const data = await res.json();
        if (data && data.authenticated) {
            if (data.mustChangePassword) {
                showChangePasswordScreen(true);
            } else {
                showAdmin();
                await initAdmin();
            }
        } else {
            showLogin();
            showDefaultPasswordHint();
        }
    } catch (err) {
        console.error('Error verificando sesión:', err);
        showLogin();
        showDefaultPasswordHint();
    }
}

bootAdmin();
