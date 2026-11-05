/**
 * Notas de journal (Dly / Wly / Mly / Qly / Yly) sin nombrarlas a mano (02 §1, RI-E §5.6).
 * Frontmatter y cuerpo = plantillas `Journal/Plt - *.md`, con los cálculos de periodo corregidos
 * (RI-E §7): año ISO en todo id de semana, lunes de semana anclado al 4 de enero (independiente de
 * hoy), días de la semana sin desfase de zona horaria y numeración “semana del trimestre” única para
 * semanal, mensual y trimestral (así los embeds apuntan a encabezados que existen).
 */
import {
  addDays, addMonths, addWeeks, diffDays, formatWeekCode, isoWeekOf, isoWeekStart, monthNameEs, parseYmd,
  quarterOfMonth, startOfIsoWeek, weekdayNameEs, type IsoWeek,
} from '../dates';
import { dailyNoteName, dailyNotePath, periodNotePath } from '../journal/paths';
import type { JournalSettings } from '../settings';
import { fm, renderFrontmatter } from './frontmatter';
import { parentFolder, withoutMd } from './folders';
import { BODY_DLY, BODY_MLY, BODY_QLY, BODY_WLY, BODY_YLY } from './specs/bodies';
import { interpolate, type TemplateVars } from './templateText';

export type JournalKind = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type JournalType = 'Dly' | 'Wly' | 'Mly' | 'Qly' | 'Yly';

export const JOURNAL_TYPE: Readonly<Record<JournalKind, JournalType>> = {
  day: 'Dly', week: 'Wly', month: 'Mly', quarter: 'Qly', year: 'Yly',
};

export interface JournalNote {
  readonly kind: JournalKind;
  readonly type: JournalType;
  readonly title: string;
  readonly path: string;
  readonly folder: string;
  readonly frontmatter: string;
  readonly body: string;
  readonly content: string;
  readonly vars: TemplateVars;
}

/** Abreviaturas de mes de moment `es` con formato `DD MMM` (con punto: `ago.`). */
export const MONTHS_SHORT_ES = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'] as const;

const CAP_MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function parts(date: string): { y: number; m: number; d: number } {
  const p = parseYmd(date);
  if (!p) throw new Error(`Fecha inválida: ${date}`);
  return p;
}

/** `11 ago.` */
export function dayMonthShort(date: string): string {
  const p = parts(date);
  return `${pad2(p.d)} ${MONTHS_SHORT_ES[p.m - 1] ?? ''}`;
}

function monthId(y: number, m: number): string {
  return `${y}-${pad2(m)}`;
}

function quarterStart(y: number, q: number): string {
  return `${y}-${pad2((q - 1) * 3 + 1)}-01`;
}

/**
 * Número de la semana dentro del trimestre (1..14): semanas desde el lunes ISO de la semana que contiene
 * el primer día del trimestre (fórmula de las plantillas Mensual y Trimestral). La Semanal usaba otra
 * fórmula que discrepaba en Q1 tras años de 53 semanas (p. ej. 2027-W01): se unifica.
 */
export function weekInQuarter(monday: string, y: number, q: number): number {
  return Math.floor(diffDays(monday, startOfIsoWeek(quarterStart(y, q))) / 7) + 1;
}

/** Bloque “Plan sugerido”: código de semana ISO del día (la plantilla usaba año calendario: bug de borde). */
export function dailyVars(date: string, s: JournalSettings): Record<string, string> {
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  return {
    fecha: date,
    titulo: dailyNoteName(date),
    semana: formatWeekCode(isoWeekOf(date)),
    anteriorRuta: withoutMd(dailyNotePath(s, prev)),
    anteriorTexto: dailyNoteName(prev),
    hoyTexto: dailyNoteName(date),
    siguienteRuta: withoutMd(dailyNotePath(s, next)),
    siguienteTexto: dailyNoteName(next),
  };
}

export function dailyFrontmatter(date: string): string {
  const p = parts(date);
  return renderFrontmatter([
    fm.value('type', 'Dly'),
    fm.link('semana', formatWeekCode(isoWeekOf(date))),
    fm.link('mes', monthId(p.y, p.m)),
    fm.link('trimestre', `${p.y}-Q${quarterOfMonth(p.m)}`),
    fm.value('estado', '🟢'),
    fm.empty('tags'),
    fm.empty('destacado'),
  ]);
}

