import { PATHS } from '../config/index.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { stateManager } from '../core/StateManager.js';
import { CAMPOS_ESTANDAR, TITULO_OPCIONES, MENSAJES } from '../config/constants.js';
import type { CampoConfig } from '../core/StateManager.js';

export interface FormConfig {
  standardFields: Record<string, CampoConfig>;
  customFields: CustomField[];
  asistencia: {
    permitirPresenteTardio: boolean;
    horaLimite: string;
  };
  cursoPreferido: string;
}

export interface CustomField {
  id: string;
  label: string;
  name?: string;
  type?: string;
  options?: string[];
  required?: boolean;
  enabled?: boolean;
  category?: string;
}

const TITULO_OPCIONES_MUTABLE: string[] = [...TITULO_OPCIONES];

const defaultConfig: FormConfig = {
  standardFields: {
    email: { ...CAMPOS_ESTANDAR.email, options: [], enabled: true },
    dni: { ...CAMPOS_ESTANDAR.dni, options: [], enabled: true },
    titulo: { ...CAMPOS_ESTANDAR.titulo, options: TITULO_OPCIONES_MUTABLE, enabled: true },
    tecnologia: { ...CAMPOS_ESTANDAR.tecnologia, options: ['AVANZADO', 'MODERADO', 'TEMEROSO'], enabled: true },
    grupo: { ...CAMPOS_ESTANDAR.grupo, options: [], enabled: true },
    telefono: { ...CAMPOS_ESTANDAR.telefono, options: [], enabled: true },
    foto: { ...CAMPOS_ESTANDAR.foto, options: [], enabled: true }
  },
  customFields: [],
  cursoPreferido: '',
  asistencia: {
    permitirPresenteTardio: true,
    horaLimite: ''
  }
};

export class ConfigService {
  static loadFormConfig(): FormConfig {
    try {
      if (existsSync(PATHS.CONFIG_PATH)) {
        const raw = readFileSync(PATHS.CONFIG_PATH, 'utf8');
        const parsed = JSON.parse(raw);

        const std: Record<string, CampoConfig> = {};
        Object.keys(defaultConfig.standardFields).forEach(k => {
          const def = defaultConfig.standardFields[k];
          const stored = (parsed.standardFields && parsed.standardFields[k]) || {};
          std[k] = {
            ...def,
            ...stored,
            category: stored.category || def.category || 'personal',
            options: (stored.options && stored.options.length > 0) ? stored.options : (def.options || [])
          };
        });

        const custom = (Array.isArray(parsed.customFields) ? parsed.customFields : []).map((f: any) => ({
          ...f,
          category: f.category || 'clase',
          options: f.options || []
        }));

        const asistencia = {
          permitirPresenteTardio: parsed.asistencia?.permitirPresenteTardio !== false,
          horaLimite: typeof parsed.asistencia?.horaLimite === 'string' ? parsed.asistencia.horaLimite.trim() : ''
        };

        const config: FormConfig = {
          standardFields: std,
          customFields: custom,
          asistencia,
          cursoPreferido: typeof parsed.cursoPreferido === 'string' ? parsed.cursoPreferido.trim() : ''
        };

        stateManager.formConfig = config;
        return config;
      }
    } catch (err) {
      console.error('Error al cargar form-config.json:', err);
    }
    const fallback = JSON.parse(JSON.stringify(defaultConfig));
    stateManager.formConfig = fallback;
    return fallback;
  }

  static saveFormConfig(config: FormConfig): boolean {
    try {
      writeFileSync(PATHS.CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
      stateManager.formConfig = config;
      return true;
    } catch (err) {
      console.error('Error al guardar form-config.json:', err);
      return false;
    }
  }

  static getFormConfig(): FormConfig | null {
    return stateManager.formConfig;
  }

  static updateFormConfig(
    standardFields: Record<string, CampoConfig>,
    customFields: CustomField[],
    asistencia: { permitirPresenteTardio: boolean; horaLimite: string },
    cursoPreferido: string
  ): FormConfig {
    const newConfig: FormConfig = {
      standardFields: { ...defaultConfig.standardFields, ...standardFields },
      customFields: Array.isArray(customFields) ? customFields : [],
      asistencia: {
        permitirPresenteTardio: asistencia?.permitirPresenteTardio !== false,
        horaLimite: typeof asistencia?.horaLimite === 'string' ? asistencia.horaLimite.trim() : ''
      },
      cursoPreferido: typeof cursoPreferido === 'string' ? cursoPreferido.trim() : (stateManager.formConfig?.cursoPreferido || '')
    };

    if (this.saveFormConfig(newConfig)) {
      console.log('⚙️ Configuración del formulario actualizada y guardada en form-config.json');
      return newConfig;
    }
    throw new Error(MENSAJES.ARCHIVO_NO_ENCONTRADO);
  }
}