/**
 * Registro de tiempo como eventos append-only (02 §2).
 * Cada dispositivo escribe SOLO su archivo `YYYY-MM · <dispositivo>.md`; la lectura une todos.
 * Formato: frontmatter + bloque ```dovela-tiempo con un evento JSON por línea.
 */

export type LogKind = 'timer' | 'manual' | 'pomodoro' | 'import';
export type PomodoroPhase = 'work' | 'shortBreak' | 'longBreak';

interface Base {
  /** Identificador de la sesión/registro (estable entre ediciones). */
  readonly id: string;
  /** Instante de esta versión del evento (epoch ms). Decide el ganador entre versiones. */
  readonly u: number;
  /** Dispositivo que escribió el evento (desempate). */
  readonly dev: string;
}

/** Registro cerrado (o su borrado lógico con `x: 1`). */
export interface LogEvent extends Base {
  readonly t: 'log';
  readonly a: string; // inicio ISO UTC
  readonly b: string; // fin ISO UTC
  readonly p: string; // ruta de la nota
  readonly d?: string; // descripción (texto de la tarea o nombre de la nota)
  readonly n?: string; // notas
  readonly k: LogKind;
  readonly l?: number; // línea de la tarea al iniciar
  readonly i?: string; // 🆔 de la tarea
  readonly pl?: number; // pomodoro: minutos planificados
  readonly ot?: number; // pomodoro: minutos de overtime
  readonly cy?: number; // pomodoro: número de ciclo
  readonly x?: 1; // borrado lógico
  readonly bad?: 1; // importado con datos incoherentes (fin < inicio)
  readonly legacyId?: string;
  readonly legacyMinutes?: number; // duración guardada en v1 si difería
}

/** Sesión en curso (temporizador o Pomodoro). Una versión posterior con el mismo id la edita. */
export interface LiveEvent extends Base {
  readonly t: 'live';
  readonly k: 'timer' | 'pomodoro';
  readonly a: string; // inicio ISO UTC
  readonly p: string;
  readonly d?: string;
  readonly n?: string;
  readonly l?: number;
  readonly i?: string;
  /** Línea original de la tarea (para cerrarla con seguridad al terminar). */
  readonly raw?: string;
  readonly ph?: PomodoroPhase; // fase del pomodoro
  readonly pl?: number; // minutos planificados de la fase
  readonly cy?: number; // ciclos completados en la sesión
  readonly ota?: string; // ISO de inicio del overtime
}

/** Sesión en curso descartada sin registro. */
export interface CancelEvent extends Base {
  readonly t: 'cancel';
}

export type TimeEvent = LogEvent | LiveEvent | CancelEvent;

export const FENCE_LANG = 'dovela-tiempo';

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

function isStr(v: unknown): v is string {
  return typeof v === 'string';
}

/** Valida y normaliza un objeto como evento; null si no es válido. */
export function asEvent(v: unknown): TimeEvent | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (!isStr(o['id']) || !o['id'] || typeof o['u'] !== 'number' || !isStr(o['dev'])) return null;
  switch (o['t']) {
    case 'log':
      if (!isStr(o['a']) || !isStr(o['b']) || !isStr(o['p']) || !ISO_RE.test(o['a']) || !ISO_RE.test(o['b'])) return null;
      if (!['timer', 'manual', 'pomodoro', 'import'].includes(String(o['k']))) return null;
      return o as unknown as LogEvent;
    case 'live':
      if (!isStr(o['a']) || !isStr(o['p']) || !ISO_RE.test(o['a'])) return null;
      if (o['k'] !== 'timer' && o['k'] !== 'pomodoro') return null;
      return o as unknown as LiveEvent;
    case 'cancel':
      return o as unknown as CancelEvent;
    default:
      return null;
  }
}

/** Serializa un evento en una línea (claves en orden estable, sin `undefined`). */
export function serializeEvent(e: TimeEvent): string {
  return JSON.stringify(e, (_k, v: unknown) => (v === undefined ? undefined : v));
}

export interface ParsedLogFile {
  readonly events: TimeEvent[];
  /** Líneas dentro del bloque que no son eventos válidos (se conservan, se informan). */
  readonly invalidLines: number;
}

/** Extrae los eventos de todos los bloques ```dovela-tiempo de un archivo. */
export function parseLogFile(content: string): ParsedLogFile {
  const events: TimeEvent[] = [];
  let invalidLines = 0;
  let inside = false;
  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/\r$/, '').trim();
    if (!inside) {
      if (line === '```' + FENCE_LANG) inside = true;
      continue;
    }
    if (line.startsWith('```')) {
      inside = false;
      continue;
    }
    if (!line) continue;
    try {
      const ev = asEvent(JSON.parse(line));
      if (ev) events.push(ev);
      else invalidLines++;
    } catch {
      invalidLines++;
    }
  }
  return { events, invalidLines };
}

export function logFileName(month: string, device: string): string {
  return `${month} · ${device}.md`;
}

/** `2026-11 · abc123.md` → { month, device }. */
export function parseLogFileName(name: string): { month: string; device: string } | null {
  const m = /^(\d{4}-\d{2}) · ([^/]+)\.md$/.exec(name);
  return m && m[1] && m[2] ? { month: m[1], device: m[2] } : null;
}

export function newLogFileContent(month: string, device: string): string {
  return [
    '---',
    'type: RT',
    `dispositivo: ${device}`,
    `mes: ${month}`,
    '---',
    '',
    '> Registro de tiempo de Dovela. Cada línea del bloque es un evento; no la edites a mano.',
    '> Este archivo solo lo escribe el dispositivo indicado arriba.',
    '',
    '```' + FENCE_LANG,
    '```',
    '',
  ].join('\n');
}

/** Inserta líneas de evento antes del cierre del ÚLTIMO bloque; si no hay bloque, lo crea al final. */
export function appendEvents(content: string, events: readonly TimeEvent[]): string {
  const lines = events.map(serializeEvent);
  const all = content.split('\n');
  let open = -1;
  let close = -1;
  for (let i = 0; i < all.length; i++) {
    const l = (all[i] ?? '').trim();
    if (l === '```' + FENCE_LANG) {
      open = i;
      close = -1;
    } else if (open >= 0 && close < 0 && l.startsWith('```')) close = i;
  }
  if (open >= 0 && close > open) {
    all.splice(close, 0, ...lines);
    return all.join('\n');
  }
  const base = content.endsWith('\n') || content === '' ? content : `${content}\n`;
  return `${base}\n\`\`\`${FENCE_LANG}\n${lines.join('\n')}\n\`\`\`\n`;
}

/** Identificador ordenable por tiempo: base36 del instante + aleatorio. */
export function newEventId(nowMs: number, random: () => number = Math.random): string {
  let r = '';
  for (let i = 0; i < 6; i++) r += Math.floor(random() * 36).toString(36);
  return `${nowMs.toString(36).padStart(9, "0")}${r}`;
}
