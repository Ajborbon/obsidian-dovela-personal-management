import { describe, expect, it } from 'vitest';
import {
  appendEvents, newEventId, newLogFileContent, parseLogFile, parseLogFileName, logFileName, serializeEvent,
  type LiveEvent, type LogEvent, type TimeEvent,
} from '../../src/core/time/events';
import { durationMinutes, foldEvents, isStale } from '../../src/core/time/merge';
import {
  buildTimeTree, collectLogs, dailyTotals, isTransitNode, logsInRange, minutesInRange, periodRange,
  pomodoroStats, shiftAnchor, smartExpandChain, splitByDay,
} from '../../src/core/time/stats';
import { blocksForDay, layoutColumns, type DayBlock } from '../../src/core/time/timeline';
import { logsToCsv, safeFileName } from '../../src/core/time/csv';
import { importLegacyLogs, legacyLiveSession } from '../../src/core/time/legacyImport';
import {
  breakAfter, isExpired, overtimeAlertDue, overtimeSeconds, pomodoroNotes, remainingSeconds, roundPosition,
  sameSession, workLogFor, type PomodoroRun,
} from '../../src/core/time/pomodoro';
import { localInstant } from '../../src/core/dates';

const at = (day: string, hm: string): number => {
  const [h, m] = hm.split(':').map(Number);
  return localInstant(day, (h ?? 0) * 60 + (m ?? 0)).getTime();
};
const iso = (ms: number) => new Date(ms).toISOString();

function log(id: string, u: number, dev: string, a: number, b: number, extra: Partial<LogEvent> = {}): LogEvent {
  return { t: 'log', id, u, dev, a: iso(a), b: iso(b), p: 'A/PGTD - X/PGTD - X.md', k: 'timer', ...extra };
}
function live(id: string, u: number, dev: string, a: number, extra: Partial<LiveEvent> = {}): LiveEvent {
  return { t: 'live', id, u, dev, k: 'timer', a: iso(a), p: 'A/n.md', ...extra };
}

describe('archivo de eventos', () => {
  it('crear, añadir y leer (ignora líneas inválidas y otros bloques)', () => {
    let c = newLogFileContent('2026-11', 'abc123');
    const e1 = log('x1', 1, 'abc123', at('2026-11-05', '09:00'), at('2026-11-05', '09:30'));
    c = appendEvents(c, [e1]);
    c = appendEvents(c, [{ t: 'cancel', id: 'z', u: 2, dev: 'abc123' }]);
    c = c.replace('\n```\n', '\n{basura}\n```\n');
    const parsed = parseLogFile(c + '\n```js\n{"t":"log"}\n```\n');
    expect(parsed.events).toHaveLength(2);
    expect(parsed.invalidLines).toBe(1);
    expect(parsed.events[0]).toEqual(e1);
    expect(c.startsWith('---\ntype: RT\ndispositivo: abc123\nmes: 2026-11\n---')).toBe(true);
  });
  it('añade bloque si no existe; nombres de archivo; ids ordenables', () => {
    const c = appendEvents('# nota', [{ t: 'cancel', id: 'q', u: 1, dev: 'd' }]);
    expect(parseLogFile(c).events).toHaveLength(1);
    expect(logFileName('2026-11', 'abc')).toBe('2026-11 · abc.md');
    expect(parseLogFileName('2026-11 · abc.md')).toEqual({ month: '2026-11', device: 'abc' });
    expect(parseLogFileName('nota.md')).toBeNull();
    expect(newEventId(1000, () => 0) < newEventId(2000, () => 0)).toBe(true);
    expect(serializeEvent({ t: 'cancel', id: 'a', u: 1, dev: 'd' })).toBe('{"t":"cancel","id":"a","u":1,"dev":"d"}');
  });
});

