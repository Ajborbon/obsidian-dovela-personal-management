/** Ajustes de la Vista de Foco (por dispositivo, como en v1, pero en la caché local del vault). */
import { Modal, Setting } from 'obsidian';
import type { App } from 'obsidian';
import { DEFAULT_FOCUS_SETTINGS, MAX_FOCUS_LEVELS, validateFocusSettings, type FocusSettings } from '../../core/gtd/focus';

type Mutable<T> = { -readonly [K in keyof T]: T[K] extends readonly (infer U)[] ? U[] : T[K] };

const lines = (v: string): string[] => v.split('\n').map((x) => x.trim()).filter(Boolean);

export class FocusSettingsModal extends Modal {
  private draft: Mutable<FocusSettings>;

  constructor(app: App, initial: FocusSettings, private readonly onSave: (s: FocusSettings) => void) {
    super(app);
    this.draft = { ...initial, terminationFolders: [...initial.terminationFolders], terminationNotes: [...initial.terminationNotes] };
  }

  override onOpen(): void {
    this.titleEl.setText('🎯 Ajustes de la Vista de Foco');
    this.contentEl.addClass('dovela', 'dovela-gtd-focus-settings');
    this.draw();
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  private draw(): void {
    const el = this.contentEl;
    el.empty();
    el.createDiv({
      cls: 'dovela-muted',
      text: 'Se guardan solo en este dispositivo. El foco incluye la carpeta de la nota fijada (con subcarpetas) y las notas enlazadas.',
    });
    new Setting(el).setName('Niveles de enlaces salientes').setDesc('0 = desactivado. Notas a las que enlazan las de la carpeta.')
      .addSlider((s) => s.setLimits(0, MAX_FOCUS_LEVELS, 1).setDynamicTooltip().setValue(this.draft.outgoingLinksLevels)
        .onChange((v) => (this.draft.outgoingLinksLevels = v)));
    new Setting(el).setName('Niveles de enlaces entrantes').setDesc('0 = desactivado. Notas que enlazan a las de la carpeta.')
      .addSlider((s) => s.setLimits(0, MAX_FOCUS_LEVELS, 1).setDynamicTooltip().setValue(this.draft.incomingLinksLevels)
        .onChange((v) => (this.draft.incomingLinksLevels = v)));
    new Setting(el).setName('Carpetas de terminación')
      .setDesc('Una por línea. Sus notas se incluyen pero no se expanden. Con "/" es una ruta; sin "/", un nombre de carpeta en cualquier nivel.')
      .addTextArea((t) => {
        t.setValue(this.draft.terminationFolders.join('\n')).onChange((v) => (this.draft.terminationFolders = lines(v)));
        t.inputEl.rows = 3;
      });
    new Setting(el).setName('Notas de terminación').setDesc('Una por línea: ruta, nombre de archivo o nombre sin extensión.')
      .addTextArea((t) => {
        t.setValue(this.draft.terminationNotes.join('\n')).onChange((v) => (this.draft.terminationNotes = lines(v)));
        t.inputEl.rows = 3;
      });
    new Setting(el).setName('Indicadores de origen').setDesc('Muestra ➡️/⬅️ y el nivel en tareas y notas que vienen de enlaces.')
      .addToggle((t) => t.setValue(this.draft.showOriginIndicators).onChange((v) => (this.draft.showOriginIndicators = v)));
    new Setting(el).setName('Contar `origen` como enlace').setDesc('Incluye las notas hijas que apuntan con `origen:` (desactivado en v1).')
      .addToggle((t) => t.setValue(this.draft.includeOrigin).onChange((v) => (this.draft.includeOrigin = v)));
    new Setting(el).setName('Seguir la nota activa').setDesc('La vista cambia de nota fijada al abrir otra nota.')
      .addToggle((t) => t.setValue(this.draft.followActive).onChange((v) => (this.draft.followActive = v)));
    new Setting(el)
      .addButton((b) => b.setButtonText('Restablecer').setWarning().onClick(() => {
        this.draft = {
          ...DEFAULT_FOCUS_SETTINGS,
          terminationFolders: [...DEFAULT_FOCUS_SETTINGS.terminationFolders],
          terminationNotes: [...DEFAULT_FOCUS_SETTINGS.terminationNotes],
        };
        this.draw();
      }))
      .addButton((b) => b.setButtonText('Cancelar').onClick(() => this.close()))
      .addButton((b) => b.setButtonText('Guardar').setCta().onClick(() => {
        this.onSave(validateFocusSettings(this.draft));
        this.close();
      }));
  }
}
