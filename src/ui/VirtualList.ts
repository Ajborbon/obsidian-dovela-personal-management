/**
 * Lista virtualizada de filas de altura uniforme (aprox.). Para listas planas largas
 * (selector de tareas, registros, backlinks). Por debajo de `threshold` pinta todo.
 */

export interface VirtualListOptions<T> {
  readonly container: HTMLElement;
  readonly items: readonly T[];
  readonly rowHeight: number;
  readonly render: (item: T, index: number) => HTMLElement;
  /** Filas extra arriba/abajo de la ventana visible. */
  readonly overscan?: number;
  readonly threshold?: number;
  /** Altura máxima del viewport; por defecto ocupa el contenedor. */
  readonly maxHeight?: number;
}

export class VirtualList<T> {
  private readonly viewport: HTMLElement;
  private readonly spacer: HTMLElement;
  private readonly content: HTMLElement;
  private items: readonly T[];
  private readonly opts: VirtualListOptions<T>;
  private frame = 0;
  private lastStart = -1;
  private lastEnd = -1;
  private readonly onScroll = (): void => this.schedule();

  constructor(opts: VirtualListOptions<T>) {
    this.opts = opts;
    this.items = opts.items;
    this.viewport = opts.container.createDiv({ cls: 'dovela-vlist' });
    if (opts.maxHeight) this.viewport.style.maxHeight = `${opts.maxHeight}px`;
    this.spacer = this.viewport.createDiv({ cls: 'dovela-vlist-spacer' });
    this.content = this.viewport.createDiv({ cls: 'dovela-vlist-content' });
    this.viewport.addEventListener('scroll', this.onScroll, { passive: true });
    this.paint(true);
  }

  setItems(items: readonly T[]): void {
    this.items = items;
    this.paint(true);
  }

  destroy(): void {
    this.viewport.removeEventListener('scroll', this.onScroll);
    if (this.frame) window.cancelAnimationFrame(this.frame);
    this.viewport.remove();
  }

  private schedule(): void {
    if (this.frame) return;
    this.frame = window.requestAnimationFrame(() => {
      this.frame = 0;
      this.paint(false);
    });
  }

  private paint(force: boolean): void {
    const { rowHeight, render } = this.opts;
    const threshold = this.opts.threshold ?? 150;
    if (this.items.length <= threshold) {
      this.viewport.classList.remove('is-virtual');
      this.spacer.style.height = '';
      this.content.style.transform = '';
      if (force) {
        this.content.empty();
        this.items.forEach((it, i) => this.content.appendChild(render(it, i)));
      }
      return;
    }
    this.viewport.classList.add('is-virtual');
    this.spacer.style.height = `${this.items.length * rowHeight}px`;
    const overscan = this.opts.overscan ?? 10;
    const height = this.viewport.clientHeight || this.opts.maxHeight || 600;
    const start = Math.max(0, Math.floor(this.viewport.scrollTop / rowHeight) - overscan);
    const end = Math.min(this.items.length, Math.ceil((this.viewport.scrollTop + height) / rowHeight) + overscan);
    if (!force && start === this.lastStart && end === this.lastEnd) return;
    this.lastStart = start;
    this.lastEnd = end;
    this.content.empty();
    this.content.style.transform = `translateY(${start * rowHeight}px)`;
    for (let i = start; i < end; i++) {
      const it = this.items[i];
      if (it !== undefined) this.content.appendChild(render(it, i));
    }
  }
}
