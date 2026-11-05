/**
 * Expansión bidireccional de enlaces de la Vista de Foco (v1 `focoParser.collectFocusFiles`, RI-D §1.4).
 * Pura: recibe un grafo de enlaces (el índice) en lugar de recorrer el vault.
 *
 * Reglas conservadas de v1:
 * - Semillas = notas de la carpeta de la nota fijada (recursivo) + la nota fijada.
 * - Dos BFS separados: salientes (hasta `outLevels`) y entrantes (hasta `inLevels`). Lo hallado por
 *   salientes solo expande salientes y viceversa; solo las semillas alimentan ambas direcciones.
 * - Deduplicación global: una nota alcanzable por ambas direcciones queda como saliente
 *   (la pasada saliente se ejecuta primero).
 * - Notas/carpetas de terminación: se incluyen, pero desde el nivel 2 no se expanden
 *   (en el nivel 1 las fuentes son las semillas, que siempre se expanden).
 */

export type NeighborOrigin = 'anchor' | 'folder' | 'outgoing' | 'incoming';

export interface NeighborInfo {
  readonly origin: NeighborOrigin;
  /** 0 para la nota fijada y su carpeta; n para el nivel de expansión. */
  readonly level: number;
  /** La nota está en una carpeta/nota de terminación (se incluye pero no se expande). */
  readonly termination: boolean;
}

export interface ExpandConfig {
  readonly outLevels: number;
  readonly inLevels: number;
  /** Con `/`: prefijo de ruta. Sin `/`: nombre de carpeta en cualquier nivel. */
  readonly terminationFolders: readonly string[];
  /** Ruta completa, nombre de archivo (`Plan.md`) o nombre sin extensión (`Plan`). */
  readonly terminationNotes: readonly string[];
}

export interface LinkGraph {
  outLinks(path: string): readonly string[];
  inLinks(path: string): readonly string[];
}

export interface ExpandStats {
  /** Notas de la carpeta base sin contar la nota fijada. */
  readonly folderBaseNotes: number;
  readonly outgoingNotes: number;
  readonly incomingNotes: number;
  /** Notas de terminación halladas por expansión. */
  readonly terminationNotes: number;
  /** Último nivel saliente que produjo notas (0 si ninguno). */
  readonly maxOutgoingLevel: number;
  readonly maxIncomingLevel: number;
  readonly totalNotes: number;
}

export interface ExpandResult {
  readonly notes: ReadonlyMap<string, NeighborInfo>;
  readonly stats: ExpandStats;
}

const nameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

export function isTerminationPath(path: string, folders: readonly string[], notes: readonly string[]): boolean {
  const segments = path.split('/').slice(0, -1);
  for (const raw of folders) {
    const f = raw.trim().replace(/^\/+|\/+$/g, '');
    if (!f) continue;
    if (f.includes('/')) {
      if (path === f || path.startsWith(`${f}/`)) return true;
    } else if (segments.includes(f)) return true;
  }
  const name = nameOf(path);
  for (const raw of notes) {
    const n = raw.trim();
    if (!n) continue;
    if (n === path || n === name || `${n}.md` === name) return true;
  }
  return false;
}

const isMd = (p: string): boolean => p.toLowerCase().endsWith('.md');

export function expandNeighborhood(
  graph: LinkGraph,
  anchor: string,
  base: readonly string[],
  cfg: ExpandConfig,
): ExpandResult {
  const notes = new Map<string, NeighborInfo>();
  const isTerm = (p: string): boolean => isTerminationPath(p, cfg.terminationFolders, cfg.terminationNotes);
  notes.set(anchor, { origin: 'anchor', level: 0, termination: false });

  const seeds: string[] = [anchor];
  for (const p of [...new Set(base)].sort()) {
    if (p === anchor) continue;
    notes.set(p, { origin: 'folder', level: 0, termination: false });
    seeds.push(p);
  }
  const folderBaseNotes = seeds.length - 1;

  const pass = (origin: 'outgoing' | 'incoming', levels: number, next: (p: string) => readonly string[]): { count: number; maxLevel: number } => {
    let current = seeds;
    let count = 0;
    let maxLevel = 0;
    for (let level = 1; level <= levels && current.length > 0; level++) {
      const found: string[] = [];
      for (const src of current) {
        if (level > 1 && isTerm(src)) continue;
        for (const dest of [...next(src)].sort()) {
          if (!isMd(dest) || notes.has(dest)) continue;
          notes.set(dest, { origin, level, termination: isTerm(dest) });
          found.push(dest);
        }
      }
      if (found.length) maxLevel = level;
      count += found.length;
      current = found;
    }
    return { count, maxLevel };
  };

  const out = pass('outgoing', Math.max(0, Math.floor(cfg.outLevels)), (p) => graph.outLinks(p));
  const inc = pass('incoming', Math.max(0, Math.floor(cfg.inLevels)), (p) => graph.inLinks(p));
  let terminationNotes = 0;
  for (const info of notes.values()) if (info.termination) terminationNotes++;

  return {
    notes,
    stats: {
      folderBaseNotes,
      outgoingNotes: out.count,
      incomingNotes: inc.count,
      terminationNotes,
      maxOutgoingLevel: out.maxLevel,
      maxIncomingLevel: inc.maxLevel,
      totalNotes: notes.size,
    },
  };
}

/** Badge de origen para tareas/notas que vienen de la expansión (`➡️1`, `⬅️2`, `🛑`). */
export function originBadge(info: NeighborInfo | undefined): string {
  if (!info || info.origin === 'anchor' || info.origin === 'folder') return '';
  const arrow = info.origin === 'outgoing' ? '➡️' : '⬅️';
  return `${arrow}${info.level}${info.termination ? ' 🛑' : ''}`;
}
