/**
 * Redibujo diferido de una pestaña de tiempo: solo si está visible, con debounce, y pendiente
 * mientras está oculta o pausada (p. ej. durante un arrastre). El reloj de 1 s llama a `flush`
 * para pintar lo pendiente cuando la pestaña vuelve a verse.
 */
export function isVisible(el: HTMLElement): boolean {
  return el.isConnected && el.isShown();
}

export class Refresher {
  private dirty = false;
  private timer = 0;
  paused = false;

  constructor(
    private readonly el: HTMLElement,
    private readonly render: () => void,
    private readonly delay = 150,
  ) {}

  invalidate(): void {
    this.dirty = true;
    if (this.timer) return;
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      this.flush();
    }, this.delay);
  }

  flush(): void {
    if (!this.dirty || this.paused || !isVisible(this.el)) return;
    this.dirty = false;
    this.render();
  }

  dispose(): void {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = 0;
    this.dirty = false;
  }
}
