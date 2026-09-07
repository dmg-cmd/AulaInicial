export const ASISTENCIA_ESTADOS = {
  PRESENTE: 'PRESENTES',
  TARDE: 'TARDE',
  PRESENTE_TARDIO: 'PRESENTE TARDÍO',
  AUSENTE: 'AUSENTES'
} as const;

export type AsistenciaEstado = (typeof ASISTENCIA_ESTADOS)[keyof typeof ASISTENCIA_ESTADOS];

export const RATE_LIMIT = {
  MAX_REQUESTS: 12,
  WINDOW_MS: 20_000
} as const;

export const SESION = {
  TTL_MS: 8 * 60 * 60 * 1000,
  COOKIE_NAME: 'aula_admin_session',
  COOKIE_OPTIONS: {
    httpOnly: true,
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 8 * 60 * 60
  }
} as const;

export const ARCHIVO = {
  MAX_FOTO_BYTES: 5 * 1024 * 1024,
  FOTOS_DIR: 'registros/fotos',
  REGISTROS_DIR: 'registros',
  CURSOS_DIR: 'cursos',
  CONFIG_FILE: 'form-config.json',
  SECRET_FILE: '.secret',
  ADMIN_PASS_FILE: '.adminpass',
  EXCEL_EXTENSIONS: ['.xlsx', '.xls', '.csv'] as const
} as const;

export const HOJAS_EXCEL = {
  RESUMEN: 0,
  CFG_TARDANZA: 'CfgTardanza',
  TOMA_LISTA: 'TomaLista'
} as const;

export const CFG_TARDANZA_DEFAULTS = {
  modo: 'manual' as const,
  horaInicio: '',
  margenGracia: 0,
  minDespues: 30
} as const;

export type ModoTardanza = 'manual' | 'horario' | 'desplist';

export const CAMPOS_ESTANDAR = {
  email: { label: 'Email Privado', required: true, category: 'personal' },
  dni: { label: 'DNI / ID', required: true, category: 'personal' },
  titulo: { label: 'Título Profesional / Especialidad', required: true, category: 'personal', type: 'select' },
  tecnologia: { label: 'Relación con la Tecnología', required: true, category: 'personal', type: 'select' },
  grupo: { label: 'Grupo (Una sola palabra)', required: true, category: 'personal' },
  telefono: { label: 'Teléfono (Opcional)', required: false, category: 'personal' },
  foto: { label: 'Foto Real del Rostro (Identificación Visual)', required: false, category: 'personal' }
} as const;

export const TITULO_OPCIONES = [
  'LICENCIADO', 'ABOGADO', 'ARQUITECTO', 'COMUNICADOR', 'CONTADOR',
  'DOCENTE', 'ENFERMERO', 'IMAGENOLOGO', 'INGENIERO', 'MEDICO',
  'NUTRICIONISTA', 'POLITOLOGO', 'PSICOLOGO', 'RADIOLOGO',
  'SISTEMAS', 'VETERINARIO', 'OTRO'
] as const;

export const TECNOLOGIA_OPCIONES = ['AVANZADO', 'MODERADO', 'TEMEROSO'] as const;

export const PUERTOS = {
  DEFAULT: 3000,
  TEST: 3999
} as const;

export const CORS = {
  ALLOWED_ORIGINS_DEFAULT: 'http://localhost:3000'
} as const;

export const MENSAJES = {
  CURSO_NO_SELECCIONADO: 'No hay un curso activo seleccionado.',
  ARCHIVO_NO_ENCONTRADO: 'El archivo del curso no existe.',
  ALUMNO_NO_ENCONTRADO: 'Alumno no encontrado en el curso.',
  NO_AUTORIZADO: 'No autorizado. Debes iniciar sesión en el panel docente.',
  CONTRASEÑA_INCORRECTA: 'Contraseña incorrecta.',
  RATE_LIMIT_EXCEEDIDO: 'Demasiadas solicitudes. Espera unos segundos e inténtalo de nuevo.',
  FOTO_INVALIDA: 'Formato de imagen no válido. Solo JPEG, PNG o WebP (máx 5MB).',
  TOKEN_INVALIDO: 'Token de alumno inválido o alterado.',
  PASSWORD_DEFAULT: 'Contraseña por defecto. Será obligatorio cambiarla en el primer ingreso.'
} as const;

export const REGEX = {
  IP_V4: /^(\d{1,3}\.){3}\d{1,3}$/,
  HORA_HH_MM: /^(\d{1,2}):(\d{2})$/,
  FECHA_YYYY_MM_DD: /^(\d{4})-(\d{2})-(\d{2})$/,
  FECHA_DD_MM_YYYY: /^(\d{2})-(\d{2})-(\d{4})$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  BASE64_IMAGE: /^data:([A-Za-z-+/]+);base64,(.+)$/
} as const;