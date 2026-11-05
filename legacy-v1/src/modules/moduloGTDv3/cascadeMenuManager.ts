// cascadeMenuManager.ts
import type DovelaPersonalManagementPlugin from '../../main.js';
import { TFile } from 'obsidian';
import { MenuState, type MenuContext, type MenuOption, type CascadeMenuConfig } from './cascadeMenuTypes.js';
import { CascadeSuggestionProvider } from './cascadeSuggestionProvider.js';
import { CascadeMenuRenderer } from './cascadeMenuRenderer.js';

export class CascadeMenuManager {
    private suggestionProvider: CascadeSuggestionProvider;
    private renderer: CascadeMenuRenderer;
    private inputEl: HTMLInputElement;
    private config: CascadeMenuConfig;
    private currentContext: MenuContext | null = null;
    private onSelectionCallback: ((tag: string) => void) | null = null;

    constructor(
        private readonly plugin: DovelaPersonalManagementPlugin,
        inputEl: HTMLInputElement,
        containerEl: HTMLElement
    ) {
        this.inputEl = inputEl;
        this.suggestionProvider = new CascadeSuggestionProvider(this.plugin);
        this.renderer = new CascadeMenuRenderer(containerEl);
        this.config = this.suggestionProvider.generateConfig();
        
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Escuchar selecciones del menú
        this.renderer.containerEl.addEventListener('cascade-menu-select', (event: Event) => {
            this.handleMenuSelection((event as CustomEvent).detail.selectedIndex);
        });
    }

    public setSelectionCallback(callback: (tag: string) => void): void {
        this.onSelectionCallback = callback;
    }

    public setActiveFile(activeFile: TFile | null): void {
        this.suggestionProvider.setActiveFile(activeFile);
    }

