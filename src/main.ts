/**
 * Dovela v2 — punto de entrada. `onload` no hace I/O pesado: carga ajustes (pequeños),
 * crea el índice (que se construye tras `onLayoutReady`) y registra las features, que
 * instancian sus vistas y servicios de forma perezosa.
 */
import { Plugin } from 'obsidian';
import { toLocalYmd } from './core/dates';
import type { DovelaContext, Feature } from './context';
import { FEATURES } from './features/registry';
import { DeviceCache } from './host/deviceCache';
import { VaultIndex } from './host/index/VaultIndex';
import { logger } from './host/logger';
import { SettingsStore } from './host/settingsStore';
import { TaskWriter } from './host/taskWriter';

export default class DovelaPlugin extends Plugin {
  ctx!: DovelaContext;
  private features: Feature[] = [];

  override async onload(): Promise<void> {
    const settings = new SettingsStore(this);
    await settings.load();
    const now = (): Date => new Date();
    const today = (): string => toLocalYmd(now());
    const index = new VaultIndex(this.app, () => settings.value.general);
    this.ctx = {
      app: this.app,
      plugin: this,
      settings,
      index,
      cache: new DeviceCache(this.app),
      tasks: new TaskWriter(this.app, today),
      now,
      today,
      services: new Map(),
    };
    index.start(this);

    for (const f of FEATURES) {
      try {
        await f.register(this.ctx);
        this.features.push(f);
      } catch (e) {
        logger.error(`No se pudo cargar la funcionalidad "${f.id}"`, e);
      }
    }
  }

  override onunload(): void {
    // Escribe los ajustes pendientes del debounce (revisión #7).
    void this.ctx?.settings.flush();
    for (const f of this.features) {
      try {
        f.unload?.();
      } catch (e) {
        logger.error(`Error al descargar "${f.id}"`, e);
      }
    }
  }

  override async onExternalSettingsChange(): Promise<void> {
    await this.ctx.settings.reload();
  }
}
