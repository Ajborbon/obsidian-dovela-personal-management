/**
 * Coincidencia de texto para los menús del Smart Inbox (puro).
 * Insensible a mayúsculas y acentos, con mapa de posiciones para poder resaltar
 * la coincidencia sobre el texto ORIGINAL (con acentos).
 */

export interface Folded {
  /** Texto en minúsculas y sin diacríticos. */
  readonly text: string;
  /** `map[i]` = índice en el original del carácter plegado `i`; `map[text.length]` = longitud original. */
  readonly map: readonly number[];
}

/** Pliega un texto (minúsculas, sin diacríticos) conservando el mapa de posiciones. */
export function fold(s: string): Folded {
  let out = '';
  const map: number[] = [];
  let i = 0;
  for (const ch of s) {
    const base = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    for (let k = 0; k < base.length; k++) map.push(i);
    out += base;
    i += ch.length;
  }
  map.push(i);
  return { text: out, map };
}

/** Solo el texto plegado (comparaciones). */
export function foldText(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export type MatchRange = readonly [start: number, end: number];

export interface LabelMatch {
  /** 0 = exacta, 1 = prefijo, 2 = inicio de palabra, 3 = subcadena. Menor = más relevante. */
  readonly score: number;
  /** Rangos a resaltar en el texto original. */
  readonly ranges: readonly MatchRange[];
}

const WORD_SEP = /[\s\-_/.·:([]/u;

/** Coincidencia de `query` en `label`. Consulta vacía = todo coincide sin resaltar. Null si no coincide. */
export function matchLabel(label: string, query: string): LabelMatch | null {
  const q = foldText(query).replace(/^\s+/, '');
  if (!q) return { score: 0, ranges: [] };
  const f = fold(label);
  const t = f.text;
  const range = (idx: number): MatchRange => [f.map[idx] ?? 0, f.map[idx + q.length] ?? label.length];
  if (t === q) return { score: 0, ranges: [range(0)] };
  if (t.startsWith(q)) return { score: 1, ranges: [range(0)] };
  const first = t.indexOf(q);
  if (first < 0) return null;
  for (let idx = first; idx >= 0; idx = t.indexOf(q, idx + 1)) {
    if (WORD_SEP.test(t.charAt(idx - 1))) return { score: 2, ranges: [range(idx)] };
  }
  return { score: 3, ranges: [range(first)] };
}
