import { describe, expect, it } from 'vitest';
import { parseDayBlock, parseWeekBlock } from '../../src/core/journal/block';
import { dependencyState, groupsSignature, reopenDoneLine, taskIdMap } from '../../src/core/journal/common';
import { dayGroups, classifyDay } from '../../src/core/journal/daily';
import {
  dateInputError, folderChain, normalizeWeekInput, parentFolder, validateBaseFolderPath, weekInputError, type PathKind,
} from '../../src/core/journal/validate';
import { parseTasksInNote } from '../../src/core/tasks/parse';

describe('validaciones de la API (mensajes de v1)', () => {
  it('fechas', () => {
    expect(dateInputError('2025-10-24')).toBeNull();
    expect(dateInputError('2025-02-30')).toBe('Formato de fecha inválido: 2025-02-30. Use YYYY-MM-DD'); // R14: v1 lo aceptaba
    expect(dateInputError('24/10/2025')).toContain('Formato de fecha inválido');
    expect(dateInputError(undefined)).toContain('Formato de fecha inválido: undefined');
  });
  it('semanas', () => {
    expect(weekInputError('2025-W43')).toBeNull();
    expect(weekInputError('2025-W5')).toBeNull();
    expect(weekInputError('2026-W53')).toBeNull();
    expect(weekInputError('2025-W53')).toContain('Formato de semana inválido'); // 2025 tiene 52 semanas
    expect(weekInputError('2025-W99')).toContain('Formato de semana inválido'); // R15
    expect(weekInputError('2025-W0')).toContain('Formato de semana inválido');
    expect(weekInputError('semana')).toBe('Formato de semana inválido: semana. Use YYYY-W## (ej: 2025-W43)');
    expect(normalizeWeekInput('2025-W5')).toBe('2025-W05');
  });
  it('R13: validateBaseFolderPath', () => {
    const fs: Record<string, PathKind> = { a: 'file', b: 'folder', 'b/c': 'folder' };
    const kind = (p: string): PathKind => fs[p] ?? null;
    expect(validateBaseFolderPath('', kind)).toEqual({ valid: false, message: 'La carpeta base no puede estar vacía' });
    expect(validateBaseFolderPath('a:b', kind).valid).toBe(false);
    expect(validateBaseFolderPath('a/b', kind)).toEqual({ valid: false, message: '"a" es un archivo, no una carpeta' });
    expect(validateBaseFolderPath('b/c', kind)).toEqual({ valid: true });
    expect(validateBaseFolderPath('b/nueva/otra', kind)).toEqual({ valid: true });
  });
  it('carpetas', () => {
    expect(folderChain('a/b/c')).toEqual(['a', 'a/b', 'a/b/c']);
    expect(parentFolder('a/b/2025-W43.md')).toBe('a/b');
    expect(parentFolder('x.md')).toBe('');
  });
});

describe('reabrir una tarea completada', () => {
  it('quita [x] y el sello ✅, conserva id de bloque e indentación', () => {
    expect(reopenDoneLine('- [x] Hacer algo ✅ 2025-10-24')).toBe('- [ ] Hacer algo');
    expect(reopenDoneLine('  - [X] Algo 📅 2025-10-20 ✅ 2025-10-24 ^abc')).toBe('  - [ ] Algo 📅 2025-10-20 ^abc');
    expect(reopenDoneLine('- [x] Sin sello')).toBe('- [ ] Sin sello');
    expect(reopenDoneLine('- [ ] Abierta')).toBeNull();
    expect(reopenDoneLine('texto')).toBeNull();
  });
});

describe('dependencias normalizadas', () => {
  it('⛔ ^id se resuelve contra 🆔 id (v1 Journal la dejaba bloqueada siempre)', () => {
    const ts = parseTasksInNote(['- [ ] A ⛔ ^x', '- [x] X 🆔 x', '- [ ] B ⛔ y,z', '- [ ] Y ^y'].join('\n'), 'n.md');
    const byId = taskIdMap(ts);
    expect(dependencyState(ts[0]!, byId)).toEqual({ blocked: false, missing: [] });
    expect(dependencyState(ts[2]!, byId)).toEqual({ blocked: true, missing: ['z'] });
  });
});

describe('firma de grupos', () => {
  it('cambia solo si cambia el contenido', () => {
    const a = parseTasksInNote('- [ ] A 📅 2025-10-24', 'n.md');
    const b = parseTasksInNote('- [ ] A 📅 2025-10-24 ⏫', 'n.md');
    const s1 = groupsSignature(dayGroups(classifyDay(a, '2025-10-24')));
    expect(groupsSignature(dayGroups(classifyDay(a, '2025-10-24')))).toBe(s1);
    expect(groupsSignature(dayGroups(classifyDay(b, '2025-10-24')))).not.toBe(s1);
  });
});

describe('bloques dovela-dia / dovela-semana', () => {
  const today = '2026-11-05';
  it('fecha del bloque, de la nota o de hoy', () => {
    expect(parseDayBlock('2025-10-24', 'Cualquier nota', today)).toMatchObject({ date: '2025-10-24', source: 'block' });
    expect(parseDayBlock('', '2025-10-24 viernes', today)).toMatchObject({ date: '2025-10-24', source: 'note' });
    expect(parseDayBlock('', 'Panel', today)).toMatchObject({ date: today, source: 'today' });
    expect(parseDayBlock('hoy', '2025-10-24 viernes', today)).toMatchObject({ date: today, source: 'block' });
    expect(parseDayBlock('fecha: 2025-01-02', '', today).date).toBe('2025-01-02');
  });
  it('opciones con nombres de v1 o alias en español', () => {
    const c = parseDayBlock('limite: 10\nagrupar-por-semana: sí\nshowOnlyCritical: false\nacciones-rapidas: si', '2025-10-24 viernes', today);
    expect(c.options).toEqual({ showOverdueLimit: 10, groupOverdueByWeek: true, showOnlyCritical: false, enableQuickActions: true });
    expect(c.warnings).toEqual([]);
  });
  it('avisos para opciones desconocidas o inválidas', () => {
    const c = parseDayBlock('limite: mucho\nresaltar-hoy: sí\nbla bla', 'x', today);
    expect(c.warnings).toHaveLength(3); // número inválido, opción solo semanal, línea no reconocida
  });
  it('semana del bloque, de la nota (como Plt - Semanal) o actual', () => {
    expect(parseWeekBlock('2025-W5', 'x', today)).toMatchObject({ week: '2025-W5', source: 'block' });
    expect(parseWeekBlock('', '2025-W43', today)).toMatchObject({ week: '2025-W43', source: 'note' });
    expect(parseWeekBlock('', 'Panel', today)).toMatchObject({ week: '2026-W45', source: 'today' });
    expect(parseWeekBlock('esta semana', '2025-W43', today).week).toBe('2026-W45');
    expect(parseWeekBlock('completadas-colapsadas: no\nlimite: 3', '2025-W43', today).options).toEqual({ showCompletedCollapsed: false, showOverdueLimit: 3 });
  });
});
