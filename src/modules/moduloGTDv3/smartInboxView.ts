

import { TFile, Notice, App } from 'obsidian';
import type DovelaPersonalManagementPlugin from '../../main.js';
import moment from 'moment';
import { CascadeMenuManager } from './cascadeMenuManager.js';
import { CalendarManager } from './calendarManager.js';

export class SmartInboxView {
    private plugin: DovelaPersonalManagementPlugin;
    private app: App;
    private viewEl: HTMLElement;
    private inputEl: HTMLInputElement;
    private suggestionsEl: HTMLElement;
    private isOpen: boolean = false;
    private selectedSuggestionIndex: number = -1;
    private currentSuggestionContext: { prefix: string; match: RegExpMatchArray } | null = null;
    private cascadeMenuManager: CascadeMenuManager | null = null;
    private calendarManager: CalendarManager | null = null;
    private useCascadeMenu: boolean = true; // Flag para alternar entre sistemas
    private useCalendarPicker: boolean = true; // Flag para alternar sistema de fechas
    private activeFileAtOpen: TFile | null = null; // Capturar la nota activa al abrir

    constructor(plugin: DovelaPersonalManagementPlugin) {
        this.plugin = plugin;
        this.app = plugin.app;

        this.viewEl = document.createElement('div');
        this.viewEl.className = 'smart-inbox-container';
        this.viewEl.style.display = 'none';

        const inputContainer = this.viewEl.createDiv({ cls: 'smart-inbox-input-container' });
        this.inputEl = inputContainer.createEl('input', {
            type: 'text',
            placeholder: 'Escribe una tarea... (@ para proyectos, # para tags, ! para fechas)',
        });

        this.suggestionsEl = this.viewEl.createDiv({ cls: 'smart-inbox-suggestions' });
        document.body.appendChild(this.viewEl);
        
        // Inicializar el sistema de menús en cascada
        this.cascadeMenuManager = new CascadeMenuManager(this.plugin, this.inputEl, this.viewEl);
        this.cascadeMenuManager.setSelectionCallback(this.handleCascadeSelection.bind(this));
        
        // Inicializar el sistema de calendario
        this.calendarManager = new CalendarManager(this.inputEl, this.viewEl);
        this.calendarManager.setSelectionCallback(this.handleCalendarSelection.bind(this));
        
        this.inputEl.addEventListener('keydown', this.handleKeyDown.bind(this));
        this.inputEl.addEventListener('input', this.handleInput.bind(this));
        this.viewEl.addEventListener('click', (e) => {
            if (e.target === this.viewEl) this.close();
        });
    }

    public open() {
        if (this.isOpen) return;
        
        // Capturar la nota activa al momento de abrir el Smart Inbox
        this.activeFileAtOpen = this.app.workspace.getActiveFile();
        console.log('🔍 SMART INBOX DEBUG: Captured activeFileAtOpen on open:', this.activeFileAtOpen?.path || 'No active file');
        
        // Pasarle la nota activa al cascade manager
        if (this.cascadeMenuManager) {
            this.cascadeMenuManager.setActiveFile(this.activeFileAtOpen);
        }
        
        this.isOpen = true;
        this.viewEl.style.display = 'flex';
        this.inputEl.focus();
    }

    public close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.viewEl.style.display = 'none';
        this.inputEl.value = '';
        this.suggestionsEl.style.display = 'none';
        this.selectedSuggestionIndex = -1;
        this.currentSuggestionContext = null;
        this.activeFileAtOpen = null; // Limpiar referencia al cerrar
        
