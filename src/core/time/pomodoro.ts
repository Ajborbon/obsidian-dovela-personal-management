/**
 * Lógica pura del Pomodoro. Corrige los defectos de v1 (RI-C §4.7):
 * ciclos acumulados en la sesión, descansos que conservan la tarea, fin de sesión = fin real
 * (no el clic en el modal), overtime medido desde el fin de la fase, estadísticas sin doble conteo.
 */
import type { PomodoroPhase } from './events';

export interface PomodoroRun {
  readonly phase: PomodoroPhase;
  readonly start: number; // epoch ms de inicio de la fase
  readonly plannedMin: number;
  /** Ciclos de trabajo completados en esta sesión (antes de la fase actual). */
  readonly cycles: number;
  /** Inicio del overtime (solo fase de trabajo). */
  readonly overtimeStart?: number;
}

export function phaseEnd(r: PomodoroRun): number {
  return r.start + r.plannedMin * 60_000;
}

export function isExpired(r: PomodoroRun, now: number): boolean {
  return r.overtimeStart === undefined && now >= phaseEnd(r);
}

/** Segundos restantes de la fase (0 si expiró; en overtime no aplica → 0). */
export function remainingSeconds(r: PomodoroRun, now: number): number {
  if (r.overtimeStart !== undefined) return 0;
  return Math.max(0, Math.ceil((phaseEnd(r) - now) / 1000));
}

/** Segundos de overtime transcurridos (desde el fin planificado, no desde el inicio). */
export function overtimeSeconds(r: PomodoroRun, now: number): number {
  if (r.overtimeStart === undefined) return 0;
  return Math.max(0, Math.floor((now - r.overtimeStart) / 1000));
}

/** Tipo de descanso tras completar `completedCycles` ciclos (el actual incluido). */
export function breakAfter(completedCycles: number, cyclesBeforeLong: number): 'shortBreak' | 'longBreak' {
  return completedCycles > 0 && completedCycles % Math.max(1, cyclesBeforeLong) === 0 ? 'longBreak' : 'shortBreak';
}

/** Número de pomodoro dentro de la ronda (1..N) para mostrar "2 de 4". */
export function roundPosition(cyclesCompleted: number, cyclesBeforeLong: number): { current: number; of: number } {
  const n = Math.max(1, cyclesBeforeLong);
  return { current: (cyclesCompleted % n) + 1, of: n };
}

export interface WorkLogPlan {
  readonly start: number;
  readonly end: number;
  readonly plannedMin: number;
  readonly overtimeMin: number;
  readonly cycle: number;
}

/**
 * Registro de una fase de trabajo al cerrarla en `now`.
 * - Sin overtime y expirada: termina en el fin planificado (aunque el usuario decida más tarde).
 * - En overtime: termina en `now`.
 * - Detenida antes de tiempo: termina en `now`.
 */
export function workLogFor(r: PomodoroRun, now: number): WorkLogPlan | null {
  if (r.phase !== 'work') return null;
  const end = r.overtimeStart !== undefined ? now : Math.min(now, phaseEnd(r));
  const overtimeMin = r.overtimeStart !== undefined ? Math.max(0, Math.floor((now - r.overtimeStart) / 60_000)) : 0;
  const completed = end >= phaseEnd(r);
  return { start: r.start, end, plannedMin: r.plannedMin, overtimeMin, cycle: r.cycles + (completed ? 1 : 0) };
}

/** Notas automáticas con el formato de v1 + notas del usuario. */
export function pomodoroNotes(totalMin: number, plannedMin: number, overtimeMin: number, cycles: number, userNotes: string): string {
  let head = overtimeMin > 0
    ? `Sesión Pomodoro + Overtime (${totalMin} min total)`
    : `Sesión Pomodoro (${totalMin}/${plannedMin} min)`;
  if (cycles > 0) head += ` - Ciclos completados: ${cycles}`;
  const extra = userNotes.trim();
  return extra ? `${head}\n\n${extra}` : head;
}

/** ¿Toca avisar en overtime? (cada `intervalMin` desde el inicio del overtime). */
export function overtimeAlertDue(r: PomodoroRun, now: number, lastAlert: number | undefined, intervalMin: number): boolean {
  if (r.overtimeStart === undefined) return false;
  const since = lastAlert ?? r.overtimeStart;
  return now - since >= Math.max(1, intervalMin) * 60_000;
}

/** Continúa la misma "sesión grande" si la pausa entre pomodoros es menor al umbral (backlog v0.9). */
export function sameSession(previousEnd: number | undefined, nextStart: number, gapMinutes: number): boolean {
  return previousEnd !== undefined && nextStart - previousEnd <= gapMinutes * 60_000;
}
