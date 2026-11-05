/**
 * Lógica pura de los formularios de tiempo (registro/detención/edición): fecha y hora LOCALES
 * separadas para inicio y fin (permite cruzar medianoche, v1 no lo permitía), validación y
 * conservación de los segundos del instante original si el usuario no tocó el campo.
 */
import { formatDuration } from '../duration';
import { localInstant, parseYmd, toLocalHm, toLocalYmd } from '../dates';

export interface LocalParts {
  readonly date: string; // YYYY-MM-DD
  readonly time: string; // HH:mm
}

export function splitLocal(ms: number): LocalParts {
  const d = new Date(ms);
  return { date: toLocalYmd(d), time: toLocalHm(d) };
}

/** Instante de una fecha y hora locales; null si alguno no es válido. */
export function joinLocal(date: string, time: string): number | null {
  if (!parseYmd(date)) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(time.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return localInstant(date, h * 60 + min).getTime();
}

/**
 * Instante resultante de un par de campos: si siguen mostrando lo mismo que el instante original,
 * se conserva el original (con segundos) para no introducir el sesgo de hasta 59 s de v1.
 */
export function resolveField(original: number | undefined, date: string, time: string): number | null {
  if (original !== undefined) {
    const p = splitLocal(original);
    if (p.date === date && p.time === time.slice(0, 5)) return original;
  }
  return joinLocal(date, time);
}

export interface RangeCheck {
  readonly ok: boolean;
  readonly error?: string;
  readonly warning?: string;
  /** Duración legible (`1 h 5 min`). */
  readonly duration?: string;
}

/** Valida un intervalo de registro. `now` permite avisar de un fin en el futuro. */
export function checkRange(start: number | null, end: number | null, now?: number): RangeCheck {
  if (start === null) return { ok: false, error: 'Fecha u hora de inicio no válida.' };
  if (end === null) return { ok: false, error: 'Fecha u hora de fin no válida.' };
  if (end < start) {
    const sameDayHint = toLocalYmd(new Date(start)) === toLocalYmd(new Date(end))
      ? ' Si terminó al día siguiente, cambia la fecha de fin.' : '';
    return { ok: false, error: `La hora de fin es anterior a la de inicio.${sameDayHint}` };
  }
  const minutes = Math.floor((end - start) / 60_000);
  const duration = formatDuration(minutes);
  const warnings: string[] = [];
  if (minutes > 16 * 60) warnings.push('Más de 16 horas: ¿es correcto?');
  if (now !== undefined && end > now + 60_000) warnings.push('El fin está en el futuro.');
  return { ok: true, duration, ...(warnings.length ? { warning: warnings.join(' ') } : {}) };
}

/** Inicio de una sesión en curso: no puede estar en el futuro. */
export function checkLiveStart(start: number | null, now: number): RangeCheck {
  if (start === null) return { ok: false, error: 'Fecha u hora de inicio no válida.' };
  if (start > now) return { ok: false, error: 'La hora de inicio no puede estar en el futuro.' };
  return { ok: true, duration: formatDuration(Math.floor((now - start) / 60_000)) };
}
