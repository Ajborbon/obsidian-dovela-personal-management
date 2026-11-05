/**
 * Panel de revisión GTD (lógica pura): proyectos PGTD, estancados y resumen por nivel.
 * Sustituye a `StalledProjectService` de v1 (RI-A §6.1) leyendo el índice en memoria
 * en lugar de `cachedRead` de cada archivo de la jerarquía.
 *
 * Semántica v1 conservada:
 * - proyecto = carpeta cuyo nombre empieza por `PGTD ` (con espacio, a cualquier profundidad)
 *   y que contiene su nota-carpeta `X/X.md`;
 * - activo = `estado` 🟢 (ahora normalizado: tolera el selector de variación);
 * - estancado = activo sin tareas abiertas (`[ ]` o `[/]`) en la carpeta (recursiva) ni en las notas
 *   enlazadas de forma saliente a 1 y 2 niveles.
 */
import { normalizeEstado, normalizeType, type NoteType } from '../notes/types';
import { isOpen, type TaskStatus } from '../tasks/model';

export const PROJECT_FOLDER_PREFIX = 'PGTD ';
const DAY_MS = 86_400_000;

/** Subconjunto de `NoteRecord` que usa el panel. */
export interface ReviewNote {
  readonly path: string;
  readonly basename: string;
  readonly folder: string;
  readonly mtime: number;
  readonly type: NoteType;
  readonly estado: string;
  readonly fm: Readonly<Record<string, unknown>>;
  readonly tasks: readonly { readonly status: TaskStatus }[];
}

/** Lo que el panel necesita del `IndexStore` (lo cumple `IndexStore` tal cual). */
export interface ReviewSource<N extends ReviewNote = ReviewNote> {
  all(): Iterable<N>;
  get(path: string): N | undefined;
  outLinks(path: string): readonly string[];
}

export type ProjectState = 'active' | 'paused' | 'blocked' | 'archived' | 'none';

export interface ProjectInfo {
  /** Ruta de la nota-carpeta (`X/X.md`). */
  readonly path: string;
  /** Nombre de la carpeta (= nombre del proyecto). */
  readonly name: string;
  readonly folder: string;
  /** 1 = PGTD de primer nivel; 2 = dentro de otro PGTD; 3 = dentro de dos o más. */
  readonly level: number;
  readonly estado: string;
  readonly state: ProjectState;
  /** Última modificación de cualquier nota de la carpeta del proyecto (recursiva). */
  readonly lastModified: number;
}

export interface StalledProject extends ProjectInfo {
  /** Notas revisadas (carpeta + enlaces a 2 niveles). */
  readonly filesChecked: number;
}

export function folderName(folder: string): string {
  return folder.slice(folder.lastIndexOf('/') + 1);
}

export function isProjectFolder(folder: string): boolean {
  return folderName(folder).startsWith(PROJECT_FOLDER_PREFIX);
}

/** ¿Es la nota-carpeta de un proyecto PGTD (`…/PGTD x/PGTD x.md`)? */
export function isProjectNote(n: Pick<ReviewNote, 'folder' | 'basename'>): boolean {
  return n.folder !== '' && isProjectFolder(n.folder) && folderName(n.folder) === n.basename;
}

/** Número de carpetas PGTD en la ruta de la carpeta (incluida ella misma), con tope 3. */
export function projectLevel(folder: string): number {
  let n = 0;
  for (const seg of folder.split('/')) if (seg.startsWith(PROJECT_FOLDER_PREFIX)) n++;
  return Math.max(1, Math.min(3, n));
}

export function projectState(estado: unknown): ProjectState {
  switch (normalizeEstado(estado)) {
    case '🟢': return 'active';
    case '🟡': return 'paused';
    case '🔴': return 'blocked';
    case '🔵': return 'archived';
    default: return 'none';
  }
}

function ancestors(folder: string): string[] {
  const out: string[] = [];
  let f = folder;
  while (f) {
    out.push(f);
    const i = f.lastIndexOf('/');
    f = i < 0 ? '' : f.slice(0, i);
  }
  return out;
}

/**
 * Proyectos PGTD del índice con la ruta de cada nota de su carpeta (recursiva).
 * Un único recorrido del índice: O(notas × profundidad).
 */
export function collectProjects<N extends ReviewNote>(src: ReviewSource<N>): { projects: ProjectInfo[]; folderNotes: Map<string, string[]> } {
  const notes = [...src.all()];
  const projectNotes = notes.filter(isProjectNote);
  const folderNotes = new Map<string, string[]>(projectNotes.map((n) => [n.folder, []]));
  const lastMod = new Map<string, number>();
  for (const n of notes) {
    for (const f of ancestors(n.folder)) {
      const list = folderNotes.get(f);
      if (!list) continue;
      list.push(n.path);
      if (n.mtime > (lastMod.get(f) ?? 0)) lastMod.set(f, n.mtime);
    }
  }
  const projects = projectNotes.map((n): ProjectInfo => ({
    path: n.path,
    name: folderName(n.folder),
    folder: n.folder,
    level: projectLevel(n.folder),
    estado: n.estado,
    state: projectState(n.estado),
    lastModified: lastMod.get(n.folder) ?? n.mtime,
  }));
  projects.sort((a, b) => a.folder.localeCompare(b.folder));
  return { projects, folderNotes };
}

