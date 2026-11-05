/**
 * Comandos de paleta y ribbons de tiempo. Se conservan los ids de v1
 * (`time-tracker-start-for-active-note`, `pomodoro-start-for-active-note`, `time-tracker-edit-active-timer`)
 * y se añaden los que faltaban en v1 (detener, cancelar, manual, descanso, abrir vista): en móvil la paleta
 * es el acceso principal.
 */
import { TFile } from 'obsidian';
import type { TimeUi } from './controller';

export function registerTimeCommands(ui: TimeUi): void {
  const plugin = ui.ctx.plugin;
  const svc = ui.service;
  const hasActiveNote = (): boolean => {
    const f = ui.app.workspace.getActiveFile();
    return f instanceof TFile && f.extension === 'md';
  };

  plugin.addCommand({
    id: 'time-tracker-start-for-active-note',
    name: 'Control de Tiempo: Iniciar temporizador para la nota activa o la tarea seleccionada',
    icon: 'play-circle',
    checkCallback: (checking) => {
      if (!hasActiveNote() || svc.current()) return false;
      if (!checking) void ui.startTimer();
      return true;
    },
  });

  plugin.addCommand({
    id: 'pomodoro-start-for-active-note',
    name: 'Control de Tiempo: Iniciar Pomodoro para la nota activa o la tarea seleccionada',
    icon: 'timer',
    checkCallback: (checking) => {
      if (!hasActiveNote() || svc.current()) return false;
      if (!checking) void ui.startPomodoro();
      return true;
    },
  });

  plugin.addCommand({
    id: 'time-tracker-edit-active-timer',
    name: 'Control de Tiempo: Modificar temporizador activo',
    icon: 'pencil',
    checkCallback: (checking) => {
      const s = svc.current();
      if (!s) return false;
      if (!checking) ui.editLive(s);
      return true;
    },
  });

  plugin.addCommand({
    id: 'time-tracker-stop',
    name: 'Control de Tiempo: Detener y registrar la sesión en curso',
    icon: 'square',
    checkCallback: (checking) => {
      const s = svc.current();
      if (!s) return false;
      if (!checking) ui.requestStop(s);
      return true;
    },
  });

  plugin.addCommand({
    id: 'time-tracker-cancel',
    name: 'Control de Tiempo: Cancelar la sesión en curso (sin registrar)',
    icon: 'x-circle',
    checkCallback: (checking) => {
      const s = svc.current();
      if (!s) return false;
      if (!checking) ui.requestCancel(s);
      return true;
    },
  });

  plugin.addCommand({
    id: 'time-tracker-manual',
    name: 'Control de Tiempo: Registrar tiempo manualmente',
    icon: 'clock-plus',
    callback: () => ui.openManual(),
  });

  plugin.addCommand({
    id: 'pomodoro-start-break',
    name: 'Control de Tiempo: Iniciar descanso',
    icon: 'coffee',
    checkCallback: (checking) => {
      const s = svc.current();
      if (s && (s.kind === 'timer' || (s.phase ?? 'work') !== 'work')) return false;
      if (!checking) void ui.startBreak();
      return true;
    },
  });

  plugin.addCommand({
    id: 'time-open-view',
    name: 'Control de Tiempo: Abrir vista de tiempo (Seguimiento, Estadísticas, Cronograma)',
    icon: 'timer',
    callback: () => void ui.openView(),
  });

  plugin.addRibbonIcon('play-circle', 'Iniciar temporizador (nota activa o tarea seleccionada)', () => {
    if (svc.current()) {
      ui.requestStop();
      return;
    }
    void ui.startTimer();
  });
  plugin.addRibbonIcon('timer', 'Iniciar Pomodoro (nota activa o tarea seleccionada)', () => {
    const s = svc.current();
    if (s) {
      if (s.kind === 'pomodoro' && ui.mode(s) === 'decide') ui.openDecision(s, 'expired');
      else void ui.openView('tracker');
      return;
    }
    void ui.startPomodoro();
  });
}
