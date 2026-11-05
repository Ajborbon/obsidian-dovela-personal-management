/**
 * Almacén del índice (puro). El adaptador `host/index/VaultIndex.ts` lo alimenta con
 * eventos de Obsidian; aquí solo hay estructuras y consultas, testeables sin Obsidian.
 */
import type { NoteType } from '../notes/types';
import type { Task } from '../tasks/model';
import { isOpen } from '../tasks/model';

export interface NoteRecord {
  readonly path: string;
  readonly basename: string;
  readonly folder: string; // '' en la raíz
  readonly ctime: number;
  readonly mtime: number;
  readonly type: NoteType;
  readonly estado: string; // normalizado ('' si no hay)
  /** Subconjunto de frontmatter usado por las vistas (valores crudos). */
  readonly fm: Readonly<Record<string, unknown>>;
  /** Destinos `.md` resueltos de los enlaces del cuerpo. */
  readonly outLinks: readonly string[];
  /** Destinos resueltos de `origen` (frontmatter o `origen::`). */
  readonly originLinks: readonly string[];
  readonly tasks: readonly Task[];
}

export interface LinkQuery {
  /** Incluir enlaces declarados en `origen` (por defecto false). */
  readonly includeOrigin?: boolean;
}

export function folderOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

export function basenameOf(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  return name.replace(/\.md$/i, '');
}

export class IndexStore {
  private readonly notes = new Map<string, NoteRecord>();
  private readonly inBody = new Map<string, Set<string>>();
  private readonly inOrigin = new Map<string, Set<string>>();
  private allTasksCache: Task[] | null = null;
  private byIdCache: Map<string, Task> | null = null;
  private _version = 0;

  /** Se incrementa con cada cambio; sirve para memoizar vistas. */
  get version(): number {
    return this._version;
  }

  get size(): number {
    return this.notes.size;
  }

  upsert(rec: NoteRecord): void {
    this.removeLinks(rec.path);
    this.notes.set(rec.path, rec);
    this.addLinks(rec);
    this.touch();
  }

  remove(path: string): boolean {
    if (!this.notes.has(path)) return false;
    this.removeLinks(path);
    this.notes.delete(path);
    this.touch();
    return true;
  }

  /** Renombrado: mueve el registro (las tareas se reindexarán con su nueva ruta por el adaptador). */
  rename(oldPath: string, rec: NoteRecord): void {
    this.remove(oldPath);
    this.upsert(rec);
  }

  clear(): void {
    this.notes.clear();
    this.inBody.clear();
    this.inOrigin.clear();
    this.touch();
  }

  get(path: string): NoteRecord | undefined {
    return this.notes.get(path);
  }

  all(): IterableIterator<NoteRecord> {
    return this.notes.values();
  }

  /** Notas de una carpeta (directas o recursivas). `''` = raíz. */
  inFolder(folder: string, recursive: boolean): NoteRecord[] {
    const out: NoteRecord[] = [];
    const prefix = folder ? `${folder}/` : '';
    for (const n of this.notes.values()) {
      if (recursive ? n.path.startsWith(prefix) : n.folder === folder) out.push(n);
    }
    return out;
  }

  siblings(path: string): NoteRecord[] {
    return this.inFolder(folderOf(path), false).filter((n) => n.path !== path);
  }

  outLinks(path: string, q: LinkQuery = {}): string[] {
    const n = this.notes.get(path);
    if (!n) return [];
    return q.includeOrigin ? [...new Set([...n.outLinks, ...n.originLinks])] : [...n.outLinks];
  }

  inLinks(path: string, q: LinkQuery = {}): string[] {
    const body = this.inBody.get(path) ?? new Set<string>();
    if (!q.includeOrigin) return [...body];
    return [...new Set([...body, ...(this.inOrigin.get(path) ?? [])])];
  }

  tasksOf(path: string): readonly Task[] {
    return this.notes.get(path)?.tasks ?? [];
  }

  /** Todas las tareas (ordenadas por ruta y línea), memoizado hasta el siguiente cambio. */
  allTasks(): readonly Task[] {
    if (!this.allTasksCache) {
      const paths = [...this.notes.keys()].sort();
      const out: Task[] = [];
      for (const p of paths) {
        const ts = this.notes.get(p)?.tasks;
        if (ts) for (const t of ts) out.push(t);
      }
      this.allTasksCache = out;
    }
    return this.allTasksCache;
  }

  openTasks(): Task[] {
    return this.allTasks().filter(isOpen);
  }

  /** Mapa id → tarea (primer id gana; los duplicados se informan con `duplicateIds`). */
  taskById(): ReadonlyMap<string, Task> {
    if (!this.byIdCache) {
      const m = new Map<string, Task>();
      for (const t of this.allTasks()) if (t.id && !m.has(t.id)) m.set(t.id, t);
      this.byIdCache = m;
    }
    return this.byIdCache;
  }

  duplicateIds(): Map<string, Task[]> {
    const m = new Map<string, Task[]>();
    for (const t of this.allTasks()) {
      if (!t.id) continue;
      const arr = m.get(t.id);
      if (arr) arr.push(t);
      else m.set(t.id, [t]);
    }
    for (const [k, v] of m) if (v.length < 2) m.delete(k);
    return m;
  }

  private touch(): void {
    this._version++;
    this.allTasksCache = null;
    this.byIdCache = null;
  }

  private addLinks(rec: NoteRecord): void {
    const add = (map: Map<string, Set<string>>, dest: string): void => {
      if (dest === rec.path) return;
      let s = map.get(dest);
      if (!s) map.set(dest, (s = new Set()));
      s.add(rec.path);
    };
    rec.outLinks.forEach((d) => add(this.inBody, d));
    rec.originLinks.forEach((d) => add(this.inOrigin, d));
  }

  private removeLinks(path: string): void {
    const old = this.notes.get(path);
    if (!old) return;
    const del = (map: Map<string, Set<string>>, dest: string): void => {
      const s = map.get(dest);
      if (!s) return;
      s.delete(path);
      if (s.size === 0) map.delete(dest);
    };
    old.outLinks.forEach((d) => del(this.inBody, d));
    old.originLinks.forEach((d) => del(this.inOrigin, d));
  }
}
