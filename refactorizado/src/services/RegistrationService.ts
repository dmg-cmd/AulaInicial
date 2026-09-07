import { PATHS } from '../config/index.js';
import { xlsx, readWorkbook, getOrInitWorkingWorkbook, obtenerNombreAlumno, withCourseLock, writeWorkbookSafely, consolidarPresentismo, findFotoForStudent, saveStudentFoto, deleteStudentFoto, horaAminutos } from '../data/xlsx.js';
import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { stateManager } from '../core/StateManager.js';
import { MENSAJES, RATE_LIMIT, ASISTENCIA_ESTADOS } from '../config/constants.js';
import { CourseService } from './CourseService.js';
import { generateStudentToken, verifyStudentToken } from '../core/tokens.js';
import { validateFotoBase64, normalizeClientIP, rateLimitExceeded, isFullyRegistered, todaySheetName, evaluarTarde, leerCfgTardanza, leerHoraTomaLista, dentroDeHoraLimite } from '../utils/validation.js';

export interface RegistroData {
  alumnoId: number;
  email: string;
  titulo: string;
  telefono: string;
  dni: string;
  tecnologia: string;
  grupo: string;
  fotoData?: string;
  customValues?: Record<string, string>;
}

export interface AutoPresenteResult {
  success: boolean;
  autoPresente: boolean;
  autoPresenteAplicado: boolean;
  estadoHoy: string;
  esTardioAuto: boolean;
  puedeRemarcarTardio: boolean;
  permitePresenteTardio: boolean;
  horaLimite: string;
  nombreAlumno: string;
  alumnoId: number;
  fechaRegistro: string;
  token: string;
  fotoUrl: string | null;
  requiereFoto: boolean;
}

export interface PerfilData {
  success: boolean;
  nombreAlumno: string;
  alumnoId: number;
  datos: {
    email: string;
    dni: string;
    titulo: string;
    tecnologia: string;
    grupo: string;
    telefono: string;
    fecha: string;
  };
  customValues: Record<string, string>;
  fotoUrl: string | null;
}

export class RegistrationService {
  private static obtenerFilaPorToken(data: any[], verified: { studentName: string; studentId: number | null }): { index: number; row: any } {
    if (verified.studentId !== null && Number.isInteger(verified.studentId) && data[verified.studentId]) {
      const candidate = data[verified.studentId];
      if (obtenerNombreAlumno(candidate).toLowerCase() === verified.studentName) {
        return { index: verified.studentId, row: candidate };
      }
    }
    const index = data.findIndex(row => obtenerNombreAlumno(row).toLowerCase() === verified.studentName);
    if (index !== -1) return { index, row: data[index] };
    return { index: -1, row: null };
  }

