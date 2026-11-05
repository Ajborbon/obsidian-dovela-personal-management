/**
 * API pública compatible con v1 (las notas del vault la invocan desde bloques `datacorejsx`):
 *   dc.app.plugins.plugins["obsidian-dovela-personal-management"].journalAPI.renderTasksForDate(fecha)
 *   dc.app.plugins.plugins["obsidian-dovela-personal-management"].weeklyAPI.renderTasksForWeek(semana, opciones)
 * Mismas firmas que v1. Los métodos son funciones cerradas sobre el contexto (no dependen de `this`).
 */
import type { DovelaContext } from '../../context';
import { formatWeekCode, isoWeekOf, isoWeekStart, parseWeekCode } from '../../core/dates';
import { classifyDay, dayCounts, dayGroups, dayHeader, ZERO_JOURNAL_COUNTS, type JournalRenderOptions, type JournalTaskCounts } from '../../core/journal/daily';
import { dailyFolderChain, dailyNotePath, periodNotePath, weeklyLink, weeklyLinkPath } from '../../core/journal/paths';
import {
  dateInputError, folderChain, normalizeWeekInput, parentFolder, validateBaseFolderPath, weekInputError, type ValidationResult,
} from '../../core/journal/validate';
import { classifyWeek, weekCounts, weekGroups, weekHeader, ZERO_WEEKLY_COUNTS, type WeeklyRenderOptions, type WeeklyTaskCounts } from '../../core/journal/weekly';
import { logger } from '../../host/logger';
import { ensureFolders, pathKind } from './folders';
import { errorElement, mountTaskView, type ViewHandle } from './view';

export type { JournalRenderOptions, JournalTaskCounts, WeeklyRenderOptions, WeeklyTaskCounts };

export interface JournalPathPreview {
  dailyNotePath: string;
  weeklyLinkPath: string;
  weeklyLinkFull: string;
}

export interface JournalAPI {
  /** Elemento con las tareas del día (se actualiza solo mientras está en el DOM). Nunca lanza: error → elemento de error. */
  renderTasksForDate(targetDate: string, options?: JournalRenderOptions): Promise<HTMLElement>;
  /** Conteos por grupo (ceros si la fecha es inválida, como v1). */
  getTaskCounts(targetDate: string): Promise<JournalTaskCounts>;
  /** Ruta de la nota diaria según los ajustes (trimestre corregido). Lanza si la fecha es inválida. */
  getDailyNotePath(targetDate: string): string;
  /** `[w::[[ruta|código]]]`. Lanza si el código es inválido. */
  generateWeeklyLink(weekCode: string): string;
  /** Crea base/año/trimestre/mes según los ajustes. Lanza si la fecha es inválida. */
  ensureFolderStructure(targetDate: string): Promise<void>;
  validateJournalSettings(): Promise<ValidationResult>;
  /** Extra v2 (v1 lo tenía en el helper de rutas): ejemplo de rutas para una fecha (def. hoy). */
  getPathPreview(sampleDate?: string): JournalPathPreview;
}

export interface WeeklyAPI {
  renderTasksForWeek(weekCode: string, options?: WeeklyRenderOptions): Promise<HTMLElement>;
  getTaskCounts(weekCode: string): Promise<WeeklyTaskCounts>;
  /** Ruta de la nota semanal: la existente con ese nombre o la de `periodFolderPattern`. */
  getWeeklyNotePath(weekCode: string): string;
  getWeekCodeFromDate(date: string): string;
  getCurrentWeekCode(): string;
  ensureFolderStructure(weekCode: string): Promise<void>;
}

function asObject<T extends object>(v: unknown): Partial<T> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? { ...(v as Partial<T>) } : {};
}

/** Monta una vista de día en `root` (compartido por la API y el bloque ```dovela-dia```). */
export function mountDayView(ctx: DovelaContext, root: HTMLElement, targetDate: string, options: JournalRenderOptions, owned: boolean): ViewHandle {
  root.addClass('journal-tasks-container', 'dovela-journal', 'dovela-jw');
  return mountTaskView(ctx, root, {
    kind: 'journal',
    owned,
    newLeafDefault: false,
    quickActions: options.enableQuickActions === true,
    showContexts: false,
    compute: () => {
      const store = ctx.index.store;
      const c = classifyDay(store.allTasks(), targetDate, store.taskById());
      return { header: { title: dayHeader(targetDate) }, groups: dayGroups(c, options), missingDeps: c.missingDeps, targetDate, emptyText: 'Sin tareas para este día.' };
    },
  });
}

/** Monta una vista semanal en `root` (compartido por la API y el bloque ```dovela-semana```). */
export function mountWeekView(ctx: DovelaContext, root: HTMLElement, weekCode: string, options: WeeklyRenderOptions, owned: boolean): ViewHandle {
  root.addClass('weekly-tasks-container', 'dovela-weekly', 'dovela-jw');
  return mountTaskView(ctx, root, {
    kind: 'weekly',
    owned,
    newLeafDefault: true,
    quickActions: false,
    showContexts: true,
    compute: () => {
      const store = ctx.index.store;
      const c = classifyWeek(store.allTasks(), weekCode, store.taskById());
      const h = weekHeader(c);
      return { header: { title: h.title, subtitle: h.range }, groups: weekGroups(c, options, ctx.today()), missingDeps: c.missingDeps, emptyText: 'Sin tareas para esta semana.' };
    },
  });
}