describe('fusión multi-dispositivo', () => {
  const s = at('2026-11-05', '09:00');
  const evs: TimeEvent[] = [
    live('t1', 10, 'A', s),
    log('t1', 20, 'A', s, s + 30 * 60000),
    live('t1', 30, 'B', s, { n: 'edición tardía en B' }), // B no había visto el cierre
    log('L0', 5, 'B', s, s + 60000),
    log('L0', 40, 'A', s, s + 60000, { x: 1 }), // borrado en A
    log('L2', 1, 'B', s, s + 120000),
    log('L2', 2, 'A', s, s + 180000, { n: 'A edita' }),
    log('L2', 2, 'B', s, s + 240000, { n: 'B edita (mismo u, gana dev mayor)' }),
    live('t2', 50, 'B', s + 3600000),
    live('t3', 60, 'A', s),
    { t: 'cancel', id: 't3', u: 61, dev: 'A' },
  ];
  const st = foldEvents(evs);
  it('el cierre es terminal; borrado lógico; LWW con desempate por dispositivo', () => {
    expect([...st.logs.keys()].sort()).toEqual(['L2', 't1']);
    expect(st.logs.get('t1')?.notes).toBe('');
    expect(st.logs.get('L2')?.notes).toBe('B edita (mismo u, gana dev mayor)');
    expect(st.live.map((l) => l.id)).toEqual(['t2']);
  });
  it('conmutativa e idempotente', () => {
    const rev = foldEvents([...evs].reverse());
    const dup = foldEvents([...evs, ...evs]);
    expect(new Map(rev.logs)).toEqual(new Map(st.logs));
    expect(new Map(dup.logs)).toEqual(new Map(st.logs));
    expect(rev.live).toEqual(st.live);
  });
  it('duración y sesiones abandonadas', () => {
    expect(durationMinutes({ start: 0, end: 29 * 60000 + 59000 })).toBe(29);
    expect(durationMinutes({ start: 10, end: 0 })).toBe(0);
    expect(isStale(st.live[0]!, s + 3600000 + 13 * 3600000, 12)).toBe(true);
  });
});

describe('estadísticas', () => {
  const L = (id: string, path: string, a: number, b: number) => ({
    id, start: a, end: b, path, desc: '', notes: '', kind: 'timer' as const, dev: 'd', bad: false,
  });
  const logs = [
    L('1', 'A/B/C/n.md', at('2026-11-05', '10:00'), at('2026-11-05', '10:45')),
    L('2', 'A/B/D/m.md', at('2026-11-05', '11:00'), at('2026-11-05', '11:30')),
    L('3', 'A/B/C/n.md', at('2026-11-04', '23:50'), at('2026-11-05', '00:10')),
  ];
  it('reparto por día cruzando medianoche', () => {
    expect(splitByDay(logs[2]!).map((s) => [s.day, s.minutes])).toEqual([['2026-11-04', 10], ['2026-11-05', 10]]);
    expect(minutesInRange(logs[2]!, { from: '2026-11-05', to: '2026-11-05' })).toBe(10);
    expect(dailyTotals(logs).get('2026-11-05')).toBe(85);
    expect(logsInRange(logs, { from: '2026-11-04', to: '2026-11-04' }).map((l) => l.id)).toEqual(['3']);
  });
  it('árbol jerárquico (vectores RI-C §7.8)', () => {
    const t = buildTimeTree(logs.slice(0, 2), null);
    const A = t.children[0]!;
    const B = A.children[0]!;
    expect([t.minutes, A.minutes, B.minutes]).toEqual([75, 75, 75]);
    expect(B.children.map((c) => [c.name, c.minutes])).toEqual([['C', 45], ['D', 30]]);
    expect(isTransitNode(A)).toBe(true);
    expect(isTransitNode(B)).toBe(false);
    expect(smartExpandChain(A).map((n) => n.name)).toEqual(['B']);
    expect(collectLogs(t).map((l) => l.id)).toEqual(['1', '2']);
    expect(t.records).toBe(2);
  });
  it('periodos y navegación', () => {
    expect(periodRange('week', '2026-11-05')).toEqual({ from: '2026-11-02', to: '2026-11-08' });
    expect(periodRange('month', '2024-02-10')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(periodRange('all', '2026-11-05')).toBeNull();
    expect(shiftAnchor('month', '2026-12-15', 1)).toBe('2027-01-01');
    expect(shiftAnchor('month', '2026-01-15', -1)).toBe('2025-12-01');
    expect(shiftAnchor('week', '2026-11-05', -1)).toBe('2026-10-29');
  });
  it('estadísticas de Pomodoro recalculadas', () => {
    const p = [{ ...logs[0]!, kind: 'pomodoro' as const }, { ...logs[2]!, kind: 'pomodoro' as const }];
    expect(pomodoroStats(p, '2026-11-05')).toEqual({ totalSessions: 2, totalMinutes: 65, todaySessions: 2, todayMinutes: 55 });
  });
});

describe('cronograma', () => {
  const mk = (s: number, e: number): DayBlock => ({ startMin: s, endMin: e, column: 0, columns: 1, continuesAfter: false, continuesBefore: false, log: {} as never });
  it('columnas: A 10-11, B 10:30-12, C 11:30-13 → 2 columnas', () => {
    const r = layoutColumns([mk(600, 660), mk(630, 720), mk(690, 780)]);
    expect(r.map((b) => [b.column, b.columns])).toEqual([[0, 2], [1, 2], [0, 2]]);
  });
  it('bloques que tocan el fin exacto no se solapan', () => {
    const r = layoutColumns([mk(600, 660), mk(660, 720)]);
    expect(r.map((b) => [b.column, b.columns])).toEqual([[0, 1], [0, 1]]);
  });
  it('bloques por día con continuación', () => {
    const lg = { id: '3', start: at('2026-11-04', '23:50'), end: at('2026-11-05', '00:10'), path: 'n.md', desc: '', notes: '', kind: 'timer' as const, dev: 'd', bad: false };
    const b = blocksForDay([lg], '2026-11-05');
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ startMin: 0, endMin: 10, continuesBefore: true, continuesAfter: false });
  });
});

