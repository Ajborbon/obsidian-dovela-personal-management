/**
 * Ordenamientos de Backlinks y su máquina de estados (pura). RI-D §2.5 y §6.3 (S1–S11).
 *
 * v1 tenía `column` (0 Archivo, 1 Tipo, 2 Estado, 3 Ruta, -1 ninguna) + `dateSort`; aquí se unifica en una
 * sola clave. Ordenar por "Ruta" muestra el árbol de carpetas (como en v1) y el doble clic en "Ruta" alterna el
 * modo expandido.
 */
import type { BacklinkEntry } from './detect';

export type SortKey = 'name' | 'type' | 'estado' | 'path' | 'ctime' | 'mtime';
export type SortDir = 'asc' | 'desc';

export const SORT_KEYS: readonly SortKey[] = ['name', 'type', 'estado', 'path', 'ctime', 'mtime'];
export const COLUMN_KEYS: readonly SortKey[] = ['name', 'type', 'estado', 'path'];
export const DATE_KEYS: readonly SortKey[] = ['ctime', 'mtime'];

/** Ventana de doble clic de v1 (`DOUBLE_CLICK_DELAY`). */
export const DOUBLE_CLICK_MS = 800;

export interface SortState {
  readonly key: SortKey;
  readonly dir: SortDir;
  /** Árbol con todas las notas de la carpeta actual y subcarpetas (📋). */
  readonly expandedTree: boolean;
  /** Último clic (para detectar doble clic). No se persiste. */
  readonly lastClick: { readonly key: SortKey; readonly at: number } | null;
}

/** Por defecto de v1: creación descendente. */
export const DEFAULT_SORT: SortState = { key: 'ctime', dir: 'desc', expandedTree: false, lastClick: null };

export function isDateKey(k: SortKey): boolean {
  return k === 'ctime' || k === 'mtime';
}

const collator = (a: string, b: string): number => a.toLowerCase().localeCompare(b.toLowerCase());

function compareBy(key: SortKey): (a: BacklinkEntry, b: BacklinkEntry) => number {
  switch (key) {
    case 'name':
      return (a, b) => collator(a.basename, b.basename);
    case 'type':
      return (a, b) => collator(a.typeLabel, b.typeLabel);
    case 'estado':
      return (a, b) => collator(a.estado, b.estado);
    case 'path':
      return (a, b) => collator(a.folder, b.folder);
    case 'ctime':
      return (a, b) => a.ctime - b.ctime;
    case 'mtime':
      return (a, b) => a.mtime - b.mtime;
  }
}

/** Ordena una COPIA (no muta). Estable: los empates conservan el orden de entrada. Clave desconocida → copia sin cambios. */
export function sortBacklinks(entries: readonly BacklinkEntry[], key: SortKey, dir: SortDir): BacklinkEntry[] {
  const copy = [...entries];
  if (!SORT_KEYS.includes(key)) return copy;
  const cmp = compareBy(key);
  const sign = dir === 'desc' ? -1 : 1;
  return copy.sort((a, b) => sign * cmp(a, b));
}

/**
 * Transición al pulsar un botón de orden en el instante `at` (ms).
 * - Columna (archivo/tipo/estado/ruta): la misma columna alterna asc↔desc; otra columna empieza en asc.
 * - Fecha: otra fecha empieza en desc; la misma fecha solo invierte con doble clic (< 800 ms); clic simple no cambia.
 * - Doble clic en "Ruta" alterna además el modo expandido del árbol.
 */
export function nextSortState(state: SortState, key: SortKey, at: number): SortState {
  const isDouble = state.lastClick !== null && state.lastClick.key === key && at - state.lastClick.at < DOUBLE_CLICK_MS;
  // Tras un doble clic se reinicia la ventana: un tercer clic no cuenta como otro doble.
  const lastClick = isDouble ? null : { key, at };
  if (isDateKey(key)) {
    if (state.key !== key) return { ...state, key, dir: 'desc', lastClick };
    if (isDouble) return { ...state, dir: state.dir === 'asc' ? 'desc' : 'asc', lastClick };
    return { ...state, lastClick };
  }
  const dir: SortDir = state.key === key && state.dir === 'asc' ? 'desc' : 'asc';
  const expandedTree = key === 'path' && isDouble ? !state.expandedTree : state.expandedTree;
  return { ...state, key, dir, expandedTree, lastClick };
}

/** Normaliza un estado leído de la caché local. */
export function sanitizeSort(raw: unknown): SortState {
  if (!raw || typeof raw !== 'object') return DEFAULT_SORT;
  const r = raw as Record<string, unknown>;
  const key = SORT_KEYS.includes(r['key'] as SortKey) ? (r['key'] as SortKey) : DEFAULT_SORT.key;
  const dir: SortDir = r['dir'] === 'asc' || r['dir'] === 'desc' ? r['dir'] : DEFAULT_SORT.dir;
  return { key, dir, expandedTree: r['expandedTree'] === true, lastClick: null };
}
