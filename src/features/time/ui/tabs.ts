/**
 * CONTRATO entre el Dashboard GTD y la UI de tiempo: el dashboard monta las pestañas
 * Seguimiento / Estadísticas / Cronograma llamando a `mountTimeTab` y desmonta con el disposer.
 * La vista independiente “Dovela: Tiempo” usa el mismo punto de montaje.
 */
import type { DovelaContext } from '../../../context';
import { getTimeUi } from './controller';
import { mountStatistics } from './statistics';
import { mountTimeline } from './timeline';
import { mountTracker } from './tracker';

export type TimeTab = 'tracker' | 'statistics' | 'timeline';

export type Disposer = () => void;

export function mountTimeTab(container: HTMLElement, ctx: DovelaContext, tab: TimeTab): Disposer {
  const ui = getTimeUi(ctx);
  if (!ui) {
    container.createDiv({ cls: 'dovela-muted', text: 'El registro de tiempo no está disponible.' });
    return () => container.empty();
  }
  const root = container.createDiv({ cls: `dovela dovela-time dovela-time-${tab}` });
  let inner: Disposer;
  switch (tab) {
    case 'tracker':
      inner = mountTracker(root, ui);
      break;
    case 'statistics':
      inner = mountStatistics(root, ui);
      break;
    case 'timeline':
      inner = mountTimeline(root, ui);
      break;
  }
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    inner();
    root.remove();
    container.empty();
  };
}
