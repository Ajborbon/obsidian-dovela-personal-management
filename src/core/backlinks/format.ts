/**
 * Formatos de Backlinks (puros): fechas detalladas y monto/moneda de transacciones. RI-D §2.6 y §6.4.
 *
 * Defecto de v1 corregido: `new Intl.NumberFormat(..., {currency})` estaba FUERA del `try`, así que una
 * `moneda` inválida (`COP$`, `pesos`) lanzaba `RangeError` y abortaba todo el render de la lista. Aquí
 * cualquier error de Intl cae en un formato de respaldo; esta función nunca lanza.
 */

/** `dd/mm/aaaa, hh:mm` en hora local (mismo texto que `Intl.DateTimeFormat('es-ES', …)` de v1). */
export function formatDateTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const d = new Date(ms);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Interpreta `monto` del frontmatter. Acepta número o texto:
 * - `"1500.5"`, `"-20"` → número JS;
 * - con coma decimal (`"1.500,50"`, `"1500,5"`) → los puntos son miles;
 * - solo puntos en grupos de 3 (`"1.500"`, `"2.000.000"`) → miles (convención es-CO para COP);
 * - se ignoran espacios y símbolos de moneda alrededor (`"$ 1.500"`).
 * Devuelve `null` si no es un número finito.
 */
export function parseAmount(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  let s = raw.replace(/\s/g, '').replace(/^[^\d+-]+|[^\d]+$/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^[+-]?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function plainNumber(n: number): string {
  try {
    return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  } catch {
    return n.toFixed(2).replace('.', ',');
  }
}

/**
 * Texto de la fila 💰, o `null` si no hay que mostrarla (como v1: `moneda` vacía o `monto` 0/vacío/no numérico).
 * Nunca lanza: una moneda que no es un código ISO 4217 válido usa el respaldo `"<MONEDA> 1.234,50"`.
 */
export function formatMoney(moneda: unknown, monto: unknown): string | null {
  if (typeof moneda !== 'string' || !moneda.trim()) return null;
  const amount = parseAmount(monto);
  if (amount === null || amount === 0) return null;
  const code = moneda.trim().toUpperCase();
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency', currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${plainNumber(amount)}`;
  }
}
