import { PATHS } from '../config/index.js';
import { xlsx, readWorkbook, getOrInitWorkingWorkbook, obtenerNombreAlumno, withCourseLock, writeWorkbookSafely, consolidarPresentismo, reconciliarAusentes, findFotoForStudent, saveStudentFoto, deleteStudentFoto, todaySheetName } from '../data/xlsx.js';
import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { stateManager } from '../core/StateManager.js';
import { MENSAJES } from '../config/constants.js';
import { CourseService } from './CourseService.js';
import { isFullyRegistered } from '../utils/validation.js';

export interface AlumnoCompleto {
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
  datos?: {
    email: string;
    dni: string;
    titulo: string;
    tecnologia: string;
    grupo: string;
    telefono: string;
    fecha: string;
    [key: string]: string;
  };
}

export interface AlumnoRegistro {
  nombre: string;
  apellido: string;
  dni?: string;
  grupo?: string;
  titulo?: string;
  tecnologia?: string;
  email?: string;
  telefono?: string;
  fotoData?: string;
  customValues?: Record<string, string>;
}

export class StudentService {
  static obtenerAlumnos(curso?: string, full = false, incluirBorrados = false): AlumnoCompleto[] {
    const cursoActivo = curso || CourseService.getActiveCourse();
    if (!cursoActivo) return [];
    const filePath = getOrInitWorkingWorkbook(cursoActivo);
    if (!filePath || !existsSync(filePath)) return [];

    try {
      const workbook = readWorkbook(filePath);
      const sheetName = workbook.SheetNames[0];
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

      const estadoHoy = new Map<string, string>();
      const hoySheet = todaySheetName();
      if (workbook.SheetNames.includes(hoySheet)) {
        xlsx.utils.sheet_to_json(workbook.Sheets[hoySheet]).forEach((r: any) => {
          const st = (r['Asistencia'] || r['Estado'] || '').toString().trim().toUpperCase();
          const n = (r['Alumno'] || r['Nombre'] || '').toString().trim().toLowerCase();
          if (n) estadoHoy.set(n, st);
        });
      }

      const rawAlumnos = data.map((row: any, index: number) => {
        const name = obtenerNombreAlumno(row);
        const status = isFullyRegistered(row);
        const estadoHoyAlumno = estadoHoy.get(name.trim().toLowerCase()) || '';
        const pres = parseInt(String(row['Presentes'] || 0), 10) || 0;
        const aus = parseInt(String(row['Ausentes'] || 0), 10) || 0;
        const tar = parseInt(String(row['Tardes'] || 0), 10) || 0;
        const tot = parseInt(String(row['Total Clases'] || 0), 10) || 0;
        const pctRaw = parseFloat(String(row['% Presentismo'] || 0));
        const pct = isNaN(pctRaw) && tot > 0 ? parseFloat(((pres / tot) * 100).toFixed(1)) : (pctRaw || 0);

        const result: AlumnoCompleto = {
          id: index,
          nombreCompleto: name.trim(),
          completado: status,
          borrado: (row['Borrado'] || 'NO') === 'SI',
          presenteHoy: estadoHoyAlumno.includes('PRESENTE'),
          tardeHoy: estadoHoyAlumno === 'TARDE',
          llegadaTardiaHoy: estadoHoyAlumno === 'PRESENTE TARDÍO',
          presentes: pres,
          ausentes: aus,
          tardes: tar,
          totalClases: tot,
          porcentajePresentismo: pct,
          fotoUrl: findFotoForStudent(name.trim(), String(row['DNI'] || ''))
        };

        if (full && status) {
          result.datos = {
            email: String(row['Email Privado'] || ''),
            dni: String(row['DNI'] || ''),
            titulo: String(row['Título'] || row['Titulo'] || ''),
            tecnologia: String(row['Tecnología'] || row['Tecnologia'] || ''),
            grupo: String(row['Grupo'] || ''),
            telefono: String(row['Teléfono'] || ''),
            fecha: String(row['Fecha Registro'] || '')
          };
          stateManager.formConfig?.customFields?.forEach(field => {
            const keyName = field.label || field.name;
            if (keyName && row[keyName] !== undefined) result.datos![keyName] = String(row[keyName]);
          });
        }
        return result;
      });

      const seen = new Set<string>();
      return rawAlumnos.filter(a => {
        if (!a.nombreCompleto || a.nombreCompleto.toLowerCase() === 'nombre' || a.nombreCompleto.toLowerCase() === 'full name') return false;
        if (seen.has(a.nombreCompleto)) return false;
        seen.add(a.nombreCompleto);
        if (a.borrado && !incluirBorrados) return false;
        return true;
      });
    } catch (error) {
      console.error('Error al procesar el archivo Excel:', error);
      return [];
    }
  }

