import { describe, expect, it } from 'vitest';
import {
  buildTaskLine,
  captureTags,
  dateOrderWarnings,
  longestProjectAt,
  parseCapture,
  type ProjectRef,
} from '../../src/core/capture/tokenize';
import { parseTaskLine } from '../../src/core/tasks/parse';

const TODAY = '2026-11-05'; // jueves
const projects: ProjectRef[] = [
  { name: 'PGTD - X', path: 'P/PGTD - X.md', rank: 1 },
  { name: 'PGTD - X Y', path: 'P/PGTD - X Y.md', rank: 1 },
  { name: 'PGTD - Dashboard Q3', path: 'P/PGTD - Dashboard Q3.md', rank: 1 },
  { name: 'AV - Gerente de Vida', path: 'AV/AV - Gerente de Vida.md', rank: 1 },
  { name: 'Nota con acentos ñandú', path: 'N/Nota con acentos ñandú.md', rank: 2 },
  { name: 'Duplicada', path: 'A/Duplicada.md', rank: 2 },
  { name: 'Duplicada', path: 'B/Duplicada.md', rank: 0 },
];
const opts = { today: TODAY, projects };
const parse = (s: string) => parseCapture(s, opts);
const codes = (s: string) => parse(s).warnings.map((w) => w.code);

describe('parseCapture · proyecto @', () => {
  it('no consume el resto del texto (defecto v1 RI-B §3.6)', () => {
    const p = parse('@PGTD - X comprar leche');
    expect(p.project?.path).toBe('P/PGTD - X.md');
    expect(p.description).toBe('comprar leche');
  });

  it('coincidencia más larga', () => {
    expect(parse('@PGTD - X Y comprar').project?.name).toBe('PGTD - X Y');
    expect(parse('@PGTD - X Yate').project?.name).toBe('PGTD - X');
    expect(parse('@PGTD - X Yate').description).toBe('Yate');
  });

  it('exige límite de palabra tras el nombre', () => {
    expect(longestProjectAt('PGTD - Xylo', 0, projects)).toBeNull();
    expect(parse('@PGTD - Xylo algo').project).toBeNull();
    expect(codes('@PGTD - Xylo algo')).toContain('project-not-found');
  });

  it('en medio del texto, con etiquetas y fechas alrededor', () => {
    const p = parse('Llamar @PGTD - Dashboard Q3 #cx-llamadas 📅 2026-11-10');
    expect(p.project?.name).toBe('PGTD - Dashboard Q3');
    expect(p.description).toBe('Llamar');
    expect(p.contexts).toEqual(['llamadas']);
    expect(p.dates.due).toBe('2026-11-10');
  });

  it('@Proyecto seguido de fecha del calendario (defecto v1: caía en el Inbox)', () => {
    const p = parse('Revisar @PGTD - X 📅 2026-11-10');
    expect(p.project?.name).toBe('PGTD - X');
    expect(p.description).toBe('Revisar');
  });

  it('sin distinguir mayúsculas; acentos y ñ', () => {
    expect(parse('@pgtd - x hola').project?.name).toBe('PGTD - X');
    expect(parse('@Nota con acentos ñandú tarea').project?.name).toBe('Nota con acentos ñandú');
  });

  it('@[[Nombre]] delimitado', () => {
    const p = parse('Tarea @[[PGTD - X|alias]] fin');
    expect(p.project?.name).toBe('PGTD - X');
    expect(p.description).toBe('Tarea fin');
    expect(codes('Tarea @[[No existe]]')).toContain('project-not-found');
  });

  it('nombres repetidos: gana el rango menor', () => {
    expect(parse('@Duplicada algo').project?.path).toBe('B/Duplicada.md');
  });

  it('no encontrado: el texto se conserva y se avisa', () => {
    const p = parse('comprar @Inexistente leche');
    expect(p.project).toBeNull();
    expect(p.description).toBe('comprar @Inexistente leche');
    expect(p.warnings[0]?.code).toBe('project-not-found');
  });

  it('@ sin espacio previo (correo) no es disparador', () => {
    const p = parse('escribir a juan@PGTD - X');
    expect(p.project).toBeNull();
    expect(p.warnings).toEqual([]);
  });

  it('varios proyectos: se usa el primero', () => {
    const p = parse('@PGTD - X algo @AV - Gerente de Vida');
    expect(p.project?.name).toBe('PGTD - X');
    expect(p.description).toBe('algo @AV - Gerente de Vida');
    expect(codes('@PGTD - X algo @AV - Gerente de Vida')).toContain('project-multiple');
  });
});

