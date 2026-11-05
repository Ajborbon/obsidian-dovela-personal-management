/**
 * CONTRATO entre el Dashboard GTD y la UI de tiempo: el dashboard monta las pestañas
 * Seguimiento / Estadísticas / Cronograma llamando a `mountTimeTab` y desmonta con el disposer.
 * Implementación: F4/F7 (feature `time`).
 */
import type { DovelaContext } from '../../../context';

export type TimeTab = 'tracker' | 'statistics' | 'timeline';

export type Disposer = () => void;

export function mountTimeTab(container: HTMLElement, _ctx: DovelaContext, tab: TimeTab): Disposer {
  container.createDiv({ cls: 'dovela-muted', text: `Pestaña ${tab}: en construcción.` });
  return () => container.empty();
}
