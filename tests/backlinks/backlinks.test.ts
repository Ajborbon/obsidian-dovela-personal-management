import { describe, expect, it } from 'vitest';
import { IndexStore, type NoteRecord } from '../../src/core/index/store';
import {
  countReasons, entryFromRecord, findBacklinks, isRelevantChange, type BacklinkEntry,
} from '../../src/core/backlinks/detect';
import { DEFAULT_SORT, nextSortState, sanitizeSort, sortBacklinks, type SortState } from '../../src/core/backlinks/sort';
import { assembleTreeEntries, buildFolderTree, shouldExpandFolder, treeFileOrder } from '../../src/core/backlinks/tree';
import { formatDateTime, formatMoney, parseAmount } from '../../src/core/backlinks/format';
import { groupOpenTabs } from '../../src/core/backlinks/tabs';
import {
  DEFAULT_PREFS, LEGACY_BACKLINK_SETTINGS_KEY, LEGACY_MIGRATED_KEY, PREFS_CACHE_KEY, legacyToPrefs, loadPrefs,
  sanitizePrefs, type PrefsStorage,
} from '../../src/core/backlinks/prefs';

function rec(path: string, opts: Partial<NoteRecord> = {}): NoteRecord {
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  return {
    path, basename: path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, ''), folder,
    ctime: 0, mtime: 0, type: 'Ax', estado: '', fm: {}, outLinks: [], originLinks: [], tasks: [],
    ...opts,
  };
}

function entry(basename: string, o: Partial<BacklinkEntry> = {}): BacklinkEntry {
  return {
    path: `C/${basename}.md`, basename, folder: 'C', typeLabel: '', estado: '', ctime: 0, mtime: 0,
    moneda: undefined, monto: undefined, reasons: ['folder'], ...o,
  };
}

function fixture(): IndexStore {
  const s = new IndexStore();
  s.upsert(rec('P/a.md'));
  s.upsert(rec('P/b.md', { fm: { type: 'Tx', moneda: 'COP', monto: 1500 }, estado: '🟢' }));
  s.upsert(rec('P/sub/c.md', { outLinks: ['P/a.md'] }));
  s.upsert(rec('Z/x.md', { outLinks: ['P/a.md'], originLinks: ['P/a.md'] }));
  s.upsert(rec('Z/hija.md', { originLinks: ['P/a.md'] }));
  s.upsert(rec('Z/otra.md', { outLinks: ['Z/x.md'] }));
  return s;
}

