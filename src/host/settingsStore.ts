/**
 * Carga/guarda `data.json` (v2) con respaldo único de v1 y guardado con debounce.
 * El historial v1 (que puede pesar megas) vive en `data.v1.backup.json`: `data.json` solo guarda
 * una marca `legacy.inBackup` y el historial se lee del respaldo bajo demanda (revisión #7).
 */
import type { Plugin } from 'obsidian';
import { debounce } from 'obsidian';
import { legacyFromV1, loadSettings, toPersisted, type DovelaSettings, type LegacyData } from '../core/settings';
import { logger } from './logger';

export type SettingsListener = (s: DovelaSettings) => void;

const BACKUP_FILE = 'data.v1.backup.json';

export class SettingsStore {
  private data!: DovelaSettings;
  private readonly listeners = new Set<SettingsListener>();
  private dirty = false;
  private readonly saveSoon = debounce(() => void this.saveNow(), 500, true);
  private legacyCache: LegacyData | null = null;

  constructor(private readonly plugin: Plugin) {}

  get value(): DovelaSettings {
    return this.data;
  }

  async load(): Promise<void> {
    const raw: unknown = await this.plugin.loadData();
    const { settings, wasV1 } = loadSettings(raw);
    this.data = settings;
    if (wasV1) {
      const ok = settings.migration.v1BackupWritten || (await this.writeV1Backup(raw));
      if (ok) {
        this.data.migration.v1BackupWritten = true;
        if (this.data.legacy) {
          this.legacyCache = { ...this.data.legacy };
          this.data.legacy.inBackup = true;
        }
      }
      await this.saveNow();
    }
  }

  /** Recarga tras un cambio externo (Sync) de `data.json`. */
  async reload(): Promise<void> {
    const raw: unknown = await this.plugin.loadData();
    this.data = loadSettings(raw).settings;
    this.emit();
  }

  update(mutator: (s: DovelaSettings) => void): void {
    mutator(this.data);
    this.dirty = true;
    this.emit();
    this.saveSoon();
  }

  onChange(fn: SettingsListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  async saveNow(): Promise<void> {
    this.dirty = false;
    await this.plugin.saveData(toPersisted(this.data));
  }

  /** Escribe los cambios pendientes del debounce (al descargar el plugin). */
  async flush(): Promise<void> {
    this.saveSoon.cancel();
    if (this.dirty) await this.saveNow();
  }

  /**
   * Datos legados de v1 (historial de tiempo, sesiones activas). Si están marcados como guardados
   * en el respaldo, se leen de `data.v1.backup.json` la primera vez. Tras archivar: vacío.
   */
  async loadLegacy(): Promise<LegacyData> {
    if (this.data.migration.archivedAt) return {};
    const inMemory = this.data.legacy;
    if (!inMemory) return {};
    if (!inMemory.inBackup) return inMemory;
    if (this.legacyCache) return this.legacyCache;
    const dir = this.plugin.manifest.dir;
    if (!dir) return {};
    try {
      const raw: unknown = JSON.parse(await this.plugin.app.vault.adapter.read(`${dir}/${BACKUP_FILE}`));
      this.legacyCache = legacyFromV1(raw);
    } catch (e) {
      logger.error('No se pudo leer el respaldo de data.json v1', e);
      this.legacyCache = {};
    }
    return this.legacyCache;
  }

  /** Olvida el historial legado (tras verificar la importación). El respaldo se conserva en disco. */
  archiveLegacy(at: string): void {
    this.legacyCache = null;
    this.update((s) => {
      delete s.legacy;
      s.migration.archivedAt = at;
    });
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.data);
  }

  /** Escribe el respaldo una sola vez. Devuelve true si el respaldo existe al terminar. */
  private async writeV1Backup(raw: unknown): Promise<boolean> {
    const dir = this.plugin.manifest.dir;
    if (!dir) return false;
    const path = `${dir}/${BACKUP_FILE}`;
    const adapter = this.plugin.app.vault.adapter;
    try {
      if (!(await adapter.exists(path))) await adapter.write(path, JSON.stringify(raw, null, 2));
      return await adapter.exists(path);
    } catch (e) {
      logger.error('No se pudo escribir el respaldo de data.json v1', e);
      return false;
    }
  }
}
