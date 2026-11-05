import { describe, expect, it } from 'vitest';
import { buildHierarchy, type NoteInfo, type TreeNode } from '../../src/core/notes/hierarchy';
import { detectNoteType, isActiveEstado, normalizeType } from '../../src/core/notes/types';
import { parseTasksInNote } from '../../src/core/tasks/parse';
import { processInProgress, projectGroupOf, GROUP_DATED, GROUP_OTHER, GROUP_OVERDUE } from '../../src/core/gtd/inprogress';

describe('tipos de nota', () => {
  it('frontmatter conocido, alias de v1, prefijos y defecto', () => {
    expect(detectNoteType('2025-11-05 miércoles', 'Dly')).toBe('Dly');
    expect(detectNoteType('2025-W45', 'Wk')).toBe('Wly');
    expect(detectNoteType('PGTD - Web', undefined)).toBe('PGTD');
    expect(detectNoteType('PGTD 250918 - Pomodoro', undefined)).toBe('PGTD');
    expect(detectNoteType('PGTD-Web', undefined)).toBe('Ax');
    expect(detectNoteType('Nota', 'PGTD')).toBe('PGTD');
    expect(detectNoteType('Btx 260706 - Sesión 01', undefined)).toBe('Btx');
    expect(detectNoteType('AV - Vida', 'raro')).toBe('AV');
    expect(normalizeType(42)).toBeNull();
  });
  it('estado activo tolera selector de variación', () => {
    expect(isActiveEstado('🟢')).toBe(true);
    expect(isActiveEstado(' 🟢️ ')).toBe(true);
    expect(isActiveEstado('🔵')).toBe(false);
  });
});

describe('jerarquía', () => {
  const n = (path: string, type: string, openTasks: number, ctime = 0, estado?: string): NoteInfo =>
    ({ path, type, openTasks, ctime, ...(estado ? { estado } : {}) });
  const notes: NoteInfo[] = [
    n('01 - Prod/01 - Prod.md', 'GrupoAV', 1),
    n('01 - Prod/AV - Foo/AV - Foo.md', 'AV', 2),
    n('01 - Prod/AV - Foo/PGTD - P1/PGTD - P1.md', 'PGTD', 3),
    n('01 - Prod/AV - Foo/PGTD - P1/Ax nota.md', 'Ax', 1, 5),
    n('01 - Prod/AV - Foo/PGTD - P1/RR - R.md', 'RR', 1, 1),
    n('02 - Sin/Ax suelta.md', 'Ax', 0),
    n('Foo.md', 'Ax', 9),
    n('Foo/Bar.md', 'Ax', 0),
    n('Raiz.md', 'Ax', 0),
  ];
  const root = buildHierarchy(notes);
  const find = (node: TreeNode, name: string): TreeNode | undefined =>
    node.name === name ? node : node.children.map((c) => find(c, name)).find(Boolean);

  it('fusión carpeta↔nota, marcadores y orden', () => {
    expect(root.children.map((c) => c.name)).toEqual(['[FALTA] 02 - Sin', '01 - Prod', 'Foo', 'Raiz']);
    const pgtd = find(root, 'PGTD - P1')!;
    expect(pgtd.children.map((c) => c.name)).toEqual(['RR - R', 'Ax nota']);
    expect(find(root, '[FALTA] 02 - Sin')?.missing).toBe(true);
  });
  it('conteos propios y de descendencia', () => {
    expect(find(root, '01 - Prod')).toMatchObject({ own: 1, total: 7 });
    expect(find(root, 'AV - Foo')).toMatchObject({ own: 2, total: 5 });
    expect(find(root, 'PGTD - P1')).toMatchObject({ own: 3, total: 2 });
    expect(root.total).toBe(17);
  });
  it('B-H1: la nota hermana de una carpeta sin nota interior la representa', () => {
    const foo = find(root, 'Foo')!;
    expect(foo).toMatchObject({ path: 'Foo.md', own: 9, missing: false });
    expect(foo.children.map((c) => c.name)).toEqual(['Bar']);
  });
  it('nota hermana y nota interior coexisten sin perderse', () => {
    const r = buildHierarchy([n('X.md', 'Ax', 1), n('X/X.md', 'PGTD', 2)]);
    expect(r.children.map((c) => c.path).sort()).toEqual(['X.md', 'X/X.md']);
    expect(r.total).toBe(3);
  });
});

describe('En Progreso', () => {
  const ts = parseTasksInNote([
    '- [/] a 📅 2000-01-01 ⏬',
    '- [/] b 📅 2999-01-01 [30min]',
    '- [/] c [1h] #cx-x #cx-y',
    '- [ ] d',
  ].join('\n'), 'A/PGTD - X/n.md');
  it('grupos y métricas (vectores de v1)', () => {
    const r = processInProgress(ts, '2026-11-05', 'none', 'priority');
    expect(r.groups.map((g) => [g.name, g.tasks.map((t) => t.text)])).toEqual([
      [GROUP_OVERDUE, ['a']], [GROUP_DATED, ['b']], [GROUP_OTHER, ['c']],
    ]);
    expect(r.stats).toEqual({ total: 3, overdue: 1, definedMinutes: 90, estimatedMinutes: 110 });
  });
  it('agrupación por contexto y proyecto', () => {
    const byCtx = processInProgress(ts, '2026-11-05', 'context', 'priority');
    expect(byCtx.groups.map((g) => [g.name, g.tasks.map((t) => t.text)])).toEqual([
      ['Sin Contexto', ['a', 'b']], ['@x', ['c']], ['@y', ['c']],
    ]);
    const byProj = processInProgress(ts, '2026-11-05', 'project', 'duration-asc');
    expect(byProj.groups).toHaveLength(1);
    expect(byProj.groups[0]?.name).toBe('📂 PGTD - X');
    expect(byProj.groups[0]?.tasks.map((t) => t.text)).toEqual(['b', 'c', 'a']);
  });
  it('grupo de proyecto', () => {
    expect(projectGroupOf('AV - V/AI - K/AI - Sub/x.md')).toBe('🧠 AI - Sub');
    expect(projectGroupOf('AV - V/PQ - Q/Carp/x.md')).toBe('🏠 PQ - Q');
    expect(projectGroupOf('Carp/x.md')).toBe('📁 Carp');
    expect(projectGroupOf('x.md')).toBe('Tareas Generales');
    expect(projectGroupOf('A/PGTD 250918 - Pomodoro/x.md')).toBe('📂 PGTD 250918 - Pomodoro');
  });
});