describe('detección de backlinks (RI-D §2.1)', () => {
  it('hermanas directas ∪ enlaces entrantes, con motivos', () => {
    const r = findBacklinks(fixture(), 'P/a.md', { includeOrigin: false });
    expect(r.map((e) => [e.path, e.reasons])).toEqual([
      ['P/b.md', ['folder']],
      ['P/sub/c.md', ['link']], // subcarpeta: solo por enlace, no por carpeta
      ['Z/x.md', ['link']],
    ]);
  });

  it('con origen: añade hijas por `origen` y marca ambos motivos', () => {
    const r = findBacklinks(fixture(), 'P/a.md', { includeOrigin: true });
    expect(r.map((e) => [e.path, e.reasons])).toEqual([
      ['P/b.md', ['folder']],
      ['P/sub/c.md', ['link']],
      ['Z/hija.md', ['origin']],
      ['Z/x.md', ['link', 'origin']],
    ]);
    expect(countReasons(r)).toEqual({ total: 4, link: 2, origin: 2, folder: 1 });
  });

  it('nunca incluye la propia nota; nota en la raíz usa hermanas de la raíz', () => {
    const s = new IndexStore();
    s.upsert(rec('r1.md', { outLinks: ['r1.md'] }));
    s.upsert(rec('r2.md'));
    s.upsert(rec('A/n.md'));
    expect(findBacklinks(s, 'r1.md', { includeOrigin: true }).map((e) => e.path)).toEqual(['r2.md']);
  });

  it('nota sin backlinks → lista vacía', () => {
    const s = new IndexStore();
    s.upsert(rec('A/solo.md'));
    expect(findBacklinks(s, 'A/solo.md', { includeOrigin: true })).toEqual([]);
  });

  it('entrada con campos del frontmatter', () => {
    const e = entryFromRecord(rec('P/b.md', { fm: { type: ' Tx ', moneda: 'COP', monto: 10 }, estado: '🟢', ctime: 5, mtime: 9 }), ['folder']);
    expect(e).toMatchObject({ typeLabel: 'Tx', estado: '🟢', moneda: 'COP', monto: 10, ctime: 5, mtime: 9, folder: 'P' });
    expect(entryFromRecord(rec('a.md', { fm: { type: 3 } }), []).typeLabel).toBe('');
  });

  it('relevancia de cambios del índice', () => {
    const s = fixture();
    const shown = new Set(['P/b.md', 'Z/x.md']);
    const rel = (paths: string[], expanded = false): boolean => isRelevantChange(new Set(paths), 'P/a.md', shown, s, expanded);
    expect(rel(['*'])).toBe(true);
    expect(rel(['P/a.md'])).toBe(true); // la propia nota
    expect(rel(['Z/x.md'])).toBe(true); // ya era backlink
    expect(rel(['P/nueva.md'])).toBe(true); // hermana nueva (o borrada)
    expect(rel(['Z/hija.md'])).toBe(true); // enlaza por origen
    expect(rel(['Z/otra.md'])).toBe(false); // no tiene relación
    expect(rel(['P/sub/zz.md'])).toBe(false);
    expect(rel(['P/sub/zz.md'], true)).toBe(true); // árbol expandido: subcarpetas
    expect(isRelevantChange(new Set(['Z/x.md']), null, shown, s)).toBe(false);
  });
});

