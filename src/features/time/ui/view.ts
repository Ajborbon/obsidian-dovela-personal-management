/** Vista independiente “Dovela: Tiempo” con las pestañas Seguimiento / Estadísticas / Cronograma. */
import { ItemView, setIcon } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import type { DovelaContext } from '../../../context';
import { mountTimeTab, type Disposer, type TimeTab } from './tabs';

export const TIME_VIEW_TYPE = 'dovela-time-view';
const TAB_KEY = 'time.view.tab';

const TABS: ReadonlyArray<{ id: TimeTab; label: string; icon: string }> = [
  { id: 'tracker', label: 'Seguimiento', icon: 'play-circle' },
  { id: 'statistics', label: 'Estadísticas', icon: 'bar-chart-2' },
  { id: 'timeline', label: 'Cronograma', icon: 'calendar-range' },
];

function isTab(v: unknown): v is TimeTab {
  return v === 'tracker' || v === 'statistics' || v === 'timeline';
}

export class TimeView extends ItemView {
  private tab: TimeTab;
  private dispose: Disposer | null = null;
  private body: HTMLElement | null = null;
  private readonly buttons = new Map<TimeTab, HTMLElement>();

  constructor(leaf: WorkspaceLeaf, private readonly ctx: DovelaContext) {
    super(leaf);
    const saved = ctx.cache.get<unknown>(TAB_KEY, 'tracker');
    this.tab = isTab(saved) ? saved : 'tracker';
  }

  getViewType(): string {
    return TIME_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Dovela: Tiempo';
  }

  override getIcon(): string {
    return 'timer';
  }

  override async onOpen(): Promise<void> {
    const el = this.contentEl;
    el.empty();
    el.addClass('dovela', 'dovela-time-view');
    const bar = el.createDiv({ cls: 'dovela-time-tabs', attr: { role: 'tablist' } });
    for (const t of TABS) {
      const b = bar.createEl('button', { cls: 'dovela-time-tab-btn', attr: { role: 'tab', 'aria-label': t.label } });
      setIcon(b.createSpan({ cls: 'dovela-time-tab-icon' }), t.icon);
      b.createSpan({ cls: 'dovela-time-tab-label', text: t.label });
      this.registerDomEvent(b, 'click', () => this.setTab(t.id));
      this.buttons.set(t.id, b);
    }
    this.body = el.createDiv({ cls: 'dovela-time-body' });
    this.mount();
  }

  setTab(tab: TimeTab): void {
    if (tab === this.tab && this.dispose) return;
    this.tab = tab;
    this.ctx.cache.set(TAB_KEY, tab);
    this.mount();
  }

  private mount(): void {
    if (!this.body) return;
    this.dispose?.();
    this.dispose = null;
    this.body.empty();
    for (const [id, b] of this.buttons) {
      b.toggleClass('is-active', id === this.tab);
      b.setAttr('aria-selected', String(id === this.tab));
    }
    this.dispose = mountTimeTab(this.body, this.ctx, this.tab);
  }

  override async onClose(): Promise<void> {
    this.dispose?.();
    this.dispose = null;
    this.contentEl.empty();
  }
}

/** Abre (o revela) la vista de tiempo, opcionalmente en una pestaña concreta. */
export async function openTimeView(ctx: DovelaContext, tab?: TimeTab): Promise<void> {
  const ws = ctx.app.workspace;
  if (tab) ctx.cache.set(TAB_KEY, tab);
  let leaf = ws.getLeavesOfType(TIME_VIEW_TYPE)[0];
  if (!leaf) {
    leaf = ws.getLeaf('tab');
    await leaf.setViewState({ type: TIME_VIEW_TYPE, active: true });
  }
  await ws.revealLeaf(leaf);
  const view = leaf.view;
  if (tab && view instanceof TimeView) view.setTab(tab);
}