const WEEK_LETTERS = [' L ', ' ﹒M ', ' ﹒Mc ', ' ﹒J ', ' ﹒V ', ' ﹒S ', '﹒D '] as const;

const DESTACADOS_SEMANA = [
  '### Destacados de la semana', '', '```base', 'filters:', '  and:', '    - type == "Dly"', '    - destacado',
  '    - semana == this', '', 'formulas:', '  Dia: fecha.format("dddd")', '', 'views:', '  - type: table',
  '    name: Destacados de la semana', '    order:', '      - formula.Dia', '      - fecha', '      - destacado', '```', '', '',
].join('\n');

/** Título `W{n} Q{q} - {Mes} {año}` (fórmula de la plantilla; el mes es el del lunes salvo que caiga en otro año). */
export function weeklyTitle(w: IsoWeek): string {
  const q = w.week <= 13 ? 1 : w.week <= 26 ? 2 : w.week <= 39 ? 3 : 4;
  let n = w.week - isoWeekOf(quarterStart(w.year, q)).week + 1;
  if (n < 1) n = 1;
  const monday = isoWeekStart(w.year, w.week);
  // v1 mostraba “Diciembre 2026” para 2026-W01 (mes del lunes 2025-12-29 con el año ISO): se usa el jueves.
  const ref = parts(monday).y === w.year ? monday : addDays(monday, 3);
  return `W${n} Q${q} - ${CAP_MONTHS[parts(ref).m - 1] ?? ''} ${w.year}`;
}

export function weeklyVars(w: IsoWeek): Record<string, string> {
  const monday = isoWeekStart(w.year, w.week);
  const thursday = addDays(monday, 3);
  const th = parts(thursday);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const dias = days.map((d, i) => `${WEEK_LETTERS[i]}[[${dailyNoteName(d)}|${d.slice(8, 10)}]] `).join('');
  const bloques = days
    .map((d) => `##### [[${dailyNoteName(d)}#Plan y registro actividades|Bloques definidos para el ${dailyNoteName(d)}]]\n\n`)
    .join('');
  const anotaciones = DESTACADOS_SEMANA + days
    .map((d) => `### ${capitalize(weekdayNameEs(d))}\n![[${dailyNoteName(d)}# Bitácora del día]]\n`)
    .join('');
  return {
    titulo: weeklyTitle(w),
    semana: formatWeekCode(w),
    mes: monthId(th.y, th.m),
    trimestre: `${th.y}-Q${quarterOfMonth(th.m)}`,
    enlaces: `[[${formatWeekCode(addWeeks(w, -1))}]] / [[${formatWeekCode(addWeeks(w, 1))}]]`,
    dias,
    mesPrincipal: monthId(th.y, th.m),
    semanaEnTrimestre: String(weekInQuarter(monday, th.y, quarterOfMonth(th.m))),
    numSemana: String(w.week),
    rangoFechas: `${dayMonthShort(monday)} - ${dayMonthShort(addDays(monday, 6))}`,
    bloques,
    anotaciones,
  };
}

export function weeklyFrontmatter(w: IsoWeek): string {
  const v = weeklyVars(w);
  return renderFrontmatter([
    fm.value('type', 'Wly'), fm.value('estado', '🟢'), fm.link('mes', v['mes'] ?? ''), fm.link('trimestre', v['trimestre'] ?? ''),
    fm.empty('destacado'), fm.empty('tags'),
  ]);
}

export interface MonthWeek {
  readonly code: string;
  readonly isoWeek: number;
  readonly monday: string;
  readonly inQuarter: number;
}

/** Semanas ISO que tocan el mes (por solape, como la plantilla Mensual). */
export function weeksOfMonth(y: number, m: number): MonthWeek[] {
  const first = `${y}-${pad2(m)}-01`;
  const last = addDays(addMonths(first, 1), -1);
  const q = quarterOfMonth(m);
  const out: MonthWeek[] = [];
  for (let cur = startOfIsoWeek(first); cur <= last; cur = addDays(cur, 7)) {
    const w = isoWeekOf(cur);
    out.push({ code: formatWeekCode(w), isoWeek: w.week, monday: cur, inQuarter: weekInQuarter(cur, y, q) });
  }
  return out;
}

