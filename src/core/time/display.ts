/**
 * Textos y estados de presentación del tiempo (barra de estado, títulos de periodo, mapa de calor),
 * puros y testeables. La UI (`features/time/ui`) solo pinta lo que devuelven estas funciones.
 */
import { formatClock } from '../duration';
import { MONTHS_ES, parseYmd, weekdayNameEs } from '../dates';
import type { LiveSession } from './merge';
import {
  breakAfter, isExpired, overtimeSeconds, remainingSeconds, roundPosition, workLogFor, type PomodoroRun,
} from './pomodoro';
import type { DayRange, PeriodKind } from './stats';

/** Estado visible de una sesión en curso. */
export type SessionMode = 'timer' | 'work' | 'break' | 'overtime' | 'decide';

/** Equivalente puro de `TimeService.run` (planificado por defecto si el evento no lo trae). */
export function runOf(s: LiveSession, defaultWorkMin: number): PomodoroRun {
  return {
    phase: s.phase ?? 'work',
    start: s.start,
    plannedMin: s.plannedMin ?? defaultWorkMin,
    cycles: s.cycles ?? 0,
    ...(s.overtimeStart !== undefined ? { overtimeStart: s.overtimeStart } : {}),
  };
}

export function sessionMode(s: LiveSession, now: number, defaultWorkMin: number): SessionMode {
  if (s.kind === 'timer') return 'timer';
  const r = runOf(s, defaultWorkMin);
  if (r.overtimeStart !== undefined) return 'overtime';
  if (isExpired(r, now)) return 'decide';
  return r.phase === 'work' ? 'work' : 'break';
}

/** Nombre de la nota sin carpeta ni `.md` (v1 mostraba el nombre de la nota en la barra). */
export function noteName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/i, '');
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/** `HH:MM:SS` siempre con horas (cronómetro del temporizador). */
export function hms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export interface ClockInfo {
  readonly mode: SessionMode;
  /** Reloj a mostrar (`HH:MM:SS` temporizador, `MM:SS` restante Pomodoro, `+MM:SS` overtime). */
  readonly clock: string;
  /** Etiqueta del estado ("Temporizador", "Pomodoro 2 de 4", "Descanso corto"…). */
  readonly label: string;
}

export function clockInfo(s: LiveSession, now: number, defaultWorkMin: number, cyclesBeforeLong: number): ClockInfo {
  const mode = sessionMode(s, now, defaultWorkMin);
  if (mode === 'timer') return { mode, clock: hms((now - s.start) / 1000), label: 'Temporizador' };
  const r = runOf(s, defaultWorkMin);
  const round = roundPosition(r.cycles, cyclesBeforeLong);
  const phaseLabel = r.phase === 'work'
    ? `Pomodoro ${round.current} de ${round.of}`
    : r.phase === 'longBreak' ? 'Descanso largo' : 'Descanso corto';
  switch (mode) {
    case 'overtime':
      return { mode, clock: `+${formatClock(overtimeSeconds(r, now))}`, label: `${phaseLabel} · overtime` };
    case 'decide':
      return { mode, clock: '00:00', label: `${phaseLabel} · tiempo cumplido: decide cómo seguir` };
    default:
      return { mode, clock: formatClock(remainingSeconds(r, now)), label: phaseLabel };
  }
}

export interface StatusBarInfo {
  readonly text: string;
  readonly mode: SessionMode;
  readonly tooltip: string;
}

/**
 * Texto de la barra de estado (formato v1):
 * `⏱️ nota HH:MM:SS` · `🍅 nota MM:SS` · `☕ nota MM:SS` · `🔴 nota +MM:SS (overtime)` · `⏰ nota decidir`.
 */
export function statusBarInfo(
  s: LiveSession, now: number, defaultWorkMin: number, cyclesBeforeLong: number,
  extra: { stale?: boolean; concurrent?: number } = {},
): StatusBarInfo {
  const info = clockInfo(s, now, defaultWorkMin, cyclesBeforeLong);
  const name = truncate(noteName(s.path) || (s.phase && s.phase !== 'work' ? 'Descanso' : 'Sin nota'), 28);
  let text: string;
  switch (info.mode) {
    case 'timer': text = `⏱️ ${name} ${info.clock}`; break;
    case 'work': text = `🍅 ${name} ${info.clock}`; break;
    case 'break': text = `☕ ${name} ${info.clock}`; break;
    case 'overtime': text = `🔴 ${name} ${info.clock} (overtime)`; break;
    case 'decide': text = `⏰ ${name} decidir`; break;
  }
  if (extra.stale) text += ' ⚠️';
  if ((extra.concurrent ?? 1) > 1) text += ` (+${(extra.concurrent ?? 1) - 1})`;
  const tooltip = [
    info.label,
    s.desc && s.desc !== noteName(s.path) ? s.desc : '',
    s.path,
    info.mode === 'decide' ? 'Clic para decidir' : 'Clic para abrir Seguimiento',
  ].filter(Boolean).join('\n');
  return { text, mode: info.mode, tooltip };
}