  static async registrarAlumno(
    curso: string,
    datos: RegistroData,
    clientIP: string
  ): Promise<{ success: boolean; token: string; fotoUrl: string | null }> {
    const safeCurso = basename(curso);
    const filePath = getOrInitWorkingWorkbook(curso);
    if (!filePath || !existsSync(filePath)) {
      throw new Error(MENSAJES.ARCHIVO_NO_ENCONTRADO);
    }

    if (rateLimitExceeded(clientIP, 'registro')) {
      throw new Error(MENSAJES.RATE_LIMIT_EXCEEDIDO);
    }

    return new Promise((resolve, reject) => {
      withCourseLock(filePath, async () => {
        try {
          const workbook = readWorkbook(filePath);
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const data = xlsx.utils.sheet_to_json(sheet) as Array<Record<string, unknown>>;

          if (data[datos.alumnoId] === undefined || typeof data[datos.alumnoId] !== 'object') {
            throw new Error('Alumno no encontrado en el índice del curso.');
          }
          const alumno = data[datos.alumnoId] as Record<string, unknown>;

          if (stateManager.hasRegisteredIP(clientIP) && isFullyRegistered(alumno)) {
            throw new Error('Este dispositivo ya ha realizado un registro en esta sesión.');
          }

          if (stateManager.formConfig?.standardFields?.email?.enabled !== false) alumno['Email Privado'] = datos.email || '';
          if (stateManager.formConfig?.standardFields?.titulo?.enabled !== false) alumno['Título'] = datos.titulo || '';
          if (stateManager.formConfig?.standardFields?.tecnologia?.enabled !== false) alumno['Tecnología'] = datos.tecnologia || 'NO ESPECIFICADO';
          if (stateManager.formConfig?.standardFields?.telefono?.enabled !== false) alumno['Teléfono'] = datos.telefono || '';
          if (stateManager.formConfig?.standardFields?.dni?.enabled !== false) alumno['DNI'] = datos.dni || '';
          if (stateManager.formConfig?.standardFields?.grupo?.enabled !== false) alumno['Grupo'] = datos.grupo || '';
          alumno['Fecha Registro'] = new Date().toLocaleString('es-AR');

          if (datos.customValues && stateManager.formConfig?.customFields) {
            stateManager.formConfig.customFields.forEach(field => {
              if (field.enabled !== false && datos.customValues![field.id] !== undefined) {
                const keyName = field.label || field.name;
                if (keyName) alumno[keyName] = datos.customValues![field.id];
              }
            });
          }

          const alumnoName = obtenerNombreAlumno(alumno);
          if (datos.fotoData) saveStudentFoto(alumnoName, datos.dni || String(alumno['DNI'] || ''), datos.fotoData);
          console.log(`✅ Registro actualizado: ${alumnoName} en [${safeCurso}]`);

          const hoy = new Date();
          const dateSheetName = todaySheetName();
          const horaActual = hoy.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

          let dateData: any[] = [];
          if (workbook.SheetNames.includes(dateSheetName)) {
            dateData = xlsx.utils.sheet_to_json(workbook.Sheets[dateSheetName]);
          }
          const idxInDate = dateData.findIndex(r => (r['Alumno'] || r['Nombre'] || '').toString().trim().toLowerCase() === alumnoName.toLowerCase());
          const filaFechaObj = {
            'DNI': datos.dni || alumno['DNI'] || 'SIN DNI',
            'Alumno': alumnoName,
            'Asistencia': 'PRESENTES',
            'Grupo': (alumno['Grupo'] || datos.grupo || 'SIN GRUPO').toString().toUpperCase().trim(),
            'Hora Registro': horaActual
          };
          if (idxInDate >= 0) dateData[idxInDate] = filaFechaObj;
          else dateData.push(filaFechaObj);
          const dateSheet = xlsx.utils.json_to_sheet(dateData);
          if (workbook.SheetNames.includes(dateSheetName)) workbook.Sheets[dateSheetName] = dateSheet;
          else xlsx.utils.book_append_sheet(workbook, dateSheet, dateSheetName);

          consolidarPresentismo(workbook, data);
          workbook.Sheets[sheetName] = xlsx.utils.json_to_sheet(data);

          const writeErr = writeWorkbookSafely(workbook, filePath);
          if (writeErr) throw new Error(writeErr.error);

          stateManager.addRegisteredIP(clientIP);
          const token = generateStudentToken(alumnoName, datos.alumnoId);
          const fotoUrl = findFotoForStudent(alumnoName, datos.dni || String(alumno['DNI'] || ''));
          resolve({ success: true, token, fotoUrl });
        } catch (error: any) {
          console.error('Error al guardar en Excel:', error);
          reject(new Error('Error interno al guardar los datos en el Excel.'));
        }
      }).catch(() => reject(new Error('Error interno al procesar el registro.')));
    });
  }

