import xlsx from 'xlsx';
import { readFileSync } from 'node:fs';
import { PATHS } from '../config/index.js';
import {
  withCourseLock,
  writeWorkbookSafely,
  rateLimitExceeded,
  validateFotoBase64,
  normalizeClientIP,
  isFullyRegistered,
  todaySheetName,
  normalizeSheetDate,
  obtenerNombreAlumno,
  parseSheetDate,
  consolidarPresentismo,
  reconciliarAusentes,
  getFotoFilename,
  getStudentFotoUrl,
  findFotoForStudent,
  saveStudentFoto,
  deleteStudentFoto,
  findActualFileInCursos,
  getOrInitWorkingWorkbook,
  horaAminutos,
  evaluarTarde,
  leerCfgTardanza,
  leerHoraTomaLista,
  guardarCfgTardanza,
  guardarHoraTomaLista,
  dentroDeHoraLimite,
  normalizeGrupoStr
} from '../utils/validation.js';

// Wrapper para xlsx.readFile que maneja correctamente rutas con espacios
export function readWorkbook(filePath: string): any {
  const data = readFileSync(filePath);
  return xlsx.read(data, { type: 'buffer' });
}

export {
  xlsx,
  withCourseLock,
  writeWorkbookSafely,
  rateLimitExceeded,
  validateFotoBase64,
  normalizeClientIP,
  isFullyRegistered,
  todaySheetName,
  normalizeSheetDate,
  obtenerNombreAlumno,
  parseSheetDate,
  consolidarPresentismo,
  reconciliarAusentes,
  getFotoFilename,
  getStudentFotoUrl,
  findFotoForStudent,
  saveStudentFoto,
  deleteStudentFoto,
  findActualFileInCursos,
  getOrInitWorkingWorkbook,
  horaAminutos,
  evaluarTarde,
  leerCfgTardanza,
  leerHoraTomaLista,
  guardarCfgTardanza,
  guardarHoraTomaLista,
  dentroDeHoraLimite,
  normalizeGrupoStr
};