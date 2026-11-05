/**
 * Notas de journal: igualdad exacta con las plantillas `Journal/Plt - *.md` en fechas normales,
 * vectores de RI-E §8.3 y correcciones de borde de año ISO (RI-E §7).
 */
import { describe, expect, it } from 'vitest';
import { addDays, isoWeekOf, formatWeekCode } from '../../src/core/dates';
import {
  dayMonthShort, journalNoteFor, monthlyVars, quarterlyVars, weeklyTitle, weeklyVars, weeksOfQuarter, yearlyVars,
} from '../../src/core/notes/journalNotes';
import { DEFAULT_JOURNAL } from '../../src/core/settings';
import { readTemplate, renderTemplater, splitFm } from './templater';

const base = DEFAULT_JOURNAL.baseFolderPath;
const s = DEFAULT_JOURNAL;

describe('Diaria (Dly)', () => {
  it('T1 2025-08-12: contenido idéntico a la plantilla', () => {
    const n = journalNoteFor('day', '2025-08-12', s);
    expect(n.path).toBe(`${base}/2025/08/2025-08-12 martes.md`);
    expect(n.title).toBe('2025-08-12 martes');
    const expected = renderTemplater(readTemplate('Journal/Plt - Diaria.md'), {
      exprs: {
        tipo: 'Dly', semanaId: '2025-W33', mesId: '2025-08', trimestreId: '2025-Q3',
        anteriorRuta: `${base}/2025/08/2025-08-11 lunes`, anteriorTexto: '2025-08-11 lunes', hoyTexto: '2025-08-12 martes',
        siguienteRuta: `${base}/2025/08/2025-08-13 miércoles`, siguienteTexto: '2025-08-13 miércoles',
        weekLinkForEmbed: '2025-W33', 'moment(fecha).format("YYYY-MM-DD dddd")': '2025-08-12 martes',
      },
      flags: { 'weekLinkForEmbed && fecha': true },
      block: () => '',
    });
    expect(n.content).toBe(expected);
    expect(n.frontmatter).toBe('---\ntype: Dly\nsemana: "[[2025-W33]]"\nmes: "[[2025-08]]"\ntrimestre: "[[2025-Q3]]"\nestado: 🟢\ntags:\ndestacado:\n---\n');
  });

  it('T2 2025-12-29: semana 2026-W01 también en el embed (v1: 2025-W01)', () => {
    const n = journalNoteFor('day', '2025-12-29', s);
    expect(n.frontmatter).toContain('semana: "[[2026-W01]]"\nmes: "[[2025-12]]"\ntrimestre: "[[2025-Q4]]"');
    expect(n.body).toContain('![[2026-W01#2025-12-29 lunes Plan y registro actividades Bloques definidos para el 2025-12-29 lunes]]');
    expect(n.body).toContain(`[[${base}/2025/12/2025-12-30 martes|2025-12-30 martes ➡️]]`);
  });

  it('T3 2027-01-01: semana 2026-W53, día anterior en 2026/12', () => {
    const n = journalNoteFor('day', '2027-01-01', s);
    expect(n.frontmatter).toContain('semana: "[[2026-W53]]"\nmes: "[[2027-01]]"\ntrimestre: "[[2027-Q1]]"');
    expect(n.body).toContain(`[[${base}/2026/12/2026-12-31 jueves|⬅️ 2026-12-31 jueves]] | **📅 2027-01-01 viernes**`);
    expect(n.body).toContain('![[2026-W53#2027-01-01 viernes');
  });

  it('enlaces anterior/siguiente según los ajustes (v1 tenía la ruta fija)', () => {
    const n = journalNoteFor('day', '2025-03-01', { ...s, quarterSubfolder: true, monthSubfolder: false });
    expect(n.path).toBe(`${base}/2025/Q1/2025-03-01 sábado.md`);
    expect(n.body).toContain(`[[${base}/2025/Q1/2025-02-28 viernes|⬅️ 2025-02-28 viernes]]`);
  });
});

