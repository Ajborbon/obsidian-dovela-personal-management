import { describe, expect, it } from 'vitest';
import { localInstant } from '../../src/core/dates';
import type { LiveSession } from '../../src/core/time/merge';
import {
  clockInfo, exportRangeText, expiredAction, heatLevel, hms, longDateEs, noteName, percent, periodTitle,
  pomodoroEndPlan, rangeTextEs, runOf, sessionMode, statusBarInfo, truncate,
} from '../../src/core/time/display';
import { checkLiveStart, checkRange, joinLocal, resolveField, splitLocal } from '../../src/core/time/forms';
import {
  blockSizeClass, clampZoom, createInterval, hourHeight, minutesToY, moveInterval, nowMinutes, resizeInterval,
  rootFolder, shiftTimeline, visibleDays, yToMinutes,
} from '../../src/core/time/timelineMath';
import { periodRange } from '../../src/core/time/stats';

const at = (day: string, hm: string, sec = 0): number => {
  const [h, m] = hm.split(':').map(Number);
  return localInstant(day, (h ?? 0) * 60 + (m ?? 0)).getTime() + sec * 1000;
};

function session(extra: Partial<LiveSession> = {}): LiveSession {
  return {
    id: 's1', kind: 'timer', start: at('2026-11-05', '09:00'), path: 'A/PGTD - Dovela/PGTD - Dovela.md',
    desc: 'Revisar flujo', notes: '', dev: 'abc', u: 1, ...extra,
  };
}

describe('barra de estado y reloj', () => {
  it('temporizador: ⏱️ nombre de nota y HH:MM:SS', () => {
    const s = session();
    const info = statusBarInfo(s, at('2026-11-05', '10:05', 7), 25, 4);
    expect(info.mode).toBe('timer');
    expect(info.text).toBe('⏱️ PGTD - Dovela 01:05:07');
    expect(info.tooltip).toContain('Revisar flujo');
  });

  it('Pomodoro en trabajo: 🍅 y MM:SS restantes', () => {
    const s = session({ kind: 'pomodoro', phase: 'work', plannedMin: 25, cycles: 1 });
    const info = statusBarInfo(s, at('2026-11-05', '09:10'), 25, 4);
    expect(info.text).toBe('🍅 PGTD - Dovela 15:00');
    expect(clockInfo(s, at('2026-11-05', '09:10'), 25, 4).label).toBe('Pomodoro 2 de 4');
  });

  it('descanso: ☕; sin nota muestra "Descanso"', () => {
    const s = session({ kind: 'pomodoro', phase: 'shortBreak', plannedMin: 5, path: '' });
    expect(statusBarInfo(s, at('2026-11-05', '09:01'), 25, 4).text).toBe('☕ Descanso 04:00');
  });

  it('fase cumplida sin decisión: ⏰ decidir', () => {
    const s = session({ kind: 'pomodoro', phase: 'work', plannedMin: 25 });
    const info = statusBarInfo(s, at('2026-11-05', '09:40'), 25, 4);
    expect(info.mode).toBe('decide');
    expect(info.text).toBe('⏰ PGTD - Dovela decidir');
  });

  it('overtime: 🔴 +MM:SS (overtime) medido desde el fin planificado', () => {
    const s = session({ kind: 'pomodoro', phase: 'work', plannedMin: 25, overtimeStart: at('2026-11-05', '09:25') });
    const info = statusBarInfo(s, at('2026-11-05', '09:32', 30), 25, 4);
    expect(info.mode).toBe('overtime');
    expect(info.text).toBe('🔴 PGTD - Dovela +07:30 (overtime)');
  });

  it('marca sesiones abandonadas y concurrentes', () => {
    const info = statusBarInfo(session(), at('2026-11-05', '09:00'), 25, 4, { stale: true, concurrent: 2 });
    expect(info.text.endsWith('⚠️ (+1)')).toBe(true);
  });

  it('runOf usa la duración por defecto si falta', () => {
    expect(runOf(session({ kind: 'pomodoro' }), 30).plannedMin).toBe(30);
    expect(sessionMode(session({ kind: 'pomodoro', phase: 'longBreak', plannedMin: 15 }), at('2026-11-05', '09:01'), 25)).toBe('break');
  });

  it('utilidades de texto', () => {
    expect(noteName('a/b/Nota.md')).toBe('Nota');
    expect(truncate('abcdefghij', 5)).toBe('abcd…');
    expect(hms(59)).toBe('00:00:59');
    expect(hms(-5)).toBe('00:00:00');
  });
});

