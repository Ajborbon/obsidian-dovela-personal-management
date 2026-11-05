/* eslint-disable no-console -- único punto autorizado de salida a consola */
/** Logger con nivel. Apagado por defecto (solo errores); `logger.debugEnabled = true` desde el comando de diagnóstico. */

export const logger = {
  debugEnabled: false,
  debug(...args: unknown[]): void {
    if (this.debugEnabled) console.debug('[Dovela]', ...args);
  },
  warn(...args: unknown[]): void {
    console.warn('[Dovela]', ...args);
  },
  error(...args: unknown[]): void {
    console.error('[Dovela]', ...args);
  },
};