describe('ordenamientos (RI-D §6.3 S1–S11)', () => {
  const n1 = entry('b', { typeLabel: '', estado: '🟢', ctime: 10 });
  const n2 = entry('A', { typeLabel: 'Tx', estado: '', ctime: 30 });
  const n3 = entry('a2', { typeLabel: 'Ax', estado: '🔴', ctime: 20 });
  const list = [n1, n2, n3];

  it('S1–S2: archivo', () => {
    expect(sortBacklinks(list, 'name', 'asc').map((e) => e.basename)).toEqual(['A', 'a2', 'b']);
    expect(sortBacklinks(list, 'name', 'desc').map((e) => e.basename)).toEqual(['b', 'a2', 'A']);
  });

  it('S3: tipo (vacío primero)', () => {
    expect(sortBacklinks(list, 'type', 'asc').map((e) => e.basename)).toEqual(['b', 'a2', 'A']);
  });

  it('S4: estado desc deja el vacío al final', () => {
    const r = sortBacklinks(list, 'estado', 'desc');
    expect(r[r.length - 1]?.basename).toBe('A');
  });

  it('S5–S6: clave desconocida → copia sin cambios; nunca muta', () => {
    const copy = [...list];
    const r = sortBacklinks(list, 'zzz' as never, 'asc');
    expect(r).toEqual(list);
    expect(r).not.toBe(list);
    sortBacklinks(list, 'name', 'asc');
    expect(list).toEqual(copy);
  });

  it('S7–S8: fechas y estabilidad', () => {
    expect(sortBacklinks(list, 'ctime', 'desc').map((e) => e.ctime)).toEqual([30, 20, 10]);
    expect(sortBacklinks(list, 'ctime', 'asc').map((e) => e.ctime)).toEqual([10, 20, 30]);
    const ties = [entry('x', { mtime: 1 }), entry('y', { mtime: 1 }), entry('z', { mtime: 1 })];
    expect(sortBacklinks(ties, 'mtime', 'desc').map((e) => e.basename)).toEqual(['x', 'y', 'z']);
  });

  it('ruta ordena por carpeta', () => {
    const r = sortBacklinks([entry('a', { folder: 'Z' }), entry('b', { folder: 'A/B' }), entry('c', { folder: '' })], 'path', 'asc');
    expect(r.map((e) => e.folder)).toEqual(['', 'A/B', 'Z']);
  });

  it('S9: columnas', () => {
    let s: SortState = DEFAULT_SORT;
    s = nextSortState(s, 'name', 0);
    expect([s.key, s.dir]).toEqual(['name', 'asc']);
    s = nextSortState(s, 'name', 5000);
    expect([s.key, s.dir]).toEqual(['name', 'desc']);
    s = nextSortState(s, 'type', 10000);
    expect([s.key, s.dir]).toEqual(['type', 'asc']);
  });

  it('S10: fechas (clic simple no cambia, doble clic invierte, otra fecha → desc)', () => {
    let s: SortState = DEFAULT_SORT;
    expect([s.key, s.dir]).toEqual(['ctime', 'desc']);
    s = nextSortState(s, 'ctime', 1000);
    expect(s.dir).toBe('desc');
    s = nextSortState(s, 'ctime', 1500);
    expect(s.dir).toBe('asc');
    s = nextSortState(s, 'mtime', 9000);
    expect([s.key, s.dir]).toEqual(['mtime', 'desc']);
  });

  it('S11: doble clic en Ruta alterna el modo expandido; clics lentos no', () => {
    let s: SortState = DEFAULT_SORT;
    s = nextSortState(s, 'path', 0);
    s = nextSortState(s, 'path', 300);
    expect(s.expandedTree).toBe(true);
    s = nextSortState(s, 'path', 5000);
    s = nextSortState(s, 'path', 5200);
    expect(s.expandedTree).toBe(false);
    s = nextSortState(s, 'path', 10000);
    s = nextSortState(s, 'path', 11000);
    expect(s.expandedTree).toBe(false);
    // Tres clics rápidos: solo el primer par cuenta como doble.
    let t: SortState = DEFAULT_SORT;
    t = nextSortState(t, 'path', 0);
    t = nextSortState(t, 'path', 100);
    t = nextSortState(t, 'path', 200);
    expect(t.expandedTree).toBe(true);
  });

  it('sanitizeSort con datos corruptos', () => {
    expect(sanitizeSort(null)).toEqual(DEFAULT_SORT);
    expect(sanitizeSort({ key: 'nope', dir: 'x', expandedTree: 'si' })).toEqual(DEFAULT_SORT);
    expect(sanitizeSort({ key: 'path', dir: 'asc', expandedTree: true })).toEqual({ key: 'path', dir: 'asc', expandedTree: true, lastClick: null });
  });
});

