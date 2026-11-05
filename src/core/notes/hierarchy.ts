/**
 * Jerarquía de notas por carpetas (v1 `hierarchyBuilder.ts`).
 * - Una carpeta `X/` se representa por su nota `X/X.md`; si no existe, por una nota hermana `X.md`
 *   (corrige B-H1: antes esa nota desaparecía); si tampoco, por un marcador `[FALTA] X`.
 * - Conteos: tareas abiertas propias y de toda la descendencia.
 * - Orden: nivel 0 por nombre; resto por tipo, `estado`, `ctime` desc y nombre.
 */
import { TYPE_ORDER, normalizeEstado } from './types';

export interface NoteInfo {
  readonly path: string; // con extensión .md
  readonly type: string;
  readonly estado?: string;
  readonly ctime: number;
  /** Tareas abiertas (`[ ]` y `[/]`) de la nota. */
  readonly openTasks: number;
  readonly inProgressTasks?: number;
}

export interface TreeNode {
  /** Ruta de la nota, o de la carpeta si es un marcador. */
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly path?: string; // ausente en marcadores y raíz
  readonly estado: string;
  readonly ctime: number;
  readonly missing: boolean;
  readonly own: number;
  total: number;
  readonly inProgress: number;
  readonly children: TreeNode[];
}

const stripMd = (p: string): string => p.replace(/\.md$/i, '');
const lastSeg = (p: string): string => p.slice(p.lastIndexOf('/') + 1);
const parentOf = (p: string): string => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');

function compareNodes(a: TreeNode, b: TreeNode): number {
  const ta = TYPE_ORDER[a.type] ?? 99;
  const tb = TYPE_ORDER[b.type] ?? 99;
  if (ta !== tb) return ta - tb;
  if (a.estado !== b.estado) return a.estado.localeCompare(b.estado);
  if (a.ctime !== b.ctime) return b.ctime - a.ctime;
  return a.name.localeCompare(b.name, 'es');
}

export function buildHierarchy(notes: readonly NoteInfo[]): TreeNode {
  const byKey = new Map<string, NoteInfo>(); // ruta sin extensión → nota
  const folders = new Set<string>();
  for (const n of notes) {
    const key = stripMd(n.path);
    byKey.set(key, n);
    let f = parentOf(n.path);
    while (f) {
      folders.add(f);
      f = parentOf(f);
    }
  }

  const nodes = new Map<string, TreeNode>(); // clave jerárquica (ruta de carpeta o de nota sin .md)
  const representing = new Set<string>(); // notas usadas como representantes de carpeta
  const makeNode = (key: string, n: NoteInfo | undefined): TreeNode => ({
    id: n ? n.path : key,
    name: n ? lastSeg(stripMd(n.path)) : `[FALTA] ${lastSeg(key)}`,
    type: n ? n.type : 'Ax',
    ...(n ? { path: n.path } : {}),
    estado: normalizeEstado(n?.estado),
    ctime: n?.ctime ?? 0,
    missing: !n,
    own: n?.openTasks ?? 0,
    total: 0,
    inProgress: n?.inProgressTasks ?? 0,
    children: [],
  });

  for (const folder of folders) {
    const inside = byKey.get(`${folder}/${lastSeg(folder)}`);
    const sibling = inside ? undefined : byKey.get(folder);
    const rep = inside ?? sibling;
    if (rep) representing.add(rep.path);
    nodes.set(folder, makeNode(folder, rep));
  }
  for (const n of notes) {
    if (representing.has(n.path)) continue;
    // Si una carpeta homónima ya tiene su nota interior, la hermana `X.md` conserva su propio nodo.
    const key = nodes.has(stripMd(n.path)) ? n.path : stripMd(n.path);
    nodes.set(key, makeNode(key, n));
  }

  const root: TreeNode = {
    id: 'root', name: 'Vault', type: 'Root', estado: '', ctime: 0, missing: false, own: 0, total: 0, inProgress: 0, children: [],
  };
  for (const [key, node] of nodes) {
    const parent = nodes.get(parentOf(key));
    (parent ?? root).children.push(node);
  }

  const finish = (node: TreeNode, level: number): number => {
    let sum = 0;
    for (const c of node.children) sum += finish(c, level + 1);
    node.total = sum;
    if (level === 0) node.children.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    else node.children.sort(compareNodes);
    return node.own + sum;
  };
  finish(root, 0);
  return root;
}
