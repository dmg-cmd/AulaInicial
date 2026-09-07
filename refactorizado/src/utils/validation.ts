import { ARCHIVO, RATE_LIMIT, REGEX, MENSAJES } from '../config/constants.js';
import { PATHS } from '../config/paths.js';
import xlsx from 'xlsx';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync, unlinkSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

// ───────────────────────────────────────────────────────────────
// LOCK POR CURSO / CONCURRENCIA SOBRE EXCEL (A4)
// ───────────────────────────────────────────────────────────────
const courseLocks = new Map<string, Promise<any>>();

export function withCourseLock(filePath: string, fn: (workbook: any) => Promise<any>): Promise<any> {
  const prev = courseLocks.get(filePath) || Promise.resolve();
  const next = prev.then(fn, fn);
  courseLocks.set(filePath, next.catch(() => {}));
  return next;
}

export function writeWorkbookSafely(workbook: any, filePath: string): { busy: boolean; error: string } | null {
  try {
    xlsx.writeFile(workbook, filePath);
    return null;
  } catch (writeErr: any) {
    if (writeErr.code === 'EBUSY' || (writeErr.message && (writeErr.message.includes('busy') || writeErr.message.includes('locked')))) {
      return { busy: true, error: 'El archivo Excel del curso está abierto en Microsoft Excel o en otro programa. Por favor ciérralo y vuelve a intentarlo.' };
    }
    return { busy: false, error: 'No se pudo guardar los cambios en la planilla Excel: ' + writeErr.message };
  }
}

export function rateLimitExceeded(ip: string, action: string): boolean {
  if (!ip) return false;
  const key = `${action}:${ip}`;
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT.WINDOW_MS });
    return false;
  }
  bucket.count++;
  return bucket.count > RATE_LIMIT.MAX_REQUESTS;
}

export function validateFotoBase64(base64Data: string): { valid: boolean; buffer?: Buffer; error?: string } {
  if (!base64Data || typeof base64Data !== 'string') {
    return { valid: false, error: 'Datos de foto inválidos.' };
  }
  const matches = base64Data.match(REGEX.BASE64_IMAGE);
  if (!matches) {
    return { valid: false, error: 'Formato de imagen no reconocido.' };
  }
  const mime = matches[1].toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    return { valid: false, error: 'Solo se permiten imágenes JPEG, PNG o WebP.' };
  }
  const buffer = Buffer.from(matches[2], 'base64');
  if (buffer.length === 0) {
    return { valid: false, error: 'La imagen está vacía.' };
  }
  if (buffer.length > ARCHIVO.MAX_FOTO_BYTES) {
    return { valid: false, error: 'La imagen supera el tamaño máximo de 5 MB.' };
  }
  const magicOk =
    (mime === 'image/jpeg' && buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) ||
    (mime === 'image/png' && buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) ||
    (mime === 'image/webp' && buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP');
  if (!magicOk) {
    return { valid: false, error: 'El archivo no es una imagen real (firma de bytes no válida).' };
  }
  return { valid: true, buffer };
}

export function normalizeClientIP(ip: string | undefined): string {
  if (!ip) return '';
  return ip.replace(/^::ffff:/, '').replace(/^::1$/, '127.0.0.1');
}

export function isFullyRegistered(row: Record<string, unknown> | null | undefined): boolean {
  return !!(row && row['Fecha Registro']);
}

export function todaySheetName(): string {
  const hoy = new Date();
  return `${hoy.getDate().toString().padStart(2, '0')}-${(hoy.getMonth() + 1).toString().padStart(2, '0')}-${hoy.getFullYear()}`;
}

export function normalizeSheetDate(raw: string | null | undefined): string {
  if (!raw) return '';
  const s = raw.toString().trim();
  let m = s.match(REGEX.FECHA_YYYY_MM_DD);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(REGEX.FECHA_DD_MM_YYYY);
  if (m) return s;
  return s.replace(/[/\\]/g, '-');
}

export function parseSheetDate(sName: string): Date | null {
  const m = sName.toString().match(REGEX.FECHA_DD_MM_YYYY);
  if (!m) return null;
  return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
}

export function obtenerNombreAlumno(row: Record<string, unknown> | null | undefined): string {
  if (!row || typeof row !== 'object') return '';
  const full =
    row['Full Name'] || row['Full name'] || row['Name'] || row['Nombre y Apellido'] ||
    row['Alumno'] || row['Display name'] || row['User Name'] || '';
  if (full) return String(full).trim();
  const first = row['First name'] || row['First Name'] || row['Nombre'] || '';
  const last = row['Last name'] || row['Last Name'] || row['Apellido'] || '';
  return `${first} ${last}`.trim();
}