describe('decisión al terminar una fase', () => {
  const auto = { autoStartBreaks: true, autoStartWork: false };
  it('solo el dispositivo que inició la sesión decide', () => {
    expect(expiredAction('work', auto, 0, false)).toBe('notice');
  });
  it('auto‑inicio solo si terminó hace poco', () => {
    expect(expiredAction('work', auto, 30_000, true)).toBe('auto');
    expect(expiredAction('work', auto, 3 * 3_600_000, true)).toBe('modal');
    expect(expiredAction('shortBreak', auto, 0, true)).toBe('modal');
    expect(expiredAction('shortBreak', { autoStartBreaks: false, autoStartWork: true }, 0, true)).toBe('auto');
  });
  it('plan de fin: descanso sugerido, ronda y overtime', () => {
    const r = { phase: 'work' as const, start: at('2026-11-05', '09:00'), plannedMin: 25, cycles: 3 };
    const done = pomodoroEndPlan(r, at('2026-11-05', '09:30'), 4);
    expect(done).toMatchObject({ completedCycles: 4, suggestedBreak: 'longBreak', canOvertime: true, completed: true });
    expect(done.round).toEqual({ current: 4, of: 4 });
    const early = pomodoroEndPlan(r, at('2026-11-05', '09:10'), 4);
    expect(early).toMatchObject({ completedCycles: 3, suggestedBreak: 'shortBreak', canOvertime: false, completed: false });
    const ot = pomodoroEndPlan({ ...r, overtimeStart: at('2026-11-05', '09:25') }, at('2026-11-05', '09:50'), 4);
    expect(ot.canOvertime).toBe(false);
    expect(ot.completedCycles).toBe(4);
  });
});

describe('periodos y mapa de calor', () => {
  it('títulos', () => {
    const today = '2026-11-05';
    expect(periodTitle('today', periodRange('today', today), today)).toBe('Hoy · Jueves, 5 de noviembre de 2026');
    expect(periodTitle('week', periodRange('week', today), today)).toBe('Semana: 2 nov – 8 nov 2026');
    expect(periodTitle('month', periodRange('month', today), today)).toBe('Noviembre 2026');
    expect(periodTitle('year', periodRange('year', today), today)).toBe('Año 2026');
    expect(periodTitle('all', null, today)).toBe('Siempre');
    expect(rangeTextEs('2025-12-30', '2026-01-02')).toBe('30 dic 2025 – 2 ene 2026');
    expect(longDateEs('2024-02-29')).toBe('jueves, 29 de febrero de 2024');
  });
  it('texto de exportación', () => {
    expect(exportRangeText('week', { from: '2026-11-02', to: '2026-11-08' }, '2026-11-05')).toBe('Semana del 2026-11-02');
    expect(exportRangeText('custom', { from: '2026-11-02', to: '2026-11-04' }, '2026-11-05')).toBe('2026-11-02 a 2026-11-04');
  });
  it('niveles de calor por minutos', () => {
    expect([0, 1, 119, 120, 299, 300].map(heatLevel)).toEqual([0, 1, 1, 2, 2, 3]);
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(5, 0)).toBe(0);
  });
});

