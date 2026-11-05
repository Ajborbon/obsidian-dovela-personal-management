/**
 * Modales nativos equivalentes a `tp.system.prompt` y `tp.system.suggester` (RI-E §9): devuelven una
 * promesa con la respuesta o `null` si el usuario cancela (Esc, clic fuera, botón Cancelar).
 * Cancelar en cualquier paso = no se crea nada.
 */
import type { App } from 'obsidian';
import { Modal, SuggestModal } from 'obsidian';

export interface TextQuestion {
  readonly prompt: string;
  readonly defaultValue?: string;
  readonly placeholder?: string;
  readonly required: boolean;
}

class TextPromptModal extends Modal {
  private done = false;

  constructor(app: App, private readonly q: TextQuestion, private readonly resolve: (v: string | null) => void) {
    super(app);
  }

  override onOpen(): void {
    this.modalEl.addClass('dovela-notes-modal');
    this.titleEl.setText(this.q.prompt);
    const { contentEl } = this;
    const input = contentEl.createEl('input', { type: 'text', cls: 'dovela-notes-input' });
    input.value = this.q.defaultValue ?? '';
    if (this.q.placeholder) input.placeholder = this.q.placeholder;
    input.setAttr('aria-label', this.q.prompt);
    const error = contentEl.createDiv({ cls: 'dovela-notes-error' });
    const submit = (): void => {
      const v = input.value;
      if (this.q.required && !v.trim()) {
        error.setText('No puede quedar vacío (Esc para cancelar).');
        input.focus();
        return;
      }
      this.done = true;
      this.resolve(v);
      this.close();
    };
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.isComposing) {
        ev.preventDefault();
        submit();
      }
    });
    const buttons = contentEl.createDiv({ cls: 'dovela-notes-buttons' });
    buttons.createEl('button', { text: 'Cancelar' }).addEventListener('click', () => this.close());
    const ok = buttons.createEl('button', { text: 'Aceptar', cls: 'mod-cta' });
    ok.addEventListener('click', submit);
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }

  override onClose(): void {
    this.contentEl.empty();
    if (!this.done) this.resolve(null);
  }
}

export function askText(app: App, q: TextQuestion): Promise<string | null> {
  return new Promise((resolve) => new TextPromptModal(app, q, resolve).open());
}

export interface PickOptions<T> {
  readonly prompt: string;
  readonly text: (item: T) => string;
  readonly description?: (item: T) => string;
  readonly isCurrent?: (item: T) => boolean;
}

class PickerModal<T> extends SuggestModal<T> {
  private done = false;

  constructor(app: App, private readonly items: readonly T[], private readonly o: PickOptions<T>, private readonly resolve: (v: T | null) => void) {
    super(app);
    this.setPlaceholder(o.prompt);
    this.setInstructions([
      { command: '↑↓', purpose: 'navegar' },
      { command: '↵', purpose: 'elegir' },
      { command: 'esc', purpose: 'cancelar' },
    ]);
    this.modalEl.addClass('dovela-notes-picker');
    const head = createDiv({ cls: 'dovela-notes-prompt', text: o.prompt });
    this.modalEl.insertBefore(head, this.modalEl.firstChild);
  }

  getSuggestions(query: string): T[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...this.items];
    return this.items.filter((it) => `${this.o.text(it)} ${this.o.description?.(it) ?? ''}`.toLowerCase().includes(q));
  }

  renderSuggestion(item: T, el: HTMLElement): void {
    el.addClass('dovela-notes-suggestion');
    if (this.o.isCurrent?.(item)) el.addClass('is-current');
    el.createDiv({ cls: 'dovela-notes-suggestion-title', text: this.o.text(item) });
    const desc = this.o.description?.(item);
    if (desc) el.createDiv({ cls: 'dovela-notes-suggestion-desc', text: desc });
  }

  onChooseSuggestion(item: T): void {
    this.done = true;
    this.resolve(item);
  }

  override onClose(): void {
    // `selectSuggestion` cierra el modal ANTES de llamar a `onChooseSuggestion`: se espera un tick.
    window.setTimeout(() => {
      if (!this.done) this.resolve(null);
    }, 0);
  }
}

export function pick<T>(app: App, items: readonly T[], o: PickOptions<T>): Promise<T | null> {
  return new Promise((resolve) => new PickerModal(app, items, o, resolve).open());
}