/** Archivos de la jerarquía: carpeta + enlaces salientes a 1 y 2 niveles (como v1). */
export function projectHierarchy<N extends ReviewNote>(src: ReviewSource<N>, folderPaths: readonly string[], depth = 2): Set<string> {
  const seen = new Set(folderPaths);
  let frontier = [...folderPaths];
  for (let level = 0; level < depth && frontier.length; level++) {
    const next: string[] = [];
    for (const p of frontier) {
      for (const dest of src.outLinks(p)) {
        if (seen.has(dest)) continue;
        seen.add(dest);
        next.push(dest);
      }
    }
    frontier = next;
  }
  return seen;
}

function hasOpenTask<N extends ReviewNote>(src: ReviewSource<N>, paths: Iterable<string>): boolean {
  for (const p of paths) {
    const n = src.get(p);
    if (n && n.tasks.some(isOpen)) return true;
  }
  return false;
}

/** Proyectos activos (🟢) sin tareas abiertas en su jerarquía. */
export function findStalledProjects<N extends ReviewNote>(
  src: ReviewSource<N>,
  collected: ReturnType<typeof collectProjects> = collectProjects(src),
): StalledProject[] {
  const out: StalledProject[] = [];
  for (const p of collected.projects) {
    if (p.state !== 'active') continue;
    const files = projectHierarchy(src, collected.folderNotes.get(p.folder) ?? [p.path]);
    if (!hasOpenTask(src, files)) out.push({ ...p, filesChecked: files.size });
  }
  return out;
}

export interface LevelSummary {
  readonly level: number;
  total: number;
  active: number;
  paused: number;
  blocked: number;
  archived: number;
  none: number;
  /** No archivados (🔵) cuya carpeta no se modifica hace más de N días. */
  stale: number;
}

export interface ProjectSummary {
  readonly levels: LevelSummary[];
  /** No archivados sin modificar hace más de N días, del más antiguo al más reciente. */
  readonly staleProjects: (ProjectInfo & { readonly daysSince: number })[];
}

export function daysSince(ms: number, now: number): number {
  return Math.max(0, Math.floor((now - ms) / DAY_MS));
}

/** Resumen por nivel de anidamiento (backlog v0.9). */
export function summarizeProjects(projects: readonly ProjectInfo[], now: number, staleDays: number): ProjectSummary {
  const levels: LevelSummary[] = [1, 2, 3].map((level) => ({
    level, total: 0, active: 0, paused: 0, blocked: 0, archived: 0, none: 0, stale: 0,
  }));
  const staleProjects: ProjectSummary['staleProjects'] = [];
  const limit = Math.max(0, staleDays);
  for (const p of projects) {
    const l = levels[p.level - 1];
    if (!l) continue;
    l.total++;
    l[p.state]++;
    if (p.state === 'archived') continue;
    const d = daysSince(p.lastModified, now);
    if (d > limit) {
      l.stale++;
      staleProjects.push({ ...p, daysSince: d });
    }
  }
  staleProjects.sort((a, b) => b.daysSince - a.daysSince || a.folder.localeCompare(b.folder));
  return { levels, staleProjects };
}

/** Tipos de «notas de conocimiento» donde la regla del vault dice que no deberían vivir tareas. */
export const KNOWLEDGE_TYPES: ReadonlySet<NoteType> = new Set<NoteType>(['Ax', 'Btx', 'Vx', 'Ref', 'Rf', 'Sue', 'Podx', 'Prx', 'Cmt']);

/**
 * Tipo declarado de forma explícita (frontmatter `type` o prefijo `Tipo␠`).
 * `detectNoteType` usa `Ax` como valor por defecto; aquí no se quiere tratar como Ax a cualquier nota sin tipo.
 */
export function explicitType(n: Pick<ReviewNote, 'basename' | 'type' | 'fm'>): NoteType | null {
  const fromFm = normalizeType(n.fm['type']);
  if (fromFm) return fromFm;
  return n.basename.startsWith(`${n.type} `) ? n.type : null;
}

export interface KnowledgeTaskNote {
  readonly path: string;
  readonly basename: string;
  readonly folder: string;
  readonly type: NoteType;
  readonly openTasks: number;
}

/** Notas de conocimiento con tareas abiertas (lint informativo, 02 §9.13). */
export function knowledgeNotesWithTasks<N extends ReviewNote>(notes: Iterable<N>): KnowledgeTaskNote[] {
  const out: KnowledgeTaskNote[] = [];
  for (const n of notes) {
    if (!n.tasks.length) continue;
    const t = explicitType(n);
    if (!t || !KNOWLEDGE_TYPES.has(t)) continue;
    const open = n.tasks.filter(isOpen).length;
    if (open) out.push({ path: n.path, basename: n.basename, folder: n.folder, type: t, openTasks: open });
  }
  out.sort((a, b) => b.openTasks - a.openTasks || a.path.localeCompare(b.path));
  return out;
}
