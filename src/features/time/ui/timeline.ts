/**
 * Pestaña Cronograma: registros de tiempo en columnas por día (día / 3 días / semana), zoom 1x–4x,
 * línea de “ahora”, sesión en curso, color por carpeta raíz, tooltip y popover de calendario con mapa
 * de calor. Interacción con Pointer Events (ratón y táctil):
 * - arrastrar un bloque → mover (ajuste a 5 min, también a otro día); con Alt (escritorio) o tras
 *   pulsación larga (móvil) → duplicar;
 * - asa inferior → redimensionar;
 * - arrastrar en vacío (escritorio) o pulsación larga + arrastrar (móvil) → crear (abre el modal manual);
 * - clic/toque en un bloque → editar.
 */
import { Notice } from 'obsidian';
import { colorFromString } from '../../../core/color';
import { formatMinutesOfDay, localInstant, toLocalHm, toLocalYmd, weekdayNameEs } from '../../../core/dates';
import { formatDuration } from '../../../core/duration';
import { heatLevel, longDateEs, noteName, rangeTextEs } from '../../../core/time/display';
import { durationMinutes } from '../../../core/time/merge';
import { dailyTotals } from '../../../core/time/stats';
import { blocksForDay, snapMinutes, type DayBlock } from '../../../core/time/timeline';
import {
  blockSizeClass, clampZoom, createInterval, hourHeight, minutesToY, moveInterval, nowMinutes, resizeInterval,
  rootFolder, shiftTimeline, visibleDays, yToMinutes, ZOOM_STEP, type TimelineMode,
} from '../../../core/time/timelineMath';
import { logger } from '../../../host/logger';
import { renderMonthGrid } from '../../../ui/MonthGrid';
import { vibrate } from './alerts';
import type { TimeUi } from './controller';
import { isVisible, Refresher } from './refresher';

const MODE_KEY = 'time.timeline.mode';
const ZOOM_KEY = 'time.timeline.zoom';
const LONG_PRESS_MS = 450;
const DRAG_THRESHOLD_PX = 5;

const MODES: ReadonlyArray<{ id: TimelineMode; label: string }> = [
  { id: 'day', label: 'Día' },
  { id: '3day', label: '3 días' },
  { id: 'week', label: 'Semana' },
];

interface ColInfo {
  readonly day: string;
  readonly el: HTMLElement;
  rect: DOMRect;
}

