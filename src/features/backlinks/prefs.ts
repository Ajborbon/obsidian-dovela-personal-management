/** Preferencias de Backlinks compartidas entre la vista y la sección de ajustes (caché por dispositivo). */
import { loadPrefs, savePrefs, type BacklinkPrefs, type PrefsStorage } from '../../core/backlinks/prefs';

export class PrefsHolder {
  private current: BacklinkPrefs | null = null;
  private readonly listeners = new Set<(p: BacklinkPrefs) => void>();

  constructor(private readonly storage: PrefsStorage) {}

  /** Carga perezosa (con la migración única de v1 la primera vez en este dispositivo). */
  get value(): BacklinkPrefs {
    if (!this.current) this.current = loadPrefs(this.storage);
    return this.current;
  }

  update(fn: (p: BacklinkPrefs) => BacklinkPrefs): void {
    this.current = fn(this.value);
    savePrefs(this.storage, this.current);
    for (const l of this.listeners) l(this.current);
  }

  onChange(fn: (p: BacklinkPrefs) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