export type ExpiredAction = 'auto' | 'modal' | 'notice';

/**
 * Qué hacer cuando una fase de Pomodoro llega a su fin:
 * - solo el dispositivo que inició la sesión decide (evita dos descansos si dos dispositivos la ven);
 * - auto‑inicio solo si la fase terminó hace poco (no al reabrir Obsidian horas después).
 */
export function expiredAction(
  phase: 'work' | 'shortBreak' | 'longBreak',
  opts: { autoStartBreaks: boolean; autoStartWork: boolean },
  msSinceEnd: number,
  isOwner: boolean,
): ExpiredAction {
  if (!isOwner) return 'notice';
  const recent = msSinceEnd < 2 * 60_000;
  if (recent && phase === 'work' && opts.autoStartBreaks) return 'auto';
  if (recent && phase !== 'work' && opts.autoStartWork) return 'auto';
  return 'modal';
}

export interface PomodoroEndPlan {
  /** Ciclos completados tras cerrar la fase (incluye el actual si se cumplió). */
  readonly completedCycles: number;
  readonly suggestedBreak: 'shortBreak' | 'longBreak';
  /** Posición del pomodoro que termina ("2 de 4"). */
  readonly round: { current: number; of: number };
  /** Se puede seguir en overtime (fase de trabajo cumplida y aún sin overtime). */
  readonly canOvertime: boolean;
  /** La fase de trabajo se completó (no se detuvo antes de tiempo). */
  readonly completed: boolean;
}

export function pomodoroEndPlan(r: PomodoroRun, now: number, cyclesBeforeLong: number): PomodoroEndPlan {
  const plan = workLogFor(r, now);
  const completedCycles = plan ? plan.cycle : r.cycles;
  return {
    completedCycles,
    suggestedBreak: breakAfter(completedCycles, cyclesBeforeLong),
    round: roundPosition(r.cycles, cyclesBeforeLong),
    canOvertime: r.phase === 'work' && isExpired(r, now),
    completed: plan ? plan.cycle > r.cycles : false,
  };
}

// ───────────── Periodos (Estadísticas) ─────────────

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** `lunes, 3 de noviembre de 2025`. */
export function longDateEs(day: string): string {
  const p = parseYmd(day);
  if (!p) return day;
  return `${weekdayNameEs(day)}, ${p.d} de ${MONTHS_ES[p.m - 1] ?? ''} de ${p.y}`;
}

/** `3 nov` (con año si `withYear`). */
export function shortDateEs(day: string, withYear = false): string {
  const p = parseYmd(day);
  if (!p) return day;
  return `${p.d} ${MONTHS_SHORT[p.m - 1] ?? ''}${withYear ? ` ${p.y}` : ''}`;
}

export function rangeTextEs(from: string, to: string): string {
  if (from === to) return shortDateEs(from, true);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${shortDateEs(from, !sameYear)} – ${shortDateEs(to, true)}`;
}

/** Título del periodo (botón central de Estadísticas). */
export function periodTitle(kind: PeriodKind, range: DayRange | null, today: string): string {
  if (!range) return 'Siempre';
  switch (kind) {
    case 'today':
    case 'day':
      return `${range.from === today ? 'Hoy · ' : ''}${cap(longDateEs(range.from))}`;
    case 'week':
      return `Semana: ${rangeTextEs(range.from, range.to)}`;
    case 'month': {
      const m = Number(range.from.slice(5, 7));
      return `${cap(MONTHS_ES[m - 1] ?? '')} ${range.from.slice(0, 4)}`;
    }
    case 'year':
      return `Año ${range.from.slice(0, 4)}`;
    case 'custom':
      return rangeTextEs(range.from, range.to);
    case 'all':
      return 'Siempre';
  }
}

/** Texto del rango para el nombre del archivo exportado (v1 `getFilterDateRangeText`). */
export function exportRangeText(kind: PeriodKind, range: DayRange | null, today: string): string {
  if (!range) return 'Siempre';
  switch (kind) {
    case 'today':
    case 'day':
      return range.from === today ? `Hoy ${range.from}` : range.from;
    case 'week':
      return `Semana del ${range.from}`;
    case 'month':
      return `${MONTHS_ES[Number(range.from.slice(5, 7)) - 1] ?? ''} ${range.from.slice(0, 4)}`;
    case 'year':
      return `Año ${range.from.slice(0, 4)}`;
    case 'custom':
      return `${range.from} a ${range.to}`;
    case 'all':
      return 'Siempre';
  }
}

/** Intensidad del mapa de calor por minutos del día (umbrales del Cronograma v1: 2 h y 5 h). */
export function heatLevel(minutes: number): 0 | 1 | 2 | 3 {
  if (!(minutes > 0)) return 0;
  if (minutes < 120) return 1;
  if (minutes < 300) return 2;
  return 3;
}

/** Porcentaje con un decimal sin dividir por cero. */
export function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}
