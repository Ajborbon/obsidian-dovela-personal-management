/** Vista "En Progreso" (v1 `inProgressProcessor.ts`): tareas `[/]`, métricas, agrupación y orden. */
import { compareYmd, isValidYmd } from '../dates';
import type { Task } from '../tasks/model';

export type InProgressGrouping = 'none' | 'context' | 'person' | 'project';
export type InProgressSorting = 'priority' | 'duration-asc' | 'duration-desc';

/** Minutos que se suponen para una tarea en progreso sin duración (v1). */
export const DEFAULT_ESTIMATE_MINUTES = 20;

export interface InProgressStats {
  readonly total: number;
  readonly overdue: number;
  readonly definedMinutes: number;
  readonly estimatedMinutes: number;
}

export interface InProgressData {
  readonly groups: ReadonlyArray<{ readonly name: string; readonly tasks: readonly Task[] }>;
  readonly stats: InProgressStats;
}

export const GROUP_OVERDUE = '🔴 Vencidas';
export const GROUP_DATED = '⭐ Prioridades de Hoy';
export const GROUP_OTHER = 'Otras Tareas';

function isPast(date: string | undefined, today: string): boolean {
  return date !== undefined && isValidYmd(date) && compareYmd(date, today) < 0;
}

/** Grupo de proyecto: primer `PGTD - ` → 📂; último `AI - ` → 🧠; `AV -|PQ -|RR -` más profundo → 🏠; carpeta → 📁. */
export function projectGroupOf(path: string): string {
  const parts = path.split('/');
  const folders = parts.slice(0, -1);
  if (folders.length === 0) return 'Tareas Generales';
  const pgtd = folders.find((f) => f.startsWith('PGTD - ') || /^PGTD \d{6} - /.test(f));
  if (pgtd) return `📂 ${pgtd}`;
  const ai = [...folders].reverse().find((f) => f.startsWith('AI - '));
  if (ai) return `🧠 ${ai}`;
  const other = [...folders].reverse().find((f) => /^(AV|PQ|RR) - /.test(f));
  if (other) return `🏠 ${other}`;
  return `📁 ${folders[folders.length - 1]}`;
}

export function sortInProgress(tasks: Task[], sorting: InProgressSorting): Task[] {
  if (sorting === 'duration-asc') return tasks.sort((a, b) => (a.durationMinutes ?? 9999) - (b.durationMinutes ?? 9999));
  if (sorting === 'duration-desc') return tasks.sort((a, b) => (b.durationMinutes ?? 0) - (a.durationMinutes ?? 0));
  // Prioridad y, a igual prioridad, fecha ascendente con las tareas sin fecha al final (orden total).
  return tasks.sort(
    (a, b) => a.priority.rank - b.priority.rank || compareYmd(a.date ?? '9999-12-31', b.date ?? '9999-12-31'),
  );
}

export function processInProgress(
  all: readonly Task[],
  today: string,
  grouping: InProgressGrouping,
  sorting: InProgressSorting,
): InProgressData {
  const tasks = all.filter((t) => t.status === 'in-progress');
  const definedMinutes = tasks.reduce((s, t) => s + (t.durationMinutes ?? 0), 0);
  const undefinedCount = tasks.filter((t) => !t.durationMinutes).length;
  const stats: InProgressStats = {
    total: tasks.length,
    overdue: tasks.filter((t) => isPast(t.date, today)).length,
    definedMinutes,
    estimatedMinutes: definedMinutes + undefinedCount * DEFAULT_ESTIMATE_MINUTES,
  };

  const map = new Map<string, Task[]>();
  const add = (k: string, t: Task): void => {
    const arr = map.get(k);
    if (arr) arr.push(t);
    else map.set(k, [t]);
  };
  if (grouping === 'none') {
    const overdue = tasks.filter((t) => isPast(t.date, today));
    const dated = tasks.filter((t) => t.date !== undefined && !isPast(t.date, today));
    const other = tasks.filter((t) => t.date === undefined);
    if (overdue.length) map.set(GROUP_OVERDUE, sortInProgress(overdue, 'priority'));
    if (dated.length) map.set(GROUP_DATED, sortInProgress(dated, sorting));
    if (other.length) map.set(GROUP_OTHER, sortInProgress(other, sorting));
  } else {
    for (const t of tasks) {
      if (grouping === 'context') {
        if (t.contexts.length) t.contexts.forEach((c) => add(`@${c}`, t));
        else add('Sin Contexto', t);
      } else if (grouping === 'person') {
        if (t.people.length) t.people.forEach((p) => add(`@${p}`, t));
        else add('Sin Asignar', t);
      } else add(projectGroupOf(t.path), t);
    }
    for (const v of map.values()) sortInProgress(v, sorting);
  }
  return { groups: [...map.entries()].map(([name, ts]) => ({ name, tasks: ts })), stats };
}
