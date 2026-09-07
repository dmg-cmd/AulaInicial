import { PATHS } from '../config/index.js';
import { xlsx, readWorkbook, getOrInitWorkingWorkbook, obtenerNombreAlumno, withCourseLock, writeWorkbookSafely, consolidarPresentismo, findFotoForStudent, normalizeSheetDate, todaySheetName } from '../data/xlsx.js';
import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { stateManager } from '../core/StateManager.js';
import { MENSAJES, ASISTENCIA_ESTADOS } from '../config/constants.js';
import { CourseService } from './CourseService.js';
import { evaluarTarde, leerCfgTardanza, leerHoraTomaLista, guardarCfgTardanza, guardarHoraTomaLista, dentroDeHoraLimite } from '../utils/validation.js';

export interface AsistenciaRegistro {
  nombreCompleto: string;
  dni: string;
  grupo: string;
  presente: boolean;
  tarde: boolean;
}

export interface EstadisticasData {
  availableFields: Array<{ id: string; label: string }>;
  selectedField: string;
  selectedGroup: string;
  totalAlumnosSheet: number;
  totalCount: number;
  data: Array<{ name: string; count: number; percentage: number }>;
}

export interface AusenciasData {
  mesesDisponibles: string[];
  alumnos: Array<{
    nombreCompleto: string;
    dni: string;
    grupo: string;
    fotoUrl: string | null;
    porMes: Record<string, { presentes: number; tardes: number; ausentes: number; total: number; pctAusencia: number }>;
    totales: { presentes: number; tardes: number; ausentes: number; totalClases: number; pctPresentismo: number; pctAusencia: number };
  }>;
  totalesGenerales: {
    presentes: number;
    tardes: number;
    ausentes: number;
    totalClases: number;
    pctPresentismo: number;
    pctAusencia: number;
  } | null;
}

export interface ConsultaAsistenciaData {
  fecha: string | null;
  alumnos: Array<{
    dni: string;
    alumno: string;
    asistencia: string;
    esTardioAuto: boolean;
    grupo: string;
    hora: string;
  }>;
  totalPresentes: number;
  totalTardes: number;
  totalAusentes: number;
  totalAlumnos: number;
}

export class AttendanceService {
  static async tomarAsistencia(
    curso: string,
    fecha: string,
    asistencias: AsistenciaRegistro[]
  ): Promise<{ success: boolean; fecha: string }> {
    const safeCurso = basename(curso);
    const filePath = getOrInitWorkingWorkbook(curso);
    if (!filePath || !existsSync(filePath)) {
      throw new Error(MENSAJES.ARCHIVO_NO_ENCONTRADO);
    }

    const targetFecha = normalizeSheetDate(fecha);

    return new Promise((resolve, reject) => {
      withCourseLock(filePath, async () => {
        try {
          const workbook = readWorkbook(filePath);
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
          if (writeErr) throw new Error(writeErr.error);

          console.log(`📋 Asistencia guardada para la fecha [${targetFecha}] en [${safeCurso}].`);
          resolve({ success: true, fecha: targetFecha });
        } catch (err: any) {
          console.error('Error al guardar asistencia:', err);
          reject(new Error('Error al actualizar el Excel con la asistencia por fecha.'));
        }
      }).catch(() => reject(new Error('Error interno al guardar la asistencia.')));
    });
  }

  static async borrarDiaAsistencia(curso: string, fecha: string): Promise<{ success: boolean; fecha: string; fechasRestantes: string[] }> {
    const safeCurso = basename(curso);
    const filePath = getOrInitWorkingWorkbook(curso);
    if (!filePath || !existsSync(filePath)) {
      throw new Error(MENSAJES.ARCHIVO_NO_ENCONTRADO);
    }

    const targetFecha = normalizeSheetDate(fecha);
    if (!targetFecha) throw new Error('Fecha inválida.');

    return new Promise((resolve, reject) => {
      withCourseLock(filePath, async () => {
        try {
          const workbook = readWorkbook(filePath);
          const sheetNames = workbook.SheetNames;
          if (!sheetNames.includes(targetFecha)) {
            throw new Error(`La fecha ${targetFecha} no existe en este curso.`);
          }
          if (sheetNames.indexOf(targetFecha) === 0) {
            throw new Error('No se puede borrar el Resumen General.');
          }

          delete workbook.Sheets[targetFecha];
          workbook.SheetNames = sheetNames.filter((s: string) => s !== targetFecha);

          const mainSheetName = workbook.SheetNames[0];
          const mainData = xlsx.utils.sheet_to_json(workbook.Sheets[mainSheetName]);
          consolidarPresentismo(workbook, mainData);
          workbook.Sheets[mainSheetName] = xlsx.utils.json_to_sheet(mainData);

          const writeErr = writeWorkbookSafely(workbook, filePath);
          if (writeErr) throw new Error(writeErr.error);

          const fechasRestantes = workbook.SheetNames.filter((s: string, i: number) => i > 0);
          console.log(`🗑️ Día de asistencia [${targetFecha}] eliminado del curso [${safeCurso}]. Quedan ${fechasRestantes.length} día(s).`);
          resolve({ success: true, fecha: targetFecha, fechasRestantes });
        } catch (err: any) {
          console.error('Error al borrar día de asistencia:', err);
          reject(new Error(err.message || 'Error al eliminar el día de asistencia del Excel.'));
        }
      }).catch(() => reject(new Error('Error interno al borrar el día de asistencia.')));
    });
  }

