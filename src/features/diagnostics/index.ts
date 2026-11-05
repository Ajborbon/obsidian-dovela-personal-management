/** Comandos de diagnóstico del índice (útiles para las pruebas manuales y medir rendimiento). */
import { Notice } from 'obsidian';
import type { Feature } from '../../context';
import { logger } from '../../host/logger';

export const diagnosticsFeature: Feature = {
  id: 'diagnostics',
  register(ctx) {
    ctx.plugin.addCommand({
      id: 'diagnostico-indice',
      name: 'Diagnóstico: estado del índice',
      callback: () => {
        const s = ctx.index.store;
        const tasks = s.allTasks();
        const open = tasks.filter((t) => t.status === 'open' || t.status === 'in-progress').length;
        const dups = s.duplicateIds();
        new Notice(
          `Dovela · índice ${ctx.index.loaded ? 'listo' : 'construyéndose'}\n` +
            `${s.size} notas · ${tasks.length} tareas (${open} abiertas)\n` +
            `ids 🆔 duplicados: ${dups.size}`,
          10000,
        );
      },
    });
    ctx.plugin.addCommand({
      id: 'diagnostico-reconstruir-indice',
      name: 'Diagnóstico: reconstruir índice',
      callback: async () => {
        const t0 = performance.now();
        await ctx.index.rebuild();
        new Notice(`Dovela: índice reconstruido en ${Math.round(performance.now() - t0)} ms`);
      },
    });
    ctx.plugin.addCommand({
      id: 'diagnostico-registro-depuracion',
      name: 'Diagnóstico: activar/desactivar registro de depuración',
      callback: () => {
        logger.debugEnabled = !logger.debugEnabled;
        new Notice(`Dovela: depuración ${logger.debugEnabled ? 'activada' : 'desactivada'}`);
      },
    });
  },
};
