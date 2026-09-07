import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CourseService } from '@services/CourseService.js';
import { StudentService } from '@services/StudentService.js';
import { AttendanceService } from '@services/AttendanceService.js';
import { RegistrationService } from '@services/RegistrationService.js';
import { ConfigService } from '@services/ConfigService.js';
import { ExportService } from '@services/ExportService.js';
import { stateManager } from '@core/StateManager.js';

describe('CourseService', () => {
  it('should list cursos', () => {
    const cursos = CourseService.listarCursos();
    expect(Array.isArray(cursos)).toBe(true);
  });

  it('should get active course', () => {
    const active = CourseService.getActiveCourse();
    expect(typeof active).toBe('string');
  });
});

describe('StudentService', () => {
  it('should get alumnos', () => {
    const alumnos = StudentService.obtenerAlumnos();
    expect(Array.isArray(alumnos)).toBe(true);
  });
});

describe('AttendanceService', () => {
  it('should get stats structure', () => {
    const stats = AttendanceService.obtenerEstadisticas('', 'titulo', 'TODOS', 'TODOS');
    expect(stats).toHaveProperty('availableFields');
    expect(stats).toHaveProperty('data');
    expect(stats).toHaveProperty('totalCount');
  });
});

describe('ConfigService', () => {
  it('should load form config', () => {
    const config = ConfigService.loadFormConfig();
    expect(config).toHaveProperty('standardFields');
    expect(config).toHaveProperty('customFields');
    expect(config).toHaveProperty('asistencia');
  });
});

describe('StateManager', () => {
  beforeEach(() => {
    stateManager.activeCourse = '';
    stateManager.formConfig = null;
  });

  it('should set and get activeCourse', () => {
    stateManager.activeCourse = 'test.xlsx';
    expect(stateManager.activeCourse).toBe('test.xlsx');
  });

  it('should notify subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = stateManager.subscribe('activeCourse', listener);
    stateManager.activeCourse = 'nuevo.xlsx';
    expect(listener).toHaveBeenCalledWith('activeCourse', 'nuevo.xlsx', '');
    unsubscribe();
    stateManager.activeCourse = 'otro.xlsx';
    expect(listener).toHaveBeenCalledTimes(1);
  });
});