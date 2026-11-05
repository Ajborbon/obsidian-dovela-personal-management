/**
 * Caché local por dispositivo (no se sincroniza): preferencias de UI, `deviceId`, estado de migración local.
 * Usa `app.saveLocalStorage` (aislado por vault) con respaldo en `window.localStorage`.
 */
import type { App } from 'obsidian';

const PREFIX = 'dovela:';

type LocalStorageApp = App & {
  loadLocalStorage?: (key: string) => unknown;
  saveLocalStorage?: (key: string, data: unknown) => void;
  appId?: string;
};

export class DeviceCache {
  private readonly app: LocalStorageApp;
  private cachedId: string | null = null;

  constructor(app: App) {
    this.app = app as LocalStorageApp;
  }

  get<T>(key: string, fallback: T): T {
    try {
      if (typeof this.app.loadLocalStorage === 'function') {
        const v = this.app.loadLocalStorage(PREFIX + key);
        return (v ?? fallback) as T;
      }
      const raw = window.localStorage.getItem(this.scoped(key));
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  }

  set(key: string, value: unknown): void {
    try {
      if (typeof this.app.saveLocalStorage === 'function') {
        this.app.saveLocalStorage(PREFIX + key, value ?? null);
        return;
      }
      if (value === null || value === undefined) window.localStorage.removeItem(this.scoped(key));
      else window.localStorage.setItem(this.scoped(key), JSON.stringify(value));
    } catch {
      // Almacenamiento lleno o bloqueado: las preferencias son prescindibles.
    }
  }

  /** Identificador corto y estable de este dispositivo (se genera la primera vez). */
  deviceId(): string {
    // En memoria: aunque el almacenamiento falle, el id no cambia durante la sesión (revisión #18).
    if (this.cachedId) return this.cachedId;
    let id = this.get<string | null>('deviceId', null);
    if (!id || !/^[a-z0-9]{4,16}$/.test(id)) {
      id = randomId(6);
      this.set('deviceId', id);
    }
    this.cachedId = id;
    return id;
  }

  /** Lee una clave v1 de `window.localStorage` (sin prefijo) para migrarla una vez. */
  readLegacyLocalStorage(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private scoped(key: string): string {
    return `${PREFIX}${this.app.appId ?? 'vault'}:${key}`;
  }
}

export function randomId(len: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}
