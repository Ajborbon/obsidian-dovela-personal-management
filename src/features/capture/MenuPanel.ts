/**
 * Menú unificado del Smart Inbox (`@` proyectos y `#` en cascada): cabecera + lista filtrada con
 * resaltado. Un solo componente con delegación de eventos (ratón y táctil); el teclado lo gestiona
 * el modal, que es quien tiene el foco (el input nunca lo pierde: `mousedown` se cancela).
 */
import type { MenuModel, MenuOption } from '../../core/capture/menu';

export class MenuPanel {
  readonly el: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly listEl: HTMLElement;
  private readonly emptyEl: HTMLElement;
  private items: HTMLElement[] = [];
  private selected = 0;

  constructor(
    parent: HTMLElement,
    private readonly listId: string,
    private readonly onPick: (index: number) => void,
    private readonly onHover: (index: number) => void,
  ) {
    this.el = parent.createDiv({ cls: 'dovela-capture-menu' });
    const head = this.el.createDiv({ cls: 'dovela-capture-menu-head' });
    this.titleEl = head.createSpan({ cls: 'dovela-capture-menu-title' });
    head.createSpan({ cls: 'dovela-capture-menu-keys', text: '↑↓ · Enter/Tab elige · Esc cierra' });
    this.listEl = this.el.createDiv({ cls: 'dovela-capture-menu-list', attr: { role: 'listbox', id: listId } });
    this.emptyEl = this.el.createDiv({ cls: 'dovela-capture-menu-empty' });

    this.listEl.addEventListener('click', (e) => {
      const i = this.indexOf(e.target);
      if (i !== null) {
        e.preventDefault();
        this.onPick(i);
      }
    });
    this.listEl.addEventListener('mousemove', (e) => {
      const i = this.indexOf(e.target);
      if (i !== null && i !== this.selected) this.onHover(i);
    });
  }

  private indexOf(target: EventTarget | null): number | null {
    if (!(target instanceof HTMLElement)) return null;
    const item = target.closest<HTMLElement>('[data-idx]');
    if (!item) return null;
    const i = Number(item.dataset['idx']);
    return Number.isInteger(i) ? i : null;
  }

  render(model: MenuModel, selected: number): void {
    this.titleEl.setText(model.title);
    this.listEl.empty();
    this.items = model.options.map((o, i) => this.renderOption(o, i));
    this.emptyEl.setText(model.emptyText);
    this.emptyEl.toggleClass('is-hidden', model.options.length > 0);
    this.listEl.toggleClass('is-hidden', model.options.length === 0);
    this.setSelected(selected);
  }

  /** Id DOM de la opción activa (para `aria-activedescendant`). */
  activeId(): string | null {
    return this.items[this.selected]?.id ?? null;
  }

  setSelected(i: number): void {
    this.items[this.selected]?.removeClass('is-selected');
    this.items[this.selected]?.setAttr('aria-selected', 'false');
    this.selected = i;
    const el = this.items[i];
    if (!el) return;
    el.addClass('is-selected');
    el.setAttr('aria-selected', 'true');
    el.scrollIntoView({ block: 'nearest' });
  }

  private renderOption(o: MenuOption, i: number): HTMLElement {
    const item = this.listEl.createDiv({
      cls: 'dovela-capture-option',
      attr: { role: 'option', 'data-idx': String(i), id: `${this.listId}-${i}`, 'aria-selected': 'false' },
    });
    const main = item.createDiv({ cls: 'dovela-capture-option-main' });
    if (o.prefix) main.createSpan({ cls: 'dovela-capture-option-prefix', text: o.prefix });
    const label = main.createSpan({ cls: 'dovela-capture-option-label' });
    let pos = 0;
    for (const [a, b] of [...o.ranges].sort((x, y) => x[0] - y[0])) {
      if (a < pos) continue;
      if (a > pos) label.appendText(o.label.slice(pos, a));
      label.createSpan({ cls: 'dovela-capture-hl', text: o.label.slice(a, b) });
      pos = b;
    }
    if (pos < o.label.length) label.appendText(o.label.slice(pos));
    if (o.badge) main.createSpan({ cls: 'dovela-capture-option-badge', text: o.badge });
    if (o.detail) item.createDiv({ cls: 'dovela-capture-option-detail', text: o.detail });
    return item;
  }
}
