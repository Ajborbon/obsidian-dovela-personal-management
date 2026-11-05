/**
 * Clasificador PURO de la vista semanal (Weekly). Reproduce `processTasksForWeek` y
 * `generateWeeklyHTML` de v1 (RI-E §4.4–4.5): mismos grupos, títulos y orden, con correcciones:
 * - rango de la semana anclado al 4 de enero (v1 dependía del día actual, RI-E §8.2 W10);
 * - semanas `[w::]` normalizadas y comparadas como (año ISO, número);
 * - prioridad mostrada tal cual se escribió;
 * - "Completadas esta Semana" por el campo `done` del parser;
 * - `showOverdueLimit` informa las tareas ocultas en ambas listas de vencidas (como v1).
 */
import { addDays, compareWeeks, isValidYmd, isoWeekEnd, isoWeekStart, isoWeekday, monthNameEs, parseWeekCode, parseYmd } from '../dates';
import type { Task } from '../tasks/model';
import {
  applyLimit, byDateTypePriority, byPriority, byTimePriority, byTypePriority, byWeekPriority,
  dependencyState, sorted, taskIdMap, type TaskGroup,
} from './common';

export interface WeeklyRenderOptions {
  /** Máximo de tareas por lista de vencidas (por defecto sin límite, como v1). */
  showOverdueLimit?: number;
  /** "Completadas esta Semana" plegado al inicio (def. true). */
  showCompletedCollapsed?: boolean;
  /** Resalta el día actual con `📍 Hoy` (def. true). */
  highlightToday?: boolean;
}

export const DAY_NAMES_CAP = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;
export const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export interface WeekClassification {
  /** Código tal como se recibió (recortado), para el encabezado. */
  readonly weekCode: string;
  readonly year: number;
  readonly week: number;
  /** Lunes y domingo (YYYY-MM-DD). */
  readonly start: string;
  readonly end: string;
  readonly weekly: readonly Task[];
  readonly overdueByDate: readonly Task[];
  /** 7 listas, lunes → domingo. */
  readonly days: readonly (readonly Task[])[];
  readonly overdueWeekly: readonly Task[];
  readonly completed: readonly Task[];
  readonly missingDeps: ReadonlyMap<string, readonly string[]>;
}

/** Conteos de `weeklyAPI.getTaskCounts` (claves de v1 + `overdueByDate`). */
export interface WeeklyTaskCounts {
  weekly: number;
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
  /** Como v1: solo "🔥 Tareas Vencidas de Semanas Anteriores". */
  overdue: number;
  completed: number;
  /** Nuevo en v2: "🔥 Tareas Vencidas por Fecha" (v1 no la contaba). */
  overdueByDate: number;
}

export const ZERO_WEEKLY_COUNTS: Readonly<WeeklyTaskCounts> = Object.freeze({
  weekly: 0, monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0,
  overdue: 0, completed: 0, overdueByDate: 0,
});

export function classifyWeek(all: readonly Task[], weekCode: string, byIdIn?: ReadonlyMap<string, Task>): WeekClassification {
  const w = parseWeekCode(weekCode);
  if (!w) throw new Error(`Formato de semana inválido: ${weekCode}. Use YYYY-W## (ej: 2025-W43)`);
  const byId = taskIdMap(all, byIdIn);
  const start = isoWeekStart(w.year, w.week);
  const end = isoWeekEnd(w.year, w.week);
  const weekly: Task[] = [];
  const overdueByDate: Task[] = [];
  const days: Task[][] = [[], [], [], [], [], [], []];
  const overdueWeekly: Task[] = [];
  const completed: Task[] = [];
  const missingDeps = new Map<string, readonly string[]>();
  const inRange = (d: string): boolean => d >= start && d <= end;

  for (const t of all) {
    // 1. Completada dentro de la semana.
    if (t.status === 'done') {
      if (t.done && isValidYmd(t.done) && inRange(t.done)) completed.push(t);
      continue;
    }
    if (t.status !== 'open' && t.status !== 'in-progress') continue;
    const deps = dependencyState(t, byId);
    if (deps.missing.length) missingDeps.set(t.key, deps.missing);

    // 2. Semana planificada: la fecha se ignora (como v1).
    if (t.week) {
      const tw = parseWeekCode(t.week);
      if (tw) {
        const c = compareWeeks(tw, w);
        if (c === 0) weekly.push(t);
        else if (c < 0) overdueWeekly.push(t);
      }
      continue;
    }
    // 3. Fecha principal.
    if (t.date && isValidYmd(t.date)) {
      if (inRange(t.date)) days[isoWeekday(t.date) - 1]?.push(t);
      else if (t.date < start && (t.dateSymbol === '📅' || t.dateSymbol === '⏳')) overdueByDate.push(t);
    }
  }

  const byTypePriorityTime = (a: Task, b: Task): number => byTypePriority(a, b) || byTimePriority(a, b);
  return {
    weekCode: weekCode.trim(),
    year: w.year,
    week: w.week,
    start,
    end,
    weekly: sorted(weekly, byPriority),
    overdueByDate: sorted(overdueByDate, byDateTypePriority),
    days: days.map((d) => sorted(d, byTypePriorityTime)),
    overdueWeekly: sorted(overdueWeekly, byWeekPriority),
    completed: sorted(completed, (a, b) => ((a.done ?? '') < (b.done ?? '') ? -1 : (a.done ?? '') > (b.done ?? '') ? 1 : 0)),
    missingDeps,
  };
}

