/**
 * Fusión de eventos de todos los dispositivos → estado actual.
 * Regla (02 §2): por `id`, gana la versión con mayor `u` (desempate: `dev` mayor).
 * Un cierre (`log` o `cancel`) es TERMINAL: ninguna versión `live` posterior reabre la sesión.
 * La función es conmutativa, asociativa e idempotente (el orden de lectura no importa).
 */
import type { CancelEvent, LiveEvent, LogEvent, LogKind, TimeEvent } from './events';

export interface TimeLog {
  readonly id: string;
  readonly start: number; // epoch ms
  readonly end: number;
  readonly path: string;
  readonly desc: string;
  readonly notes: string;
  readonly kind: LogKind;
  readonly line?: number;
  readonly taskId?: string;
  readonly plannedMin?: number;
  readonly overtimeMin?: number;
  readonly cycle?: number;
  readonly dev: string;
  readonly bad: boolean;
  readonly legacyId?: string;
}

export interface LiveSession {
  readonly id: string;
  readonly kind: 'timer' | 'pomodoro';
  readonly start: number;
  readonly path: string;
  readonly desc: string;
  readonly notes: string;
  readonly line?: number;
  readonly taskId?: string;
  readonly raw?: string;
  readonly phase?: 'work' | 'shortBreak' | 'longBreak';
  readonly plannedMin?: number;
  readonly cycles?: number;
  readonly overtimeStart?: number;
  readonly dev: string;
  /** Versión (`u`) del evento vigente: para editar se escribe una versión mayor. */
  readonly u: number;
}

export interface TimeState {
  readonly logs: ReadonlyMap<string, TimeLog>;
  readonly live: readonly LiveSession[];
}

function newer(a: TimeEvent, b: TimeEvent): boolean {
  return a.u !== b.u ? a.u > b.u : a.dev > b.dev;
}

const isClosing = (e: TimeEvent): e is LogEvent | CancelEvent => e.t === 'log' || e.t === 'cancel';

export function toTimeLog(e: LogEvent): TimeLog {
  return {
    id: e.id,
    start: Date.parse(e.a),
    end: Date.parse(e.b),
    path: e.p,
    desc: e.d ?? '',
    notes: e.n ?? '',
    kind: e.k,
    ...(e.l !== undefined ? { line: e.l } : {}),
    ...(e.i ? { taskId: e.i } : {}),
    ...(e.pl !== undefined ? { plannedMin: e.pl } : {}),
    ...(e.ot !== undefined ? { overtimeMin: e.ot } : {}),
    ...(e.cy !== undefined ? { cycle: e.cy } : {}),
    dev: e.dev,
    bad: e.bad === 1 || Date.parse(e.b) < Date.parse(e.a),
    ...(e.legacyId ? { legacyId: e.legacyId } : {}),
  };
}

export function toLiveSession(e: LiveEvent): LiveSession {
  return {
    id: e.id,
    kind: e.k,
    start: Date.parse(e.a),
    path: e.p,
    desc: e.d ?? '',
    notes: e.n ?? '',
    ...(e.l !== undefined ? { line: e.l } : {}),
    ...(e.i ? { taskId: e.i } : {}),
    ...(e.raw ? { raw: e.raw } : {}),
    ...(e.ph ? { phase: e.ph } : {}),
    ...(e.pl !== undefined ? { plannedMin: e.pl } : {}),
    ...(e.cy !== undefined ? { cycles: e.cy } : {}),
    ...(e.ota ? { overtimeStart: Date.parse(e.ota) } : {}),
    dev: e.dev,
    u: e.u,
  };
}

/** Versión ganadora de cada id. */
export function winners(events: Iterable<TimeEvent>): Map<string, TimeEvent> {
  const closing = new Map<string, TimeEvent>();
  const live = new Map<string, TimeEvent>();
  for (const e of events) {
    const map = isClosing(e) ? closing : live;
    const cur = map.get(e.id);
    if (!cur || newer(e, cur)) map.set(e.id, e);
  }
  const out = new Map<string, TimeEvent>(live);
  for (const [id, e] of closing) out.set(id, e); // el cierre domina
  return out;
}

export function foldEvents(events: Iterable<TimeEvent>): TimeState {
  const logs = new Map<string, TimeLog>();
  const live: LiveSession[] = [];
  for (const e of winners(events).values()) {
    if (e.t === 'log') {
      if (!e.x) logs.set(e.id, toTimeLog(e));
    } else if (e.t === 'live') live.push(toLiveSession(e));
  }
  live.sort((a, b) => a.start - b.start);
  return { logs, live };
}

export function durationMinutes(log: Pick<TimeLog, 'start' | 'end'>): number {
  return Math.max(0, Math.floor((log.end - log.start) / 60000));
}

/** ¿La sesión en vivo lleva demasiado tiempo abierta (posible olvido u otro dispositivo apagado)? */
export function isStale(s: LiveSession, nowMs: number, staleHours: number): boolean {
  return nowMs - s.start > staleHours * 3_600_000;
}
