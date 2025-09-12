import { App, Modal, Setting, Notice, ButtonComponent } from 'obsidian';
import type DovelaPersonalManagementPlugin from '../../main.js';
import { 
    FocoSettingsManager, 
    DEFAULT_FOCO_SETTINGS,
    type FocoExpansionSettings
} from './focoSettings.js';

export class FocoSettingsModal extends Modal {
    private settings: FocoExpansionSettings;
    private onSave?: (settings: FocoExpansionSettings) => void;
    private allFolders: string[] = [];
    private allFiles: string[] = [];

    constructor(
        app: App, 
        _plugin: DovelaPersonalManagementPlugin, 
        onSave?: (settings: FocoExpansionSettings) => void
    ) {
        super(app);
        this.settings = FocoSettingsManager.load();
        this.onSave = onSave;
        this.initializeVaultPaths();
    }

    private initializeVaultPaths(): void {
        console.log('🔍 AUTOCOMPLETE DEBUG: Inicializando paths del vault...');
        
        // Método alternativo: obtener carpetas desde los paths de archivos
        const folders = new Set<string>();
        const allMarkdownFiles = this.app.vault.getMarkdownFiles();
        
        console.log('🔍 AUTOCOMPLETE DEBUG: Total archivos MD:', allMarkdownFiles.length);
        
        // Extraer todas las carpetas desde los paths de archivos
        allMarkdownFiles.forEach(file => {
            const pathParts = file.path.split('/');
            // Para cada archivo, agregar todas las combinaciones de carpetas
            for (let i = 1; i < pathParts.length; i++) {
                const folderPath = pathParts.slice(0, i).join('/');
                if (folderPath && folderPath !== '.') {
                    folders.add(folderPath);
                }
            }
        });
        
        // También incluir carpetas que podrían no tener archivos MD directamente
        this.app.vault.getAllLoadedFiles().forEach(file => {
            if (file.path.includes('/')) {
                const pathParts = file.path.split('/');
                for (let i = 1; i < pathParts.length; i++) {
                    const folderPath = pathParts.slice(0, i).join('/');
                    if (folderPath && folderPath !== '.') {
                        folders.add(folderPath);
                    }
                }
            }
        });
        
        this.allFolders = Array.from(folders).sort();
        console.log('🔍 AUTOCOMPLETE DEBUG: Carpetas encontradas:', this.allFolders.length);
        console.log('🔍 AUTOCOMPLETE DEBUG: Primeras 10 carpetas:', this.allFolders.slice(0, 10));

        // Obtener todos los archivos .md del vault
        this.allFiles = allMarkdownFiles.map(file => file.path).sort();
        
        console.log('🔍 AUTOCOMPLETE DEBUG: Archivos MD encontrados:', this.allFiles.length);
        console.log('🔍 AUTOCOMPLETE DEBUG: Primeros 10 archivos:', this.allFiles.slice(0, 10));
    }