  static async agregarAlumno(
    curso: string,
    datos: AlumnoRegistro,
    presente = false,
    fecha?: string
  ): Promise<{ success: boolean; nombreCompleto: string; presente: boolean; fecha: string }> {
    const safeCurso = basename(curso);
    const filePath = getOrInitWorkingWorkbook(curso);
    if (!filePath || !existsSync(filePath)) {
      throw new Error(MENSAJES.ARCHIVO_NO_ENCONTRADO);
    }

    return new Promise((resolve, reject) => {
      withCourseLock(filePath, async () => {
        try {
          const workbook = readWorkbook(filePath);
          const sheetNames = workbook.SheetNames;
          const mainSheetName = sheetNames[0];
          const mainData = xlsx.utils.sheet_to_json(workbook.Sheets[mainSheetName]) as Array<Record<string, unknown>>;

          const nomClean = (datos.nombre || '').toString().trim().slice(0, 100);
          const apeClean = (datos.apellido || '').toString().trim().slice(0, 100);
          const nombreCompleto = `${nomClean} ${apeClean}`.trim();

          if (!nomClean && !apeClean) {
            throw new Error('Debes proporcionar al menos el nombre o apellido del alumno.');
          }

          const existe = mainData.some((row: Record<string, unknown>) => obtenerNombreAlumno(row).toLowerCase() === nombreCompleto.toLowerCase());
          const hoy = new Date();

          if (!existe) {
            const nuevaFila: Record<string, any> = {
              'Last name': apeClean,
              'First name': nomClean,
              'Email address': datos.email || '',
              'Email Privado': datos.email || '',
              'DNI': datos.dni || '',
              'Grupo': (datos.grupo || 'SIN GRUPO').toString().toUpperCase().trim()
            };
            if (datos.titulo) nuevaFila['Título'] = datos.titulo.toString().toUpperCase().trim();
            if (datos.tecnologia) nuevaFila['Tecnología'] = datos.tecnologia.toString().toUpperCase().trim();
            mainData.push(nuevaFila);
            console.log(`➕ Alumno agregado a la lista de [${safeCurso}]: ${nombreCompleto}${presente ? ' (marcado presente manualmente)' : ' (pendiente de completar sus datos)'}`);
          }

          const esPresente = presente === true;
          const horaActual = hoy.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
          const defaultFecha = `${hoy.getDate().toString().padStart(2, '0')}-${(hoy.getMonth() + 1).toString().padStart(2, '0')}-${hoy.getFullYear()}`;
          const targetFecha = (fecha || defaultFecha).toString().trim().replace(/[/\\]/g, '-');

          if (esPresente && targetFecha) {
            const dateSheetName = targetFecha;
            let dateData = xlsx.utils.sheet_to_json(workbook.Sheets[dateSheetName]) as Array<Record<string, unknown>>;
            if (sheetNames.includes(dateSheetName)) {
              dateData = xlsx.utils.sheet_to_json(workbook.Sheets[dateSheetName]) as Array<Record<string, unknown>>;
            }
            const idxInDate = dateData.findIndex((r: Record<string, unknown>) => (r['Alumno'] || '').toString().trim().toLowerCase() === nombreCompleto.toLowerCase());
            const filaFechaObj = {
              'DNI': datos.dni || 'SIN DNI',
              'Alumno': nombreCompleto,
              'Asistencia': 'PRESENTES',
              'Grupo': (datos.grupo || 'SIN GRUPO').toString().toUpperCase().trim(),
              'Hora Registro': horaActual
            };
            if (idxInDate >= 0) dateData[idxInDate] = filaFechaObj;
            else dateData.push(filaFechaObj);
            const dateSheet = xlsx.utils.json_to_sheet(dateData);
            if (sheetNames.includes(dateSheetName)) workbook.Sheets[dateSheetName] = dateSheet;
            else xlsx.utils.book_append_sheet(workbook, dateSheet, dateSheetName);
          }

          reconciliarAusentes(workbook, mainData, true);
          consolidarPresentismo(workbook, mainData);
          workbook.Sheets[mainSheetName] = xlsx.utils.json_to_sheet(mainData);

          const writeErr = writeWorkbookSafely(workbook, filePath);
          if (writeErr) throw new Error(writeErr.error);

          if (datos.fotoData) {
            saveStudentFoto(nombreCompleto, datos.dni || '', datos.fotoData);
          }

          resolve({ success: true, nombreCompleto, presente: esPresente, fecha: targetFecha });
        } catch (err: any) {
          console.error('Error al agregar alumno manualmente:', err);
          reject(new Error('Error interno al agregar el alumno en la planilla Excel: ' + (err.message || '')));
        }
      }).catch(() => reject(new Error('Error interno al agregar el alumno.')));
    });
  }