        // Cerrar menús en cascada y calendario
        if (this.cascadeMenuManager) {
            this.cascadeMenuManager.hideMenu();
        }
        if (this.calendarManager) {
            this.calendarManager.hideCalendar();
        }
    }

    public remove() {
        // Limpiar el sistema de menús en cascada y calendario
        if (this.cascadeMenuManager) {
            this.cascadeMenuManager.destroy();
            this.cascadeMenuManager = null;
        }
        if (this.calendarManager) {
            this.calendarManager.destroy();
            this.calendarManager = null;
        }
        
        document.body.removeChild(this.viewEl);
    }

    private handleKeyDown(event: KeyboardEvent) {
        // Primero intentar con el sistema de calendario
        if (this.useCalendarPicker && this.calendarManager) {
            const handled = this.calendarManager.handleKeyDown(event);
            if (handled) {
                return;
            }
        }
        
        // Luego intentar con el sistema de menús en cascada
        if (this.useCascadeMenu && this.cascadeMenuManager) {
            const handled = this.cascadeMenuManager.handleKeyDown(event);
            if (handled) {
                return;
            }
        }
        
        // Fallback al sistema original
        if (this.suggestionsEl.style.display === 'block') {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.updateSelectedSuggestion(1);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.updateSelectedSuggestion(-1);
            } else if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault();
                this.selectSuggestion();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                this.close();
            }
        } else if (event.key === 'Enter') {
            event.preventDefault();
            this.processInput();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            this.close();
        }
    }

    private handleInput() {
        const text = this.inputEl.value;
        const cursorPos = this.inputEl.selectionStart || 0;
        
        // Primero intentar con el sistema de calendario
        if (this.useCalendarPicker && this.calendarManager) {
            const handled = this.calendarManager.handleInput(text, cursorPos);
            if (handled) {
                return;
            }
        }
        
        // Luego intentar con el sistema de menús en cascada
        if (this.useCascadeMenu && this.cascadeMenuManager) {
            const handled = this.cascadeMenuManager.handleInput(text, cursorPos);
            if (handled) {
                return;
            }
        }
        
        // Fallback al sistema original
        this.handleInputOriginal();
    }
    
    private handleInputOriginal() {
        const text = this.inputEl.value;
        const cursorPos = this.inputEl.selectionStart || 0;
        const textBeforeCursor = text.substring(0, cursorPos);
        
        console.log('🔍 SMART INBOX DEBUG: handleInputOriginal called');
        console.log('🔍 SMART INBOX DEBUG: text:', text);
        console.log('🔍 SMART INBOX DEBUG: textBeforeCursor:', textBeforeCursor);

        const atMatch = textBeforeCursor.match(/@(\S*)$/);
        console.log('🔍 SMART INBOX DEBUG: atMatch:', atMatch);
        if (atMatch) {
            this.currentSuggestionContext = { prefix: '@', match: atMatch };
            const query = atMatch[1] || '';
            
            // Obtener sugerencias de proyectos y áreas
            const projectSuggestions = this.plugin.gtdProjectsAndAreas
                .map((f: TFile) => f.basename)
                .filter((name: string) => name.toLowerCase().includes(query.toLowerCase()));
            
            // Usar la nota activa capturada al abrir el Smart Inbox
            const activeFile = this.activeFileAtOpen;
            console.log('🔍 SMART INBOX DEBUG: Using captured activeFile:', activeFile?.path || 'No active file');
            let suggestions = [...projectSuggestions];
            
            if (activeFile && activeFile.extension === 'md') {
                const activeFileName = activeFile.basename;
                console.log('🔍 SMART INBOX DEBUG: activeFileName:', activeFileName);
                console.log('🔍 SMART INBOX DEBUG: query:', query);
                console.log('🔍 SMART INBOX DEBUG: projectSuggestions:', projectSuggestions);
                
                // Solo agregar la nota activa si coincide con la query y no está ya en la lista
                if (activeFileName.toLowerCase().includes(query.toLowerCase()) && 
                    !suggestions.includes(activeFileName)) {
                    // Agregar la nota activa como primera opción
                    suggestions.unshift(activeFileName);
                } else if (query === '') {
                    // Si no hay query, siempre mostrar la nota activa como primera opción
                    if (!suggestions.includes(activeFileName)) {
                        suggestions.unshift(activeFileName);
                    } else {
                        // Si ya existe en la lista, moverla al principio
                        suggestions = suggestions.filter(s => s !== activeFileName);
                        suggestions.unshift(activeFileName);
                    }
                }
            }
            
            console.log('🔍 SMART INBOX DEBUG: Final suggestions:', suggestions);
            this.showSuggestions(suggestions);
            return;
        }

        const cxMatch = textBeforeCursor.match(/#cx-(\S*)$/);
        if (cxMatch) {
            this.currentSuggestionContext = { prefix: '#cx-', match: cxMatch };
            const query = cxMatch[1] || '';
            const suggestions = this.plugin.gtdContextTags
                .map((t: string) => t.substring(4))
                .filter((name: string) => name.toLowerCase().includes(query.toLowerCase()));
            this.showSuggestions(suggestions);
            return;
        }

        const pxMatch = textBeforeCursor.match(/#px-(\S*)$/);
        if (pxMatch) {
            this.currentSuggestionContext = { prefix: '#px-', match: pxMatch };
            const query = pxMatch[1] || '';
            const suggestions = this.plugin.gtdPersonTags
                .map((t: string) => t.substring(4))
                .filter((name: string) => name.toLowerCase().includes(query.toLowerCase()));
            this.showSuggestions(suggestions);
            return;
        }

        const gtdMatch = textBeforeCursor.match(/#gtd-(\S*)$/i);
        if (gtdMatch) {
            this.currentSuggestionContext = { prefix: '#gtd-', match: gtdMatch };
            const query = gtdMatch[1] || '';
            const gtdStates = ['AlgunDia', 'EstaSemanaNo'];
            const suggestions = gtdStates.filter(name => name.toLowerCase().includes(query.toLowerCase()));
            this.showSuggestions(suggestions);
            return;
        }
        
        this.suggestionsEl.style.display = 'none';
        this.currentSuggestionContext = null;
    }
    
    // Callback para manejar selecciones del sistema de menús en cascada
    private handleCascadeSelection(tag: string): void {
        const text = this.inputEl.value;
        const cursorPos = this.inputEl.selectionStart || 0;
        
        // Detectar si es un tag # o un proyecto @
        const isProjectTag = tag.startsWith('@');
        const triggerChar = isProjectTag ? '@' : '#';
        
        // Encontrar la posición del trigger más cercano al cursor
        const textBeforeCursor = text.substring(0, cursorPos);
        const triggerIndex = textBeforeCursor.lastIndexOf(triggerChar);
        
        if (triggerIndex === -1) {
            // Si no hay trigger, simplemente agregar el tag al final
            this.inputEl.value = text + tag + ' ';
            this.inputEl.selectionStart = this.inputEl.selectionEnd = this.inputEl.value.length;
        } else {
            // Reemplazar desde el trigger hasta la posición actual del cursor
            const beforeTrigger = text.substring(0, triggerIndex);
            const afterCursor = text.substring(cursorPos);
            const newText = beforeTrigger + tag + ' ' + afterCursor;
            
            this.inputEl.value = newText;
            const newCursorPos = triggerIndex + tag.length + 1;
            this.inputEl.selectionStart = this.inputEl.selectionEnd = newCursorPos;
        }
        
        this.inputEl.focus();
    }
    
    // Método público para refrescar la configuración del menú en cascada
    public refreshCascadeMenuConfig(): void {
        if (this.cascadeMenuManager) {
            this.cascadeMenuManager.refreshConfig();
        }
    }
    
    // Método público para alternar entre el sistema de menús en cascada y el original
    public toggleCascadeMenu(enabled: boolean): void {
        this.useCascadeMenu = enabled;
        if (!enabled && this.cascadeMenuManager) {
            this.cascadeMenuManager.hideMenu();
        }
    }

    private showSuggestions(suggestions: string[]) {
        this.suggestionsEl.empty();
        this.selectedSuggestionIndex = -1;
        if (suggestions.length === 0) {
            this.suggestionsEl.style.display = 'none';
            return;
        }
        suggestions.forEach((suggestion, index) => {
            const suggestionEl = this.suggestionsEl.createDiv({ cls: 'suggestion-item' });
            suggestionEl.setText(suggestion);
            suggestionEl.dataset['index'] = index.toString();
            suggestionEl.addEventListener('click', () => this.selectSuggestion(index));
        });
        this.suggestionsEl.style.display = 'block';
        this.updateSelectedSuggestion(0);
    }

    private updateSelectedSuggestion(direction: number) {
        const children = this.suggestionsEl.children;
        if (children.length === 0) return;
        const currentSelected = this.suggestionsEl.querySelector('.is-selected');
        if (currentSelected) currentSelected.classList.remove('is-selected');
        this.selectedSuggestionIndex += direction;
        if (this.selectedSuggestionIndex < 0) this.selectedSuggestionIndex = children.length - 1;
        else if (this.selectedSuggestionIndex >= children.length) this.selectedSuggestionIndex = 0;
        const newSelected = children[this.selectedSuggestionIndex] as HTMLElement;
        newSelected.classList.add('is-selected');
        newSelected.scrollIntoView({ block: 'nearest' });
    }

    private selectSuggestion(index?: number) {
        if (!this.currentSuggestionContext) return;
        const selectedIndex = index !== undefined ? index : this.selectedSuggestionIndex;
        const children = this.suggestionsEl.children;
        if (selectedIndex < 0 || selectedIndex >= children.length) return;

        const selectedText = (children[selectedIndex] as HTMLElement).innerText;
        const text = this.inputEl.value;
        const cursorPos = this.inputEl.selectionStart || 0;
        const { prefix } = this.currentSuggestionContext;
        
        // For #gtd-, we need to respect the original casing from the suggestion
        const fullTag = prefix.toLowerCase() === '#gtd-' ? `#GTD-${selectedText}` : `${prefix}${selectedText}`;

        const textBeforeCursor = text.substring(0, cursorPos);
        const start = textBeforeCursor.toLowerCase().lastIndexOf(prefix.toLowerCase());
        const newText = text.substring(0, start) + fullTag + ' ' + text.substring(cursorPos);
        
        this.inputEl.value = newText;
        this.inputEl.focus();
        this.inputEl.selectionStart = this.inputEl.selectionEnd = start + fullTag.length + 1;
        this.suggestionsEl.style.display = 'none';
        this.currentSuggestionContext = null;
    }

    private async processInput() {
        let text = this.inputEl.value.trim();
        if (!text) {
            this.close();
            return;
        }

        const projectMatch = text.match(/@([^#!]+)/);
        const contextTags = text.match(/#cx-[\w-]+/g) || [];
        const personTags = text.match(/#px-[\w-]+/g) || [];
        const gtdStatusTags = text.match(/#GTD-(AlgunDia|EstaSemanaNo)/gi) || [];
        
        // Manejar diferentes tipos de fechas del nuevo sistema
        const startDateMatch = text.match(/🛫\s+(\d{4}-\d{2}-\d{2})/);
        const scheduleDateMatch = text.match(/⏳\s+(\d{4}-\d{2}-\d{2})/);
        const dueDateMatch = text.match(/📅\s+(\d{4}-\d{2}-\d{2})/);
        
        // Fallback al sistema original de fechas
        const legacyDateMatch = text.match(/!([\w\s-]+)/);

        let description = text;
        let projectFile: TFile | null = null;
        let startDate = '';
        let scheduleDate = '';
        let dueDate = '';

        if (projectMatch && projectMatch[1]) {
            const projectName = projectMatch[1].trim();
            description = description.replace(projectMatch[0], '').trim();
            projectFile = this.app.vault.getFiles().find((f: TFile) => f.basename.toLowerCase() === projectName.toLowerCase()) || null;
        }

        contextTags.forEach(tag => description = description.replace(tag, '').trim());
        personTags.forEach(tag => description = description.replace(tag, '').trim());
        gtdStatusTags.forEach(tag => description = description.replace(tag, '').trim());

        // Procesar fechas del nuevo sistema
        if (startDateMatch && startDateMatch[1]) {
            startDate = startDateMatch[1];
            description = description.replace(startDateMatch[0], '').trim();
        }
        
        if (scheduleDateMatch && scheduleDateMatch[1]) {
            scheduleDate = scheduleDateMatch[1];
            description = description.replace(scheduleDateMatch[0], '').trim();
        }
        
        if (dueDateMatch && dueDateMatch[1]) {
            dueDate = dueDateMatch[1];
            description = description.replace(dueDateMatch[0], '').trim();
        }
        
        // Fallback al sistema original de fechas
        if (!startDate && !scheduleDate && !dueDate && legacyDateMatch && legacyDateMatch[1]) {
            const dateString = legacyDateMatch[1].trim();
            description = description.replace(legacyDateMatch[0], '').trim();
            dueDate = this.parseDate(dateString);
        }

        const creationDate = moment().format('YYYY-MM-DD HH:mm');
        let taskString = `- [ ] ${description.trim()}`;

        // 1. Assemble all tags
        const allTags = [...contextTags, ...personTags, ...gtdStatusTags];
        if (contextTags.length === 0 && personTags.length === 0 && gtdStatusTags.length === 0) {
            allTags.push('#inbox');
        }
        if (allTags.length > 0) {
            taskString += ` ${allTags.join(' ')}`;
        }

        // 2. Add creation date
        taskString += ` ➕ ${creationDate}`;

        // 3. Add dates in order: Start, Schedule, Due
        if (startDate) {
            taskString += ` 🛫 ${startDate}`;
        }
        if (scheduleDate) {
            taskString += ` ⏳ ${scheduleDate}`;
        }
        if (dueDate) {
            taskString += ` 📅 ${dueDate}`;
        }

        let destinationFile: TFile | null = projectFile;
        let isNewFile = false;
        const inboxFileName = '00 - Inbox/Bandeja de entrada.md';

        if (!destinationFile) {
            destinationFile = this.app.vault.getAbstractFileByPath(inboxFileName) as TFile;
            if (!destinationFile) {
                const inboxFolderPath = '00 - Inbox';
                try {
                    await this.app.vault.createFolder(inboxFolderPath);
                } catch (e) {
                    if (e instanceof Error && !e.message.includes('already exists')) {
                        new Notice('Error creating inbox folder.');
                        console.error('Error creating inbox folder:', e);
                        return;
                    }
                }
                destinationFile = await this.app.vault.create(inboxFileName, '');
                isNewFile = true;
            }
        }

        if (!destinationFile) {
            new Notice('Error: No se pudo determinar el archivo de destino.');
            return;
        }

        await this.appendTaskToFile(destinationFile, taskString, isNewFile);
        new Notice(`Tarea añadida a [[${destinationFile.basename}]]`);
        this.close();
    }

    private parseDate(dateString: string): string {
        const lowerDateString = dateString.toLowerCase().trim();
        const now = moment();

        // 1. Keyword mapping
        const keywordMap: { [key: string]: () => moment.Moment } = {
            'today': () => now.clone(),
            'tomorrow': () => now.clone().add(1, 'day'),
            'yesterday': () => now.clone().subtract(1, 'day'),
        };

        if (keywordMap[lowerDateString]) {
            return keywordMap[lowerDateString]().format('YYYY-MM-DD');
        }

        // 2. Handle "next <weekday>"
        if (lowerDateString.startsWith('next ')) {
            const dayName = lowerDateString.substring(5); // "next ".length
            const weekdays = moment.weekdays().map(d => d.toLowerCase());
            const shortWeekdays = moment.weekdaysShort().map(d => d.toLowerCase());
            
            let dayIndex = weekdays.findIndex(d => d.startsWith(dayName));
            if (dayIndex === -1) dayIndex = shortWeekdays.findIndex(d => d.startsWith(dayName));
            
            if (dayIndex !== -1) {
                return now.clone().day(dayIndex + 7).format('YYYY-MM-DD');
            }
        }

        // 3. Handle standalone weekdays (e.g., "monday", "mon")
        const weekdays = moment.weekdays().map(d => d.toLowerCase());
        const shortWeekdays = moment.weekdaysShort().map(d => d.toLowerCase());
        
        let dayIndex = weekdays.indexOf(lowerDateString);
        if (dayIndex === -1) dayIndex = shortWeekdays.indexOf(lowerDateString);

        if (dayIndex !== -1) {
            const resultMoment = now.clone().day(dayIndex);
            // If the day is in the past (e.g., today is Wednesday, user types "monday"), assume next week's Monday.
            if (resultMoment.isBefore(now, 'day')) {
                resultMoment.add(7, 'days');
            }
            return resultMoment.format('YYYY-MM-DD');
        }

        // 4. Handle specific date format YYYY-MM-DD
        const parsedDate = moment(dateString, 'YYYY-MM-DD', true);
        if (parsedDate.isValid()) {
            return parsedDate.format('YYYY-MM-DD');
        }

        return ''; // Return empty for invalid date strings
    }

    private async appendTaskToFile(file: TFile, task: string, isNewFile: boolean) {
        await this.app.vault.process(file, (content) => {
            if (isNewFile) return task + '\n';
            const tasksHeader = '## Tareas';
            const headerIndex = content.indexOf(tasksHeader);
            if (headerIndex !== -1) {
                const nextHeaderRegex = /^##\s/gm;
                nextHeaderRegex.lastIndex = headerIndex + tasksHeader.length;
                const nextHeaderMatch = nextHeaderRegex.exec(content);
                const endIndex = nextHeaderMatch ? nextHeaderMatch.index : content.length;
                const before = content.substring(0, endIndex);
                const after = content.substring(endIndex);
                return before.trimEnd() + '\n' + task + '\n\n' + after;
            } else {
                return content.trimEnd() + '\n\n' + tasksHeader + '\n' + task + '\n';
            }
        });
    }
    
    // Callback para manejar selecciones del sistema de calendario
    private handleCalendarSelection(dateString: string): void {
        const text = this.inputEl.value;
        const cursorPos = this.inputEl.selectionStart || 0;
        
        // Encontrar la posición del '!' más cercano al cursor
        const textBeforeCursor = text.substring(0, cursorPos);
        const exclamationIndex = textBeforeCursor.lastIndexOf('!');
        
        if (exclamationIndex === -1) {
            // Si no hay !, simplemente agregar la fecha al final
            this.inputEl.value = text + dateString + ' ';
            this.inputEl.selectionStart = this.inputEl.selectionEnd = this.inputEl.value.length;
        } else {
            // Reemplazar desde el ! hasta la posición actual del cursor
            const beforeExclamation = text.substring(0, exclamationIndex);
            const afterCursor = text.substring(cursorPos);
            const newText = beforeExclamation + dateString + ' ' + afterCursor;
            
            this.inputEl.value = newText;
            const newCursorPos = exclamationIndex + dateString.length + 1;
            this.inputEl.selectionStart = this.inputEl.selectionEnd = newCursorPos;
        }
        
        this.inputEl.focus();
    }
    
    // Método público para alternar entre el sistema de calendario y el original
    public toggleCalendarPicker(enabled: boolean): void {
        this.useCalendarPicker = enabled;
        if (!enabled && this.calendarManager) {
            this.calendarManager.hideCalendar();
        }
    }
    
    // Método público para validar fechas en el texto actual
    public validateDatesInText(): void {
        if (this.calendarManager) {
            const validation = this.calendarManager.validateCurrentDates();
            if (validation && !validation.isValid) {
                console.warn('Advertencia de validación de fechas:', validation.warning);
                if (validation.suggestion) {
                    console.log('Sugerencia:', validation.suggestion);
                }
                // En una implementación real, podrías mostrar una notificación visual
            }
        }
    }
}

