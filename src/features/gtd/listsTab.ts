/** Pestaña "Listas GTD": secciones por lista, sublistas, Vencidas agrupadas y navegación rápida. */
import type { OverdueMode } from '../../core/gtd/classify';
import type { GtdSection, TaskGroup } from '../../core/gtd/viewmodel';
import { lazyDetails, renderChunked, type LazyDetails, type RowFactory } from './render';

export interface ListsEnv {
  readonly row: RowFactory;
  readonly overdueMode: OverdueMode;
  readonly onToggleOverdue: () => void;
  readonly isClosed: (anchor: string) => boolean;
  readonly setClosed: (anchor: string, closed: boolean) => void;
  readonly shown: Map<string, number>;
  /** Registro de anclas → elemento (sin `id` en el DOM: dos vistas pueden coexistir). */
  readonly anchors: Map<string, HTMLElement>;
  readonly sections: Map<string, LazyDetails>;
}

function groupTitle(parent: HTMLElement, icon: string, label: string, count: string, cls = 'dovela-gtd-group-title'): void {
  const title = parent.createDiv({ cls });
  title.createSpan({ cls: 'dovela-gtd-group-label', text: icon ? `${icon} ${label}` : label });
  title.createSpan({ cls: 'dovela-count', text: count });
}

function renderGroup(parent: HTMLElement, g: TaskGroup, env: ListsEnv, cls = 'dovela-gtd-group'): void {
  const el = parent.createDiv({ cls });
  env.anchors.set(g.anchor, el);
  groupTitle(el, g.icon, g.label, g.countLabel);
  renderChunked(el, g.tasks, g.anchor, env.shown, env.row);
}

function fillSection(body: HTMLElement, s: GtdSection, env: ListsEnv): void {
  if (s.flat) renderChunked(body, s.flat, s.anchor, env.shown, env.row);
  for (const g of s.groups ?? []) renderGroup(body, g, env);
  for (const p of s.overdue ?? []) {
    const el = body.createDiv({ cls: 'dovela-gtd-group dovela-gtd-overdue-primary' });
    env.anchors.set(p.anchor, el);
    groupTitle(el, '', p.label, String(p.count));
    for (const c of p.children) renderGroup(el, c, env, 'dovela-gtd-subgroup');
  }
}

export function renderSections(body: HTMLElement, sections: readonly GtdSection[], env: ListsEnv): void {
  env.anchors.clear();
  env.sections.clear();
  for (const s of sections) {
    const lazy = lazyDetails(
      body,
      `dovela-gtd-list dovela-gtd-list-${s.id}`,
      !env.isClosed(s.anchor),
      (b) => fillSection(b, s, env),
      (open) => env.setClosed(s.anchor, !open),
    );
    env.anchors.set(s.anchor, lazy.details);
    env.sections.set(s.anchor, lazy);
    const sum = lazy.summary;
    sum.addClass('dovela-gtd-list-title');
    sum.createSpan({ cls: 'dovela-gtd-list-name', text: `${s.icon} ${s.name}` });
    sum.createSpan({ cls: 'dovela-count', text: String(s.count) });
    if (s.id === 'overdue') {
      const dateFirst = env.overdueMode === 'date-first';
      const btn = sum.createEl('button', {
        cls: 'dovela-gtd-overdue-toggle',
        text: dateFirst ? '📅→📋' : '📋→📅',
        attr: { 'aria-label': dateFirst ? 'Agrupar vencidas por contexto primero' : 'Agrupar vencidas por fecha primero' },
      });
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        env.onToggleOverdue();
      });
    }
  }
}

/** Abre (y construye) la sección y desplaza hasta el ancla (sección o sublista). */
export function jumpTo(
  scroller: HTMLElement, header: HTMLElement, env: ListsEnv, sectionAnchor: string, anchor: string,
): void {
  const s = env.sections.get(sectionAnchor);
  if (s) {
    s.ensure();
    s.details.open = true;
  }
  const target = env.anchors.get(anchor) ?? env.anchors.get(sectionAnchor);
  if (!target) return;
  const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
    - header.offsetHeight - 6;
  scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

const SUBNAV_LABEL: Readonly<Record<string, string>> = {
  hopeToday: '🌟 Ojalá Hoy',
  nextActions: '📋 Contextos',
  assigned: '👥 Asignadas',
};

/** Navegación rápida (dos niveles) derivada de las mismas secciones que se pintan. */
export function renderNav(
  el: HTMLElement, sections: readonly GtdSection[], onJump: (sectionAnchor: string, anchor: string) => void,
): void {
  const main = el.createDiv({ cls: 'dovela-gtd-nav-main' });
  const link = (parent: HTMLElement, text: string, count: string, sectionAnchor: string, anchor: string): void => {
    const a = parent.createEl('a', { cls: 'dovela-gtd-nav-link', href: '#' });
    a.createSpan({ text });
    a.createSpan({ cls: 'dovela-count', text: count });
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      onJump(sectionAnchor, anchor);
    });
  };
  for (const s of sections) link(main, `${s.icon} ${s.name}`, String(s.count), s.anchor, s.anchor);
  for (const s of sections) {
    const label = SUBNAV_LABEL[s.id];
    if (!label || !s.groups?.length) continue;
    const d = el.createEl('details', { cls: 'dovela-gtd-subnav' });
    const sum = d.createEl('summary');
    sum.createSpan({ text: label });
    sum.createSpan({ cls: 'dovela-count', text: String(s.groups.length) });
    const items = d.createDiv({ cls: 'dovela-gtd-subnav-items' });
    for (const g of s.groups) link(items, g.icon ? `${g.icon} ${g.label}` : g.label, String(g.tasks.length), s.anchor, g.anchor);
  }
}
