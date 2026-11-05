/**
 * Pestaña de ajustes única. Las features añaden secciones con `addSettingsSection`.
 * Cada cambio se guarda con debounce (no una escritura por tecla, como en v1).
 */
import { PluginSettingTab, Setting } from 'obsidian';
import type { App } from 'obsidian';
import type { DovelaContext, Feature } from '../../context';
import type { DovelaSettings } from '../../core/settings';
import { DEFAULT_JOURNAL, DEFAULT_POMODORO } from '../../core/settings';

export interface SettingsSection {
  readonly id: string;
  readonly title: string;
  readonly order: number;
  render(el: HTMLElement, ctx: DovelaContext, redraw: () => void): void;
}

const SECTIONS_KEY = 'settingsSections';

export function addSettingsSection(ctx: DovelaContext, section: SettingsSection): void {
  const list = (ctx.services.get(SECTIONS_KEY) as SettingsSection[] | undefined) ?? [];
  list.push(section);
  ctx.services.set(SECTIONS_KEY, list);
}

type Keys<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T];

/** Helpers de ajustes enlazados a una rama de `DovelaSettings`. */
export function bindText<S extends object>(
  ctx: DovelaContext, el: HTMLElement, pick: (s: DovelaSettings) => S, key: Keys<S, string>, name: string, desc = '',
): Setting {
  return new Setting(el).setName(name).setDesc(desc).addText((t) =>
    t.setValue(String(pick(ctx.settings.value)[key])).onChange((v) => ctx.settings.update((s) => {
      (pick(s) as Record<string, unknown>)[key as string] = v.trim();
    })),
  );
}

export function bindToggle<S extends object>(
  ctx: DovelaContext, el: HTMLElement, pick: (s: DovelaSettings) => S, key: Keys<S, boolean>, name: string, desc = '',
): Setting {
  return new Setting(el).setName(name).setDesc(desc).addToggle((t) =>
    t.setValue(Boolean(pick(ctx.settings.value)[key])).onChange((v) => ctx.settings.update((s) => {
      (pick(s) as Record<string, unknown>)[key as string] = v;
    })),
  );
}

export function bindSlider<S extends object>(
  ctx: DovelaContext, el: HTMLElement, pick: (s: DovelaSettings) => S, key: Keys<S, number>,
  name: string, min: number, max: number, desc = '',
): Setting {
  return new Setting(el).setName(name).setDesc(desc).addSlider((sl) =>
    sl.setLimits(min, max, 1).setDynamicTooltip().setValue(Number(pick(ctx.settings.value)[key]))
      .onChange((v) => ctx.settings.update((s) => {
        (pick(s) as Record<string, unknown>)[key as string] = v;
      })),
  );
}

function linesSetting(ctx: DovelaContext, el: HTMLElement, name: string, desc: string, get: (s: DovelaSettings) => string[], set: (s: DovelaSettings, v: string[]) => void): void {
  new Setting(el).setName(name).setDesc(desc).addTextArea((t) =>
    t.setValue(get(ctx.settings.value).join('\n')).onChange((v) =>
      ctx.settings.update((s) => set(s, v.split('\n').map((x) => x.trim()).filter(Boolean)))),
  );
}

class DovelaSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly ctx: DovelaContext) {
    super(app, ctx.plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('dovela-settings');
    const sections = [...((this.ctx.services.get(SECTIONS_KEY) as SettingsSection[] | undefined) ?? [])].sort((a, b) => a.order - b.order);
    for (const s of sections) {
      new Setting(containerEl).setName(s.title).setHeading();
      s.render(containerEl, this.ctx, () => this.display());
    }
  }
}

