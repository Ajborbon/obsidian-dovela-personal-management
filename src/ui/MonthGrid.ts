/**
 * Calendario mensual común (Smart Inbox, selector de fechas de Estadísticas, popover del Cronograma).
 * Lunes primero, independiente del locale de moment (corrige el desalineado de v1).
 */
import { addDays, daysInMonth, formatYmd, isoWeekday, monthNameEs } from '../core/dates';

export interface MonthGridOptions {
  /** Mes visible: cualquier fecha del mes (YYYY-MM-DD). */
  readonly month: string;
  readonly today: string;
  readonly selected?: string | null;
  /** Rango resaltado (inclusive). */
  readonly range?: { from: string; to: string } | null;
  /** Intensidad 0..3 por día (mapa de calor). */
  readonly heat?: (day: string) => 0 | 1 | 2 | 3;
  readonly disabled?: (day: string) => boolean;
  readonly onPick: (day: string) => void;
  readonly onMonthChange?: (monthAnchor: string) => void;
}

const WEEKDAY_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function monthTitle(month: string): string {
  const m = Number(month.slice(5, 7));
  const name = monthNameEs(m);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${month.slice(0, 4)}`;
}

export function shiftMonth(month: string, dir: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + dir;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return formatYmd(yy, mm + 1, 1);
}

export function renderMonthGrid(parent: HTMLElement, opts: MonthGridOptions): HTMLElement {
  const root = parent.createDiv({ cls: 'dovela-month' });
  const head = root.createDiv({ cls: 'dovela-month-head' });
  const prev = head.createEl('button', { text: '‹', attr: { 'aria-label': 'Mes anterior' } });
  head.createSpan({ cls: 'dovela-month-title', text: monthTitle(opts.month) });
  const next = head.createEl('button', { text: '›', attr: { 'aria-label': 'Mes siguiente' } });
  prev.addEventListener('click', (e) => { e.preventDefault(); opts.onMonthChange?.(shiftMonth(opts.month, -1)); });
  next.addEventListener('click', (e) => { e.preventDefault(); opts.onMonthChange?.(shiftMonth(opts.month, 1)); });

  const grid = root.createDiv({ cls: 'dovela-month-grid' });
  for (const w of WEEKDAY_HEADERS) grid.createDiv({ cls: 'dovela-month-wd', text: w });
  const y = Number(opts.month.slice(0, 4));
  const m = Number(opts.month.slice(5, 7));
  const first = formatYmd(y, m, 1);
  const start = addDays(first, 1 - isoWeekday(first));
  const last = formatYmd(y, m, daysInMonth(y, m));
  const end = addDays(last, 7 - isoWeekday(last));
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const cell = grid.createEl('button', { cls: 'dovela-month-day', text: String(Number(d.slice(8, 10))) });
    const day = d;
    if (day.slice(0, 7) !== opts.month.slice(0, 7)) cell.addClass('is-other-month');
    if (day === opts.today) cell.addClass('is-today');
    if (day === opts.selected) cell.addClass('is-selected');
    if (opts.range && day >= opts.range.from && day <= opts.range.to) cell.addClass('is-in-range');
    const heat = opts.heat?.(day) ?? 0;
    if (heat) cell.addClass(`heat-${heat}`);
    if (opts.disabled?.(day)) cell.disabled = true;
    cell.addEventListener('click', (e) => {
      e.preventDefault();
      opts.onPick(day);
    });
  }
  return root;
}