export function monthlyVars(y: number, m: number): Record<string, string> {
  const first = `${y}-${pad2(m)}-01`;
  const prev = parts(addMonths(first, -1));
  const next = parts(addMonths(first, 1));
  const q = quarterOfMonth(m);
  const weeks = weeksOfMonth(y, m);
  const id = monthId(y, m);
  return {
    titulo: `${CAP_MONTHS[m - 1] ?? ''} del ${y}`,
    mes: id,
    trimestre: `${y}-Q${q}`,
    trimestreWiki: `[[${y}-Q${q}]]`,
    añoWiki: `[[${y}]]`,
    anterior: monthId(prev.y, prev.m),
    anteriorAlias: `${CAP_MONTHS[prev.m - 1] ?? ''} del ${prev.y}`,
    siguiente: monthId(next.y, next.m),
    siguienteAlias: `${CAP_MONTHS[next.m - 1] ?? ''} del ${next.y}`,
    semanasMes: weeks.map((w) => `Semana ${pad2(w.inQuarter)}: [[${w.code}]]`).join('\n'),
    anclaObjetivos: `${id} Objetivos mensuales Objetivos para ${monthNameEs(m)} del ${y}`,
    planeacion: weeks
      .map((w) => `##### [[${w.code}#Propósitos principales|Objetivos para W${w.inQuarter} - semana ${w.isoWeek} (${dayMonthShort(w.monday)} - ${dayMonthShort(addDays(w.monday, 6))})]]`)
      .join('\n\n'),
    embedsSemanas: weeks.map((w) => `#### [[${w.code}]]\n![[${w.code}#Resumen de la semana]]`).join('\n\n'),
  };
}

export function monthlyFrontmatter(y: number, m: number): string {
  const q = quarterOfMonth(m);
  return renderFrontmatter([
    fm.value('type', 'Mly'), fm.value('mes', monthId(y, m)), fm.value('estado', '🟢'), fm.link('trimestre', `${y}-Q${q}`),
    fm.link('año', String(y)), fm.empty('destacado'), fm.value('journal', 'Mensual'),
  ]);
}

/**
 * Semanas del trimestre asignadas a su mes por el JUEVES (regla ISO). La plantilla iteraba solo 13
 * semanas y perdía la 14.ª cuando el trimestre tiene 14 jueves (p. ej. 2027-Q3): se itera hasta el fin.
 */
export function weeksOfQuarter(y: number, q: number): { month: number; label: string; code: string }[] {
  const start = quarterStart(y, q);
  const end = addDays(addMonths(start, 3), -1);
  const out: { month: number; label: string; code: string }[] = [];
  const mondayStart = startOfIsoWeek(start);
  for (let i = 0; addDays(mondayStart, i * 7) <= end; i++) {
    const thursday = addDays(mondayStart, i * 7 + 3);
    if (thursday < start || thursday > end) continue;
    out.push({ month: parts(thursday).m, label: pad2(i + 1), code: formatWeekCode(isoWeekOf(thursday)) });
  }
  return out;
}

export function quarterlyVars(y: number, q: number): Record<string, string> {
  const months = [0, 1, 2].map((i) => (q - 1) * 3 + 1 + i);
  const weeks = weeksOfQuarter(y, q);
  const semanas = months
    .map((m) => {
      const lines = weeks.filter((w) => w.month === m).map((w) => `\t- Semana ${w.label}: [[${w.code}]]`);
      return `- ${CAP_MONTHS[m - 1] ?? ''}:\n${lines.length ? `${lines.join('\n')}\n` : ''}`;
    })
    .join('')
    .trim();
  const prev = q === 1 ? `${y - 1}-Q4` : `${y}-Q${q - 1}`;
  const next = q === 4 ? `${y + 1}-Q1` : `${y}-Q${q + 1}`;
  return {
    titulo: `Revisión Trimestral ${y}-Q${q}`,
    trimestre: `${y}-Q${q}`,
    añoWiki: `[[${y}]]`,
    anterior: prev,
    siguiente: next,
    meses: months.map((m) => `- ${CAP_MONTHS[m - 1] ?? ''}: [[${monthId(y, m)}]]`).join('\n'),
    semanas,
    objetivosEmbed: `${y}#${y}-Q${q} Objetivos trimestrales Objetivos para el trimestre ${q} del ${y}`,
    planeacion: months.map((m) => `### [[${monthId(y, m)}#Objetivos mensuales|Objetivos para ${monthNameEs(m)} del ${y}]]`).join('\n\n'),
    embedsMeses: months.map((m) => `### [[${monthId(y, m)}]]\n![[${monthId(y, m)}#Resumen del mes]]`).join('\n\n'),
  };
}

