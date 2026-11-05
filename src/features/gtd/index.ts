/**
 * Feature `gtd`: Dashboard GTD (`gtd-view`) y Vista de Foco (`foco-gtd-view`), con los ids de vista y de
 * comando de v1. Publica el servicio `gtd` para que otras features abran el Dashboard en una pestaña
 * (p. ej. la barra de estado del temporizador → Seguimiento).
 */
import { Notice, TFile } from 'obsidian';
import type { DovelaContext, Feature } from '../../context';
import type { FocusSettings } from '../../core/gtd/focus';
import { FOCO_VIEW_TYPE, FocoView, type FocusSettingsHub } from './FocoView';
import { GTD_VIEW_TYPE, GtdView } from './GtdView';
import { loadFocusSettings, migrateLegacyFocus, saveFocusSettings, type DashboardTab } from './state';

export { GTD_VIEW_TYPE } from './GtdView';
export { FOCO_VIEW_TYPE } from './FocoView';
export type { DashboardTab } from './state';

export interface GtdService {
  /** Abre (o revela) el Dashboard; opcionalmente en una pestaña concreta. */
  openDashboard(tab?: DashboardTab): Promise<void>;
  /** Abre (o revela) la Vista de Foco de una nota. */
  openFocus(path: string): Promise<void>;
}

async function openDashboard(ctx: DovelaContext, tab?: DashboardTab): Promise<void> {
  const ws = ctx.app.workspace;
  let leaf = ws.getLeavesOfType(GTD_VIEW_TYPE)[0];
  if (!leaf) {
    leaf = ws.getLeaf('tab');
    await leaf.setViewState({ type: GTD_VIEW_TYPE, active: true });
  }
  await ws.revealLeaf(leaf);
  if (tab && leaf.view instanceof GtdView) leaf.view.setTab(tab);
}

async function openFocus(ctx: DovelaContext, path: string): Promise<void> {
  const ws = ctx.app.workspace;
  // `getViewState` también funciona con hojas diferidas (aún no cargadas) tras reiniciar.
  const existing = ws.getLeavesOfType(FOCO_VIEW_TYPE).find((l) =>
    l.view instanceof FocoView ? l.view.anchorPath === path : l.getViewState().state?.['file'] === path);
  if (existing) {
    await ws.revealLeaf(existing);
    return;
  }
  const leaf = ws.getLeaf('tab');
  await leaf.setViewState({ type: FOCO_VIEW_TYPE, active: true, state: { file: path } });
  await ws.revealLeaf(leaf);
}

function activeMarkdown(ctx: DovelaContext): TFile | null {
  const f = ctx.app.workspace.getActiveFile();
  return f instanceof TFile && f.extension === 'md' ? f : null;
}

function createHub(ctx: DovelaContext): FocusSettingsHub {
  let current: FocusSettings = loadFocusSettings(ctx.cache);
  let version = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    get version() {
      return version;
    },
    set(s) {
      current = s;
      version++;
      saveFocusSettings(ctx.cache, s);
      for (const l of [...listeners]) l();
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

export const gtdFeature: Feature = {
  id: 'gtd',
  register(ctx) {
    const { plugin } = ctx;
    migrateLegacyFocus(ctx.cache);
    const hub = createHub(ctx);

    plugin.registerView(GTD_VIEW_TYPE, (leaf) => new GtdView(leaf, ctx));
    plugin.registerView(FOCO_VIEW_TYPE, (leaf) => new FocoView(leaf, ctx, hub));

    plugin.addCommand({
      id: 'open-gtd-dashboard',
      name: 'Abrir GTD Dashboard',
      callback: () => void openDashboard(ctx),
    });
    plugin.addCommand({
      id: 'open-focus-view',
      name: 'Mostrar Vista de Foco del Proyecto',
      checkCallback: (checking) => {
        const f = activeMarkdown(ctx);
        if (!f) return false;
        if (!checking) void openFocus(ctx, f.path);
        return true;
      },
    });

    plugin.addRibbonIcon('list-checks', 'GTD Dashboard', () => void openDashboard(ctx));
    plugin.addRibbonIcon('crosshair', 'Abrir Vista de Foco', () => {
      const f = activeMarkdown(ctx);
      if (f) void openFocus(ctx, f.path);
      else new Notice('Dovela: abre una nota para mostrar su Vista de Foco.');
    });

    const service: GtdService = {
      openDashboard: (tab) => openDashboard(ctx, tab),
      openFocus: (path) => openFocus(ctx, path),
    };
    ctx.services.set('gtd', service);
  },
};
