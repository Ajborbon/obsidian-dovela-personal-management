/**
 * Vista previa y validación de los ajustes de Journal (F70). v1 mostraba un ejemplo fijo y validaba
 * la carpeta base en cada cambio; aquí la vista previa usa la fecha de hoy y se actualiza en vivo.
 * Los campos editables siguen en la sección "Journal" de `features/settings` (no se duplican).
 */
import type { DovelaContext } from '../../context';
import { formatWeekCode, isoWeekOf } from '../../core/dates';
import { dailyNotePath, periodNotePath, weeklyLink } from '../../core/journal/paths';
import { validateBaseFolderPath } from '../../core/journal/validate';
import { addSettingsSection } from '../settings';
import { pathKind } from './folders';

function drawPreview(ctx: DovelaContext, box: HTMLElement): void {
  box.empty();
  const s = ctx.settings.value.journal;
  const today = ctx.today();
  const week = formatWeekCode(isoWeekOf(today));
  const check = validateBaseFolderPath(s.baseFolderPath, (p) => pathKind(ctx.app, p));
  const status = box.createDiv({ cls: `dovela-jw-preview-status ${check.valid ? 'is-valid' : 'is-invalid'}` });
  if (!check.valid) status.setText(`⚠️ ${check.message ?? 'Carpeta base inválida'}`);
  else if (pathKind(ctx.app, s.baseFolderPath) === 'folder') status.setText('✅ La carpeta base existe.');
  else status.setText('ℹ️ La carpeta base aún no existe; se creará al usarla (ensureFolderStructure).');

  const row = (label: string, value: () => string): void => {
    const r = box.createDiv({ cls: 'dovela-jw-preview-row' });
    r.createDiv({ cls: 'dovela-jw-preview-label', text: label });
    let text: string;
    try {
      text = value();
    } catch (e) {
      text = `⚠️ ${e instanceof Error ? e.message : String(e)}`;
    }
    r.createEl('code', { cls: 'dovela-jw-preview-value', text });
  };
  row(`Nota diaria de hoy (${today})`, () => dailyNotePath(s, today));
  row(`Enlace de semana (${week})`, () => weeklyLink(s, week));
  row('Nota semanal (weeklyAPI.getWeeklyNotePath si aún no existe)', () => periodNotePath(s, 'week', today));
}

export function registerJournalSettingsPreview(ctx: DovelaContext): void {
  addSettingsSection(ctx, {
    id: 'journal-preview',
    title: 'Journal: vista previa',
    order: 51,
    render(el, c) {
      const box = el.createDiv({ cls: 'dovela-jw-preview' });
      drawPreview(c, box);
      // Se desuscribe en cuanto la pestaña de ajustes se redibuja o se cierra.
      const off = c.settings.onChange(() => {
        if (!box.isConnected) {
          off();
          return;
        }
        drawPreview(c, box);
      });
    },
  });
}
