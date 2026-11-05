/**
 * Validaciones (puras) de la API pública de Journal/Weekly, con los mensajes de v1.
 * Más estrictas que v1 donde v1 aceptaba datos imposibles (RI-E §8.1 R14–R15):
 * `2025-02-30` y `2025-W99` ahora se rechazan.
 */
import { formatWeekCode, isValidYmd, parseWeekCode } from '../dates';

/** Mensaje de error de v1 o null si la fecha es válida. Admite valores no string (llamadas desde JS). */
export function dateInputError(value: unknown): string | null {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValidYmd(value)) return null;
  return `Formato de fecha inválido: ${String(value)}. Use YYYY-MM-DD`;
}

/** Mensaje de error de v1 o null si el código de semana es válido (1–52/53 según el año ISO). */
export function weekInputError(value: unknown): string | null {
  if (typeof value === 'string' && /^\d{4}-[Ww]\d{1,2}$/.test(value.trim()) && parseWeekCode(value)) return null;
  return `Formato de semana inválido: ${String(value)}. Use YYYY-W## (ej: 2025-W43)`;
}

/** `2025-W5` → `2025-W05`. Lanza con el mensaje de v1 si no es válido. */
export function normalizeWeekInput(value: unknown): string {
  const err = weekInputError(value);
  if (err) throw new Error(err);
  const w = parseWeekCode(String(value));
  if (!w) throw new Error(`Formato de semana inválido: ${String(value)}`);
  return formatWeekCode(w);
}

export type PathKind = 'folder' | 'file' | null;

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * `validateBaseFolderPath` de v1 (RI-E §3.2): vacía → inválida; caracteres `< > : " | ? *` → inválida;
 * un segmento existente que sea archivo → inválida; si no existe pero se puede crear → válida.
 */
export function validateBaseFolderPath(path: string, kindOf: (p: string) => PathKind): ValidationResult {
  if (!path || path.trim() === '') return { valid: false, message: 'La carpeta base no puede estar vacía' };
  if (/[<>:"|?*]/.test(path)) return { valid: false, message: 'La carpeta contiene caracteres inválidos: < > : " | ? *' };
  if (kindOf(path) === 'folder') return { valid: true };
  let current = '';
  for (const part of path.split('/')) {
    current = current ? `${current}/${part}` : part;
    if (kindOf(current) === 'file') return { valid: false, message: `"${current}" es un archivo, no una carpeta` };
  }
  return { valid: true };
}

/** Prefijos de una ruta de carpeta: `a/b/c` → `a`, `a/b`, `a/b/c`. */
export function folderChain(folder: string): string[] {
  const segs = folder.split('/').filter(Boolean);
  return segs.map((_, i) => segs.slice(0, i + 1).join('/'));
}

/** Carpeta que contiene una ruta de archivo (`''` en la raíz). */
export function parentFolder(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}
