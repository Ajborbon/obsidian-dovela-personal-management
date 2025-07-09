

import { TFile, Notice, App } from 'obsidian';
import type DovelaPersonalManagementPlugin from '../../main.js';
import moment from 'moment';

export class SmartInboxView {
    private plugin: DovelaPersonalManagementPlugin;
    private app: App;
    private viewEl: HTMLElement;
    private inputEl: HTMLInputElement;
    private suggestionsEl: HTMLElement;
    private isOpen: boolean = false;
    private selectedSuggestionIndex: number = -1;
    private currentSuggestionContext: { prefix: string; match: RegExpMatchArray } | null = null;

    constructor(plugin: DovelaPersonalManagementPlugin) {
        this.plugin = plugin;
        this.app = plugin.app;

        this.viewEl = document.createElement('div');
        this.viewEl.className = 'smart-inbox-container';
        this.viewEl.style.display = 'none';

        const inputContainer = this.viewEl.createDiv({ cls: 'smart-inbox-input-container' });
        this.inputEl = inputContainer.createEl('input', {
            type: 'text',
            placeholder: 'Escribe una tarea... (@proyecto, #cx-contexto, #px-persona, !date, #gtd-estado)',
        });

        this.suggestionsEl = this.viewEl.createDiv({ cls: 'smart-inbox-suggestions' });
        document.body.appendChild(this.viewEl);
        
        this.inputEl.addEventListener('keydown', this.handleKeyDown.bind(this));
        this.inputEl.addEventListener('input', this.handleInput.bind(this));
        this.viewEl.addEventListener('click', (e) => {
            if (e.target === this.viewEl) this.close();
        });
    }

    public open() {
        if (this.isOpen) return;
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
    }

    public remove() {
        document.body.removeChild(this.viewEl);
    }

    private handleKeyDown(event: KeyboardEvent) {
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
        const textBeforeCursor = text.substring(0, cursorPos);

        const atMatch = textBeforeCursor.match(/@(\S*)$/);
        if (atMatch) {
            this.currentSuggestionContext = { prefix: '@', match: atMatch };
            const query = atMatch[1] || '';
            const suggestions = this.plugin.gtdProjectsAndAreas
                .map((f: TFile) => f.basename)
                .filter((name: string) => name.toLowerCase().includes(query.toLowerCase()));
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

        const projectMatch = text.match(/@([\w\s-]+)/);
        const contextTags = text.match(/#cx-[\w-]+/g) || [];
        const personTags = text.match(/#px-[\w-]+/g) || [];
        const gtdStatusTags = text.match(/#GTD-(AlgunDia|EstaSemanaNo)/gi) || [];
        const dateMatch = text.match(/!([\w\s-]+)/);

        let description = text;
        let projectFile: TFile | null = null;
        let dueDate = '';

        if (projectMatch && projectMatch[1]) {
            const projectName = projectMatch[1].trim();
            description = description.replace(projectMatch[0], '').trim();
            projectFile = this.app.vault.getFiles().find((f: TFile) => f.basename.toLowerCase() === projectName.toLowerCase()) || null;
        }

        contextTags.forEach(tag => description = description.replace(tag, '').trim());
        personTags.forEach(tag => description = description.replace(tag, '').trim());
        gtdStatusTags.forEach(tag => description = description.replace(tag, '').trim());

        if (dateMatch && dateMatch[1]) {
            const dateString = dateMatch[1].trim();
            description = description.replace(dateMatch[0], '').trim();
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

        // 3. Add due date last
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
}