export function createJournalAPI(ctx: DovelaContext): JournalAPI {
  const settings = () => ctx.settings.value.journal;
  const requireDate = (d: unknown): string => {
    const err = dateInputError(d);
    if (err) throw new Error(err);
    return d as string;
  };
  return {
    renderTasksForDate(targetDate: string, options: JournalRenderOptions = {}): Promise<HTMLElement> {
      const err = dateInputError(targetDate);
      if (err) {
        logger.warn('journalAPI.renderTasksForDate:', err);
        return Promise.resolve(errorElement('journal', err));
      }
      try {
        const root = createDiv();
        mountDayView(ctx, root, targetDate, asObject<JournalRenderOptions>(options), false);
        return Promise.resolve(root);
      } catch (e) {
        logger.error('journalAPI.renderTasksForDate', e);
        return Promise.resolve(errorElement('journal', e instanceof Error ? e.message : String(e)));
      }
    },

    async getTaskCounts(targetDate: string): Promise<JournalTaskCounts> {
      if (dateInputError(targetDate)) return { ...ZERO_JOURNAL_COUNTS };
      try {
        await ctx.index.ready;
        const store = ctx.index.store;
        return dayCounts(classifyDay(store.allTasks(), targetDate, store.taskById()));
      } catch (e) {
        logger.error('journalAPI.getTaskCounts', e);
        return { ...ZERO_JOURNAL_COUNTS };
      }
    },

    getDailyNotePath(targetDate: string): string {
      return dailyNotePath(settings(), requireDate(targetDate));
    },

    generateWeeklyLink(weekCode: string): string {
      return weeklyLink(settings(), String(weekCode));
    },

    async ensureFolderStructure(targetDate: string): Promise<void> {
      await ensureFolders(ctx.app, dailyFolderChain(settings(), requireDate(targetDate)));
    },

    validateJournalSettings(): Promise<ValidationResult> {
      try {
        return Promise.resolve(validateBaseFolderPath(settings().baseFolderPath, (p) => pathKind(ctx.app, p)));
      } catch (e) {
        return Promise.resolve({ valid: false, message: `Error validando la ruta: ${e instanceof Error ? e.message : String(e)}` });
      }
    },

    getPathPreview(sampleDate?: string): JournalPathPreview {
      const date = sampleDate === undefined ? ctx.today() : requireDate(sampleDate);
      const week = formatWeekCode(isoWeekOf(date));
      return { dailyNotePath: dailyNotePath(settings(), date), weeklyLinkPath: weeklyLinkPath(settings(), week), weeklyLinkFull: weeklyLink(settings(), week) };
    },
  };
}

export function createWeeklyAPI(ctx: DovelaContext): WeeklyAPI {
  const settings = () => ctx.settings.value.journal;

  /** Nota existente con ese nombre (`2025-W43` o tal como se escribió) para no romper enlaces (02 §9.1). */
  const existingWeekNote = (code: string, raw: string): string | null => {
    for (const name of new Set([code, raw.trim()])) {
      const f = ctx.app.metadataCache.getFirstLinkpathDest(name, '');
      if (f && f.basename === name) return f.path;
    }
    return null;
  };

  const getWeeklyNotePath = (weekCode: string): string => {
    const code = normalizeWeekInput(weekCode);
    const found = existingWeekNote(code, String(weekCode));
    if (found) return found;
    const w = parseWeekCode(code);
    if (!w) throw new Error(`Formato de semana inválido: ${weekCode}`);
    return periodNotePath(settings(), 'week', isoWeekStart(w.year, w.week));
  };

  return {
    renderTasksForWeek(weekCode: string, options: WeeklyRenderOptions = {}): Promise<HTMLElement> {
      const err = weekInputError(weekCode);
      if (err) {
        logger.warn('weeklyAPI.renderTasksForWeek:', err);
        return Promise.resolve(errorElement('weekly', err));
      }
      try {
        const root = createDiv();
        mountWeekView(ctx, root, weekCode, asObject<WeeklyRenderOptions>(options), false);
        return Promise.resolve(root);
      } catch (e) {
        logger.error('weeklyAPI.renderTasksForWeek', e);
        return Promise.resolve(errorElement('weekly', e instanceof Error ? e.message : String(e)));
      }
    },

    async getTaskCounts(weekCode: string): Promise<WeeklyTaskCounts> {
      if (weekInputError(weekCode)) return { ...ZERO_WEEKLY_COUNTS };
      try {
        await ctx.index.ready;
        const store = ctx.index.store;
        return weekCounts(classifyWeek(store.allTasks(), weekCode, store.taskById()));
      } catch (e) {
        logger.error('weeklyAPI.getTaskCounts', e);
        return { ...ZERO_WEEKLY_COUNTS };
      }
    },

    getWeeklyNotePath,

    getWeekCodeFromDate(date: string): string {
      const err = dateInputError(date);
      if (err) throw new Error(err);
      return formatWeekCode(isoWeekOf(date));
    },

    getCurrentWeekCode(): string {
      return formatWeekCode(isoWeekOf(ctx.today()));
    },

    async ensureFolderStructure(weekCode: string): Promise<void> {
      await ensureFolders(ctx.app, folderChain(parentFolder(getWeeklyNotePath(weekCode))));
    },
  };
}
