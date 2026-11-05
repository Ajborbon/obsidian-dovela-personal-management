/**
 * Piezas DOM de la vista de Backlinks (sin estado). Nunca `innerHTML`: todo con `createEl`.
 * Los clics se resuelven por delegación en la vista mediante atributos `data-*`:
 * `data-path` (abrir nota), `data-folder` (abrir nota de carpeta), `data-tab` (enfocar pestaña),
 * `data-action` (botones de la barra).
 */
import {
  CRUMB_ELLIPSIS, CRUMB_SEPARATOR, breadcrumbText, computeBreadcrumb, type BreadcrumbStyle,
} from '../../core/links/breadcrumbs';
import { REASON_ICONS, REASON_LABELS, type BacklinkEntry } from '../../core/backlinks/detect';
import { formatDateTime, formatMoney } from '../../core/backlinks/format';
import type { TreeMark } from '../../core/backlinks/tree';

export interface CrumbOptions {
  readonly style: BreadcrumbStyle;
  readonly maxLength: number;
}

/** Breadcrumb de carpeta navegable. Cada segmento lleva `data-folder` con su ruta acumulada. */
export function renderBreadcrumb(parent: HTMLElement, folderPath: string, opts: CrumbOptions): HTMLElement {
  const crumb = computeBreadcrumb(folderPath, opts.style, opts.maxLength);
  const el = parent.createDiv({ cls: `dovela-bl-crumb is-${crumb.kind}` });
  el.setAttr('aria-label', `Carpeta: ${breadcrumbText(crumb)}`);
  const seg = (name: string, path: string): void => {
    el.createSpan({ cls: 'dovela-bl-crumb-seg', text: name, attr: { 'data-folder': path, title: path } });
  };
  const sep = (): void => {
    el.createSpan({ cls: 'dovela-bl-crumb-sep', text: CRUMB_SEPARATOR });
  };
  switch (crumb.kind) {
    case 'root':
      el.createSpan({ cls: 'dovela-bl-crumb-root', text: crumb.label, attr: { title: 'Raíz del vault' } });
      break;
    case 'full':
      crumb.segments.forEach((s, i) => {
        if (i > 0) sep();
        seg(s.name, s.path);
      });
      break;
    case 'elided':
      el.setAttr('title', crumb.title);
      seg(crumb.first.name, crumb.first.path);
      sep();
      el.createSpan({ cls: 'dovela-bl-crumb-ellipsis', text: CRUMB_ELLIPSIS, attr: { title: crumb.title } });
      sep();
      seg(crumb.last.name, crumb.last.path);
      break;
  }
  return el;
}

export interface RowOptions {
  readonly detail: boolean;
  readonly crumb: CrumbOptions | null;
  readonly mark?: TreeMark;
}

const MARK_ICONS: Readonly<Record<Exclude<TreeMark, 'backlink'>, { icon: string; label: string }>> = {
  current: { icon: '📍', label: 'Nota actual' },
  expanded: { icon: '📋', label: 'Nota de la carpeta (modo expandido)' },
};

/** Fila de una nota (lista o árbol). Elemento separado (lo inserta la lista virtual o el árbol). */
export function renderEntryRow(entry: BacklinkEntry, opts: RowOptions): HTMLElement {
  const row = createDiv({ cls: 'dovela-bl-item', attr: { 'data-path': entry.path, role: 'button', tabindex: '0' } });
  const linked = entry.reasons.includes('link') || entry.reasons.includes('origin');
  row.addClass(linked ? 'has-backlink' : 'same-folder');
  if (opts.mark === 'current') row.addClass('is-current');
  if (opts.mark === 'expanded') row.addClass('is-extra');

  const head = row.createDiv({ cls: 'dovela-bl-item-head' });
  const icons = head.createSpan({ cls: 'dovela-bl-icons' });
  if (opts.mark === 'current' || opts.mark === 'expanded') {
    const m = MARK_ICONS[opts.mark];
    icons.createSpan({ text: m.icon, attr: { title: m.label, 'aria-label': m.label } });
  } else {
    for (const r of entry.reasons) icons.createSpan({ text: REASON_ICONS[r], attr: { title: REASON_LABELS[r], 'aria-label': REASON_LABELS[r] } });
  }
  head.createSpan({ cls: 'dovela-bl-title', text: entry.basename, attr: { title: entry.path } });

  if (entry.typeLabel || entry.estado) {
    const meta = row.createDiv({ cls: 'dovela-bl-meta' });
    if (entry.typeLabel) meta.createSpan({ cls: 'dovela-chip dovela-bl-type', text: entry.typeLabel });
    if (entry.estado) meta.createSpan({ cls: 'dovela-chip dovela-bl-estado', text: entry.estado });
  }

  if (opts.detail) {
    const money = formatMoney(entry.moneda, entry.monto);
    if (money) {
      const fin = row.createDiv({ cls: 'dovela-bl-money' });
      fin.createSpan({ text: '💰' });
      fin.createSpan({ cls: 'dovela-bl-money-amount', text: money });
    }
    if (entry.ctime || entry.mtime) {
      const dates = row.createDiv({ cls: 'dovela-bl-dates' });
      dates.createSpan({ cls: 'dovela-bl-date', text: `📅 Creado: ${formatDateTime(entry.ctime)}` });
      dates.createSpan({ cls: 'dovela-bl-date', text: `📝 Modificado: ${formatDateTime(entry.mtime)}` });
    }
  }

  if (opts.crumb && entry.folder) renderBreadcrumb(row, entry.folder, opts.crumb);
  return row;
}

export function renderEmpty(parent: HTMLElement, icon: string, title: string, hint?: string): void {
  const box = parent.createDiv({ cls: 'dovela-bl-empty' });
  box.createDiv({ cls: 'dovela-bl-empty-icon', text: icon });
  box.createDiv({ cls: 'dovela-bl-empty-title', text: title });
  if (hint) box.createDiv({ cls: 'dovela-muted', text: hint });
}