  static consultarAsistencia(curso: string, fecha?: string): ConsultaAsistenciaData {
    const filePath = getOrInitWorkingWorkbook(curso);
    if (!filePath || !existsSync(filePath)) {
      throw new Error(MENSAJES.ARCHIVO_NO_ENCONTRADO);
    }

    const workbook = readWorkbook(filePath);
    const sheetNames = workbook.SheetNames;
    const targetFecha = fecha ? normalizeSheetDate(fecha) : '';
    let sheetToRead = targetFecha;

    if (!sheetToRead || !sheetNames.includes(sheetToRead)) {
      const dateSheets = sheetNames.filter((s: string, idx: number) => idx > 0);
      if (dateSheets.length > 0) sheetToRead = dateSheets[dateSheets.length - 1];
      else sheetToRead = '';
    }

    if (!sheetToRead || !sheetNames.includes(sheetToRead)) {
      return {
        fecha: null,
        alumnos: [],
        totalPresentes: 0,
        totalTardes: 0,
        totalAusentes: 0,
        totalAlumnos: 0
      };
    }

    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetToRead]);
    let totalPresentes = 0, totalTardes = 0, totalAusentes = 0;

    const list = rows.map((r: any) => {
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

    return {
      fecha: sheetToRead,
      totalPresentes,
      totalTardes,
      totalAusentes,
      totalAlumnos: list.length,
      alumnos: list
    };
  }

  static obtenerEstadisticas(
    curso: string,
    campo: string,
    grupo: string,
    fecha: string
  ): EstadisticasData {
    const filePath = getOrInitWorkingWorkbook(curso);
    if (!filePath || !existsSync(filePath)) {
      return { availableFields: [], data: [], totalCount: 0, totalAlumnosSheet: 0, selectedField: campo, selectedGroup: grupo };
    }

    const workbook = readWorkbook(filePath);
    const sheetNames = workbook.SheetNames;
    const mainSheetName = sheetNames[0];
    const mainRows = xlsx.utils.sheet_to_json(workbook.Sheets[mainSheetName]);

    const mainAlumnosMap = new Map();
    mainRows.forEach((row: any) => {
      const dni = (row['DNI'] || row['ID'] || '').toString().trim();
      const name = obtenerNombreAlumno(row);
      const nameKey = name.trim().toLowerCase();
      if (dni) mainAlumnosMap.set(`dni:${dni}`, row);
      if (nameKey) mainAlumnosMap.set(`name:${nameKey}`, row);
    });

    let rowsToAnalyze: any[] = [];
    if (fecha && fecha !== 'TODOS' && sheetNames.includes(fecha)) {
      const dateRows = xlsx.utils.sheet_to_json(workbook.Sheets[fecha]);
      rowsToAnalyze = dateRows.map((dateRow: any) => {
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

    const fieldsMap = new Map<string, string>();
    fieldsMap.set('titulo', 'Título Profesional / Especialidad');
    fieldsMap.set('tecnologia', 'Relación con la Tecnología');
    fieldsMap.set('grupo', 'Grupo');
    fieldsMap.set('asistencia', 'Asistencia (Presente / Tarde / Ausente)');
    fieldsMap.set('dni', 'DNI / ID');
    fieldsMap.set('email', 'Email Privado');
    fieldsMap.set('telefono', 'Teléfono');
    if (stateManager.formConfig?.customFields) {
      stateManager.formConfig.customFields.forEach(f => {
        const keyId = (f.label || f.name || f.id || '').toString().toLowerCase().trim();
        if (keyId) fieldsMap.set(keyId, f.label || f.name || keyId);
      });
    }
    const availableFields = Array.from(fieldsMap.entries()).map(([id, label]) => ({ id, label }));

    const cleanFilterGroup = grupo.toUpperCase().replace(/^GRUPO\s*[-_]?\s*/, '').trim();
    const filteredRows = rowsToAnalyze.filter((row: any) => {
      if ((row['Borrado'] || 'NO') === 'SI') return false;
      if (cleanFilterGroup === 'TODOS' || !cleanFilterGroup) return true;
      const rowGrupo = (row['Grupo'] || row['grupo'] || '').toString().toUpperCase().replace(/^GRUPO\s*[-_]?\s*/, '').trim();
      return rowGrupo === cleanFilterGroup;
    });

    const dynamicCounts: Record<string, number> = {};
    let validAnswersCount = 0;
    const targetClean = campo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    filteredRows.forEach((row: any) => {
      let rawValue: any = null;
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
          const kClean = key.toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (kClean === targetClean || kClean.includes(targetClean) || targetClean.includes(kClean)) {
            rawValue = row[key];
            if (rawValue !== null && rawValue !== undefined && rawValue.toString().trim() !== '') break;
          }
        }
      }

      if (rawValue !== null && rawValue !== undefined && rawValue.toString().trim() !== '') {
        let valStr = rawValue.toString().trim();
        if (targetClean === 'titulo') valStr = valStr.toUpperCase().replace(/Á/g,'A').replace(/É/g,'E').replace(/Í/g,'I').replace(/Ó/g,'O').replace(/Ú/g,'U');
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

    return {
      availableFields,
      selectedField: campo,
      selectedGroup: grupo,
      totalAlumnosSheet: filteredRows.length,
      totalCount: validAnswersCount,
      data: sortedData
    };
  }

  static obtenerAusencias(curso: string, mes: string, grupo: string): AusenciasData {
    const filePath = getOrInitWorkingWorkbook(curso);
    if (!filePath || !existsSync(filePath)) {
      return { mesesDisponibles: [], alumnos: [], totalesGenerales: null };
    }

    const workbook = readWorkbook(filePath);
    const sheetNames = workbook.SheetNames;
    const mainSheetName = sheetNames[0];
    const mainRows = xlsx.utils.sheet_to_json(workbook.Sheets[mainSheetName]);

    function mesDeSheetName(sName: string): string {
      const parts = sName.toString().trim().split('-');
      if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) return `${parts[1]}-${parts[2]}`;
      return '';
    }

    const alumnosMap = new Map();
    mainRows.forEach((row: any) => {
      const name = obtenerNombreAlumno(row);
      const clean = name.trim().toLowerCase();
      if (!clean) return;
      if (!alumnosMap.has(clean)) {
        alumnosMap.set(clean, {
          nombreCompleto: name.trim(),
          dni: (row['DNI'] || row['ID'] || '').toString().trim(),
          grupo: (row['Grupo'] || row['grupo'] || '').toString().toUpperCase().replace(/^GRUPO\s*[-_]?\s*/, '').trim(),
          fotoUrl: findFotoForStudent(name.trim(), row['DNI']),
          porMes: {},
          totales: { presentes: 0, tardes: 0, ausentes: 0, totalClases: 0, pctPresentismo: 0, pctAusencia: 0 }
        });
      }
    });

    const mesesSet = new Set<string>();
    const clasesPorMes: Record<string, number> = {};
    sheetNames.forEach((sName: string, idx: number) => {
      if (idx === 0) return;
      const mesKey = mesDeSheetName(sName);
      if (!mesKey) return;
      if (mes && mes !== mesKey) return;
      mesesSet.add(mesKey);
      clasesPorMes[mesKey] = (clasesPorMes[mesKey] || 0) + 1;
      xlsx.utils.sheet_to_json(workbook.Sheets[sName]).forEach((r: any) => {
        const key = (r['Alumno'] || r['Nombre'] || '').toString().trim().toLowerCase();
        if (!key || !alumnosMap.has(key)) return;
        const st = (r['Asistencia'] || r['Estado'] || '').toString().trim().toUpperCase();
        const alumno = alumnosMap.get(key);
        if (!alumno.porMes[mesKey]) alumno.porMes[mesKey] = { presentes: 0, tardes: 0, ausentes: 0, total: 0, pctAusencia: 0 };
        const slot = alumno.porMes[mesKey];
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
    const cleanFilterGrupo = grupo.toUpperCase().replace(/^GRUPO\s*[-_]?\s*/, '').trim();
    const alumnosList = Array.from(alumnosMap.values())
      .filter(a => {
        if (a.totales.totalClases === 0) return false;
        if (cleanFilterGrupo !== 'TODOS' && a.grupo !== cleanFilterGrupo) return false;
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

    return {
      mesesDisponibles,
      alumnos: alumnosList,
      totalesGenerales: {
        presentes: totPres, tardes: totTar, ausentes: totAus, totalClases: totClases,
        pctPresentismo: totClases > 0 ? parseFloat(((totPres / totClases) * 100).toFixed(1)) : 0,
        pctAusencia: totClases > 0 ? parseFloat(((totAus / totClases) * 100).toFixed(1)) : 0
      }
    };
  }

  static getTardanzaConfig(curso: string): { cfg: any; horaTomaListaHoy: string; fecha: string } {
    const filePath = getOrInitWorkingWorkbook(curso);
    if (!filePath || !existsSync(filePath)) {
      throw new Error(MENSAJES.ARCHIVO_NO_ENCONTRADO);
    }
    const workbook = readWorkbook(filePath);
    const cfg = leerCfgTardanza(workbook);
    const fechaHoy = todaySheetName();
    const horaTomaListaHoy = leerHoraTomaLista(workbook, fechaHoy);
    return { cfg, horaTomaListaHoy, fecha: fechaHoy };
  }

  static async saveTardanzaConfig(curso: string, config: { modo: string; horaInicio: string; margenGracia: number; minDespues: number }): Promise<{ cfg: any }> {
    const filePath = getOrInitWorkingWorkbook(curso);
    if (!filePath || !existsSync(filePath)) {
      throw new Error(MENSAJES.ARCHIVO_NO_ENCONTRADO);
    }

    return new Promise((resolve, reject) => {
      withCourseLock(filePath, async () => {
        try {
          const workbook = readWorkbook(filePath);
          const nuevo = {
            modo: (config.modo === 'horario' || config.modo === 'desplist') ? config.modo : 'manual',
            horaInicio: (typeof config.horaInicio === 'string') ? config.horaInicio.trim() : '',
            margenGracia: parseInt(String(config.margenGracia), 10) || 0,
            minDespues: parseInt(String(config.minDespues), 10) || 30
          };
          guardarCfgTardanza(workbook, nuevo);
          const writeErr = writeWorkbookSafely(workbook, filePath);
          if (writeErr) throw new Error(writeErr.error);
          resolve({ cfg: nuevo });
        } catch (e: any) {
          console.error('Error guardando cfg de tardanza:', e);
          reject(new Error('Error al guardar la configuración de tardanza.'));
        }
      }).catch(() => reject(new Error('Error interno al guardar la configuración.')));
    });
  }

  static tomarLista(curso: string, fecha?: string): { success: boolean; fecha: string; hora: string } {
    const filePath = getOrInitWorkingWorkbook(curso);
    if (!filePath || !existsSync(filePath)) {
      throw new Error(MENSAJES.ARCHIVO_NO_ENCONTRADO);
    }

    const targetFecha = normalizeSheetDate(fecha || todaySheetName());
    const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    const workbook = readWorkbook(filePath);
    guardarHoraTomaLista(workbook, targetFecha, hora);
    const writeErr = writeWorkbookSafely(workbook, filePath);
    if (writeErr) throw new Error(writeErr.error);

    return { success: true, fecha: targetFecha, hora };
  }

  // Registro de alumno (auto-presente)
  static async registrarAutoPresente(
    curso: string,
    token: string,
    fotoData?: string
  ): Promise<any> {
    const filePath = getOrInitWorkingWorkbook(curso);
    if (!filePath || !existsSync(filePath)) {
      throw new Error(MENSAJES.ARCHIVO_NO_ENCONTRADO);
    }

    return new Promise((resolve, reject) => {
      withCourseLock(filePath, async () => {
        try {
          const workbook = readWorkbook(filePath);
          const sheetName = workbook.SheetNames[0];
          const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
          // Lógica simplificada - la implementación completa está en RegistrationService
          resolve({ success: true });
        } catch (error: any) {
          reject(error);
        }
      }).catch(() => reject(new Error('Error interno')));
    });
  }

  static obtenerFechasDisponibles(curso?: string): Array<{ id: string; label: string }> {
    return CourseService.obtenerFechasDisponibles(curso);
  }
}