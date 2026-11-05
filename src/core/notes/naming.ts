/**
 * Nomenclatura DOVELA (CLAUDE-vault §Nomenclatura, RI-E §5.2): `Tipo YYMMDD - Nombre`, `Btx … - Sesión NN - desc`,
 * `Cmt YYMMDD HHmm - nombre`, capturas `Tipo YYMMDD-HHmm - Sin título`, contenedores `Prefijo - Nombre`.
 */
import { toYymmdd } from '../dates';

/** Longitud máxima de la descripción de una bitácora (plantilla Btx) y del nombre completo (regla del vault). */
export const BTX_DESC_MAX = 50;
export const BTX_TITLE_MAX = 80;

/**
 * Sanea un nombre de archivo como `Plt - Commit.md`: `:` → `-`; se eliminan `/ \ < > | " ? *`.
 * Además colapsa espacios repetidos y recorta (en v1 solo Cmt saneaba; aquí se aplica a todos los
 * tipos porque una `/` en el nombre crearía carpetas inesperadas).
 */
export function sanitizeName(raw: string): string {
  return raw
    .replace(/[:/\\<>|"?*]/g, (ch) => (ch === ':' ? '-' : ''))
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** `HH:mm` → `HHmm`. */
export function compactTime(hm: string): string {
  return hm.replace(':', '');
}

/** `Ax 251105 - Nombre` */
export function datedTitle(prefix: string, date: string, name: string): string {
  return `${prefix} ${toYymmdd(date)} - ${sanitizeName(name)}`;
}

/** `Cmt 251105 1430 - nombre` */
export function commitTitle(date: string, time: string, name: string): string {
  return `Cmt ${toYymmdd(date)} ${compactTime(time)} - ${sanitizeName(name)}`;
}

/** `Ref 251105-1430 - Sin título` (captura rápida). */
export function captureTitle(prefix: string, date: string, time: string, suffix: string): string {
  return `${prefix} ${toYymmdd(date)}-${compactTime(time)} - ${suffix}`;
}

/** `AV - Nombre`, `RR - Nombre`… */
export function containerTitle(prefix: string, name: string): string {
  return `${prefix} - ${sanitizeName(name)}`;
}

/** Descripción de la bitácora tal como la usa el título (≤ 50 y título total ≤ 80). */
export function btxDescription(date: string, session: string, desc: string): string {
  const head = `Btx ${toYymmdd(date)} - Sesión ${sanitizeName(session)} - `;
  let d = sanitizeName(desc).slice(0, BTX_DESC_MAX).trim();
  if (head.length + d.length > BTX_TITLE_MAX) d = d.slice(0, Math.max(0, BTX_TITLE_MAX - head.length)).trim();
  return d;
}

/** `Btx 251105 - Sesión 01 - desc` */
export function btxTitle(date: string, session: string, desc: string): string {
  return `Btx ${toYymmdd(date)} - Sesión ${sanitizeName(session)} - ${btxDescription(date, session, desc)}`;
}
