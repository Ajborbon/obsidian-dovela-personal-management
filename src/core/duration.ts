/** Duraciones en minutos: lectura de `[30min]`, `[2h]`, `[1.5h]`, `[1h30min]` y formato para mostrar. */

const UNIT_RE = /(\d+(?:[.,]\d+)?)\s*(horas|hora|hrs|hr|h|mins|min|m)(?![a-z])/giu;

/** Minutos de un texto de duración (sin corchetes). Null si no se reconoce. */
export function parseDurationMinutes(raw: string | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  let total = 0;
  let matched = '';
  for (const m of s.matchAll(UNIT_RE)) {
    const value = Number((m[1] ?? '0').replace(',', '.'));
    const unit = m[2] ?? '';
    total += unit.startsWith('h') ? value * 60 : value;
    matched += m[0];
  }
  // Solo es duración si todo el texto (sin espacios) son pares número+unidad.
  if (!matched || matched.replace(/\s+/g, '') !== s.replace(/\s+/g, '')) return null;
  return Math.round(total);
}

/**
 * Formato de v1 (`durationUtils.formatDuration`):
 * 0 → `< 1 min`, 59 → `59 min`, 60 → `1 h`, 61 → `1 h 1 min`; con `hhmm` → `02:05`.
 */
export function formatDuration(minutes: number, hhmm = false): string {
  const total = Math.max(0, Math.floor(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (hhmm) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  if (total < 1) return '< 1 min';
  if (total < 60) return `${total} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** `H:MM:SS` para cronómetros (segundos). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}