describe('árbol de carpetas (S12–S20)', () => {
  it('S12: estructura y conteos', () => {
    const items = ['', 'A', 'A/B', 'A/B', 'C'].map((folder, i) => ({ folder, id: i }));
    const root = buildFolderTree(items, (x) => x.folder);
    expect(root.files.map((f) => f.id)).toEqual([0]);
    expect(root.children.map((c) => c.name)).toEqual(['A', 'C']);
    const a = root.children[0]!;
    expect(a.files).toHaveLength(1);
    expect(a.children[0]!.path).toBe('A/B');
    expect(a.children[0]!.files).toHaveLength(2);
    expect(a.count).toBe(3);
    expect(root.count).toBe(5);
  });

  it('S13: subcarpetas por nombre; archivos con el orden dado', () => {
    const items = [{ folder: 'Z', n: 'b' }, { folder: 'B', n: 'z' }, { folder: 'a', n: 'x' }, { folder: 'B', n: 'a' }];
    const root = buildFolderTree(items, (x) => x.folder, (p, q) => p.n.localeCompare(q.n));
    expect(root.children.map((c) => c.name)).toEqual(['a', 'B', 'Z']);
    expect(root.children[1]!.files.map((f) => f.n)).toEqual(['a', 'z']);
  });

  it('carpetas intermedias sin archivos propios', () => {
    const root = buildFolderTree([{ folder: 'A/B/C' }], (x) => x.folder);
    expect(root.children[0]!.name).toBe('A');
    expect(root.children[0]!.children[0]!.children[0]!.path).toBe('A/B/C');
    expect(root.children[0]!.count).toBe(1);
  });

  it('S14–S20: expansión inteligente', () => {
    expect(shouldExpandFolder('A', 0, 'X/Y', false)).toBe(true);
    expect(shouldExpandFolder('A/B', 1, 'A/B/C', false)).toBe(true);
    expect(shouldExpandFolder('A/B/C', 2, 'A/B/C', false)).toBe(true);
    expect(shouldExpandFolder('A/X', 1, 'A/B/C', false)).toBe(false);
    expect(shouldExpandFolder('A/X', 1, 'A/B/C', true)).toBe(true);
    expect(shouldExpandFolder('A/X/Q', 2, 'A/B/C', true)).toBe(false);
    expect(shouldExpandFolder('A/B', 1, null, false)).toBe(false);
    expect(shouldExpandFolder('A/B', 1, 'A/Bc/d', false)).toBe(false);
  });

  it('entradas del árbol: nota actual 📍 aunque no haya backlinks (defecto D1 de v1), sin duplicados', () => {
    const cur = entry('cur', { reasons: [] });
    expect(assembleTreeEntries([], cur, []).map((t) => t.mark)).toEqual(['current']);
    const bl = entry('b');
    const extra = entry('e', { reasons: [] });
    const out = assembleTreeEntries([bl], cur, [extra, { ...bl, reasons: [] }, { ...cur }]);
    expect(out.map((t) => [t.entry.basename, t.mark])).toEqual([['cur', 'current'], ['b', 'backlink'], ['e', 'expanded']]);
    expect([...out].sort(treeFileOrder).map((t) => t.entry.basename)).toEqual(['b', 'cur', 'e']);
  });
});

describe('formatos (RI-D §6.4)', () => {
  it('monto + moneda válido', () => {
    const s = formatMoney('cop', 1500.5);
    expect(s).toMatch(/1\.?500,50/);
    expect(s).toMatch(/COP/);
  });

  it('moneda inválida NO lanza (defecto D2 de v1) y usa el respaldo', () => {
    expect(() => formatMoney('pesos', 1)).not.toThrow();
    expect(formatMoney('pesos', 1)).toBe('PESOS 1,00');
    expect(formatMoney('COP$', 2.5)).toMatch(/^COP\$ 2,50$/);
  });

  it('sin fila: moneda vacía, monto 0, vacío o no numérico', () => {
    expect(formatMoney('', 10)).toBeNull();
    expect(formatMoney(undefined, 10)).toBeNull();
    expect(formatMoney('COP', 0)).toBeNull();
    expect(formatMoney('COP', '')).toBeNull();
    expect(formatMoney('COP', null)).toBeNull();
    expect(formatMoney('COP', 'mucho')).toBeNull();
  });

  it('parseAmount: textos del frontmatter', () => {
    expect(parseAmount(1500)).toBe(1500);
    expect(parseAmount('1500.5')).toBe(1500.5);
    expect(parseAmount('1.500')).toBe(1500);
    expect(parseAmount('2.000.000')).toBe(2000000);
    expect(parseAmount('1.500,50')).toBe(1500.5);
    expect(parseAmount('$ 1.500')).toBe(1500);
    expect(parseAmount('-20')).toBe(-20);
    expect(parseAmount('1.5.5')).toBeNull();
    expect(parseAmount(Number.NaN)).toBeNull();
    expect(parseAmount({})).toBeNull();
  });

  it('fecha detallada dd/mm/aaaa, hh:mm en hora local', () => {
    const ms = new Date(2025, 8, 10, 14, 5).getTime();
    expect(formatDateTime(ms)).toBe('10/09/2025, 14:05');
    expect(formatDateTime(0)).toBe('—');
  });
});

