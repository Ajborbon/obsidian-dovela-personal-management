/**
 * Piezas comunes de los paneles: vista reactiva al índice (redibuja solo si está visible, con debounce),
 * activación de vistas, apertura de notas desde un panel y modal de confirmación.
 */
import { ItemView, MarkdownView, Modal, TFile, debounce } from 'obsidian';
import type { App, PaneType, WorkspaceLeaf } from 'obsidian';
import type { DovelaContext } from '../../context';
import { toLocalHm, toLocalYmd } from '../../core/dates';
import { logger } from '../../host/logger';
import { openNote, wantsNewLeaf } from '../../host/navigation';

/** Vista que se redibuja cuando cambia el índice, solo si está visible y con debounce. */
export abstract class IndexedPanelView extends ItemView {
  private dirty = true;
  private unsubscribe: (() => void) | null = null;
  private readonly scheduleRender = debounce(() => this.renderIfVisible(), 300, true);

  protected constructor(leaf: WorkspaceLeaf, protected readonly ctx: DovelaContext) {
    super(leaf);
  }

  /** Construye el contenido completo en `contentEl` (ya vaciado). */
  protected abstract draw(root: HTMLElement): void;

  /** Clase CSS raíz de la vista. */
  protected abstract readonly rootClass: string;

  override async onOpen(): Promise<void> {
    this.contentEl.addClass('dovela', 'dovela-panels', this.rootClass);
    this.unsubscribe = this.ctx.index.onChange(() => this.invalidate());
    const onLayout = (): void => {
      if (this.dirty) this.scheduleRender();
    };
    this.registerEvent(this.app.workspace.on('active-leaf-change', onLayout));
    this.registerEvent(this.app.workspace.on('layout-change', onLayout));
    this.registerEvent(this.app.workspace.on('resize', onLayout));
    if (!this.ctx.index.loaded) void this.ctx.index.ready.then(() => this.invalidate());
    this.refresh();
  }

  override async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.scheduleRender.cancel();
    this.contentEl.empty();
  }

  /** Marca la vista como desactualizada y programa el redibujado (si está visible). */
  invalidate(): void {
    this.dirty = true;
    this.scheduleRender();
  }

  /** Redibuja ya, conservando el desplazamiento. */
  refresh(): void {
    this.dirty = false;
    const el = this.contentEl;
    const scroll = el.scrollTop;
    el.empty();
    try {
      this.draw(el);
    } catch (e) {
      logger.error(`Error al dibujar ${this.getViewType()}`, e);
      el.createDiv({ cls: 'dovela-muted', text: 'Error al dibujar el panel. Revisa la consola de depuración.' });
    }
    el.scrollTop = scroll;
  }

  private renderIfVisible(): void {
    if (!this.dirty) return;
    if (!this.contentEl.isShown()) return; // se redibuja al volver a ser visible (active-leaf/layout-change)
    this.refresh();
  }
}

/** Abre (o revela) una vista única del tipo dado en una pestaña del área principal. */
export async function activateView(app: App, type: string): Promise<void> {
  const existing = app.workspace.getLeavesOfType(type)[0];
  if (existing) {
    await app.workspace.revealLeaf(existing);
    return;
  }
  const leaf = app.workspace.getLeaf('tab');
  await leaf.setViewState({ type, active: true });
  await app.workspace.revealLeaf(leaf);
}

function leafShowing(app: App, path: string): WorkspaceLeaf | null {
  for (const leaf of app.workspace.getLeavesOfType('markdown')) {
    if (leaf.view instanceof MarkdownView && leaf.view.file?.path === path) return leaf;
  }
  return null;
}

/**
 * Destino de una nota abierta desde un panel: Ctrl/Cmd → pestaña nueva; si la nota ya está abierta se reutiliza
 * su pestaña; si el panel está en el área principal se abre en otra pestaña (para no reemplazar el panel).
 */
function targetLeaf(app: App, panel: ItemView, path: string, ev?: MouseEvent): WorkspaceLeaf {
  const forced: PaneType | false = ev ? wantsNewLeaf(ev) : false;
  if (forced) return app.workspace.getLeaf(forced);
  const existing = leafShowing(app, path);
  if (existing) return existing;
  return app.workspace.getLeaf(panel.leaf.getRoot() === app.workspace.rootSplit ? 'tab' : false);
}

export async function openFromPanel(app: App, panel: ItemView, path: string, line?: number, ev?: MouseEvent): Promise<WorkspaceLeaf | null> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    await openNote(app, path, line, 'tab');
    return null;
  }
  const leaf = targetLeaf(app, panel, path, ev);
  await leaf.openFile(file, line !== undefined ? { active: true, eState: { line } } : { active: true });
  await app.workspace.revealLeaf(leaf);
  return leaf;
}

/** Abre la nota en modo edición y coloca el cursor (espera a que el editor refleje la escritura en disco). */
export async function openAtCursor(app: App, panel: ItemView, path: string, line: number, ch: number, expectedLine: string): Promise<void> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return;
  const leaf = targetLeaf(app, panel, path);
  await leaf.openFile(file, { active: true, state: { mode: 'source' }, eState: { line } });
  await app.workspace.revealLeaf(leaf);
  const view = leaf.view;
  if (!(view instanceof MarkdownView)) return;
  if (view.getMode() !== 'source') await view.setState({ ...view.getState(), mode: 'source' }, { history: false });
  const editor = view.editor;
  for (let i = 0; i < 20; i++) {
    if (line < editor.lineCount() && editor.getLine(line) === expectedLine) break;
    await new Promise<void>((r) => window.setTimeout(r, 50));
  }
  const safeLine = Math.min(line, Math.max(0, editor.lineCount() - 1));
  editor.setCursor({ line: safeLine, ch: Math.min(ch, editor.getLine(safeLine).length) });
  editor.scrollIntoView({ from: { line: safeLine, ch: 0 }, to: { line: safeLine, ch: 0 } }, true);
  editor.focus();
}

/** Confirmación nativa (Esc/cerrar = cancelar). */
export class ConfirmModal extends Modal {
  private resolved = false;
  private resolve: (ok: boolean) => void = () => undefined;

  constructor(app: App, private readonly titleText: string, private readonly message: string, private readonly confirmText: string) {
    super(app);
  }

  ask(): Promise<boolean> {
    return new Promise((r) => {
      this.resolve = r;
      this.open();
    });
  }

  override onOpen(): void {
    this.setTitle(this.titleText);
    this.contentEl.addClass('dovela', 'dovela-confirm');
    this.contentEl.createEl('p', { text: this.message });
    const buttons = this.contentEl.createDiv({ cls: 'modal-button-container' });
    buttons.createEl('button', { text: 'Cancelar' }).addEventListener('click', () => this.finish(false));
    const ok = buttons.createEl('button', { cls: 'mod-cta', text: this.confirmText });
    ok.addEventListener('click', () => this.finish(true));
    window.setTimeout(() => ok.focus(), 0);
  }

  override onClose(): void {
    this.contentEl.empty();
    if (!this.resolved) {
      this.resolved = true;
      this.resolve(false);
    }
  }

  private finish(ok: boolean): void {
    if (!this.resolved) {
      this.resolved = true;
      this.resolve(ok);
    }
    this.close();
  }
}

/** Formatea un instante en hora local `YYYY-MM-DD HH:mm`. */
export function formatInstant(ms: number): string {
  const d = new Date(ms);
  return `${toLocalYmd(d)} ${toLocalHm(d)}`;
}
