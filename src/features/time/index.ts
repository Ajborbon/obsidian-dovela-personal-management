/**
 * Feature de tiempo: publica `TimeService` y los comandos de migración del historial v1.
 * La UI (barra de estado, modales, vistas) se registra desde `./ui` (F4/F7).
 */
import { Notice, Modal, Setting } from 'obsidian';
import type { App } from 'obsidian';
import type { DovelaContext, Feature } from '../../context';
import { TIME_SERVICE, TimeService } from '../../host/time/TimeService';
import type { LegacyReport } from '../../core/time/legacyImport';
import { addSettingsSection, bindText, bindToggle, bindSlider } from '../settings';
import type { DovelaSettings } from '../../core/settings';
import { registerTimeUi } from './ui';
import { logger } from '../../host/logger';

class ReportModal extends Modal {
  constructor(app: App, private readonly titleText: string, private readonly lines: string[]) {
    super(app);
  }

  override onOpen(): void {
    this.setTitle(this.titleText);
    const ul = this.contentEl.createEl('ul');
    for (const l of this.lines) ul.createEl('li', { text: l });
  }
}

function reportLines(r: LegacyReport): string[] {
  return [
    `Leídos: ${r.read}`,
    `Importados: ${r.imported}`,
    `Ya importados antes: ${r.alreadyImported}`,
    `Duplicados omitidos: ${r.duplicates}`,
    `Con fin anterior al inicio (importados y marcados): ${r.incoherent}`,
    `Duración guardada distinta de la calculada: ${r.durationMismatch}`,
    `Inválidos (no importados): ${r.invalid.length}${r.invalid.length ? ` → índices ${r.invalid.map((x) => x.index).join(', ')}` : ''}`,
    ...Object.entries(r.minutesByMonth).sort().map(([m, min]) => `${m}: ${Math.round(min / 60 * 10) / 10} h`),
  ];
}

export function getTime(ctx: DovelaContext): TimeService {
  const s = ctx.services.get(TIME_SERVICE);
  if (!(s instanceof TimeService)) throw new Error('TimeService no disponible');
  return s;
}

export const timeFeature: Feature = {
  id: 'time',
  register(ctx) {
    const service = new TimeService(
      ctx.app, ctx.settings, ctx.tasks, ctx.cache.deviceId(), ctx.now, ctx.plugin.manifest.dir ?? '',
      (id) => ctx.index.store.taskById().get(id)?.path,
    );
    ctx.services.set(TIME_SERVICE, service);
    service.store.start(ctx.plugin);
    // Carga en segundo plano tras el layout (no bloquea el arranque).
    ctx.app.workspace.onLayoutReady(() => {
      service.ready().then(() => maybeOfferImport(ctx, service)).catch((e: unknown) => logger.error('No se pudo cargar el registro de tiempo', e));
    });

    ctx.plugin.addCommand({
      id: 'tiempo-importar-historial-v1',
      name: 'Tiempo: importar historial de registros de v1',
      callback: async () => {
        const r = await service.importLegacy();
        if (!r) new Notice('Dovela: no hay historial v1 por importar.');
        else new ReportModal(ctx.app, 'Importación del historial de tiempo', reportLines(r)).open();
      },
    });
    ctx.plugin.addCommand({
      id: 'tiempo-verificar-historial-v1',
      name: 'Tiempo: verificar historial importado',
      callback: async () => {
        await service.ready();
        const v = await service.verifyImport();
        new ReportModal(ctx.app, v.ok ? '✅ Historial verificado' : '⚠️ El historial importado no coincide', v.rows.map(
          (r) => `${r.month}: v1 ${r.legacy} min · importado ${r.imported} min${r.imported >= r.legacy ? '' : ' ⚠️'}`,
        )).open();
      },
    });
    ctx.plugin.addCommand({
      id: 'tiempo-archivar-historial-v1',
      name: 'Tiempo: archivar historial v1 de data.json (tras verificar)',
      callback: async () => {
        await service.ready();
        new Notice((await service.archiveLegacy())
          ? 'Dovela: historial v1 archivado (el respaldo data.v1.backup.json se conserva).'
          : 'Dovela: la verificación no es correcta; no se archivó nada.');
      },
    });

    addSettingsSection(ctx, {
      id: 'time', title: 'Registro de tiempo', order: 30,
      render(el, c) {
        const t = (s: DovelaSettings) => s.time;
        // La carpeta se aplica al salir del campo (no en cada tecla) y recarga los registros (revisión #17).
        new Setting(el).setName('Carpeta de registros')
          .setDesc('Archivos `YYYY-MM · <dispositivo>.md`. Cada dispositivo escribe solo el suyo (seguro con Obsidian Sync). Se aplica al salir del campo.')
          .addText((txt) => {
            txt.setValue(c.settings.value.time.folder);
            txt.inputEl.addEventListener('blur', () => {
              const v = txt.getValue().trim().replace(/\/+$/, '');
              if (!v || v === c.settings.value.time.folder) return;
              c.settings.update((s) => { s.time.folder = v; });
              void service.store.reloadAll().then(() => new Notice(`Dovela: registros de tiempo en “${v}”.`));
            });
          });
        bindText(c, el, t, 'exportFolder', 'Carpeta de exportaciones CSV');
        bindToggle(c, el, t, 'closeTaskByDefault', '“Cerrar tarea” marcado por defecto al detener');
        bindSlider(c, el, t, 'staleLiveHours', 'Avisar de sesiones abiertas tras (horas)', 1, 48);
        new Setting(el).setName('Separador CSV').addDropdown((d) => d.addOptions({ ';': '; (Excel en español)', ',': ', (internacional)' })
          .setValue(c.settings.value.time.csvSeparator)
          .onChange((v) => c.settings.update((s) => { s.time.csvSeparator = v === ',' ? ',' : ';'; })));
        new Setting(el).setName('Dispositivo').setDesc(`Identificador de este dispositivo: ${c.cache.deviceId()}`);
      },
    });

    registerTimeUi(ctx, service);
  },
};

async function maybeOfferImport(ctx: DovelaContext, service: TimeService): Promise<void> {
  if (ctx.settings.value.migration.importedAt) return;
  const legacy = await ctx.settings.loadLegacy();
  const n = legacy.timeLogs?.length ?? 0;
  if (!n) return;
  const notice = new Notice(`Dovela v2: hay ${n} registros de tiempo de v1 por importar. Toca aquí para importarlos (no se borra nada).`, 0);
  notice.noticeEl.addEventListener('click', () => {
    notice.hide();
    void service.importLegacy().then((r) => {
      if (r) new ReportModal(ctx.app, 'Importación del historial de tiempo', reportLines(r)).open();
    });
  });
}
