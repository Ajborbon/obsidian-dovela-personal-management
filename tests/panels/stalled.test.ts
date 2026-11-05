import { describe, expect, it } from 'vitest';
import { IndexStore, type NoteRecord } from '../../src/core/index/store';
import { detectNoteType, normalizeEstado } from '../../src/core/notes/types';
import { parseTasksInNote } from '../../src/core/tasks/parse';
import {
  collectProjects, explicitType, findStalledProjects, isProjectNote, knowledgeNotesWithTasks, projectHierarchy,
  projectLevel, projectState, summarizeProjects,
} from '../../src/core/panels/stalled';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 5, 12);

function rec(path: string, opts: { body?: string; estado?: string; out?: string[]; mtime?: number; fm?: Record<string, unknown> } = {}): NoteRecord {
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  const basename = path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '');
  return {
    path, basename, folder, ctime: 0, mtime: opts.mtime ?? NOW,
    type: detectNoteType(basename, opts.fm?.['type']),
    estado: normalizeEstado(opts.estado), fm: opts.fm ?? {},
    outLinks: opts.out ?? [], originLinks: [],
    tasks: opts.body ? parseTasksInNote(opts.body, path) : [],
  };
}

function store(...recs: NoteRecord[]): IndexStore {
  const s = new IndexStore();
  for (const r of recs) s.upsert(r);
  return s;
}

const P = 'Areas/PGTD Alfa';

describe('detección de proyectos', () => {
  it('nota-carpeta X/X.md con carpeta «PGTD »', () => {
    expect(isProjectNote({ folder: P, basename: 'PGTD Alfa' })).toBe(true);
    expect(isProjectNote({ folder: P, basename: 'Otra' })).toBe(false);
    expect(isProjectNote({ folder: 'Areas/PGTDAlfa', basename: 'PGTDAlfa' })).toBe(false);
    expect(isProjectNote({ folder: '', basename: 'PGTD Alfa' })).toBe(false);
  });

  it('nivel por anidamiento de carpetas PGTD', () => {
    expect(projectLevel('A/PGTD x')).toBe(1);
    expect(projectLevel('A/PGTD x/B/PGTD y')).toBe(2);
    expect(projectLevel('PGTD x/PGTD y/PGTD z')).toBe(3);
    expect(projectLevel('PGTD x/PGTD y/PGTD z/PGTD w')).toBe(3);
  });

  it('estado normalizado (tolera selector de variación)', () => {
    expect(projectState('🟢')).toBe('active');
    expect(projectState('🟢️ ')).toBe('active');
    expect(projectState('🔵')).toBe('archived');
    expect(projectState('🟡')).toBe('paused');
    expect(projectState('🔴')).toBe('blocked');
    expect(projectState(undefined)).toBe('none');
  });
});

describe('findStalledProjects', () => {
  it('activo sin tareas abiertas → estancado', () => {
    const s = store(rec(`${P}/PGTD Alfa.md`, { estado: '🟢', body: '- [x] hecho ✅ 2026-11-01\n- [-] cancelada' }));
    expect(findStalledProjects(s).map((p) => p.name)).toEqual(['PGTD Alfa']);
  });

  it('cuenta `[ ]` y `[/]` como abiertas (también en subcarpetas)', () => {
    const open = store(rec(`${P}/PGTD Alfa.md`, { estado: '🟢' }), rec(`${P}/sub/nota.md`, { body: '- [ ] algo' }));
    expect(findStalledProjects(open)).toEqual([]);
    const inProgress = store(rec(`${P}/PGTD Alfa.md`, { estado: '🟢', body: '- [/] en curso' }));
    expect(findStalledProjects(inProgress)).toEqual([]);
  });

  it('no activos no se listan aunque no tengan tareas', () => {
    const s = store(
      rec(`${P}/PGTD Alfa.md`, { estado: '🔵' }),
      rec('B/PGTD Beta/PGTD Beta.md', { estado: '🟡' }),
      rec('C/PGTD Gama/PGTD Gama.md'),
    );
    expect(findStalledProjects(s)).toEqual([]);
  });

  it('carpeta PGTD sin nota-carpeta se omite', () => {
    const s = store(rec(`${P}/otra.md`, { estado: '🟢' }));
    expect(findStalledProjects(s)).toEqual([]);
  });

  it('enlaces salientes a 2 niveles cuentan; el 3.º no', () => {
    const base = (dest: string): NoteRecord[] => [
      rec(`${P}/PGTD Alfa.md`, { estado: '🟢', out: ['n1.md'] }),
      rec('n1.md', { out: ['n2.md'] }),
      rec('n2.md', { out: ['n3.md'] }),
      rec('n3.md'),
      rec(dest, { body: '- [ ] abierta' }),
    ];
    // tarea abierta en el nivel 2 → no estancado
    const s2 = store(...base('n2.md'));
    expect(findStalledProjects(s2)).toEqual([]);
    // tarea abierta solo en el nivel 3 → estancado
    const s3 = store(...base('n3.md'));
    const stalled = findStalledProjects(s3);
    expect(stalled.map((p) => p.path)).toEqual([`${P}/PGTD Alfa.md`]);
    expect(stalled[0]?.filesChecked).toBe(3);
  });

  it('jerarquía sin repetir y con ciclos', () => {
    const s = store(rec('a.md', { out: ['b.md'] }), rec('b.md', { out: ['a.md', 'c.md'] }), rec('c.md'));
    expect([...projectHierarchy(s, ['a.md'])].sort()).toEqual(['a.md', 'b.md', 'c.md']);
  });

  it('un PGTD anidado activo con tareas evita que el padre salga como estancado (carpeta recursiva, como v1)', () => {
    const s = store(
      rec(`${P}/PGTD Alfa.md`, { estado: '🟢' }),
      rec(`${P}/PGTD Hijo/PGTD Hijo.md`, { estado: '🟢', body: '- [ ] x' }),
    );
    expect(findStalledProjects(s)).toEqual([]);
  });
});

