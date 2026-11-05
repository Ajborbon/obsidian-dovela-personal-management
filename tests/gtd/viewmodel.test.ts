import { describe, expect, it } from 'vitest';
import { AGENDA_TODAY, classifyTasks, navigationItems } from '../../src/core/gtd/classify';
import {
  EMPTY_FILTER, activeFilterCount, filterLists, normalizeFilterValue, taskFilter, totalLabel, uniqueTaskCount,
} from '../../src/core/gtd/filters';
import {
  agendaSummary, appointmentMinutes, buildSections, defaultOpenIds, expandableIds, formatAgendaMinutes,
  noteInfosFromRecords, overdueGroups, searchTree, taskBreadcrumb, treePaths,
} from '../../src/core/gtd/viewmodel';
import { IndexStore, basenameOf, folderOf, type NoteRecord } from '../../src/core/index/store';
import { buildHierarchy } from '../../src/core/notes/hierarchy';
import { parseTasksInNote } from '../../src/core/tasks/parse';
import { tasksInScope } from '../../src/core/gtd/focus';

const H = '2026-11-05';
const Y = '2026-11-04';
const Y3 = '2026-11-02';

const LINES = [
  '- [ ] A sin nada',
  '- [ ] B comprar pan #cx-Casa',
  '- [ ] C llamar #cx-Oficina #px-Ana',
  '- [ ] D revisar #px-Ana',
  `- [ ] E reunión 📅 ${H} [hI:: 09:00] [hF:: 10:30]`,
  `- [ ] F demo 📅 ${H} [hI:: 14:00] [45min]`,
  `- [ ] G café 📅 ${H} [hI:: 16:00]`,
  `- [ ] V1 vencida 📅 ${Y} #cx-Casa #cx-Oficina`,
  `- [ ] V2 vencida ⏳ ${Y3} #px-Luis`,
  '- [ ] Ñ tarea con acentos #cx-Café',
  '- [/] P en progreso #cx-Casa',
];
const tasks = parseTasksInNote(LINES.join('\n'), 'AV - Vida/PGTD - P/PGTD - P.md');
const cls = classifyTasks(tasks, { today: H });

describe('Agenda de Hoy', () => {
  it('suma fin−inicio, duración o 30 min (v1)', () => {
    const agenda = cls.lists.hopeToday.get(AGENDA_TODAY)!;
    expect(agenda.map((t) => t.text.split(' ')[0])).toEqual(['E', 'F', 'G']);
    expect(agenda.map(appointmentMinutes)).toEqual([90, 45, 30]);
    expect(agendaSummary(agenda)).toBe('3 citas - 2h 45min');
  });
  it('formato v1', () => {
    expect(formatAgendaMinutes(120)).toBe('2h');
    expect(formatAgendaMinutes(45)).toBe('45min');
    expect(formatAgendaMinutes(0)).toBe('0min');
  });
  it('cita que cruza medianoche', () => {
    const [t] = parseTasksInNote(`- [ ] N 📅 ${H} [hI:: 23:00] [hF:: 01:00]`, 'x.md');
    expect(appointmentMinutes(t!)).toBe(120);
  });
});

