import { Plugin } from 'obsidian';

/** Dovela v2 — punto de entrada. En F1 solo registra un diagnóstico; las features llegan en F2+. */
export default class DovelaPlugin extends Plugin {
  override async onload(): Promise<void> {
    this.addCommand({
      id: 'dovela-v2-diagnostico',
      name: 'Dovela v2: diagnóstico',
      callback: () => {
        // Se reemplaza en F2 por el panel de estado del índice.
      },
    });
  }
}