/** Réplicas de los bucles `tR` de la plantilla semanal (sin el desfase de zona horaria). */
function v1WeekBlocks(monday: string): { dias: string; bloques: string; anotaciones: string } {
  const letters = [' L ', ' ﹒M ', ' ﹒Mc ', ' ﹒J ', ' ﹒V ', ' ﹒S ', '﹒D '];
  const names = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  let dias = '';
  let bloques = '';
  let anot = '### Destacados de la semana\n\n```base\nfilters:\n  and:\n    - type == "Dly"\n    - destacado\n    - semana == this\n\n'
    + 'formulas:\n  Dia: fecha.format("dddd")\n\nviews:\n  - type: table\n    name: Destacados de la semana\n    order:\n'
    + '      - formula.Dia\n      - fecha\n      - destacado\n```\n\n';
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    const dn = names[i]!;
    dias += `${letters[i]}[[${d} ${dn}|${d.slice(8)}]] `;
    bloques += `##### [[${d} ${dn}#Plan y registro actividades|Bloques definidos para el ${d} ${dn}]]\n\n`;
    anot += `### ${dn.charAt(0).toUpperCase() + dn.slice(1)}\n![[${d} ${dn}# Bitácora del día]]\n`;
  }
  return { dias, bloques, anotaciones: anot };
}

describe('Semanal (Wly)', () => {
  it('T4 2025-W33: contenido idéntico a la plantilla (zona America/Bogota, donde v1 acertaba)', () => {
    const n = journalNoteFor('week', '2025-08-13', s);
    expect(n.title).toBe('2025-W33');
    expect(n.path).toBe(`${base}/2025/2025-W33.md`);
    const b = v1WeekBlocks('2025-08-11');
    const expected = renderTemplater(readTemplate('Journal/Plt - Semanal.md'), {
      exprs: {
        tipo: 'Wly', mesId: '2025-08', trimestreId: '2025-Q3', titulo: 'W7 Q3 - Agosto 2025', mesPrincipal: '2025-08',
        semanalID: '2025-W33', semanaEnTrimestre: '7', numSemana: '33', rangoFechas: '11 ago. - 17 ago.',
      },
      block: (c) => (c.includes('semanarioContent') ? b.bloques : c.includes('dailyEmbeds') ? b.anotaciones
        : c.includes('diaSemana') ? b.dias : c.includes('prevWeek') ? '[[2025-W32]] / [[2025-W34]]' : ''),
    });
    expect(n.content).toBe(expected);
    expect(b.dias).toBe(' L [[2025-08-11 lunes|11]]  ﹒M [[2025-08-12 martes|12]]  ﹒Mc [[2025-08-13 miércoles|13]]  ﹒J [[2025-08-14 jueves|14]]  ﹒V [[2025-08-15 viernes|15]]  ﹒S [[2025-08-16 sábado|16]] ﹒D [[2025-08-17 domingo|17]] ');
  });

  it('T5 2025-W40: mes y trimestre por jueves; embed al mensual de octubre', () => {
    const v = weeklyVars({ year: 2025, week: 40 });
    expect(v['titulo']).toBe('W1 Q4 - Septiembre 2025');
    expect([v['mes'], v['trimestre'], v['semanaEnTrimestre'], v['rangoFechas']]).toEqual(['2025-10', '2025-Q4', '1', '29 sep. - 05 oct.']);
  });

  it('T6 2026-W01: título coherente (v1: “Diciembre 2026”), enlaces con año ISO', () => {
    const v = weeklyVars({ year: 2026, week: 1 });
    expect(v['titulo']).toBe('W1 Q1 - Enero 2026');
    expect([v['mes'], v['trimestre'], v['rangoFechas'], v['enlaces']]).toEqual(['2026-01', '2026-Q1', '29 dic. - 04 ene.', '[[2025-W52]] / [[2026-W02]]']);
    expect(v['dias']).toContain(' L [[2025-12-29 lunes|29]] ');
    expect(journalNoteFor('week', '2025-12-29', s).path).toBe(`${base}/2026/2026-W01.md`);
  });

  it('T7 2026-W53 y W13: siguiente/anterior con año ISO (v1: 2025-W52 → 2025-W01)', () => {
    const v = weeklyVars({ year: 2026, week: 53 });
    expect(v['titulo']).toBe('W14 Q4 - Diciembre 2026');
    expect(v['enlaces']).toBe('[[2026-W52]] / [[2027-W01]]');
    expect(weeklyVars({ year: 2025, week: 52 })['enlaces']).toBe('[[2025-W51]] / [[2026-W01]]');
    expect(weeklyVars({ year: 2024, week: 52 })['enlaces']).toBe('[[2024-W51]] / [[2025-W01]]');
    expect(weeklyVars({ year: 2026, week: 1 })['enlaces']).toBe('[[2025-W52]] / [[2026-W02]]');
    expect(weeklyTitle({ year: 2025, week: 1 })).toBe('W1 Q1 - Enero 2025');
  });

  it('frontmatter igual al de la plantilla', () => {
    const n = journalNoteFor('week', '2025-08-13', s);
    expect(n.frontmatter).toBe('---\ntype: Wly\nestado: 🟢\nmes: "[[2025-08]]"\ntrimestre: "[[2025-Q3]]"\ndestacado:\ntags:\n---\n');
  });
});

