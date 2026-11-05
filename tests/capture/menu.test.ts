import { describe, expect, it } from 'vitest';
import { nextWeekday, parseLegacyDate, quickDates, weekdayOfNextWeek } from '../../src/core/capture/dates';
import { fold, matchLabel } from '../../src/core/capture/match';
import {
  applyInsert,
  buildMenu,
  collapsePrefixOnBackspace,
  findTrigger,
  projectQueryAlive,
  type MenuData,
  type MenuProject,
} from '../../src/core/capture/menu';
import { buildMenuData, countTagValues, menuProjects, projectRefs } from '../../src/core/capture/sources';
import { parseCapture } from '../../src/core/capture/tokenize';
import type { NoteType } from '../../src/core/notes/types';

const proj = (name: string, isActiveNote = false, type = 'PGTD'): MenuProject => ({ name, path: `F/${name}.md`, type, folder: 'F', isActiveNote });
const data: MenuData = {
  projects: [proj('Nota abierta', true, 'Ax'), proj('PGTD - Dashboard Q3'), proj('PGTD - Dovela'), proj('AV - Salud', false, 'AV')],
  contexts: [{ value: 'oficina', count: 5 }, { value: 'casa', count: 3 }, { value: 'llamadas', count: 1 }, { value: 'señal', count: 1 }],
  people: [{ value: 'maría', count: 2 }],
};
const alive = (q: string) => projectQueryAlive(q, data.projects);
const trig = (text: string, cursor = text.length) => findTrigger(text, cursor, alive);

