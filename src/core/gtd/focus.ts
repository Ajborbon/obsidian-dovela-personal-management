/**
 * Ámbito de la Vista de Foco (02 §8: "Foco = GTD con otro scope"). Ajustes por dispositivo y cálculo
 * del conjunto de notas a partir del índice con `expandNeighborhood`.
 */
import { folderOf, type IndexStore } from '../index/store';
import { expandNeighborhood, type ExpandResult } from '../links/expand';
import type { Task } from '../tasks/model';

export interface FocusSettings {
  readonly outgoingLinksLevels: number;
  readonly incomingLinksLevels: number;
  readonly terminationFolders: readonly string[];
  readonly terminationNotes: readonly string[];
  readonly showOriginIndicators: boolean;
  /** Contar `origen:`/`origen::` como enlace (02 §9 #6: en Foco, desactivado por defecto). */
  readonly includeOrigin: boolean;
  /** La vista cambia de nota fijada al abrir otra nota. */
  readonly followActive: boolean;
}

export const MAX_FOCUS_LEVELS = 10;

export const DEFAULT_FOCUS_SETTINGS: FocusSettings = {
  outgoingLinksLevels: 2,
  incomingLinksLevels: 5,
  terminationFolders: ['AI - Journals'],
  terminationNotes: [],
  showOriginIndicators: true,
  includeOrigin: false,
  followActive: false,
};

const clampLevel = (v: unknown, def: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return def;
  return Math.min(MAX_FOCUS_LEVELS, Math.max(0, Math.round(n)));
};

const strings = (v: unknown, def: readonly string[]): readonly string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean) : def;

const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def);

/** Repara cualquier valor (JSON de v1 manipulado, caché corrupta) a ajustes válidos. */
export function validateFocusSettings(raw: unknown): FocusSettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_FOCUS_SETTINGS;
  return {
    outgoingLinksLevels: clampLevel(o['outgoingLinksLevels'], d.outgoingLinksLevels),
    incomingLinksLevels: clampLevel(o['incomingLinksLevels'], d.incomingLinksLevels),
    terminationFolders: strings(o['terminationFolders'], d.terminationFolders),
    terminationNotes: strings(o['terminationNotes'], d.terminationNotes),
    showOriginIndicators: bool(o['showOriginIndicators'], d.showOriginIndicators),
    includeOrigin: bool(o['includeOrigin'], d.includeOrigin),
    followActive: bool(o['followActive'], d.followActive),
  };
}

/** Conjunto de notas del foco de `anchor` sobre el índice. */
export function computeFocusScope(store: IndexStore, anchor: string, s: FocusSettings): ExpandResult {
  const base = store.inFolder(folderOf(anchor), true).map((n) => n.path);
  const q = { includeOrigin: s.includeOrigin };
  return expandNeighborhood(
    { outLinks: (p) => store.outLinks(p, q), inLinks: (p) => store.inLinks(p, q) },
    anchor,
    base,
    {
      outLevels: s.outgoingLinksLevels,
      inLevels: s.incomingLinksLevels,
      terminationFolders: s.terminationFolders,
      terminationNotes: s.terminationNotes,
    },
  );
}

/** Tareas (ordenadas por ruta y línea) de un conjunto de rutas. */
export function tasksInScope(store: IndexStore, paths: Iterable<string>): Task[] {
  const out: Task[] = [];
  for (const p of [...paths].sort()) for (const t of store.tasksOf(p)) out.push(t);
  return out;
}

/** Resumen del foco por origen, para la cabecera. */
export function focusSummary(r: ExpandResult): string {
  const s = r.stats;
  const parts = [`📁 ${s.folderBaseNotes + 1} carpeta`];
  if (s.outgoingNotes) parts.push(`➡️ ${s.outgoingNotes} salientes (nivel ${s.maxOutgoingLevel})`);
  if (s.incomingNotes) parts.push(`⬅️ ${s.incomingNotes} entrantes (nivel ${s.maxIncomingLevel})`);
  if (s.terminationNotes) parts.push(`🛑 ${s.terminationNotes} de terminación`);
  parts.push(`${s.totalNotes} notas`);
  return parts.join(' · ');
}
