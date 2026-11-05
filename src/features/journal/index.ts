/**
 * Feature `journal` (F9): `journalAPI` / `weeklyAPI` con las firmas de v1 sobre el índice único,
 * bloques nativos ```dovela-dia``` / ```dovela-semana``` (alternativa a `datacorejsx`) y la vista
 * previa de los ajustes de Journal. Guía de pruebas: docs/v2/guia/journal-weekly.md.
 */
import type { MarkdownPostProcessorContext, Plugin } from 'obsidian';
import { MarkdownRenderChild } from 'obsidian';
import type { DovelaContext, Feature } from '../../context';
import { basenameOf } from '../../core/index/store';
import { parseDayBlock, parseWeekBlock } from '../../core/journal/block';
import { dateInputError, weekInputError } from '../../core/journal/validate';
import { createJournalAPI, createWeeklyAPI, mountDayView, mountWeekView, type JournalAPI, type WeeklyAPI } from './api';
import { registerJournalSettingsPreview } from './settingsPreview';
import { errorElement, type ViewHandle } from './view';

export type { JournalAPI, WeeklyAPI } from './api';

type PluginWithApis = Plugin & { journalAPI?: JournalAPI; weeklyAPI?: WeeklyAPI };

let host: PluginWithApis | null = null;

function mountBlock(
  el: HTMLElement, mdCtx: MarkdownPostProcessorContext, warnings: readonly string[],
  error: string | null, kind: 'journal' | 'weekly', mount: (root: HTMLElement) => ViewHandle,
): void {
  el.addClass('dovela-jw-block');
  if (warnings.length) el.createDiv({ cls: 'dovela-jw-warning', text: `⚠️ ${warnings.join(' · ')}` });
  if (error) {
    el.appendChild(errorElement(kind, error));
    return;
  }
  const child = new MarkdownRenderChild(el);
  mdCtx.addChild(child);
  const handle = mount(el.createDiv());
  child.register(() => handle.dispose());
}

export const journalFeature: Feature = {
  id: 'journal',
  register(ctx: DovelaContext) {
    const plugin = ctx.plugin as PluginWithApis;
    plugin.journalAPI = createJournalAPI(ctx);
    plugin.weeklyAPI = createWeeklyAPI(ctx);
    host = plugin;

    plugin.registerMarkdownCodeBlockProcessor('dovela-dia', (source, el, mdCtx) => {
      const cfg = parseDayBlock(source, basenameOf(mdCtx.sourcePath), ctx.today());
      mountBlock(el, mdCtx, cfg.warnings, dateInputError(cfg.date), 'journal', (root) => mountDayView(ctx, root, cfg.date, cfg.options, true));
    });
    plugin.registerMarkdownCodeBlockProcessor('dovela-semana', (source, el, mdCtx) => {
      const cfg = parseWeekBlock(source, basenameOf(mdCtx.sourcePath), ctx.today());
      mountBlock(el, mdCtx, cfg.warnings, weekInputError(cfg.week), 'weekly', (root) => mountWeekView(ctx, root, cfg.week, cfg.options, true));
    });

    registerJournalSettingsPreview(ctx);
  },
  unload() {
    if (host) {
      delete host.journalAPI;
      delete host.weeklyAPI;
      host = null;
    }
  },
};
