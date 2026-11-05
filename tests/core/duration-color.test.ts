import { describe, expect, it } from 'vitest';
import { formatClock, formatDuration, parseDurationMinutes } from '../../src/core/duration';
import { colorFromString } from '../../src/core/color';

describe('duración', () => {
  it('lee las formas de v1 y las nuevas', () => {
    expect(parseDurationMinutes('30min')).toBe(30);
    expect(parseDurationMinutes('1h')).toBe(60);
    expect(parseDurationMinutes('1.5h')).toBe(90);
    expect(parseDurationMinutes('1,5h')).toBe(90);
    expect(parseDurationMinutes('45m')).toBe(45);
    expect(parseDurationMinutes('45 min')).toBe(45);
    expect(parseDurationMinutes('2h30min')).toBe(150);
    expect(parseDurationMinutes('1h 30m')).toBe(90);
    expect(parseDurationMinutes('')).toBeNull();
    expect(parseDurationMinutes('foo')).toBeNull();
    expect(parseDurationMinutes('30 minutos de foo')).toBeNull();
  });
  it('formato de v1', () => {
    expect([0, 1, 59, 60, 61, 120, 125].map((m) => formatDuration(m))).toEqual([
      '< 1 min', '1 min', '59 min', '1 h', '1 h 1 min', '2 h', '2 h 5 min',
    ]);
    expect([0, 59, 60, 125].map((m) => formatDuration(m, true))).toEqual(['00:00', '00:59', '01:00', '02:05']);
    expect(formatDuration(0.5, true)).toBe('00:00');
  });
  it('cronómetro', () => {
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(3725)).toBe('01:02:05');
  });
});

describe('color por texto (vectores verificados de v1)', () => {
  it('es determinista y coincide con v1', () => {
    expect(colorFromString('')).toBe('hsl(210, 80%, 85%)');
    expect(colorFromString('abc')).toBe('hsl(260, 75%, 91%)');
    expect(colorFromString('Dovela')).toBe('hsl(340, 85%, 86%)');
    expect(colorFromString('PGTD - X')).toBe('hsl(130, 60%, 85%)');
  });
});
