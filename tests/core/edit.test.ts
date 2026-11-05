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
    // La misma tarea ya cerrada se localiza (el estado no cuenta), pero cerrarla de nuevo no aplica.
    expect(locateTaskLine(lines, { raw: '- [ ] a' })).toEqual({ ok: true, line: 0, how: 'raw' });
    expect(applyTaskEdit(lines.join('\n'), { raw: '- [ ] a' }, (l) => markDone(l, TODAY))).toEqual({ ok: false, reason: 'not-applicable' });
  });
  it('aplica la edición conservando CRLF', () => {
    const r = applyTaskEdit('# T\r\n- [ ] foo\r\n- [ ] bar\r\n', { line: 1, raw: '- [ ] foo' }, (l) => markDone(l, TODAY));
    expect(r).toEqual({ ok: true, line: 1, content: `# T\r\n- [x] foo ✅ ${TODAY}\r\n- [ ] bar\r\n` });
    const na = applyTaskEdit('- [x] foo', { line: 0, raw: '- [x] foo' }, (l) => markDone(l, TODAY));
    expect(na).toEqual({ ok: false, reason: 'not-applicable' });
  });
});

describe('cerrar una tarea que la app puso en progreso (revisión #2)', () => {
  it('el raw original `[ ]` localiza la línea ya `[/]`', () => {
    const raw = '- [ ] escribir informe #cx-Oficina';
    const started = applyTaskEdit(`# P\n${raw}\n`, { line: 1, raw }, markInProgress);
    expect(started.ok).toBe(true);
    const content = started.ok ? started.content : '';
    expect(content).toContain('- [/] escribir informe');
    const closed = applyTaskEdit(content, { line: 1, raw }, (l) => markDone(l, TODAY));
    expect(closed).toEqual({ ok: true, line: 1, content: `# P\n- [x] escribir informe #cx-Oficina ✅ ${TODAY}\n` });
    // también si la línea se movió
    const moved = applyTaskEdit(`# P\nnueva línea\n- [/] escribir informe #cx-Oficina\n`, { line: 1, raw }, (l) => markDone(l, TODAY));
    expect(moved.ok && moved.line).toBe(2);
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
