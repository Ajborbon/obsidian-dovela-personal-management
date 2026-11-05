import { describe, expect, it } from 'vitest';
import { classifyDay, dayCounts, dayGroups, dayHeader, type DayClassification } from '../../src/core/journal/daily';
import type { Task } from '../../src/core/tasks/model';
import { parseTasksInNote } from '../../src/core/tasks/parse';

const D = '2025-10-24'; // viernes, 2025-W43

function tasks(...lines: string[]): Task[] {
  return parseTasksInNote(lines.join('\n'), 'Notas/prueba.md');
}

/** Primer token del texto = nombre de la tarea en los vectores. */
const names = (ts: readonly Task[]): string[] => ts.map((t) => t.text.split(' ')[0] ?? '');

type GroupKey = Exclude<keyof DayClassification, 'targetDate' | 'missingDeps'>;
const GROUPS: GroupKey[] = ['calendar', 'programmed', 'thisWeek', 'previousWeeks', 'inProgress', 'overdue', 'blocked', 'completed'];

function groupOf(c: DayClassification, name: string): GroupKey[] {
  return GROUPS.filter((g) => names(c[g]).includes(name));
}

describe('Journal: vectores RI-E §8.4 (fecha objetivo 2025-10-24)', () => {
  const all = tasks(
    `- [ ] A 📅 ${D} [hI:: 09:00]`,
    `- [ ] B ⏳ ${D}`,
    `- [ ] C 🛫 ${D}`,
    '- [ ] D 📅 2025-10-23',
    '- [ ] E 🛫 2025-10-01',
    '- [ ] F 📅 2025-10-23 [hI:: 08:00]',
    '- [ ] G 📅 2025-10-25',
    '- [/] H',
    '- [ ] I [w::[[2025-W43]]]',
    '- [ ] J [w::[[2025-W42]]]',
    '- [ ] K [w::[[2025-W44]]]',
    '- [ ] L [w::[[2025-W43]]] 📅 2025-10-10',
    '- [/] M [w::[[2025-W43]]]',
    `- [ ] N ⛔ x 📅 ${D}`,
    '- [ ] O ⛔ x',
    `- [ ] P ⛔ ^y 📅 ${D}`,
    `- [x] Q ✅ ${D}`,
    '- [x] R',
    '- [x] S ✅ 2025-10-23',
    '- [ ] X 🆔 x',
    `- [x] Y 🆔 y ✅ 2025-10-20`,
    `- [-] Z 📅 ${D}`,
  );
  const c = classifyDay(all, D);

  it.each([
    ['A', ['calendar']], // J1
    ['B', ['programmed']], // J2
    ['C', ['programmed']], // J3
    ['D', ['overdue']], // J4
    ['E', ['overdue']], // J5: Journal incluye 🛫 vencidas
    ['F', ['overdue']], // J6: la hora solo cuenta el mismo día
    ['G', []], // J7
    ['H', ['inProgress']], // J8
    ['I', ['thisWeek']], // J9
    ['J', ['previousWeeks']], // J10
    ['K', []], // J11
    ['L', ['thisWeek']], // J12: la fecha se ignora
    ['M', ['inProgress']], // J13
    ['N', ['blocked']], // J14
    ['O', []], // J15
    ['P', ['programmed']], // J16 corregido: ⛔ ^y con y completada ya no bloquea
    ['Q', ['completed']], // J17
    ['R', []], // J18
    ['S', []], // J19
    ['Z', []], // [-] cancelada (R9)
  ])('%s → %j', (name, expected) => {
    expect(groupOf(c, name)).toEqual(expected);
  });

  it('programadas en orden 📅 → ⏳ → 🛫 (J3)', () => {
    expect(names(c.programmed)).toEqual(['P', 'B', 'C']);
  });

  it('grupos, títulos (de v1) y estado abierto/cerrado', () => {
    const g = dayGroups(c);
    expect(g.map((x) => [x.title, x.open])).toEqual([
      ['⏰ Calendario del Día (1)', true],
      ['📅⏳🛫 Programadas para Hoy (3)', true],
      ['📊 Tareas para esta Semana (2)', true],
      ['🔥📊 Tareas de Semanas Anteriores (1)', true],
      ['🔄 En Progreso (2)', true],
      ['🔥 Vencidas a Hoy (3)', false],
      ['⛔ Bloqueadas por Dependencias (1)', true],
      ['✅ Completadas Hoy (1)', false],
    ]);
  });

  it('conteos (programmed ahora se cuenta: en v1 la regex no casaba con el título)', () => {
    expect(dayCounts(c)).toEqual({ calendar: 1, programmed: 3, overdue: 3, inProgress: 2, blocked: 1, completed: 1, weekly: 2, weeklyOverdue: 1 });
  });

  it('encabezado con el día en español', () => {
    expect(dayHeader(D)).toBe('📋 Tareas del Día - 2025-10-24 viernes');
  });
});

