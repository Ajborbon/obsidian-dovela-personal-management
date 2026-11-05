import { describe, expect, it } from 'vitest';
import { classifyWeek, weekCounts, weekGroups, weekHeader, weekRangeLabel } from '../../src/core/journal/weekly';
import type { Task } from '../../src/core/tasks/model';
import { parseTasksInNote } from '../../src/core/tasks/parse';

const W = '2025-W43'; // lunes 2025-10-20 → domingo 2025-10-26

function tasks(...lines: string[]): Task[] {
  return parseTasksInNote(lines.join('\n'), 'Notas/semana.md');
}
const names = (ts: readonly Task[]): string[] => ts.map((t) => t.text.split(' ')[0] ?? '');

describe('Weekly: vectores RI-E §8.5 (2025-W43)', () => {
  const all = tasks(
    '- [ ] K1 [w::[[2025-W43]]]',
    '- [ ] K2a [w::[[2025-W42]]]',
    '- [ ] K2b [w::[[2024-W52]]]',
    '- [ ] K3 [w::[[2025-W44]]]',
    '- [ ] K4 📅 2025-10-26',
    '- [ ] K5 🛫 2025-10-20',
    '- [ ] K6 📅 2025-10-19',
    '- [ ] K7 🛫 2025-10-19',
    '- [ ] K8 ⏳ 2025-10-27',
    '- [x] K9 ✅ 2025-10-22',
    '- [x] K10 ✅ 2025-10-27',
    '- [ ] K11 [w::[[2025-W43]]] 📅 2025-10-22',
    '- [/] K12',
    '- [-] K13 📅 2025-10-21',
  );
  const c = classifyWeek(all, W);

  it('rango de la semana anclado (independiente de hoy)', () => {
    expect([c.start, c.end]).toEqual(['2025-10-20', '2025-10-26']);
  });
  it('K1, K11: Tareas Semanales (la fecha se ignora)', () => {
    expect(names(c.weekly)).toEqual(['K1', 'K11']);
  });
  it('K2: Vencidas de Semanas Anteriores, en orden año → semana', () => {
    expect(names(c.overdueWeekly)).toEqual(['K2b', 'K2a']);
  });
  it('K4, K5: por día (domingo y lunes; por día incluye 🛫)', () => {
    expect(names(c.days[6] ?? [])).toEqual(['K4']);
    expect(names(c.days[0] ?? [])).toEqual(['K5']);
  });
  it('K6/K7: vencidas por fecha solo 📅/⏳', () => {
    expect(names(c.overdueByDate)).toEqual(['K6']);
  });
  it('K9/K10: completadas dentro de la semana', () => {
    expect(names(c.completed)).toEqual(['K9']);
  });
  it('K3, K8, K12, [-]: no aparecen', () => {
    const shown = [c.weekly, c.overdueWeekly, c.overdueByDate, c.completed, ...c.days].flatMap((g) => names(g));
    for (const n of ['K3', 'K7', 'K8', 'K10', 'K12', 'K13']) expect(shown).not.toContain(n);
  });

  it('grupos y títulos de v1 en orden', () => {
    const g = weekGroups(c, {}, '2025-10-22');
    expect(g.map((x) => [x.title, x.open])).toEqual([
      ['📊 Tareas Semanales (2)', true],
      ['🔥 Tareas Vencidas por Fecha (1)', true],
      ['📅 Tareas por Día', true],
      ['🔥 Tareas Vencidas de Semanas Anteriores (2)', true],
      ['✅ Completadas esta Semana (1)', false],
    ]);
    expect(g[2]?.subgroups?.map((s) => s.title)).toEqual(['Lunes 20', 'Domingo 26']);
  });

  it('K14: conteos (overdue = solo semanas anteriores, como v1; overdueByDate aparte)', () => {
    expect(weekCounts(c)).toEqual({
      weekly: 2, monday: 1, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 1,
      overdue: 2, completed: 1, overdueByDate: 1,
    });
  });

  it('encabezado y rango en español', () => {
    expect(weekHeader(c)).toEqual({ title: 'Semana 2025-W43', range: '20 de octubre - 26 de octubre, 2025' });
    expect(weekRangeLabel('2025-12-29', '2026-01-04')).toBe('29 de diciembre - 4 de enero, 2026');
  });
});