interface Drag {
  readonly kind: 'move' | 'resize' | 'create';
  readonly pointerId: number;
  readonly touch: boolean;
  readonly x0: number;
  readonly y0: number;
  readonly day: string;
  readonly col: HTMLElement;
  readonly downMin: number;
  readonly block?: DayBlock;
  readonly blockEl?: HTMLElement;
  readonly cols: ColInfo[];
  started: boolean;
  copy: boolean;
  armed: boolean;
  timer: number;
  ghost?: HTMLElement;
  target?: { day: string; min: number };
  captured?: HTMLElement;
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function mountTimeline(root: HTMLElement, ui: TimeUi): () => void {
  const ctx = ui.ctx;
  const svc = ui.service;
  const savedMode = ctx.cache.get<unknown>(MODE_KEY, 'day');
  let mode: TimelineMode = MODES.some((m) => m.id === savedMode) ? (savedMode as TimelineMode) : 'day';
  let zoom = clampZoom(Number(ctx.cache.get<unknown>(ZOOM_KEY, 1.5)));
  let anchor = ctx.today();
  let colH = hourHeight(zoom) * 24;
  let firstScroll = true;
  let pendingRatio: number | null = null;
  let drag: Drag | null = null;
  let popover: HTMLElement | null = null;
  let hoverId = '';
  let nowLines: Array<{ day: string; el: HTMLElement }> = [];
  let liveEls: Array<{ day: string; el: HTMLElement; start: number }> = [];
  const blockOf = new WeakMap<HTMLElement, DayBlock>();
  const ac = new AbortController();
  const signal = ac.signal;

  root.addClass('dovela-tl');
  const header = root.createDiv({ cls: 'dovela-tl-header' });
  const scroller = root.createDiv({ cls: 'dovela-tl-scroll' });

  // ───── Cabecera ─────
  const closePopover = (): void => {
    popover?.remove();
    popover = null;
  };

  const openPopover = (): void => {
    closePopover();
    const pop = root.createDiv({ cls: 'dovela-tl-popover' });
    popover = pop;
    let month = anchor;
    const heat = dailyTotals(svc.logs().filter((l) => !l.bad));
    const draw = (): void => {
      pop.empty();
      renderMonthGrid(pop, {
        month,
        today: ctx.today(),
        selected: anchor,
        heat: (d) => heatLevel(heat.get(d) ?? 0),
        onPick: (d) => {
          anchor = d;
          closePopover();
          render();
        },
        onMonthChange: (m) => {
          month = m;
          draw();
        },
      });
      pop.createDiv({ cls: 'dovela-muted', text: 'Color: minutos registrados (< 2 h, < 5 h, ≥ 5 h).' });
    };
    draw();
  };

  const renderHeader = (days: readonly string[]): void => {
    header.empty();
    const nav = header.createDiv({ cls: 'dovela-tl-nav' });
    const prev = nav.createEl('button', { text: '◀', attr: { 'aria-label': 'Anterior' } });
    const today = nav.createEl('button', { text: 'Hoy' });
    const next = nav.createEl('button', { text: '▶', attr: { 'aria-label': 'Siguiente' } });
    prev.addEventListener('click', () => { anchor = shiftTimeline(mode, anchor, -1); render(); });
    next.addEventListener('click', () => { anchor = shiftTimeline(mode, anchor, 1); render(); });
    today.addEventListener('click', () => { anchor = ctx.today(); firstScroll = true; render(); });
    const first = days[0] ?? anchor;
    const last = days[days.length - 1] ?? anchor;
    const title = nav.createEl('button', {
      cls: 'dovela-tl-title',
      text: `${days.length === 1 ? cap(longDateEs(first)) : rangeTextEs(first, last)} ▾`,
      attr: { 'aria-label': 'Elegir fecha' },
    });
    title.addEventListener('click', () => (popover ? closePopover() : openPopover()));

    const tools = header.createDiv({ cls: 'dovela-tl-tools' });
    const modes = tools.createDiv({ cls: 'dovela-tl-modes' });
    for (const m of MODES) {
      const b = modes.createEl('button', { cls: 'dovela-time-chip', text: m.label });
      if (m.id === mode) b.addClass('is-active');
      b.addEventListener('click', () => {
        mode = m.id;
        ctx.cache.set(MODE_KEY, mode);
        render();
      });
    }
    const zoomEl = tools.createDiv({ cls: 'dovela-tl-zoom' });
    const minus = zoomEl.createEl('button', { text: '−', attr: { 'aria-label': 'Alejar' } });
    zoomEl.createSpan({ cls: 'dovela-tl-zoom-label', text: `${Math.round(zoom * 100)}%` });
    const plus = zoomEl.createEl('button', { text: '+', attr: { 'aria-label': 'Acercar' } });
    const setZoom = (z: number): void => {
      const nz = clampZoom(z);
      if (nz === zoom) return;
      pendingRatio = (scroller.scrollTop + scroller.clientHeight / 2) / colH;
      zoom = nz;
      ctx.cache.set(ZOOM_KEY, zoom);
      render();
    };
    minus.disabled = zoom <= 1;
    plus.disabled = zoom >= 4;
    minus.addEventListener('click', () => setZoom(zoom - ZOOM_STEP));
    plus.addEventListener('click', () => setZoom(zoom + ZOOM_STEP));
  };

  // ───── Rejilla ─────
  const tooltip = (b: DayBlock): string => {
    const l = b.log;
    const start = new Date(l.start);
    const end = new Date(l.end);
    const multi = toLocalYmd(start) !== toLocalYmd(end);
    return [
      noteName(l.path),
      l.desc && l.desc !== noteName(l.path) ? `📌 ${l.desc}` : '',
      `⏱️ ${formatDuration(durationMinutes(l))}`,
      `🕒 ${multi ? `${toLocalYmd(start)} ` : ''}${toLocalHm(start)} → ${multi ? `${toLocalYmd(end)} ` : ''}${toLocalHm(end)}`,
      l.notes ? `📝 ${l.notes}` : '',
    ].filter(Boolean).join('\n');
  };

  const renderBlock = (col: HTMLElement, b: DayBlock): void => {
    const top = minutesToY(b.startMin, colH);
    const hpx = Math.max(minutesToY(b.endMin - b.startMin, colH), 6);
    const el = col.createDiv({ cls: `dovela-tl-block ${blockSizeClass(hpx)}` });
    const width = 100 / b.columns;
    el.style.top = `${top}px`;
    el.style.height = `${hpx}px`;
    el.style.left = `calc(${b.column * width}% + 1px)`;
    el.style.width = `calc(${width}% - 2px)`;
    el.style.setProperty('--dovela-block-color', colorFromString(rootFolder(b.log.path)));
    el.dataset['logId'] = b.log.id;
    if (b.continuesBefore) el.addClass('is-cont-before');
    if (b.continuesAfter) el.addClass('is-cont-after');
    if (b.log.kind === 'pomodoro') el.addClass('is-pomodoro');
    const name = noteName(b.log.path);
    el.createDiv({ cls: 'dovela-tl-block-title', text: `${b.log.kind === 'pomodoro' ? '🍅 ' : ''}${name}` });
    if (b.log.desc && b.log.desc !== name) el.createDiv({ cls: 'dovela-tl-block-task', text: b.log.desc });
    el.createDiv({ cls: 'dovela-tl-block-dur', text: formatDuration(durationMinutes(b.log)) });
    if (b.log.notes) el.createDiv({ cls: 'dovela-tl-block-notes', text: b.log.notes });
    el.setAttr('aria-label', tooltip(b));
    el.setAttr('data-tooltip-position', 'right');
    if (!b.continuesAfter) el.createDiv({ cls: 'dovela-tl-resize', attr: { 'aria-label': 'Redimensionar' } });
    blockOf.set(el, b);
  };

  const renderLive = (col: HTMLElement, day: string, now: number): void => {
    const s = svc.current();
    if (!s) return;
    const dayStart = localInstant(day).getTime();
    const dayEnd = dayStart + 86_400_000;
    const a = Math.max(s.start, dayStart);
    const b = Math.min(now, dayEnd);
    if (b <= a) return;
    const el = col.createDiv({ cls: 'dovela-tl-block is-live' });
    el.style.top = `${minutesToY((a - dayStart) / 60_000, colH)}px`;
    el.style.height = `${Math.max(minutesToY((b - a) / 60_000, colH), 6)}px`;
    el.style.setProperty('--dovela-block-color', colorFromString(rootFolder(s.path)));
    el.createDiv({ cls: 'dovela-tl-block-title', text: `${s.kind === 'pomodoro' ? '🍅' : '⏱️'} En curso · ${noteName(s.path) || 'Descanso'}` });
    el.setAttr('aria-label', `Sesión en curso desde ${toLocalHm(new Date(s.start))}`);
    liveEls.push({ day, el, start: a });
  };

  const render = (): void => {
    if (drag) return;
    const days = visibleDays(mode, anchor);
    renderHeader(days);
    const prevTop = scroller.scrollTop;
    scroller.empty();
    nowLines = [];
    liveEls = [];
    hoverId = '';
    const H = hourHeight(zoom);
    colH = H * 24;
    root.style.setProperty('--dovela-tl-hour', `${H}px`);
    root.toggleClass('is-multi', days.length > 1);
    root.toggleClass('is-week', days.length === 7);
    const now = ui.now();
    const today = ctx.today();

    const headRow = scroller.createDiv({ cls: 'dovela-tl-days' });
    headRow.createDiv({ cls: 'dovela-tl-gutter-head' });
    for (const d of days) {
      const h = headRow.createDiv({ cls: 'dovela-tl-dayhead', text: `${cap(weekdayNameEs(d).slice(0, 3))} ${Number(d.slice(8, 10))}` });
      if (d === today) h.addClass('is-today');
      if (days.length > 1) {
        h.addClass('is-clickable');
        h.setAttr('aria-label', 'Ver solo este día');
        h.addEventListener('click', () => {
          mode = 'day';
          anchor = d;
          ctx.cache.set(MODE_KEY, mode);
          render();
        });
      }
    }
    const grid = scroller.createDiv({ cls: 'dovela-tl-grid' });
    const gutter = grid.createDiv({ cls: 'dovela-tl-gutter' });
    gutter.style.height = `${colH}px`;
    for (let h = 0; h < 24; h++) {
      const lab = gutter.createDiv({ cls: 'dovela-tl-hour-label', text: `${String(h).padStart(2, '0')}:00` });
      lab.style.top = `${h * H}px`;
    }
    const logs = svc.logs().filter((l) => !l.bad);
    for (const d of days) {
      const col = grid.createDiv({ cls: 'dovela-tl-col' });
      col.dataset['day'] = d;
      col.style.height = `${colH}px`;
      if (d === today) col.addClass('is-today');
      for (const b of blocksForDay(logs, d)) renderBlock(col, b);
      renderLive(col, d, now);
      const nm = nowMinutes(now, d);
      if (nm !== null) {
        const line = col.createDiv({ cls: 'dovela-tl-now' });
        line.style.top = `${minutesToY(nm, colH)}px`;
        nowLines.push({ day: d, el: line });
      }
    }
    if (pendingRatio !== null) {
      scroller.scrollTop = Math.max(0, pendingRatio * colH - scroller.clientHeight / 2);
      pendingRatio = null;
    } else if (firstScroll) {
      const target = nowMinutes(now, today) ?? 8 * 60;
      scroller.scrollTop = Math.max(0, minutesToY(target, colH) - scroller.clientHeight / 3);
      firstScroll = false;
    } else scroller.scrollTop = prevTop;
  };

  // ───── Interacción ─────
  const columns = (): ColInfo[] => [...scroller.querySelectorAll<HTMLElement>('.dovela-tl-col')].map((el) => ({
    day: el.dataset['day'] ?? '', el, rect: el.getBoundingClientRect(),
  }));

  const refresher = new Refresher(root, render);

  const finishDrag = (): void => {
    const d = drag;
    if (!d) return;
    window.clearTimeout(d.timer);
    if (d.kind === 'move') d.ghost?.remove();
    if (d.kind === 'create') d.ghost?.remove();
    d.blockEl?.removeClass('is-dragging', 'is-copy');
    if (d.captured) {
      try {
        d.captured.releasePointerCapture(d.pointerId);
      } catch {
        // El elemento ya no tiene la captura.
      }
    }
    drag = null;
    refresher.paused = false;
    if (d.started) refresher.invalidate();
    refresher.flush();
  };

  const capture = (d: Drag, el: HTMLElement): void => {
    try {
      el.setPointerCapture(d.pointerId);
      d.captured = el;
    } catch {
      // Puntero ya liberado.
    }
  };

  const startVisual = (d: Drag): void => {
    if (d.kind === 'move' && d.blockEl) {
      const ghost = d.blockEl.cloneNode(true) as HTMLElement;
      ghost.addClass('is-ghost');
      ghost.removeClass('is-dragging');
      d.blockEl.parentElement?.appendChild(ghost);
      d.blockEl.addClass('is-dragging');
      d.ghost = ghost;
    } else if (d.kind === 'resize' && d.blockEl) {
      d.ghost = d.blockEl;
    } else if (d.kind === 'create') {
      d.ghost = d.col.createDiv({ cls: 'dovela-tl-block is-preview' });
    }
  };

  const update = (d: Drag, x: number, y: number): void => {
    const g = d.ghost;
    if (!g) return;
    for (const c of d.cols) c.rect = c.el.getBoundingClientRect();
    const origin = d.cols.find((c) => c.el === d.col) ?? d.cols[0];
    if (!origin) return;
    const height = origin.rect.height;
    if (d.kind === 'move' && d.block) {
      const first = d.cols[0];
      const last = d.cols[d.cols.length - 1];
      let target = d.cols.find((c) => x >= c.rect.left && x <= c.rect.right);
      if (!target) target = first && x < first.rect.left ? first : last;
      if (!target) return;
      const cur = yToMinutes(y - target.rect.top, height);
      const segLen = d.block.endMin - d.block.startMin;
      const startMin = Math.max(0, Math.min(1440 - Math.max(5, Math.min(segLen, 1440)), snapMinutes(d.block.startMin + (cur - d.downMin))));
      if (g.parentElement !== target.el) target.el.appendChild(g);
      g.style.top = `${minutesToY(startMin, colH)}px`;
      g.style.left = '1px';
      g.style.width = 'calc(100% - 2px)';
      g.setAttr('data-time', `${d.copy ? '⧉ ' : ''}${formatMinutesOfDay(startMin)}`);
      d.target = { day: target.day, min: startMin };
    } else if (d.kind === 'resize' && d.block) {
      const cur = yToMinutes(y - origin.rect.top, height);
      const endMin = Math.max(snapMinutes(cur), d.block.startMin + 5);
      g.style.height = `${minutesToY(endMin - d.block.startMin, colH)}px`;
      g.setAttr('data-time', formatMinutesOfDay(endMin));
      d.target = { day: d.day, min: endMin };
    } else if (d.kind === 'create') {
      const cur = yToMinutes(y - origin.rect.top, height);
      const lo = snapMinutes(Math.min(cur, d.downMin));
      const hi = snapMinutes(Math.max(cur, d.downMin));
      g.style.top = `${minutesToY(lo, colH)}px`;
      g.style.height = `${Math.max(minutesToY(hi - lo, colH), 2)}px`;
      g.setAttr('data-time', `${formatMinutesOfDay(lo)} – ${formatMinutesOfDay(hi)}`);
      d.target = { day: d.day, min: cur };
    }
    // Desplazamiento automático cerca de los bordes.
    const sr = scroller.getBoundingClientRect();
    if (y < sr.top + 24) scroller.scrollTop -= 12;
    else if (y > sr.bottom - 24) scroller.scrollTop += 12;
  };

  const onLongPress = (): void => {
    const d = drag;
    if (!d || d.started) return;
    if (d.kind === 'move') {
      d.copy = true;
      d.blockEl?.addClass('is-copy');
      vibrate(30);
    } else if (d.kind === 'create') {
      d.armed = true;
      vibrate(30);
      capture(d, d.col);
      d.started = true;
      startVisual(d);
      update(d, d.x0, d.y0);
    }
  };

  scroller.addEventListener('pointerdown', (e) => {
    if (drag) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (!t || t.closest('.dovela-tl-gutter, .dovela-tl-days')) return;
    const col = t.closest<HTMLElement>('.dovela-tl-col');
    if (!col) return;
    const blockEl = t.closest<HTMLElement>('.dovela-tl-block') ?? undefined;
    if (blockEl?.hasClass('is-live')) return;
    const block = blockEl ? blockOf.get(blockEl) : undefined;
    if (blockEl && !block) return;
    closePopover();
    const rect = col.getBoundingClientRect();
    const touch = e.pointerType !== 'mouse';
    const kind: Drag['kind'] = block ? (t.closest('.dovela-tl-resize') ? 'resize' : 'move') : 'create';
    const d: Drag = {
      kind, pointerId: e.pointerId, touch, x0: e.clientX, y0: e.clientY,
      day: col.dataset['day'] ?? '', col, downMin: yToMinutes(e.clientY - rect.top, rect.height),
      ...(block ? { block } : {}), ...(blockEl ? { blockEl } : {}),
      cols: columns(), started: false, copy: !touch && e.altKey, armed: !touch, timer: 0,
    };
    drag = d;
    refresher.paused = true;
    if (touch) d.timer = window.setTimeout(onLongPress, LONG_PRESS_MS);
    if (kind !== 'create' || !touch) {
      capture(d, blockEl ?? col);
      if (!touch) e.preventDefault();
    }
  }, { signal });

  scroller.addEventListener('pointermove', (e) => {
    const d = drag;
    if (!d || e.pointerId !== d.pointerId) return;
    const dist = Math.hypot(e.clientX - d.x0, e.clientY - d.y0);
    if (!d.started) {
      if (d.kind === 'create' && d.touch && !d.armed) {
        // Desplazamiento normal: no es una creación.
        if (dist > 8) finishDrag();
        return;
      }
      if (dist < DRAG_THRESHOLD_PX) return;
      window.clearTimeout(d.timer);
      d.started = true;
      startVisual(d);
    }
    e.preventDefault();
    if (e.altKey && !d.touch && d.kind === 'move') d.copy = true;
    update(d, e.clientX, e.clientY);
  }, { signal });

  scroller.addEventListener('pointerup', (e) => {
    const d = drag;
    if (!d || e.pointerId !== d.pointerId) return;
    finishDrag();
    if (!d.started) {
      if ((d.kind === 'move' || d.kind === 'resize') && d.block && !d.copy) ui.editLog(d.block.log);
      return;
    }
    void commit(d, e.altKey);
  }, { signal });

  scroller.addEventListener('pointercancel', (e) => {
    if (drag && e.pointerId === drag.pointerId) finishDrag();
  }, { signal });

  // Mientras se arrastra con el dedo, impedir que el contenedor se desplace.
  scroller.addEventListener('touchmove', (e) => {
    if (drag && (drag.started || (drag.kind !== 'create' && drag.touch))) e.preventDefault();
  }, { passive: false, signal });

  scroller.addEventListener('contextmenu', (e) => {
    if (e.target instanceof HTMLElement && e.target.closest('.dovela-tl-col')) e.preventDefault();
  }, { signal });

  scroller.addEventListener('pointerover', (e) => {
    const b = e.target instanceof HTMLElement ? e.target.closest<HTMLElement>('.dovela-tl-block') : null;
    const id = b?.dataset['logId'] ?? '';
    if (id === hoverId) return;
    const setHover = (logId: string, on: boolean): void => {
      if (!logId) return;
      scroller.querySelectorAll<HTMLElement>(`.dovela-tl-block[data-log-id="${CSS.escape(logId)}"]`).forEach((el) => el.toggleClass('is-hover', on));
    };
    setHover(hoverId, false);
    hoverId = id;
    setHover(id, true);
  }, { signal });

  const doc = root.ownerDocument;
  doc.addEventListener('pointerdown', (e) => {
    if (!popover) return;
    const t = e.target instanceof Node ? e.target : null;
    if (t && (popover.contains(t) || (t instanceof HTMLElement && t.closest('.dovela-tl-title')))) return;
    closePopover();
  }, { signal, capture: true });
  doc.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (drag) {
      const d = drag;
      d.started = false;
      finishDrag();
      refresher.invalidate();
    }
    closePopover();
  }, { signal });

  const commit = async (d: Drag, altAtDrop: boolean): Promise<void> => {
    try {
      if (!d.target) return;
      if (d.kind === 'move' && d.block) {
        const log = d.block.log;
        const segStart = d.block.continuesBefore ? localInstant(d.day).getTime() : log.start;
        const iv = moveInterval(log, segStart, d.target.day, d.target.min);
        const copy = d.copy || (!d.touch && altAtDrop);
        if (!copy && iv.start === log.start) return;
        const ok = await svc.updateLog(log, { start: iv.start, end: iv.end }, copy);
        if (ok && copy) new Notice('Dovela: registro duplicado.');
      } else if (d.kind === 'resize' && d.block) {
        const log = d.block.log;
        const iv = resizeInterval(log, d.day, d.target.min);
        if (iv.end !== log.end) await svc.updateLog(log, { end: iv.end });
      } else if (d.kind === 'create') {
        const iv = createInterval(d.day, d.downMin, d.target.min);
        if (iv) ui.openManual({ start: iv.start, end: iv.end });
      }
    } catch (e) {
      logger.error('No se pudo aplicar el cambio en el Cronograma', e);
      new Notice('Dovela: no se pudo guardar el cambio.');
    } finally {
      refresher.invalidate();
    }
  };

  // ───── Reactividad ─────
  const offs: Array<() => void> = [];
  offs.push(svc.onChange(() => refresher.invalidate()));
  offs.push(ui.onTick((now) => {
    if (!isVisible(root) || drag) return;
    for (const nl of nowLines) {
      const m = nowMinutes(now, nl.day);
      if (m === null) refresher.invalidate();
      else nl.el.style.top = `${minutesToY(m, colH)}px`;
    }
    for (const lv of liveEls) {
      const dayEnd = localInstant(lv.day).getTime() + 86_400_000;
      const end = Math.min(now, dayEnd);
      lv.el.style.height = `${Math.max(minutesToY((end - lv.start) / 60_000, colH), 6)}px`;
    }
    refresher.flush();
  }));
  svc.ready().then(() => refresher.invalidate()).catch(() => undefined);

  render();

  return () => {
    ac.abort();
    offs.forEach((f) => f());
    refresher.dispose();
    if (drag) window.clearTimeout(drag.timer);
    drag = null;
    closePopover();
    root.empty();
  };
}
