/**
 * Árbol de carpetas de Backlinks (puro). RI-D §2.2–2.3 y §6.3 (S12–S20).
 *
 * El árbol reúne los backlinks, la nota actual (📍) y, en modo expandido, todas las notas de la carpeta de la
 * nota actual y sus subcarpetas (📋). En cada nodo: primero archivos (por nombre), luego subcarpetas (por
 * nombre). La raíz del vault (`''`) se aplana: sus archivos y subcarpetas se pintan en el nivel 0.
 */
import type { BacklinkEntry } from './detect';

export type TreeMark = 'backlink' | 'current' | 'expanded';

export interface TreeEntry {
  readonly entry: BacklinkEntry;
  readonly mark: TreeMark;
}

export interface FolderNode<T> {
  /** Último segmento (`''` en la raíz). */
  readonly name: string;
  /** Ruta completa de la carpeta (`''` en la raíz). */
  readonly path: string;
  readonly files: T[];
  readonly children: FolderNode<T>[];
  /** Archivos de este nodo y de todos sus descendientes. */
  count: number;
}

const byName = (a: string, b: string): number => a.localeCompare(b);

/**
 * Construye el árbol; `folderOf` da la carpeta de cada elemento (`''` = raíz). Determinista: archivos ordenados con
 * `fileOrder` (por defecto, inserción) y subcarpetas por nombre (`localeCompare`).
 */
export function buildFolderTree<T>(
  items: readonly T[],
  folderOf: (item: T) => string,
  fileOrder?: (a: T, b: T) => number,
): FolderNode<T> {
  const root: FolderNode<T> = { name: '', path: '', files: [], children: [], count: 0 };
  const index = new Map<string, FolderNode<T>>([['', root]]);
  const nodeFor = (folder: string): FolderNode<T> => {
    const existing = index.get(folder);
    if (existing) return existing;
    const cut = folder.lastIndexOf('/');
    const parent = nodeFor(cut < 0 ? '' : folder.slice(0, cut));
    const node: FolderNode<T> = { name: folder.slice(cut + 1), path: folder, files: [], children: [], count: 0 };
    parent.children.push(node);
    index.set(folder, node);
    return node;
  };
  for (const it of items) {
    const folder = folderOf(it).split('/').filter(Boolean).join('/');
    nodeFor(folder).files.push(it);
  }
  const finish = (n: FolderNode<T>): number => {
    if (fileOrder) n.files.sort(fileOrder);
    n.children.sort((a, b) => byName(a.name, b.name));
    n.count = n.files.length + n.children.reduce((s, c) => s + finish(c), 0);
    return n.count;
  };
  finish(root);
  return root;
}

/**
 * ¿La carpeta se pinta abierta? (v1 `shouldExpandFolder`, commit 396fe22). `level` es el nivel de PINTADO
 * (0 = primeras carpetas visibles, la raíz aplanada no suma). `currentFolder` = carpeta de la nota actual
 * (`null` si no hay nota).
 */
export function shouldExpandFolder(folderPath: string, level: number, currentFolder: string | null, expandedTree: boolean): boolean {
  if (level === 0) return true;
  if (currentFolder !== null && (currentFolder === folderPath || currentFolder.startsWith(`${folderPath}/`))) return true;
  if (expandedTree) return level < 2;
  return false;
}

/**
 * Reúne las entradas del árbol: backlinks + nota actual (📍) + (modo expandido) notas de la carpeta actual y
 * subcarpetas que no estén ya (📋). Cada ruta aparece una sola vez; prioridad: actual > backlink > expandida.
 */
export function assembleTreeEntries(
  backlinks: readonly BacklinkEntry[],
  current: BacklinkEntry | null,
  expandedExtras: readonly BacklinkEntry[],
): TreeEntry[] {
  const seen = new Set<string>();
  const out: TreeEntry[] = [];
  if (current) {
    seen.add(current.path);
    out.push({ entry: current, mark: 'current' });
  }
  for (const e of backlinks) {
    if (seen.has(e.path)) continue;
    seen.add(e.path);
    out.push({ entry: e, mark: 'backlink' });
  }
  for (const e of expandedExtras) {
    if (seen.has(e.path)) continue;
    seen.add(e.path);
    out.push({ entry: e, mark: 'expanded' });
  }
  return out;
}

/** Orden de archivos dentro de una carpeta del árbol: por nombre (estable y predecible). */
export function treeFileOrder(a: { readonly entry: BacklinkEntry }, b: { readonly entry: BacklinkEntry }): number {
  return a.entry.basename.toLowerCase().localeCompare(b.entry.basename.toLowerCase());
}