  static async borrarAlumno(curso: string, nombreAlumno: string, definitivo = false): Promise<{ success: boolean; nombreAlumno: string; definitivo?: boolean; borrado?: boolean }> {
    const safeCurso = basename(curso);
    const filePath = getOrInitWorkingWorkbook(curso);
    if (!filePath || !existsSync(filePath)) {
      throw new Error(MENSAJES.ARCHIVO_NO_ENCONTRADO);
    }

    return new Promise((resolve, reject) => {
      withCourseLock(filePath, async () => {
        try {
          const workbook = readWorkbook(filePath);
          const targetClean = nombreAlumno.toString().trim().toLowerCase();
          const mainSheetName = workbook.SheetNames[0];
          const mainData = xlsx.utils.sheet_to_json(workbook.Sheets[mainSheetName]) as Array<Record<string, unknown>>;

          if (definitivo === true) {
            const removedDni: string[] = [];
            const newMainData = mainData.filter((row: Record<string, unknown>) => {
              const coincide = obtenerNombreAlumno(row).toLowerCase() === targetClean;
              if (coincide) removedDni.push(String(row['DNI'] || '').trim());
              return !coincide;
            });
            workbook.Sheets[mainSheetName] = xlsx.utils.json_to_sheet(newMainData);
            workbook.SheetNames.forEach((sName: string, idx: number) => {
              if (idx === 0) return;
              const sData = xlsx.utils.sheet_to_json(workbook.Sheets[sName]) as Array<Record<string, unknown>>;
              const newSData = sData.filter((r: Record<string, unknown>) => (r['Alumno'] || r['Nombre'] || '').toString().trim().toLowerCase() !== targetClean);
              workbook.Sheets[sName] = xlsx.utils.json_to_sheet(newSData);
            });
            deleteStudentFoto(nombreAlumno, removedDni[0] || '');
            consolidarPresentismo(workbook, newMainData);
            workbook.Sheets[mainSheetName] = xlsx.utils.json_to_sheet(newMainData);
            const writeErr = writeWorkbookSafely(workbook, filePath);
            if (writeErr) throw new Error(writeErr.error);
            console.log(`🗑️ Alumno [${nombreAlumno}] eliminado DEFINITIVAMENTE de [${safeCurso}]`);
            return resolve({ success: true, nombreAlumno, definitivo: true });
          }

          let marcado = false;
          mainData.forEach((row: Record<string, unknown>) => {
            if (obtenerNombreAlumno(row).toLowerCase() === targetClean) {
              row['Borrado'] = 'SI';
              marcado = true;
            }
          });
          if (!marcado) throw new Error(MENSAJES.ALUMNO_NO_ENCONTRADO);
          consolidarPresentismo(workbook, mainData);
          workbook.Sheets[mainSheetName] = xlsx.utils.json_to_sheet(mainData);
          const writeErr = writeWorkbookSafely(workbook, filePath);
          if (writeErr) throw new Error(writeErr.error);
          console.log(`🚫 Alumno [${nombreAlumno}] marcado como BORRADO (lógico) en [${safeCurso}] - historial conservado`);
          resolve({ success: true, nombreAlumno, borrado: true });
        } catch (err: any) {
          console.error('Error al borrar alumno:', err);
          reject(new Error('Error al borrar el alumno del archivo Excel.'));
        }
      }).catch(() => reject(new Error('Error interno al borrar el alumno.')));
    });
  }