describe('parseCapture · etiquetas', () => {
  it('cx/px con acentos, ñ y guiones; sin duplicados', () => {
    const p = parse('Tarea #cx-oficina_2 #px-maría #cx-señal-débil #cx-oficina_2');
    expect(p.contexts).toEqual(['oficina_2', 'señal-débil']);
    expect(p.people).toEqual(['maría']);
    expect(p.description).toBe('Tarea');
  });

  it('prefijo en mayúsculas se normaliza', () => {
    expect(parse('x #CX-Casa').contexts).toEqual(['Casa']);
  });

  it('estados GTD normalizan mayúsculas', () => {
    const p = parse('algo #gtd-algundia #GTD-estasemanano');
    expect(p.gtd).toEqual(['GTD-AlgunDia', 'GTD-EstaSemanaNo']);
    expect(buildTaskLine(p, { date: TODAY })).toBe('- [ ] algo #GTD-AlgunDia #GTD-EstaSemanaNo ➕ 2026-11-05');
  });

  it('estado GTD desconocido se queda como etiqueta libre', () => {
    const p = parse('algo #GTD-Mañana');
    expect(p.gtd).toEqual([]);
    expect(p.description).toBe('algo #GTD-Mañana');
    expect(p.warnings.map((w) => w.code)).toContain('gtd-unknown');
  });

  it('otras etiquetas se conservan en su sitio', () => {
    const p = parse('Leer #libro capítulo 3 #cx-casa');
    expect(p.description).toBe('Leer #libro capítulo 3');
    expect(buildTaskLine(p, { date: TODAY })).toBe('- [ ] Leer #libro capítulo 3 #cx-casa ➕ 2026-11-05');
  });

  it('prefijo incompleto se descarta con aviso', () => {
    const p = parse('tarea #cx-');
    expect(p.description).toBe('tarea');
    expect(p.warnings.map((w) => w.code)).toContain('tag-incomplete');
  });

  it('#inbox explícito no se duplica', () => {
    expect(buildTaskLine(parse('tarea #inbox'), { date: TODAY })).toBe('- [ ] tarea #inbox ➕ 2026-11-05');
    expect(captureTags(parse('tarea #inbox #cx-casa'))).toEqual(['#cx-casa', '#inbox']);
  });

  it('puntuación tras la etiqueta', () => {
    const p = parse('ver #cx-casa, luego');
    expect(p.contexts).toEqual(['casa']);
    expect(p.description).toBe('ver , luego');
  });
});