describe('formularios', () => {
  it('fecha+hora local ida y vuelta', () => {
    const ms = at('2026-11-05', '23:50');
    expect(splitLocal(ms)).toEqual({ date: '2026-11-05', time: '23:50' });
    expect(joinLocal('2026-11-05', '23:50')).toBe(ms);
    expect(joinLocal('2026-02-30', '10:00')).toBeNull();
    expect(joinLocal('2026-11-05', '24:00')).toBeNull();
  });
  it('conserva los segundos si el campo no cambió', () => {
    const orig = at('2026-11-05', '10:00', 45);
    expect(resolveField(orig, '2026-11-05', '10:00')).toBe(orig);
    expect(resolveField(orig, '2026-11-05', '10:30')).toBe(at('2026-11-05', '10:30'));
  });
  it('permite cruzar medianoche con fechas distintas', () => {
    const r = checkRange(at('2026-11-05', '23:50'), at('2026-11-06', '00:10'));
    expect(r).toMatchObject({ ok: true, duration: '20 min' });
  });
  it('fin anterior al inicio el mismo día sugiere cambiar la fecha', () => {
    const r = checkRange(at('2026-11-05', '23:50'), at('2026-11-05', '00:10'));
    expect(r.ok).toBe(false);
    expect(r.error).toContain('día siguiente');
  });
  it('avisos (no bloquean): más de 16 h y fin futuro', () => {
    const r = checkRange(at('2026-11-05', '00:00'), at('2026-11-05', '20:00'), at('2026-11-05', '12:00'));
    expect(r.ok).toBe(true);
    expect(r.warning).toContain('16 horas');
    expect(r.warning).toContain('futuro');
  });
  it('inicio de sesión en vivo ≤ ahora', () => {
    expect(checkLiveStart(at('2026-11-05', '11:00'), at('2026-11-05', '10:00')).ok).toBe(false);
    expect(checkLiveStart(at('2026-11-04', '23:00'), at('2026-11-05', '10:00'))).toMatchObject({ ok: true, duration: '11 h' });
    expect(checkLiveStart(null, 0).ok).toBe(false);
  });
});

describe('geometría del Cronograma', () => {
  it('días visibles y navegación', () => {
    expect(visibleDays('day', '2026-11-05')).toEqual(['2026-11-05']);
    expect(visibleDays('3day', '2026-11-05')).toEqual(['2026-11-05', '2026-11-06', '2026-11-07']);
    expect(visibleDays('week', '2026-11-05')[0]).toBe('2026-11-02');
    expect(visibleDays('week', '2026-11-05')).toHaveLength(7);
    expect(shiftTimeline('3day', '2026-11-05', -1)).toBe('2026-11-02');
    expect(shiftTimeline('week', '2026-11-05', 1)).toBe('2026-11-12');
  });
  it('zoom y alturas', () => {
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(9)).toBe(4);
    expect(clampZoom(1.6)).toBe(1.5);
    expect(clampZoom(Number.NaN)).toBe(1.5);
    expect(hourHeight(1.5)).toBe(75);
    expect(yToMinutes(900, 1800)).toBe(720);
    expect(yToMinutes(-10, 1800)).toBe(0);
    expect(minutesToY(720, 1800)).toBe(900);
  });
  it('mover conserva la duración y ajusta a 5 min (también multi‑día y a otro día)', () => {
    const log = { start: at('2026-11-05', '23:00'), end: at('2026-11-06', '01:00') };
    const moved = moveInterval(log, log.start, '2026-11-05', 22 * 60 + 2);
    expect(moved).toEqual({ start: at('2026-11-05', '22:00'), end: at('2026-11-06', '00:00') });
    const seg2Start = at('2026-11-06', '00:00');
    const moved2 = moveInterval(log, seg2Start, '2026-11-07', 61);
    expect(moved2).toEqual({ start: at('2026-11-07', '00:00'), end: at('2026-11-07', '02:00') });
  });
  it('redimensionar respeta el mínimo de 5 minutos', () => {
    const log = { start: at('2026-11-05', '10:00'), end: at('2026-11-05', '11:00') };
    expect(resizeInterval(log, '2026-11-05', 11 * 60 + 33).end).toBe(at('2026-11-05', '11:35'));
    expect(resizeInterval(log, '2026-11-05', 9 * 60).end).toBe(at('2026-11-05', '10:05'));
  });
  it('crear arrastrando: ordena, ajusta y descarta clics', () => {
    expect(createInterval('2026-11-05', 11 * 60 + 2, 10 * 60 - 1)).toEqual({ start: at('2026-11-05', '10:00'), end: at('2026-11-05', '11:00') });
    expect(createInterval('2026-11-05', 600, 601)).toBeNull();
  });
  it('línea de ahora solo en el día actual', () => {
    expect(nowMinutes(at('2026-11-05', '10:30'), '2026-11-05')).toBe(630);
    expect(nowMinutes(at('2026-11-05', '10:30'), '2026-11-06')).toBeNull();
  });
  it('tamaños y carpeta raíz', () => {
    expect([10, 40, 80].map(blockSizeClass)).toEqual(['size-tiny', 'size-small', 'size-normal']);
    expect(rootFolder('03 - Gestion/AV - x/n.md')).toBe('03 - Gestion');
    expect(rootFolder('n.md')).toBe('n.md');
  });
});
