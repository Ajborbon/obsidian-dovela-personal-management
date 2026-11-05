/**
 * Feature `backlinks` (F8): vista lateral "Backlinks organizados" que sigue la nota activa.
 * Puntos de acceso de v1 conservados: comando `open-backlinks-view`, ribbon `link` y menú de archivo.
 * Preferencias por dispositivo (caché local) con migración única de `localStorage` v1.
 */
import { Setting, TFile } from 'obsidian';
import type { Feature } from '../../context';
import { BREADCRUMB_STYLES, BREADCRUMB_STYLE_LABELS, type BreadcrumbStyle } from '../../core/links/breadcrumbs';
import { MAX_BREADCRUMB_LENGTH, MIN_BREADCRUMB_LENGTH } from '../../core/backlinks/prefs';
import { addSettingsSection } from '../settings';
import { PrefsHolder } from './prefs';
import { BACKLINKS_VIEW_TYPE, BacklinksView, activateBacklinksView } from './view';

export { BACKLINKS_VIEW_TYPE } from './view';

export const backlinksFeature: Feature = {
  id: 'backlinks',
  register(ctx) {
    const prefs = new PrefsHolder(ctx.cache);
    const { plugin, app } = ctx;

    plugin.registerView(BACKLINKS_VIEW_TYPE, (leaf) => new BacklinksView(leaf, ctx, prefs));

    plugin.addCommand({
      id: 'open-backlinks-view',
      name: 'Mostrar Backlinks Organizados',
      callback: () => void activateBacklinksView(ctx),
    });
    plugin.addRibbonIcon('link', 'Backlinks organizados', () => void activateBacklinksView(ctx));

    plugin.registerEvent(app.workspace.on('file-menu', (menu, file) => {
      if (!(file instanceof TFile)) return;
      menu.addItem((item) => item
        .setTitle('Ver Backlinks Organizados')
        .setIcon('link')
        .onClick(() => void activateBacklinksView(ctx, file.path)));
    }));

    addSettingsSection(ctx, {
      id: 'backlinks',
      title: 'Backlinks (este dispositivo)',
      order: 60,
      render(el) {
        el.createEl('p', {
          cls: 'setting-item-description',
          text: 'Estas preferencias se guardan solo en este dispositivo. Contar `origen` como backlink está en "General".',
        });
        new Setting(el).setName('Estilo de rutas').setDesc('Completo, inteligente o compacto (también con el botón 📁 de la vista).')
          .addDropdown((d) => {
            for (const s of BREADCRUMB_STYLES) d.addOption(s, BREADCRUMB_STYLE_LABELS[s]);
            d.setValue(prefs.value.breadcrumbStyle).onChange((v) => {
              prefs.update((p) => ({ ...p, breadcrumbStyle: v as BreadcrumbStyle }));
            });
          });
        new Setting(el).setName('Longitud máxima de ruta').setDesc('Caracteres a partir de los cuales los estilos inteligente y compacto abrevian la ruta (primero › … › último).')
          .addSlider((sl) => sl.setLimits(MIN_BREADCRUMB_LENGTH, MAX_BREADCRUMB_LENGTH, 5).setDynamicTooltip()
            .setValue(prefs.value.maxBreadcrumbLength)
            .onChange((v) => prefs.update((p) => ({ ...p, maxBreadcrumbLength: v }))));
        new Setting(el).setName('Vista detalle').setDesc('Muestra fechas de creación y modificación y el monto de las transacciones.')
          .addToggle((t) => t.setValue(prefs.value.detail).onChange((v) => prefs.update((p) => ({ ...p, detail: v }))));
      },
    });
  },
};