describe('Mensual (Mly)', () => {
  it('T9 2025-08: contenido idéntico a la plantilla', () => {
    const v = monthlyVars(2025, 8);
    expect(v['semanasMes']).toBe(['05: [[2025-W31]]', '06: [[2025-W32]]', '07: [[2025-W33]]', '08: [[2025-W34]]', '09: [[2025-W35]]'].map((x) => `Semana ${x}`).join('\n'));
    const plan = [
      'W5 - semana 31 (28 jul. - 03 ago.)', 'W6 - semana 32 (04 ago. - 10 ago.)', 'W7 - semana 33 (11 ago. - 17 ago.)',
      'W8 - semana 34 (18 ago. - 24 ago.)', 'W9 - semana 35 (25 ago. - 31 ago.)',
    ].map((t, i) => `##### [[2025-W${31 + i}#Propósitos principales|Objetivos para ${t}]]`).join('\n\n');
    const embeds = [31, 32, 33, 34, 35].map((w) => `#### [[2025-W${w}]]\n![[2025-W${w}#Resumen de la semana]]`).join('\n\n');
    const n = journalNoteFor('month', '2025-08-20', s);
    expect(n.path).toBe(`${base}/2025/2025-08.md`);
    const expected = renderTemplater(readTemplate('Journal/Plt - Mensual.md'), {
      exprs: {
        mesCampo: '2025-08', trimestreWiki: '[[2025-Q3]]', añoWiki: '[[2025]]', titulo: 'Agosto del 2025',
        prevFile: '2025-07', prevAlias: 'Julio del 2025', nextFile: '2025-09', nextAlias: 'Septiembre del 2025',
        semanasMesOut: v['semanasMes']!, '`${añoNum}-Q${trimestreNum}`': '2025-Q3',
        anclaObjetivos: '2025-08 Objetivos mensuales Objetivos para agosto del 2025', planeacionOut: plan, embedsOut: embeds,
      },
      block: () => '',
    });
    expect(n.content).toBe(expected);
  });

  it('T10–T12: octubre, diciembre (semana 14 = 2026-W01) y enero 2026; cruce de año en enlaces', () => {
    expect(monthlyVars(2025, 10)['semanasMes']).toMatch(/^Semana 01: \[\[2025-W40\]\][\s\S]*Semana 05: \[\[2025-W44\]\]$/);
    expect(monthlyVars(2025, 10)['planeacion']).toContain('Objetivos para W5 - semana 44 (27 oct. - 02 nov.)');
    expect(monthlyVars(2025, 12)['semanasMes']).toMatch(/Semana 10: \[\[2025-W49\]\][\s\S]*Semana 14: \[\[2026-W01\]\]$/);
    const jan = monthlyVars(2026, 1);
    expect(jan['semanasMes']?.split('\n')[0]).toBe('Semana 01: [[2026-W01]]');
    expect(jan['planeacion']).toContain('Objetivos para W1 - semana 1 (29 dic. - 04 ene.)');
    expect([jan['anterior'], jan['anteriorAlias'], jan['siguiente']]).toEqual(['2025-12', 'Diciembre del 2025', '2026-02']);
  });

  it('frontmatter igual al de la plantilla (mes en texto plano, sin tags)', () => {
    expect(journalNoteFor('month', '2025-05-01', s).frontmatter)
      .toBe('---\ntype: Mly\nmes: 2025-05\nestado: 🟢\ntrimestre: "[[2025-Q2]]"\naño: "[[2025]]"\ndestacado:\njournal: Mensual\n---\n');
  });
});