describe('Weekly: opciones y bordes', () => {
  it('K13: showOverdueLimit recorta ambas listas e informa las ocultas', () => {
    const lines = [
      ...Array.from({ length: 15 }, (_, i) => `- [ ] D${i} 📅 2025-10-${String(i + 1).padStart(2, '0')}`),
      ...Array.from({ length: 15 }, (_, i) => `- [ ] S${i} [w::[[2025-W${String(i + 20)}]]]`),
    ];
    const g = weekGroups(classifyWeek(tasks(...lines), W), { showOverdueLimit: 10 });
    const byDate = g.find((x) => x.id === 'overdue-date');
    const byWeek = g.find((x) => x.id === 'overdue-weeks');
    expect([byDate?.tasks.length, byDate?.hidden, byDate?.title]).toEqual([10, 5, '🔥 Tareas Vencidas por Fecha (15)']);
    expect([byWeek?.tasks.length, byWeek?.hidden]).toEqual([10, 5]);
    // Sin límite por defecto (como v1)
    expect(weekGroups(classifyWeek(tasks(...lines), W)).find((x) => x.id === 'overdue-date')?.hidden).toBe(0);
  });

  it('K15: día de hoy resaltado solo con highlightToday', () => {
    const c = classifyWeek(tasks('- [ ] A 📅 2025-10-22'), W);
    const on = weekGroups(c, {}, '2025-10-22').find((x) => x.id === 'days')?.subgroups?.[0];
    expect(on?.title).toBe('Miércoles 22 📍 Hoy');
    expect(on?.highlight).toBe(true);
    const off = weekGroups(c, { highlightToday: false }, '2025-10-22').find((x) => x.id === 'days')?.subgroups?.[0];
    expect(off?.title).toBe('Miércoles 22');
    expect(off?.highlight).toBeUndefined();
  });

  it('showCompletedCollapsed: false → completadas abiertas', () => {
    const c = classifyWeek(tasks('- [x] A ✅ 2025-10-21'), W);
    expect(weekGroups(c, { showCompletedCollapsed: false }).find((x) => x.id === 'completed')?.open).toBe(true);
  });

  it('"Tareas por Día" siempre se emite (como v1)', () => {
    const g = weekGroups(classifyWeek([], W));
    expect(g.map((x) => x.id)).toEqual(['days']);
    expect(g[0]?.subgroups).toEqual([]);
  });

  it('semana con 1 dígito y borde de año ISO (2026-W01 = 29-dic-2025 … 04-ene-2026)', () => {
    const c = classifyWeek(tasks('- [ ] A 📅 2025-12-29', '- [ ] B 📅 2026-01-04', '- [ ] C [w::[[2026-W1]]]', '- [ ] E [w::[[2025-W52]]]'), '2026-W1');
    expect([c.start, c.end]).toEqual(['2025-12-29', '2026-01-04']);
    expect(names(c.days[0] ?? [])).toEqual(['A']);
    expect(names(c.days[6] ?? [])).toEqual(['B']);
    expect(names(c.weekly)).toEqual(['C']);
    expect(names(c.overdueWeekly)).toEqual(['E']);
  });

  it('por día: tipo de fecha → prioridad → hora', () => {
    const c = classifyWeek(tasks('- [ ] C 🛫 2025-10-21', '- [ ] B ⏳ 2025-10-21', '- [ ] A2 📅 2025-10-21 [hI:: 10:00]', '- [ ] A1 📅 2025-10-21 [hI:: 9:00]'), W);
    expect(names(c.days[1] ?? [])).toEqual(['A1', 'A2', 'B', 'C']);
  });

  it('semana inválida → mensaje de v1', () => {
    expect(() => classifyWeek([], '2025-W99')).toThrow('Formato de semana inválido: 2025-W99');
    expect(() => classifyWeek([], 'foo')).toThrow('Use YYYY-W## (ej: 2025-W43)');
  });
});