describe('match', () => {
  it('pliega acentos con mapa de posiciones', () => {
    const f = fold('Ñandú');
    expect(f.text).toBe('nandu');
    expect(f.map).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('relevancia: exacta < prefijo < inicio de palabra < subcadena', () => {
    expect(matchLabel('casa', 'casa')?.score).toBe(0);
    expect(matchLabel('casa', 'ca')?.score).toBe(1);
    expect(matchLabel('PGTD - Dovela', 'dov')?.score).toBe(2);
    expect(matchLabel('PGTD - Dovela', 'ove')?.score).toBe(3);
    expect(matchLabel('casa', 'xyz')).toBeNull();
    expect(matchLabel('señal', 'sen')?.ranges).toEqual([[0, 3]]);
    expect(matchLabel('PGTD - Dovela', 'dov')?.ranges).toEqual([[7, 10]]);
  });
});

describe('findTrigger', () => {
  it('detecta # @ ! tras inicio o espacio', () => {
    expect(trig('#')).toMatchObject({ kind: '#', query: '' });
    expect(trig('hola #cx-ca')).toMatchObject({ kind: '#', start: 5, query: 'cx-ca' });
    expect(trig('hola @PG')).toMatchObject({ kind: '@', query: 'PG' });
    expect(trig('hola !')).toMatchObject({ kind: '!', query: '' });
    expect(trig('hola!')).toBeNull();
    expect(trig('a@b')).toBeNull();
  });

  it('espacio tras un token completo cierra el menú', () => {
    expect(trig('#cx-casa ')).toBeNull();
    expect(trig('#cx-casa ir al súper')).toBeNull(); // defecto v1: el menú se tragaba el Enter
    expect(trig('@PGTD - Dovela ')).toBeNull();
    expect(trig('@PGTD - Dovela comprar')).toBeNull();
  });

  it('@ admite espacios mientras haya coincidencias', () => {
    expect(trig('@PGTD - Da')).toMatchObject({ kind: '@', query: 'PGTD - Da' });
    expect(trig('@PGTD ')).toMatchObject({ kind: '@' });
    expect(trig('@ ')).toBeNull();
  });

  it('! admite dos palabras solo con prefijo de fecha', () => {
    expect(trig('x !próximo lu')).toMatchObject({ kind: '!', query: 'próximo lu' });
    expect(trig('x !mañana a')).toBeNull();
  });

  it('manda el disparador más cercano al cursor', () => {
    expect(trig('@PGTD - Dovela #cx-')).toMatchObject({ kind: '#' });
    expect(trig('#cx-casa @PG')).toMatchObject({ kind: '@' });
    expect(trig('#cx-casa @PG', 3)).toMatchObject({ kind: '#', query: 'cx' });
  });
});

describe('buildMenu', () => {
  const menu = (text: string) => {
    const t = trig(text);
    if (!t) throw new Error('sin disparador');
    return buildMenu(t, data);
  };

  it('# → menú principal; filtra por prefijo; libre si no coincide', () => {
    expect(menu('#').options.map((o) => o.label)).toEqual(['cx-', 'px-', 'GTD-']);
    expect(menu('#g').options.map((o) => o.label)).toEqual(['GTD-']);
    expect(menu('#inbox').options).toEqual([]);
    expect(menu('#inbox').emptyText).toContain('Etiqueta libre');
  });

  it('#cx- → contextos reales por frecuencia, filtrado incremental con resaltado y relevancia', () => {
    expect(menu('#cx-').options.map((o) => o.label)).toEqual(['oficina', 'casa', 'llamadas', 'señal']);
    const m = menu('#cx-l');
    expect(m.level).toBe('context');
    expect(m.options.map((o) => o.label)).toEqual(['llamadas', 'señal']); // prefijo antes que subcadena
    expect(menu('#cx-a').options.map((o) => o.label)).toEqual(['oficina', 'casa', 'llamadas', 'señal']); // empate → frecuencia
    expect(menu('#cx-sen').options[0]).toMatchObject({ label: 'señal', insert: '#cx-señal', ranges: [[0, 3]] });
    expect(menu('#CX-of').options[0]?.label).toBe('oficina');
    expect(menu('#cx-zzz').options).toEqual([]);
  });

  it('#px- y #gtd-', () => {
    expect(menu('#px-').options.map((o) => o.insert)).toEqual(['#px-maría']);
    expect(menu('#gtd-').options.map((o) => o.insert)).toEqual(['#GTD-AlgunDia', '#GTD-EstaSemanaNo']);
    expect(menu('#GTD-esta').options.map((o) => o.insert)).toEqual(['#GTD-EstaSemanaNo']);
  });

  it('@ → nota activa siempre primero, luego relevancia', () => {
    expect(menu('@').options.map((o) => o.label)).toEqual(['Nota abierta', 'PGTD - Dashboard Q3', 'PGTD - Dovela', 'AV - Salud']);
    expect(menu('@a').options[0]?.label).toBe('Nota abierta');
    expect(menu('@dov').options.map((o) => o.label)).toEqual(['PGTD - Dovela']);
    expect(menu('@').options[1]).toMatchObject({ badge: 'PGTD', detail: 'F' });
  });
});

describe('applyInsert / backspace', () => {
  it('opción final: sustituye el token y añade espacio', () => {
    const t = trig('Llamar #cx-ca')!;
    expect(applyInsert('Llamar #cx-ca', t, '#cx-casa', false)).toEqual({ text: 'Llamar #cx-casa ', cursor: 16 });
  });

  it('submenú: mantiene abierto sin espacio', () => {
    const t = trig('x #c')!;
    expect(applyInsert('x #c', t, '#cx-', true)).toEqual({ text: 'x #cx-', cursor: 6 });
  });

  it('reutiliza el espacio existente y consume el resto del token #', () => {
    const text = 'x #cx-ca|sa resto'.replace('|', '');
    const t = findTrigger(text, 8, alive)!;
    expect(applyInsert(text, t, '#cx-casa', false)).toEqual({ text: 'x #cx-casa resto', cursor: 11 });
  });

  it('@ sustituye hasta el cursor', () => {
    const t = trig('a @PGTD - Do')!;
    expect(applyInsert('a @PGTD - Do', t, '@PGTD - Dovela', false).text).toBe('a @PGTD - Dovela ');
  });

  it('Backspace sobre #cx- vuelve al menú principal', () => {
    const text = 'x #cx-';
    expect(collapsePrefixOnBackspace(text, text.length, trig(text))).toEqual({ text: 'x #', cursor: 3 });
    expect(collapsePrefixOnBackspace('x #cx-c', 7, trig('x #cx-c'))).toBeNull();
  });

  it('flujo completo menú → tokenizador', () => {
    let text = 'Llamar ';
    text += '@PGTD - Do';
    let t = trig(text)!;
    text = applyInsert(text, t, buildMenu(t, data).options[0]!.insert, false).text;
    text += '#cx-ll';
    t = trig(text)!;
    text = applyInsert(text, t, buildMenu(t, data).options[0]!.insert, false).text;
    expect(text).toBe('Llamar @PGTD - Dovela #cx-llamadas ');
    expect(trig(text)).toBeNull();
    const p = parseCapture(text, { today: '2026-11-05', projects: projectRefs([], data.projects) });
    expect(p.project?.name).toBe('PGTD - Dovela');
    expect(p.description).toBe('Llamar');
  });
});

describe('fechas', () => {
  const today = '2026-11-05'; // jueves
  it('accesos rápidos', () => {
    expect(quickDates(today).map((q) => q.date)).toEqual(['2026-11-05', '2026-11-06', '2026-11-06', '2026-11-13', '2026-12-05']);
    expect(quickDates('2026-11-06')[2]?.date).toBe('2026-11-06'); // viernes → hoy
    expect(quickDates('2026-11-07')[2]?.date).toBe('2026-11-13'); // sábado → viernes siguiente
    expect(quickDates('2026-01-31')[4]?.date).toBe('2026-02-28');
  });

  it('día de la semana', () => {
    expect(nextWeekday(today, 4)).toBe(today);
    expect(nextWeekday(today, 3)).toBe('2026-11-11');
    expect(weekdayOfNextWeek(today, 1)).toBe('2026-11-09');
    expect(weekdayOfNextWeek('2026-11-08', 1)).toBe('2026-11-09'); // domingo → lunes siguiente
    expect(parseLegacyDate('SÁBADO', today)).toBe('2026-11-07');
    expect(parseLegacyDate('sun', today)).toBe('2026-11-08');
    expect(parseLegacyDate('próxima semana', today)).toBe('2026-11-12');
    expect(parseLegacyDate('260230', today)).toBeNull();
    expect(parseLegacyDate('nada', today)).toBeNull();
  });
});

describe('sources', () => {
  const note = (path: string, type: NoteType, estado: string) => ({
    path, basename: path.slice(path.lastIndexOf('/') + 1, -3), folder: path.slice(0, path.lastIndexOf('/')), type, estado,
  });
  const notes = [
    note('P/PGTD - B.md', 'PGTD', '🟢'),
    note('P/PGTD - A.md', 'PGTD', '🟢'),
    note('P/PGTD - Cerrado.md', 'PGTD', '🔵'),
    note('V/AV - Vida.md', 'AV', '🟢'),
    note('Q/PQ - Plan.md', 'PQ', '🟢'),
    note('R/RR - Recurso.md', 'RR', '🟢'),
    note('X/Ax 250101 - Idea.md', 'Ax', '🟢'),
  ];

  it('solo tipos de proyecto activos, ordenados por tipo y nombre', () => {
    expect(menuProjects(notes, null).map((p) => p.name)).toEqual(['AV - Vida', 'PQ - Plan', 'PGTD - A', 'PGTD - B', 'RR - Recurso']);
  });

  it('nota activa primero aunque no haya proyectos activos, sin duplicados', () => {
    const active = { path: 'X/Ax 250101 - Idea.md', basename: 'Ax 250101 - Idea', folder: 'X', type: 'Ax' };
    expect(menuProjects([], active).map((p) => p.name)).toEqual(['Ax 250101 - Idea']);
    const withActiveProject = menuProjects(notes, { path: 'P/PGTD - B.md', basename: 'PGTD - B', folder: 'P' });
    expect(withActiveProject.map((p) => p.name)).toEqual(['PGTD - B', 'AV - Vida', 'PQ - Plan', 'PGTD - A', 'RR - Recurso']);
    expect(withActiveProject[0]?.isActiveNote).toBe(true);
  });

  it('contextos/personas reales con frecuencia', () => {
    const r = countTagValues([{ contexts: ['casa', 'oficina'], people: [] }, { contexts: ['casa'], people: ['ana'] }]);
    expect(r.contexts).toEqual([{ value: 'casa', count: 2 }, { value: 'oficina', count: 1 }]);
    expect(r.people).toEqual([{ value: 'ana', count: 1 }]);
  });

  it('projectRefs: activa rango 0, menú 1, resto 2, sin duplicados', () => {
    const md = buildMenuData(notes, [], { path: 'X/Ax 250101 - Idea.md', basename: 'Ax 250101 - Idea', folder: 'X' });
    const refs = projectRefs(notes, md.projects);
    expect(refs).toHaveLength(notes.length);
    expect(refs.find((r) => r.name === 'Ax 250101 - Idea')?.rank).toBe(0);
    expect(refs.find((r) => r.name === 'PGTD - A')?.rank).toBe(1);
    expect(refs.find((r) => r.name === 'PGTD - Cerrado')?.rank).toBe(2);
  });
});
