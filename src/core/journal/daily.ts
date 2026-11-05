/**
 * Clasificador PURO de la vista diaria (Journal). Reproduce `processTasksForDate` y
 * `generateJournalHTML` de v1 (RI-E §3.5–3.6): mismos grupos, títulos, orden y estado
 * abierto/cerrado, con estas correcciones documentadas:
 * - semanas ISO correctas (v1: `moment().year(Y).isoWeek(W)` dependía de hoy);
 * - dependencias normalizadas (`⛔ ^id` ya no queda bloqueada siempre) e ids inexistentes no bloquean;
 * - calendario ordenado por hora numérica (v1: por cadena);
 * - prioridad mostrada tal cual se escribió (v1 desplazaba ⏫→🔺);
 * - "Completadas Hoy" por el campo `done` (`✅ fecha`) del parser;
 * - `showOverdueLimit` (def. 50) respetado e informado (`… y N tareas más`);
 * - opciones declaradas sin efecto en v1 implementadas: `groupOverdueByWeek`, `showOnlyCritical`
 *   (aquí) y `enableQuickActions` (en la capa de UI).
 */
import { isValidYmd, isoWeekOf, compareWeeks, parseWeekCode, weekdayNameEs } from '../dates';
import type { Task } from '../tasks/model';
import {
  applyLimit, byDateTypePriority, byPriority, byTimePriority, byTypePriority, byWeekPriority,
  dependencyState, groupByIsoWeek, sorted, taskIdMap, type TaskGroup,
} from './common';

export interface JournalRenderOptions {
  /** Máximo de vencidas a mostrar (v1: `|| 50`). El título cuenta todas. */
  showOverdueLimit?: number;
  /** Subagrupa "Vencidas a Hoy" por semana ISO de su fecha. */
  groupOverdueByWeek?: boolean;
  /** Solo 🔺/⏫ en "Vencidas a Hoy". */
  showOnlyCritical?: boolean;
  /** Botones rápidos por tarea (🔄 en progreso / ⏸ pausar). Lo aplica la UI. */
  enableQuickActions?: boolean;
}

export const DEFAULT_OVERDUE_LIMIT = 50;

export interface DayClassification {
  readonly targetDate: string;
  readonly calendar: readonly Task[];
  readonly programmed: readonly Task[];
  readonly thisWeek: readonly Task[];
  readonly previousWeeks: readonly Task[];
  readonly inProgress: readonly Task[];
  readonly overdue: readonly Task[];
  readonly blocked: readonly Task[];
  readonly completed: readonly Task[];
  /** Ids de dependencia inexistentes por `task.key` (se marcan con ⚠️). */
  readonly missingDeps: ReadonlyMap<string, readonly string[]>;
}

/** Conteos de `journalAPI.getTaskCounts` (mismas claves que v1 + las semanales). */
export interface JournalTaskCounts {
  calendar: number;
  programmed: number;
  overdue: number;
  inProgress: number;
  blocked: number;
  completed: number;
  /** Nuevo en v2: "📊 Tareas para esta Semana". */
  weekly: number;
  /** Nuevo en v2: "🔥📊 Tareas de Semanas Anteriores". */
  weeklyOverdue: number;
}

export const ZERO_JOURNAL_COUNTS: Readonly<JournalTaskCounts> = Object.freeze({
  calendar: 0, programmed: 0, overdue: 0, inProgress: 0, blocked: 0, completed: 0, weekly: 0, weeklyOverdue: 0,
});

/**
 * Clasifica todas las tareas del vault para `targetDate` (YYYY-MM-DD válida).
 * Orden de evaluación de v1 con `continue` al primer match.
 */
