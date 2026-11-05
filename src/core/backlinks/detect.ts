/**
 * Detección de backlinks (pura, sobre el índice). RI-D §2.1 y §5.2.
 *
 * Backlink de una nota = notas de la MISMA carpeta directa (no subcarpetas) ∪ notas que la enlazan en el
 * cuerpo ∪ (opcional) notas que la declaran como `origen`. Cada elemento indica sus motivos. En v1 esto
 * recorría todo el vault con `getFirstLinkpathDest` por enlace en cada cambio; aquí es O(k) con el índice
 * invertido.
 */
import type { NoteRecord } from '../index/store';
import { basenameOf, folderOf } from '../index/store';

export type BacklinkReason = 'folder' | 'link' | 'origin';

export const REASON_ORDER: readonly BacklinkReason[] = ['link', 'origin', 'folder'];

export const REASON_ICONS: Readonly<Record<BacklinkReason, string>> = {
  link: '🔗',
  origin: '🌱',
  folder: '📁',
};

export const REASON_LABELS: Readonly<Record<BacklinkReason, string>> = {
  link: 'Enlaza a esta nota',
  origin: 'Declara esta nota como origen',
  folder: 'Misma carpeta',
};

export interface BacklinkEntry {
  readonly path: string;
  readonly basename: string;
  readonly folder: string;
  /** `type` del frontmatter tal cual (como v1); '' si no hay. */
  readonly typeLabel: string;
  readonly estado: string;
  readonly ctime: number;
  readonly mtime: number;
  readonly moneda: unknown;
  readonly monto: unknown;
  /** Motivos en orden `REASON_ORDER`; vacío solo en entradas auxiliares del árbol. */
  readonly reasons: readonly BacklinkReason[];
}

/** Lo que la detección necesita del índice (`IndexStore` lo cumple). */
export interface BacklinkSource {
  get(path: string): NoteRecord | undefined;
  siblings(path: string): NoteRecord[];
  inLinks(path: string, q?: { readonly includeOrigin?: boolean }): string[];
}

export interface DetectOptions {
  readonly includeOrigin: boolean;
}

export function entryFromRecord(rec: NoteRecord, reasons: readonly BacklinkReason[]): BacklinkEntry {
  const t = rec.fm['type'];
  return {
    path: rec.path,
    basename: rec.basename,
    folder: rec.folder,
    typeLabel: typeof t === 'string' ? t.trim() : '',
    estado: rec.estado,
    ctime: rec.ctime,
    mtime: rec.mtime,
    moneda: rec.fm['moneda'],
    monto: rec.fm['monto'],
    reasons,
  };
}

/** Entrada mínima para una ruta que no está en el índice (p. ej. la nota actual en una carpeta excluida). */
export function bareEntry(path: string): BacklinkEntry {
  return {
    path, basename: basenameOf(path), folder: folderOf(path), typeLabel: '', estado: '',
    ctime: 0, mtime: 0, moneda: undefined, monto: undefined, reasons: [],
  };
}

export function findBacklinks(src: BacklinkSource, path: string, opts: DetectOptions): BacklinkEntry[] {
  const reasons = new Map<string, Set<BacklinkReason>>();
  const add = (p: string, r: BacklinkReason): void => {
    if (p === path) return;
    let s = reasons.get(p);
    if (!s) reasons.set(p, (s = new Set()));
    s.add(r);
  };
  for (const n of src.siblings(path)) add(n.path, 'folder');
  for (const p of src.inLinks(path, { includeOrigin: opts.includeOrigin })) {
    const rec = src.get(p);
    if (!rec) continue;
    // El motivo se deduce del registro de la fuente: un mismo archivo puede enlazar y declarar origen.
    if (rec.outLinks.includes(path)) add(p, 'link');
    if (opts.includeOrigin && rec.originLinks.includes(path)) add(p, 'origin');
  }
  const out: BacklinkEntry[] = [];
  for (const [p, rs] of reasons) {
    const rec = src.get(p);
    if (!rec || rs.size === 0) continue;
    out.push(entryFromRecord(rec, REASON_ORDER.filter((r) => rs.has(r))));
  }
  // Orden base determinista (por ruta); la vista aplica después el orden elegido.
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

export interface ReasonCounts {
  readonly total: number;
  readonly link: number;
  readonly origin: number;
  readonly folder: number;
}

export function countReasons(entries: readonly BacklinkEntry[]): ReasonCounts {
  let link = 0;
  let origin = 0;
  let folder = 0;
  for (const e of entries) {
    if (e.reasons.includes('link')) link++;
    if (e.reasons.includes('origin')) origin++;
    if (e.reasons.includes('folder')) folder++;
  }
  return { total: entries.length, link, origin, folder };
}

/**
 * ¿Un lote de cambios del índice afecta a los backlinks de `activePath`? Se recalcula solo si:
 * - el lote es global (`'*'`), o cambió la propia nota activa;
 * - cambió una nota que ya era backlink (pudo dejar de enlazar, cambiar de estado o borrarse);
 * - cambió una nota de la carpeta de la nota activa (alta/baja de hermana);
 * - una nota cambiada ahora enlaza a la activa (cuerpo u `origen`).
 */
export function isRelevantChange(
  changed: ReadonlySet<string>,
  activePath: string | null,
  shownPaths: ReadonlySet<string>,
  src: Pick<BacklinkSource, 'get'>,
  /** Árbol en modo expandido: también importan las subcarpetas de la carpeta activa. */
  recursiveFolder = false,
): boolean {
  if (!activePath) return changed.has('*');
  if (changed.has('*') || changed.has(activePath)) return true;
  const folder = folderOf(activePath);
  const prefix = folder ? `${folder}/` : '';
  for (const p of changed) {
    if (shownPaths.has(p)) return true;
    if (folderOf(p) === folder) return true;
    if (recursiveFolder && p.startsWith(prefix)) return true;
    const rec = src.get(p);
    if (rec && (rec.outLinks.includes(activePath) || rec.originLinks.includes(activePath))) return true;
  }
  return false;
}
