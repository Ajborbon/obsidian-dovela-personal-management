/**
 * Piezas comunes (puras) de las vistas Journal (diaria) y Weekly (semanal):
 * modelo de grupo, comparadores de v1 corregidos, dependencias normalizadas y utilidades.
 * Sin dependencias de Obsidian: todo se prueba con vitest.
 */
import { buildTaskById } from '../gtd/classify';
import { formatWeekCode, isoWeekOf, isValidYmd, parseWeekCode } from '../dates';
import type { DateSymbol, Task } from '../tasks/model';

/** Tono visual de un grupo: decide la clase de las filas (vencida, bloqueada…). */
export type GroupTone = 'overdue' | 'blocked' | 'done';

export interface TaskSubgroup {
  /** Id estable (para conservar abierto/cerrado entre refrescos). */
  readonly id: string;
  readonly title: string;
  readonly tasks: readonly Task[];
  /** Día actual resaltado (Weekly, `highlightToday`). */
  readonly highlight?: boolean;
}

/** Grupo de tareas listo para pintar dentro de un `<details>`. */
export interface TaskGroup {
  /** Id estable (para conservar abierto/cerrado entre refrescos). */
  readonly id: string;
  /** Título idéntico al de v1, con el conteo total entre paréntesis cuando v1 lo mostraba. */
  readonly title: string;
  /** Número total de tareas del grupo (antes de recortar). */
  readonly total: number;
  /** Tareas a mostrar (ya recortadas por límite). Vacío si el grupo usa `subgroups`. */
  readonly tasks: readonly Task[];
  /** Subgrupos (días de la semana, vencidas por semana). */
  readonly subgroups?: readonly TaskSubgroup[];
  /** Tareas no mostradas por el límite (`… y N tareas más`). */
  readonly hidden: number;
  /** Estado inicial del `<details>` (como v1). */
  readonly open: boolean;
  readonly tone?: GroupTone;
  /** Texto informativo adicional (p. ej. tareas ocultas por `showOnlyCritical`). */
  readonly note?: string;
}

/** 📅 due → ⏳ scheduled → 🛫 start (orden de v1). */
export const DATE_TYPE_RANK: Readonly<Record<DateSymbol, number>> = { '📅': 0, '⏳': 1, '🛫': 2 };

export function dateTypeRank(t: Task): number {
  return t.dateSymbol ? DATE_TYPE_RANK[t.dateSymbol] : 3;
}

/** Prioridad: 🔺(0) ⏫(1) 🔼(2) 🔽(3) ⏬(4) ninguna(5). Orden relativo de v1 conservado (R7). */
export function byPriority(a: Task, b: Task): number {
  return a.priority.rank - b.priority.rank;
}

/** Fecha principal ascendente (sin fecha al final) → tipo de fecha → prioridad. Comparador transitivo. */
export function byDateTypePriority(a: Task, b: Task): number {
  const da = a.date && isValidYmd(a.date) ? a.date : '9999-99-99';
  const db = b.date && isValidYmd(b.date) ? b.date : '9999-99-99';
  if (da !== db) return da < db ? -1 : 1;
  return dateTypeRank(a) - dateTypeRank(b) || byPriority(a, b);
}

/** Tipo de fecha → prioridad. */
export function byTypePriority(a: Task, b: Task): number {
  return dateTypeRank(a) - dateTypeRank(b) || byPriority(a, b);
}

/** Hora de inicio NUMÉRICA (v1 comparaba cadenas: `10:00` < `9:00`) → prioridad. */
export function byTimePriority(a: Task, b: Task): number {
  const ma = a.startMinutes ?? 24 * 60;
  const mb = b.startMinutes ?? 24 * 60;
  return ma - mb || byPriority(a, b);
}

/** Semana (año, número) ascendente → prioridad. Tareas sin semana válida al final. */
export function byWeekPriority(a: Task, b: Task): number {
  const wa = a.week ? parseWeekCode(a.week) : null;
  const wb = b.week ? parseWeekCode(b.week) : null;
  if (wa && wb) {
    const c = wa.year - wb.year || wa.week - wb.week;
    if (c !== 0) return c;
  } else if (wa || wb) {
    return wa ? -1 : 1;
  }
  return byPriority(a, b);
}