describe('Trimestral (Qly)', () => {
  it('T13 2025-Q2: contenido idéntico a la plantilla', () => {
    const v = quarterlyVars(2025, 2);
    expect(v['semanas']).toBe([
      '- Abril:', '\t- Semana 01: [[2025-W14]]', '\t- Semana 02: [[2025-W15]]', '\t- Semana 03: [[2025-W16]]', '\t- Semana 04: [[2025-W17]]',
      '- Mayo:', '\t- Semana 05: [[2025-W18]]', '\t- Semana 06: [[2025-W19]]', '\t- Semana 07: [[2025-W20]]', '\t- Semana 08: [[2025-W21]]', '\t- Semana 09: [[2025-W22]]',
      '- Junio:', '\t- Semana 10: [[2025-W23]]', '\t- Semana 11: [[2025-W24]]', '\t- Semana 12: [[2025-W25]]', '\t- Semana 13: [[2025-W26]]',
    ].join('\n'));
    const n = journalNoteFor('quarter', '2025-05-15', s);
    expect(n.path).toBe(`${base}/2025/2025-Q2.md`);
    const expected = renderTemplater(readTemplate('Journal/Plt - Trimestral.md'), {
      exprs: {
        añoWiki: '[[2025]]', quarterId: '2025-Q2', prevQuarterId: '2025-Q1', nextQuarterId: '2025-Q3',
        mesesListOut: '- Abril: [[2025-04]]\n- Mayo: [[2025-05]]\n- Junio: [[2025-06]]', semanasTrimestreOut: v['semanas']!,
        objetivosEmbed: '2025#2025-Q2 Objetivos trimestrales Objetivos para el trimestre 2 del 2025',
        planeacionMesesOut: ['abril', 'mayo', 'junio'].map((m, i) => `### [[2025-0${4 + i}#Objetivos mensuales|Objetivos para ${m} del 2025]]`).join('\n\n'),
        embedsMensualesOut: [4, 5, 6].map((m) => `### [[2025-0${m}]]\n![[2025-0${m}#Resumen del mes]]`).join('\n\n'),
      },
      block: () => '',
    });
    expect(n.content).toBe(expected);
    expect(n.frontmatter).toBe('---\ntype: Qly\naño: "[[2025]]"\nestado: 🟢\ndestacado:\njournal: Trimestral\n---\n');
  });

  it('T14/T15: 2025-Q4 y 2027-Q1 (empieza en Semana 02); 2027-Q3 con 14 jueves (v1 perdía la última)', () => {
    expect(weeksOfQuarter(2025, 4).map((w) => w.code)).toEqual(Array.from({ length: 13 }, (_, i) => `2025-W${40 + i}`));
    const q1 = weeksOfQuarter(2027, 1);
    expect(q1.length).toBe(12);
    expect(q1[0]).toEqual({ month: 1, label: '02', code: '2027-W01' });
    const q3 = weeksOfQuarter(2027, 3);
    expect(q3.length).toBe(14);
    expect(q3.at(-1)).toEqual({ month: 9, label: '14', code: '2027-W39' });
    expect(quarterlyVars(2025, 1)['anterior']).toBe('2024-Q4');
    expect(quarterlyVars(2025, 4)['siguiente']).toBe('2026-Q1');
  });
});

