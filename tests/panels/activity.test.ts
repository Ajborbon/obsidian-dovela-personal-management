import { describe, expect, it } from 'vitest';
import {
  chooseBucket, computeActivity, emptySeries, formatBalance, normalizeRange, periodLabel, periodRange,
  rangeDays, rangeInstants, seriesMax, type ActivityNote, type ActivityTask,
} from '../../src/core/panels/activity';
import { parseTasksInNote } from '../../src/core/tasks/parse';
import { localInstant } from '../../src/core/dates';

// TZ fijada a America/Bogota en vitest.config.ts (UTC−5, sin horario de verano).
const TODAY = '2026-11-05'; // jueves

function note(path: string, ctime: number, mtime: number): ActivityNote {
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  return { path, basename: path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, ''), folder, ctime, mtime };
}

const at = (day: string, h = 0, m = 0): number => localInstant(day, h * 60 + m).getTime();

describe('periodRange', () => {
  it('hoy, ayer, semana (lunes..hoy) y mes (1..hoy)', () => {
    expect(periodRange('today', TODAY)).toEqual({ from: TODAY, to: TODAY });
    expect(periodRange('yesterday', TODAY)).toEqual({ from: '2026-11-04', to: '2026-11-04' });
    expect(periodRange('week', TODAY)).toEqual({ from: '2026-11-02', to: TODAY });
    expect(periodRange('month', TODAY)).toEqual({ from: '2026-11-01', to: TODAY });
  });

  it('semana empezando en lunes y en domingo', () => {
    expect(periodRange('week', '2026-11-02')).toEqual({ from: '2026-11-02', to: '2026-11-02' });
    expect(periodRange('week', '2026-11-08')).toEqual({ from: '2026-11-02', to: '2026-11-08' });
  });

  it('ayer cruzando mes y año', () => {
    expect(periodRange('yesterday', '2026-01-01')).toEqual({ from: '2025-12-31', to: '2025-12-31' });
  });

  it('personalizado: ordena, completa y valida', () => {
    expect(periodRange('custom', TODAY, { from: '2026-10-10', to: '2026-10-01' })).toEqual({ from: '2026-10-01', to: '2026-10-10' });
    expect(periodRange('custom', TODAY, { from: '2026-10-10' })).toEqual({ from: '2026-10-10', to: TODAY });
    expect(periodRange('custom', TODAY, null)).toEqual({ from: '2026-10-07', to: TODAY });
    expect(normalizeRange('2026-02-30', 'x', TODAY)).toEqual({ from: '2026-10-07', to: TODAY });
    expect(normalizeRange('2026-12-01', null, TODAY)).toEqual({ from: '2026-12-01', to: '2026-12-01' });
    expect(rangeDays({ from: '2026-10-01', to: '2026-10-10' })).toBe(10);
  });

  it('el fin del rango incluye el día completo (corrige v1)', () => {
    const r = { from: '2026-11-01', to: '2026-11-03' };
    const { start, end } = rangeInstants(r);
    expect(start).toBe(at('2026-11-01'));
    expect(end).toBe(at('2026-11-04'));
  });

  it('etiquetas', () => {
    expect(periodLabel('week', periodRange('week', TODAY))).toBe('Esta semana');
    expect(periodLabel('custom', { from: '2026-11-01', to: '2026-11-03' })).toBe('01/11 – 03/11');
    expect(periodLabel('custom', { from: '2025-12-30', to: '2026-01-02' })).toBe('30/12/25 – 02/01');
    expect(periodLabel('custom', { from: '2026-11-01', to: '2026-11-01' })).toBe('01/11');
  });
});

