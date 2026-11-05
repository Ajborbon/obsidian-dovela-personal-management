/**
 * Contexto compartido que reciben todas las features (`features/<x>/index.ts → register(ctx)`).
 * Las features NO se comunican entre sí directamente: usan el índice, los servicios y eventos de aquí.
 */
import type { App, Plugin } from 'obsidian';
import type { DeviceCache } from './host/deviceCache';
import type { VaultIndex } from './host/index/VaultIndex';
import type { SettingsStore } from './host/settingsStore';
import type { TaskWriter } from './host/taskWriter';

export interface DovelaContext {
  readonly app: App;
  readonly plugin: Plugin;
  readonly settings: SettingsStore;
  readonly index: VaultIndex;
  readonly cache: DeviceCache;
  readonly tasks: TaskWriter;
  /** Reloj inyectable (pruebas). */
  now(): Date;
  /** Fecha local YYYY-MM-DD de `now()`. */
  today(): string;
  /** Servicios que publican las features (p. ej. `time`); acceso tipado con `getService`. */
  readonly services: Map<string, unknown>;
}

export function getService<T>(ctx: DovelaContext, name: string): T | undefined {
  return ctx.services.get(name) as T | undefined;
}

export interface Feature {
  readonly id: string;
  register(ctx: DovelaContext): void | Promise<void>;
  /** Limpieza adicional (los registerEvent/registerView del plugin se limpian solos). */
  unload?(): void;
}
