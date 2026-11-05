/** Vista `gtd-view` (id de v1 conservado): Dashboard sobre todo el vault. */
import { ItemView } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import type { DovelaContext } from '../../context';
import { Dashboard } from './Dashboard';
import type { DashboardTab } from './state';

export const GTD_VIEW_TYPE = 'gtd-view';

export class GtdView extends ItemView {
  private dash: Dashboard | null = null;
  private pendingTab: DashboardTab | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly ctx: DovelaContext) {
    super(leaf);
  }

  getViewType(): string {
    return GTD_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'GTD Dashboard';
  }

  override getIcon(): string {
    return 'list-checks';
  }

  override async onOpen(): Promise<void> {
    this.dash = this.addChild(new Dashboard(this, this.ctx, { stateKey: 'gtd:dashboard' }));
    if (this.pendingTab) this.dash.setTab(this.pendingTab);
    this.pendingTab = null;
  }

  override async onClose(): Promise<void> {
    if (this.dash) this.removeChild(this.dash);
    this.dash = null;
  }

  setTab(tab: DashboardTab): void {
    if (this.dash) this.dash.setTab(tab);
    else this.pendingTab = tab;
  }
}