describe('filtros sobre datos', () => {
  it('normaliza valores', () => {
    expect(normalizeFilterValue('#cx-Casa ', 'cx')).toBe('casa');
    expect(normalizeFilterValue('@Ana', 'px')).toBe('ana');
    expect(normalizeFilterValue('px-Ana', 'px')).toBe('ana');
  });

  it('contexto: coincidencia exacta (no subcadena)', () => {
    const keep = taskFilter({ ...EMPTY_FILTER, context: 'Cas' });
    expect(tasks.filter(keep)).toHaveLength(0);
    const keep2 = taskFilter({ ...EMPTY_FILTER, context: 'casa' });
    expect(tasks.filter(keep2).map((t) => t.text.split(' ')[0])).toEqual(['B', 'V1', 'P']);
    const keep3 = taskFilter({ ...EMPTY_FILTER, context: 'Café' });
    expect(tasks.filter(keep3).map((t) => t.text.split(' ')[0])).toEqual(['Ñ']);
  });

  it('persona + texto se combinan (Y)', () => {
    const keep = taskFilter({ context: '', person: 'Ana', text: 'LLAM' });
    expect(tasks.filter(keep).map((t) => t.text.split(' ')[0])).toEqual(['C']);
  });

  it('filterLists quita sublistas vacías y conserva tareas en todas sus sublistas', () => {
    const f = { ...EMPTY_FILTER, context: 'Oficina' };
    const fl = filterLists(cls.lists, f);
    // V1 (Casa + Oficina) sigue en ambas sublistas, como en v1.
    expect([...fl.nextActions.keys()].sort()).toEqual(['cx-Casa', 'cx-Oficina']);
    expect(fl.nextActions.get('cx-Casa')!.map((t) => t.text.split(' ')[0])).toEqual(['V1']);
    expect([...fl.assigned.keys()]).toEqual(['px-Ana']);
    expect(fl.inbox).toHaveLength(0);
    expect([...fl.overdue.keys()].sort()).toEqual([`📅 ${Y}|cx-Casa`, `📅 ${Y}|cx-Oficina`]);
    // C y V1: 2 únicas.
    expect(uniqueTaskCount(fl)).toBe(2);
    expect(totalLabel(fl, cls.openTasks.length, f)).toBe(`Tareas filtradas: 2 (de ${cls.openTasks.length})`);
  });

  it('sin filtro: mismas listas y total de abiertas únicas', () => {
    expect(filterLists(cls.lists, EMPTY_FILTER)).toBe(cls.lists);
    expect(activeFilterCount(EMPTY_FILTER)).toBe(0);
    expect(uniqueTaskCount(cls.lists)).toBe(cls.openTasks.length);
    expect(totalLabel(cls.lists, 11, EMPTY_FILTER)).toBe('Total de Tareas Abiertas: 11');
  });

  it('conteos por sublista (entradas) vs únicos', () => {
    const nav = navigationItems(cls.lists);
    const next = nav.find((n) => n.id === 'nextActions')!;
    // B, C, V1×2, Ñ, P → 6 entradas
    expect(next.count).toBe(6);
  });
});

describe('secciones y Vencidas', () => {
  it('orden de navegación v1 con Ojalá Hoy primero y Agenda al principio', () => {
    const s = buildSections(cls.lists);
    expect(s[0]!.id).toBe('hopeToday');
    expect(s[0]!.groups![0]!.key).toBe(AGENDA_TODAY);
    expect(s[0]!.groups![0]!.countLabel).toBe('3 citas - 2h 45min');
    expect(s.map((x) => x.id)).toEqual(navigationItems(cls.lists).map((n) => n.id));
    const next = s.find((x) => x.id === 'nextActions')!;
    expect(next.groups!.map((g) => g.label)).toEqual(['Café', 'Casa', 'Oficina']);
    expect(next.groups!.map((g) => g.anchor)).toEqual(
      navigationItems(cls.lists).find((n) => n.id === 'nextActions')!.sublists.map((x) => x.anchor).sort((a, b) =>
        next.groups!.findIndex((g) => g.anchor === a) - next.groups!.findIndex((g) => g.anchor === b)),
    );
  });

  it('date-first: primaria por fecha ascendente, secundarias alfabéticas', () => {
    const g = overdueGroups(cls.lists.overdue);
    expect(g.map((x) => x.key)).toEqual([`📅 ${Y3}`, `📅 ${Y}`]);
    expect(g[1]!.children.map((c) => c.label)).toEqual(['Casa', 'Oficina']);
    expect(g[0]!.children[0]!.icon).toBe('👤');
    expect(g[1]!.count).toBe(2);
  });

  it('context-first: primarias alfabéticas por contexto/persona', () => {
    const c2 = classifyTasks(tasks, { today: H, overdueMode: 'context-first' });
    const g = overdueGroups(c2.lists.overdue);
    expect(g.map((x) => x.label)).toEqual(['👤 Luis', '📋 Casa', '📋 Oficina'].sort((a, b) => a.localeCompare(b, 'es')));
    expect(g.find((x) => x.label === '📋 Casa')!.children[0]!.label).toBe(Y);
  });
});