export function classifyDay(all: readonly Task[], targetDate: string, byIdIn?: ReadonlyMap<string, Task>): DayClassification {
  if (!isValidYmd(targetDate)) throw new Error(`Formato de fecha inválido: ${targetDate}. Use YYYY-MM-DD`);
  const byId = taskIdMap(all, byIdIn);
  const targetWeek = isoWeekOf(targetDate);
  const calendar: Task[] = [];
  const programmed: Task[] = [];
  const thisWeek: Task[] = [];
  const previousWeeks: Task[] = [];
  const inProgress: Task[] = [];
  const overdue: Task[] = [];
  const blocked: Task[] = [];
  const completed: Task[] = [];
  const missingDeps = new Map<string, readonly string[]>();

  for (const t of all) {
    // 1. Completada en la fecha (por el sello ✅ que extrae el parser).
    if (t.status === 'done') {
      if (t.done === targetDate) completed.push(t);
      continue;
    }
    // 2. Canceladas `[-]` y cualquier otra no abierta: fuera (R9).
    if (t.status !== 'open' && t.status !== 'in-progress') continue;

    const deps = dependencyState(t, byId);
    if (deps.missing.length) missingDeps.set(t.key, deps.missing);

    // 3. En progreso: todas, sin filtro de fecha (como v1).
    if (t.status === 'in-progress') {
      inProgress.push(t);
      continue;
    }
    // 4. Semana planificada `[w::]`: la fecha se ignora (como v1).
    if (t.week) {
      const w = parseWeekCode(t.week);
      if (w) {
        const c = compareWeeks(w, targetWeek);
        if (c === 0) thisWeek.push(t);
        else if (c < 0) previousWeeks.push(t);
      }
      continue;
    }
    // 5. Bloqueadas por dependencias: solo si su fecha es hoy o anterior.
    if (deps.blocked) {
      if (t.date && isValidYmd(t.date) && t.date <= targetDate) blocked.push(t);
      continue;
    }
    // 6. Fecha principal (📅 ⏳ 🛫).
    if (t.date && t.dateSymbol && isValidYmd(t.date)) {
      if (t.date === targetDate) (t.startMinutes !== undefined ? calendar : programmed).push(t);
      else if (t.date < targetDate) overdue.push(t);
    }
  }

  return {
    targetDate,
    calendar: sorted(calendar, byTimePriority),
    programmed: sorted(programmed, byTypePriority),
    thisWeek: sorted(thisWeek, byPriority),
    previousWeeks: sorted(previousWeeks, byWeekPriority),
    inProgress: sorted(inProgress, byDateTypePriority),
    overdue: sorted(overdue, byDateTypePriority),
    blocked: sorted(blocked, byDateTypePriority),
    completed, // orden del vault (ruta, línea), como v1
    missingDeps,
  };
}

/** `📋 Tareas del Día - 2025-10-24 viernes` (día en español fijo; v1 dependía del locale). */
export function dayHeader(targetDate: string): string {
  return `📋 Tareas del Día - ${targetDate} ${weekdayNameEs(targetDate)}`;
}

/** 🔺 y ⏫ (rangos 0 y 1). */
export function isCritical(t: Task): boolean {
  return t.priority.rank <= 1;
}

/** Grupos en el orden y con el estado inicial de v1. Solo se emiten los grupos con tareas. */
export function dayGroups(c: DayClassification, opts: JournalRenderOptions = {}): TaskGroup[] {
  const groups: TaskGroup[] = [];
  const simple = (id: string, title: string, tasks: readonly Task[], open: boolean, tone?: TaskGroup['tone']): void => {
    if (tasks.length === 0) return;
    groups.push({ id, title: `${title} (${tasks.length})`, total: tasks.length, tasks, hidden: 0, open, ...(tone ? { tone } : {}) });
  };

  simple('calendar', '⏰ Calendario del Día', c.calendar, true);
  simple('programmed', '📅⏳🛫 Programadas para Hoy', c.programmed, true);
  simple('week', '📊 Tareas para esta Semana', c.thisWeek, true);
  simple('previous-weeks', '🔥📊 Tareas de Semanas Anteriores', c.previousWeeks, true, 'overdue');
  simple('in-progress', '🔄 En Progreso', c.inProgress, true);

  // Vencidas: límite (def. 50), filtro de críticas y agrupación por semana opcionales.
  const source = opts.showOnlyCritical ? c.overdue.filter(isCritical) : c.overdue;
  if (source.length > 0) {
    const limit = opts.showOverdueLimit && opts.showOverdueLimit > 0 ? Math.floor(opts.showOverdueLimit) : DEFAULT_OVERDUE_LIMIT;
    const { shown, hidden } = applyLimit(source, limit);
    const skipped = c.overdue.length - source.length;
    const base = {
      id: 'overdue',
      title: `🔥 Vencidas a Hoy (${source.length})`,
      total: source.length,
      hidden,
      open: false,
      tone: 'overdue' as const,
      ...(skipped > 0 ? { note: `${skipped} vencidas sin prioridad 🔺/⏫ ocultas (solo críticas)` } : {}),
    };
    if (opts.groupOverdueByWeek) {
      const subgroups = groupByIsoWeek(shown).map((g) => ({ id: `overdue-${g.week}`, title: `📊 ${g.week} (${g.tasks.length})`, tasks: g.tasks }));
      groups.push({ ...base, tasks: [], subgroups });
    } else {
      groups.push({ ...base, tasks: shown });
    }
  }

  simple('blocked', '⛔ Bloqueadas por Dependencias', c.blocked, true, 'blocked');
  simple('completed', '✅ Completadas Hoy', c.completed, false, 'done');
  return groups;
}

export function dayCounts(c: DayClassification): JournalTaskCounts {
  return {
    calendar: c.calendar.length,
    programmed: c.programmed.length,
    overdue: c.overdue.length,
    inProgress: c.inProgress.length,
    blocked: c.blocked.length,
    completed: c.completed.length,
    weekly: c.thisWeek.length,
    weeklyOverdue: c.previousWeeks.length,
  };
}