/** Copia ordenada (estable: a igualdad conserva el orden del vault, ruta y línea). */
export function sorted(tasks: readonly Task[], cmp: (a: Task, b: Task) => number): Task[] {
  return [...tasks].sort(cmp);
}

export interface DependencyState {
  /** Alguna dependencia existente sigue abierta (`[ ]`/`[/]`). */
  readonly blocked: boolean;
  /** Ids de dependencia que no existen en el vault (no bloquean; se avisa con ⚠️). */
  readonly missing: readonly string[];
}

const NO_DEPS: DependencyState = { blocked: false, missing: [] };

/**
 * Estado de dependencias. Los ids ya vienen normalizados sin `^` (R3), así que
 * `⛔ ^abc` se resuelve contra `🆔 abc`/`^abc` (en v1 Journal quedaba bloqueada siempre).
 * Un id inexistente NO bloquea (02 §9.8) y una dependencia cancelada cuenta como resuelta.
 */
export function dependencyState(t: Task, byId: ReadonlyMap<string, Task>): DependencyState {
  if (t.dependencies.length === 0) return NO_DEPS;
  let blocked = false;
  const missing: string[] = [];
  for (const id of t.dependencies) {
    const dep = byId.get(id);
    if (!dep) missing.push(id);
    else if (dep !== t && (dep.status === 'open' || dep.status === 'in-progress')) blocked = true;
  }
  return { blocked, missing };
}

/** Mapa id → tarea (primer id gana), reutilizando el del clasificador GTD. */
export function taskIdMap(all: readonly Task[], byId?: ReadonlyMap<string, Task>): ReadonlyMap<string, Task> {
  return byId ?? buildTaskById(all);
}

/** Recorta una lista a `limit` (si es > 0). */
export function applyLimit(tasks: readonly Task[], limit: number | undefined): { shown: Task[]; hidden: number } {
  if (!limit || limit <= 0 || tasks.length <= limit) return { shown: [...tasks], hidden: 0 };
  return { shown: tasks.slice(0, limit), hidden: tasks.length - limit };
}

/** Agrupa (conservando el orden de entrada) por la semana ISO de la fecha principal. */
export function groupByIsoWeek(tasks: readonly Task[]): { week: string; tasks: Task[] }[] {
  const out = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = t.date && isValidYmd(t.date) ? formatWeekCode(isoWeekOf(t.date)) : 'Sin fecha';
    const arr = out.get(key);
    if (arr) arr.push(t);
    else out.set(key, [t]);
  }
  return [...out.entries()].map(([week, ts]) => ({ week, tasks: ts }));
}

/** Firma de un conjunto de grupos para no reconstruir el DOM si nada cambió. */
export function groupsSignature(groups: readonly TaskGroup[], extra = ''): string {
  const parts: string[] = [extra];
  const rows = (ts: readonly Task[]): void => {
    for (const t of ts) parts.push(`${t.key}\u0001${t.raw}`);
  };
  for (const g of groups) {
    parts.push(`#${g.id}|${g.title}|${g.hidden}|${g.note ?? ''}`);
    rows(g.tasks);
    for (const s of g.subgroups ?? []) {
      parts.push(`##${s.id}|${s.title}|${s.highlight ? 1 : 0}`);
      rows(s.tasks);
    }
  }
  return parts.join('\u0002');
}

const DONE_LINE_RE = /^(\s*-\s+\[)[xX](\]\s.*)$/u;
const DONE_STAMP_RE = /\s*✅️?\s*\d{4}-\d{2}-\d{2}/u;

/**
 * Reabre una tarea completada (`[x]` → `[ ]`) y quita su sello `✅ fecha`.
 * Devuelve null si la línea no es una tarea completada. Se usa al desmarcar una casilla en
 * "Completadas Hoy/esta Semana".
 */
export function reopenDoneLine(line: string): string | null {
  const raw = line.replace(/\r$/, '');
  const m = DONE_LINE_RE.exec(raw);
  if (!m) return null;
  return `${m[1]} ${(m[2] ?? '').replace(DONE_STAMP_RE, '')}`;
}