    public detectTrigger(text: string, cursorPos: number): boolean {
        // Buscar '#' antes del cursor
        const textBeforeCursor = text.substring(0, cursorPos);
        const hashMatch = textBeforeCursor.match(/(^|\s)#$/);
        
        if (hashMatch) {
            const triggerPosition = hashMatch.index! + hashMatch[0].length - 1;
            this.showMainMenu(triggerPosition);
            return true;
        }
        
        // Buscar '@' antes del cursor para proyectos y áreas
        const atMatch = textBeforeCursor.match(/(^|\s)@$/);
        
        if (atMatch) {
            const triggerPosition = atMatch.index! + atMatch[0].length - 1;
            this.showProjectMenu(triggerPosition);
            return true;
        }
        
        return false;
    }

    private showMainMenu(triggerPosition: number): void {
        this.currentContext = {
            state: MenuState.MAIN_MENU,
            prefix: '#',
            triggerPosition,
            options: this.config.mainMenuOptions,
            selectedIndex: 0
        };

        this.renderer.renderMenu(this.currentContext, this.inputEl);
    }

    private resetToFullOptions(): void {
        if (!this.currentContext) return;

        let baseOptions: MenuOption[] = [];
        
        switch (this.currentContext.state) {
            case MenuState.CONTEXT_MENU:
                baseOptions = this.config.contextMenuOptions;
                break;
            case MenuState.PERSON_MENU:
                baseOptions = this.config.personMenuOptions;
                break;
            case MenuState.GTD_MENU:
                baseOptions = this.config.gtdMenuOptions;
                break;
        }

        this.currentContext.options = baseOptions;
        this.currentContext.selectedIndex = 0;
        
        this.renderer.renderMenu(this.currentContext, this.inputEl);
    }

    private applyProjectFilter(query: string): void {
        if (!this.currentContext) return;

        // Regenerar las opciones base para asegurar estados actualizados
        const baseOptions = this.suggestionProvider.getProjectMenuOptions();
        const filteredOptions = this.suggestionProvider.filterOptions(baseOptions, query);
        
        this.currentContext.options = filteredOptions;
        this.currentContext.selectedIndex = 0;
        
        this.renderer.renderMenu(this.currentContext, this.inputEl);
    }

    private showProjectMenu(triggerPosition: number): void {
        // Regenerar la configuración de proyectos cada vez para obtener estados actualizados
        this.config.projectMenuOptions = this.suggestionProvider.getProjectMenuOptions();
        
        this.currentContext = {
            state: MenuState.PROJECT_MENU,
            prefix: '@',
            triggerPosition,
            options: this.config.projectMenuOptions,
            selectedIndex: 0
        };

        this.renderer.renderMenu(this.currentContext, this.inputEl);
    }


    private handleMenuSelection(selectedIndex: number): void {
        if (!this.currentContext || selectedIndex >= this.currentContext.options.length) {
            return;
        }

        const selectedOption = this.currentContext.options[selectedIndex];
        
        if (this.currentContext.state === MenuState.MAIN_MENU) {
            // En lugar de mostrar submenú, insertar el prefijo en el input
            this.insertPrefixAndContinue(selectedOption!);
        } else if (this.currentContext.state === MenuState.PROJECT_MENU) {
            // Para el menú de proyectos, insertar directamente
            this.insertProjectTag(selectedOption!);
        } else {
            // Insertar tag final
            this.insertFinalTag(selectedOption!);
        }
    }

    private insertFinalTag(option: MenuOption): void {
        if (!this.currentContext) return;

        let finalTag: string;
        
        switch (this.currentContext.state) {
            case MenuState.CONTEXT_MENU:
                finalTag = `#cx-${option.value}`;
                break;
            case MenuState.PERSON_MENU:
                finalTag = `#px-${option.value}`;
                break;
            case MenuState.GTD_MENU:
                finalTag = `#GTD-${option.value}`;
                break;
            default:
                return;
        }

        // Llamar al callback con el tag final
        if (this.onSelectionCallback) {
            this.onSelectionCallback(finalTag);
        }

        this.hideMenu();
    }

    private insertPrefixAndContinue(option: MenuOption): void {
        if (!this.currentContext) return;

        let prefix = '';
        let newState: MenuState;
        
        switch (option.id) {
            case 'cx':
                prefix = '#cx-';
                newState = MenuState.CONTEXT_MENU;
                break;
            case 'px':
                prefix = '#px-';
                newState = MenuState.PERSON_MENU;
                break;
            case 'gtd':
                prefix = '#gtd-';
                newState = MenuState.GTD_MENU;
                break;
            default:
                this.hideMenu();
                return;
        }

        // Insertar el prefijo en el input
        const text = this.inputEl.value;
        const cursorPos = this.inputEl.selectionStart || 0;
        const textBeforeCursor = text.substring(0, cursorPos);
        const hashIndex = textBeforeCursor.lastIndexOf('#');
        
        if (hashIndex !== -1) {
            // Reemplazar desde el # hasta el cursor con el prefijo
            const beforeHash = text.substring(0, hashIndex);
            const afterCursor = text.substring(cursorPos);
            const newText = beforeHash + prefix + afterCursor;
            
            this.inputEl.value = newText;
            const newCursorPos = hashIndex + prefix.length;
            this.inputEl.selectionStart = this.inputEl.selectionEnd = newCursorPos;
        }

        // Actualizar el contexto para el submenú pero sin mostrarlo inmediatamente
        let options: MenuOption[] = [];
        switch (newState) {
            case MenuState.CONTEXT_MENU:
                options = this.config.contextMenuOptions;
                break;
            case MenuState.PERSON_MENU:
                options = this.config.personMenuOptions;
                break;
            case MenuState.GTD_MENU:
                options = this.config.gtdMenuOptions;
                break;
        }

        this.currentContext = {
            state: newState,
            prefix: prefix,
            triggerPosition: this.currentContext.triggerPosition,
            options: options,
            selectedIndex: 0
        };

        // Mostrar el submenú con todas las opciones
        this.renderer.renderMenu(this.currentContext, this.inputEl);
        
        // Enfocar el input para que el usuario pueda seguir escribiendo
        this.inputEl.focus();
    }

    private insertProjectTag(option: MenuOption): void {
        if (!this.currentContext) return;

        // Ignorar separadores
        if (option.id === 'separator' || option.value === '') {
            return;
        }

        // Formatear como @NombreCompleto (usando el nombre completo del archivo)
        const finalTag = `@${option.value}`;

        // Llamar al callback con el tag final
        if (this.onSelectionCallback) {
            this.onSelectionCallback(finalTag);
        }

        this.hideMenu();
    }

    public handleKeyDown(event: KeyboardEvent): boolean {
        if (!this.currentContext || !this.renderer.isMenuVisible()) {
            return false;
        }

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.moveSelection(1);
                return true;
                
            case 'ArrowUp':
                event.preventDefault();
                this.moveSelection(-1);
                return true;
                
            case 'Enter':
            case 'Tab':
                event.preventDefault();
                this.handleMenuSelection(this.currentContext.selectedIndex);
                return true;
                
            case 'Escape':
                event.preventDefault();
                this.hideMenu();
                return true;
                
            case 'Backspace':
                // Si estamos en un submenú y borramos, verificar si volvemos al menú principal
                if (this.currentContext.state !== MenuState.MAIN_MENU && 
                    this.currentContext.state !== MenuState.PROJECT_MENU) {
                    const text = this.inputEl.value;
                    const cursorPos = this.inputEl.selectionStart || 0;
                    const textBeforeCursor = text.substring(0, cursorPos);
                    
                    // Si solo queda '#' después del backspace, volver al menú principal
                    if (textBeforeCursor.endsWith('#')) {
                        event.preventDefault();
                        this.showMainMenu(cursorPos - 1);
                        return true;
                    }
                }
                break;
        }
        
        return false;
    }

