/**
 * Exportación CSV (sustituye a `xlsx`). Mismas columnas que la exportación Excel de v1.
 * UTF-8 con BOM para que Excel detecte la codificación; separador configurable (`;` por defecto en es-CO).
 */
import { formatYmd, toLocalHm, weekdayNameEs } from '../dates';
import { formatDuration } from '../duration';
import { durationMinutes, type TimeLog } from './merge';

export const CSV_HEADERS = [
  'Ruta Completa', 'Tarea', 'Descripción Tarea', 'Fecha', 'Día de la Semana',
  'Hora Inicio', 'Hora Fin', 'Duración (Minutos)', 'Duración (hh:mm)', 'Notas del Registro',
] as const;

function cell(v: string | number, sep: string): string {
  const s = String(v);
  return /["\r\n]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function logsToCsv(logs: readonly TimeLog[], sep: ';' | ',' = ';', bom = true): string {
  const rows: string[] = [CSV_HEADERS.map((h) => cell(h, sep)).join(sep)];
  for (const l of [...logs].sort((a, b) => a.start - b.start)) {
    const start = new Date(l.start);
    const day = formatYmd(start.getFullYear(), start.getMonth() + 1, start.getDate());
    const mins = durationMinutes(l);
    rows.push([
      l.path.replace(/\.md$/i, ''),
      l.path.split('/').pop()?.replace(/\.md$/i, '') ?? '',
      l.desc,
      day,
      weekdayNameEs(day),
      toLocalHm(start),
      toLocalHm(new Date(l.end)),
      mins,
      formatDuration(mins, true),
      l.notes,
    ].map((v) => cell(v, sep)).join(sep));
  }
  return (bom ? '﻿' : '') + rows.join('\r\n') + '\r\n';
}

/** Nombre de archivo seguro para el vault (sin `/\:*?"<>|`). */
export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|#^[\]]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'export';
}