describe('computeActivity', () => {
  const body = [
    '- [ ] capturada hoy ➕ 2026-11-05',
    '- [x] capturada el lunes y cerrada hoy ➕ 2026-11-02 ✅ 2026-11-05',
    '- [x] cerrada el mes pasado ✅ 2026-10-31',
    '- [ ] reabierta conserva fecha ✅ 2026-11-04',
    '- [-] cancelada capturada ➕ 2026-11-03',
    '- [ ] sin fechas',
    '- [x] capturada con hora ➕ 2026-11-04 10:30 ✅ 2026-11-04',
  ].join('\n');
  const tasks: ActivityTask[] = parseTasksInNote(body, 'P/tareas.md');

  it('capturadas (➕) y completadas (✅) desde las tareas del índice', () => {
    const m = computeActivity([], tasks, periodRange('week', TODAY));
    expect(m.captured.map((h) => h.task.text)).toEqual([
      'capturada hoy',
      'capturada con hora',
      'cancelada capturada',
      'capturada el lunes y cerrada hoy',
    ]);
    expect(m.completed.map((h) => h.day)).toEqual(['2026-11-05', '2026-11-04']);
    expect(m.balance).toBe(2 - 4);
  });

  it('una tarea reabierta con ✅ no cuenta como completada', () => {
    const m = computeActivity([], tasks, { from: '2026-11-04', to: '2026-11-04' });
    expect(m.completed.map((h) => h.task.text)).toEqual(['capturada con hora']);
  });

  it('notas creadas/modificadas por ctime/mtime con el último día completo', () => {
    const notes = [
      note('a.md', at('2026-11-03', 23, 59), at('2026-11-03', 23, 59)), // último minuto del fin
      note('b.md', at('2026-10-20'), at('2026-11-01', 0, 0)), // primer instante del inicio
      note('c.md', at('2026-11-04', 1), at('2026-11-04', 1)), // fuera (día siguiente)
      note('d.md', at('2026-10-31', 23, 59), at('2026-10-31', 23, 59)), // fuera (día anterior)
      note('e.md', 0, 0), // sin fechas
    ];
    const m = computeActivity(notes, [], { from: '2026-11-01', to: '2026-11-03' });
    expect(m.notesCreated.map((h) => h.note.path)).toEqual(['a.md']);
    expect(m.notesModified.map((h) => h.note.path)).toEqual(['a.md', 'b.md']);
    expect(m.notesModified[0]?.day).toBe('2026-11-03');
  });

  it('excluye prefijos (p. ej. registros de tiempo)', () => {
    const notes = [note('Dovela/Registro de tiempo/2026-11 · abc.md', at(TODAY, 8), at(TODAY, 9)), note('x.md', at(TODAY, 8), at(TODAY, 9))];
    const m = computeActivity(notes, [], periodRange('today', TODAY), { excludeNotePrefixes: ['Dovela/Registro de tiempo'] });
    expect(m.notesCreated.map((h) => h.note.path)).toEqual(['x.md']);
  });

  it('serie diaria del periodo', () => {
    const notes = [note('a.md', at('2026-11-02', 9), at(TODAY, 9))];
    const m = computeActivity(notes, tasks, periodRange('week', TODAY));
    expect(m.bucket).toBe('day');
    expect(m.series.map((p) => p.key)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
    expect(m.series.map((p) => p.label)).toEqual(['L 2', 'M 3', 'X 4', 'J 5']);
    expect(m.series.map((p) => [p.captured, p.completed, p.created, p.modified])).toEqual([
      [1, 0, 1, 0], [1, 0, 0, 0], [1, 1, 0, 0], [1, 1, 0, 1],
    ]);
    expect(seriesMax(m.series, ['captured', 'completed'])).toBe(1);
  });
});

describe('serie', () => {
  it('agrupa por semana y por mes en rangos largos', () => {
    expect(chooseBucket({ from: '2026-10-06', to: '2026-11-05' })).toBe('day');
    expect(chooseBucket({ from: '2026-09-01', to: '2026-11-05' })).toBe('week');
    expect(chooseBucket({ from: '2025-11-05', to: '2026-11-05' })).toBe('month');
    const w = emptySeries({ from: '2026-10-28', to: '2026-11-05' }, 'week');
    expect(w.map((p) => [p.from, p.to])).toEqual([['2026-10-28', '2026-11-01'], ['2026-11-02', '2026-11-05']]);
    expect(w[0]?.label).toBe('S44');
    const mth = emptySeries({ from: '2025-12-15', to: '2026-02-03' }, 'month');
    expect(mth.map((p) => [p.key, p.from, p.to, p.label])).toEqual([
      ['2025-12', '2025-12-15', '2025-12-31', 'dic 25'],
      ['2026-01', '2026-01-01', '2026-01-31', 'ene 26'],
      ['2026-02', '2026-02-01', '2026-02-03', 'feb 26'],
    ]);
  });

  it('cuenta en el cubo semanal correcto', () => {
    const tasks = parseTasksInNote('- [ ] a ➕ 2026-10-29\n- [ ] b ➕ 2026-11-03', 'x.md');
    const m = computeActivity([], tasks, { from: '2026-09-01', to: '2026-11-05' });
    expect(m.bucket).toBe('week');
    expect(m.series.find((p) => p.key === '2026-10-26')?.captured).toBe(1);
    expect(m.series.find((p) => p.key === '2026-11-02')?.captured).toBe(1);
  });

  it('formatBalance', () => {
    expect(formatBalance(3)).toBe('+3');
    expect(formatBalance(0)).toBe('0');
    expect(formatBalance(-2)).toBe('-2');
  });
});