describe('summarizeProjects', () => {
  it('cuenta por nivel y estado; sin modificar > N días (no archivados)', () => {
    const s = store(
      rec(`${P}/PGTD Alfa.md`, { estado: '🟢', mtime: NOW - 40 * DAY }),
      rec(`${P}/nota.md`, { mtime: NOW - 35 * DAY }),
      rec(`${P}/PGTD Hijo/PGTD Hijo.md`, { estado: '🟡', mtime: NOW - 5 * DAY }),
      rec(`${P}/PGTD Hijo/PGTD Nieto/PGTD Nieto.md`, { estado: '🔴', mtime: NOW - 100 * DAY }),
      rec('B/PGTD Beta/PGTD Beta.md', { estado: '🔵', mtime: NOW - 400 * DAY }),
      rec('C/PGTD Gama/PGTD Gama.md', { mtime: NOW - 31 * DAY }),
    );
    const { projects } = collectProjects(s);
    expect(projects.map((p) => [p.name, p.level, p.state])).toEqual([
      ['PGTD Alfa', 1, 'active'],
      ['PGTD Hijo', 2, 'paused'],
      ['PGTD Nieto', 3, 'blocked'],
      ['PGTD Beta', 1, 'archived'],
      ['PGTD Gama', 1, 'none'],
    ]);
    // La carpeta de Alfa incluye a sus hijos: su última modificación es la del Hijo (hace 5 días).
    expect(projects[0]?.lastModified).toBe(NOW - 5 * DAY);
    const sum = summarizeProjects(projects, NOW, 30);
    expect(sum.levels.map((l) => [l.level, l.total, l.active, l.paused, l.blocked, l.archived, l.none, l.stale])).toEqual([
      [1, 3, 1, 0, 0, 1, 1, 1],
      [2, 1, 0, 1, 0, 0, 0, 0],
      [3, 1, 0, 0, 1, 0, 0, 1],
    ]);
    expect(sum.staleProjects.map((p) => [p.name, p.daysSince])).toEqual([['PGTD Nieto', 100], ['PGTD Gama', 31]]);
  });
});

describe('tareas en notas de conocimiento', () => {
  it('solo tipos de conocimiento declarados con tareas abiertas', () => {
    const notes = [
      rec('Ax 250101 - idea.md', { body: '- [ ] a\n- [/] b\n- [x] c' }),
      rec('Btx 250101 - bitácora.md', { body: '- [x] c' }),
      rec('nota suelta.md', { body: '- [ ] sin tipo (no es Ax explícita)' }),
      rec('lectura.md', { fm: { type: 'Ref' }, body: '- [ ] leer' }),
      rec('PGTD Alfa.md', { body: '- [ ] tarea de proyecto' }),
    ];
    const out = knowledgeNotesWithTasks(notes);
    expect(out.map((n) => [n.basename, n.type, n.openTasks])).toEqual([
      ['Ax 250101 - idea', 'Ax', 2],
      ['lectura', 'Ref', 1],
    ]);
    expect(explicitType(rec('nota suelta.md'))).toBeNull();
  });
});