  static async autoPresente(
    curso: string,
    token: string,
    clientIP: string,
    fotoData?: string
  ): Promise<AutoPresenteResult> {
    const filePath = getOrInitWorkingWorkbook(curso);
    if (!filePath || !existsSync(filePath)) {
      throw new Error(MENSAJES.ARCHIVO_NO_ENCONTRADO);
    }

    const verified = verifyStudentToken(token);
    if (!verified) throw new Error(MENSAJES.TOKEN_INVALIDO);

    if (rateLimitExceeded(clientIP, 'auto-presente')) {
      throw new Error(MENSAJES.RATE_LIMIT_EXCEEDIDO);
    }

    return new Promise((resolve, reject) => {
      withCourseLock(filePath, async () => {
        try {
          const workbook = readWorkbook(filePath);
          const sheetName = workbook.SheetNames[0];
          const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]) as Array<Record<string, unknown>>;

          let targetIndex = -1;
          let alumnoRow: Record<string, unknown> | null = null;
          if (verified.studentId !== null && Number.isInteger(verified.studentId) && data[verified.studentId] !== undefined) {
            const candidate = data[verified.studentId];
            if (obtenerNombreAlumno(candidate).toLowerCase() === verified.studentName) {
              targetIndex = verified.studentId;
              alumnoRow = candidate;
            }
          }
          if (!alumnoRow) {
            targetIndex = data.findIndex(row => obtenerNombreAlumno(row).toLowerCase() === verified.studentName);
            if (targetIndex !== -1) alumnoRow = data[targetIndex];
          }
          if (!alumnoRow) throw new Error(MENSAJES.ALUMNO_NO_ENCONTRADO);

          const displayName = obtenerNombreAlumno(alumnoRow);
          const studentDni = String(alumnoRow['DNI'] || '');
          const hoy = new Date();

          if (!isFullyRegistered(alumnoRow)) {
            console.log(`🆕 Alumno [${displayName}] sin datos completados: se omite auto-presente (debe registrarse de nuevo).`);
            return resolve({ success: false, invalidToken: true, necesitaRegistro: true } as any);
          }

          const dateSheetName = todaySheetName();
          const horaActual = hoy.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
          let dateData = xlsx.utils.sheet_to_json(workbook.Sheets[dateSheetName]) as Array<Record<string, unknown>>;
          const cfgTardanzaAP = leerCfgTardanza(workbook);
          const horaTomaListaAP = leerHoraTomaLista(workbook, dateSheetName);
          const ahoraMinAP = hoy.getHours() * 60 + hoy.getMinutes();
          const tardeAutoAP = evaluarTarde(cfgTardanzaAP, ahoraMinAP, horaAminutos(horaTomaListaAP));
          if (workbook.SheetNames.includes(dateSheetName)) {
            dateData = xlsx.utils.sheet_to_json(workbook.Sheets[dateSheetName]) as Array<Record<string, unknown>>;
          }
          const idxInDate = dateData.findIndex(r => (r['Alumno'] || r['Nombre'] || '').toString().trim().toLowerCase() === displayName.toLowerCase());
          const estadoPrevio = idxInDate >= 0
            ? (String(dateData[idxInDate]['Asistencia'] || dateData[idxInDate]['Estado'] || '')).trim().toUpperCase()
            : '';
          const esTardioAuto = estadoPrevio === 'PRESENTE TARDÍO';
          const estadoDocente = (!esTardioAuto && (estadoPrevio.includes('TARDE') || estadoPrevio.includes('AUSENTE'))) ? estadoPrevio : '';

          if (idxInDate >= 0 && (estadoDocente || esTardioAuto)) {
            if (esTardioAuto) {
              dateData[idxInDate]['Hora Registro'] = horaActual;
              workbook.Sheets[dateSheetName] = xlsx.utils.json_to_sheet(dateData);
            }
            if (estadoDocente) {
              console.log(`🚫 Auto-presente respetado: ${displayName} quedó ${estadoDocente} por decisión del docente, NO se remarca.`);
            }
          } else {
            const filaFechaObj = {
              'DNI': studentDni || 'SIN DNI',
              'Alumno': displayName,
              'Asistencia': tardeAutoAP ? 'PRESENTE TARDÍO' : 'PRESENTES',
              'Grupo': (alumnoRow['Grupo'] || 'SIN GRUPO').toString().toUpperCase().trim(),
              'Hora Registro': horaActual
            };
            if (idxInDate >= 0) dateData[idxInDate] = filaFechaObj;
            else dateData.push(filaFechaObj);
            const dateSheet = xlsx.utils.json_to_sheet(dateData);
            if (workbook.SheetNames.includes(dateSheetName)) workbook.Sheets[dateSheetName] = dateSheet;
            else xlsx.utils.book_append_sheet(workbook, dateSheet, dateSheetName);
          }

          consolidarPresentismo(workbook, data);
          workbook.Sheets[sheetName] = xlsx.utils.json_to_sheet(data);

          const writeErr = writeWorkbookSafely(workbook, filePath);
          if (writeErr) throw new Error(writeErr.error);

          if (fotoData) saveStudentFoto(displayName, studentDni, fotoData);

          const fotoConfig = stateManager.formConfig?.standardFields?.foto;
          const fotoHabilitada = !fotoConfig || fotoConfig.enabled !== false;
          const fotoUrl = findFotoForStudent(displayName, studentDni);
          const requiereFoto = fotoHabilitada && !fotoUrl;
          const newToken = generateStudentToken(displayName, targetIndex);
          const configAsist = stateManager.formConfig?.asistencia ?? { permitirPresenteTardio: true, horaLimite: '' };
          const permiteTardio = configAsist.permitirPresenteTardio !== false;
          const horaLimite = typeof configAsist.horaLimite === 'string' ? configAsist.horaLimite.trim() : '';
          const puedeRemarcarTardio = !!(estadoDocente && permiteTardio && dentroDeHoraLimite(horaLimite));

          console.log(`🟢 Auto-presente registrado para: ${displayName} en [${basename(curso)}] ${requiereFoto ? '(Pide foto de rostro)' : ''}`);
          resolve({
            success: true, autoPresente: true,
            autoPresenteAplicado: !estadoDocente && !esTardioAuto,
            estadoHoy: estadoDocente || (esTardioAuto ? 'PRESENTE TARDÍO' : (tardeAutoAP ? 'PRESENTE TARDÍO' : 'PRESENTES')),
            esTardioAuto: !!esTardioAuto, puedeRemarcarTardio, permitePresenteTardio: permiteTardio,
            horaLimite, nombreAlumno: displayName, alumnoId: targetIndex,
            fechaRegistro: String(alumnoRow['Fecha Registro'] || ''), token: newToken, fotoUrl, requiereFoto
          });
        } catch (error: any) {
          console.error('Error al registrar auto-presente:', error);
          reject(new Error('Error interno al registrar el presente.'));
        }
      }).catch(() => reject(new Error('Error interno al procesar el auto-presente.')));
    });
  }

  static async obtenerPerfil(
    curso: string,
    token: string,
    clientIP: string
  ): Promise<PerfilData> {
    const filePath = getOrInitWorkingWorkbook(curso);
    if (!filePath || !existsSync(filePath)) {
      throw new Error(MENSAJES.ARCHIVO_NO_ENCONTRADO);
    }

    const verified = verifyStudentToken(token);
    if (!verified) throw new Error(MENSAJES.TOKEN_INVALIDO);

    if (rateLimitExceeded(clientIP, 'mi-perfil')) {
      throw new Error(MENSAJES.RATE_LIMIT_EXCEEDIDO);
    }

    const workbook = readWorkbook(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    const { index: targetIndex, row: alumnoRow } = this.obtenerFilaPorToken(data, verified);
    if (!alumnoRow || targetIndex < 0) throw new Error(MENSAJES.ALUMNO_NO_ENCONTRADO);

    const nombreAlumno = obtenerNombreAlumno(alumnoRow);
    const datos = {
      email: alumnoRow['Email Privado'] || '',
      dni: alumnoRow['DNI'] || '',
      titulo: alumnoRow['Título'] || '',
      tecnologia: alumnoRow['Tecnología'] || '',
      grupo: alumnoRow['Grupo'] || '',
      telefono: alumnoRow['Teléfono'] || '',
      fecha: alumnoRow['Fecha Registro'] || ''
    };
    const customValues: Record<string, string> = {};
    (stateManager.formConfig?.customFields || []).forEach(field => {
      if (field.enabled === false) return;
      const keyName = field.label || field.name;
      if (keyName) customValues[field.id] = alumnoRow[keyName] !== undefined ? String(alumnoRow[keyName]) : '';
    });
    const fotoUrl = findFotoForStudent(nombreAlumno, datos.dni);
    return { success: true, nombreAlumno, alumnoId: targetIndex, datos, customValues, fotoUrl };
  }

  static async guardarPerfil(
    curso: string,
    token: string,
    datos: Partial<RegistroData>,
    clientIP: string
  ): Promise<{ success: boolean; fotoUrl: string | null }> {
    const filePath = getOrInitWorkingWorkbook(curso);
    if (!filePath || !existsSync(filePath)) {
      throw new Error(MENSAJES.ARCHIVO_NO_ENCONTRADO);
    }

    const verified = verifyStudentToken(token);
    if (!verified) throw new Error(MENSAJES.TOKEN_INVALIDO);

    if (rateLimitExceeded(clientIP, 'mi-perfil')) {
      throw new Error(MENSAJES.RATE_LIMIT_EXCEEDIDO);
    }

    if (datos.fotoData) {
      const fotoValidation = validateFotoBase64(datos.fotoData);
      if (!fotoValidation.valid) throw new Error(fotoValidation.error);
    }

    return new Promise((resolve, reject) => {
      withCourseLock(filePath, async () => {
        try {
          const workbook = readWorkbook(filePath);
          const sheetName = workbook.SheetNames[0];
          const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]) as Array<Record<string, unknown>>;
          const { index: targetIndex, row: alumno } = this.obtenerFilaPorToken(data, verified);
          if (!alumno || targetIndex < 0) throw new Error(MENSAJES.ALUMNO_NO_ENCONTRADO);

          if (stateManager.formConfig?.standardFields?.email?.enabled !== false) alumno['Email Privado'] = typeof datos.email === 'string' ? datos.email.trim() : '';
          if (stateManager.formConfig?.standardFields?.titulo?.enabled !== false) alumno['Título'] = typeof datos.titulo === 'string' ? datos.titulo.trim() : '';
          if (stateManager.formConfig?.standardFields?.tecnologia?.enabled !== false) alumno['Tecnología'] = typeof datos.tecnologia === 'string' ? datos.tecnologia.trim() : '';
          if (stateManager.formConfig?.standardFields?.telefono?.enabled !== false) alumno['Teléfono'] = typeof datos.telefono === 'string' ? datos.telefono.trim() : '';
          if (stateManager.formConfig?.standardFields?.dni?.enabled !== false) alumno['DNI'] = typeof datos.dni === 'string' ? datos.dni.trim() : '';
          if (stateManager.formConfig?.standardFields?.grupo?.enabled !== false) alumno['Grupo'] = typeof datos.grupo === 'string' ? datos.grupo.trim() : '';

          if (datos.customValues && stateManager.formConfig?.customFields) {
            stateManager.formConfig.customFields.forEach(field => {
              if (field.enabled !== false && datos.customValues![field.id] !== undefined) {
                const keyName = field.label || field.name;
                if (keyName) alumno[keyName] = datos.customValues![field.id];
              }
            });
          }
          const alumnoName = obtenerNombreAlumno(alumno);
          if (datos.fotoData) saveStudentFoto(alumnoName, datos.dni || String(alumno['DNI'] || ''), datos.fotoData);

          consolidarPresentismo(workbook, data);
          workbook.Sheets[sheetName] = xlsx.utils.json_to_sheet(data);
          const writeErr = writeWorkbookSafely(workbook, filePath);
          if (writeErr) throw new Error(writeErr.error);

          console.log(`💾 Perfil actualizado por el alumno: ${alumnoName} en [${basename(curso)}].`);
          const newFotoUrl = datos.fotoData ? findFotoForStudent(alumnoName, datos.dni || alumno['DNI']) : null;
          resolve({ success: true, fotoUrl: newFotoUrl });
        } catch (error: any) {
          console.error('Error al guardar perfil del alumno:', error);
          reject(new Error('Error interno al guardar los datos del alumno.'));
        }
      }).catch(() => reject(new Error('Error interno al actualizar el perfil.')));
    });
  }

  static async remarcarPresenteTardio(
    curso: string,
    token: string,
    clientIP: string
  ): Promise<{ success: boolean; estado: string; hora: string; fotoUrl: string | null }> {
    const filePath = getOrInitWorkingWorkbook(curso);
    if (!filePath || !existsSync(filePath)) {
      throw new Error(MENSAJES.ARCHIVO_NO_ENCONTRADO);
    }

    const verified = verifyStudentToken(token);
    if (!verified) throw new Error(MENSAJES.TOKEN_INVALIDO);

    const configAsist = stateManager.formConfig?.asistencia ?? { permitirPresenteTardio: true, horaLimite: '' };
    const permiteTardio = configAsist.permitirPresenteTardio !== false;
    const horaLimite = typeof configAsist.horaLimite === 'string' ? configAsist.horaLimite.trim() : '';
    if (!permiteTardio) throw new Error('El presente tardío está deshabilitado por el docente.');
    if (!dentroDeHoraLimite(horaLimite)) {
      throw new Error(`Ya pasó el horario límite para registrarse como presente tardío (${horaLimite || 'sin horario'}).`);
    }
    if (rateLimitExceeded(clientIP, 'mi-presente')) {
      throw new Error(MENSAJES.RATE_LIMIT_EXCEEDIDO);
    }

    return new Promise((resolve, reject) => {
      withCourseLock(filePath, async () => {
        try {
          const workbook = readWorkbook(filePath);
          const sheetName = workbook.SheetNames[0];
          const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
          const { index: targetIndex, row: alumnoRow } = this.obtenerFilaPorToken(data, verified);
          if (!alumnoRow || targetIndex < 0) throw new Error(MENSAJES.ALUMNO_NO_ENCONTRADO);

          const displayName = obtenerNombreAlumno(alumnoRow);
          const studentDni = alumnoRow['DNI'] || '';
          const hoy = new Date();
          const dateSheetName = todaySheetName();
          const horaActual = hoy.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

          let dateData: any[] = [];
          if (workbook.SheetNames.includes(dateSheetName)) {
            dateData = xlsx.utils.sheet_to_json(workbook.Sheets[dateSheetName]);
          }
          const filaFechaObj = {
            'DNI': studentDni || 'SIN DNI',
            'Alumno': displayName,
            'Asistencia': 'PRESENTE TARDÍO',
            'Grupo': (alumnoRow['Grupo'] || 'SIN GRUPO').toString().toUpperCase().trim(),
            'Hora Registro': horaActual
          };
          const idxInDate = dateData.findIndex(r => (r['Alumno'] || r['Nombre'] || '').toString().trim().toLowerCase() === displayName.toLowerCase());
          if (idxInDate >= 0) dateData[idxInDate] = filaFechaObj;
          else dateData.push(filaFechaObj);
          workbook.Sheets[dateSheetName] = xlsx.utils.json_to_sheet(dateData);

          consolidarPresentismo(workbook, data);
          workbook.Sheets[sheetName] = xlsx.utils.json_to_sheet(data);
          const writeErr = writeWorkbookSafely(workbook, filePath);
          if (writeErr) throw new Error(writeErr.error);

          const fotoUrl = findFotoForStudent(displayName, studentDni);
          console.log(`🟠 Presente tardío auto-registrado por ${displayName} a las ${horaActual} en [${basename(curso)}].`);
          resolve({ success: true, estado: 'PRESENTE TARDÍO', hora: horaActual, fotoUrl });
        } catch (error: any) {
          console.error('Error al registrar presente tardío:', error);
          reject(new Error('Error interno al registrar el presente tardío.'));
        }
      }).catch(() => reject(new Error('Error interno al procesar el presente tardío.')));
    });
  }

  static async borrarFotoAlumno(nombreCompleto: string, dni: string): Promise<{ success: boolean; deleted: boolean }> {
    const deleted = deleteStudentFoto(nombreCompleto, dni);
    return { success: true, deleted };
  }

  static checkRegistration(clientIP: string): { registered: boolean } {
    return { registered: stateManager.hasRegisteredIP(clientIP) };
  }
}