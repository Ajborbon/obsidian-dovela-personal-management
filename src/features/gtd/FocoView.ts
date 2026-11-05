/**
 * Vista `foco-gtd-view` (id de v1 conservado): el MISMO Dashboard con el ámbito de una nota fijada.
 * La nota fijada se persiste con `getState/setState` (sobrevive al reinicio, v1 no lo hacía).
 */
import { ItemView, TFile } from 'obsidian';
import type { ViewStateResult, WorkspaceLeaf } from 'obsidian';
import type { DovelaContext } from '../../context';
import { computeFocusScope, focusSummary, type FocusSettings } from '../../core/gtd/focus';
import { basenameOf } from '../../core/index/store';
import type { ExpandResult } from '../../core/links/expand';
import { Dashboard, type ScopeSnapshot } from './Dashboard';
import { FocusSettingsModal } from './FocusSettingsModal';
import { FOCUS_HEADER_KEY } from './state';

export const FOCO_VIEW_TYPE = 'foco-gtd-view';

/** Ajustes de Foco compartidos por todas las vistas Foco de este dispositivo. */
export interface FocusSettingsHub {
  get(): FocusSettings;
  set(s: FocusSettings): void;
  readonly version: number;
  onChange(cb: () => void): () => void;
}

type LeafWithHeader = WorkspaceLeaf & { updateHeader?: () => void };

export class FocoView extends ItemView {
  private anchor: string | null = null;
  private dash: Dashboard | null = null;
  private memo: { key: string; snap: ScopeSnapshot; result: ExpandResult } | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly ctx: DovelaContext, private readonly hub: FocusSettingsHub) {
    super(leaf);
  }

  getViewType(): string {
    return FOCO_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.anchor ? `Foco: ${basenameOf(this.anchor)}` : 'Vista de Foco';
  }

  override getIcon(): string {
    return 'crosshair';
  }

  get anchorPath(): string | null {
    return this.anchor;
  }

  override getState(): Record<string, unknown> {
    return { ...super.getState(), file: this.anchor };
  }

  override async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const file = state && typeof state === 'object' ? (state as Record<string, unknown>)['file'] : undefined;
    if (typeof file === 'string' && file) this.setAnchor(file, false);
    await super.setState(state, result);
  }

  /** Fija otra nota. `persist` = pedir a Obsidian que guarde el layout. */
  setAnchor(path: string, persist = true): void {
    if (path === this.anchor) return;
    this.anchor = path;
    this.memo = null;
    (this.leaf as LeafWithHeader).updateHeader?.();
    this.dash?.refresh();
    if (persist) this.app.workspace.requestSaveLayout();
  }

  override async onOpen(): Promise<void> {
    this.dash = this.addChild(new Dashboard(this, this.ctx, {
      stateKey: 'gtd:foco',
      scope: () => this.focusScope(),
      noScopeMessage: 'No hay nota fijada. Abre una nota y ejecuta “Mostrar Vista de Foco del Proyecto”, o pulsa 📍 arriba.',
      renderHeaderExtras: (el) => this.renderHeader(el),
    }));
    this.registerEvent(this.app.workspace.on('file-open', (f) => {
      if (f instanceof TFile && f.extension === 'md' && this.hub.get().followActive) this.setAnchor(f.path);
    }));
    this.registerEvent(this.app.vault.on('rename', (f, oldPath) => {
      if (oldPath === this.anchor) this.setAnchor(f.path);
    }));
    this.register(this.hub.onChange(() => {
      this.memo = null;
      this.dash?.refresh();
    }));
  }

  override async onClose(): Promise<void> {
    if (this.dash) this.removeChild(this.dash);
    this.dash = null;
  }

  private focusScope(): ScopeSnapshot | null {
    const anchor = this.anchor;
    if (!anchor || !(this.app.vault.getAbstractFileByPath(anchor) instanceof TFile)) return null;
    const store = this.ctx.index.store;
    const key = `${anchor}|${store.version}|${this.hub.version}`;
    if (this.memo?.key === key) return this.memo.snap;
    const s = this.hub.get();
    const result = computeFocusScope(store, anchor, s);
    const snap: ScopeSnapshot = { key, notes: result.notes, showBadges: s.showOriginIndicators };
    this.memo = { key, snap, result };
    return snap;
  }

  private renderHeader(el: HTMLElement): void {
    const cache = this.ctx.cache;
    let collapsed = cache.get<boolean>(FOCUS_HEADER_KEY, false) === true;
    const box = el.createDiv({ cls: 'dovela-foco-header' });
    const title = box.createDiv({ cls: 'dovela-foco-title', attr: { role: 'button', tabindex: '0' } });
    const name = this.anchor ? basenameOf(this.anchor) : '(sin nota fijada)';
    const exists = !this.anchor || this.app.vault.getAbstractFileByPath(this.anchor) instanceof TFile;
    title.createSpan({ cls: 'dovela-foco-name', text: `🎯 Foco: ${name}${exists ? '' : ' — ya no existe'}` });
    const ind = title.createSpan({ cls: 'dovela-foco-indicator' });
    const content = box.createDiv({ cls: 'dovela-foco-content' });
    const apply = (): void => {
      box.toggleClass('is-collapsed', collapsed);
      ind.setText(collapsed ? '▸' : '▾');
      title.setAttr('aria-expanded', String(!collapsed));
    };
    const toggle = (): void => {
      collapsed = !collapsed;
      cache.set(FOCUS_HEADER_KEY, collapsed);
      apply();
    };
    title.addEventListener('click', toggle);
    title.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        toggle();
      }
    });
    apply();

    if (this.memo && exists && this.anchor) content.createDiv({ cls: 'dovela-foco-summary dovela-muted', text: focusSummary(this.memo.result) });
    const actions = content.createDiv({ cls: 'dovela-gtd-toolbar' });
    const settings = actions.createEl('button', { text: '⚙️ Ajustes' });
    settings.addEventListener('click', () => {
      new FocusSettingsModal(this.app, this.hub.get(), (s) => this.hub.set(s)).open();
    });
    const pin = actions.createEl('button', { text: '📍 Fijar nota activa', attr: { 'aria-label': 'Usar la nota activa como nota fijada' } });
    pin.addEventListener('click', () => {
      const f = this.app.workspace.getActiveFile();
      if (f && f.extension === 'md') this.setAnchor(f.path);
    });
    const follow = this.hub.get().followActive;
    const followBtn = actions.createEl('button', {
      text: follow ? '👁 Siguiendo nota activa' : '👁 Seguir nota activa',
      attr: { 'aria-pressed': String(follow) },
    });
    followBtn.toggleClass('is-active', follow);
    followBtn.addEventListener('click', () => this.hub.set({ ...this.hub.get(), followActive: !follow }));
  }
}
