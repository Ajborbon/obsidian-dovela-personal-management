import { describe, expect, it } from 'vitest';
import { analyzeSelection, applyTaskEdit, locateTaskLine, markDone, markInProgress, markOpen } from '../../src/core/tasks/edit';

const TODAY = '2026-11-05';

describe('ediciones de línea', () => {
  it('marcar en progreso / abrir', () => {
    expect(markInProgress('- [ ] foo')).toBe('- [/] foo');
    expect(markInProgress('  - [ ] foo')).toBe('  - [/] foo');
    expect(markInProgress('- [/] foo')).toBeNull();
    expect(markOpen('- [/] foo')).toBe('- [ ] foo');
  });
  it('cerrar con sello de fecha', () => {
    expect(markDone('- [ ] foo', TODAY)).toBe(`- [x] foo ✅ ${TODAY}`);
    expect(markDone('  - [/] foo 🆔 a1', TODAY)).toBe(`  - [x] foo 🆔 a1 ✅ ${TODAY}`);
    expect(markDone('- [ ] foo ✅ 2026-01-01', TODAY)).toBe('- [x] foo ✅ 2026-01-01');
    expect(markDone('- [x] foo', TODAY)).toBeNull();
    expect(markDone('texto', TODAY)).toBeNull();
    expect(markDone('-  [ ] dos espacios', TODAY)).toBe(`-  [x] dos espacios ✅ ${TODAY}`);
  });
  it('B-S4: el sello va antes del id de bloque final', () => {
    expect(markDone('- [ ] foo ^abc', TODAY)).toBe(`- [x] foo ✅ ${TODAY} ^abc`);
  });
});

describe('localización segura (B-S1)', () => {
  const lines = ['- [x] a', '- [ ] b', '- [ ] c 🆔 c1', '- [ ] b'];
  it('por línea verificada', () => {
    expect(locateTaskLine(lines, { line: 2, raw: '- [ ] c 🆔 c1' })).toEqual({ ok: true, line: 2, how: 'line' });
  });
  it('por id si la línea cambió', () => {
    expect(locateTaskLine(lines, { line: 0, raw: '- [ ] c viejo 🆔 c1', id: 'c1' })).toEqual({ ok: true, line: 2, how: 'id' });
  });
  it('nunca cierra otra tarea: no encontrada o ambigua', () => {
    expect(locateTaskLine(lines, { line: 5, raw: '- [ ] zzz' })).toEqual({ ok: false, reason: 'not-found' });
    expect(locateTaskLine(lines, { line: 9, raw: '- [ ] b' })).toEqual({ ok: false, reason: 'ambiguous' });
    expect(locateTaskLine(lines, { raw: '- [ ] a' })).toEqual({ ok: false, reason: 'not-found' });
  });
  it('aplica la edición conservando CRLF', () => {
    const r = applyTaskEdit('# T\r\n- [ ] foo\r\n- [ ] bar\r\n', { line: 1, raw: '- [ ] foo' }, (l) => markDone(l, TODAY));
    expect(r).toEqual({ ok: true, line: 1, content: `# T\r\n- [x] foo ✅ ${TODAY}\r\n- [ ] bar\r\n` });
    const na = applyTaskEdit('- [x] foo', { line: 0, raw: '- [x] foo' }, (l) => markDone(l, TODAY));
    expect(na).toEqual({ ok: false, reason: 'not-applicable' });
  });
});

describe('análisis de selección', () => {
  it('casos de v1', () => {
    expect(analyzeSelection('', 3, 3, '- [ ] x')).toEqual({ kind: 'note' });
    expect(analyzeSelection('a\nb', 3, 4, '- [ ] x').kind).toBe('error');
    expect(analyzeSelection('texto', 3, 3, 'texto normal').kind).toBe('error');
    expect(analyzeSelection('x', 3, 3, '- [x] x').kind).toBe('error');
    expect(analyzeSelection('tarea', 3, 3, '- [ ] tarea #cx-a 🆔 t1')).toEqual({
      kind: 'task', line: 3, raw: '- [ ] tarea #cx-a 🆔 t1', text: 'tarea', status: 'open', id: 't1',
    });
  });
});