describe('breadcrumbs', () => {
  it('T1: Vault > carpeta > nota', () => {
    expect(taskBreadcrumb('AV - X/Ax N.md')).toBe('Vault > AV - X > Ax N');
  });
  it('nota‑carpeta no se repite', () => {
    expect(taskBreadcrumb('AV - Vida/PGTD - P/PGTD - P.md')).toBe('Vault > AV - Vida > PGTD - P');
    expect(taskBreadcrumb('raiz.md')).toBe('Vault > raiz');
  });
});

function rec(path: string, body = '', extra: Partial<NoteRecord> = {}): NoteRecord {
  return {
    path, basename: basenameOf(path), folder: folderOf(path), ctime: 0, mtime: 0, type: 'Ax', estado: '',
    fm: {}, outLinks: [], originLinks: [], tasks: parseTasksInNote(body, path), ...extra,
  };
}

describe('jerarquía desde el índice', () => {
  const store = new IndexStore();
  store.upsert(rec('01 - Prod/01 - Prod.md', '', { type: 'GrupoAV' }));
  store.upsert(rec('01 - Prod/AV - Foo/AV - Foo.md', '- [ ] a\n- [/] b\n- [x] c', { type: 'AV', estado: '🟢' }));
  store.upsert(rec('01 - Prod/AV - Foo/PGTD - P1/Ax nota.md', '- [ ] d'));
  store.upsert(rec('02 - Sin/Ax suelta.md', '- [ ] e\n- [-] f'));
  const root = buildHierarchy(noteInfosFromRecords(store.all()));

  it('conteos propios/totales y en progreso', () => {
    const prod = root.children.find((c) => c.name === '01 - Prod')!;
    const foo = prod.children[0]!;
    expect(foo.name).toBe('AV - Foo');
    expect(foo.own).toBe(2);
    expect(foo.inProgress).toBe(1);
    expect(foo.estado).toBe('🟢');
    expect(prod.total).toBe(3);
    const missing = root.children.find((c) => c.name === '[FALTA] 02 - Sin')!;
    expect(missing.missing).toBe(true);
    expect(missing.total).toBe(1);
  });

  it('abiertos por defecto, expandibles y rutas', () => {
    expect(defaultOpenIds(root)).toContain('01 - Prod/01 - Prod.md');
    expect(expandableIds(root).length).toBeGreaterThanOrEqual(defaultOpenIds(root).length);
    expect(treePaths(root)).toContain('02 - Sin/Ax suelta.md');
  });

  it('búsqueda por título abre ancestros; por contenido usa rutas', () => {
    const r = searchTree(root, 'nota');
    expect([...r.titleMatches]).toEqual(['01 - Prod/AV - Foo/PGTD - P1/Ax nota.md']);
    expect(r.visible.has('01 - Prod/01 - Prod.md')).toBe(true);
    expect(r.expand.has('01 - Prod/AV - Foo/AV - Foo.md')).toBe(true);
    expect(r.visible.has('02 - Sin')).toBe(false);
    const c = searchTree(root, 'zzz', new Set(['02 - Sin/Ax suelta.md']));
    expect([...c.contentMatches]).toEqual(['02 - Sin/Ax suelta.md']);
    expect(c.visible.has('02 - Sin')).toBe(true);
    expect(searchTree(root, '  ').visible.size).toBe(0);
  });
});

describe('Foco: dependencias contra todo el vault', () => {
  const store = new IndexStore();
  store.upsert(rec('P/a.md', '- [ ] depende #cx-Casa ⛔ ext1\n- [ ] rota ⛔ nadie'));
  store.upsert(rec('O/o.md', '- [ ] externa 🆔 ext1'));
  it('una dependencia fuera del foco sigue bloqueando (v1 la daba por resuelta)', () => {
    const scoped = tasksInScope(store, ['P/a.md']);
    const c = classifyTasks(scoped, { today: H, taskById: store.taskById() });
    expect(c.openTasks).toHaveLength(2);
    expect(c.lists.paused.map((t) => t.text)).toEqual(['depende']);
    expect(c.missingDependencies.get('P/a.md#1')).toEqual(['nadie']);
  });
});
