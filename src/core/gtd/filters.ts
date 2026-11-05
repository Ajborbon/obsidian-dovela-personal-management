/**
 * Filtros del Dashboard aplicados SOBRE LOS DATOS (v1 filtraba el DOM con `JSON.parse` por tarea y tecla).
 * - Contexto / persona: coincidencia exacta del valor (sin distinguir mayúsculas; acepta `#cx-`, `cx-`, `@`).
 * - Texto: subcadena sin distinguir mayúsculas sobre el texto visible de la tarea.
 */
import type { GtdLists } from './classify';
import type { Task } from '../tasks/model';

export interface GtdFilter {
  readonly context: string;
  readonly person: string;
  readonly text: string;
}

export const EMPTY_FILTER: GtdFilter = { context: '', person: '', text: '' };

const fold = (s: string): string => s.trim().toLocaleLowerCase('es');

/** `#cx-Casa`, `cx-Casa`, `@Casa`, ` casa ` → `casa`. */
export function normalizeFilterValue(v: string, kind: 'cx' | 'px'): string {
  let s = v.trim().replace(/^[#@]/, '');
  if (s.toLowerCase().startsWith(`${kind}-`)) s = s.slice(3);
  return fold(s);
}

export function activeFilterCount(f: GtdFilter): number {
  return (f.context.trim() ? 1 : 0) + (f.person.trim() ? 1 : 0) + (f.text.trim() ? 1 : 0);
}

export function isFilterActive(f: GtdFilter): boolean {
  return activeFilterCount(f) > 0;
}

/** Compila el filtro una vez (evita normalizar en cada tarea). */
export function taskFilter(f: GtdFilter): (t: Task) => boolean {
  const cx = normalizeFilterValue(f.context, 'cx');
  const px = normalizeFilterValue(f.person, 'px');
  const text = fold(f.text);
  return (t) => {
    if (cx && !t.contexts.some((c) => fold(c) === cx)) return false;
    if (px && !t.people.some((p) => fold(p) === px)) return false;
    if (text && !fold(t.text || t.raw).includes(text)) return false;
    return true;
  };
}

function filterMap(m: ReadonlyMap<string, Task[]>, keep: (t: Task) => boolean): Map<string, Task[]> {
  const out = new Map<string, Task[]>();
  for (const [k, v] of m) {
    const arr = v.filter(keep);
    if (arr.length) out.set(k, arr);
  }
  return out;
}

/** Listas filtradas (sublistas vacías eliminadas). Sin filtro activo devuelve las mismas listas. */
export function filterLists(lists: GtdLists, f: GtdFilter): GtdLists {
  if (!isFilterActive(f)) return lists;
  const keep = taskFilter(f);
  return {
    inbox: lists.inbox.filter(keep),
    calendar: lists.calendar.filter(keep),
    projects: lists.projects.filter(keep),
    someday: lists.someday.filter(keep),
    thisWeekNot: lists.thisWeekNot.filter(keep),
    paused: lists.paused.filter(keep),
    nextActions: filterMap(lists.nextActions, keep),
    hopeToday: filterMap(lists.hopeToday, keep),
    assigned: filterMap(lists.assigned, keep),
    overdue: filterMap(lists.overdue, keep),
  };
}

/** Tareas únicas presentes en alguna lista (por `key`): el "contador sin duplicados". */
export function uniqueTaskCount(lists: GtdLists): number {
  const keys = new Set<string>();
  for (const v of Object.values(lists) as Array<Task[] | Map<string, Task[]>>) {
    if (Array.isArray(v)) v.forEach((t) => keys.add(t.key));
    else for (const arr of v.values()) arr.forEach((t) => keys.add(t.key));
  }
  return keys.size;
}

/** Texto del contador global: total de abiertas, o filtradas sobre el total. */
export function totalLabel(lists: GtdLists, totalOpen: number, f: GtdFilter): string {
  if (!isFilterActive(f)) return `Total de Tareas Abiertas: ${totalOpen}`;
  return `Tareas filtradas: ${uniqueTaskCount(lists)} (de ${totalOpen})`;
}