  static async restaurarAlumno(curso: string, nombreAlumno: string): Promise<{ success: boolean; nombreAlumno: string }> {
    const safeCurso = basename(curso);
    const filePath = getOrInitWorkingWorkbook(curso);
    if (!filePath || !existsSync(filePath)) {
      throw new Error(MENSAJES.ARCHIVO_NO_ENCONTRADO);
    }

    return new Promise((resolve, reject) => {
      withCourseLock(filePath, async () => {
        try {
          const workbook = readWorkbook(filePath);
          const targetClean = nombreAlumno.toString().trim().toLowerCase();
          const mainSheetName = workbook.SheetNames[0];
          const mainData = xlsx.utils.sheet_to_json(workbook.Sheets[mainSheetName]) as Array<Record<string, unknown>>;
          let restaurado = false;
          mainData.forEach((row: Record<string, unknown>) => {
            if (obtenerNombreAlumno(row).toLowerCase() === targetClean) {
              row['Borrado'] = 'NO';
              restaurado = true;
            }
          });
          if (!restaurado) throw new Error(MENSAJES.ALUMNO_NO_ENCONTRADO);
          consolidarPresentismo(workbook, mainData);
          workbook.Sheets[mainSheetName] = xlsx.utils.json_to_sheet(mainData);
          const writeErr = writeWorkbookSafely(workbook, filePath);
          if (writeErr) throw new Error(writeErr.error);
          console.log(`♻️ Alumno [${nombreAlumno}] restaurado en [${safeCurso}]`);
          resolve({ success: true, nombreAlumno });
        } catch (err: any) {
          console.error('Error al restaurar alumno:', err);
          reject(new Error('Error al restaurar el alumno.'));
        }
      }).catch(() => reject(new Error('Error interno al restaurar el alumno.')));
    });
  }

  static async modificarAlumno(
    curso: string,
    nombreOriginal: string,
    cambios: Partial<AlumnoRegistro>
  ): Promise<{ success: boolean; nombreOriginal: string; nuevoNombreCompleto: string }> {
    const safeCurso = basename(curso);
    const filePath = getOrInitWorkingWorkbook(curso);
    if (!filePath || !existsSync(filePath)) {
      throw new Error(MENSAJES.ARCHIVO_NO_ENCONTRADO);
    }

    return new Promise((resolve, reject) => {
      withCourseLock(filePath, async () => {
        try {
          const workbook = readWorkbook(filePath);
          const targetClean = nombreOriginal.toString().trim().toLowerCase();
          const nomClean = (cambios.nombre || '').toString().trim().slice(0, 100);
          const apeClean = (cambios.apellido || '').toString().trim().slice(0, 100);
          const nuevoNombreCompleto = (nomClean || apeClean) ? `${nomClean} ${apeClean}`.trim() : nombreOriginal;

          const mainSheetName = workbook.SheetNames[0];
          const mainData = xlsx.utils.sheet_to_json(workbook.Sheets[mainSheetName]) as Array<Record<string, unknown>>;
          let modificado = false;

          mainData.forEach((row: Record<string, unknown>) => {
            const n = obtenerNombreAlumno(row);
            if (n.toLowerCase() === targetClean) {
              if (nomClean) row['First name'] = nomClean;
              if (apeClean) row['Last name'] = apeClean;
              if (row['Full Name'] !== undefined) row['Full Name'] = nuevoNombreCompleto;
              if (row['Full name'] !== undefined) row['Full name'] = nuevoNombreCompleto;
              if (row['Alumno'] !== undefined) row['Alumno'] = nuevoNombreCompleto;
              if (row['Nombre y Apellido'] !== undefined) row['Nombre y Apellido'] = nuevoNombreCompleto;
              if (cambios.dni !== undefined) row['DNI'] = cambios.dni;
              if (cambios.grupo !== undefined) row['Grupo'] = cambios.grupo.toString().toUpperCase().trim();
              if (cambios.titulo !== undefined) row['Título'] = cambios.titulo;
              if (cambios.email !== undefined) {
                row['Email Privado'] = cambios.email;
                row['Email address'] = cambios.email;
              }
              modificado = true;
            }
          });

          workbook.Sheets[mainSheetName] = xlsx.utils.json_to_sheet(mainData);

          workbook.SheetNames.forEach((sName: string, idx: number) => {
            if (idx === 0) return;
            const sData = xlsx.utils.sheet_to_json(workbook.Sheets[sName]) as Array<Record<string, unknown>>;
            sData.forEach((r: Record<string, unknown>) => {
              const nomItem = (r['Alumno'] || r['Nombre'] || '').toString().trim().toLowerCase();
              if (nomItem === targetClean) {
                r['Alumno'] = nuevoNombreCompleto;
                if (cambios.dni !== undefined) r['DNI'] = cambios.dni;
                if (cambios.grupo !== undefined) r['Grupo'] = cambios.grupo.toString().toUpperCase().trim();
              }
            });
            workbook.Sheets[sName] = xlsx.utils.json_to_sheet(sData);
          });

          const writeErr = writeWorkbookSafely(workbook, filePath);
          if (writeErr) throw new Error(writeErr.error);
          console.log(`✏️ Alumno [${nombreOriginal}] actualizado exitosamente a [${nuevoNombreCompleto}] en [${safeCurso}]`);
          resolve({ success: true, nombreOriginal, nuevoNombreCompleto });
        } catch (err: any) {
          console.error('Error al modificar alumno:', err);
          reject(new Error('Error interno al actualizar datos del alumno en Excel.'));
        }
      }).catch(() => reject(new Error('Error interno al modificar al alumno.')));
    });
  }

