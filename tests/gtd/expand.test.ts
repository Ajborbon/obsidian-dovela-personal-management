import { describe, expect, it } from 'vitest';
import { expandNeighborhood, isTerminationPath, originBadge, type ExpandConfig, type LinkGraph } from '../../src/core/links/expand';
import { DEFAULT_FOCUS_SETTINGS, computeFocusScope, focusSummary, tasksInScope, validateFocusSettings } from '../../src/core/gtd/focus';
import { IndexStore, basenameOf, folderOf, type NoteRecord } from '../../src/core/index/store';
import { parseTasksInNote } from '../../src/core/tasks/parse';

/** Grafo a partir de aristas `origen→destino` (rutas sin `.md`; se añaden). */
function graph(edges: ReadonlyArray<[string, string]>): LinkGraph {
  const out = new Map<string, string[]>();
  const inn = new Map<string, string[]>();
  for (const [a, b] of edges) {
    const pa = `${a}.md`;
    const pb = b.includes('.') ? b : `${b}.md`;
    out.set(pa, [...(out.get(pa) ?? []), pb]);
    inn.set(pb, [...(inn.get(pb) ?? []), pa]);
  }
  return { outLinks: (p) => out.get(p) ?? [], inLinks: (p) => inn.get(p) ?? [] };
}

const md = (xs: string[]): string[] => xs.map((x) => `${x}.md`);

// Fixture RI-D §6.2: carpeta P/ (con P/s/) = a, b, s1; J = carpeta de terminación.
const EDGES: Array<[string, string]> = [
  ['P/a', 'x'], ['P/b', 'y'], ['x', 'z'], ['z', 'w'], ['P/s/s1', 'P/a'],
  ['i1', 'P/a'], ['i2', 'i1'], ['i3', 'i2'], ['J/j1', 'P/a'], ['k', 'J/j1'], ['m', 'P/b'],
  ['x', 'P/a'],
];
const BASE = md(['P/a', 'P/b', 'P/s/s1']);
const cfg = (outLevels: number, inLevels: number, terminationFolders: string[] = [], terminationNotes: string[] = []): ExpandConfig =>
  ({ outLevels, inLevels, terminationFolders, terminationNotes });

function levels(r: ReturnType<typeof expandNeighborhood>, origin: string): Record<string, number> {
  const o: Record<string, number> = {};
  for (const [p, i] of r.notes) if (i.origin === origin) o[p.replace(/\.md$/, '')] = i.level;
  return o;
}