describe('visor de pestañas (S21)', () => {
  it('un solo grupo → sin encabezados', () => {
    const g = groupOpenTabs([{ area: 'main', groupKey: 'g1', item: 1 }, { area: 'main', groupKey: 'g1', item: 2 }]);
    expect(g.showHeaders).toBe(false);
    expect(g.groups).toHaveLength(1);
    expect(g.total).toBe(2);
  });

  it('agrupa por panel y split, con orden central → izquierdo → derecho → ventana', () => {
    const g = groupOpenTabs([
      { area: 'right', groupKey: 'g3', item: 'r' },
      { area: 'main', groupKey: 'g1', item: 'm1' },
      { area: 'floating', groupKey: 'g4', item: 'f' },
      { area: 'main', groupKey: 'g2', item: 'm2' },
      { area: 'main', groupKey: 'g1', item: 'm1b' },
    ]);
    expect(g.showHeaders).toBe(true);
    expect(g.groups.map((x) => [x.label, x.items])).toEqual([
      ['📄 Panel central · 1', ['m1', 'm1b']],
      ['📄 Panel central · 2', ['m2']],
      ['▶️ Panel derecho', ['r']],
      ['🪟 Ventana', ['f']],
    ]);
  });

  it('sin pestañas', () => {
    expect(groupOpenTabs([])).toEqual({ groups: [], showHeaders: false, total: 0 });
  });
});

describe('preferencias por dispositivo y migración v1', () => {
  function memory(legacy: string | null, initial: Record<string, unknown> = {}): PrefsStorage & { data: Record<string, unknown> } {
    const data: Record<string, unknown> = { ...initial };
    return {
      data,
      get<T>(k: string, fb: T): T {
        return (k in data ? data[k] : fb) as T;
      },
      set(k: string, v: unknown): void {
        data[k] = v;
      },
      readLegacyLocalStorage(k: string): string | null {
        return k === LEGACY_BACKLINK_SETTINGS_KEY ? legacy : null;
      },
    };
  }

  it('migra estilo y longitud de v1 una sola vez', () => {
    const st = memory(JSON.stringify({ breadcrumbStyle: 'compact', maxBreadcrumbLength: 40, maxSegmentLength: 20, showFolderIcons: true }));
    const p = loadPrefs(st);
    expect(p.breadcrumbStyle).toBe('compact');
    expect(p.maxBreadcrumbLength).toBe(40);
    expect(st.data[LEGACY_MIGRATED_KEY]).toBe(true);
    expect(st.data[PREFS_CACHE_KEY]).toMatchObject({ breadcrumbStyle: 'compact', maxBreadcrumbLength: 40 });
    // Cambios posteriores en v2 no se pisan con la clave v1.
    st.data[PREFS_CACHE_KEY] = { ...(st.data[PREFS_CACHE_KEY] as object), breadcrumbStyle: 'full' };
    expect(loadPrefs(st).breadcrumbStyle).toBe('full');
  });

  it('preferencias v2 existentes tienen prioridad; JSON v1 corrupto se ignora', () => {
    const st = memory(JSON.stringify({ breadcrumbStyle: 'compact' }), { [PREFS_CACHE_KEY]: { breadcrumbStyle: 'smart' } });
    expect(loadPrefs(st).breadcrumbStyle).toBe('smart');
    expect(legacyToPrefs('{no json')).toBeNull();
    expect(legacyToPrefs(null)).toBeNull();
    expect(legacyToPrefs(JSON.stringify({ breadcrumbStyle: 'raro' }))).toBeNull();
    expect(loadPrefs(memory('{no json'))).toEqual(DEFAULT_PREFS);
  });

  it('sanitizePrefs acota y repara', () => {
    expect(sanitizePrefs({ breadcrumbStyle: 'x', maxBreadcrumbLength: 5000, detail: 'no' })).toMatchObject({
      breadcrumbStyle: 'full', maxBreadcrumbLength: 200, detail: true,
    });
    expect(sanitizePrefs({ maxBreadcrumbLength: 1 }).maxBreadcrumbLength).toBe(10);
    expect(sanitizePrefs('basura')).toEqual(DEFAULT_PREFS);
  });
});