describe('parseCapture · fechas', () => {
  it('fechas del calendario', () => {
    const p = parse('x 🛫 2026-11-06 ⏳ 2026-11-07 📅 2026-11-08');
    expect(p.dates).toEqual({ start: '2026-11-06', scheduled: '2026-11-07', due: '2026-11-08' });
    expect(p.description).toBe('x');
  });

  it('legacy en español e inglés → 📅', () => {
    const due = (s: string) => parse(`tarea ${s}`).dates.due;
    expect(due('!hoy')).toBe('2026-11-05');
    expect(due('!mañana')).toBe('2026-11-06');
    expect(due('!manana')).toBe('2026-11-06');
    expect(due('!ayer')).toBe('2026-11-04');
    expect(due('!today')).toBe('2026-11-05');
    expect(due('!Tomorrow')).toBe('2026-11-06');
    expect(due('!yesterday')).toBe('2026-11-04');
    expect(due('!lunes')).toBe('2026-11-09');
    expect(due('!jueves')).toBe('2026-11-05');
    expect(due('!viernes')).toBe('2026-11-06');
    expect(due('!miércoles')).toBe('2026-11-11');
    expect(due('!friday')).toBe('2026-11-06');
    expect(due('!próximo viernes')).toBe('2026-11-13');
    expect(due('!next monday')).toBe('2026-11-09');
    expect(due('!pasado mañana')).toBe('2026-11-07');
    expect(due('!2026-12-24')).toBe('2026-12-24');
    expect(due('!261224')).toBe('2026-12-24');
  });

  it('la fecha legacy se elimina de la descripción (dos palabras incluidas)', () => {
    expect(parse('llamar !próximo lunes a Ana').description).toBe('llamar a Ana');
    expect(parse('llamar !mañana a Ana').description).toBe('llamar a Ana');
  });

  it('fecha no reconocida se queda con aviso', () => {
    const p = parse('tarea !algúndía');
    expect(p.dates.due).toBeUndefined();
    expect(p.description).toBe('tarea !algúndía');
    expect(p.warnings.map((w) => w.code)).toContain('date-unknown');
    expect(parse('tarea !261332').warnings.map((w) => w.code)).toContain('date-unknown');
  });

  it('exclamación pegada a una palabra no es disparador', () => {
    const p = parse('¡Hola! mundo');
    expect(p.description).toBe('¡Hola! mundo');
    expect(p.warnings).toEqual([]);
  });

  it('fecha de calendario inválida se queda en el texto', () => {
    const p = parse('x 📅 2026-02-30');
    expect(p.dates.due).toBeUndefined();
    expect(p.warnings.map((w) => w.code)).toContain('date-invalid');
  });

  it('duplicadas: gana la última, con aviso', () => {
    const p = parse('x 📅 2026-11-10 !mañana');
    expect(p.dates.due).toBe('2026-11-06');
    expect(p.warnings.map((w) => w.code)).toContain('date-duplicate');
  });

  it('coherencia Start ≤ Schedule ≤ Due', () => {
    expect(dateOrderWarnings({ start: '2026-11-10', due: '2026-11-09' })).toHaveLength(1);
    expect(dateOrderWarnings({ start: '2026-11-10', scheduled: '2026-11-09', due: '2026-11-08' })).toHaveLength(3);
    expect(dateOrderWarnings({ start: '2026-11-08', scheduled: '2026-11-09', due: '2026-11-09' })).toHaveLength(0);
    expect(codes('x 🛫 2026-11-10 📅 2026-11-09')).toContain('date-order');
  });
});

describe('parseCapture · descripción', () => {
  it('vacía → aviso', () => {
    expect(codes('@PGTD - X #cx-casa !hoy')).toContain('empty');
    expect(codes('   ')).toContain('empty');
  });

  it('normaliza espacios', () => {
    expect(parse('  hola    mundo  ').description).toBe('hola mundo');
  });
});

describe('buildTaskLine', () => {
  it('formato v1 con hora y orden de etiquetas/fechas', () => {
    const p = parse('📅 2026-11-10 Llamar #px-ana #GTD-AlgunDia #cx-tel 🛫 2026-11-06');
    expect(buildTaskLine(p, { date: '2026-11-05', time: '14:32' })).toBe(
      '- [ ] Llamar #cx-tel #px-ana #GTD-AlgunDia ➕ 2026-11-05 14:32 🛫 2026-11-06 📅 2026-11-10',
    );
  });

  it('#inbox si no hay cx/px/GTD (también con proyecto)', () => {
    expect(buildTaskLine(parse('@PGTD - X comprar'), { date: TODAY })).toBe('- [ ] comprar #inbox ➕ 2026-11-05');
  });

  it('la línea generada la entiende el parser de tareas', () => {
    const line = buildTaskLine(parse('Revisar informe #cx-oficina #px-maría ⏳ 2026-11-06 !viernes'), { date: TODAY, time: '09:05' });
    const t = parseTaskLine(line);
    expect(t?.status).toBe('open');
    expect(t?.text).toBe('Revisar informe');
    expect(t?.contexts).toEqual(['oficina']);
    expect(t?.people).toEqual(['maría']);
    expect(t?.created).toBe('2026-11-05');
    expect(t?.dates.map((d) => d.symbol)).toEqual(['⏳', '📅']);
    expect(t?.invalidDateOrder).toBe(false);
  });
});