describe('Journal: correcciones y opciones', () => {
  it('J20: semanas de 1 dígito (W5 = 27-ene…02-feb)', () => {
    const c = classifyDay(tasks('- [ ] T [w::[[2025-W5]]]'), '2025-02-01');
    expect(names(c.thisWeek)).toEqual(['T']);
  });

  it('semana ISO del borde de año: 2025-12-29 está en 2026-W01', () => {
    const c = classifyDay(tasks('- [ ] U [w::[[2026-W01]]]', '- [ ] V [w::[[2025-W52]]]'), '2025-12-29');
    expect(names(c.thisWeek)).toEqual(['U']);
    expect(names(c.previousWeeks)).toEqual(['V']);
  });

  it('J21 corregido: calendario por hora numérica (9:00 antes que 10:00)', () => {
    const c = classifyDay(tasks(`- [ ] Diez 📅 ${D} [hI:: 10:00]`, `- [ ] Nueve 📅 ${D} [hI:: 9:00]`, `- [ ] Ocho 📅 ${D} [hI:: 8am]`), D);
    expect(names(c.calendar)).toEqual(['Ocho', 'Nueve', 'Diez']);
  });

  it('J22: límite de vencidas 50 por defecto (título cuenta todas) y showOverdueLimit', () => {
    const lines = Array.from({ length: 60 }, (_, i) => `- [ ] V${i} 📅 2025-10-${String((i % 20) + 1).padStart(2, '0')}`);
    const c = classifyDay(tasks(...lines), D);
    const g = dayGroups(c).find((x) => x.id === 'overdue');
    expect(g?.title).toBe('🔥 Vencidas a Hoy (60)');
    expect(g?.tasks.length).toBe(50);
    expect(g?.hidden).toBe(10);
    const g2 = dayGroups(c, { showOverdueLimit: 5 }).find((x) => x.id === 'overdue');
    expect(g2?.tasks.length).toBe(5);
    expect(g2?.hidden).toBe(55);
    // 0 = valor por defecto (v1: `|| 50`)
    expect(dayGroups(c, { showOverdueLimit: 0 }).find((x) => x.id === 'overdue')?.tasks.length).toBe(50);
  });

  it('J23 corregido: el símbolo de prioridad se conserva tal cual (⏫ no se muestra como 🔺)', () => {
    const [t] = tasks(`- [ ] W ⏫ 📅 ${D}`);
    expect(t?.priority.symbol).toBe('⏫');
  });

  it('vencidas ordenadas por fecha → tipo → prioridad; las prioridades ordenan 🔺 ⏫ 🔼 🔽 ⏬', () => {
    const c = classifyDay(tasks(
      '- [ ] B2 ⏳ 2025-10-20',
      '- [ ] B1 🔽 📅 2025-10-20',
      '- [ ] B0 🔺 📅 2025-10-20',
      '- [ ] A0 📅 2025-10-01',
    ), D);
    expect(names(c.overdue)).toEqual(['A0', 'B0', 'B1', 'B2']);
  });

  it('dependencia inexistente: no bloquea y se informa (⚠️)', () => {
    const c = classifyDay(tasks(`- [ ] N ⛔ nadie 📅 ${D}`), D);
    expect(names(c.programmed)).toEqual(['N']);
    expect([...c.missingDeps.values()]).toEqual([['nadie']]);
  });

  it('dependencia cancelada cuenta como resuelta; dependencia en progreso bloquea', () => {
    const c = classifyDay(tasks(`- [ ] N ⛔ a 📅 ${D}`, `- [ ] M ⛔ b 📅 ${D}`, '- [-] A 🆔 a', '- [/] B 🆔 b'), D);
    expect(names(c.programmed)).toEqual(['N']);
    expect(names(c.blocked)).toEqual(['M']);
  });

  it('bloqueada vencida aparece en Bloqueadas (no en Vencidas)', () => {
    const c = classifyDay(tasks('- [ ] N ⛔ x 📅 2025-10-01', '- [ ] X 🆔 x'), D);
    expect(names(c.blocked)).toEqual(['N']);
    expect(c.overdue).toEqual([]);
  });

  it('showOnlyCritical: solo 🔺/⏫ en vencidas, con aviso de las ocultas', () => {
    const c = classifyDay(tasks('- [ ] A 🔺 📅 2025-10-01', '- [ ] B ⏫ 📅 2025-10-02', '- [ ] C 🔼 📅 2025-10-03', '- [ ] D 📅 2025-10-04'), D);
    const g = dayGroups(c, { showOnlyCritical: true }).find((x) => x.id === 'overdue');
    expect(g?.title).toBe('🔥 Vencidas a Hoy (2)');
    expect(names(g?.tasks ?? [])).toEqual(['A', 'B']);
    expect(g?.note).toContain('2 vencidas');
  });

  it('groupOverdueByWeek: subgrupos por semana ISO de la fecha', () => {
    const c = classifyDay(tasks('- [ ] A 📅 2025-10-13', '- [ ] B 📅 2025-10-14', '- [ ] C 📅 2025-10-21'), D);
    const g = dayGroups(c, { groupOverdueByWeek: true }).find((x) => x.id === 'overdue');
    expect(g?.tasks).toEqual([]);
    expect(g?.subgroups?.map((s) => [s.title, names(s.tasks)])).toEqual([
      ['📊 2025-W42 (2)', ['A', 'B']],
      ['📊 2025-W43 (1)', ['C']],
    ]);
  });

  it('fecha inválida → error con el mensaje de v1', () => {
    expect(() => classifyDay([], '2025-02-30')).toThrow('Formato de fecha inválido: 2025-02-30. Use YYYY-MM-DD');
  });

  it('sin tareas: ningún grupo', () => {
    expect(dayGroups(classifyDay([], D))).toEqual([]);
  });
});