export const settingsFeature: Feature = {
  id: 'settings',
  register(ctx) {
    addSettingsSection(ctx, {
      id: 'general', title: 'General', order: 0,
      render(el, c) {
        const g = (s: DovelaSettings) => s.general;
        bindText(c, el, g, 'inboxPath', 'Nota de Bandeja de Entrada', 'Destino de las capturas sin proyecto.');
        bindText(c, el, g, 'tasksHeading', 'Encabezado de tareas', 'Sección donde se insertan las tareas capturadas.');
        bindToggle(c, el, g, 'createdStampWithTime', 'Hora en el sello ➕', 'v1 escribía `➕ YYYY-MM-DD HH:mm`. Desactívalo para el formato del plugin Tasks (solo fecha).');
        bindToggle(c, el, g, 'backlinksIncludeOrigin', 'Backlinks: contar `origen`', 'Las notas hijas que apuntan a esta con `origen:` aparecen como backlinks.');
        bindText(c, el, g, 'templatesFolder', 'Carpeta de plantillas', 'Opcional: archivos `Plt - <Tipo>.md` cuyo texto sustituye el cuerpo por defecto.');
        linesSetting(c, el, 'Rutas excluidas', 'Una por línea. Prefijos de ruta que el índice ignora.', (s) => s.general.excludedPathPrefixes, (s, v) => { s.general.excludedPathPrefixes = v; });
        linesSetting(c, el, 'Carpetas excluidas', 'Una por línea. Nombres de carpeta ignorados en cualquier nivel.', (s) => s.general.excludedFolderNames, (s, v) => { s.general.excludedFolderNames = v; });
        new Setting(el).setName('Aplicar exclusiones').setDesc('Reconstruye el índice con las exclusiones actuales.')
          .addButton((b) => b.setButtonText('Reconstruir índice').onClick(() => void c.index.rebuild()));
      },
    });
    addSettingsSection(ctx, {
      id: 'pomodoro', title: 'Pomodoro', order: 40,
      render(el, c, redraw) {
        const p = (s: DovelaSettings) => s.pomodoro;
        bindSlider(c, el, p, 'workDuration', 'Trabajo (min)', 1, 60);
        bindSlider(c, el, p, 'shortBreakDuration', 'Descanso corto (min)', 1, 15);
        bindSlider(c, el, p, 'longBreakDuration', 'Descanso largo (min)', 1, 30);
        bindSlider(c, el, p, 'cyclesBeforeLongBreak', 'Ciclos antes del descanso largo', 2, 8);
        bindSlider(c, el, p, 'overtimeAlertInterval', 'Alerta en overtime cada (min)', 1, 15);
        bindSlider(c, el, p, 'sessionGapMinutes', 'Misma sesión si la pausa es menor a (min)', 5, 120);
        bindToggle(c, el, p, 'autoStartBreaks', 'Iniciar descansos automáticamente');
        bindToggle(c, el, p, 'autoStartWork', 'Iniciar trabajo tras el descanso automáticamente');
        bindToggle(c, el, p, 'notificationsEnabled', 'Notificaciones');
        bindToggle(c, el, p, 'soundEnabled', 'Sonido');
        new Setting(el).addButton((b) => b.setButtonText('Restablecer Pomodoro').setWarning().onClick(() => {
          c.settings.update((s) => { s.pomodoro = { ...DEFAULT_POMODORO }; });
          redraw();
        }));
      },
    });
    addSettingsSection(ctx, {
      id: 'journal', title: 'Journal', order: 50,
      render(el, c, redraw) {
        const j = (s: DovelaSettings) => s.journal;
        bindText(c, el, j, 'baseFolderPath', 'Carpeta base de journals');
        bindToggle(c, el, j, 'yearSubfolder', 'Subcarpeta por año');
        bindToggle(c, el, j, 'quarterSubfolder', 'Subcarpeta por trimestre');
        bindToggle(c, el, j, 'monthSubfolder', 'Subcarpeta por mes');
        bindText(c, el, j, 'weekFolderPattern', 'Patrón de carpeta para enlaces de semana', 'Variables {YYYY} {Q} {MM} {WW}.');
        bindText(c, el, j, 'periodFolderPattern', 'Carpeta de notas semanales/mensuales/trimestrales/anuales', 'Relativa a la base. Variables {YYYY} {Q} {MM}.');
        new Setting(el).addButton((b) => b.setButtonText('Restablecer Journal').setWarning().onClick(() => {
          c.settings.update((s) => { s.journal = { ...DEFAULT_JOURNAL }; });
          redraw();
        }));
      },
    });
    ctx.plugin.addSettingTab(new DovelaSettingTab(ctx.app, ctx));
  },
};
