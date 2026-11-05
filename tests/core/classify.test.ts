import { describe, expect, it } from 'vitest';
import { parseTasksInNote } from '../../src/core/tasks/parse';
import {
  AGENDA_TODAY, anchorId, classifyTasks, listSize, navigationItems, type GtdLists, type ListId,
} from '../../src/core/gtd/classify';
import type { Task } from '../../src/core/tasks/model';

const H = '2026-11-05';
const Y = '2026-11-04';
const T = '2026-11-06';
const T2 = '2026-11-10';
const Y2 = '2026-11-02';

/** Escenario de oro de RI-A §8.2 (verificado ejecutando v1), con las correcciones R y B de v2. */
const LINES: Record<string, string> = {
  A: '- [ ] A',
  B: '- [ ] B #cx-Oficina',
  C: '- [ ] C #cx-Oficina #px-Ana',
  D: '- [ ] D #px-Ana',
  E: `- [ ] E 📅 ${H}`,
  F: `- [ ] F ⏳ ${H} #cx-Casa`,
  G: `- [ ] G 📅 ${Y} #cx-Casa`,
  H: `- [ ] H ⏳ ${Y}`,
  I: `- [ ] I #cx-Casa 🛫 ${T}`,
  J: `- [ ] J 🛫 ${Y}`,
  K: `- [ ] K 📅 ${H} [hI:: 10am] #cx-Casa`,
  L: `- [ ] L 📅 ${T} [hI:: 9am]`,
  M: '- [ ] M #cx-Casa ⛔ idz',
  Z: '- [ ] Z 🆔 idz',
  N: '- [ ] N #GTD-AlgunDia #cx-Casa',
  O: '- [ ] O #cx-ProyectoGTD',
  P: `- [ ] P 🛫 ${T2} 📅 ${T}`,
  Q: `- [ ] Q 📅 ${T2} #cx-Casa`,
  R: `- [ ] R 📅 ${Y} ⏳ ${Y2} #cx-Casa`,
  S: '- [ ] S [w:: [[2099-W01]]] #cx-Casa',
  T: `- [/] T ⏳ ${H} #cx-Casa`,
  U: `- [ ] U 📅 ${T2}`,
  X: '- [x] X #cx-Casa',
};

const tasks = parseTasksInNote(Object.values(LINES).join('\n'), 'PGTD - P/PGTD - P.md');
const byName = (n: string): Task => {
  const t = tasks.find((x) => x.text === n);
  if (!t) throw new Error(n);
  return t;
};

function where(lists: GtdLists, name: string): string[] {
  const t = byName(name);
  const out: string[] = [];
  for (const [id, v] of Object.entries(lists) as [ListId, Task[] | Map<string, Task[]>][]) {
    if (Array.isArray(v)) {
      if (v.includes(t)) out.push(id);
    } else {
      for (const [k, arr] of v) if (arr.includes(t)) out.push(`${id}:${k}`);
    }
  }
  return out.sort();
}

describe('clasificación GTD — escenario de oro', () => {
  const c = classifyTasks(tasks, { today: H });
  const L = c.lists;
  const cases: Array<[string, string[]]> = [
    ['A', ['inbox']],
    ['B', ['nextActions:cx-Oficina']],
    ['C', ['assigned:px-Ana', 'nextActions:cx-Oficina']],
    ['D', ['assigned:px-Ana']],
    ['E', ['hopeToday:cx-Sin Contexto', 'inbox']],
    ['F', ['hopeToday:cx-Casa', 'nextActions:cx-Casa']],
    ['G', ['nextActions:cx-Casa', `overdue:📅 ${Y}|cx-Casa`]],
    ['H', ['inbox', `overdue:📅 ${Y}|cx-Sin Contexto`]],
    ['I', ['paused']],
    ['J', ['inbox', 'nextActions:cx-Sin Contexto']],
    ['K', ['calendar', `hopeToday:${AGENDA_TODAY}`, 'nextActions:cx-Casa']],
    ['L', ['calendar']],
    ['M', ['nextActions:cx-Casa', 'paused']],
    ['Z', ['inbox']],
    ['N', ['someday']],
    ['O', ['nextActions:cx-ProyectoGTD', 'projects']],
    ['P', ['inbox']],
    ['Q', ['nextActions:cx-Casa']],
    // B-G2 corregido: se agrupa bajo el 📅 vencido (v1: bajo el ⏳ de hace 3 días)
    ['R', ['nextActions:cx-Casa', `overdue:📅 ${Y}|cx-Casa`]],
    // B-P6 corregido: semana futura → En Pausa (v1: Próximas Acciones)
    ['S', ['paused']],
    ['T', ['hopeToday:cx-Casa', 'nextActions:cx-Casa']],
    ['U', ['inbox']],
    ['X', []],
  ];
  it.each(cases)('tarea %s', (name, expected) => {
    expect(where(L, name)).toEqual([...expected].sort());
  });

  it('displayStatus', () => {
    const ds = (n: string) => c.displayStatus.get(byName(n).key);
    expect(ds('A')).toBeNull();
    expect(ds('G')).toBe('overdue');
    expect(ds('F')).toBe('today');
    expect(ds('I')).toBe('paused-start');
    expect(ds('J')).toBeNull();
    expect(ds('M')).toBe('paused-dep');
    expect(ds('P')).toBeNull();
    expect(ds('S')).toBe('paused-start');
  });

  it('contextos y personas de tareas abiertas, ordenados', () => {
    expect(c.contexts).toEqual(['Casa', 'Oficina', 'ProyectoGTD']);
    expect(c.people).toEqual(['Ana']);
  });

  it('navegación: orden v1, solo listas con contenido, anclas legibles', () => {
    const nav = navigationItems(L);
    expect(nav.map((n) => n.id)).toEqual([
      'hopeToday', 'overdue', 'inbox', 'calendar', 'projects', 'nextActions', 'assigned', 'paused', 'someday',
    ]);
    expect(nav.find((n) => n.id === 'nextActions')?.anchor).toBe('gtd-list-proximas-acciones');
    expect(anchorId('Algún Día / Tal Vez')).toBe('algun-dia-tal-vez');
    expect(listSize(L, 'nextActions')).toEqual({ entries: 11, unique: 11 });
  });
});

