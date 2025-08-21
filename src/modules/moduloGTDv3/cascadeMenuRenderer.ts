// cascadeMenuRenderer.ts
import type { MenuContext } from './cascadeMenuTypes.js';

export class CascadeMenuRenderer {
    public containerEl: HTMLElement;
    private menuEl: HTMLElement | null = null;
    private isVisible: boolean = false;

    constructor(containerEl: HTMLElement) {
        this.containerEl = containerEl;
        this.createMenuElement();
    }

    private createMenuElement(): void {
        this.menuEl = this.containerEl.createDiv({ cls: 'cascade-menu-container' });
        this.menuEl.style.display = 'none';
        this.menuEl.style.position = 'absolute';
        this.menuEl.style.zIndex = '10000';
        this.menuEl.style.background = 'var(--background-secondary)';
        this.menuEl.style.border = '1px solid var(--background-modifier-border)';
        this.menuEl.style.borderRadius = '8px';
        this.menuEl.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        this.menuEl.style.maxHeight = '250px';
        this.menuEl.style.overflowY = 'auto';
        this.menuEl.style.minWidth = '200px';
    }

    public renderMenu(context: MenuContext, inputEl: HTMLInputElement): void {
        if (!this.menuEl) return;

        this.menuEl.empty();
        this.isVisible = true;

        // Crear header del menú si es necesario
        if (context.state !== 'main_menu') {
            const headerEl = this.menuEl.createDiv({ cls: 'cascade-menu-header' });
            headerEl.style.padding = '8px 12px';
            headerEl.style.borderBottom = '1px solid var(--background-modifier-border)';
            headerEl.style.fontWeight = 'bold';
            headerEl.style.fontSize = '0.9em';
            headerEl.style.color = 'var(--text-muted)';
            
            let headerText = '';
            switch (context.state) {
                case 'context_menu':
                    headerText = 'Seleccionar Contexto';
                    break;
                case 'person_menu':
                    headerText = 'Seleccionar Persona';
                    break;
                case 'gtd_menu':
                    headerText = 'Seleccionar Estado GTD';
                    break;
                case 'project_menu':
                    headerText = '📁 Áreas y Proyectos GTD';
                    break;
            }
            headerEl.textContent = headerText;
        }

        // Crear opciones del menú
        const optionsContainer = this.menuEl.createDiv({ cls: 'cascade-menu-options' });
        
        context.options.forEach((option, index) => {
            const optionEl = optionsContainer.createDiv({ cls: 'cascade-menu-option' });
            optionEl.style.padding = '10px 12px';
            optionEl.style.cursor = 'pointer';
            optionEl.style.borderBottom = '1px solid var(--background-modifier-border-hover)';
            optionEl.style.transition = 'background-color 0.2s ease';
            
            // Estilos especiales para separadores
            if (option.id === 'separator') {
                optionEl.style.cursor = 'default';
                optionEl.style.padding = '4px 12px';
                optionEl.style.textAlign = 'center';
                optionEl.style.color = 'var(--text-faint)';
                optionEl.style.fontSize = '0.8em';
                optionEl.textContent = option.label;
                return; // No agregar eventos ni selección
            }
            
            if (index === context.selectedIndex) {
                optionEl.classList.add('is-selected');
                optionEl.style.backgroundColor = 'var(--background-modifier-hover)';
                optionEl.style.color = 'var(--text-accent)';
            }

            // Contenido principal de la opción
            const mainContent = optionEl.createDiv({ cls: 'option-main' });
            mainContent.style.display = 'flex';
            mainContent.style.justifyContent = 'space-between';
            mainContent.style.alignItems = 'center';

            const labelEl = mainContent.createSpan({ cls: 'option-label' });
            labelEl.textContent = option.label;
            labelEl.style.fontWeight = '500';

            // Para el menú de proyectos, no mostrar descripción en el menú principal
            if (context.state === 'main_menu' && option.description) {
                const descEl = mainContent.createSpan({ cls: 'option-description' });
                descEl.textContent = option.description;
                descEl.style.fontSize = '0.85em';
                descEl.style.color = 'var(--text-muted)';
            }

            // Evento click
            optionEl.addEventListener('click', () => {
                this.triggerSelection(index);
            });

            // Evento hover
            optionEl.addEventListener('mouseenter', () => {
                this.updateSelection(index);
            });

            // Remover borde del último elemento
            if (index === context.options.length - 1) {
                optionEl.style.borderBottom = 'none';
            }
        });

        // Posicionar el menú
        this.positionMenu(inputEl);
        
        // Mostrar el menú
        this.menuEl.style.display = 'block';
    }

    private positionMenu(inputEl: HTMLInputElement): void {
        if (!this.menuEl) return;

        const inputRect = inputEl.getBoundingClientRect();
        const containerRect = this.containerEl.getBoundingClientRect();

        // Posición relativa al contenedor
        const left = inputRect.left - containerRect.left;
        const top = inputRect.bottom - containerRect.top + 2;

        this.menuEl.style.left = `${left}px`;
        this.menuEl.style.top = `${top}px`;

        // Ajustar si se sale de la pantalla
        const menuRect = this.menuEl.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (menuRect.right > viewportWidth) {
            const adjustedLeft = left - (menuRect.right - viewportWidth) - 10;
            this.menuEl.style.left = `${Math.max(0, adjustedLeft)}px`;
        }

        if (menuRect.bottom > viewportHeight) {
            const adjustedTop = top - menuRect.height - inputRect.height - 4;
            this.menuEl.style.top = `${adjustedTop}px`;
        }
    }

    public updateSelection(index: number): void {
        if (!this.menuEl) return;

        const options = this.menuEl.querySelectorAll('.cascade-menu-option');
        options.forEach((option, i) => {
            if (i === index) {
                option.classList.add('is-selected');
                (option as HTMLElement).style.backgroundColor = 'var(--background-modifier-hover)';
                (option as HTMLElement).style.color = 'var(--text-accent)';
                option.scrollIntoView({ block: 'nearest' });
            } else {
                option.classList.remove('is-selected');
                (option as HTMLElement).style.backgroundColor = '';
                (option as HTMLElement).style.color = '';
            }
        });
    }

    private triggerSelection(index: number): void {
        // Disparar evento personalizado para manejar la selección
        const event = new CustomEvent('cascade-menu-select', {
            detail: { selectedIndex: index }
        });
        this.containerEl.dispatchEvent(event);
    }

    public hideMenu(): void {
        if (this.menuEl) {
            this.menuEl.style.display = 'none';
            this.isVisible = false;
        }
    }

    public isMenuVisible(): boolean {
        return this.isVisible;
    }

    public destroy(): void {
        if (this.menuEl) {
            this.menuEl.remove();
            this.menuEl = null;
        }
    }
}
