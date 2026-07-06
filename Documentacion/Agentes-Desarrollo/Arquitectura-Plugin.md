# Arquitectura del Plugin
**Obsidian Dovela Personal Management**

Documentación técnica de referencia rápida sobre la arquitectura del plugin.

---

## 📋 Índice

1. [Visión General](#visión-general)
2. [Estructura de Archivos](#estructura-de-archivos)
3. [Módulos Principales](#módulos-principales)
4. [Flujos de Datos](#flujos-de-datos)
5. [Referencia Rápida](#referencia-rápida)

---

## Visión General

### Arquitectura de Alto Nivel

```
┌──────────────────────────────────────────────────────────────┐
│                    DovelaPersonalManagementPlugin            │
│                     (main.ts - Orquestador)                  │
│                                                              │
│  Estado Global: data.json                                    │
│  Servicios: TimeTracker, Pomodoro, Analyzer, etc.           │
│  Metadata Cache: Proyectos, Contextos, Personas             │
└──────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  MÓDULO GTD   │     │  MÓDULO FOCO  │     │ BACKLINKS     │
│  (33 archivos)│     │  (9 archivos) │     │ (5 archivos)  │
│               │     │               │     │               │
│ - Parser      │     │ - Espejo GTD  │     │ - Detector    │
│ - Hierarchy   │     │ - Enfocado    │     │ - Vista árbol │
│ - Processor   │     │ - Un archivo  │     │ - Breadcrumb  │
│ - Views (6)   │     │               │     │               │
│ - Services    │     │               │     │               │
└───────────────┘     └───────────────┘     └───────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐
│  JOURNAL      │     │  ACTIVIDAD    │
│  (4 archivos) │     │  (2 archivos) │
│               │     │               │
│ - API         │     │ - Analytics   │
│ - Renderer    │     │ - Stats View  │
│ - PathHelper  │     │               │
└───────────────┘     └───────────────┘
```

### Principios Arquitectónicos

1. **Plugin como Orquestador Central**
   - main.ts coordina todos los módulos
   - Estado compartido en plugin.data
   - Servicios inyectados a vistas

2. **Separación de Responsabilidades**
   - Parser → Hierarchy → Processor → Generator → View
   - Cada módulo es independiente
   - Comunicación vía plugin principal

3. **Vistas Componibles**
   - Vistas principales contienen sub-vistas
   - Ej: GtdView tiene TimeTrackerView, StatisticsView
   - Reutilización de componentes

4. **Sincronización Cross-Device**
   - Estado persistido en data.json
   - Sync loop cada 15 segundos
   - Detección automática de cambios externos

---

## Estructura de Archivos

### Mapa de Navegación

```
src/
├── main.ts                          ⭐ ENTRADA PRINCIPAL
│
└── modules/
    │
    ├── moduloGTDv3/                 📦 CORE GTD (33 archivos)
    │   ├── model.ts                 ← Tipos e interfaces centrales
    │   ├── parser.ts                ← Extracción de tareas (80+ regex)
    │   ├── hierarchyBuilder.ts      ← Árbol de carpetas/notas
    │   ├── gtdProcessor.ts          ← Clasificación en listas GTD
    │   ├── inProgressProcessor.ts   ← Tareas en progreso
    │   ├── htmlGenerator.ts         ← Templates HTML
    │   │
    │   ├── gtdView.ts               ← Vista principal GTD
    │   ├── timeTrackerView.ts       ← Sub-vista: Time Tracker
    │   ├── statisticsView.ts        ← Sub-vista: Estadísticas
    │   ├── timelineView.ts          ← Sub-vista: Timeline
    │   ├── reviewPanelView.ts       ← Vista: Review Panel
    │   ├── smartInboxView.ts        ← Modal: Captura rápida
    │   │
    │   ├── timeTrackerService.ts    ← Servicio: Gestión de tiempo
    │   ├── pomodoroService.ts       ← Servicio: Pomodoro
    │   ├── analyzerService.ts       ← Servicio: Analytics
    │   ├── stalledProjectService.ts ← Servicio: Proyectos estancados
    │   ├── taskStateManager.ts      ← Servicio: Estado de tareas
    │   │
    │   ├── timeLogModal.ts          ← Modal: Logging de tiempo
    │   ├── pomodoroModal.ts         ← Modal: Fin de Pomodoro
    │   ├── datePickerModal.ts       ← Modal: Selector de fechas
    │   │
    │   └── [utils/managers/...]     ← Utilidades varias
    │
    ├── moduloFoco/                  📦 VISTA FOCO (9 archivos)
    │   ├── focoView.ts              ← Espejo de gtdView
    │   ├── focoParser.ts            ← Parser limitado a 1 archivo
    │   ├── focoHierarchyBuilder.ts  ← Hierarchy de 1 archivo
    │   ├── focoProcessor.ts         ← GTD lists de 1 archivo
    │   ├── focoHtmlGenerator.ts     ← HTML generator
    │   ├── focoModel.ts             ← Tipos (igual a GTD)
    │   ├── focoSettings.ts          ← Configuración
    │   └── [utils]
    │
    ├── moduloBacklinks/             📦 BACKLINKS (5 archivos)
    │   ├── backlinkView.ts          ← Vista principal
    │   ├── backlinkDetector.ts      ← Detecta referencias
    │   ├── backlinkModel.ts         ← Tipos
    │   ├── breadcrumbRenderer.ts    ← Renderizado de breadcrumbs
    │   └── backlinkSettings.ts      ← Configuración
    │
    ├── moduloJournal/               📦 JOURNAL API (4 archivos)
    │   ├── journalAPI.ts            ← API para DataviewJS
    │   ├── journalModel.ts          ← Tipos
    │   ├── journalPathHelper.ts     ← Generación de rutas
    │   └── journalTaskRenderer.ts   ← Renderizado de tareas
    │
    ├── moduloActividad/             📦 ACTIVIDAD (2 archivos)
    │   ├── activityView.ts          ← Vista de analytics
    │   └── analyzerService.ts       ← Análisis de logs
    │
    └── styles/                      🎨 ESTILOS
        └── [varios .css]
```

### Archivos de Configuración

| Archivo | Propósito |
|---------|-----------|
| `package.json` | Dependencias, scripts (dev, build) |
| `tsconfig.json` | TypeScript ES2024, React-JSX |
| `manifest.json` | Metadata del plugin Obsidian |
| `styles.css` | Estilos globales |
| `.env` | Variables de entorno |

---

## Módulos Principales

### 1. Módulo GTD (moduloGTDv3)

**Propósito:** Sistema completo de gestión de tareas GTD

**Pipeline de Procesamiento:**
```
markdown files
    ↓
parser.ts (extrae tareas con regex)
    ↓
hierarchyBuilder.ts (construye árbol)
    ↓
gtdProcessor.ts (clasifica en 10 listas)
    ↓
htmlGenerator.ts (genera templates)
    ↓
gtdView.ts (renderiza en DOM)
```

**Tipos de Items Jerárquicos (21 tipos):**
```typescript
type HierarchicalItemType =
  | 'GrupoAV' | 'AV' | 'AI' | 'Root'           // Estructurales
  | 'PGTD' | 'PQ' | 'RR' | 'Tx' | 'Vx' | 'Reu' // Por prefijo
  | 'Rf' | 'Sue' | 'Cp' | 'EMkt' | 'RT' | 'RL'
  | 'Ax'                                        // Nota estándar
  | 'Dly' | 'Wk' | 'M' | 'Q' | 'H' | 'Y';       // Journal
```

**Listas GTD (10 listas):**
1. Bandeja de Entrada (Inbox)
2. Próximas Acciones (Next Actions)
3. Calendario (Calendar)
4. En Espera (Waiting For)
5. Algún Día/Tal Vez (Someday/Maybe)
6. Proyectos (Projects)
7. Tareas en Progreso (In Progress)
8. Completadas Hoy (Completed Today)
9. Bloqueadas (Blocked)
10. Vencidas (Overdue)

**Metadata de Tareas:**
```markdown
- [ ] Tarea ⏫ 🛫 2025-10-31 [2h] #cx-oficina #px-andres ⛔ task-123

Símbolos:
- Prioridad: ⏫ (Highest), 🔼 (High), 🔽 (Low), ⏬ (Lowest)
- Fechas: 🛫 (start), ⏳ (due), 📅 (scheduled)
- Duración: [30min], [2h]
- Contexto: #cx-*
- Persona: #px-*
- Dependencia: ⛔ task-id
```

**Vistas Integradas:**
```
GtdView (vista principal)
├── Hierarchy (árbol de proyectos)
├── GTD Lists (10 listas)
├── In Progress (tareas activas)
├── TimeTrackerView (time tracking)
├── StatisticsView (gráficos)
└── TimelineView (línea temporal)
```

**Servicios:**
- `TimeTrackerService` - Gestión de sesiones de tiempo
- `PomodoroService` - Técnica Pomodoro
- `AnalyzerService` - Analytics y estadísticas
- `StalledProjectService` - Proyectos estancados
- `TaskStateManager` - Estado de tareas

---

### 2. Módulo Foco (moduloFoco)

**Propósito:** Vista enfocada en un solo archivo

**Relación con GTD:**
- Espejo exacto de moduloGTDv3
- Mismo pipeline (parser → hierarchy → processor → generator → view)
- Diferencia: Contexto limitado a 1 archivo

**Casos de uso:**
- Enfocarse en un proyecto específico
- Evitar distracción de otras tareas
- Vista simplificada

---

### 3. Módulo Backlinks (moduloBacklinks)

**Propósito:** Vista de referencias bidireccionales

**Lógica de Detección:**
```typescript
// Un item es backlink si:
1. Está en la misma carpeta que el archivo actual
2. Tiene un link directo al archivo actual
```

**Características:**
- Vista en árbol expandible
- Sorting por nombre/tipo/fecha/estado
- Breadcrumb navigation
- Tabla de referencias

---

### 4. Módulo Journal (moduloJournal)

**Propósito:** API para renderizar tareas en notas diarias

**Estructura de Carpetas:**
```
Journal/
├── 2025/
│   ├── Q1/
│   │   ├── 01/
│   │   │   ├── 01.md  (2025-01-01)
│   │   │   ├── 02.md
│   │   │   └── ...
│   │   ├── 02/
│   │   └── 03/
│   ├── Q2/
│   └── ...
```

**API Expuesta:**
```typescript
journalAPI.renderTasksForDate('2025-10-24')
journalAPI.getTaskCounts('2025-10-24')
journalAPI.getDailyNotePath('2025-10-24')
```

**Uso en DataviewJS:**
```javascript
dv.container.appendChild(
    await app.plugins.plugins['obsidian-dovela-personal-management']
        .journalAPI.renderTasksForDate('2025-10-24')
);
```

---

### 5. Módulo Actividad (moduloActividad)

**Propósito:** Analytics y estadísticas de actividad

**Métricas:**
- Tiempo total por proyecto
- Distribución por contexto
- Tendencias temporales
- Heatmap de actividad

---

## Flujos de Datos

### Flujo 1: Renderizado de Vista GTD

```
Usuario abre vista GTD
    ↓
GtdView.onOpen()
    ↓
drawView()
    ↓
parseVault(vault, metadataCache)
    ├─ Lee todos los .md files
    ├─ Extrae tareas con regex (parser.ts)
    └─ Retorna: allTasks[], files[]
    ↓
buildHierarchy(items)
    ├─ Construye árbol de carpetas/notas
    ├─ Ordena por tipo → estado → fecha
    └─ Calcula conteos recursivos
    ↓
processGtdLists(allTasks)
    ├─ Clasifica tareas en 10 listas GTD
    ├─ Determina displayStatus (overdue, today, future)
    └─ Retorna: ProcessedVaultData
    ↓
generateGtdViewHtml(data, grouping, sorting)
    ├─ Renderiza HTML con templates
    ├─ Aplica agrupación (none, context, person, project)
    └─ Aplica sorting (priority, duration)
    ↓
contentEl.innerHTML = html
registerEventListeners()
```

### Flujo 2: Time Tracking

```
Usuario: Click "Start Tracking" en TimeTrackerView
    ↓
TimeTrackerView.startTracking(taskPath, description)
    ↓
plugin.startTracking(taskPath, description)
    ├─ Crear ActiveTimerState { startTime, taskPath, taskDescription }
    ├─ plugin.data.activeTimer = state
    ├─ await plugin.savePluginData() → data.json
    ├─ plugin.initializeTimerFromState()
    │   ├─ startInterval(1s) → actualizar elapsed time
    │   ├─ updateStatusBar() → mostrar tiempo en barra
    │   └─ refreshAllTimerViews() → actualizar UI
    └─ Estado visible en GtdView + FocoView

    ┌─────────────────────────────────────────────────┐
    │ Sync Loop (cada 15s)                            │
    │                                                 │
    │ syncTimerStateWithFile()                        │
    │  ├─ Leer data.json del disco                    │
    │  ├─ Comparar con estado en memoria              │
    │  └─ Si cambió → actualizar UI                   │
    │     (permite sync entre dispositivos)           │
    └─────────────────────────────────────────────────┘

Usuario: Click "Stop Tracking"
    ↓
plugin.stopTracking()
    ├─ Calcular duration
    ├─ Abrir TimeLogModal
    │   └─ Usuario confirma: proyecto, tarea, notas
    ├─ timeTrackerService.addLogEntry(entryData)
    │   ├─ plugin.data.timeLogs.push(entry)
    │   └─ await plugin.savePluginData()
    ├─ plugin.clearActiveTimer()
    │   ├─ plugin.data.activeTimer = undefined
    │   └─ await plugin.savePluginData()
    └─ refreshAllTimerViews()
```

### Flujo 3: Pomodoro

```
Usuario: Inicia Pomodoro en tarea
    ↓
pomodoroService.startWorkSession(taskPath, taskDescription)
    ├─ Crear PomodoroSession { type: 'work', duration: 25min, ... }
    ├─ plugin.data.activePomodoroSession = session
    ├─ await plugin.savePluginData()
    ├─ setInterval(1s) → decrementar remainingTime
    └─ onTick() → actualizar UI

    [Usuario trabaja 25 minutos]

Pomodoro completa
    ↓
pomodoroService.onComplete()
    ↓
plugin.handlePomodoroComplete(completedSession)
    ↓
PomodoroModal.open()
    └─ Opciones:
        ├─ Continue Work → nuevo work session
        ├─ Short Break → 5min break
        ├─ Long Break → 15min break
        ├─ Work More → agregar tiempo
        └─ Finish → cerrar tarea

Usuario: "Finish"
    ↓
pomodoroService.closeSessionTask(session)
    ├─ timeTrackerService.addLogEntry({ duration: 25min, ... })
    ├─ taskStateManager.completeTask(taskPath)
    │   └─ Marca tarea como [x] en archivo
    ├─ plugin.clearActivePomodoroSession()
    └─ refreshAllGtdAndFocoViews()
```

### Flujo 4: Smart Inbox (Captura Rápida)

```
Usuario: Comando "Smart Inbox"
    ↓
SmartInboxView.open()
    ├─ Modal con input de texto
    └─ CascadeMenuManager activo

Usuario: Escribe "@PGTD Proyecto"
    ↓
CascadeMenuManager.handleInput()
    ├─ Detecta "@" → trigger cascade
    ├─ Busca en plugin.gtdProjectsAndAreas (metadata cache)
    └─ Renderiza sugerencias

Usuario: Selecciona proyecto
    ↓
cascadeMenuRenderer.insertTaskToFile()
    ├─ Inserta tarea en archivo activo
    └─ vault.modify(file, newContent)

vault.modify() dispara evento
    ↓
plugin.handleFileChange()
    ├─ collectMetadata() → actualiza gtdProjectsAndAreas
    └─ refreshCascadeMenuConfig()
```

### Flujo 5: Persistencia de Datos

```
Modificación de Estado
    ↓
plugin.data.[field] = newValue  (en memoria)
    ↓
await plugin.savePluginData()
    ├─ JSON.stringify(plugin.data)
    └─ vault.adapter.write('data.json', json)

    ┌──────────────────────────────────────┐
    │ Dispositivo A (activo)               │
    │  - Modifica plugin.data              │
    │  - Guarda a data.json                │
    └──────────────────────────────────────┘
              │
              ▼ (data.json compartido)
    ┌──────────────────────────────────────┐
    │ Dispositivo B (pasivo)               │
    │  - syncInterval (15s)                │
    │  - Lee data.json                     │
    │  - Detecta cambio                    │
    │  - Actualiza UI                      │
    └──────────────────────────────────────┘
```

---

## Referencia Rápida

### Dónde Encontrar Cosas

| Necesito... | Ver archivo... |
|-------------|----------------|
| Definir nuevos tipos | `src/modules/[modulo]/model.ts` |
| Parsear markdown | `src/modules/moduloGTDv3/parser.ts` |
| Crear vista | `src/modules/moduloGTDv3/gtdView.ts` (referencia) |
| Crear servicio | `src/modules/moduloGTDv3/timeTrackerService.ts` (referencia) |
| Crear modal | `src/modules/moduloGTDv3/timeLogModal.ts` (referencia) |
| Generar HTML | `src/modules/moduloGTDv3/htmlGenerator.ts` |
| Trabajar con fechas | `moment` (importar de 'moment') |
| Registrar vistas/comandos | `src/main.ts` (onload) |
| Settings UI | `src/main.ts` (DovelaSettingsTab) |
| Persistir datos | `plugin.data` + `plugin.savePluginData()` |

### APIs de Obsidian Usadas

| API | Uso |
|-----|-----|
| `Plugin` | Clase base del plugin |
| `ItemView` | Vistas personalizadas |
| `Modal` | Diálogos |
| `PluginSettingTab` | Panel de settings |
| `Vault` | Leer/escribir archivos |
| `MetadataCache` | Frontmatter, tags, links |
| `Workspace` | Gestión de hojas y vistas |
| `TFile` / `TFolder` | Objetos de archivo |
| `Menu` | Menú contextual |
| `Notice` | Notificaciones toast |

### Constantes Importantes

```typescript
// View Types
GTD_VIEW_TYPE = 'gtd-view'
FOCO_VIEW_TYPE = 'foco-gtd-view'
BACKLINKS_VIEW_TYPE = 'dovela-backlinks-view'
ACTIVITY_VIEW_TYPE = 'activity-view'
REVIEW_PANEL_VIEW_TYPE = 'review-panel'

// Sync Interval
SYNC_INTERVAL = 15000 // 15 segundos

// Pomodoro Defaults
DEFAULT_WORK_DURATION = 25 // minutos
DEFAULT_SHORT_BREAK = 5
DEFAULT_LONG_BREAK = 15
```

### Interfaces Clave

```typescript
interface Task {
    id: string;
    content: string;
    status: 'incomplete' | 'completed' | 'in-progress';
    priority: 'Highest' | 'High' | 'Medium' | 'Low' | 'None';
    date?: string;
    dateSymbol?: '🛫' | '⏳' | '📅';
    duration?: string;
    dependencies: string[];
    contexts: string[];
    assignedPeople: string[];
    sourceFile: TFile;
    lineNumber: number;
}

interface HierarchicalItem {
    id: string;
    type: HierarchicalItemType;
    name: string;
    file?: TFile;
    children: HierarchicalItem[];
    tasks: Task[];
    ownTaskCount: number;
    descendantTaskCount: number;
    frontmatter: Record<string, any>;
}

interface DovelaPluginData {
    schemaVersion: number;
    timeLogs: TimeLogEntry[];
    activeTimer?: ActiveTimerState;
    activePomodoroSession?: PomodoroSession;
    journalSettings?: JournalSettings;
    pomodoroSettings?: PomodoroSettings;
}
```

---

## Diagramas de Dependencias

### Dependencias entre Módulos

```
main.ts
  ├─→ moduloGTDv3 (dependencia fuerte)
  │   └─→ parser, hierarchy, processor, services
  │
  ├─→ moduloFoco (dependencia fuerte)
  │   └─→ usa mismos tipos que GTD
  │
  ├─→ moduloBacklinks (independiente)
  │
  ├─→ moduloJournal (independiente)
  │   └─→ usa parser de GTD
  │
  └─→ moduloActividad (independiente)
      └─→ usa timeTrackerService de GTD
```

### Dependencias de Servicios

```
GtdView
  ├─→ TimeTrackerService
  ├─→ PomodoroService
  ├─→ AnalyzerService
  └─→ StalledProjectService

FocoView
  ├─→ TimeTrackerService (mismo que GTD)
  └─→ PomodoroService (mismo que GTD)

ActivityView
  └─→ AnalyzerService
```

---

**Última actualización: 2025-10-24**
**Versión: 1.0**