describe('clasificación GTD — reglas adicionales', () => {
  const run = (lines: string[], today = H) => {
    const ts = parseTasksInNote(lines.join('\n'), 'n.md');
    return { ts, c: classifyTasks(ts, { today }) };
  };

  it('#inbox va a Bandeja aunque tenga contexto; Algún día gana a todo', () => {
    const { ts, c } = run(['- [ ] a #inbox #cx-Casa', '- [ ] b #GTD-AlgunDia #inbox']);
    expect(c.lists.inbox).toContain(ts[0]);
    expect(c.lists.nextActions.get('cx-Casa')).toContain(ts[0]);
    expect(c.lists.someday).toEqual([ts[1]]);
    expect(c.lists.inbox).not.toContain(ts[1]);
  });

  it('conflicto de horas → Bandeja y sigue a Próximas si tiene contexto', () => {
    const { ts, c } = run(['- [ ] a [hI:: 10am] [hF:: 9am] #cx-Casa']);
    expect(c.lists.inbox).toContain(ts[0]);
    expect(c.lists.nextActions.get('cx-Casa')).toContain(ts[0]);
  });

  it('ciclo de dependencias → solo Bandeja', () => {
    const { ts, c } = run(['- [ ] a ⛔ b 🆔 a #cx-X', '- [ ] b ⛔ a 🆔 b #cx-X', '- [ ] s ⛔ s 🆔 s']);
    expect(c.dependencyCycles.size).toBe(3);
    expect(c.lists.inbox).toEqual(ts);
    expect(c.lists.nextActions.size).toBe(0);
  });

  it('dependencia inexistente no bloquea pero se informa', () => {
    const { ts, c } = run(['- [ ] a ⛔ nope #cx-X']);
    expect(c.lists.paused).toHaveLength(0);
    expect(c.missingDependencies.get(ts[0]!.key)).toEqual(['nope']);
  });

  it('dependencia cerrada → tarea normal', () => {
    const { ts, c } = run(['- [ ] a ⛔ d #cx-X', '- [x] d 🆔 d']);
    expect(c.lists.paused).toHaveLength(0);
    expect(c.lists.nextActions.get('cx-X')).toEqual([ts[0]]);
  });

  it('dependiente con fecha de hoy aparece también en Ojalá Hoy; vencida en Vencidas', () => {
    const { ts, c } = run([`- [ ] a ⛔ d ⏳ ${H} #cx-X`, `- [ ] b ⛔ d 📅 ${Y} #cx-X`, '- [ ] d 🆔 d']);
    expect(c.lists.paused).toEqual([ts[0], ts[1]]);
    expect(c.lists.hopeToday.get('cx-X')).toEqual([ts[0]]);
    expect(c.lists.overdue.get(`📅 ${Y}|cx-X`)).toEqual([ts[1]]);
  });

  it('modo contexto-primero en Vencidas', () => {
    const ts = parseTasksInNote(`- [ ] a 📅 ${Y} #cx-A #cx-B\n- [ ] b 📅 ${Y} #px-Ana\n- [ ] c 📅 ${Y}`, 'n.md');
    const c = classifyTasks(ts, { today: H, overdueMode: 'context-first' });
    expect([...c.lists.overdue.keys()].sort()).toEqual(
      [`📋 cx-A|${Y}`, `📋 cx-B|${Y}`, `👤 px-Ana|${Y}`, `📋 cx-Sin Contexto|${Y}`].sort(),
    );
  });

  it('Calendario y Agenda ordenan por minutos, no por texto (B-G1)', () => {
    const { c } = run([`- [ ] a 📅 ${H} [hI:: 10am]`, `- [ ] b 📅 ${H} [hI:: 9am]`, `- [ ] c 📅 ${H} [hI:: 13:30]`]);
    expect(c.lists.calendar.map((t) => t.text)).toEqual(['b', 'a', 'c']);
    expect(c.lists.hopeToday.get(AGENDA_TODAY)?.map((t) => t.text)).toEqual(['b', 'a', 'c']);
  });

  it('Ojalá Hoy ordena 📅 antes que ⏳ y por prioridad', () => {
    const { c } = run([`- [ ] a ⏳ ${H} #cx-X`, `- [ ] b 📅 ${H} 🔽 #cx-X`, `- [ ] c 📅 ${H} ⏫ #cx-X`]);
    expect(c.lists.hopeToday.get('cx-X')?.map((t) => t.text)).toEqual(['c', 'b', 'a']);
  });

  it('semana pasada sin contexto → Bandeja; semana actual con contexto → Próximas', () => {
    const { ts, c } = run(['- [ ] a [w:: [[2026-W40]]]', '- [ ] b [w:: [[2026-W45]]] #cx-X']);
    expect(c.lists.inbox).toContain(ts[0]);
    expect(c.lists.nextActions.get('cx-X')).toEqual([ts[1]]);
    expect(c.lists.paused).toHaveLength(0);
  });

  it('canceladas no aparecen', () => {
    const { c } = run(['- [-] a #cx-X']);
    expect(c.openTasks).toHaveLength(0);
  });
});
