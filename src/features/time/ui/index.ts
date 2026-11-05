/** UI de tiempo (F4/F7): barra de estado, comandos, ribbons, modales y vista “Dovela: Tiempo”. */
import type { DovelaContext } from '../../../context';
import type { TimeService } from '../../../host/time/TimeService';
import { registerTimeCommands } from './commands';
import { TIME_UI, TimeUi } from './controller';
import { openTimeView, TIME_VIEW_TYPE, TimeView } from './view';

export function registerTimeUi(ctx: DovelaContext, service: TimeService): void {
  const ui = new TimeUi(ctx, service);
  ui.openView = (tab) => openTimeView(ctx, tab);
  ctx.services.set(TIME_UI, ui);
  ctx.plugin.registerView(TIME_VIEW_TYPE, (leaf) => new TimeView(leaf, ctx));
  ui.start();
  registerTimeCommands(ui);
}
