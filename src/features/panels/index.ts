/**
 * Feature `panels`: Panel de Actividad y Panel de Revisión GTD (F7).
 * Conserva los ids de vista y de comando de v1 para no romper atajos ni el layout guardado.
 * Las vistas se instancian de forma perezosa (factories de `registerView`).
 */
import type { Feature } from '../../context';
import { ACTIVITY_VIEW_ICON, ACTIVITY_VIEW_TITLE, ACTIVITY_VIEW_TYPE, ActivityView } from './ActivityView';
import { activateView } from './common';
import { REVIEW_VIEW_ICON, REVIEW_VIEW_TITLE, REVIEW_VIEW_TYPE, ReviewView } from './ReviewView';

export const panelsFeature: Feature = {
  id: 'panels',
  register(ctx) {
    const { plugin, app } = ctx;

    plugin.registerView(ACTIVITY_VIEW_TYPE, (leaf) => new ActivityView(leaf, ctx));
    plugin.registerView(REVIEW_VIEW_TYPE, (leaf) => new ReviewView(leaf, ctx));

    plugin.addCommand({
      id: 'open-activity-panel',
      name: 'Panel de Actividad: Mostrar resumen de actividad',
      icon: ACTIVITY_VIEW_ICON,
      callback: () => void activateView(app, ACTIVITY_VIEW_TYPE),
    });
    plugin.addCommand({
      id: 'open-gtd-review-panel',
      name: 'Revisión GTD: Encontrar proyectos estancados',
      icon: REVIEW_VIEW_ICON,
      callback: () => void activateView(app, REVIEW_VIEW_TYPE),
    });

    plugin.addRibbonIcon(ACTIVITY_VIEW_ICON, ACTIVITY_VIEW_TITLE, () => void activateView(app, ACTIVITY_VIEW_TYPE));
    plugin.addRibbonIcon(REVIEW_VIEW_ICON, REVIEW_VIEW_TITLE, () => void activateView(app, REVIEW_VIEW_TYPE));
  },
};
