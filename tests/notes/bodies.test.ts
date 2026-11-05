/**
 * Los cuerpos por defecto (`src/core/notes/specs/bodies.ts`) deben ser EXACTAMENTE el texto de cada
 * plantilla real del vault con las interpolaciones Templater sustituidas por marcadores `{{…}}`.
 */
import { describe, expect, it } from 'vitest';
import * as B from '../../src/core/notes/specs/bodies';
import { readTemplate, renderTemplater, splitFm } from './templater';

const ORIGEN = 'enlaceOrigen ? `"${enlaceOrigen}"` : \'""\'';
const common = (tipo: string): Record<string, string> => ({
  tipo,
  fechaISO: '{{fecha}}',
  nuevoTitulo: '{{titulo}}',
  [ORIGEN]: '{{origen}}',
  'enlaceOrigen ? `origen:: ${enlaceOrigen}` : ""': '{{origenInline}}',
  commitHash: '{{commit}}',
  fechaHoraISO: '{{fechaHora}}',
  'enlaceOrigen || \'""\'': '{{origen}}',
  'esCaptura ? "🟡" : "🟢"': '{{estado}}',
  horaInicio: '{{horaInicio}}',
  horaFin: '{{horaFin}}',
  modalidad: 'virtual',
  participantesYaml: '{{participantes}}',
});


describe('cuerpos por defecto = plantillas del vault', () => {
  const out: [string, string][] = [];
  const simple: [string, string, string][] = [
    ['AX', 'Plt - Anotacion.md', 'Ax'], ['BTX', 'Plt - Bitacora.md', 'Btx'], ['CMT', 'Plt - Commit.md', 'Cmt'],
    ['PODX', 'Plt - Podcast.md', 'Podx'], ['PRX', 'Plt - Prompt.md', 'Prx'], ['TX', 'Plt - Transacción.md', 'Tx'],
    ['VX', 'Plt - Video.md', 'Vx'], ['PGTD', 'Plt - PGTD Fecha.md', 'PGTD'], ['AV', 'Plt - Area Vida.md', 'AV'],
    ['AI', 'Plt - Area Interes.md', 'AI'], ['RR', 'Plt - Recurso Recurrente.md', 'RR'],
    ['RR_TX', 'Plt - Recurso Recurrente Transacciones.md', 'RR'], ['RR_BTX', 'Plt - Recurso Recurrente Bitacoras.md', 'RR'],
    ['RC', 'Plt - Registro Commits.md', 'RC'],
  ];
  for (const [k, f, t] of simple) {
    out.push([k, splitFm(renderTemplater(readTemplate(f), { exprs: common(t) })).body]);
  }
  for (const [k, f, t] of [['REF', 'Plt - Reflexión.md', 'Ref'], ['SUE', 'Plt - Sueño.md', 'Sue'], ['REU', 'Plt - Reunión.md', 'Reu']] as const) {
    for (const cap of [false, true]) {
      const body = splitFm(renderTemplater(readTemplate(f), { exprs: common(t), flags: { esCaptura: cap } })).body;
      out.push([`${k}${cap ? '_CAPTURA' : ''}`, body]);
    }
  }
  const daily = renderTemplater(readTemplate('Journal/Plt - Diaria.md'), {
    exprs: {
      tipo: 'Dly', semanaId: '{{semana}}', mesId: '{{mes}}', trimestreId: '{{trimestre}}',
      anteriorRuta: '{{anteriorRuta}}', anteriorTexto: '{{anteriorTexto}}', hoyTexto: '{{hoyTexto}}',
      siguienteRuta: '{{siguienteRuta}}', siguienteTexto: '{{siguienteTexto}}', weekLinkForEmbed: '{{semana}}',
      'moment(fecha).format("YYYY-MM-DD dddd")': '{{hoyTexto}}',
    },
    flags: { 'weekLinkForEmbed && fecha': true },
    block: () => '',
  });
  out.push(['DLY', splitFm(daily).body]);
  const weekly = renderTemplater(readTemplate('Journal/Plt - Semanal.md'), {
    exprs: {
      tipo: 'Wly', mesId: '{{mes}}', trimestreId: '{{trimestre}}', titulo: '{{titulo}}', mesPrincipal: '{{mesPrincipal}}',
      semanalID: '{{semana}}', semanaEnTrimestre: '{{semanaEnTrimestre}}', numSemana: '{{numSemana}}', rangoFechas: '{{rangoFechas}}',
    },
    block: (c) => (c.includes('semanarioContent') ? '{{bloques}}' : c.includes('dailyEmbeds') ? '{{anotaciones}}'
      : c.includes('diaSemana') ? '{{dias}}' : c.includes('prevWeek') ? '{{enlaces}}' : ''),
  });
  out.push(['WLY', splitFm(weekly).body]);
  const monthly = renderTemplater(readTemplate('Journal/Plt - Mensual.md'), {
    exprs: {
      mesCampo: '{{mes}}', trimestreWiki: '{{trimestreWiki}}', añoWiki: '{{añoWiki}}', titulo: '{{titulo}}',
      prevFile: '{{anterior}}', prevAlias: '{{anteriorAlias}}', nextFile: '{{siguiente}}', nextAlias: '{{siguienteAlias}}',
      semanasMesOut: '{{semanasMes}}', '`${añoNum}-Q${trimestreNum}`': '{{trimestre}}', anclaObjetivos: '{{anclaObjetivos}}',
      planeacionOut: '{{planeacion}}', embedsOut: '{{embedsSemanas}}',
    },
    block: () => '',
  });
  out.push(['MLY', splitFm(monthly).body]);
  const quarterly = renderTemplater(readTemplate('Journal/Plt - Trimestral.md'), {
    exprs: {
      añoWiki: '{{añoWiki}}', quarterId: '{{trimestre}}', prevQuarterId: '{{anterior}}', nextQuarterId: '{{siguiente}}',
      mesesListOut: '{{meses}}', semanasTrimestreOut: '{{semanas}}', objetivosEmbed: '{{objetivosEmbed}}',
      planeacionMesesOut: '{{planeacion}}', embedsMensualesOut: '{{embedsMeses}}',
    },
    block: () => '',
  });
  out.push(['QLY', splitFm(quarterly).body]);
  const yearly = renderTemplater(readTemplate('Journal/Plt - Anual.md'), {
    exprs: {
      yearNum: '{{año}}', prevYear: '{{anterior}}', nextYear: '{{siguiente}}', trimestresOut: '{{trimestres}}',
      mesesOut: '{{meses}}', planeacionTrimestresOut: '{{planeacion}}', embedsTrimestresOut: '{{embedsTrimestres}}',
    },
    block: () => '',
  });
  out.push(['YLY', splitFm(yearly).body]);
  const bodies = B as Readonly<Record<string, string>>;
  it.each(out)('BODY_%s', (k, expected) => {
    expect(bodies[`BODY_${k}`]).toBe(expected);
  });
  it('no hay cuerpos sin plantilla', () => {
    expect(Object.keys(bodies).sort()).toEqual(out.map(([k]) => `BODY_${k}`).sort());
  });
});