    private moveSelection(direction: number): void {
        if (!this.currentContext) return;

        const newIndex = this.currentContext.selectedIndex + direction;
        const maxIndex = this.currentContext.options.length - 1;

        if (newIndex < 0) {
            this.currentContext.selectedIndex = maxIndex;
        } else if (newIndex > maxIndex) {
            this.currentContext.selectedIndex = 0;
        } else {
            this.currentContext.selectedIndex = newIndex;
        }

        this.renderer.updateSelection(this.currentContext.selectedIndex);
    }

    public handleInput(text: string, cursorPos: number): boolean {
        // Si ya hay un menú visible, verificar si seguimos en contexto válido
        if (this.currentContext && this.renderer.isMenuVisible()) {
            const textBeforeCursor = text.substring(0, cursorPos);
            
            // Verificar el trigger apropiado según el contexto
            const triggerChar = this.currentContext.state === MenuState.PROJECT_MENU ? '@' : '#';
            
            // Verificar si seguimos teniendo el trigger
            if (!textBeforeCursor.includes(triggerChar)) {
                this.hideMenu();
                return false;
            }
            
            // Si estamos en un submenú (no PROJECT_MENU ni MAIN_MENU), verificar si tenemos filtrado
            if (this.currentContext.state !== MenuState.MAIN_MENU && 
                this.currentContext.state !== MenuState.PROJECT_MENU) {
                const afterTrigger = textBeforeCursor.substring(textBeforeCursor.lastIndexOf(triggerChar) + 1);
                
                // Si hay más caracteres después del prefijo, es filtrado
                if (afterTrigger.length > this.currentContext.prefix.length - 1) {
                    const query = afterTrigger.substring(this.currentContext.prefix.length - 1);
                    this.applyFilter(query);
                } else if (afterTrigger.length === this.currentContext.prefix.length - 1) {
                    // Si coincide exactamente con el prefijo, mostrar todas las opciones
                    this.resetToFullOptions();
                }
            }
            
            // Si estamos en PROJECT_MENU, aplicar filtrado directo
            if (this.currentContext.state === MenuState.PROJECT_MENU) {
                const afterAt = textBeforeCursor.substring(textBeforeCursor.lastIndexOf('@') + 1);
                if (afterAt.length > 0) {
                    this.applyProjectFilter(afterAt);
                }
            }
            
            return true;
        }
        
        // Detectar nuevo trigger
        return this.detectTrigger(text, cursorPos);
    }

    private applyFilter(query: string): void {
        if (!this.currentContext) return;

        let baseOptions: MenuOption[] = [];
        
        switch (this.currentContext.state) {
            case MenuState.CONTEXT_MENU:
                baseOptions = this.config.contextMenuOptions;
                break;
            case MenuState.PERSON_MENU:
                baseOptions = this.config.personMenuOptions;
                break;
            case MenuState.GTD_MENU:
                baseOptions = this.config.gtdMenuOptions;
                break;
        }

        const filteredOptions = this.suggestionProvider.filterOptions(baseOptions, query);
        
        this.currentContext.options = filteredOptions;
        this.currentContext.selectedIndex = 0;
        
        this.renderer.renderMenu(this.currentContext, this.inputEl);
    }

    public hideMenu(): void {
        this.renderer.hideMenu();
        this.currentContext = null;
    }

    public refreshConfig(): void {
        this.config = this.suggestionProvider.generateConfig();
    }

    public isMenuVisible(): boolean {
        return this.renderer.isMenuVisible();
    }

    public destroy(): void {
        this.renderer.destroy();
        this.currentContext = null;
    }
}
