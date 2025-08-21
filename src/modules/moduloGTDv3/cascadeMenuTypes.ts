// cascadeMenuTypes.ts
export enum MenuState {
    NORMAL = 'normal',
    MAIN_MENU = 'main_menu',
    CONTEXT_MENU = 'context_menu',
    PERSON_MENU = 'person_menu',
    GTD_MENU = 'gtd_menu',
    PROJECT_MENU = 'project_menu'
}

export interface MenuOption {
    id: string;
    label: string;
    value: string;
    description?: string;
}

export interface MenuContext {
    state: MenuState;
    prefix: string;
    triggerPosition: number;
    options: MenuOption[];
    selectedIndex: number;
}

export interface CascadeMenuConfig {
    mainMenuOptions: MenuOption[];
    contextMenuOptions: MenuOption[];
    personMenuOptions: MenuOption[];
    gtdMenuOptions: MenuOption[];
    projectMenuOptions: MenuOption[];
}