describe('expandNeighborhood (RI-D §6.2)', () => {
  it('E1: salientes 2, entrantes 5, terminación J', () => {
    const r = expandNeighborhood(graph(EDGES), 'P/a.md', BASE, cfg(2, 5, ['J']));
    expect(levels(r, 'outgoing')).toEqual({ x: 1, y: 1, z: 2 });
    expect(levels(r, 'incoming')).toEqual({ i1: 1, 'J/j1': 1, m: 1, i2: 2, i3: 3 });
    expect(r.notes.has('w.md')).toBe(false);
    expect(r.notes.has('k.md')).toBe(false);
    expect(r.notes.get('J/j1.md')?.termination).toBe(true);
    expect(r.notes.get('P/a.md')?.origin).toBe('anchor');
    expect(r.notes.get('P/s/s1.md')?.origin).toBe('folder');
    expect(r.stats).toMatchObject({ folderBaseNotes: 2, maxOutgoingLevel: 2, maxIncomingLevel: 3, terminationNotes: 1 });
    expect(r.stats.totalNotes).toBe(3 + 3 + 5);
  });

  it('E2: (0,0) solo la carpeta base', () => {
    const r = expandNeighborhood(graph(EDGES), 'P/a.md', BASE, cfg(0, 0));
    expect([...r.notes.keys()].sort()).toEqual(BASE);
    expect(r.stats.maxOutgoingLevel).toBe(0);
  });

  it('E3: (1,0) base + primer nivel saliente', () => {
    const r = expandNeighborhood(graph(EDGES), 'P/a.md', BASE, cfg(1, 0));
    expect(levels(r, 'outgoing')).toEqual({ x: 1, y: 1 });
  });

  it('E4: el ciclo x→a no reañade a ni itera', () => {
    const r = expandNeighborhood(graph(EDGES), 'P/a.md', BASE, cfg(2, 5));
    expect(r.notes.get('P/a.md')?.origin).toBe('anchor');
    expect(r.notes.get('x.md')).toEqual({ origin: 'outgoing', level: 1, termination: false });
  });

  it('E5: destino de terminación se incluye pero no se expande', () => {
    const r = expandNeighborhood(graph([['P/a', 'X/x'], ['X/x', 'z']]), 'P/a.md', ['P/a.md'], cfg(2, 0, ['X']));
    expect(r.notes.get('X/x.md')).toEqual({ origin: 'outgoing', level: 1, termination: true });
    expect(r.notes.has('z.md')).toBe(false);
  });

  it('E6: ancla dentro de una carpeta de terminación sí se expande en nivel 1', () => {
    const r = expandNeighborhood(graph([['J/d', 'J/e'], ['J/e', 'f'], ['g', 'J/d']]), 'J/d.md', ['J/d.md'], cfg(2, 2, ['J']));
    expect(r.notes.get('J/e.md')).toEqual({ origin: 'outgoing', level: 1, termination: true });
    expect(r.notes.has('f.md')).toBe(false);
    expect(r.notes.get('g.md')?.origin).toBe('incoming');
  });

  it('E7: alcanzable por ambas direcciones → saliente', () => {
    const r = expandNeighborhood(graph([['P/a', 'x'], ['x', 'P/a']]), 'P/a.md', ['P/a.md'], cfg(2, 2));
    expect(r.notes.get('x.md')?.origin).toBe('outgoing');
    expect(levels(r, 'incoming')).toEqual({});
  });

  it('E7b: lo hallado por entrantes no expande salientes (y viceversa)', () => {
    const r = expandNeighborhood(graph([['i', 'P/a'], ['i', 'q'], ['P/a', 'x'], ['r', 'x']]), 'P/a.md', ['P/a.md'], cfg(3, 3));
    expect(r.notes.has('q.md')).toBe(false); // saliente de una entrante
    expect(r.notes.has('r.md')).toBe(false); // entrante de una saliente
  });

  it('E8: destinos no .md se ignoran', () => {
    const r = expandNeighborhood(graph([['P/a', 'foto.png']]), 'P/a.md', ['P/a.md'], cfg(2, 2));
    expect(r.notes.size).toBe(1);
  });

  it('E10: ancla en la raíz → la base es todo el vault', () => {
    const s = new IndexStore();
    for (const p of ['r.md', 'A/x.md', 'B/C/y.md']) s.upsert(rec(p));
    const r = computeFocusScope(s, 'r.md', { ...DEFAULT_FOCUS_SETTINGS, outgoingLinksLevels: 0, incomingLinksLevels: 0 });
    expect([...r.notes.keys()].sort()).toEqual(['A/x.md', 'B/C/y.md', 'r.md']);
  });

  it('E11: maxOutgoingLevel = último nivel con resultados', () => {
    const r = expandNeighborhood(graph([['P/a', 'x']]), 'P/a.md', ['P/a.md'], cfg(3, 0));
    expect(r.stats.maxOutgoingLevel).toBe(1);
  });

  it('E12: validate acota niveles y repara listas', () => {
    const v = validateFocusSettings({ outgoingLinksLevels: 99, incomingLinksLevels: -3, terminationFolders: 'x' });
    expect(v.outgoingLinksLevels).toBe(10);
    expect(v.incomingLinksLevels).toBe(0);
    expect(v.terminationFolders).toEqual(DEFAULT_FOCUS_SETTINGS.terminationFolders);
    expect(validateFocusSettings(null)).toEqual(DEFAULT_FOCUS_SETTINGS);
    expect(validateFocusSettings({ outgoingLinksLevels: '3', terminationNotes: ['Plan.md', 4, ' '] })).toMatchObject({
      outgoingLinksLevels: 3, terminationNotes: ['Plan.md'],
    });
  });

  it('E13: isTerminationPath', () => {
    expect(isTerminationPath('J/sub/n.md', ['J'], [])).toBe(true);
    expect(isTerminationPath('Jx/n.md', ['J'], [])).toBe(false);
    expect(isTerminationPath('03 - G/AI - Journals/2026/d.md', ['AI - Journals'], [])).toBe(true);
    expect(isTerminationPath('03 - G/AI - Journals/2026/d.md', ['03 - G/AI - Journals'], [])).toBe(true);
    expect(isTerminationPath('03 - G/AI - Journals2/d.md', ['03 - G/AI - Journals'], [])).toBe(false);
    expect(isTerminationPath('X/Y/Plan.md', [], ['Plan.md'])).toBe(true);
    expect(isTerminationPath('X/Y/Plan.md', [], ['Plan'])).toBe(true);
    expect(isTerminationPath('X/Y/Plan.md', [], ['X/Y/Plan.md'])).toBe(true);
    expect(isTerminationPath('X/Y/Planes.md', [], ['Plan'])).toBe(false);
  });

  it('badges de origen', () => {
    expect(originBadge({ origin: 'outgoing', level: 2, termination: false })).toBe('➡️2');
    expect(originBadge({ origin: 'incoming', level: 1, termination: true })).toBe('⬅️1 🛑');
    expect(originBadge({ origin: 'folder', level: 0, termination: false })).toBe('');
    expect(originBadge(undefined)).toBe('');
  });
});

