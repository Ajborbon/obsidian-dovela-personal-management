import { describe, expect, it } from 'vitest';
import {
  addDays, addMonths, formatWeekCode, fromYymmdd, isoWeekEnd, isoWeekOf, isoWeekStart, isValidYmd,
  normalizeWeekCode, parseTimeOfDay, parseWeekCode, quarterOfMonth, toYymmdd, weekdayNameEs, weeksInIsoYear,
  formatMinutesOfDay, localInstant, toLocalYmd, toLocalHm,
} from '../../src/core/dates';

describe('fechas de calendario', () => {
  it('valida fechas reales', () => {
    expect(isValidYmd('2024-02-29')).toBe(true);
    expect(isValidYmd('2025-02-29')).toBe(false);
    expect(isValidYmd('2025-13-45')).toBe(false);
    expect(isValidYmd('2025-2-01')).toBe(false);
  });
  it('suma días y meses cruzando años', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(addMonths('2025-01-31', 1)).toBe('2025-02-28');
    expect(addMonths('2025-11-15', 2)).toBe('2026-01-15');
  });
  it('nombres en español y YYMMDD', () => {
    expect(weekdayNameEs('2025-10-24')).toBe('viernes');
    expect(weekdayNameEs('2026-11-05')).toBe('jueves');
    expect(toYymmdd('2026-11-05')).toBe('261105');
    expect(fromYymmdd('261105')).toBe('2026-11-05');
    expect(fromYymmdd('261340')).toBeNull();
  });
  it('trimestre correcto (v1 daba Q5 en noviembre)', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(quarterOfMonth)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4]);
  });
});

describe('semanas ISO', () => {
  it('pertenencia al año ISO en bordes de año', () => {
    expect(formatWeekCode(isoWeekOf('2024-12-30'))).toBe('2025-W01');
    expect(formatWeekCode(isoWeekOf('2025-12-29'))).toBe('2026-W01');
    expect(formatWeekCode(isoWeekOf('2027-01-01'))).toBe('2026-W53');
    expect(formatWeekCode(isoWeekOf('2026-11-05'))).toBe('2026-W45');
    expect(formatWeekCode(isoWeekOf('2025-10-24'))).toBe('2025-W43');
  });
  it('lunes de una semana no depende de la fecha actual', () => {
    expect(isoWeekStart(2025, 43)).toBe('2025-10-20');
    expect(isoWeekEnd(2025, 43)).toBe('2025-10-26');
    expect(isoWeekStart(2025, 1)).toBe('2024-12-30');
    expect(isoWeekStart(2026, 53)).toBe('2026-12-28');
  });
  it('años de 53 semanas', () => {
    expect(weeksInIsoYear(2020)).toBe(53);
    expect(weeksInIsoYear(2026)).toBe(53);
    expect(weeksInIsoYear(2025)).toBe(52);
  });
  it('códigos de semana de 1 o 2 dígitos', () => {
    expect(normalizeWeekCode('2025-W5')).toBe('2025-W05');
    expect(normalizeWeekCode('2025-w43')).toBe('2025-W43');
    expect(parseWeekCode('2025-W53')).toBeNull();
    expect(parseWeekCode('2026-W53')).toEqual({ year: 2026, week: 53 });
  });
});

describe('horas', () => {
  it('am/pm y 24 h (vectores de v1 parseTimeToMinutes)', () => {
    expect(parseTimeOfDay('10am')).toBe(600);
    expect(parseTimeOfDay('9am')).toBe(540);
    expect(parseTimeOfDay('12am')).toBe(0);
    expect(parseTimeOfDay('12pm')).toBe(720);
    expect(parseTimeOfDay('10:30')).toBe(630);
    expect(parseTimeOfDay('12:30 am')).toBe(30);
    expect(parseTimeOfDay('0am')).toBe(0);
    expect(parseTimeOfDay('11:30am')).toBe(690);
  });
  it('rechaza horas fuera de rango (v1 aceptaba 25:99 y 13pm)', () => {
    expect(parseTimeOfDay('25:99')).toBeNull();
    expect(parseTimeOfDay('13pm')).toBeNull();
    expect(parseTimeOfDay('9')).toBeNull();
    expect(parseTimeOfDay('')).toBeNull();
    expect(parseTimeOfDay(undefined)).toBeNull();
  });
  it('formatea minutos del día', () => {
    expect(formatMinutesOfDay(630)).toBe('10:30');
    expect(formatMinutesOfDay(1440 + 5)).toBe('00:05');
  });
  it('instantes locales', () => {
    const d = localInstant('2026-11-05', 9 * 60 + 15);
    expect(toLocalYmd(d)).toBe('2026-11-05');
    expect(toLocalHm(d)).toBe('09:15');
  });
});