/** `20 de octubre - 26 de octubre, 2025` (como `D [de] MMMM` en locale es). */
export function weekRangeLabel(start: string, end: string): string {
  const a = parseYmd(start);
  const b = parseYmd(end);
  if (!a || !b) return '';
  return `${a.d} de ${monthNameEs(a.m)} - ${b.d} de ${monthNameEs(b.m)}, ${b.y}`;
}

export function weekHeader(c: WeekClassification): { title: string; range: string } {
  return { title: `Semana ${c.weekCode}`, range: weekRangeLabel(c.start, c.end) };
}

/**
 * Grupos en el orden de v1: Semanales → Vencidas por Fecha → Tareas por Día →
 * Vencidas de Semanas Anteriores → Completadas. `today` decide el día resaltado.
 */
export function weekGroups(c: WeekClassification, opts: WeeklyRenderOptions = {}, today?: string): TaskGroup[] {
  const groups: TaskGroup[] = [];
  const limit = opts.showOverdueLimit && opts.showOverdueLimit > 0 ? Math.floor(opts.showOverdueLimit) : undefined;
  const highlight = opts.highlightToday ?? true;

  if (c.weekly.length) {
    groups.push({ id: 'weekly', title: `📊 Tareas Semanales (${c.weekly.length})`, total: c.weekly.length, tasks: c.weekly, hidden: 0, open: true });
  }
  if (c.overdueByDate.length) {
    const { shown, hidden } = applyLimit(c.overdueByDate, limit);
    groups.push({ id: 'overdue-date', title: `🔥 Tareas Vencidas por Fecha (${c.overdueByDate.length})`, total: c.overdueByDate.length, tasks: shown, hidden, open: true, tone: 'overdue' });
  }
  // "Tareas por Día" siempre se emite (v1 pintaba el encabezado aunque no hubiera tareas).
  const subgroups = c.days
    .map((tasks, i) => {
      const date = addDays(c.start, i);
      const isToday = highlight && today === date;
      return {
        id: `day-${DAY_KEYS[i] ?? i}`,
        title: `${DAY_NAMES_CAP[i] ?? ''} ${Number(date.slice(8, 10))}${isToday ? ' 📍 Hoy' : ''}`,
        tasks,
        ...(isToday ? { highlight: true } : {}),
      };
    })
    .filter((s) => s.tasks.length > 0);
  const dayTotal = c.days.reduce((n, d) => n + d.length, 0);
  groups.push({ id: 'days', title: '📅 Tareas por Día', total: dayTotal, tasks: [], subgroups, hidden: 0, open: true });

  if (c.overdueWeekly.length) {
    const { shown, hidden } = applyLimit(c.overdueWeekly, limit);
    groups.push({ id: 'overdue-weeks', title: `🔥 Tareas Vencidas de Semanas Anteriores (${c.overdueWeekly.length})`, total: c.overdueWeekly.length, tasks: shown, hidden, open: true, tone: 'overdue' });
  }
  if (c.completed.length) {
    groups.push({
      id: 'completed', title: `✅ Completadas esta Semana (${c.completed.length})`, total: c.completed.length,
      tasks: c.completed, hidden: 0, open: !(opts.showCompletedCollapsed ?? true), tone: 'done',
    });
  }
  return groups;
}

export function weekCounts(c: WeekClassification): WeeklyTaskCounts {
  const d = (i: number): number => c.days[i]?.length ?? 0;
  return {
    weekly: c.weekly.length,
    monday: d(0), tuesday: d(1), wednesday: d(2), thursday: d(3), friday: d(4), saturday: d(5), sunday: d(6),
    overdue: c.overdueWeekly.length,
    completed: c.completed.length,
    overdueByDate: c.overdueByDate.length,
  };
}
