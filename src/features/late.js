const { xlsx } = require('../data/xlsx');

const CFG_TARDANZA_SHEET = 'CfgTardanza';
const TOMA_LISTA_SHEET = 'TomaLista';

function ocultarHoja(workbook, name) {
    const idx = workbook.SheetNames.indexOf(name);
    if (idx < 0) return;
    workbook.Workbook = workbook.Workbook || {};
    workbook.Workbook.Sheets = workbook.Workbook.Sheets || [];
    while (workbook.Workbook.Sheets.length < workbook.SheetNames.length) {
        workbook.Workbook.Sheets.push({});
    }
    workbook.Workbook.Sheets[idx] = workbook.Workbook.Sheets[idx] || {};
    workbook.Workbook.Sheets[idx].Hidden = 2; // 2 = muy oculta
}

function leerCfgTardanza(workbook) {
    const def = { modo: 'manual', horaInicio: '', margenGracia: 0, minDespues: 30 };
    try {
        if (!workbook.SheetNames.includes(CFG_TARDANZA_SHEET)) return def;
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[CFG_TARDANZA_SHEET]);
        const map = {};
        rows.forEach(r => { if (r.Clave) map[String(r.Clave).trim()] = r.Valor; });
        return {
            modo: (map.modo === 'horario' || map.modo === 'desplist') ? map.modo : 'manual',
            horaInicio: typeof map.horaInicio === 'string' ? map.horaInicio.trim() : '',
            margenGracia: parseInt(map.margenGracia, 10) || 0,
            minDespues: parseInt(map.minDespues, 10) || 30
        };
    } catch (e) {
        console.error('Error leyendo CfgTardanza:', e);
        return def;
    }
}

function guardarCfgTardanza(workbook, cfg) {
    const limpio = {
        modo: (cfg.modo === 'horario' || cfg.modo === 'desplist') ? cfg.modo : 'manual',
        horaInicio: (typeof cfg.horaInicio === 'string') ? cfg.horaInicio.trim() : '',
        margenGracia: parseInt(cfg.margenGracia, 10) || 0,
        minDespues: parseInt(cfg.minDespues, 10) || 30
    };
    const rows = [
        { Clave: 'modo', Valor: limpio.modo },
        { Clave: 'horaInicio', Valor: limpio.horaInicio },
        { Clave: 'margenGracia', Valor: limpio.margenGracia },
        { Clave: 'minDespues', Valor: limpio.minDespues }
    ];
    const sheet = xlsx.utils.json_to_sheet(rows);
    if (workbook.SheetNames.includes(CFG_TARDANZA_SHEET)) {
        workbook.Sheets[CFG_TARDANZA_SHEET] = sheet;
    } else {
        xlsx.utils.book_append_sheet(workbook, sheet, CFG_TARDANZA_SHEET);
    }
    ocultarHoja(workbook, CFG_TARDANZA_SHEET);
    return limpio;
}

function leerHoraTomaLista(workbook, fecha) {
    try {
        if (!workbook.SheetNames.includes(TOMA_LISTA_SHEET)) return '';
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[TOMA_LISTA_SHEET]);
        const fila = rows.find(r => (r.Fecha || '').toString().trim() === fecha);
        return fila ? (fila.Hora || '').toString().trim() : '';
    } catch (e) { return ''; }
}

function guardarHoraTomaLista(workbook, fecha, hora) {
    let rows = [];
    if (workbook.SheetNames.includes(TOMA_LISTA_SHEET)) {
        rows = xlsx.utils.sheet_to_json(workbook.Sheets[TOMA_LISTA_SHEET]);
    }
    const i = rows.findIndex(r => (r.Fecha || '').toString().trim() === fecha);
    if (i >= 0) rows[i].Hora = hora;
    else rows.push({ Fecha: fecha, Hora: hora });
    const sheet = xlsx.utils.json_to_sheet(rows);
    if (workbook.SheetNames.includes(TOMA_LISTA_SHEET)) workbook.Sheets[TOMA_LISTA_SHEET] = sheet;
    else xlsx.utils.book_append_sheet(workbook, sheet, TOMA_LISTA_SHEET);
    ocultarHoja(workbook, TOMA_LISTA_SHEET);
}

// Nombre de hoja de fecha para "hoy" en formato DD-MM-YYYY
function todaySheetName() {
    const hoy = new Date();
    return `${hoy.getDate().toString().padStart(2, '0')}-${(hoy.getMonth() + 1).toString().padStart(2, '0')}-${hoy.getFullYear()}`;
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

function horaAminutos(horaStr) {
    const m = (horaStr || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

// Devuelve true si, según la config del curso, el alumno llegó tarde a la hora actual.
function evaluarTarde(cfg, ahoraMin, horaTomaListaMin) {
    if (!cfg || cfg.modo === 'manual') return false;
    if (cfg.modo === 'horario') {
        const m = (cfg.horaInicio || '').match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return false;
        const inicioMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
        const margen = parseInt(cfg.margenGracia, 10) || 0;
        return ahoraMin > (inicioMin + margen);
    }
    if (cfg.modo === 'desplist') {
        if (typeof horaTomaListaMin !== 'number') return false;
        const minDesp = parseInt(cfg.minDespues, 10) || 30;
        return (ahoraMin - horaTomaListaMin) > minDesp;
    }
    return false;
}

module.exports = {
    CFG_TARDANZA_SHEET, TOMA_LISTA_SHEET, ocultarHoja,
    leerCfgTardanza, guardarCfgTardanza, leerHoraTomaLista, guardarHoraTomaLista,
    horaAminutos, evaluarTarde, todaySheetName, normalizeSheetDate
};