describe('Anual (Yly)', () => {
  it('T16 2025: contenido idéntico a la plantilla', () => {
    const v = yearlyVars(2025);
    const n = journalNoteFor('year', '2025-06-01', s);
    expect(n.path).toBe(`${base}/2025/2025.md`);
    const expected = renderTemplater(readTemplate('Journal/Plt - Anual.md'), {
      exprs: {
        yearNum: '2025', prevYear: '2024', nextYear: '2026', trimestresOut: v['trimestres']!, mesesOut: v['meses']!,
        planeacionTrimestresOut: v['planeacion']!, embedsTrimestresOut: v['embedsTrimestres']!,
      },
      block: () => '',
    });
    expect(n.content).toBe(expected);
    expect(v['trimestres']).toBe('- [[2025-Q1]]\n- [[2025-Q2]]\n- [[2025-Q3]]\n- [[2025-Q4]]');
    expect(v['meses']?.split('\n')[11]).toBe('- Diciembre: [[2025-12]]');
    expect(v['planeacion']?.split('\n\n')[0]).toBe('### [[2025-Q1#Objetivos trimestrales|Objetivos para el trimestre 1 del 2025]]');
    expect(splitFm(n.content).fm).toBe('---\ntype: Yly\nestado: 🟢\njournal: Anual\n---\n');
  });
});

/** Ancla normalizada por Obsidian de `#### [[nota#enc|alias]]` → `nota enc alias`. */
function headingAnchors(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/^#{1,6} \[\[([^#\]|]+)#([^|\]]+)\|([^\]]+)\]\]$/gm)) out.add(`${m[1]} ${m[2]} ${m[3]}`);
  return out;
}

describe('cascada de embeds: el destino existe (2020–2030, incluidos bordes de año ISO)', () => {
  it('diaria → bloque del día en la semanal; semanal → propósitos en la mensual del jueves', () => {
    for (let d = '2020-12-20'; d <= '2030-01-10'; d = addDays(d, 3)) {
      const day = journalNoteFor('day', d, s);
      const week = journalNoteFor('week', d, s);
      const dayEmbed = /!\[\[([^#\]]+)#([^\]]+)\]\]/.exec(day.body.split('## Plan sugerido en revisión semanal')[1] ?? '');
      expect(dayEmbed?.[1]).toBe(week.title);
      expect(headingAnchors(week.body).has(dayEmbed?.[2] ?? '')).toBe(true);
      const wv = weeklyVars(isoWeekOf(d));
      const [y, m] = (wv['mesPrincipal'] ?? '').split('-').map(Number);
      const monthAnchors = headingAnchors(monthlyVars(y!, m!)['planeacion'] ?? '');
      expect(monthAnchors.has(`${wv['semana']} Propósitos principales Objetivos para W${wv['semanaEnTrimestre']} - semana ${wv['numSemana']} (${wv['rangoFechas']})`)).toBe(true);
    }
  });

  it('mensual → objetivos en la trimestral', () => {
    for (let y = 2024; y <= 2027; y++) {
      for (let m = 1; m <= 12; m++) {
        const mv = monthlyVars(y, m);
        const q = Math.ceil(m / 3);
        expect(headingAnchors(quarterlyVars(y, q)['planeacion'] ?? '').has(mv['anclaObjetivos'] ?? '')).toBe(true);
      }
    }
  });

  it('formato DD MMM con punto (locale es de moment)', () => {
    expect(dayMonthShort('2025-09-29')).toBe('29 sep.');
    expect(dayMonthShort('2025-05-04')).toBe('04 may.');
    expect(formatWeekCode(isoWeekOf('2027-01-01'))).toBe('2026-W53');
  });
});