    private createAutocompleteInput(
        container: HTMLElement,
        placeholder: string,
        searchType: 'folders' | 'files',
        onSelect: (value: string) => void
    ): HTMLElement {
        const inputContainer = container.createDiv('foco-autocomplete-container');
        inputContainer.setAttribute('data-type', searchType);
        
        const input = inputContainer.createEl('input', {
            type: 'text',
            placeholder: placeholder,
            cls: 'foco-autocomplete-input'
        });

        const suggestionsList = inputContainer.createDiv('foco-autocomplete-suggestions');
        suggestionsList.style.display = 'none';

        const searchItems = searchType === 'folders' ? this.allFolders : this.allFiles;
        let selectedIndex = -1;

        const showSuggestions = (query: string) => {
            console.log('🔍 AUTOCOMPLETE DEBUG: showSuggestions llamada con query:', query);
            console.log('🔍 AUTOCOMPLETE DEBUG: searchItems length:', searchItems.length);
            console.log('🔍 AUTOCOMPLETE DEBUG: searchType:', searchType);
            
            selectedIndex = -1;
            const filtered = searchItems
                .filter(item => item.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 10); // Limitar a 10 sugerencias

            console.log('🔍 AUTOCOMPLETE DEBUG: Items filtrados:', filtered.length);
            console.log('🔍 AUTOCOMPLETE DEBUG: Filtered items:', filtered);

            suggestionsList.empty();
            
            if (filtered.length === 0) {
                console.log('🔍 AUTOCOMPLETE DEBUG: No hay sugerencias para mostrar');
                suggestionsList.style.display = 'none';
                return;
            }
            
            // Si no hay query, mostrar las primeras opciones
            if (query.trim() === '') {
                console.log('🔍 AUTOCOMPLETE DEBUG: Query vacío, mostrando primeras opciones');
                const firstItems = searchItems.slice(0, 10);
                if (firstItems.length === 0) {
                    suggestionsList.style.display = 'none';
                    return;
                }
                
                firstItems.forEach((item) => {
                    const suggestion = suggestionsList.createDiv('foco-autocomplete-suggestion');
                    suggestion.textContent = item;
                    
                    suggestion.addEventListener('click', () => {
                        input.value = item;
                        suggestionsList.style.display = 'none';
                        onSelect(item);
                    });
                });
                
                suggestionsList.style.display = 'block';
                return;
            }

            filtered.forEach((item, index) => {
                const suggestion = suggestionsList.createDiv('foco-autocomplete-suggestion');
                
                // Destacar la parte que coincide
                const queryLower = query.toLowerCase();
                const itemLower = item.toLowerCase();
                const matchIndex = itemLower.indexOf(queryLower);
                
                if (matchIndex >= 0) {
                    const before = item.substring(0, matchIndex);
                    const match = item.substring(matchIndex, matchIndex + query.length);
                    const after = item.substring(matchIndex + query.length);
                    
                    suggestion.innerHTML = `${before}<mark>${match}</mark>${after}`;
                } else {
                    suggestion.textContent = item;
                }

                suggestion.addEventListener('click', () => {
                    input.value = item;
                    suggestionsList.style.display = 'none';
                    onSelect(item);
                });

                suggestion.addEventListener('mouseenter', () => {
                    // Remover selección anterior
                    suggestionsList.querySelectorAll('.selected').forEach(el => 
                        el.removeClass('selected')
                    );
                    suggestion.addClass('selected');
                    selectedIndex = index;
                });
            });

            suggestionsList.style.display = 'block';
        };

        const hideSuggestions = () => {
            setTimeout(() => {
                suggestionsList.style.display = 'none';
            }, 150); // Delay para permitir clicks en sugerencias
        };

        input.addEventListener('input', (e) => {
            const query = (e.target as HTMLInputElement).value;
            console.log('🔍 AUTOCOMPLETE DEBUG: Input event fired with value:', query);
            showSuggestions(query);
        });

        input.addEventListener('focus', () => {
            if (input.value) {
                showSuggestions(input.value);
            }
        });

        input.addEventListener('blur', hideSuggestions);

        input.addEventListener('keydown', (e) => {
            const suggestions = suggestionsList.querySelectorAll('.foco-autocomplete-suggestion');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
                updateSelection(suggestions);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                updateSelection(suggestions);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                    const selectedText = suggestions[selectedIndex]?.textContent || '';
                    input.value = selectedText;
                    suggestionsList.style.display = 'none';
                    onSelect(selectedText);
                } else {
                    // Si no hay selección, usar el valor actual del input
                    const currentValue = input.value.trim();
                    if (currentValue) {
                        suggestionsList.style.display = 'none';
                        onSelect(currentValue);
                    }
                }
            } else if (e.key === 'Escape') {
                suggestionsList.style.display = 'none';
                selectedIndex = -1;
            }
        });

        const updateSelection = (suggestions: NodeListOf<Element>) => {
            suggestions.forEach((suggestion, index) => {
                suggestion.toggleClass('selected', index === selectedIndex);
            });
            
            // Scroll para mantener visible la selección
            if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                suggestions[selectedIndex]?.scrollIntoView({ block: 'nearest' });
            }
        };

        return inputContainer;
    }

    override onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        this.titleEl.setText('🎯 Configuración de Vista Foco');
        
        // Header con descripción
        contentEl.createEl('div', {
            cls: 'foco-settings-header',
            text: 'Configura cómo Vista Foco expande y recolecta notas relacionadas desde la nota actual.'
        });

        this.createExpansionLevelsSection(contentEl);
        this.createTerminationFoldersSection(contentEl);
        this.createTerminationNotesSection(contentEl);
        this.createVisualizationSection(contentEl);
        this.createPreviewSection(contentEl);
        this.createActionButtons(contentEl);
        
        this.addModalStyles();
    }

    private createExpansionLevelsSection(contentEl: HTMLElement) {
        const section = contentEl.createDiv('foco-settings-section');
        section.createEl('h3', { text: '🔗 Niveles de Expansión de Enlaces', cls: 'foco-settings-section-title' });
        
        const description = section.createDiv('foco-settings-description');
        description.innerHTML = `
            <p><strong>Enlaces Salientes:</strong> Notas que son referenciadas desde tu grupo base</p>
            <p><strong>Enlaces Entrantes:</strong> Notas que referencian a tu grupo base</p>
        `;

        // Enlaces Salientes
        new Setting(section)
            .setName('📤 Niveles de Enlaces Salientes')
            .setDesc('¿Cuántos niveles de enlaces salientes incluir? (0 = deshabilitado, recomendado: 2)')
            .addSlider(slider => {
                slider
                    .setLimits(0, 8, 1)
                    .setValue(this.settings.outgoingLinksLevels)
                    .setDynamicTooltip()
                    .onChange(value => {
                        this.settings.outgoingLinksLevels = value;
                        this.updatePreview();
                    });
            })
            .addExtraButton(button => {
                button
                    .setIcon('reset')
                    .setTooltip('Restaurar valor por defecto (2)')
                    .onClick(() => {
                        this.settings.outgoingLinksLevels = DEFAULT_FOCO_SETTINGS.outgoingLinksLevels;
                        this.onOpen(); // Refresh modal
                    });
            });

        // Enlaces Entrantes
        new Setting(section)
            .setName('📥 Niveles de Enlaces Entrantes')
            .setDesc('¿Cuántos niveles de enlaces entrantes incluir? (0 = deshabilitado, recomendado: 5)')
            .addSlider(slider => {
                slider
                    .setLimits(0, 8, 1)
                    .setValue(this.settings.incomingLinksLevels)
                    .setDynamicTooltip()
                    .onChange(value => {
                        this.settings.incomingLinksLevels = value;
                        this.updatePreview();
                    });
            })
            .addExtraButton(button => {
                button
                    .setIcon('reset')
                    .setTooltip('Restaurar valor por defecto (5)')
                    .onClick(() => {
                        this.settings.incomingLinksLevels = DEFAULT_FOCO_SETTINGS.incomingLinksLevels;
                        this.onOpen(); // Refresh modal
                    });
            });
    }

    private createTerminationFoldersSection(contentEl: HTMLElement) {
        const section = contentEl.createDiv('foco-settings-section');
        section.createEl('h3', { text: '📁 Carpetas de Terminación', cls: 'foco-settings-section-title' });
        
        section.createDiv({
            cls: 'foco-settings-description',
            text: 'Carpetas donde la expansión se detiene (ej: Journals, Templates). La nota se incluye, pero no se expande recursivamente desde ella.'
        });

        const listContainer = section.createDiv('foco-settings-list-container');
        
        // Lista actual de carpetas
        this.renderFoldersList(listContainer);
        
        // Botón para agregar nueva carpeta con autocompletado
        const addFolderSetting = new Setting(section)
            .setName('➕ Agregar Carpeta')
            .setDesc('Escribe para buscar carpetas existentes en tu vault');

        const folderAutocomplete = this.createAutocompleteInput(
            addFolderSetting.controlEl,
            'Ruta/de/la/carpeta',
            'folders',
            (selectedFolder: string) => {
                this.addTerminationFolder(selectedFolder);
                // Limpiar el input
                const input = folderAutocomplete.querySelector('.foco-autocomplete-input') as HTMLInputElement;
                if (input) input.value = '';
                this.renderFoldersList(listContainer);
            }
        );

        addFolderSetting.addButton(button => {
            button
                .setButtonText('Agregar')
                .onClick(() => {
                    const input = folderAutocomplete.querySelector('.foco-autocomplete-input') as HTMLInputElement;
                    if (input && input.value.trim()) {
                        this.addTerminationFolder(input.value.trim());
                        input.value = '';
                        this.renderFoldersList(listContainer);
                    }
                });
        });
    }

    private createTerminationNotesSection(contentEl: HTMLElement) {
        const section = contentEl.createDiv('foco-settings-section');
        section.createEl('h3', { text: '📄 Notas de Terminación', cls: 'foco-settings-section-title' });
        
        section.createDiv({
            cls: 'foco-settings-description',
            text: 'Notas específicas donde la expansión se detiene (ej: MOCs, Índices). La nota se incluye, pero no se expande recursivamente desde ella.'
        });

        const listContainer = section.createDiv('foco-settings-list-container');
        
        // Lista actual de notas
        this.renderNotesList(listContainer);
        
        // Botón para agregar nueva nota con autocompletado
        const addNoteSetting = new Setting(section)
            .setName('➕ Agregar Nota')
            .setDesc('Escribe para buscar notas existentes en tu vault');

        const noteAutocomplete = this.createAutocompleteInput(
            addNoteSetting.controlEl,
            'NombreDeLaNota.md',
            'files',
            (selectedNote: string) => {
                this.addTerminationNote(selectedNote);
                // Limpiar el input
                const input = noteAutocomplete.querySelector('.foco-autocomplete-input') as HTMLInputElement;
                if (input) input.value = '';
                this.renderNotesList(listContainer);
            }
        );

        addNoteSetting.addButton(button => {
            button
                .setButtonText('Agregar')
                .onClick(() => {
                    const input = noteAutocomplete.querySelector('.foco-autocomplete-input') as HTMLInputElement;
                    if (input && input.value.trim()) {
                        this.addTerminationNote(input.value.trim());
                        input.value = '';
                        this.renderNotesList(listContainer);
                    }
                });
        });
    }

    private createVisualizationSection(contentEl: HTMLElement) {
        const section = contentEl.createDiv('foco-settings-section');
        section.createEl('h3', { text: '👁️ Opciones de Visualización', cls: 'foco-settings-section-title' });

        new Setting(section)
            .setName('🏷️ Mostrar Indicadores de Origen')
            .setDesc('Muestra badges que indican cómo fue incluida cada nota (carpeta, enlace saliente/entrante, terminación)')
            .addToggle(toggle => {
                toggle
                    .setValue(this.settings.showOriginIndicators)
                    .onChange(value => {
                        this.settings.showOriginIndicators = value;
                    });
            });

        new Setting(section)
            .setName('🕸️ Visualización de Red (Experimental)')
            .setDesc('Habilita la vista de red en Vista Jerárquica para explorar conexiones visualmente')
            .addToggle(toggle => {
                toggle
                    .setValue(this.settings.enableNetworkVisualization)
                    .onChange(value => {
                        this.settings.enableNetworkVisualization = value;
                    });
            });
    }

    private createPreviewSection(contentEl: HTMLElement) {
        const section = contentEl.createDiv('foco-settings-section');
        section.createEl('h3', { text: '👀 Vista Previa de Configuración', cls: 'foco-settings-section-title' });
        
        const previewContainer = section.createDiv('foco-settings-preview');
        this.updatePreview(previewContainer);
    }

    private createActionButtons(contentEl: HTMLElement) {
        const buttonContainer = contentEl.createDiv('foco-settings-buttons');

        new ButtonComponent(buttonContainer)
            .setButtonText('💾 Guardar y Aplicar')
            .setCta()
            .onClick(async () => {
                await this.saveSettings();
            });

        new ButtonComponent(buttonContainer)
            .setButtonText('🔄 Restaurar Valores por Defecto')
            .onClick(() => {
                this.settings = Object.assign({}, DEFAULT_FOCO_SETTINGS);
                this.onOpen(); // Refresh modal
            });

        new ButtonComponent(buttonContainer)
            .setButtonText('❌ Cancelar')
            .onClick(() => {
                this.close();
            });
    }

    private renderFoldersList(container: HTMLElement) {
        container.empty();
        
        if (this.settings.terminationFolders.length === 0) {
            container.createDiv({
                cls: 'foco-settings-empty-list',
                text: 'No hay carpetas de terminación configuradas.'
            });
            return;
        }

        this.settings.terminationFolders.forEach((folder, index) => {
            const item = container.createDiv('foco-settings-list-item');
            item.createSpan({ text: `📁 ${folder}`, cls: 'foco-settings-list-text' });
            
            const deleteBtn = item.createEl('button', {
                text: '🗑️',
                cls: 'foco-settings-delete-btn'
            });
            deleteBtn.onclick = () => {
                this.settings.terminationFolders.splice(index, 1);
                this.renderFoldersList(container);
            };
        });
    }

    private renderNotesList(container: HTMLElement) {
        container.empty();
        
        if (this.settings.terminationNotes.length === 0) {
            container.createDiv({
                cls: 'foco-settings-empty-list',
                text: 'No hay notas de terminación configuradas.'
            });
            return;
        }

        this.settings.terminationNotes.forEach((note, index) => {
            const item = container.createDiv('foco-settings-list-item');
            item.createSpan({ text: `📄 ${note}`, cls: 'foco-settings-list-text' });
            
            const deleteBtn = item.createEl('button', {
                text: '🗑️',
                cls: 'foco-settings-delete-btn'
            });
            deleteBtn.onclick = () => {
                this.settings.terminationNotes.splice(index, 1);
                this.renderNotesList(container);
            };
        });
    }

    private addTerminationFolder(folderPath: string) {
        const trimmed = folderPath.trim();
        if (trimmed && !this.settings.terminationFolders.includes(trimmed)) {
            this.settings.terminationFolders.push(trimmed);
        }
    }

    private addTerminationNote(noteName: string) {
        const trimmed = noteName.trim();
        if (trimmed) {
            // Agregar .md si no lo tiene
            const noteWithExt = trimmed.endsWith('.md') ? trimmed : `${trimmed}.md`;
            if (!this.settings.terminationNotes.includes(noteWithExt)) {
                this.settings.terminationNotes.push(noteWithExt);
            }
        }
    }

    private updatePreview(container?: HTMLElement) {
        const previewContainer = container || this.contentEl.querySelector('.foco-settings-preview');
        if (!previewContainer) return;

        previewContainer.innerHTML = `
            <div class="foco-settings-preview-item">
                <span class="foco-settings-preview-label">📤 Enlaces Salientes:</span>
                <span class="foco-settings-preview-value">${this.settings.outgoingLinksLevels} niveles</span>
            </div>
            <div class="foco-settings-preview-item">
                <span class="foco-settings-preview-label">📥 Enlaces Entrantes:</span>
                <span class="foco-settings-preview-value">${this.settings.incomingLinksLevels} niveles</span>
            </div>
            <div class="foco-settings-preview-item">
                <span class="foco-settings-preview-label">📁 Carpetas de Terminación:</span>
                <span class="foco-settings-preview-value">${this.settings.terminationFolders.length}</span>
            </div>
            <div class="foco-settings-preview-item">
                <span class="foco-settings-preview-label">📄 Notas de Terminación:</span>
                <span class="foco-settings-preview-value">${this.settings.terminationNotes.length}</span>
            </div>
            <div class="foco-settings-preview-item">
                <span class="foco-settings-preview-label">🏷️ Indicadores de Origen:</span>
                <span class="foco-settings-preview-value">${this.settings.showOriginIndicators ? '✅ Habilitado' : '❌ Deshabilitado'}</span>
            </div>
        `;
    }

    private async saveSettings() {
        try {
            // Validar configuraciones
            this.settings = FocoSettingsManager.validate(this.settings);
            
            // Guardar
            FocoSettingsManager.save(this.settings);
            
            // Callback para refrescar vista si se proporciona
            if (this.onSave) {
                this.onSave(this.settings);
            }
            
            new Notice('✅ Configuración de Vista Foco guardada correctamente');
            this.close();
            
        } catch (error) {
            console.error('Error saving Foco settings:', error);
            new Notice('❌ Error al guardar la configuración');
        }
    }

    private addModalStyles() {
        // Agregar estilos específicos para el modal si no existen
        if (!document.querySelector('#foco-settings-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'foco-settings-modal-styles';
            style.textContent = `
                .foco-settings-header {
                    margin-bottom: 20px;
                    padding: 10px;
                    background: var(--background-secondary);
                    border-radius: 6px;
                    color: var(--text-muted);
                    font-size: 0.9em;
                    line-height: 1.4;
                }
                
                .foco-settings-section {
                    margin-bottom: 25px;
                    padding: 15px;
                    border: 1px solid var(--background-modifier-border);
                    border-radius: 8px;
                }
                
                .foco-settings-section-title {
                    margin: 0 0 15px 0;
                    color: var(--text-accent);
                    font-size: 1.1em;
                }
                
                .foco-settings-description {
                    margin-bottom: 15px;
                    padding: 10px;
                    background: var(--background-secondary);
                    border-radius: 4px;
                    font-size: 0.85em;
                    line-height: 1.4;
                    color: var(--text-muted);
                }
                
                .foco-settings-list-container {
                    margin: 15px 0;
                    max-height: 150px;
                    overflow-y: auto;
                    border: 1px solid var(--background-modifier-border);
                    border-radius: 4px;
                }
                
                .foco-settings-list-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    border-bottom: 1px solid var(--background-modifier-border);
                }
                
                .foco-settings-list-item:last-child {
                    border-bottom: none;
                }
                
                .foco-settings-list-text {
                    flex: 1;
                    font-family: var(--font-monospace);
                    font-size: 0.85em;
                }
                
                .foco-settings-delete-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 2px 6px;
                    border-radius: 3px;
                    color: var(--text-error);
                }
                
                .foco-settings-delete-btn:hover {
                    background: var(--background-modifier-error);
                }
                
                .foco-settings-empty-list {
                    padding: 20px;
                    text-align: center;
                    color: var(--text-muted);
                    font-style: italic;
                }
                
                .foco-settings-preview {
                    background: var(--background-secondary);
                    border-radius: 6px;
                    padding: 15px;
                }
                
                .foco-settings-preview-item {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    font-size: 0.9em;
                }
                
                .foco-settings-preview-label {
                    color: var(--text-muted);
                }
                
                .foco-settings-preview-value {
                    font-weight: 500;
                    color: var(--text-normal);
                }
                
                .foco-settings-buttons {
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                    margin-top: 25px;
                    padding-top: 15px;
                    border-top: 1px solid var(--background-modifier-border);
                }
            `;
            document.head.appendChild(style);
        }
    }
}