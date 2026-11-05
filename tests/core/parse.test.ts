import { describe, expect, it } from 'vitest';
import { hasInvalidDateOrder, isTaskLine, parseTaskLine, parseTasksInNote } from '../../src/core/tasks/parse';

const p = (line: string) => {
  const t = parseTaskLine(line);
  if (!t) throw new Error(`no es tarea: ${line}`);
  return t;
};

describe('reconocimiento de líneas (compatibilidad v1)', () => {
  it('estados y viñetas', () => {
    expect(p('- [ ] a').status).toBe('open');
    expect(p('- [/] a').status).toBe('in-progress');
    expect(p('- [x] a').status).toBe('done');
    expect(p('- [X] mayus').status).toBe('done');
    expect(p('- [-] cancelada').status).toBe('cancelled');
    expect(parseTaskLine('- [!] x')).toBeNull();
    expect(parseTaskLine('* [ ] x')).toBeNull();
    expect(parseTaskLine('1. [ ] x')).toBeNull();
    expect(parseTaskLine('> - [ ] x')).toBeNull();
    expect(parseTaskLine('- [ ] ')).toBeNull();
    expect(parseTaskLine('- [ ]texto')).toBeNull();
    expect(p('-   [ ] tres espacios').text).toBe('tres espacios');
    expect(p('  \t- [ ] anidada 🆔 n1').id).toBe('n1');
    expect(p('- [ ] crlf\r').text).toBe('crlf');
    expect(isTaskLine('- [-] c')).toBe(true);
  });

  it('ejemplo completo de calendario', () => {
    const t = p('- [ ] reunión 📅 2025-03-25 [hI:: 10am] [hF:: 11:30am] [90min] ⏫ 🆔 k1');
    expect(t).toMatchObject({
      id: 'k1', text: 'reunión', status: 'open', date: '2025-03-25', dateSymbol: '📅',
      startTime: '10am', endTime: '11:30am', startMinutes: 600, endMinutes: 690,
      duration: '90min', durationMinutes: 90, hasConflict: false,
    });
    expect(t.priority).toEqual({ rank: 1, symbol: '⏫' });
  });

  it('conflictos de horas y duración', () => {
    expect(p('- [ ] r 📅 2025-03-25 [hI:: 10am] [hF:: 11:30am] [60min]').hasConflict).toBe(true);
    expect(p('- [ ] r [hI:: 10am] [hF:: 9am]').hasConflict).toBe(true);
    expect(p('- [ ] r [hI:: 10am] [90min]').hasConflict).toBe(false);
    expect(p('- [ ] r [hI:: 25:99] [hF:: 26:00]').hasConflict).toBe(true);
  });

  it('fecha principal = primera del texto; el resto en dates', () => {
    const t = p('- [ ] fechas ⏳ 2025-03-24 📅 2025-03-25 🛫 2025-03-20 texto');
    expect(t.date).toBe('2025-03-24');
    expect(t.dateSymbol).toBe('⏳');
    expect(t.dates.map((d) => d.symbol)).toEqual(['⏳', '📅', '🛫']);
    expect(t.text).toBe('fechas texto');
    expect(t.invalidDateOrder).toBe(false); // 🛫 03-20 ≤ ⏳ 03-24 ≤ 📅 03-25
  });

  it('semana normalizada (B-P6)', () => {
    expect(p('- [ ] sem [w:: [[2025-W43]]] #cx-Of').week).toBe('2025-W43');
    expect(p('- [ ] sem [w:: [[Journal/2025/Q4/2025-W43|2025-W43]]]').week).toBe('2025-W43');
    expect(p('- [ ] sem [W::[[2025-W5]]]').week).toBe('2025-W05');
    expect(p('- [ ] sem [w:: [[Journal/2025-W07]]]').week).toBe('2025-W07');
  });

  it('dependencias e ids (B-P2, B-P3, B-P11)', () => {
    expect(p('- [ ] tarea ⛔ dep1 🆔 me1')).toMatchObject({ id: 'me1', dependencies: ['dep1'], text: 'tarea' });
    expect(p('- [ ] tarea ⛔ ^dep1 🆔 me1')).toMatchObject({ id: 'me1', dependencies: ['dep1'] });
    expect(p('- [ ] tarea ⛔ a,b ⛔ c').dependencies).toEqual(['a', 'b', 'c']);
    expect(p('- [ ] Calcular 2^10 hoy').id).toBeUndefined();
    expect(p('- [ ] Calcular 2^10 hoy').text).toBe('Calcular 2^10 hoy');
    expect(p('- [ ] bloque ^abc-123')).toMatchObject({ id: 'abc-123', blockId: 'abc-123', text: 'bloque' });
  });

  it('contextos y personas con acentos (B-P1), sin duplicados (B-P12)', () => {
    const t = p('- [ ] Llamar cliente #cx-Teléfono #px-José_X #px-Ana-Maria #cx-a #cx-a');
    expect(t.contexts).toEqual(['Teléfono', 'a']);
    expect(t.people).toEqual(['José_X', 'Ana-Maria']);
    expect(t.text).toBe('Llamar cliente');
  });

  it('etiquetas GTD con límite de palabra (B-P9)', () => {
    const t = p('- [ ] x #inbox2 #GTD-AlgunDia #otra/sub');
    expect(t.gtdTags).toEqual(['GTD-AlgunDia']);
    expect(t.otherTags).toEqual(['inbox2', 'otra/sub']);
    expect(p('- [ ] y #inbox').gtdTags).toEqual(['inbox']);
  });

  it('prioridad: primer símbolo, 🔺 reconocido, orden relativo de v1', () => {
    const t = p('- [ ] prio 🔼 y ⏬ ➕ 2025-01-01 🔁 every day 🔺');
    expect(t.priority).toEqual({ rank: 2, symbol: '🔼' });
    expect(t.created).toBe('2025-01-01');
    expect(t.recurrence).toBe('every day');
    expect(p('- [ ] a 🔺').priority.rank).toBeLessThan(p('- [ ] a ⏫').priority.rank);
    expect(p('- [ ] a ⏬').priority.rank).toBeLessThan(p('- [ ] a').priority.rank);
  });

  it('metadatos de cierre y creación', () => {
    const t = p('- [x] hecha ✅ 2025-03-01 🆔 d1');
    expect(t).toMatchObject({ done: '2025-03-01', id: 'd1', text: 'hecha' });
    const c = p('- [ ] capturada #inbox ➕ 2025-11-05 14:32');
    expect(c).toMatchObject({ created: '2025-11-05', createdTime: '14:32', text: 'capturada' });
  });

  it('duraciones nuevas (B-P5) y fechas inválidas (R10)', () => {
    expect(p('- [ ] x [1.5h]').durationMinutes).toBe(90);
    expect(p('- [ ] x [45 min]').durationMinutes).toBe(45);
    const bad = p('- [ ] rango ⏳ 2025-13-45');
    expect(bad.hasConflict).toBe(true);
    expect(bad.date).toBe('2025-13-45');
  });

  it('enlaces quedan en el texto', () => {
    expect(p('- [ ] revisar [[Nota|alias]] 📅 2025-01-01').text).toBe('revisar [[Nota|alias]]');
  });
});

