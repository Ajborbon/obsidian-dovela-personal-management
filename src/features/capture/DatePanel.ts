/**
 * Calendario del Smart Inbox (`!`): selector de tipo (🛫 Inicio / ⏳ Programada / 📅 Vence; Tab alterna),
 * rejilla mensual común (`renderMonthGrid`, lunes primero) y accesos rápidos.
 * Las fechas pasadas solo se permiten para 📅 Vence (como v1), también con teclado (v1 lo permitía por error).
 */
import { quickDates } from '../../core/capture/dates';
import { DATE_ICON, DATE_KINDS, DATE_LABEL, type DateKind } from '../../core/capture/tokenize';
import { renderMonthGrid } from '../../ui/MonthGrid';

export interface DatePanelState {
  readonly kind: DateKind;
  /** Día enfocado/seleccionado. */
  readonly focus: string;
  /** Mes visible (cualquier día del mes). */
  readonly month: string;
  readonly today: string;
  /** Texto escrito tras `!` (fecha legacy en curso) y si se entendió. */
  readonly typed: string;
  readonly typedOk: boolean;
  readonly error: string;
}

export interface DatePanelHandlers {
  onKind(kind: DateKind): void;
  onPick(day: string): void;
  onMonth(anchor: string): void;
}

export function isPastBlocked(kind: DateKind, day: string, today: string): boolean {
  return kind !== 'due' && day < today;
}

export class DatePanel {
  readonly el: HTMLElement;

  constructor(parent: HTMLElement, private readonly h: DatePanelHandlers) {
    this.el = parent.createDiv({ cls: 'dovela-capture-cal' });
  }

  render(s: DatePanelState): void {
    const el = this.el;
    el.empty();
    const head = el.createDiv({ cls: 'dovela-capture-menu-head' });
    head.createSpan({ cls: 'dovela-capture-menu-title', text: '📆 Fecha' });
    head.createSpan({ cls: 'dovela-capture-menu-keys', text: 'Tab tipo · ←→↑↓ día · Enter confirma · Esc cierra' });

    const kinds = el.createDiv({ cls: 'dovela-capture-cal-kinds', attr: { role: 'radiogroup', 'aria-label': 'Tipo de fecha' } });
    for (const k of DATE_KINDS) {
      const b = kinds.createEl('button', {
        cls: 'dovela-capture-cal-kind',
        text: `${DATE_ICON[k]} ${DATE_LABEL[k]}`,
        attr: { role: 'radio', 'aria-checked': String(k === s.kind), type: 'button' },
      });
      if (k === s.kind) b.addClass('is-active');
      b.addEventListener('click', (e) => {
        e.preventDefault();
        this.h.onKind(k);
      });
    }

    if (s.typed) {
      el.createDiv({
        cls: `dovela-capture-cal-typed ${s.typedOk ? 'is-ok' : 'is-bad'}`,
        text: s.typedOk ? `«!${s.typed}» → ${s.focus} · Enter para usarla` : `«!${s.typed}» no es una fecha reconocida · Enter guarda la tarea tal cual`,
      });
    }

    renderMonthGrid(el, {
      month: s.month,
      today: s.today,
      selected: s.focus,
      disabled: (d) => isPastBlocked(s.kind, d, s.today),
      onPick: (d) => this.h.onPick(d),
      onMonthChange: (m) => this.h.onMonth(m),
    });

    const quick = el.createDiv({ cls: 'dovela-capture-cal-quick' });
    for (const q of quickDates(s.today)) {
      const b = quick.createEl('button', { cls: 'dovela-capture-cal-quick-btn', attr: { type: 'button', title: q.date } });
      b.createSpan({ text: q.label });
      b.createSpan({ cls: 'dovela-capture-cal-quick-date', text: q.date.slice(5) });
      b.addEventListener('click', (e) => {
        e.preventDefault();
        this.h.onPick(q.date);
      });
    }
    if (s.error) el.createDiv({ cls: 'dovela-capture-cal-error', text: s.error });
  }
}
