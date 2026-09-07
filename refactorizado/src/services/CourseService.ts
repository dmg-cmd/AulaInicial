import { PATHS } from '../config/index.js';
import { xlsx, readWorkbook, getOrInitWorkingWorkbook, obtenerNombreAlumno } from '../data/xlsx.js';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { stateManager } from '../core/StateManager.js';
import { normalizeGrupoStr } from '../utils/validation.js';

export interface CursoInfo {
  nombre: string;
  path: string;
}

export interface GrupoInfo {
  nombre: string;
  integrantes: AlumnoGrupo[];
}

export interface AlumnoGrupo {
  nombreCompleto: string;
  titulo: string;
  email: string;
  tecnologia: string;
}

export class CourseService {
  static listarCursos(): string[] {
    try {
      if (!existsSync(PATHS.CURSOS_DIR)) return [];
      return readdirSync(PATHS.CURSOS_DIR).filter(f => {
        const low = f.toLowerCase();
        return (low.endsWith('.xlsx') || low.endsWith('.xls') || low.endsWith('.csv')) && !f.startsWith('~$');
      });
    } catch (e) {
      console.error('Error al leer cursos:', e);
      return [];
    }
  }

  static getActiveCourse(): string {
    const current = stateManager.activeCourse;
    const currentPath = current ? getOrInitWorkingWorkbook(current) : null;
    if (current && currentPath && existsSync(currentPath)) {
      return current;
    }

    const preferido = stateManager.formConfig?.cursoPreferido?.trim();
    const preferidoPath = preferido ? getOrInitWorkingWorkbook(preferido) : null;
    if (preferido && preferidoPath && existsSync(preferidoPath)) {
      stateManager.activeCourse = preferido;
      console.log(`💡 Auto-seleccionado curso preferido: ${preferido}`);
      return preferido;
    }

    const cursos = this.listarCursos();
    if (cursos.length > 0) {
      stateManager.activeCourse = cursos[0];
      console.log(`💡 Auto-seleccionado curso por defecto: ${cursos[0]}`);
      return cursos[0];
    }

    return '';
  }

  static setActiveCourse(curso: string): void {
    stateManager.activeCourse = curso;
    stateManager.clearRegisteredIPs();
    if (curso && stateManager.formConfig) {
      stateManager.formConfig.cursoPreferido = curso;
    }
    console.log(`\n📘 Curso activo cambiado a: ${curso}. Lista de IPs reiniciada.`);
  }

  static obtenerGrupos(curso?: string): string[] {
    const cursoActivo = curso || this.getActiveCourse();
    if (!cursoActivo) return [];
    const filePath = getOrInitWorkingWorkbook(cursoActivo);
    if (!filePath || !existsSync(filePath)) return [];

    try {
      const workbook = readWorkbook(filePath);
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as Array<Record<string, unknown>>;
      const grupos = [...new Set(data.map(row => row['Grupo'] as string | null | undefined).filter(g => g))];
      return grupos.map(g => normalizeGrupoStr(g)).sort();
    } catch (e) {
      console.error('Error al obtener grupos:', e);
      return [];
    }
  }

  static obtenerGruposConMiembros(curso?: string): Record<string, AlumnoGrupo[]> {
    const cursoActivo = curso || this.getActiveCourse();
    if (!cursoActivo) return {};
    const filePath = getOrInitWorkingWorkbook(cursoActivo);
    if (!filePath || !existsSync(filePath)) return {};

    try {
      const workbook = readWorkbook(filePath);
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as Array<Record<string, unknown>>;
      const gruposMap: Record<string, AlumnoGrupo[]> = {};

      data.forEach((row: Record<string, unknown>) => {
        const name = obtenerNombreAlumno(row);
        if (!name || name.toLowerCase() === 'nombre' || name.toLowerCase() === 'full name') return;
        const grupo = normalizeGrupoStr(row['Grupo'] as string | null | undefined);
        if (!grupo) return;
        if (!gruposMap[grupo]) gruposMap[grupo] = [];
        gruposMap[grupo].push({
          nombreCompleto: name.trim(),
          titulo: String(row['Título'] || row['Titulo'] || 'Sin Título'),
          email: String(row['Email Privado'] || ''),
          tecnologia: String(row['Tecnología'] || row['Tecnologia'] || '')
        });
      });

      return gruposMap;
    } catch (e) {
      console.error('Error al procesar grupos e integrantes:', e);
      return {};
    }
  }

  static obtenerFechasDisponibles(curso?: string): Array<{ id: string; label: string }> {
    const cursoActivo = curso || this.getActiveCourse();
    if (!cursoActivo) return [{ id: 'TODAS', label: '🌐 Acumulado General (Todas las Fechas)' }];
    const filePath = getOrInitWorkingWorkbook(cursoActivo);
    if (!filePath || !existsSync(filePath)) return [{ id: 'TODAS', label: '🌐 Acumulado General (Todas las Fechas)' }];

    try {
      const workbook = readWorkbook(filePath);
      const sheetNames = workbook.SheetNames;
      const list = [{ id: 'TODAS', label: '🌐 Acumulado General (Todas las Fechas)' }];
      sheetNames.forEach((sName: string, idx: number) => {
        if (idx === 0) return;
        list.push({ id: sName, label: `📅 Fecha: ${sName}` });
      });
      return list;
    } catch (err) {
      console.error('Error al obtener fechas disponibles:', err);
      return [{ id: 'TODAS', label: '🌐 Acumulado General (Todas las Fechas)' }];
    }
  }
}