function rec(path: string, extra: Partial<NoteRecord> = {}): NoteRecord {
  return {
    path, basename: basenameOf(path), folder: folderOf(path), ctime: 0, mtime: 0, type: 'Ax', estado: '',
    fm: {}, outLinks: [], originLinks: [], tasks: [], ...extra,
  };
}

describe('computeFocusScope sobre el índice', () => {
  const s = new IndexStore();
  s.upsert(rec('P/P.md', { outLinks: ['Lib/x.md'] }));
  s.upsert(rec('P/sub/n.md', { tasks: parseTasksInNote('- [ ] propia #cx-Casa', 'P/sub/n.md') }));
  s.upsert(rec('Lib/x.md', { tasks: parseTasksInNote('- [ ] enlazada ⛔ dep1', 'Lib/x.md') }));
  s.upsert(rec('H/h.md', { originLinks: ['P/P.md'], tasks: parseTasksInNote('- [ ] hija', 'H/h.md') }));
  s.upsert(rec('O/o.md', { tasks: parseTasksInNote('- [ ] fuera 🆔 dep1', 'O/o.md') }));

  it('carpeta recursiva + salientes; `origen` solo si includeOrigin', () => {
    const r = computeFocusScope(s, 'P/P.md', DEFAULT_FOCUS_SETTINGS);
    expect([...r.notes.keys()].sort()).toEqual(['Lib/x.md', 'P/P.md', 'P/sub/n.md']);
    const r2 = computeFocusScope(s, 'P/P.md', { ...DEFAULT_FOCUS_SETTINGS, includeOrigin: true });
    expect(r2.notes.get('H/h.md')?.origin).toBe('incoming');
    expect(focusSummary(r2)).toContain('⬅️ 1 entrantes');
  });

  it('tasksInScope solo devuelve tareas del ámbito', () => {
    const r = computeFocusScope(s, 'P/P.md', DEFAULT_FOCUS_SETTINGS);
    expect(tasksInScope(s, r.notes.keys()).map((t) => t.text)).toEqual(['enlazada', 'propia']);
  });
});
