/** Carga/guarda `data.json` (v2) con respaldo único de v1 y guardado con debounce. */
import type { Plugin } from 'obsidian';
import { debounce } from 'obsidian';
import { loadSettings, type DovelaSettings } from '../core/settings';
import { logger } from './logger';

export type SettingsListener = (s: DovelaSettings) => void;

export class SettingsStore {
  private data!: DovelaSettings;
  private readonly listeners = new Set<SettingsListener>();
  private readonly saveSoon = debounce(() => void this.saveNow(), 500, true);

  constructor(private readonly plugin: Plugin) {}

  get value(): DovelaSettings {
    return this.data;
  }

  async load(): Promise<void> {
    const raw: unknown = await this.plugin.loadData();
    const { settings, wasV1 } = loadSettings(raw);
    this.data = settings;
    if (wasV1 && !settings.migration.v1BackupWritten) {
      await this.writeV1Backup(raw);
      this.data.migration.v1BackupWritten = true;
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
    this.emit();
    this.saveSoon();
  }

  onChange(fn: SettingsListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  async saveNow(): Promise<void> {
    await this.plugin.saveData(this.data);
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.data);
  }

  private async writeV1Backup(raw: unknown): Promise<void> {
    const dir = this.plugin.manifest.dir;
    if (!dir) return;
    const path = `${dir}/data.v1.backup.json`;
    const adapter = this.plugin.app.vault.adapter;
    try {
      if (!(await adapter.exists(path))) await adapter.write(path, JSON.stringify(raw, null, 2));
    } catch (e) {
      logger.error('No se pudo escribir el respaldo de data.json v1', e);
    }
  }
}