export function horaAminutos(horaStr: string | null | undefined): number | null {
  const m = (horaStr || '').match(REGEX.HORA_HH_MM);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function evaluarTarde(
  cfg: { modo: string; horaInicio: string; margenGracia: number; minDespues: number } | null,
  ahoraMin: number,
  horaTomaListaMin: number | null
): boolean {
  if (!cfg || cfg.modo === 'manual') return false;
  if (cfg.modo === 'horario') {
    const m = (cfg.horaInicio || '').match(REGEX.HORA_HH_MM);
    if (!m) return false;
    const inicioMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    const margen = cfg.margenGracia || 0;
    return ahoraMin > inicioMin + margen;
  }
  if (cfg.modo === 'desplist') {
    if (typeof horaTomaListaMin !== 'number') return false;
    const minDesp = cfg.minDespues || 30;
    return (ahoraMin - horaTomaListaMin) > minDesp;
  }
  return false;
}

export function dentroDeHoraLimite(horaStr: string | null | undefined): boolean {
  const m = (horaStr || '').trim().match(REGEX.HORA_HH_MM);
  if (!m) return true;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const limitMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return nowMin <= limitMin;
}

export function normalizeGrupoStr(g: string | null | undefined): string {
  if (!g) return '';
  return g.toString().toUpperCase().replace(/^GRUPO\s*[-_]?\s*/, '').trim();
}

export function leerCfgTardanza(workbook: any): { modo: string; horaInicio: string; margenGracia: number; minDespues: number } {
  const CFG_TARDANZA_SHEET = 'CfgTardanza';
  const def = { modo: 'manual', horaInicio: '', margenGracia: 0, minDespues: 30 };
  try {
    if (!workbook.SheetNames.includes(CFG_TARDANZA_SHEET)) return def;
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[CFG_TARDANZA_SHEET]);
    const map: Record<string, string> = {};
    rows.forEach((r: any) => { if (r.Clave) map[String(r.Clave).trim()] = String(r.Valor); });
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

export function leerHoraTomaLista(workbook: any, fecha: string): string {
  const TOMA_LISTA_SHEET = 'TomaLista';
  try {
    if (!workbook.SheetNames.includes(TOMA_LISTA_SHEET)) return '';
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[TOMA_LISTA_SHEET]) as Array<Record<string, unknown>>;
    const fila = rows.find((r) => (r.Fecha || '').toString().trim() === fecha);
    return fila ? (String(fila.Hora || '')).trim() : '';
  } catch { return ''; }
}

export function ocultarHoja(workbook: any, name: string): void {
  const idx = workbook.SheetNames.indexOf(name);
  if (idx < 0) return;
  workbook.Workbook = workbook.Workbook || {};
  workbook.Workbook.Sheets = workbook.Workbook.Sheets || [];
  while (workbook.Workbook.Sheets.length < workbook.SheetNames.length) {
    workbook.Workbook.Sheets.push({});
  }
  workbook.Workbook.Sheets[idx] = workbook.Workbook.Sheets[idx] || {};
  workbook.Workbook.Sheets[idx].Hidden = 2;
}

export function guardarCfgTardanza(workbook: any, cfg: { modo: string; horaInicio: string; margenGracia: number; minDespues: number }): void {
  const CFG_TARDANZA_SHEET = 'CfgTardanza';
  const limpio = {
    modo: (cfg.modo === 'horario' || cfg.modo === 'desplist') ? cfg.modo : 'manual',
    horaInicio: (typeof cfg.horaInicio === 'string') ? cfg.horaInicio.trim() : '',
    margenGracia: parseInt(String(cfg.margenGracia), 10) || 0,
    minDespues: parseInt(String(cfg.minDespues), 10) || 30
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
}

export function guardarHoraTomaLista(workbook: any, fecha: string, hora: string): void {
  const TOMA_LISTA_SHEET = 'TomaLista';
  let rows: any[] = [];
  if (workbook.SheetNames.includes(TOMA_LISTA_SHEET)) {
    rows = xlsx.utils.sheet_to_json(workbook.Sheets[TOMA_LISTA_SHEET]);
  }
  const i = rows.findIndex((r: any) => (r.Fecha || '').toString().trim() === fecha);
  if (i >= 0) rows[i].Hora = hora;
  else rows.push({ Fecha: fecha, Hora: hora });
  const sheet = xlsx.utils.json_to_sheet(rows);
  if (workbook.SheetNames.includes(TOMA_LISTA_SHEET)) workbook.Sheets[TOMA_LISTA_SHEET] = sheet;
  else xlsx.utils.book_append_sheet(workbook, sheet, TOMA_LISTA_SHEET);
  ocultarHoja(workbook, TOMA_LISTA_SHEET);
}

// ───────────────────────────────────────────────────────────────
// FOTOS Y ARCHIVOS
// ───────────────────────────────────────────────────────────────
export function getFotoFilename(studentName: string, dni: string): string {
  const cleanName = (studentName || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  const cleanDni = (dni || '').toString().trim().replace(/[^a-z0-9]/g, '');
  return `foto_${cleanName}_${cleanDni || 'nodni'}.jpg`;
}

export function getStudentFotoUrl(studentName: string, dni: string): string | null {
  const filename = getFotoFilename(studentName, dni);
  const fullPath = join(PATHS.FOTOS_DIR, filename);
  if (existsSync(fullPath)) {
    return `/registros/fotos/${filename}?v=${statSync(fullPath).mtimeMs}`;
  }
  return null;
}

export function findFotoForStudent(studentName: string, dni: string): string | null {
  const exact = getStudentFotoUrl(studentName, dni);
  if (exact) return exact;
  try {
    if (!existsSync(PATHS.FOTOS_DIR)) return null;
    const dniClean = (dni || '').toString().trim().replace(/[^a-z0-9]/g, '');
    const nameSlug = (studentName || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    const matches = readdirSync(PATHS.FOTOS_DIR).filter(f => /^foto_.+\.jpg$/i.test(f));
    if (dniClean) {
      const byDni = matches.find(f => f.toLowerCase().includes(`_${dniClean}.jpg`));
      if (byDni) {
        const full = join(PATHS.FOTOS_DIR, byDni);
        return `/registros/fotos/${byDni}?v=${statSync(full).mtimeMs}`;
      }
    }
    if (nameSlug) {
      const byName = matches.find(f => f.toLowerCase().includes(nameSlug));
      if (byName) {
        const full = join(PATHS.FOTOS_DIR, byName);
        return `/registros/fotos/${byName}?v=${statSync(full).mtimeMs}`;
      }
    }
  } catch (e) {
    console.error('Error al buscar foto por fallback:', e);
  }
  return null;
}

export function saveStudentFoto(studentName: string, dni: string, base64Data: string): boolean {
  const validation = validateFotoBase64(base64Data);
  if (!validation.valid) {
    console.error(`📵 Foto rechazada para [${studentName}]: ${validation.error}`);
    return false;
  }
  try {
    const filename = getFotoFilename(studentName, dni);
    const fullPath = join(PATHS.FOTOS_DIR, filename);
    writeFileSync(fullPath, validation.buffer!);
    console.log(`📸 Foto real guardada para [${studentName}] en ${filename}`);
    return true;
  } catch (err) {
    console.error('Error al guardar foto del alumno:', err);
    return false;
  }
}

export function deleteStudentFoto(studentName: string, dni: string): boolean {
  const filename = getFotoFilename(studentName, dni);
  const fullPath = join(PATHS.FOTOS_DIR, filename);
  let targetPath = fullPath;
  if (!existsSync(targetPath)) {
    try {
      if (existsSync(PATHS.FOTOS_DIR)) {
        const dniClean = (dni || '').toString().trim().replace(/[^a-z0-9]/g, '');
        const nameSlug = (studentName || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
        const matches = readdirSync(PATHS.FOTOS_DIR).filter(f => /^foto_.+\.jpg$/i.test(f));
        const byDni = dniClean ? matches.find(f => f.toLowerCase().includes(`_${dniClean}.jpg`)) : null;
        const byName = !byDni && nameSlug ? matches.find(f => f.toLowerCase().includes(nameSlug)) : null;
        if (byDni || byName) targetPath = join(PATHS.FOTOS_DIR, byDni || byName!);
      }
    } catch (err) {
      console.error('Error al buscar foto para eliminar:', err);
    }
  }
  if (existsSync(targetPath)) {
    try {
      unlinkSync(targetPath);
      console.log(`🗑️ Foto eliminada para [${studentName}]`);
      return true;
    } catch (err) {
      console.error('Error al eliminar foto:', err);
    }
  }
  return false;
}

export function findActualFileInCursos(curso: string): string | null {
  if (!curso) return null;
  const safeName = basename(curso).trim().toLowerCase();
  if (!existsSync(PATHS.CURSOS_DIR)) return null;
  try {
    const files = readdirSync(PATHS.CURSOS_DIR);
    for (const f of files) {
      if (f.trim().toLowerCase() === safeName) {
        return join(PATHS.CURSOS_DIR, f);
      }
    }
  } catch (e) {
    console.error('Error al buscar archivo en cursos:', e);
  }
  return null;
}

export function getOrInitWorkingWorkbook(curso: string): string | null {
  if (!curso) return null;
  const safeCurso = basename(curso).trim();
  if (!existsSync(PATHS.REGISTROS_DIR)) {
    mkdirSync(PATHS.REGISTROS_DIR, { recursive: true });
  }
  try {
    const registroFiles = readdirSync(PATHS.REGISTROS_DIR);
    const matchRegistro = registroFiles.find(f => f.trim().toLowerCase() === safeCurso.toLowerCase());
    if (matchRegistro) {
      return join(PATHS.REGISTROS_DIR, matchRegistro);
    }
  } catch (err) {
    console.error('Error al leer registros/:', err);
  }
  const cursoOriginalPath = findActualFileInCursos(safeCurso);
  if (cursoOriginalPath && existsSync(cursoOriginalPath)) {
    try {
      const destName = basename(cursoOriginalPath);
      const destPath = join(PATHS.REGISTROS_DIR, destName);
      copyFileSync(cursoOriginalPath, destPath);
      console.log(`📁 Nuevo archivo operativo inicializado en registros/ para [${destName}]`);
      return destPath;
    } catch (err) {
      console.error(`Error al inicializar registro para [${safeCurso}]:`, err);
    }
  }
  return null;
}

// ───────────────────────────────────────────────────────────────
// CONSOLIDACIÓN DE PRESENTISMO
// ───────────────────────────────────────────────────────────────
export function consolidarPresentismo(workbook: any, mainData: any[]): number {
  const dateSheets = workbook.SheetNames.filter((s: string) => parseSheetDate(s) !== null);
  const totalClases = dateSheets.length;
  const asistenciaAcumulada: Record<string, { presentes: number; ausentes: number; tardes: number }> = {};

  dateSheets.forEach((sName: string) => {
    const sData = xlsx.utils.sheet_to_json(workbook.Sheets[sName]) as Array<Record<string, unknown>>;
    sData.forEach((r: Record<string, unknown>) => {
      const nombreItem = (r['Alumno'] || r['Nombre'] || '').toString().trim().toLowerCase();
      if (!nombreItem) return;
      if (!asistenciaAcumulada[nombreItem]) {
        asistenciaAcumulada[nombreItem] = { presentes: 0, ausentes: 0, tardes: 0 };
      }
      const st = (r['Asistencia'] || r['Estado'] || '').toString().trim().toUpperCase();
      if (st.includes('PRESENTE')) {
        asistenciaAcumulada[nombreItem].presentes++;
      } else if (st.includes('TARDE')) {
        asistenciaAcumulada[nombreItem].tardes++;
      } else {
        asistenciaAcumulada[nombreItem].ausentes++;
      }
    });
  });

  mainData.forEach(row => {
    if (row['Borrado'] === 'SI') return;
    const key = obtenerNombreAlumno(row).toLowerCase();
    const stats = asistenciaAcumulada[key] || { presentes: 0, ausentes: 0, tardes: 0 };
    row['Total Clases'] = totalClases;
    row['Presentes'] = stats.presentes;
    row['Ausentes'] = stats.ausentes;
    row['Tardes'] = stats.tardes;
    row['% Presentismo'] = totalClases > 0 ? parseFloat(((stats.presentes / totalClases) * 100).toFixed(1)) : 0;
  });

  return totalClases;
}

export function reconciliarAusentes(workbook: any, mainData: Array<Record<string, unknown>>, soloDesdeHoy: boolean): void {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  workbook.SheetNames.forEach((sName: string) => {
    if (parseSheetDate(sName) === null) return;
    if (soloDesdeHoy) {
      const d = parseSheetDate(sName);
      if (!d || d < hoy) return;
    }
    const sData = xlsx.utils.sheet_to_json(workbook.Sheets[sName]) as Array<Record<string, unknown>>;
    const nombresEnHoja = new Set(
      sData.map((r: Record<string, unknown>) => (r['Alumno'] || r['Nombre'] || '').toString().trim().toLowerCase()).filter(Boolean)
    );
    let modificado = false;
    mainData.forEach((row: Record<string, unknown>) => {
      if (row['Borrado'] === 'SI') return;
      const nombre = obtenerNombreAlumno(row);
      if (!nombre) return;
      if (!nombresEnHoja.has(nombre.toLowerCase())) {
        sData.push({
          'DNI': row['DNI'] || 'SIN DNI',
          'Alumno': nombre,
          'Asistencia': 'AUSENTES',
          'Grupo': (row['Grupo'] || 'SIN GRUPO').toString().toUpperCase().trim(),
          'Hora Registro': '-'
        });
        modificado = true;
      }
    });
    if (modificado) {
      workbook.Sheets[sName] = xlsx.utils.json_to_sheet(sData);
    }
  });
}