  static async actualizarGrupoAlumno(curso: string, nombreAlumno: string, nuevoGrupo: string): Promise<{ success: boolean; grupo: string }> {
    const safeCurso = basename(curso);
    const filePath = getOrInitWorkingWorkbook(curso);
    if (!filePath || !existsSync(filePath)) {
      throw new Error(MENSAJES.ARCHIVO_NO_ENCONTRADO);
    }

    const targetGrupo = (nuevoGrupo || '').toString().trim().toUpperCase().replace(/\s/g, '');

    return new Promise((resolve, reject) => {
      withCourseLock(filePath, async () => {
        try {
          const workbook = readWorkbook(filePath);
          const sheetName = workbook.SheetNames[0];
          const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]) as Array<Record<string, unknown>>;
          let updated = false;
          data.forEach((row: Record<string, unknown>) => {
            if (obtenerNombreAlumno(row).trim().toLowerCase() === nombreAlumno.trim().toLowerCase()) {
              row['Grupo'] = targetGrupo;
              updated = true;
            }
          });
          if (!updated) throw new Error(MENSAJES.ALUMNO_NO_ENCONTRADO);
          workbook.Sheets[sheetName] = xlsx.utils.json_to_sheet(data);
          const writeErr = writeWorkbookSafely(workbook, filePath);
          if (writeErr) throw new Error(writeErr.error);
          console.log(`✏️ Docente actualizó el grupo de [${nombreAlumno}] a [${targetGrupo}] en [${safeCurso}]`);
          resolve({ success: true, grupo: targetGrupo });
        } catch (error: any) {
          console.error('Error al actualizar grupo del alumno:', error);
          reject(new Error('Error al actualizar el Excel.'));
        }
      }).catch(() => reject(new Error('Error interno al actualizar el grupo.')));
    });
  }

  static async reconciliarAusentes(curso: string): Promise<{ success: boolean }> {
    const filePath = getOrInitWorkingWorkbook(curso);
    if (!filePath || !existsSync(filePath)) {
      throw new Error(MENSAJES.ARCHIVO_NO_ENCONTRADO);
    }

    return new Promise((resolve, reject) => {
      withCourseLock(filePath, async () => {
        try {
          const workbook = readWorkbook(filePath);
          const mainSheetName = workbook.SheetNames[0];
          const mainData = xlsx.utils.sheet_to_json(workbook.Sheets[mainSheetName]) as Array<Record<string, unknown>>;
          reconciliarAusentes(workbook, mainData, true);
          consolidarPresentismo(workbook, mainData);
          workbook.Sheets[mainSheetName] = xlsx.utils.json_to_sheet(mainData);
          const writeErr = writeWorkbookSafely(workbook, filePath);
          if (writeErr) throw new Error(writeErr.error);
          console.log(`🔄 Ausentes faltantes reconciliados en [${basename(curso)}] (desde hoy)`);
          resolve({ success: true });
        } catch (err: any) {
          console.error('Error al reconciliar ausentes:', err);
          reject(new Error('Error al reconciliar ausentes.'));
        }
      }).catch(() => reject(new Error('Error interno al reconciliar ausentes.')));
    });
  }

  static async borrarFotoAlumno(nombreCompleto: string, dni: string): Promise<{ success: boolean; deleted: boolean }> {
    const deleted = deleteStudentFoto(nombreCompleto, dni);
    return { success: true, deleted };
  }
}