describe('orden de fechas', () => {
  it('Start ≤ Scheduled ≤ Due', () => {
    expect(hasInvalidDateOrder([{ symbol: '🛫', date: '2026-11-10' }, { symbol: '📅', date: '2026-11-06' }])).toBe(true);
    expect(hasInvalidDateOrder([{ symbol: '⏳', date: '2026-11-08' }, { symbol: '📅', date: '2026-11-06' }])).toBe(true);
    expect(hasInvalidDateOrder([{ symbol: '🛫', date: '2026-11-01' }, { symbol: '📅', date: '2026-11-06' }])).toBe(false);
  });
});

describe('tareas de una nota (R11)', () => {
  it('ignora frontmatter, bloques de código y comentarios', () => {
    const content = [
      '---',
      'type: PGTD',
      'tags: [x]',
      '---',
      '# Tareas',
      '- [ ] real 1',
      '```',
      '- [ ] en código',
      '```',
      '~~~markdown',
      '- [ ] en tilde',
      '~~~',
      '%%',
      '- [ ] comentada',
      '%%',
      '%% - [ ] inline comentada %%',
      '- [x] real 2',
    ].join('\n');
    const tasks = parseTasksInNote(content, 'A/B.md');
    expect(tasks.map((t) => t.text)).toEqual(['real 1', 'real 2']);
    expect(tasks[0]).toMatchObject({ path: 'A/B.md', line: 5, key: 'A/B.md#5' });
  });
  it('frontmatter sin cerrar no oculta tareas', () => {
    expect(parseTasksInNote('---\n- [ ] a', 'n.md')).toHaveLength(1);
  });
});
