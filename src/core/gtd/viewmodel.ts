/**
 * View-models puros del Dashboard GTD / Foco: secciones de listas (y navegación rápida derivada de ellas),
 * Agenda de Hoy, agrupación de Vencidas, breadcrumbs, jerarquía y búsqueda en el árbol.
 */
import {
  AGENDA_TODAY, LIST_META, LIST_ORDER, anchorId, listSize, sublistIcon, sublistLabel,
  type GtdLists, type ListId,
} from './classify';
import type { NoteRecord } from '../index/store';
import type { NoteInfo, TreeNode } from '../notes/hierarchy';
import type { Task } from '../tasks/model';
import { isOpen } from '../tasks/model';

// ───────────────────────── Agenda de Hoy ─────────────────────────

/** Minutos de una cita: fin−inicio (cruzando medianoche), si no duración, si no 30 (v1). */
export function appointmentMinutes(t: Task): number {
  if (t.startMinutes !== undefined && t.endMinutes !== undefined) {
    let d = t.endMinutes - t.startMinutes;
    if (d < 0) d += 24 * 60;
    return d;
  }
  if (t.durationMinutes) return t.durationMinutes;
  return 30;
}

/** Formato de v1 para el total de la agenda: `2h 15min`, `2h`, `45min`. */
export function formatAgendaMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}min` : `${h}h`;
  return `${m}min`;
}

export function agendaSummary(tasks: readonly Task[]): string {
  const minutes = tasks.reduce((s, t) => s + appointmentMinutes(t), 0);
  return `${tasks.length} citas - ${formatAgendaMinutes(minutes)}`;
}

// ───────────────────────── Secciones ─────────────────────────

export interface TaskGroup {
  readonly key: string;
  readonly label: string;
  readonly icon: string;
  readonly anchor: string;
  readonly tasks: readonly Task[];
  /** Texto de contador (p. ej. "3 citas - 1h 30min"); por defecto el número de tareas. */
  readonly countLabel: string;
}

export interface OverdueGroup {
  readonly key: string;
  readonly label: string;
  readonly anchor: string;
  readonly count: number;
  readonly children: readonly TaskGroup[];
}

export interface GtdSection {
  readonly id: ListId;
  readonly name: string;
  readonly icon: string;
  readonly anchor: string;
  /** Entradas (como v1: una tarea en 2 sublistas cuenta 2). */
  readonly count: number;
  readonly flat?: readonly Task[];
  readonly groups?: readonly TaskGroup[];
  readonly overdue?: readonly OverdueGroup[];
}

const locale = (a: string, b: string): number => a.localeCompare(b, 'es');

export function sectionAnchor(id: ListId): string {
  return `gtd-list-${anchorId(LIST_META[id].name)}`;
}

export function groupAnchor(id: ListId, key: string): string {
  return `gtd-sub-${anchorId(id)}-${anchorId(key)}`;
}

/** Separa una clave compuesta de Vencidas en (primaria, secundaria). */
export function splitOverdueKey(key: string): [string, string] {
  const i = key.indexOf('|');
  return i < 0 ? [key, ''] : [key.slice(0, i), key.slice(i + 1)];
}

/** Árbol de Vencidas: primarias por fecha ascendente (📅…) o alfabéticas; secundarias alfabéticas. */
export function overdueGroups(map: ReadonlyMap<string, readonly Task[]>): OverdueGroup[] {
  const byPrimary = new Map<string, Array<[string, readonly Task[]]>>();
  for (const [key, tasks] of map) {
    const [p, s] = splitOverdueKey(key);
    const arr = byPrimary.get(p);
    if (arr) arr.push([s, tasks]);
    else byPrimary.set(p, [[s, tasks]]);
  }
  const primaries = [...byPrimary.keys()].sort((a, b) => {
    const da = a.startsWith('📅');
    const db = b.startsWith('📅');
    if (da && db) return a < b ? -1 : a > b ? 1 : 0; // fechas ISO: orden de texto = cronológico
    if (da !== db) return da ? -1 : 1;
    return locale(a, b);
  });
  return primaries.map((p) => {
    const subs = (byPrimary.get(p) ?? []).sort(([a], [b]) => locale(a, b));
    const children: TaskGroup[] = subs.map(([s, tasks]) => ({
      key: `${p}|${s}`,
      label: sublistLabel(s),
      icon: s.startsWith('px-') ? '👤' : s.startsWith('cx-') ? '📋' : '📅',
      anchor: groupAnchor('overdue', `${p}|${s}`),
      tasks,
      countLabel: String(tasks.length),
    }));
    const label = p.replace(/^(📋|👤) (cx-|px-)/, '$1 ');
    return { key: p, label, anchor: groupAnchor('overdue', p), count: children.reduce((n, c) => n + c.tasks.length, 0), children };
  });
}

function mapGroups(id: ListId, m: ReadonlyMap<string, readonly Task[]>): TaskGroup[] {
  const keys = [...m.keys()].sort(locale);
  if (id === 'hopeToday' && keys.includes(AGENDA_TODAY)) {
    keys.splice(keys.indexOf(AGENDA_TODAY), 1);
    keys.unshift(AGENDA_TODAY);
  }
  return keys.map((key) => {
    const tasks = m.get(key) ?? [];
    const agenda = key === AGENDA_TODAY;
    return {
      key,
      label: agenda ? key : sublistLabel(key),
      icon: agenda ? '' : sublistIcon(key),
      anchor: groupAnchor(id, key),
      tasks,
      countLabel: agenda ? agendaSummary(tasks) : String(tasks.length),
    };
  });
}

/** Secciones en el orden de navegación de v1; las vacías no se emiten. */
export function buildSections(lists: GtdLists): GtdSection[] {
  const out: GtdSection[] = [];
  for (const id of LIST_ORDER) {
    const { entries } = listSize(lists, id);
    if (entries === 0) continue;
    const meta = LIST_META[id];
    const base = { id, name: meta.name, icon: meta.icon, anchor: sectionAnchor(id), count: entries };
    const v = lists[id];
    if (Array.isArray(v)) out.push({ ...base, flat: v });
    else if (id === 'overdue') out.push({ ...base, overdue: overdueGroups(v) });
    else out.push({ ...base, groups: mapGroups(id, v) });
  }
  return out;
}

// ───────────────────────── Breadcrumbs ─────────────────────────

/**
 * Camino de origen de una tarea derivado de la ruta (v1 `createTaskBreadcrumbMap`, RI-D §6.1 T1/T2):
 * `Vault > carpeta > … > nota`; la nota‑carpeta (`X/X.md`) no repite el nombre de su carpeta.
 */
export function taskBreadcrumb(path: string): string {
  const parts = path.replace(/\.md$/i, '').split('/').filter(Boolean);
  if (parts.length >= 2 && parts[parts.length - 1] === parts[parts.length - 2]) parts.pop();
  return ['Vault', ...parts].join(' > ');
}

// ───────────────────────── Jerarquía ─────────────────────────

export function noteInfoFromRecord(r: NoteRecord): NoteInfo {
  let open = 0;
  let inProgress = 0;
  for (const t of r.tasks) {
    if (isOpen(t)) open++;
    if (t.status === 'in-progress') inProgress++;
  }
  return { path: r.path, type: r.type, estado: r.estado, ctime: r.ctime, openTasks: open, inProgressTasks: inProgress };
}

export function noteInfosFromRecords(records: Iterable<NoteRecord>): NoteInfo[] {
  const out: NoteInfo[] = [];
  for (const r of records) out.push(noteInfoFromRecord(r));
  return out;
}

const TYPE_ICONS: Readonly<Record<string, string>> = {
  Root: '🏛️', GrupoAV: '🗂️', AV: '💡', AI: '🧠', PQ: '🎯', PGTD: '📂', Cp: '📣', EMkt: '📣', RR: '🔁', RC: '🔁',
  Ax: '📄', Btx: '📓', Cmt: '💬', Podx: '🎧', Prx: '📑', Tx: '💰', Reu: '👥', Ref: '📚', Rf: '📚', Sue: '💤',
  Vx: '🎬', RT: '⏱️', RL: '📋', Dly: '📅', Wly: '🗓️', Mly: '🗓️', Qly: '🗓️', Hly: '🗓️', Yly: '🗓️',
};

export function typeIcon(type: string, missing = false): string {
  if (missing) return '❓';
  return TYPE_ICONS[type] ?? '📄';
}

/** Ids de nodos con hijos (para "Expandir todo"). */
export function expandableIds(root: TreeNode): string[] {
  const out: string[] = [];
  const walk = (n: TreeNode): void => {
    for (const c of n.children) {
      if (c.children.length) {
        out.push(c.id);
        walk(c);
      }
    }
  };
  walk(root);
  return out;
}

/** Ids abiertos por defecto (v1: niveles 0 y 1 abiertos). */
export function defaultOpenIds(root: TreeNode, maxLevel = 2): string[] {
  const out: string[] = [];
  const walk = (n: TreeNode, level: number): void => {
    for (const c of n.children) {
      if (c.children.length && level < maxLevel) {
        out.push(c.id);
        walk(c, level + 1);
      }
    }
  };
  walk(root, 0);
  return out;
}

/** Rutas reales (no marcadores) del árbol, para la búsqueda por contenido. */
export function treePaths(root: TreeNode): string[] {
  const out: string[] = [];
  const walk = (n: TreeNode): void => {
    if (n.path) out.push(n.path);
    n.children.forEach(walk);
  };
  walk(root);
  return out;
}

export interface TreeSearchResult {
  /** Nodos a mostrar: coincidencias y sus ancestros. */
  readonly visible: ReadonlySet<string>;
  /** Ancestros de coincidencias (se abren). */
  readonly expand: ReadonlySet<string>;
  readonly titleMatches: ReadonlySet<string>;
  readonly contentMatches: ReadonlySet<string>;
}

/** Búsqueda en el árbol por título (subcadena) y, opcionalmente, por rutas cuyo contenido coincide. */
export function searchTree(root: TreeNode, term: string, contentPaths?: ReadonlySet<string>): TreeSearchResult {
  const q = term.trim().toLocaleLowerCase('es');
  const visible = new Set<string>();
  const expand = new Set<string>();
  const titleMatches = new Set<string>();
  const contentMatches = new Set<string>();
  const walk = (n: TreeNode): boolean => {
    let any = false;
    for (const c of n.children) {
      const name = c.name.replace(/^\[FALTA\] /, '').toLocaleLowerCase('es');
      let match = false;
      if (q && name.includes(q)) {
        titleMatches.add(c.id);
        match = true;
      } else if (c.path && contentPaths?.has(c.path)) {
        contentMatches.add(c.id);
        match = true;
      }
      const childAny = walk(c);
      if (childAny) expand.add(c.id);
      if (match || childAny) {
        visible.add(c.id);
        any = true;
      }
    }
    return any;
  };
  if (q || contentPaths?.size) walk(root);
  return { visible, expand, titleMatches, contentMatches };
}