export function quarterlyFrontmatter(y: number): string {
  return renderFrontmatter([
    fm.value('type', 'Qly'), fm.link('año', String(y)), fm.value('estado', '🟢'), fm.empty('destacado'), fm.value('journal', 'Trimestral'),
  ]);
}

export function yearlyVars(y: number): Record<string, string> {
  const qs = [1, 2, 3, 4];
  return {
    titulo: `Visión Anual ${y}`,
    año: String(y),
    anterior: String(y - 1),
    siguiente: String(y + 1),
    trimestres: qs.map((q) => `- [[${y}-Q${q}]]`).join('\n'),
    meses: CAP_MONTHS.map((nm, i) => `- ${nm}: [[${monthId(y, i + 1)}]]`).join('\n'),
    planeacion: qs.map((q) => `### [[${y}-Q${q}#Objetivos trimestrales|Objetivos para el trimestre ${q} del ${y}]]`).join('\n\n'),
    embedsTrimestres: qs.map((q) => `### [[${y}-Q${q}]]\n![[${y}-Q${q}#Resumen del trimestre]]`).join('\n\n'),
  };
}

export function yearlyFrontmatter(): string {
  return renderFrontmatter([fm.value('type', 'Yly'), fm.value('estado', '🟢'), fm.value('journal', 'Anual')]);
}

/** Cuerpo por defecto de cada tipo de journal (con marcadores `{{…}}`). */
export const JOURNAL_BODIES: Readonly<Record<JournalType, string>> = {
  Dly: BODY_DLY, Wly: BODY_WLY, Mly: BODY_MLY, Qly: BODY_QLY, Yly: BODY_YLY,
};

/**
 * Nota de journal del periodo que contiene `date`: nombre, ruta (ajustes de Journal), frontmatter y cuerpo.
 * `bodyTemplate` permite un cuerpo personalizado (`Plt - Dly.md`…) con los mismos marcadores.
 */
export function journalNoteFor(kind: JournalKind, date: string, s: JournalSettings, bodyTemplate?: string): JournalNote {
  const p = parts(date);
  const type = JOURNAL_TYPE[kind];
  let title: string;
  let path: string;
  let frontmatter: string;
  let vars: Record<string, string>;
  switch (kind) {
    case 'day':
      title = dailyNoteName(date);
      path = dailyNotePath(s, date);
      frontmatter = dailyFrontmatter(date);
      vars = dailyVars(date, s);
      break;
    case 'week': {
      const w = isoWeekOf(date);
      title = formatWeekCode(w);
      path = periodNotePath(s, 'week', date);
      frontmatter = weeklyFrontmatter(w);
      vars = weeklyVars(w);
      break;
    }
    case 'month':
      title = monthId(p.y, p.m);
      path = periodNotePath(s, 'month', date);
      frontmatter = monthlyFrontmatter(p.y, p.m);
      vars = monthlyVars(p.y, p.m);
      break;
    case 'quarter': {
      const q = quarterOfMonth(p.m);
      title = `${p.y}-Q${q}`;
      path = periodNotePath(s, 'quarter', date);
      frontmatter = quarterlyFrontmatter(p.y);
      vars = quarterlyVars(p.y, q);
      break;
    }
    case 'year':
      title = String(p.y);
      path = periodNotePath(s, 'year', date);
      frontmatter = yearlyFrontmatter();
      vars = yearlyVars(p.y);
      break;
  }
  const allVars = { tipo: type, titulo: title, ...vars, nombre: title };
  const body = interpolate(bodyTemplate ?? JOURNAL_BODIES[type], allVars);
  return { kind, type, title, path, folder: parentFolder(path), frontmatter, body, content: frontmatter + body, vars: allVars };
}
