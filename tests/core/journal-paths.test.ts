import { describe, expect, it } from 'vitest';
import {
  applyPattern, dailyFolderChain, dailyNoteName, dailyNotePath, periodCode, periodNotePath, weeklyLink, weeklyLinkPath,
} from '../../src/core/journal/paths';
import { DEFAULT_JOURNAL, type JournalSettings } from '../../src/core/settings';

const v1Defaults: JournalSettings = { ...DEFAULT_JOURNAL, quarterSubfolder: true, monthSubfolder: false };
const base = DEFAULT_JOURNAL.baseFolderPath;

describe('rutas de journal', () => {
  it('nombre y ruta diaria (defaults v2 = vault real YYYY/MM)', () => {
    expect(dailyNoteName('2025-10-24')).toBe('2025-10-24 viernes');
    expect(dailyNotePath(DEFAULT_JOURNAL, '2025-10-24')).toBe(`${base}/2025/10/2025-10-24 viernes.md`);
  });
  it('trimestre correcto con los defaults de v1 (v1 daba Q2 en febrero y Q5 en noviembre)', () => {
    expect(dailyNotePath(v1Defaults, '2025-02-15')).toBe(`${base}/2025/Q1/2025-02-15 sábado.md`);
    expect(dailyNotePath(v1Defaults, '2025-11-05')).toBe(`${base}/2025/Q4/2025-11-05 miércoles.md`);
    expect(dailyNotePath(v1Defaults, '2025-10-24')).toBe(`${base}/2025/Q4/2025-10-24 viernes.md`);
  });
  it('enlace de semana con año ISO', () => {
    expect(weeklyLinkPath(v1Defaults, '2025-W43')).toBe(`${base}/2025/Q4/2025-W43`);
    expect(weeklyLink(v1Defaults, '2025-W43')).toBe(`[w::[[${base}/2025/Q4/2025-W43|2025-W43]]]`);
    expect(weeklyLinkPath(v1Defaults, '2026-W01')).toBe(`${base}/2026/Q1/2026-W01`);
    expect(() => weeklyLinkPath(v1Defaults, 'x')).toThrow('Formato de semana inválido');
  });
  it('patrones con todas las apariciones', () => {
    expect(applyPattern('{YYYY}/{MM}/{YYYY}-W{WW}', { YYYY: '2025', Q: '4', MM: '10', WW: '43' })).toBe('2025/10/2025-W43');
  });
  it('notas de periodo', () => {
    expect(periodCode('week', '2025-12-29')).toBe('2026-W01');
    expect(periodCode('month', '2025-12-29')).toBe('2025-12');
    expect(periodCode('quarter', '2025-12-29')).toBe('2025-Q4');
    expect(periodCode('year', '2025-12-29')).toBe('2025');
    expect(periodNotePath(DEFAULT_JOURNAL, 'week', '2025-12-29')).toBe(`${base}/2026/2026-W01.md`);
    expect(periodNotePath(DEFAULT_JOURNAL, 'month', '2025-12-29')).toBe(`${base}/2025/2025-12.md`);
  });
  it('cadena de carpetas', () => {
    expect(dailyFolderChain(DEFAULT_JOURNAL, '2025-10-24').at(-1)).toBe(`${base}/2025/10`);
    expect(dailyFolderChain(DEFAULT_JOURNAL, '2025-10-24')[0]).toBe('03 - Gestion Personal');
  });
});
