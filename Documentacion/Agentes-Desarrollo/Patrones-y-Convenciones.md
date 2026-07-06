# Patrones y Convenciones de Código
**Obsidian Dovela Personal Management**

Guía de estándares de código con ejemplos de buenas y malas prácticas.

---

## 📋 Índice

1. [Nomenclatura](#nomenclatura)
2. [Estructura de Archivos](#estructura-de-archivos)
3. [TypeScript](#typescript)
4. [Patrones de Código](#patrones-de-código)
5. [CSS](#css)
6. [Errores Comunes](#errores-comunes)

---

## Nomenclatura

### Archivos

```typescript
// ✅ CORRECTO

// Componentes funcionales
parser.ts
hierarchyBuilder.ts
dateUtils.ts

// Servicios
TimeTrackerService.ts
PomodoroService.ts
AnalyzerService.ts

// Vistas
GtdView.ts
BacklinksView.ts
StatisticsView.ts

// Modales
TimeLogModal.ts
DatePickerModal.ts

// Modelos
model.ts
backlinkModel.ts
journalModel.ts
```

```typescript
// ❌ INCORRECTO

// No usar snake_case
time_tracker_service.ts

// No usar kebab-case
pomodoro-service.ts

// No usar plurales innecesarios
utils.ts  // Usar específico: dateUtils.ts

// No mezclar estilos
Timetracker_Service.ts
```

### Clases e Interfaces

```typescript
// ✅ CORRECTO - PascalCase

class TimeTrackerService { }
interface Task { }
type HierarchicalItemType = 'PGTD' | 'Ax';
enum GtdList { Inbox, NextActions }
```

```typescript
// ❌ INCORRECTO

class timeTrackerService { }  // camelCase
interface task { }            // lowercase
type hierarchicalItemType     // camelCase
```

### Variables y Métodos

```typescript
// ✅ CORRECTO - camelCase

const activeTimer = null;
let isCompleted = false;
function parseVault() { }
async function startTracking() { }
private calculateDuration() { }

// Prefijos descriptivos
function isDatePast(date: string): boolean { }
function hasUnresolvedDependencies(task: Task): boolean { }
function getProcessedData(): ProcessedData { }
function setActiveTimer(timer: ActiveTimer): void { }
```

```typescript
// ❌ INCORRECTO

const ActiveTimer = null;     // PascalCase
let is_completed = false;     // snake_case
function ParseVault() { }     // PascalCase
function start_tracking() { } // snake_case
```

### Constantes

```typescript
// ✅ CORRECTO - SCREAMING_SNAKE_CASE

const GTD_VIEW_TYPE = 'gtd-view';
const DEFAULT_WORK_DURATION = 25;
const SYNC_INTERVAL = 15000;
const MAX_RETRIES = 3;

const DEFAULT_SETTINGS: DovelaPluginData = {
    schemaVersion: 1,
    timeLogs: []
};
```

```typescript
// ❌ INCORRECTO

const gtdViewType = 'gtd-view';        // camelCase
const defaultWorkDuration = 25;        // camelCase
const sync_interval = 15000;           // snake_case (pero no screaming)
```

### CSS Classes

```typescript
// ✅ CORRECTO - kebab-case con prefijo de módulo

.gtd-view-container
.gtd-task-item
.gtd-task--overdue           // BEM modifier
.hierarchy-search-input
.foco-view-container
.backlinks-tree-item
.pomodoro-timer-display
```

```typescript
// ❌ INCORRECTO

.GtdViewContainer            // PascalCase
.gtd_task_item              // snake_case
.task-item                  // Sin prefijo de módulo (riesgo de colisión)
```

---

## Estructura de Archivos

### Organización de Módulos

```
✅ CORRECTO

src/modules/[nombreModulo]/
├── [modulo]Model.ts          # Tipos e interfaces PRIMERO
├── [feature]Parser.ts        # Si extrae datos
├── [feature]Processor.ts     # Si procesa datos
├── [feature]Service.ts       # Lógica de negocio
├── [feature]View.ts          # UI
├── [feature]Modal.ts         # Diálogos
└── [feature]Utils.ts         # Helpers

Ejemplo real: moduloGTDv3/
├── model.ts
├── parser.ts
├── hierarchyBuilder.ts
├── gtdProcessor.ts
├── timeTrackerService.ts
├── gtdView.ts
├── timeLogModal.ts
└── dateUtils.ts
```

```
❌ INCORRECTO

src/modules/[nombreModulo]/
├── everything.ts             # Todo en un archivo
└── helpers.ts                # Nombre genérico

src/
├── gtd.ts                    # No usar módulos
├── foco.ts
└── backlinks.ts
```

### Estructura de Imports

```typescript
// ✅ CORRECTO - Orden específico

// 1. Obsidian APIs
import { Plugin, Notice, WorkspaceLeaf, TFile, ItemView } from 'obsidian';

// 2. Librerías de terceros
import moment from 'moment';
import * as XLSX from 'xlsx';

// 3. Tipos locales
import type { Task, HierarchicalItem, ProcessedVaultData } from './model.js';
import type { DovelaPluginData } from '../../main.js';

// 4. Servicios locales
import { TimeTrackerService } from './timeTrackerService.js';
import { PomodoroService } from './pomodoroService.js';

// 5. Utilidades locales
import { isDatePast, parseDuration } from './dateUtils.js';
import { generateTaskHtml } from './htmlGenerator.js';

// CRÍTICO: Todos los imports locales tienen extensión .js
```

```typescript
// ❌ INCORRECTO

// Sin orden
import { isDatePast } from './dateUtils.js';
import { Plugin } from 'obsidian';
import { TimeTrackerService } from './timeTrackerService.js';
import moment from 'moment';

// Sin extensión .js (error en ESM)
import { Task } from './model';

// Importaciones no usadas
import { SomeUnusedClass } from './unused.js';
```

---

## TypeScript

### Tipos Explícitos

```typescript
// ✅ CORRECTO - Tipos explícitos

interface Task {
    id: string;
    content: string;
    status: 'incomplete' | 'completed' | 'in-progress';
    priority: 'Highest' | 'High' | 'Medium' | 'Low' | 'None';
    date?: string;  // Optional con ?
    contexts: string[];
}

function processTask(task: Task): ProcessedTask {
    return {
        id: task.id,
        displayContent: task.content,
        isOverdue: task.date ? isDatePast(task.date) : false
    };
}

// Tipo de retorno explícito
async function parseVault(vault: Vault, cache: MetadataCache): Promise<{
    allTasks: Task[];
    files: TFile[];
}> {
    // ...
}
```

```typescript
// ❌ INCORRECTO

// any implícito
function processTask(task) {  // Error: Parameter implicitly has 'any' type
    return {
        id: task.id,
        content: task.content
    };
}

// any explícito (evitar a menos que sea necesario)
function doSomething(data: any) {
    // TypeScript no puede ayudar aquí
}

// Sin tipo de retorno
async function parseVault(vault, cache) {
    // ¿Qué retorna esto?
}
```

### Type vs Interface

```typescript
// ✅ Usar Interface para objetos

interface Task {
    id: string;
    content: string;
}

interface ExtendedTask extends Task {
    metadata: Record<string, unknown>;
}

// ✅ Usar Type para unions, primitivos, tuplas

type TaskStatus = 'incomplete' | 'completed' | 'in-progress';
type DateSymbol = '🛫' | '⏳' | '📅';
type Coordinate = [number, number];

// ✅ Type para transformaciones complejas

type ReadonlyTask = Readonly<Task>;
type PartialTask = Partial<Task>;
type TaskKeys = keyof Task;
```

### Nullability

```typescript
// ✅ CORRECTO - Manejar null/undefined explícitamente

function getTask(id: string): Task | null {
    const task = taskMap.get(id);
    return task ?? null;
}

// Validar antes de usar
const task = getTask('123');
if (!task) {
    new Notice('Tarea no encontrada');
    return;
}
// TypeScript sabe que task es Task aquí

// Optional chaining
const fileName = task.sourceFile?.name ?? 'Sin archivo';

// Nullish coalescing
const duration = task.duration ?? '[Sin duración]';
```

```typescript
// ❌ INCORRECTO

function getTask(id: string): Task {
    return taskMap.get(id);  // Puede retornar undefined
}

// No validar null
const task = getTask('123');
console.log(task.content);  // Posible error si task es undefined

// Usar || en lugar de ??
const duration = task.duration || '[Sin duración]';  // Problema si duration es 0 o ''
```

### Enums vs Union Types

```typescript
// ✅ Preferir Union Types para strings

type TaskStatus = 'incomplete' | 'completed' | 'in-progress';
type Priority = 'Highest' | 'High' | 'Medium' | 'Low' | 'None';

// ✅ Enum solo si necesitas valores numéricos o métodos

enum GtdList {
    Inbox = 'Bandeja de Entrada',
    NextActions = 'Próximas Acciones',
    Calendar = 'Calendario'
}

// Puedes iterar
Object.values(GtdList).forEach(listName => { ... });
```

---

## Patrones de Código

### Vistas (ItemView)

```typescript
// ✅ CORRECTO - Patrón estándar de vista

import { ItemView, WorkspaceLeaf } from 'obsidian';
import type { DovelaPersonalManagementPlugin } from '../../main.js';

export const FEATURE_VIEW_TYPE = 'feature-view';

export class FeatureView extends ItemView {
    private plugin: DovelaPersonalManagementPlugin;
    private eventAbortController: AbortController | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: DovelaPersonalManagementPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return FEATURE_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Feature Display Name';
    }

    override getIcon(): string {
        return 'icon-name';
    }

    override async onOpen(): Promise<void> {
        await this.drawView();
        this.registerEvents();
    }

    override async onClose(): Promise<void> {
        this.cleanup();
    }

    private async drawView(): Promise<void> {
        this.contentEl.empty();
        this.contentEl.addClass('feature-view-container');

        // Rendering logic
        const header = this.contentEl.createEl('h2', {
            text: 'Feature View'
        });

        // ... más rendering
    }

    private registerEvents(): void {
        this.eventAbortController = new AbortController();

        // Event delegation
        this.contentEl.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;

            if (target.matches('.feature-button')) {
                await this.handleButtonClick(target);
            }
        }, { signal: this.eventAbortController.signal });
    }

    private async handleButtonClick(button: HTMLElement): Promise<void> {
        // Handle click
    }

    private cleanup(): void {
        this.eventAbortController?.abort();
        this.contentEl.empty();
    }
}
```

```typescript
// ❌ INCORRECTO

export class FeatureView extends ItemView {
    constructor(leaf: WorkspaceLeaf, plugin: any) {  // ❌ any
        super(leaf);
        this.plugin = plugin;
    }

    // ❌ Sin tipos de retorno
    getViewType() {
        return 'feature-view';
    }

    // ❌ Sin override keyword
    async onOpen() {
        this.drawView();  // ❌ Sin await
    }

    // ❌ No limpia recursos
    async onClose() {
        // Vacío - memory leak de event listeners
    }

    drawView() {  // ❌ Debería ser async
        const header = this.contentEl.createEl('h2');
        header.textContent = 'Feature';

        // ❌ Múltiples listeners en lugar de delegation
        const buttons = this.contentEl.querySelectorAll('.feature-button');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.handleClick();
            });
        });
    }
}
```

### Servicios

```typescript
// ✅ CORRECTO - Servicio sin estado

export class FeatureService {
    constructor(private plugin: DovelaPersonalManagementPlugin) {}

    async addEntry(data: EntryData): Promise<void> {
        // 1. Validar entrada
        if (!this.validateEntry(data)) {
            new Notice('Error: datos inválidos');
            return;
        }

        // 2. Crear entry con ID
        const entry: Entry = {
            id: Date.now().toString(),
            ...data,
            createdAt: moment().toISOString()
        };

        // 3. Modificar plugin.data (estado central)
        this.plugin.data.entries.push(entry);

        // 4. Persistir
        await this.plugin.savePluginData();

        // 5. Sincronizar vistas (si aplica)
        this.plugin.refreshFeatureViews();
    }

    getEntries(filter?: (entry: Entry) => boolean): Entry[] {
        const entries = this.plugin.data.entries;
        return filter ? entries.filter(filter) : entries;
    }

    private validateEntry(data: EntryData): boolean {
        return !!(data.title && data.content);
    }
}
```

```typescript
// ❌ INCORRECTO

export class FeatureService {
    // ❌ Estado local en servicio (dificulta sync)
    private entries: Entry[] = [];

    constructor(private plugin: any) {  // ❌ any
        this.loadEntries();  // ❌ Async en constructor
    }

    // ❌ Sin validación
    addEntry(data: any) {  // ❌ any, sin async
        const entry = { id: Date.now(), ...data };
        this.entries.push(entry);
        // ❌ No persiste
    }

    // ❌ Sin tipo de retorno
    getEntries() {
        return this.entries;
    }
}
```

### Event Handling

```typescript
// ✅ CORRECTO - Event delegation con AbortController

private registerEvents(): void {
    this.eventAbortController = new AbortController();
    const signal = this.eventAbortController.signal;

    // Un solo listener, maneja múltiples targets
    this.contentEl.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;

        if (target.matches('.task-checkbox')) {
            await this.handleTaskCheckbox(target);
        } else if (target.matches('.task-link')) {
            await this.handleTaskLink(target);
        } else if (target.matches('.delete-button')) {
            await this.handleDelete(target);
        }
    }, { signal });

    // Inputs separados (necesario para eventos específicos)
    this.contentEl.querySelectorAll('input[type="text"]').forEach(input => {
        input.addEventListener('input', (e) => {
            this.handleInputChange(e);
        }, { signal });
    });
}

private cleanup(): void {
    // Limpia TODOS los listeners de una vez
    this.eventAbortController?.abort();
    this.contentEl.empty();
}
```

```typescript
// ❌ INCORRECTO

private registerEvents() {
    // ❌ Múltiples listeners (ineficiente, posible memory leak)
    const checkboxes = this.contentEl.querySelectorAll('.task-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('click', async () => {
            await this.handleTaskCheckbox(checkbox);
        });
        // ❌ No hay forma de remover estos listeners
    });

    const links = this.contentEl.querySelectorAll('.task-link');
    links.forEach(link => {
        link.addEventListener('click', () => {
            this.handleTaskLink(link);
        });
    });
}

// ❌ No limpia listeners
onClose() {
    this.contentEl.empty();  // Solo vacía el DOM, listeners quedan en memoria
}
```

### Gestión de Estado

```typescript
// ✅ CORRECTO - Estado centralizado

// En servicio
async updateTimer(newState: ActiveTimerState): Promise<void> {
    // 1. Modificar estado central
    this.plugin.data.activeTimer = newState;

    // 2. Persistir inmediatamente
    await this.plugin.savePluginData();

    // 3. Sincronizar vistas
    this.plugin.refreshAllTimerViews();
}

// En vista
async loadData(): Promise<void> {
    // Leer del estado central
    const timer = this.plugin.data.activeTimer;

    if (timer) {
        this.renderActiveTimer(timer);
    }
}
```

```typescript
// ❌ INCORRECTO

export class FeatureView extends ItemView {
    // ❌ Estado local duplicado
    private localTimer: ActiveTimerState | null = null;

    async updateTimer(newState: ActiveTimerState) {
        // ❌ Solo actualiza local, no persiste
        this.localTimer = newState;
        this.render();
        // ❌ Otros dispositivos no ven el cambio
        // ❌ Se pierde al cerrar vista
    }
}
```

### Parsing de Markdown

```typescript
// ✅ CORRECTO - Regex bien estructurado

function parseTasks(content: string, sourceFile: TFile): Task[] {
    const tasks: Task[] = [];
    const lines = content.split('\n');

    lines.forEach((line, lineNumber) => {
        // Checkbox: - [ ] o - [x]
        const checkboxMatch = line.match(/^\s*[-*]\s+\[([xX ])\]/);
        if (!checkboxMatch) return;

        const isCompleted = checkboxMatch[1].toLowerCase() === 'x';

        // Prioridad
        const prioritySymbol = line.match(/\s*(⏫|🔼|🔽|⏬)/)?.[1];
        const priority = PRIORITY_MAP[prioritySymbol ?? ''] ?? 'None';

        // Fecha con símbolo
        const dateMatch = line.match(/(🛫|⏳|📅)\s*(\d{4}-\d{2}-\d{2})/);
        const dateSymbol = dateMatch?.[1] as DateSymbol | undefined;
        const date = dateMatch?.[2];

        // Duración
        const durationMatch = line.match(/\[(\d+(?:min|h))\]/);
        const duration = durationMatch?.[1];

        // Contextos #cx-
        const contexts = [...line.matchAll(/#cx-(\w+)/g)]
            .map(m => `#cx-${m[1]}`);

        // Personas #px-
        const people = [...line.matchAll(/#px-(\w+)/g)]
            .map(m => `#px-${m[1]}`);

        // Dependencias ⛔ ID
        const dependencies = [...line.matchAll(/⛔\s*(\^?[a-zA-Z0-9-_]+)/g)]
            .map(m => m[1].replace(/^\^/, ''));

        // Contenido limpio (sin metadata)
        const content = line
            .replace(/^\s*[-*]\s+\[[xX ]\]\s*/, '')
            .replace(/\s*(⏫|🔼|🔽|⏬)/, '')
            .replace(/(🛫|⏳|📅)\s*\d{4}-\d{2}-\d{2}/, '')
            .replace(/\[\d+(?:min|h)\]/, '')
            .replace(/#cx-\w+/g, '')
            .replace(/#px-\w+/g, '')
            .replace(/⛔\s*\^?[a-zA-Z0-9-_]+/g, '')
            .trim();

        tasks.push({
            id: `${sourceFile.path}:${lineNumber}`,
            content,
            status: isCompleted ? 'completed' : 'incomplete',
            priority,
            date,
            dateSymbol,
            duration,
            contexts,
            assignedPeople: people,
            dependencies,
            sourceFile,
            lineNumber
        });
    });

    return tasks;
}

const PRIORITY_MAP: Record<string, Task['priority']> = {
    '⏫': 'Highest',
    '🔼': 'High',
    '🔽': 'Low',
    '⏬': 'Lowest'
};
```

```typescript
// ❌ INCORRECTO

function parseTasks(content, file) {  // ❌ Sin tipos
    const tasks = [];
    const lines = content.split('\n');

    for (const line of lines) {
        // ❌ Regex frágil, hardcodeado
        if (line.includes('- [ ]') || line.includes('- [x]')) {
            const task: any = {};  // ❌ any

            // ❌ Sin validación de match
            task.priority = line.match(/⏫/) ? 'High' : 'Normal';

            // ❌ Asume que siempre hay match
            task.date = line.match(/\d{4}-\d{2}-\d{2}/)[0];

            tasks.push(task);
        }
    }

    return tasks;
}
```

### Error Handling

```typescript
// ✅ CORRECTO

async function saveData(data: PluginData): Promise<void> {
    try {
        const json = JSON.stringify(data, null, 2);
        await this.app.vault.adapter.write(this.dataFilePath, json);
    } catch (error) {
        console.error('Dovela PM: Error saving data', error);
        new Notice('Error al guardar configuración');
        // No re-throw a menos que sea necesario
    }
}

// Validación con guard clauses
function processTask(task: Task | null): ProcessedTask | null {
    if (!task) {
        console.warn('Dovela PM: Task is null');
        return null;
    }

    if (!task.sourceFile) {
        console.warn('Dovela PM: Task missing source file', task.id);
        return null;
    }

    // Procesamiento
    return {
        id: task.id,
        display: generateDisplay(task)
    };
}
```

```typescript
// ❌ INCORRECTO

async function saveData(data) {
    // ❌ Sin try-catch (crash si falla)
    const json = JSON.stringify(data);
    await this.app.vault.adapter.write(this.dataFilePath, json);
}

function processTask(task) {
    // ❌ No valida null
    return {
        id: task.id,  // Crash si task es null
        display: generateDisplay(task.sourceFile)  // Crash si sourceFile es undefined
    };
}

async function fetchData() {
    try {
        const data = await fetch(url);
        return data;
    } catch (error) {
        // ❌ Catch vacío (oculta errores)
    }
}
```

---

## CSS

### Nomenclatura BEM con Prefijos

```css
/* ✅ CORRECTO */

/* Bloque con prefijo de módulo */
.gtd-view-container { }
.gtd-task-list { }

/* Elemento */
.gtd-task-list__item { }
.gtd-task-list__header { }

/* Modificador */
.gtd-task-list__item--completed { }
.gtd-task-list__item--overdue { }
.gtd-task-list__item--high-priority { }

/* Estados */
.gtd-task-list__item.is-selected { }
.gtd-task-list__item.is-dragging { }
```

```css
/* ❌ INCORRECTO */

/* Sin prefijo (riesgo de colisión) */
.task-list { }

/* CamelCase */
.gtdTaskList { }

/* snake_case */
.gtd_task_list { }

/* Anidamiento excesivo (dificulta override) */
.gtd-view-container .task-list .item .content .text { }
```

### Especificidad

```css
/* ✅ CORRECTO - Especificidad baja, fácil override */

.gtd-task-item {
    padding: 8px;
    border: 1px solid var(--background-modifier-border);
}

.gtd-task-item--completed {
    opacity: 0.5;
    text-decoration: line-through;
}

/* Override específico cuando sea necesario */
.gtd-view-container .gtd-task-item--high-priority {
    border-left: 3px solid var(--text-error);
}
```

```css
/* ❌ INCORRECTO - Especificidad alta */

div.gtd-view-container > div.task-list > div.task-item#task-123 {
    /* Muy difícil de hacer override */
}

/* !important innecesario */
.gtd-task-item {
    padding: 8px !important;
}
```

### Variables CSS

```css
/* ✅ CORRECTO - Usar variables de Obsidian */

.gtd-task-item {
    color: var(--text-normal);
    background: var(--background-primary);
    border-color: var(--background-modifier-border);
}

.gtd-task-item--overdue {
    color: var(--text-error);
    background: var(--background-modifier-error);
}

/* Variables custom si es necesario */
:root {
    --gtd-priority-highest: #ff6b6b;
    --gtd-priority-high: #ffa500;
}
```

```css
/* ❌ INCORRECTO - Colores hardcoded */

.gtd-task-item {
    color: #000000;  /* No respeta tema oscuro */
    background: #ffffff;
}

.gtd-task-item--overdue {
    color: red;  /* No se adapta a theme del usuario */
}
```

---

## Errores Comunes

### Error 1: Imports sin extensión .js

```typescript
// ❌ ERROR
import { Task } from './model';

// Error: Cannot find module './model'
// ESM requiere extensión explícita
```

```typescript
// ✅ SOLUCIÓN
import { Task } from './model.js';
```

### Error 2: Async en constructor

```typescript
// ❌ ERROR
export class FeatureView extends ItemView {
    constructor(leaf: WorkspaceLeaf, plugin: DovelaPersonalManagementPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.loadData();  // Async, no puedes await aquí
    }

    async loadData() {
        const data = await this.plugin.loadPluginData();
    }
}
```

```typescript
// ✅ SOLUCIÓN
export class FeatureView extends ItemView {
    constructor(leaf: WorkspaceLeaf, plugin: DovelaPersonalManagementPlugin) {
        super(leaf);
        this.plugin = plugin;
        // NO llamar async en constructor
    }

    override async onOpen() {
        await this.loadData();  // Aquí sí puedes await
        await this.drawView();
    }

    async loadData() {
        const data = await this.plugin.loadPluginData();
    }
}
```

### Error 3: Modificar plugin.data sin savePluginData()

```typescript
// ❌ ERROR - Cambios no persisten
this.plugin.data.activeTimer = newTimer;
// ← ¡Falta save!
```

```typescript
// ✅ SOLUCIÓN
this.plugin.data.activeTimer = newTimer;
await this.plugin.savePluginData();  // ← CRÍTICO
```

### Error 4: Memory leak de event listeners

```typescript
// ❌ ERROR
override async onOpen() {
    const button = this.contentEl.createEl('button');
    button.addEventListener('click', () => {
        console.log('clicked');
    });
    // ← Listener nunca se remueve
}

override async onClose() {
    this.contentEl.empty();  // Solo vacía DOM, listener persiste
}
```

```typescript
// ✅ SOLUCIÓN 1: AbortController
private eventAbortController: AbortController | null = null;

override async onOpen() {
    this.eventAbortController = new AbortController();

    const button = this.contentEl.createEl('button');
    button.addEventListener('click', () => {
        console.log('clicked');
    }, { signal: this.eventAbortController.signal });
}

override async onClose() {
    this.eventAbortController?.abort();  // Remueve TODOS los listeners
    this.contentEl.empty();
}
```

```typescript
// ✅ SOLUCIÓN 2: Event delegation (preferido)
override async onOpen() {
    this.contentEl.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).matches('button')) {
            console.log('clicked');
        }
    });
}

override async onClose() {
    this.contentEl.empty();  // Event delegation se limpia automáticamente
}
```

### Error 5: Usar any en lugar de tipos específicos

```typescript
// ❌ ERROR
function processData(data: any): any {
    return data.items.map(item => item.value);
    // TypeScript no puede ayudar aquí
}
```

```typescript
// ✅ SOLUCIÓN
interface DataItem {
    id: string;
    value: number;
}

interface InputData {
    items: DataItem[];
}

function processData(data: InputData): number[] {
    return data.items.map(item => item.value);
    // TypeScript valida todo
}
```

---

## Checklist de Revisión de Código

Antes de marcar una tarea como completada:

### TypeScript
- [ ] Todos los tipos son explícitos (no any implícitos)
- [ ] Interfaces/tipos están definidos en archivos model.ts
- [ ] Imports tienen extensión .js
- [ ] No hay errores de compilación
- [ ] Tipos de retorno explícitos en funciones públicas

### Nomenclatura
- [ ] Archivos: camelCase.ts, PascalCaseService.ts
- [ ] Clases: PascalCase
- [ ] Variables/métodos: camelCase
- [ ] Constantes: SCREAMING_SNAKE_CASE
- [ ] CSS: kebab-case con prefijo módulo

### Patrones
- [ ] Vistas heredan de ItemView
- [ ] Servicios sin estado local
- [ ] Event delegation en lugar de múltiples listeners
- [ ] AbortController para cleanup de eventos
- [ ] Validación de entrada en servicios
- [ ] Estado modificado → savePluginData() → refresh views

### Recursos
- [ ] onClose() limpia event listeners
- [ ] No hay memory leaks
- [ ] No hay console.log en código final

### Calidad
- [ ] Código compila sin errores ni warnings
- [ ] Testing manual realizado
- [ ] No rompe funcionalidad existente

---

**Última actualización: 2025-10-24**
**Versión: 1.0**
