import type { AsistenciaEstado, ModoTardanza } from '../config/constants.js';

export interface FormConfig {
  standardFields: Record<string, CampoConfig>;
  customFields: CustomField[];
  asistencia: {
    permitirPresenteTardio: boolean;
    horaLimite: string;
  };
  cursoPreferido: string;
}

export interface CampoConfig {
  label: string;
  enabled: boolean;
  required: boolean;
  category: string;
  type?: string;
  options?: string[];
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

export interface ServerInfo {
  url: string;
  qr: string;
}

export interface SessionData {
  token: string;
  expiresAt: number;
}

export interface TardanzaConfig {
  modo: ModoTardanza;
  horaInicio: string;
  margenGracia: number;
  minDespues: number;
}

type StateListener = (key: string, newValue: unknown, oldValue: unknown) => void;

class StateManager {
  private state: Map<string, unknown> = new Map();
  private listeners: Map<string, Set<StateListener>> = new Map();

  constructor() {
    this.initializeDefaults();
  }

  private initializeDefaults(): void {
    this.state.set('activeCourse', '');
    this.state.set('formConfig', null);
    this.state.set('registeredIPs', new Set<string>());
    this.state.set('serverInfo', { url: '', qr: '' });
    this.state.set('sessions', new Map<string, number>());
    this.state.set('tardanzaConfig', {
      modo: 'manual',
      horaInicio: '',
      margenGracia: 0,
      minDespues: 30
    } as TardanzaConfig);
  }

  get<T>(key: string): T {
    return this.state.get(key) as T;
  }

  set<T>(key: string, value: T): void {
    const oldValue = this.state.get(key);
    if (oldValue === value) return;
    this.state.set(key, value);
    this.notify(key, value, oldValue);
  }

  subscribe(key: string, listener: StateListener): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);
    return () => this.listeners.get(key)?.delete(listener);
  }

  private notify(key: string, newValue: unknown, oldValue: unknown): void {
    const listeners = this.listeners.get(key);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(key, newValue, oldValue);
        } catch (err) {
          console.error(`Error en listener de state[${key}]:`, err);
        }
      }
    }
  }

  // Métodos de conveniencia tipados
  get activeCourse(): string {
    return this.get('activeCourse');
  }

  set activeCourse(value: string) {
    this.set('activeCourse', value);
  }

  get formConfig(): FormConfig | null {
    return this.get('formConfig');
  }

  set formConfig(value: FormConfig | null) {
    this.set('formConfig', value);
  }

  get registeredIPs(): Set<string> {
    return this.get('registeredIPs');
  }

  get serverInfo(): ServerInfo {
    return this.get('serverInfo');
  }

  set serverInfo(value: ServerInfo) {
    this.set('serverInfo', value);
  }

  get sessions(): Map<string, number> {
    return this.get('sessions');
  }

  get tardanzaConfig(): TardanzaConfig {
    return this.get('tardanzaConfig');
  }

  set tardanzaConfig(value: TardanzaConfig) {
    this.set('tardanzaConfig', value);
  }

  // Helpers para sesiones
  createSession(token: string, ttlMs: number): void {
    const sessions = this.sessions;
    sessions.set(token, Date.now() + ttlMs);
    this.set('sessions', new Map(sessions));
  }

  validateSession(token: string): boolean {
    const sessions = this.sessions;
    const exp = sessions.get(token);
    if (!exp) return false;
    if (Date.now() > exp) {
      sessions.delete(token);
      this.set('sessions', new Map(sessions));
      return false;
    }
    return true;
  }

  deleteSession(token: string): void {
    const sessions = this.sessions;
    sessions.delete(token);
    this.set('sessions', new Map(sessions));
  }

  clearRegisteredIPs(): void {
    const ips = new Set<string>();
    this.set('registeredIPs', ips);
  }

  addRegisteredIP(ip: string): void {
    const ips = this.registeredIPs;
    ips.add(ip);
    this.set('registeredIPs', new Set(ips));
  }

  hasRegisteredIP(ip: string): boolean {
    return this.registeredIPs.has(ip);
  }

  // Serialización para persistencia/debug
  toJSON(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of this.state) {
      if (value instanceof Map) {
        obj[key] = Object.fromEntries(value);
      } else if (value instanceof Set) {
        obj[key] = Array.from(value);
      } else {
        obj[key] = value;
      }
    }
    return obj;
  }
}

export const stateManager = new StateManager();