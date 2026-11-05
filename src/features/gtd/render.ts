/**
 * Piezas de render compartidas por las pestañas del Dashboard: filas por tandas (render perezoso de
 * listas largas) y `<details>` cuyo contenido se construye al abrirse por primera vez.
 */
import type { Task } from '../../core/tasks/model';

/** Filas por tanda: acota el DOM inicial con miles de tareas (cada tanda extra se pide con un botón). */
export const CHUNK = 60;

export type RowFactory = (parent: HTMLElement, task: Task) => HTMLElement;

/**
 * Pinta `tasks` en tandas de `CHUNK`. `shown` recuerda cuántas filas había desplegado el usuario
 * para cada clave, de modo que un redibujado (cambio del índice) conserva lo que se veía.
 */
export function renderChunked(
  container: HTMLElement, tasks: readonly Task[], key: string, shown: Map<string, number>, row: RowFactory,
): void {
  const list = container.createDiv({ cls: 'dovela-gtd-tasks' });
  let count = 0;
  const more = (): void => {
    const limit = Math.max(CHUNK, shown.get(key) ?? CHUNK);
    const end = Math.min(tasks.length, count === 0 ? limit : count + CHUNK);
    for (let i = count; i < end; i++) {
      const t = tasks[i];
      if (t) row(list, t);
    }
    count = end;
    if (count > CHUNK) shown.set(key, count);
    if (count < tasks.length) {
      const btn = list.createEl('button', {
        cls: 'dovela-gtd-more',
        text: `Mostrar ${Math.min(CHUNK, tasks.length - count)} más (quedan ${tasks.length - count})`,
      });
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        btn.remove();
        more();
      });
    }
  };
  more();
}

export interface LazyDetails {
  readonly details: HTMLDetailsElement;
  readonly summary: HTMLElement;
  readonly body: HTMLElement;
  /** Construye el contenido si aún no existe. */
  ensure(): void;
}

/** `<details>` con contenido perezoso. `onToggle` informa del nuevo estado (para persistirlo). */
export function lazyDetails(
  parent: HTMLElement, cls: string, open: boolean, fill: (body: HTMLElement) => void, onToggle?: (open: boolean) => void,
): LazyDetails {
  const details = parent.createEl('details', { cls });
  const summary = details.createEl('summary');
  const body = details.createDiv({ cls: 'dovela-gtd-details-body' });
  let built = false;
  const ensure = (): void => {
    if (built) return;
    built = true;
    fill(body);
  };
  if (open) {
    details.open = true;
    ensure();
  }
  details.addEventListener('toggle', () => {
    if (details.open) ensure();
    onToggle?.(details.open);
  });
  return { details, summary, body, ensure };
}