describe('CSV', () => {
  it('columnas de v1, BOM y escape', () => {
    const csv = logsToCsv([{
      id: '1', start: at('2026-11-05', '09:05'), end: at('2026-11-05', '10:10'), path: 'A/PGTD - X.md',
      desc: 'Tarea "x"; y', notes: 'línea1\nlínea2', kind: 'timer', dev: 'd', bad: false,
    }]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('﻿Ruta Completa;Tarea;Descripción Tarea;Fecha;Día de la Semana;Hora Inicio;Hora Fin;Duración (Minutos);Duración (hh:mm);Notas del Registro');
    expect(lines[1]).toBe('A/PGTD - X;PGTD - X;"Tarea ""x""; y";2026-11-05;jueves;09:05;10:10;65;01:05;"línea1\nlínea2"');
    expect(safeFileName('Exportación - A/B: 2026')).toBe('Exportación - A-B- 2026');
  });
});

describe('importador del historial v1', () => {
  const v1 = [
    { id: '1755806445123', taskNotePath: 'a.md', startTime: '2025-08-21T14:30:45.123-05:00', endTime: '2025-08-21T15:12:10.456-05:00', durationMinutes: 41, notes: 'Sesión Pomodoro + Overtime (41 min total)', taskDescription: 'Hacer X 🆔 Cj34Ev' },
    { id: '1755870000000', taskNotePath: 'b.md', startTime: '2025-08-22T13:00:00.000Z', endTime: '2025-08-22T13:30:00.000Z', durationMinutes: 31, notes: '', taskDescription: 'b' },
    { id: '1755870000000', taskNotePath: 'b.md', startTime: '2025-08-22T13:00:00.000Z', endTime: '2025-08-22T13:30:00.000Z', durationMinutes: 30 },
    { id: '9', taskNotePath: 'c.md', startTime: '2025-08-23T10:00:00Z', endTime: '2025-08-23T09:00:00Z', durationMinutes: -60 },
    { taskNotePath: '', startTime: 'x' },
    'basura',
  ];
  const r = importLegacyLogs(v1, 1000);
  it('importa, marca, deduplica e informa', () => {
    expect(r.report).toMatchObject({ read: 6, imported: 3, alreadyImported: 1, duplicates: 0, incoherent: 1, durationMismatch: 2 });
    expect(r.report.invalid.map((x) => x.index)).toEqual([4, 5]);
    const [a, b, c] = r.events;
    expect(a).toMatchObject({ id: 'leg-1755806445123', k: 'pomodoro', i: 'Cj34Ev', dev: 'importado', a: '2025-08-21T19:30:45.123Z' });
    expect(b).toMatchObject({ k: 'import', legacyMinutes: 31 });
    expect(c).toMatchObject({ bad: 1 });
    expect(r.report.minutesByMonth).toEqual({ '2025-08': 41 + 30 });
  });
  it('es idempotente', () => {
    const again = importLegacyLogs(v1, 2000, new Set(r.events.map((e) => e.id)));
    expect(again.events).toHaveLength(0);
    expect(again.report.alreadyImported).toBe(4);
  });
  it('sesiones vivas de v1 solo si son recientes', () => {
    const now = Date.parse('2025-11-05T15:00:00Z');
    const t = legacyLiveSession({ taskNotePath: 'a.md', startTime: '2025-11-05T14:12:03.512-05:00', taskDescription: 'x', lineNumber: 42 }, 'timer', now, 12, 'dev', 'id1');
    expect(t).toBeNull(); // inicia en el futuro respecto a now (19:12Z)
    const ok = legacyLiveSession({ taskNotePath: 'a.md', startTime: '2025-11-05T09:12:03-05:00', lineNumber: 42 }, 'timer', now, 12, 'dev', 'id1');
    expect(ok).toMatchObject({ t: 'live', k: 'timer', p: 'a.md', l: 42 });
    expect(legacyLiveSession({ taskNotePath: 'a.md', startTime: '2025-11-01T09:00:00Z' }, 'timer', now, 12, 'd', 'i')).toBeNull();
    const pomo = legacyLiveSession({ taskPath: 'a.md', startTime: '2025-11-05T14:30:00Z', type: 'work', duration: 25, completedCycles: 2 }, 'pomodoro', now, 12, 'd', 'i');
    expect(pomo).toMatchObject({ ph: 'work', pl: 25, cy: 2 });
  });
});

describe('Pomodoro', () => {
  const s = at('2026-11-05', '09:00');
  const run: PomodoroRun = { phase: 'work', start: s, plannedMin: 25, cycles: 0 };
  it('tiempo restante y expiración', () => {
    expect(remainingSeconds(run, s + 12.5 * 60000)).toBe(750);
    expect(remainingSeconds(run, s + 25 * 60000)).toBe(0);
    expect(isExpired(run, s + 25 * 60000)).toBe(true);
    expect(isExpired(run, s + 24 * 60000)).toBe(false);
  });
  it('el registro termina en el fin planificado aunque se decida tarde (defecto v1 4.7-5)', () => {
    expect(workLogFor(run, s + 45 * 60000)).toEqual({ start: s, end: s + 25 * 60000, plannedMin: 25, overtimeMin: 0, cycle: 1 });
    expect(workLogFor(run, s + 10 * 60000)).toMatchObject({ end: s + 10 * 60000, cycle: 0 });
  });
  it('overtime medido desde su inicio', () => {
    const ot: PomodoroRun = { ...run, overtimeStart: s + 25 * 60000 };
    expect(overtimeSeconds(ot, s + 40 * 60000)).toBe(900);
    expect(workLogFor(ot, s + 40 * 60000)).toEqual({ start: s, end: s + 40 * 60000, plannedMin: 25, overtimeMin: 15, cycle: 1 });
    expect(overtimeAlertDue(ot, s + 29 * 60000, undefined, 5)).toBe(false);
    expect(overtimeAlertDue(ot, s + 30 * 60000, undefined, 5)).toBe(true);
    expect(overtimeAlertDue(ot, s + 34 * 60000, s + 30 * 60000, 5)).toBe(false);
  });
  it('descanso largo cada N ciclos (defecto v1 4.7-1)', () => {
    expect([1, 2, 3, 4, 5, 8].map((c) => breakAfter(c, 4))).toEqual(['shortBreak', 'shortBreak', 'shortBreak', 'longBreak', 'shortBreak', 'longBreak']);
    expect(breakAfter(0, 4)).toBe('shortBreak');
    expect(roundPosition(5, 4)).toEqual({ current: 2, of: 4 });
  });
  it('notas con formato v1 y sesiones agrupadas', () => {
    expect(pomodoroNotes(25, 25, 0, 0, '')).toBe('Sesión Pomodoro (25/25 min)');
    expect(pomodoroNotes(40, 25, 15, 2, ' revisé ')).toBe('Sesión Pomodoro + Overtime (40 min total) - Ciclos completados: 2\n\nrevisé');
    expect(sameSession(s, s + 29 * 60000, 30)).toBe(true);
    expect(sameSession(undefined, s, 30)).toBe(false);
  });
});
