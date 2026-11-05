/**
 * Fuentes del Smart Inbox a partir del índice (puro): proyectos/áreas activos para el menú `@`,
 * nombres resolubles para el tokenizador y contextos/personas reales de las tareas.
 */
import type { NoteRecord } from '../index/store';
import { TYPE_ORDER, isActiveEstado, type NoteType } from '../notes/types';
import type { Task } from '../tasks/model';
import type { CountedValue, MenuData, MenuProject } from './menu';
import type { ProjectRef } from './tokenize';

/** Tipos que se ofrecen en `@` (v1: PGTD/AV/AI; se añaden PQ —documentado pero nunca llegaba— y RR). */
export const PROJECT_TYPES: ReadonlySet<NoteType> = new Set<NoteType>(['PGTD', 'AV', 'AI', 'PQ', 'RR']);

export interface ActiveNoteInfo {
  readonly path: string;
  readonly basename: string;
  readonly folder: string;
  /** Tipo detectado si la nota está en el índice. */
  readonly type?: string;
}

type NoteLike = Pick<NoteRecord, 'path' | 'basename' | 'folder' | 'type' | 'estado'>;
type TaskLike = Pick<Task, 'contexts' | 'people'>;

/** Proyectos del menú `@`: nota activa primero (siempre, aunque no haya proyectos 🟢), sin duplicados. */
export function menuProjects(notes: Iterable<NoteLike>, active: ActiveNoteInfo | null): MenuProject[] {
  const list: MenuProject[] = [];
  for (const n of notes) {
    if (!PROJECT_TYPES.has(n.type) || !isActiveEstado(n.estado)) continue;
    if (active && n.path === active.path) continue;
    list.push({ name: n.basename, path: n.path, type: n.type, folder: n.folder, isActiveNote: false });
  }
  list.sort((a, b) => (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99) || a.name.localeCompare(b.name, 'es'));
  if (active) list.unshift({ name: active.basename, path: active.path, type: active.type ?? '', folder: active.folder, isActiveNote: true });
  return list;
}

/** Contextos y personas usados en las tareas, con su frecuencia (sin valores de ejemplo). */
export function countTagValues(tasks: Iterable<TaskLike>): { contexts: CountedValue[]; people: CountedValue[] } {
  const cx = new Map<string, number>();
  const px = new Map<string, number>();
  for (const t of tasks) {
    for (const c of t.contexts) cx.set(c, (cx.get(c) ?? 0) + 1);
    for (const p of t.people) px.set(p, (px.get(p) ?? 0) + 1);
  }
  const toList = (m: Map<string, number>): CountedValue[] =>
    [...m].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'es'));
  return { contexts: toList(cx), people: toList(px) };
}

export function buildMenuData(notes: Iterable<NoteLike>, tasks: Iterable<TaskLike>, active: ActiveNoteInfo | null): MenuData {
  return { projects: menuProjects(notes, active), ...countTagValues(tasks) };
}

/**
 * Nombres resolubles por `@`: la nota activa (rango 0), los proyectos del menú (1) y cualquier otra
 * nota del índice (2; v1 aceptaba cualquier archivo). Ante nombres repetidos gana el rango menor.
 */
export function projectRefs(notes: Iterable<NoteLike>, menu: readonly MenuProject[]): ProjectRef[] {
  const rankByPath = new Map<string, number>();
  for (const p of menu) rankByPath.set(p.path, p.isActiveNote ? 0 : 1);
  const out: ProjectRef[] = [];
  const seen = new Set<string>();
  for (const p of menu) {
    if (seen.has(p.path)) continue;
    seen.add(p.path);
    out.push({ name: p.name, path: p.path, rank: rankByPath.get(p.path) ?? 2 });
  }
  for (const n of notes) {
    if (seen.has(n.path)) continue;
    seen.add(n.path);
    out.push({ name: n.basename, path: n.path, rank: 2 });
  }
  return out;
}
