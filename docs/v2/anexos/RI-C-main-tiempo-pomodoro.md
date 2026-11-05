# C - Ingeniería inversa: main.ts, Time Tracker, Pomodoro y Actividad

Repo: `/home/user/obsidian-dovela-personal-management` (plugin Obsidian "Dovela", id `obsidian-dovela-personal-management`, `isDesktopOnly: false`, version 1.0.0, ver `manifest.json`).
Método: lectura estática completa de los archivos pedidos más `model.ts`, `taskStateManager.ts`, `taskSelectionAnalyzer.ts`, `statisticsView.ts`, `timelineView.ts`, `settingsTab.ts`, `durationUtils.ts`, `view.ts` (solo referencias) y las notas de historia. No se ejecutó nada. Lo que depende de comportamiento interno de Obsidian y no es verificable en el código se marca como (hipótesis).

Convención de referencias: `archivo:línea`. `main.ts` = `src/main.ts`; el resto bajo `src/modules/moduloGTDv3/` salvo indicación.

---

## 0. Hallazgos clave (resumen ejecutivo)

1. **El selector de estado de nota (🟡🟢🔵🔴) NO existe en el código actual.** `main.ts` no lo implementa. Solo hay: la semántica en `Documentacion/estados de proyectos.md` (🟢 Activo, 🔴 Cancelado, 🔵 Archivado, 🟡 Suspendido), lectura de 🟢 en `stalledProjectService.ts` (`isProjectActive`, ~l.82) y escritura de 🔵 en `reviewPanelView.ts:116-118` (`processFrontMatter`, `frontmatter.estado = '🔵'`). La nota de historia `PGTD-Dovela-v0.1/Ax 250611 - Adaptación del Selector de Estado...` habla de `src/ui/EstadoSelectorAPI.ts`, `src/api/EstadoSelectorAPI.ts` y `window.dovelaPersonalManagementAPI.generarSelectorEstado`; ninguno existe en `src/` (solo `main.ts` y `modules/`). Es una funcionalidad de la v0.1 perdida/no portada (probablemente vivía en el plugin `addOnsAPI`).
2. **Todo el estado de tiempo vive en un único `data.json`** reescrito completo en cada guardado (`savePluginData`, main.ts:282). No se escribe nada de tiempo en las notas; las notas solo cambian por el estado de la tarea (`- [/]` al iniciar, `- [x] ... ✅ YYYY-MM-DD` al cerrar).
3. **No hay `schemaVersion` en el modelo vigente.** Solo existe en `moduloFoco/focoModel.ts:140-151`, un `DovelaPluginData` duplicado y obsoleto (con `interruptedTimer`) que no se usa. La única "migración" (timelogs.json antiguo, main.ts:249-279) tiene la parte que importa los registros **comentada** (l.266-268, marca `//VALIDAR AJBB`): borra el archivo viejo sin importar nada.
4. **La sincronización multi-dispositivo es solo "¿hay o no activeTimer en disco?"** (`syncTimerStateWithFile`, main.ts:788-816) y nunca refresca `this.data` en memoria. Riesgo alto de pérdida de registros y de "timer zombi" (sección 2.5).
5. **Pomodoro tiene varios defectos funcionales verificables por lectura** (sección 4.7): ciclos siempre reiniciados a 0, descansos sin tarea asociada (el botón "Volver al trabajo" no reinicia nada), cierre de tarea ejecutado dos veces (la segunda puede cerrar OTRA tarea), notas del modal perdidas en parada manual, estadísticas "hoy" que nunca se resetean y se doble-cuentan en overtime, duración registrada inflada por el tiempo que el modal queda abierto.
6. **Time tracker y Pomodoro pueden correr a la vez** (los comandos solo comprueban su propio estado) y comparten barra de estado.
7. **ActivityView/AnalyzerService no usan `timeLogs`.** Escanean el vault buscando `✅ fecha`/`➕ fecha` y `ctime/mtime`. Las estadísticas de tiempo viven en `statisticsView.ts` y `timelineView.ts`.

---

## 1. main.ts

### 1.1 Estructura de la clase (l.25-46)

`DovelaPersonalManagementPlugin extends Plugin`. Campos públicos relevantes:

| Campo | Tipo | Uso |
|---|---|---|
| `data` | `DovelaPluginData` | Único estado persistido (l.26) |
| `activeTimer` | `ActiveTimerState \| null` | Temporizador en memoria (l.27) |
| `activePomodoroSession` | `PomodoroSession \| null` | Sesión Pomodoro en memoria (l.28) |
| `timeTrackerService`, `pomodoroService`, `timeTrackerCommands`, `analyzerService`, `stalledProjectService` | servicios | l.29-33 |
| `statusBarItem` | `HTMLElement` | Una sola barra de estado compartida por timer y Pomodoro (l.34) |
| `activeTimerInterval`, `syncInterval` | `number\|null` | Handles de `window.setInterval` (l.35-36) |
| `availableTasks` | `(TFile\|Task)[]` | Caché para los selectores de tarea (l.37) |
| `gtdProjectsAndAreas`, `gtdContextTags`, `gtdPersonTags` | caché de metadatos propia (l.40-42) |
| `smartInboxView` | privado, creación perezosa (l.44, 286-291) |
| `journalAPI`, `weeklyAPI` | API para DataviewJS (l.45-46) |

### 1.2 onload (l.48-234), orden exacto y coste

| # | Línea | Acción | Coste/observación |
|---|---|---|---|
| 1 | 51 | `loadPluginData()` | `loadData()` (lectura+parse de TODO data.json) + `adapter.exists(timelogs.json)` (l.250). Bloquea onload. |
| 2 | 53-57 | Construye `TimeTrackerService`, `PomodoroService` (crea `TaskStateManager`), `TimeTrackerCommands`, `AnalyzerService` (solo `Map` caché vacío), `StalledProjectService(vault, metadataCache, data)` | Barato |
| 3 | 58-59 | `addStatusBarItem()` oculto (`display:none`) | Barato |
| 4 | 62-65 | Si `data.activeTimer` -> `initializeTimerFromState` | Arranca `setInterval` de 1 s y llama `refreshAllTimerViews` (aún no hay vistas) |
| 5 | 68-71 | Si `data.activePomodoroSession` -> `initializePomodoroFromState` | Fija callbacks, **reinicia el intervalo interno solo si `getRemainingTime() > 0`** (l.632-636) |
| 6 | 74 | `addSettingTab(new DovelaSettingsTab)` | Una sola pestaña (Journal + Pomodoro, ver 1.8) |
| 7 | 76-79 | `workspace.onLayoutReady(async () => { await loadAvailableTasks(); await collectMetadata(); })` | **Lo más costoso del arranque**: `parseVault` (parser.ts:243) hace `cachedRead` + `parseTasks` de TODOS los `.md` no excluidos y acumula todas las tareas en memoria; luego `collectMetadata` recorre `getMarkdownFiles()` dos veces y `getFileCache` de cada uno. No se espera desde `onload` (se ejecuta tras layout ready). |
| 8 | 82-84 | Eventos vault `modify`/`rename`/`delete` | Ver 1.5 |
| 9 | 87-100 | Evento `workspace.on('file-menu')` añade ítem "Ver Backlinks Organizados" a todo `TFile` | |
| 10 | 103-126 | `registerView` x5 | Barato (factory perezosa) |
| 11 | 128-189 | 6 comandos propios | |
| 12 | 192 | `timeTrackerCommands.registerCommands()` -> 3 comandos | |
| 13 | 194-224 | Ribbons (ver 1.4) | |
| 14 | 227,230 | `new JournalAPI(this)`, `new WeeklyAPI(this)` | Capturan `plugin.data.journalSettings` por referencia (ver 1.9) |
| 15 | 233 | `startSyncInterval()` | `setInterval` 15 000 ms |

Notas:
- No se usa `registerInterval` ni `registerDomEvent`: los intervalos se limpian a mano en `onunload`.
- `new Notice` / `console.log` de depuración abundantes (`activateFocoView` l.319-356 loguea 15 líneas por invocación; el comando "edit-active-timer" loguea en cada `checkCallback`, timeTrackerCommands.ts:169, o sea cada vez que se abre la paleta).

### 1.3 Comandos (todos)

No se define ningún `hotkeys` en ningún `addCommand` (grep `hotkeys` en `src/` = 0). El id real en Obsidian lleva el prefijo `obsidian-dovela-personal-management:`.

| id | Nombre | Tipo | Archivo:línea | Efecto |
|---|---|---|---|---|
| `open-gtd-dashboard` | Open GTD Dashboard | callback | main.ts:128 | `activateView()` |
| `open-focus-view` | Dovela: Mostrar Vista de Foco del Proyecto | checkCallback (requiere nota activa) | main.ts:136 | `activateFocoView(activeFile)` |
| `open-activity-panel` | Panel de Actividad: Mostrar resumen de actividad | callback | main.ts:151 | `activateActivityView()` |
| `open-gtd-review-panel` | Revisión GTD: Encontrar proyectos estancados (icono `clipboard-check`) | callback | main.ts:159 | `activateReviewPanelView()` |
| `smart-inbox` | Smart Inbox | callback | main.ts:168 | `openSmartInbox()` (crea `SmartInboxView` perezoso) |
| `open-backlinks-view` | Dovela: Mostrar Backlinks Organizados | checkCallback (nota activa) | main.ts:176 | `activateBacklinksView()` |
| `time-tracker-start-for-active-note` | Control de Tiempo: Iniciar temporizador para la nota activa (`play-circle`) | checkCallback: nota activa y NO `activeTimer` | timeTrackerCommands.ts:127-143 | `startTrackingWithSelectionDetection` |
| `pomodoro-start-for-active-note` | Control de Tiempo: Iniciar Pomodoro para la nota activa (`timer`) | checkCallback: nota activa y NO `activePomodoroSession` | timeTrackerCommands.ts:146-162 | `startPomodoroWithSelectionDetection` |
| `time-tracker-edit-active-timer` | Control de Tiempo: Modificar temporizador activo | checkCallback: solo si hay `activeTimer` | timeTrackerCommands.ts:165-178 | `openEditActiveTimerModal` |

Huecos importantes: **no hay comando para detener el timer, detener el Pomodoro, cancelar, ni registrar tiempo manual.** Solo se hace desde la vista (botones) o con clic en la barra de estado (que abre la vista, no detiene). En móvil la paleta es el acceso principal -> hueco serio.

Detección de selección (`TimeTrackerCommands`, l.12-120; `taskSelectionAnalyzer.ts`):
- Sin editor: usa el basename de la nota como `taskDescription` (sin `lineNumber`).
- Selección vacía -> igual (nota completa).
- Selección multilínea -> `Notice` "Verifica la tarea que has seleccionado..." y NO inicia.
- Línea que no sea tarea (regex `^(\s*)-\s\[([\s\/xX!?*+-])\]\s*(.*)$`) -> `Notice` de error y NO inicia.
- Tarea válida: `taskDescription` = texto tras el checkbox (incluye tags, fechas, 🆔), `lineNumber` = línea del editor. Si estaba `- [ ]` se reescribe a `- [/]` con `editor.replaceRange` (`changeTaskStateToInProgress`, analyzer l.~113-135). **No se valida que sea `[ ]` o `[/]`**: una `- [x]` también arranca el timer (estado `completed`/`other` se acepta).
- Pomodoro desde la vista: `PomodoroService.startWorkSession` pone la tarea en progreso por `TaskStateManager.setTaskInProgress` (pomodoroService.ts:46-48) escribiendo el archivo con `vault.modify`. Desde el comando ya se hizo vía editor y el segundo intento devuelve false ("ya en progreso"). `_lineNumber` se ignora en `startWorkSession` (l.27).

### 1.4 Ribbon icons (8)

| Icono | Tooltip | Línea | Acción |
|---|---|---|---|
| `plus-circle` | Captura Rápida (Smart Inbox) | main.ts:194 | `openSmartInbox` |
| `play-circle` | Iniciar temporizador | timeTrackerCommands.ts:186 | avisa si ya hay timer o no hay nota activa |
| `timer` | Iniciar Pomodoro | timeTrackerCommands.ts:201 | idem |
| `list-checks` | GTD Dashboard | main.ts:201 | `activateView` |
| `crosshair` | Abrir Vista de Foco | main.ts:205 | requiere nota activa |
| `activity` | Panel de Actividad | main.ts:214 | |
| `clipboard-check` | Panel de Revisión GTD | main.ts:218 | |
| `link` | Backlinks | main.ts:222 | |

### 1.5 Vistas registradas

| View type | Clase | Constante |
|---|---|---|
| `gtd-view` | `GtdView` | `GTD_VIEW_TYPE`, texto "GTD Dashboard", icono `list-checks` (view.ts:17-19) |
| `foco-gtd-view` | `FocoView(leaf, plugin, null)` | focoView.ts:19-21 |
| `dovela-activity-view` | `ActivityView` | activityView.ts:6-8 |
| `dovela-gtd-review-panel-view` | `ReviewPanelView` | reviewPanelView.ts:5-7 |
| `dovela-backlinks-view` | `BacklinksView` | backlinkView.ts:16-18 |

Activadores (main.ts:319-437): GTD y Foco abren pestaña (`getLeaf('tab')`); Backlinks usa `getRightLeaf(false)`. Reutilizan hoja existente (`leaves[0]`), excepto Foco, que reutiliza por `getDisplayText().includes(activeFile.basename)` (frágil: subcadenas) y fija `activeFile` por asignación directa `view['activeFile']` + `onOpen()` manual (l.345-347). `activateView(switchToTimeTracker)` llama `view.switchToTimeTrackerView()` (view.ts:64-69) para la pestaña de time tracker.

### 1.6 Eventos y intervalos

| Tipo | Registro | Línea | Handler |
|---|---|---|---|
| `vault.on('modify')` | `registerEvent` | 82 | `handleFileChange(file)` |
| `vault.on('rename')` | `registerEvent` | 83 | `collectMetadata()` |
| `vault.on('delete')` | `registerEvent` | 84 | `collectMetadata()` |
| `workspace.on('file-menu')` | `registerEvent` | 88 | ítem de menú Backlinks |
| `setInterval` 1 s | `initializeTimerFromState` | 603 | actualiza barra de estado con `HH:MM:SS` desde `startTime` (sin deriva) |
| `setInterval` 15 s | `startSyncInterval` | 821 | `syncTimerStateWithFile` |
| `setInterval` 1 s | `PomodoroService.startTimer` | pomodoroService.ts:293 | tick Pomodoro |
| `setInterval` 1 s | `TimeTrackerView.syncTimerUI` | timeTrackerView.ts:293 | display del timer (uno por vista abierta) |

No hay: `metadataCache.on('changed'|'resolved')`, `vault.on('create')`, `workspace.on('active-leaf-change')`, ni `Plugin.onExternalSettingsChange`.

`handleFileChange` (l.580-594): en CADA `modify` de CUALQUIER archivo (incluye el autosave mientras se escribe, ~cada 2 s de edición) hace `await collectMetadata()` -> O(archivos) (dos pasadas a `getMarkdownFiles()`, `getFileCache` por archivo, conteo de tags). Es el sobrecoste recurrente más importante en vaults grandes y en móvil. Después comprueba si `file.path === manifest.dir + '/data.json'` y en ese caso llama `syncTimerStateWithFile`. (hipótesis) Esa rama probablemente **no se ejecuta nunca**: `.obsidian/` no se indexa como `TFile` en el Vault y Obsidian no emite `vault.on('modify')` para archivos de configuración; el único mecanismo real de sync es el polling de 15 s.

### 1.7 Metadata cache propia (l.293-317)

`collectMetadata()` rellena:
- `gtdProjectsAndAreas: TFile[]` = `.md` cuyo `basename` empieza por `PGTD -`, `AV -` o `AI -`.
- `gtdContextTags`: tags `#cx-*`; `gtdPersonTags`: `#px-*`, calculados de `metadataCache.getFileCache(file).tags` (solo tags inline; los de frontmatter no entran).
- Si `smartInboxView` existe, `refreshCascadeMenuConfig()` (smartInboxView.ts:292) -> `cascadeMenuManager.refreshConfig()`.

Invalidación: se recalcula entero (no incremental) en `layout ready`, y en `modify/rename/delete`. Carencias: no en `create`; en `modify` se ejecuta antes de que `metadataCache` reindexe el archivo (el evento de caché es posterior), así que los tags nuevos pueden aparecer con un guardado de retraso (hipótesis); y `availableTasks` (caché de tareas) **no** se invalida con ningún evento: solo se recarga cuando se abre el time tracker o se pulsa un botón de fuente.

### 1.8 Settings tab

Una sola: `DovelaSettingsTab` (settingsTab.ts, 384 líneas), secciones "Configuración Journal" (carpeta base, subcarpetas año/trimestre/mes, patrón semana, reset, vista previa) y "Configuración Pomodoro" (duraciones con límites trabajo 1-60, corto 1-15, largo 1-30, ciclos 2-8, alerta overtime 1-15; auto-iniciar descansos/trabajo; notificaciones; sonido; reset; estadísticas con botón reset). Cada cambio hace `savePluginData()` completo. Los toggles `autoStartBreaks`/`autoStartWork` **no los lee ningún código de ejecución** (solo settings y quickSettings).

### 1.9 API para DataviewJS

Se accede como `app.plugins.plugins['obsidian-dovela-personal-management'].journalAPI` / `.weeklyAPI` (ejemplo en `docs/.../Ax 251024 - Documentación Sistema de Journal...md` l.209).

| Objeto | Método | Línea | Devuelve |
|---|---|---|---|
| `JournalAPI` | `renderTasksForDate(date 'YYYY-MM-DD', opts)` | journalAPI.ts:25 | `HTMLElement` |
| | `getTaskCounts(date)` | :55 | conteos por categoría |
| | `getDailyNotePath(date)` | :93 | ruta |
| | `generateWeeklyLink(weekCode)` | :108 | `[w::[[path|weekCode]]]` |
| | `ensureFolderStructure(date)` | :117 | crea carpetas |
| | `validateJournalSettings()` | :130 | `{valid,message}` |
| `WeeklyAPI` | `renderTasksForWeek(weekCode 'YYYY-W##', opts)` | weeklyAPI.ts:26 | `HTMLElement` |
| | `getTaskCounts(weekCode)` | :56 | |
| | `ensureFolderStructure(weekCode)` | :145 | |

Defecto: ambas construyen `JournalPathHelper/WeeklyPathHelper(plugin.data.journalSettings)` UNA vez; el botón "Restablecer" asigna un objeto nuevo (`settingsTab.ts:117`) y los helpers siguen con el viejo hasta recargar.

### 1.10 Barra de estado (l.439-452, 702-747)

- `updateStatusBar(text)`: texto `⏱️ <text>`, `display:block`, `onclick -> activateView(true)`; si `text` vacío se oculta y se quita el onclick.
- Timer: `<nombre-nota>... HH:MM:SS` (nombre = último segmento de `taskNotePath` sin `.md`, no la descripción de la tarea) cada segundo.
- Pomodoro: `🍅|☕ <nombre>... MM:SS` (HH:MM:SS si >1 h) ; overtime `🔴 <nombre>... MM:SS (overtime)` con estilo rojo+negrita; descanso sin tarea muestra "Descanso".
- Timer y Pomodoro se pisan el mismo elemento.

### 1.11 onunload (l.236-244)

Detiene el sync, limpia `activeTimerInterval`, `pomodoroService.cleanup()` (solo limpia intervalo), `detachLeavesOfType` para `gtd-view` y `dovela-backlinks-view` (no para Foco/Actividad/Revisión; desaconsejado por la guía de Obsidian) y `smartInboxView?.remove()`. **No guarda datos ni vacía el estado**: `activeTimer` y `activePomodoroSession` permanecen en `data.json` -> se reanudan al volver a cargar (feature deliberada, pero sin heartbeat ni caducidad).

---

## 2. Persistencia: data.json

### 2.1 Esquema (según `model.ts` vigente, l.120-232)

```ts
DovelaPluginData {
  timeLogs: TimeLogEntry[];
  activeTimer?: ActiveTimerState;
  pomodoroSettings: PomodoroSettings;
  activePomodoroSession?: PomodoroSession;
  pomodoroStats: PomodoroStats;
  journalSettings: JournalSettings;
}
```
Defaults (`DEFAULT_SETTINGS`, model.ts:222-229): `timeLogs: []`, `pomodoroSettings` = {25, 5, 15, ciclos 4, autoStartBreaks false, autoStartWork false, sound true, notifications true, overtimeAlertInterval 5}, `pomodoroStats` ceros, `journalSettings` = {baseFolderPath "03 - Gestion Personal/AV - Gerente de Vida/AI - Journals", yearSubfolder true, quarterSubfolder true, monthSubfolder false, weekFolderPattern "{YYYY}/Q{Q}"}.

Ejemplo realista (`.obsidian/plugins/obsidian-dovela-personal-management/data.json`; los campos `undefined` NO se serializan):

```json
{
  "timeLogs": [
    {
      "id": "1755806445123",
      "taskNotePath": "03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Dovela v0.9/PGTD 250918 - Modulo de Pomodoro v1.0/PGTD 250918 - Modulo de Pomodoro v1.0.md",
      "startTime": "2025-08-21T14:30:45.123-05:00",
      "endTime": "2025-08-21T15:12:10.456-05:00",
      "durationMinutes": 41,
      "notes": "Sesión Pomodoro + Overtime (41 min total) - Ciclos completados: 1\n\nRevisado el flujo del modal",
      "taskDescription": "Mostrar los pomodoros del día y la ronda actual de Pomodoros 🆔 Cj34Ev"
    },
    {
      "id": "1755870000000",
      "taskNotePath": "03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Dovela v0.2/PGTD - Dovela v0.2.md",
      "startTime": "2025-08-22T13:00:00.000Z",
      "endTime": "2025-08-22T13:30:00.000Z",
      "durationMinutes": 30,
      "notes": "",
      "taskDescription": "PGTD - Dovela v0.2"
    }
  ],
  "activeTimer": {
    "taskNotePath": "03 - Gestion Personal/.../PGTD - Dovela v0.9.md",
    "startTime": "2025-11-05T09:12:03.512-05:00",
    "taskDescription": "Revisar flujo de cierre #cx-vibeCoding",
    "notes": "",
    "lineNumber": 42
  },
  "pomodoroSettings": { "workDuration": 25, "shortBreakDuration": 5, "longBreakDuration": 15, "cyclesBeforeLongBreak": 4, "autoStartBreaks": false, "autoStartWork": false, "soundEnabled": true, "notificationsEnabled": true, "overtimeAlertInterval": 5 },
  "activePomodoroSession": {
    "id": "1762345000000", "type": "work", "startTime": "2025-11-05T09:20:00.000-05:00", "duration": 25,
    "taskPath": "03 - .../PGTD - Dovela v0.9.md", "taskDescription": "Revisar flujo de cierre", "completedCycles": 0, "notes": "",
    "isOvertime": true, "overtimeStartTime": "2025-11-05T09:45:00.000-05:00", "lastOvertimeAlert": "2025-11-05T09:50:00.000-05:00"
  },
  "pomodoroStats": { "totalWorkSessions": 118, "totalWorkMinutes": 2950, "completedCycles": 20, "todayWorkSessions": 118, "todayWorkMinutes": 2950 },
  "journalSettings": { "baseFolderPath": "03 - Gestion Personal/AV - Gerente de Vida/AI - Journals", "yearSubfolder": true, "quarterSubfolder": true, "monthSubfolder": false, "weekFolderPattern": "{YYYY}/Q{Q}" }
}
```
(el ejemplo mezcla a propósito `-05:00` y `Z` porque ambos formatos existen realmente en el código, ver 3.4; `todayWork*` = total por el defecto de 4.7.)

### 2.2 Tamaño esperado

Medido sobre un registro tipo (ruta de ~190 caracteres, descripción 100 caracteres, notas cortas): **~590 bytes** con `JSON.stringify(...,2)`, ~650 B anidado en el array. Estimaciones: 10 registros/día -> ~2.4 MB/año; 25/día (muchos Pomodoros) -> ~6 MB/año; 5 años de uso intenso -> 12-30 MB. Todo el resto (settings, stats, journal) es < 2 KB. El tamaño lo domina `taskNotePath` repetido literalmente en cada registro (>60 % del peso).

### 2.3 Carga y guardado

- Carga: `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())` (main.ts:247). Merge **superficial**: (a) si el archivo trae `pomodoroSettings` parcial (versión vieja sin `overtimeAlertInterval`) no se completan los campos nuevos (solo `checkOvertimeAlerts` tiene fallback `|| 5`, pomodoroService.ts:316); (b) si falta una clave, `this.data.X` queda como **la misma referencia** que el objeto/array por defecto del módulo (`DEFAULT_POMODORO_SETTINGS`, `DEFAULT_SETTINGS.timeLogs`), de modo que `push` de logs o cambios de settings mutan los defaults compartidos (sin efecto práctico en una sesión, pero el botón "Restablecer" copia de un default posiblemente contaminado: settingsTab.ts:341).
- Guardado: `saveData(this.data)` completo (main.ts:282-284). Cada mutación (`addLogEntry`, `updateLogEntry`, `deleteLogEntry`, start/stop timer, inicio Pomodoro, alerta overtime cada N min, cambio de ajuste) reescribe el archivo entero. No hay cola/mutex, ni debounce, ni escritura atómica propia (`saveData` usa el adaptador; (hipótesis) no es write-temp+rename).
- Lectura directa: solo `syncTimerStateWithFile` (`adapter.read` + `JSON.parse` de todo el archivo cada 15 s, l.793-794) y la migración (l.250-272, `adapter.exists/read/remove`).
- Rutas: `this.manifest.dir` + `/data.json` y `/timelogs.json`.

### 2.4 Migraciones

- `schemaVersion`: **inexistente** en el modelo activo. Solo en `focoModel.ts:142`.
- Migración `timelogs.json` -> `data.json` (main.ts:249-279): si el archivo existe y contiene array no vacío: calcula `existingLogIds` pero **la línea que añade los registros está comentada** (l.266-268 `//VALIDAR AJBB`), ejecuta `savePluginData()` y luego `adapter.remove(oldTimeLogsFile)` y muestra "Registros de tiempo migrados al nuevo formato". Resultado: **pérdida silenciosa** de los registros del formato antiguo. Si algún vault real conserva `timelogs.json`, hay que importarlo a mano (formato de entrada: array de `TimeLogEntry` con `id`, ver nota de historia que lo describía con campos `task/summary/project/context`, pero el código migraba con la interfaz actual).
- Historia: `Ax 250709 - Refactorización del archivo de datos timelogs.json a data.json` propone `schemaVersion: 1` y `interruptedTimer`; se implementó con `activeTimer`/`activePomodoroSession` y sin versionado.

### 2.5 Sincronización entre dispositivos (`syncTimerStateWithFile`, main.ts:788-816)

Algoritmo cada 15 s (y teóricamente en `modify` de data.json):
1. `wasRunning = !!this.activeTimer`.
2. Lee data.json de disco, extrae solo `activeTimer`.
3. Caso 1 (estaba y ya no): `clearActiveTimer()` (apaga intervalo, `activeTimer = null`, oculta barra, refresca vistas).
4. Caso 2 (no estaba y ahora sí): `initializeTimerFromState(disco)`.
5. Casos 3/4: nada. **Si hay timers distintos en ambos lados (otra tarea, otra hora de inicio, notas editadas) no se detecta.**
6. Errores (archivo a medio escribir) se tragan con `console.error`.

Lo que NO hace:
- **Nunca actualiza `this.data`.** Tras el Caso 1, `this.data.activeTimer` sigue apuntando al timer viejo; tras el Caso 2, `this.data.activeTimer` sigue `undefined`; `this.data.timeLogs` no incorpora los registros que llegaron del otro dispositivo.
- No sincroniza `activePomodoroSession`, `timeLogs`, ajustes ni stats.
- No hay `onExternalSettingsChange`.

Escenarios de pérdida/conflicto:
1. **Pérdida de registros (last-writer-wins del array completo):** A y B tienen el plugin cargado. B detiene un timer y escribe el log L1 (data.json de B: logs + L1). El sync entrega ese archivo a A, pero A conserva en memoria su `timeLogs` anterior. Cuando A registre cualquier cosa (otro log, cambiar un ajuste), `saveData(this.data)` sobrescribe y **L1 desaparece** (y se propaga de vuelta a B).
2. **Timer zombi:** tras Caso 1 en A, `this.data.activeTimer` sigue poblado en memoria. El siguiente `savePluginData()` de A lo reescribe en disco; el poll de B (y de A) ve `activeTimer` de nuevo -> Caso 2 -> el timer "resucita" con el `startTime` antiguo (horas fantasma) en ambos.
3. **Doble timer/Pomodoro:** Pomodoro no tiene sync; si A inició Pomodoro y el sync entrega el archivo, B solo lo ve al recargar Obsidian; ambos terminan registrando el mismo bloque dos veces (A y B tienen cada uno su `stopCurrentSession`).
4. **Carrera de inicio:** A y B inician timer casi a la vez antes del siguiente poll: cada uno escribe su `activeTimer`; gana el último archivo; el perdedor sigue con un timer local que ya no existe en disco (Caso 3, no se detecta) y el log se guardará igualmente al detener (duplicando/solapando tiempo).
5. **Conflicto del propio Sync de archivos (hipótesis, fuera de código):** `data.json` es un solo JSON con claves de primer nivel; si el servicio de sync fusiona por clave (Obsidian Sync trata los `.json` de configuración así según su documentación pública, verificar) `timeLogs` es una sola clave -> gana la última escritura entera. Con Google Drive (la ruta de desarrollo en la historia es `.../GoogleDrive-<CUENTA>/Mi unidad/...`) un conflicto produce copias tipo `data (1).json` que el plugin ignora.
6. Después de que el sync reescriba data.json en disco no se recarga nada en memoria hasta reiniciar Obsidian; mientras tanto la UI muestra datos viejos y cualquier guardado los impone.
7. Coste: parsear el archivo completo cada 15 s por dispositivo (con 12 MB, decenas de ms a >100 ms en móvil) solo para mirar un campo.

---

## 3. TimeLogEntry, ActiveTimerState y flujo del time tracker

### 3.1 Tipos exactos (model.ts:120-137)

```ts
interface TimeLogEntry {
  id: string;               // Date.now().toString() (ms epoch), no UUID
  taskNotePath: string;     // ruta de la nota (path completo con .md)
  startTime: string;        // ISO 8601
  endTime: string;          // ISO 8601
  durationMinutes: number;  // entero, minutos
  notes: string;
  taskDescription?: string; // texto de la tarea (o basename si es nota completa)
}
interface ActiveTimerState {
  taskNotePath: string;
  startTime: string;        // ISO con offset local (moment().local().toISOString(true))
  taskDescription?: string;
  notes?: string;           // notas de la sesión en curso
  lineNumber?: number;      // solo si se inició sobre una tarea; NO se vuelca al log
}
```
(Obsérvese: `focoModel.ts` define otra `ActiveTimerState` obsoleta, l.130-137.)

No existen campos de: origen (manual/timer/pomodoro), dispositivo, tarea-id (🆔), tipo de sesión, borrado lógico, `updatedAt`.

### 3.2 Cómo se calculan las duraciones

| Origen | Fórmula | Archivo:línea |
|---|---|---|
| Timer detenido / registro manual / edición | `moment(endTime).diff(moment(startTime), 'minutes')` = **truncado** (floor para positivos) | timeLogModal.ts:320-328 |
| Pomodoro de trabajo | `endTime.diff(startTime,'minutes')` truncado; solo se registra si `>= 1` y hay `taskPath` | pomodoroService.ts:129-134 |
| Redimensionar bloque en timeline | `durationMinutes = (finalHeight/columnHeight)*1440`, se guarda `Math.round`, `endTime = start + minutos float` | timelineView.ts:576-582 |
| Mover/duplicar bloque | duración = `end-start` en minutos (truncada), se guardan `startTime/endTime`; en mover NO se toca `durationMinutes` | timelineView.ts:265, 281-293 |
| Display en timer | `floor(diff/3600000)`, etc. desde `startTime`, cada segundo | main.ts:603-610 |

Particularidades: (a) la validación solo rechaza `< 0`; un registro de **0 minutos** se acepta (el stats muestra `< 1 min`); (b) al editar HH:mm el modal pone segundos y ms a 0 del campo editado, pero el otro extremo conserva sus segundos -> discrepancia de hasta 59 s antes del truncado; (c) el modal de fecha mueve inicio y fin al MISMO día (l.187-193): **no se puede crear manualmente un intervalo que cruce medianoche** (solo vía timer o timeline); (d) los límites de `durationMinutes` vs `end-start` pueden divergir (resize con redondeo vs floor).

### 3.3 Dónde se escribe el registro

**Solo en `data.json`** (`TimeTrackerService.addLogEntry`, timeTrackerService.ts:12-24: `push` + `savePluginData`). La nota/tarea NO recibe anotación de tiempo (ni `⏱`, ni inline fields). Efectos en notas:
- Al iniciar sobre una tarea abierta: `- [ ]` -> `- [/]` (editor o `TaskStateManager.setTaskInProgress`, que solo cambia estado `open` y busca por `content.includes(descripcion)`).
- Al guardar con "Cerrar tarea": `- [x] ... ✅ YYYY-MM-DD` (si la línea no contiene ya `✅`).
- Se persisten `taskNotePath` y `taskDescription` como texto; **no se guarda `lineNumber` ni el id 🆔 por separado**, así que la relación con la tarea es por texto y se rompe si la tarea se edita o la nota se mueve/renombra.

Las "estadísticas por jerarquía" se obtienen sumando por prefijo de ruta (ver sección 5).

### 3.4 Formato de fecha: mezcla de offsets

- Timer: `moment().local().toISOString(true)` -> `2025-08-21T14:30:45.123-05:00` (main.ts:459).
- Pomodoro: `moment().toISOString(true)` (igual formato).
- TimeLogModal: normaliza con `moment(x).local().toISOString(true)`.
- **Timeline** usa `toISOString()` sin `true` -> UTC con `Z` (timelineView.ts:285-292, 580, 659-660).
Conviven en el mismo array. Toda lectura pasa por `moment(str)` (parse correcto de ambos), pero cualquier orden o filtro por cadena fallaría.

### 3.5 Detener (`stopTracking`, main.ts:473-512)

1. Si no hay timer, sale. Limpia el intervalo de barra (pero NO `activeTimer`).
2. Abre `TimeLogModal` con `{taskNotePath, startTime, endTime: ahora, notes, taskDescription}`, `isEditingActiveTimer=false`, `isStoppingActiveTimer=true`.
3. En "Guardar" (`save()`, timeLogModal.ts:312-353): exige tarea; calcula duración (<0 rechaza); si el toggle "Cerrar tarea activa?" está activo ejecuta `closeTaskInFile`; llama `onSave(entry)`.
4. `onSaveCallback`: `id` vacío -> `addLogEntry` (guarda #1); `clearActiveTimer()`; `data.activeTimer = undefined`; `savePluginData()` (guarda #2, **dos escrituras no atómicas**: si la app muere entre ellas el log existe y el timer sigue "activo" y reaparecerá con horas de más); `refreshAllGtdAndFocoViews()` (solo `refreshStatistics()`, **no refresca la Timeline**).
5. "Cancelar" o cerrar con X: `onClose` (l.496-505) reinicializa el timer (sigue corriendo desde el `startTime` original).

### 3.6 Modificar un temporizador en curso (`openEditActiveTimerModal`, main.ts:514-546)

Abre `TimeLogModal` en modo `isEditingActiveTimer=true`: ocultos Fecha y Hora de fin; solo editables **Hora de inicio (HH:mm, misma fecha que el original, sin poder pasar al día anterior)** y **Notas**. Callback: asigna `activeTimer.startTime` y `notes`, `data.activeTimer = activeTimer`, guarda, `initializeTimerFromState` (reinicia el intervalo), `Notice`. No valida que el nuevo inicio sea anterior a ahora (un inicio futuro produce horas negativas "-1:..").  No se puede cambiar de tarea. Botón "Modificar" solo visible con timer normal (en Pomodoro se oculta, timeTrackerView.ts:427).

### 3.7 Edición y borrado de registros

Entradas de UI: clic en un registro en `StatisticsView` (statisticsView.ts:477-485) o en un bloque de `TimelineView` (timelineView.ts:399-407, 495-503, 593-600) abre `TimeLogModal(entry con id)` -> `isEditing=true`. Campos: fecha (mueve inicio y fin al mismo día), hora inicio, hora fin, notas; la tarea es solo lectura. "Guardar" -> `updateLogEntry(id, entry)` (timeTrackerService.ts:64-81, reconstruye el objeto con `??`, guarda). "Eliminar" (botón de advertencia, **sin confirmación**) -> `deleteLogEntry(id)` (filter + guardar), luego `onSave({})` para refrescar (los callbacks ignoran entradas sin `id`).
Otras ediciones: arrastrar bloque (mover; con Alt duplicar), redimensionar, crear arrastrando en una columna vacía (abre modal con inicio/fin precargados; sin tarea -> selector manual). No hay deshacer. No se puede cambiar la tarea de un registro existente.
Selector de tarea manual (`TimeLogModal.onOpen`, l.92-177): 3 fuentes ("Notas Abiertas" por defecto, "En Progreso", "Todas") vía `plugin.loadAvailableTasks(source)` -> **`parseVault` completo cada vez**; muestra máx. 100 resultados.

### 3.8 Cierre de tarea al detener

- `TimeLogModal.closeTaskInFile` (l.387-469): lee la nota, busca la **primera** línea de tarea cuyo contenido `includes(taskDescription)` (cualquier estado); si no hay coincidencia usa la **primera tarea `open`/`in-progress` del archivo** (fallback peligroso); si ya está `completed` no hace nada; reemplaza por `- [x]` y añade ` ✅ YYYY-MM-DD` si la línea no contiene `✅`; `vault.modify`.
- Visibilidad del toggle (`shouldShowCloseCheckbox`, l.296-310): no en edición ni en edición de timer activo; requiere `taskNotePath` y `taskDescription` distinta del nombre de archivo (heurística de "tarea específica"). **Activado por defecto** en timer (`toggle.setValue(true)`), **desactivado** por defecto en Pomodoro.
- El texto avisa "No usar en tareas recurrentes 🔁." pero no hay lógica para tareas recurrentes (no se regenera la siguiente ocurrencia; se cierra y punto).
- No se usa `lineNumber` (puede haber derivado) ni el 🆔.
- Tres copias de `createCompletedTaskLine` (TimeLogModal, PomodoroModal, TaskStateManager) con regex `^(\s*-\s\[)[\s\/xX!?*+-](\]\s*.*)$`: solo viñeta `-`, checkbox de un carácter.

### 3.9 Modal "Cancelar Registro"

Botón de advertencia visible solo con `isStoppingActiveTimer` (timeLogModal.ts:264-269) -> `cancelActiveTimer()` (l.369-379) -> `plugin.cancelActiveTimer()` (main.ts:548-558): `clearActiveTimer()`, `data.activeTimer = undefined`, guardar, refrescar vistas. **Descarta el tiempo transcurrido sin confirmación ni log.** Distinto de "Cancelar" (cierra el modal y el timer sigue). No hay equivalente para Pomodoro salvo detenerlo (que sí registra).

---

## 4. Pomodoro

### 4.1 Modelo (model.ts:141-172)

`PomodoroSession`: `id` (Date.now), `type` (`work|shortBreak|longBreak`), `startTime`, `duration` (min planificados), `taskPath?`, `taskDescription?`, `completedCycles`, `notes?`, `isOvertime?`, `overtimeStartTime?`, `lastOvertimeAlert?`. No hay campo de "pausa", "restante" ni "fin planificado": todo se deriva de `startTime` + reloj de pared.

### 4.2 Máquina de estados

Estados: `IDLE` (`activePomodoroSession == null`), `WORK` (type work, `!isOvertime`), `BREAK` (shortBreak/longBreak), `AWAITING_DECISION` (tiempo agotado, intervalo detenido, sesión aún en `plugin`/`data`, modal abierto), `OVERTIME` (type work, `isOvertime`).

Transiciones:
- IDLE -> WORK: `startWorkSession(path, desc)` (pomodoroService.ts:27-59). Crea sesión con `duration = settings.workDuration`, `completedCycles = data.activePomodoroSession?.completedCycles || 0`, pone la tarea en `[/]` si es específica, guarda, `initializePomodoroFromState` (callbacks + startTimer + barra) y de nuevo `startTimer` (idempotente).
- IDLE (o WORK) -> BREAK: `startBreakSession(type)` (l.61-100): conserva task/ciclos de la sesión activa si la hay (y la detiene), `duration` corto/largo.
- WORK/BREAK -> AWAITING_DECISION: el tick de 1 s detecta `getRemainingTime() <= 0` -> `completeCurrentSession` (l.227-260): detiene el intervalo; si work: `updateStats(session)` y `completedCycles++`; invoca `onSessionCompleteCallback` (modal) + notificación + sonido (WebAudio 800/600/800 Hz y `navigator.vibrate`).
- AWAITING_DECISION (work) tiene 4 salidas (pomodoroModal.ts:187-243): descanso corto/largo (`onContinue`), "Otro pomodoro" (`onWorkMore`), "Seguir trabajando en el mismo ciclo" (`onContinueOvertime`), "Finalizar sesión" (`onFinish`).
- AWAITING_DECISION (break): "Volver al trabajo" (`onContinue('work')`), "Descanso largo/Más descanso" (`onContinue('longBreak')`), "Finalizar".
- AWAITING_DECISION -> OVERTIME: `startOvertimeMode` (l.198-225): `updateStats` otra vez, `completedCycles++` otra vez, copia de la sesión con `isOvertime=true`, `overtimeStartTime`, `lastOvertimeAlert`, guarda, `startTimer`.
- WORK/BREAK/OVERTIME -> IDLE por "Detener" (`stopCurrentSession`, l.117-196) o por `onFinish`.
- `AWAITING_DECISION` NO tiene salida si se cierra el modal con la X (ver 4.7-9).

### 4.3 Duraciones y reloj

- Planificadas (defaults): trabajo 25, descanso corto 5, largo 15, 4 ciclos, alerta overtime 5 min (`DEFAULT_POMODORO_SETTINGS`).
- `getRemainingTime()` (l.262-278): `elapsedMinutes = now - startTime` (float). Normal: `max(0, (duration - elapsed)*60)` segundos. Overtime: `floor(elapsed*60)` = **tiempo total transcurrido desde `startTime`** (no desde `overtimeStartTime`, que se guarda pero no se usa). Basado en reloj de pared -> sobrevive a reinicios.
- Tick: `setInterval` 1 s (l.293). En móvil los timers en segundo plano se estrangulan o suspenden (hipótesis), de modo que la finalización se detecta al volver a primer plano.
- Alertas overtime (`checkOvertimeAlerts`, l.312-341): si `now - lastOvertimeAlert >= overtimeAlertInterval` minutos muestra aviso de descanso, actualiza `lastOvertimeAlert` y hace `savePluginData()` sin `await` (cada N min).
- `pauseSession`/`resumeSession` existen (l.102-115) pero **nadie las llama**, y "pausar" solo detendría el intervalo, no el reloj de pared.
- `autoStartBreaks`/`autoStartWork`: ajustes sin implementación.

### 4.4 Modal de cierre (pomodoroModal.ts, tipo `sessionComplete`)

Contenido: título según tipo, Nota (basename + enlace "abrir nota"), Tarea (si es específica y work), duración y ciclos, textarea "Notas de la Sesión", toggle "Cerrar tarea activa?" (solo work + tarea específica, **desactivado por defecto**), y botones:

| Botón | Aplica a | Efecto |
|---|---|---|
| Descanso corto/largo (la regla: largo si `completedCycles % cyclesBeforeLongBreak === 0 && >0`) | work | copia `notes` a la sesión; `onContinue(breakType)`: main.ts:651-666 -> `stopCurrentSession(false)` (registra el log) y luego `startBreakSession` |
| Otro pomodoro (workDuration) | work | `onWorkMore` (main.ts:668-679): `stopCurrentSession(false)` + `startWorkSession` con la misma tarea |
| Seguir trabajando en el mismo ciclo (overtime) | work | `onContinueOvertime` -> `startOvertimeMode(session)` (no registra log aún) |
| Volver al trabajo / Descanso largo / Más descanso | break | `onContinue('work'|'longBreak')` |
| Finalizar sesión | ambos | cierra tarea (si toggle) + `onFinish` (`stopCurrentSession(false)` + `closeSessionTask`) |

Los otros dos tipos del modal: `sessionOptions` (elegir trabajo/corto/largo, o "Configuración rápida") y `quickSettings` (sliders de duraciones, alerta overtime, auto-start, sonido). `quickSettings` reemplaza el objeto `pomodoroSettings` por la copia temporal y guarda.

### 4.5 Integración con tareas y time logs

- Inicio: pone `[/]` si la tarea es específica (`isSpecificTask` = descripción != basename && != ruta, `taskStateManager.ts:132`).
- Registro de tiempo: **solo sesiones `work`**, en `stopCurrentSession` (l.128-166): `taskNotePath = session.taskPath`, `taskDescription`, `startTime = session.startTime`, `endTime = ahora`, `durationMinutes = diff truncado`, y `notes` = "Sesión Pomodoro (X/Y min)" o "Sesión Pomodoro + Overtime (X min total)", + " - Ciclos completados: N" si N>0, + doble salto de línea + notas del usuario. Los descansos nunca se registran. No hay marca estructurada de "pomodoro" en el log (la única pista es el prefijo del texto de `notes`).
- Se registra un log por pomodoro (cada "Otro pomodoro" cierra el anterior). Overtime = un solo log cubriendo trabajo + overtime.
- Cierre de tarea: `closeSessionTask` -> `TaskStateManager.closeTask` (por descripción con fallback "primera tarea abierta/en progreso del archivo").
- Estadísticas propias: `pomodoroStats` (`updateStats`, l.343-362) aparte de los logs; muestra en settings.

### 4.6 Si Obsidian se cierra a mitad

`data.activePomodoroSession` queda persistido (se escribió al iniciar / overtime / alerta). Al cargar (`initializePomodoroFromState`, main.ts:616-643):
- `remaining > 0` (work/break aún dentro de su duración, u overtime): reinicia el intervalo y continúa en el punto correcto.
- `remaining == 0` (el tiempo se agotó mientras estaba cerrado): **no arranca el intervalo, no dispara el modal**; la barra muestra "00:00", la vista muestra los botones de pomodoro activo, la sesión queda "colgada" hasta que el usuario pulse Detener; ese Detener registra `now - startTime` (**incluye todo el tiempo que Obsidian estuvo cerrado**, p. ej. 8 h si lo cerró por la noche).
- Un temporizador normal también se reanuda y mide tiempo de pared (sin heartbeat): si se olvidó, el registro incluirá todo.
- Los `autoStart*` no actúan.

### 4.7 Defectos detectados (lectura estática)

1. **Ciclos siempre se reinician**: `startWorkSession` lee `data.activePomodoroSession?.completedCycles`, pero `onWorkMore`/`onContinue` llaman antes a `stopCurrentSession(false)` -> `clearActiveSession()` pone `data.activePomodoroSession = undefined` (l.373). Resultado: cada sesión nueva arranca con 0, el modal ve 1 (o 2 tras overtime) y `1 % cyclesBeforeLongBreak === 0` nunca se cumple (mínimo configurable 2) -> el descanso largo automático nunca se sugiere, y la nota de historia "mostrar la ronda 1 de 4" no está implementada en ningún sitio (`grep` de ronda/ciclo en vistas = 0).
2. **Descansos sin tarea**: por la misma razón `startBreakSession` encuentra `plugin.activePomodoroSession == null`, de modo que `taskPath/taskDescription` quedan `undefined`. En el modal de fin de descanso, "Volver al trabajo" llama `onContinue('work')`, que exige `completedSession.taskPath && taskDescription` (main.ts:657) -> **no inicia nada**. (La historia marca como resuelto "el botón de iniciar otro pomodoro no funciona" después del descanso; el código leído no lo cumple. Hipótesis: conviene ejecutar un caso de prueba manual.) La barra de estado en descanso muestra "Descanso".
3. **Cierre de tarea duplicado, la segunda ejecución puede cerrar OTRA tarea**: el modal llama a su propio `closeSessionTask` (pomodoroModal.ts:177-179) y luego `onFinish(true)`, que vuelve a llamar `pomodoroService.closeSessionTask` (main.ts:689-691 y pomodoroService.ts:178-181). La segunda búsqueda de `TaskStateManager.findTaskLine` ya no encuentra la tarea (está completada, solo se aceptan `open/in-progress`) y **cae al fallback: la primera tarea abierta o en progreso del archivo** (taskStateManager.ts:170-177), que se cierra. En una nota con más tareas abiertas se marca como hecha una tarea no relacionada.
4. **Notas del modal perdidas en parada manual**: `stopCurrentSession(true)` registra el log ANTES de abrir el modal (l.134-166 vs 169-185); las notas editadas después se asignan a `session.notes` pero ya nadie las guarda. Solo funcionan en el flujo de fin natural (donde el log se escribe después, en `onFinish`/`onContinue`).
5. **Duración inflada por la espera del modal**: en fin natural la sesión sigue "activa" mientras el modal esté abierto; `stopCurrentSession` calcula `now - startTime` -> si el usuario tarda 20 min en elegir, el log de 25 min dice 45 y las notas dicen "(45/25 min)". En overtime pasa lo mismo a propósito (es el mecanismo), pero sin overtime es un error.
6. **Estadísticas incorrectas** (`updateStats`, l.343-362): `todayWorkSessions/Minutes` solo se incrementan, nunca se resetean al cambiar de día (son "acumulado desde el último reset"; en la historia la tarea "el tiempo de hoy es el total" figura como hecha, pero el código no resetea); se suman minutos **planificados** (`session.duration`), no los reales; se actualizan al completar (antes de decidir); `startOvertimeMode` vuelve a llamar `updateStats` y a incrementar `completedCycles` (doble conteo); `completedCycles++` global se cuenta con la heurística `session.completedCycles > 0`.
7. **Modal cerrado con la X** (o Esc) en `AWAITING_DECISION`: no hay `onClose` que decida; la sesión queda activa con el intervalo detenido (estado colgado como el de 4.6) y sin log.
8. **Time tracker y Pomodoro a la vez**: los comandos y ribbons solo chequean su propio estado (timeTrackerCommands.ts:133,152; main.ts:455 `startTracking` no mira `activePomodoroSession`); la vista oculta el otro botón (timeTrackerView.ts:251) pero la paleta no. Se pueden solapar dos logs y se pisa la barra.
9. Notificaciones de sistema: `window.Notification` solo se usa si el permiso ya es `granted`; nunca se llama `requestPermission` (grep = 0). En la práctica solo se ven `Notice`.
10. `updatePomodoroInAllViews` recorre las hojas y `updatePomodoroUI` reconstruye el panel de detalles (`empty()` + filas) **cada segundo** por vista abierta.

### 4.8 Sincronización entre vistas

`main.initializePomodoroFromState` fija los callbacks únicos del servicio: `onTick -> updatePomodoroStatusBar + updatePomodoroInAllViews` (todas las hojas `gtd-view` y `foco-gtd-view` con `timeTrackerView`), `onComplete -> handlePomodoroComplete` (importa dinámicamente el modal, lo abre y fuerza `activateView(true)`). El estado es único (en el plugin), no por vista; cada `TimeTrackerView` se limpia/redibuja al recibir tick. El timer normal usa `refreshAllTimerViews` (que llama `refreshTimerUI` en GTD y Foco). Al abrir una vista nueva, `initializePomodoroState` (timeTrackerView.ts:517-541) reconstruye la UI desde `plugin.activePomodoroSession`.

---

## 5. Time tracker view, estadísticas, timeline y actividad

### 5.1 TimeTrackerView (timeTrackerView.ts)

Dos tarjetas: selector de tarea (3 fuentes, búsqueda por subcadena en `content + contexts + people + tags`, **renderiza todos los resultados sin límite**, l.68-101) y controles (display HH:MM:SS, Iniciar / Pomodoro / Detener / Modificar / + Manual). Cada `render()` hace `await plugin.loadAvailableTasks(source)` = `parseVault` completo. Un `setInterval` de 1 s por instancia de vista para el display. No consulta `timeLogs`.

### 5.2 TimeTrackerService (timeTrackerService.ts)

- `addLogEntry`, `updateLogEntry`, `deleteLogEntry`: `push`/`findIndex`/`filter` + guardado completo. `id = Date.now().toString()`.
- `getMonthlyActivity(month)` (l.88-102): recorre TODOS los logs, `moment(startTime)` por cada uno, `isBetween(inicio mes, fin mes, 'day', '[]')`, suma `durationMinutes` por `YYYY-MM-DD` del inicio. O(N) con N parseos por llamada (cada render del calendario emergente de la timeline).
- `getStatistics(filters)` (l.26-49): agrega por **cada prefijo de ruta** (carpeta a carpeta) -> es la lógica jerárquica "pura", pero **no la usa nadie** (código muerto; `StatisticsView` reimplementa).
- `saveInterruptedSession/load/clear`: no-ops deprecados.

### 5.3 StatisticsView (statisticsView.ts)

Filtros: `today`, `week` (isoWeek), `month`, `year`, `all`, `custom`, `single-day`, navegación con flechas, selector `DatePickerModal` que recibe `{fecha: nº de registros}` calculado recorriendo todos los logs con `moment` (l.248-255).
`renderStatistics` (l.47-127): filtra todos los logs con `moment(log.startTime)` (atribuye todo el log al día de **inicio**, no reparte los que cruzan medianoche), suma `durationMinutes`, cuenta registros, `buildTree` (l.306-403): árbol por segmentos de ruta, `ownDuration/duration/recordCount`, nodos de tránsito (sin tiempo propio y un solo hijo), orden alfabético con archivos al final, clasificación por prefijo (`^\d{2} - `, `AV - `, `AI - `, `PGTD - `, `PQ - `). `renderTree` crea un `<details>` por nodo y una fila DOM por **cada registro** del periodo (l.472-516). Exportar a Excel (menú contextual) con la librería `xlsx` (dependencia pesada en el bundle). Cada `renderStatistics` añade otro `click` listener al contenedor (no se elimina; `empty()` no quita listeners) -> acumulación.
Coste: O(N_periodo * profundidad_ruta) + O(nodos) DOM; con `all` y miles de logs genera miles de nodos DOM; el filtro hace N parseos de moment (~decenas de µs cada uno).

### 5.4 TimelineView (timelineView.ts)

Vistas día / 3 días / semana, zoom 1x-4x. `renderTimeBlocks` (l.301-339) filtra TODOS los logs por columna (2 `moment()` por log y por día visible: semana = 7*N*2 parseos por render) y los agrupa con `groupOverlappingLogs` (l.341-370): ordena por inicio, un log entra al grupo si `start < max(end del grupo)`, los miembros comparten ancho en partes iguales (`100/n`, sin asignación de columnas óptima: un grupo encadenado A-B-C donde A y C no se solapan reparte en 3 igualmente). Logs que cruzan medianoche se parten por segmento de día; `MIN_DURATION_FOR_BLOCK = 10` min -> bloques cortos como indicador. Interacción: arrastrar para mover/duplicar con Alt, redimensionar, crear arrastrando, popover de calendario con intensidad (`<120`, `<300`, `>=300` min). Fugas: `ownerDocument.addEventListener('click')` en el constructor sin remover; `document.querySelectorAll` global en cada hover.

### 5.5 ActivityView / AnalyzerService (módulo Actividad)

**No leen `timeLogs`.** `AnalyzerService.getMetricsForPeriod(period, customStart, customEnd)` (analyzerService.ts:30-50):
- Rangos (`getDateRange`, l.56-74): `today` (día), `yesterday`, `week` (inicio de isoWeek hasta AHORA), `month` (inicio de mes hasta AHORA), `custom` (por defecto desde hace 10 años a ahora).
- Notas creadas/modificadas: `file.stat.ctime/mtime` dentro del rango, inclusive (`isBetween(...,'[]')`) sobre todos los `.md`.
- Tareas completadas/capturadas: **lee cada `.md` con `cachedRead`** y aplica `/^(.*?)✅ (\d{4}-\d{2}-\d{2})/gm` y `/^(.*?)➕ ...` (cualquier línea, no solo tareas; una coincidencia por línea; fecha a las 00:00 local).
- Caché `Map` por periodo (`custom-<start>-<end>`); `ActivityView.onOpen` y cada cambio de periodo/aplicar la **vacían** (`clearCache`), así que solo sirve al volver del detalle al dashboard.
- Costo: O(total de bytes del vault) por apertura/cambio de periodo, secuencial (`await` por archivo). Sin eventos: no se actualiza solo.
- Inconsistencia en `custom`: el fin es `moment('YYYY-MM-DD')` a las 00:00, por lo que las notas creadas/modificadas ese día (después de las 00:00) quedan fuera, pero las tareas con fecha igual sí entran. Balance neto = completadas - capturadas.
- Con Obsidian Sync, `mtime/ctime` en el dispositivo receptor reflejan la llegada del archivo (hipótesis), distorsionando "Notas modificadas/creadas".

### 5.6 Resumen de consultas y coste con muchos registros

| Consulta | Dónde | Complejidad | Notas |
|---|---|---|---|
| Filtro por rango | StatisticsView.renderStatistics | O(N) parseos | N=50k: del orden de 0.2-1 s (hipótesis) |
| Agregación jerárquica | `buildTree` | O(N*d + nodos log nodos) | recorre ruta completa por log |
| Render del periodo | `renderTree` | O(logs del periodo) nodos DOM | `all` es costoso |
| Calendario mensual | `getMonthlyActivity` | O(N) | por render del popover |
| Mapa de actividad del selector | `activityObject` | O(N) | por clic |
| Timeline | `renderTimeBlocks` | O(N * días visibles) x2 parseos | por render |
| Carga/guardado | `loadData/saveData`, sync | O(tamaño del archivo) | cada mutación; poll cada 15 s |
| Actividad | AnalyzerService | O(bytes del vault) | lectura de todo el vault |

Nada está indexado ni memoizado; no hay índice por día/mes.

---

## 6. Análisis crítico (Obsidian Sync y móvil) y datos a importar

### 6.1 Problemas del modelo actual

1. **Un único JSON mutable con reescritura total**: toda escritura de cualquier dispositivo contiene el estado completo; cualquier divergencia en memoria = pérdida en la siguiente escritura (sección 2.5). Con Sync (o Drive) es la peor combinación: conflictos de archivo completo.
2. **Mezcla de datos de naturaleza distinta en el mismo archivo**: registros históricos (append-mostly, valiosos), estado efímero del dispositivo (`activeTimer`, `activePomodoroSession`, cambia cada pocos minutos con overtime), configuración, estadísticas derivadas (`pomodoroStats`, recalculables).
3. **Estado en vivo en un archivo sincronizado y sondeado**: latencia de Sync de segundos a minutos; el poll de 15 s es solo detección de existencia; no hay reloj lógico, ni `deviceId`, ni `updatedAt`, ni heartbeat -> no se distingue un timer vivo de uno abandonado (se muestra el tiempo desde `startTime` aunque pasen días).
4. **Sin recarga ante cambios externos**: no se implementa `onExternalSettingsChange`; la memoria manda sobre el disco.
5. **IDs de registro `Date.now()`**: sin UUID; colisión improbable pero posible (duplicar en timeline con Alt, ráfagas, dos dispositivos); sin borrado lógico -> un borrado en A puede revivir si B reescribe su copia.
6. **Rutas absolutas dentro del vault repetidas en cada registro**: pesan más del 60 % del archivo y son frágiles ante renombrados/movimientos de proyecto (el histórico queda apuntando a rutas antiguas; no hay reparenting ni id estable). Tampoco se guarda el 🆔 de la tarea.
7. **Zonas horarias/offsets mezclados** (-05:00 y Z): al viajar o cambiar el huso, las agregaciones "por día" se hacen en el huso local del dispositivo que mira, y el log se atribuye al día de inicio.
8. **Móvil**: `setInterval` en segundo plano se suspende; tras volver, el timer sigue correcto (reloj de pared) pero la finalización del Pomodoro se notifica tarde; no hay notificaciones del sistema (sin permiso solicitado, sin plugin API de notificaciones locales); sin comandos para detener/registrar desde la paleta; `parseVault` completo en cada apertura del dashboard y `collectMetadata` en cada guardado son caros con batería/CPU limitadas; `xlsx` aumenta el bundle (carga y memoria); parseo del JSON completo cada 15 s.
9. **Atomicidad**: `stopTracking` hace dos `saveData` seguidos; Pomodoro `clearActiveSession` llama `savePluginData()` sin `await`; un cierre/crash en medio deja estados incoherentes.
10. **Escritura en notas sin referencia estable**: cierre de tarea por coincidencia de subcadena y fallback a "primera tarea abierta", sin considerar cambios concurrentes de Sync en esa nota (se escribe sobre contenido leído justo antes).

### 6.2 Datos a importar en la reescritura

Importar siempre (desde `data.json` y, si existe, `timelogs.json`):
- **`timeLogs[]`**: todos los campos. Normalizar: `startTime/endTime` a instante UTC (conservar offset original si se quiere mostrar la hora local original); recomputar `durationMinutes = floor((end-start)/60000)` y marcar los que no coinciden (resize/rounding); detectar `endTime < startTime` o duración 0; deduplicar por `id` y por (path, start, end); inferir `source` desde `notes` (`^Sesión Pomodoro`), conservar el texto íntegro de `notes`; extraer 🆔 de `taskDescription` (`🆔\s*([A-Za-z0-9]{6})`) como `taskId`; conservar `taskNotePath` literal y resolver el archivo actual por ruta o por 🆔 para detectar huérfanos; asignar nuevo id estable (UUID) guardando el viejo como `legacyId`.
- `pomodoroSettings` y `journalSettings` (configuración).
- Opcional/derivable: `pomodoroStats` (no es fiable por los defectos de 4.7; recalcular desde logs con prefijo Pomodoro).
- **No importar como estado vivo** `activeTimer` / `activePomodoroSession` salvo que sean recientes; si existen, convertir a un aviso "sesión interrumpida" (la ATP-3.2 de la historia lo pedía).
- Detectar legados: `timelogs.json` (formato antiguo, cuyo contenido el plugin ya descartó), claves `interruptedTimer` y `schemaVersion` (modelo de Foco obsoleto).

### 6.3 Diseño recomendado (resumen)

- Registros como **eventos append-only, una unidad de archivo por dispositivo y por mes** (p. ej. `Dovela/TimeLogs/<deviceId>/2025-08.jsonl` o `.json`) con id UUID/ULID, `updatedAt`, `deleted` (tombstone) y lectura que fusiona todos los archivos: dos dispositivos nunca escriben el mismo archivo -> sin conflictos. Un índice en memoria por día/mes.
- Estado en vivo (timer/pomodoro) **por dispositivo** (archivo `live/<deviceId>.json` con heartbeat, o `localStorage`/`app.saveLocalStorage`) y vista "en curso en otro dispositivo" con caducidad; nunca en el mismo archivo que los históricos.
- Guardado serializado (cola) y atómico; implementar `onExternalSettingsChange` para recargar.
- Referencia a la tarea por 🆔 + ruta como respaldo; cierre de tarea con `lineNumber` verificado + texto exacto, sin fallback a "primera abierta".
- Comandos de paleta para: detener, cancelar (con confirmación), registrar manual, pausar/reanudar; regla de exclusión mutua timer/pomodoro.
- Registros de Pomodoro con campos estructurados (`kind`, `plannedMinutes`, `overtimeMinutes`, `cycle`), no solo texto en `notes`, y fin de sesión = momento real de fin, no el clic en el modal.

---

## 7. Casos de prueba sugeridos para lógica pura

Extraer a funciones puras (sin `moment` global ni Obsidian). Datos de ejemplo en minutos/ISO.

**Duraciones**
1. `duration(start='10:00:00', end='10:29:59')` = 29 (trunca); `10:00:00`-`10:30:00` = 30; `end==start` = 0 (aceptado); `end<start` = error.
2. Inicio con segundos (`10:00:45`) y fin editado a `10:30:00` (seg=0): 29 (documenta el sesgo actual); con ambos normalizados: 30.
3. Cruce de medianoche `23:50` -> `00:10` (días distintos) = 20; con el modal de fecha (ambos al mismo día) = error.
4. Cambio de horario (DST) en un huso con cambio de hora: `01:30` -> `03:30` el día del salto = 60 min reales; verificar con instantes UTC.
5. Offsets mezclados: `2025-08-22T08:00:00-05:00` y `2025-08-22T13:00:00Z` son el mismo instante; comparaciones, orden y dedupe deben operar sobre instantes.
6. Resize: `Math.round(durationMinutes)` vs `floor(end-start)`: asegurar que para cualquier registro `durationMinutes == floor((end-start)/60000)` tras la normalización.
7. `formatDuration`: 0 -> `< 1 min`; 59 -> `59 min`; 60 -> `1 h`; 61 -> `1 h 1 min`; `asHoursMinutes` 125 -> `02:05`.

**Agrupaciones jerárquicas** (`getStatistics`/`buildTree`)
8. Un log de 45 min en `A/B/C/n.md`: `A=45`, `A/B=45`, `A/B/C=45`, `A/B/C/n.md=45`; segundo log de 30 en `A/B/D/m.md`: `A/B=75`, `A=75`, `C=45`, `D=30`.
9. `isTransitNode`: nodo sin tiempo propio y un solo hijo = true; con dos hijos = false; carpeta con tiempo propio (log en una nota con el mismo nombre que la carpeta) = false.
10. `recordCount` agregado coincide con el total del filtro; porcentaje = `duration / total * 100` con total 0 (sin logs) no divide por cero.
11. Rutas con nombres que contienen `/` no aplicables; nombres con puntos, tildes y espacios (`PGTD - Dovela v0.9`); archivo sin extensión `.md`; `taskNotePath` vacío se ignora.
12. `parseNodeName`: `03 - Gestion Personal` -> ROOT; `AV - x` -> AV; `PGTD - x` -> PGTD; `PGTDx` -> DEFAULT.

**Rangos y filtros**
13. `week` = lunes 00:00 a domingo 23:59:59.999 (isoWeek); un log exactamente a las 00:00 del lunes entra; uno a las 23:59:59.999 del domingo entra; a las 00:00:00 del lunes siguiente no.
14. Log que cruza medianoche: la estadística (por día de inicio) lo suma entero al día 1; la timeline lo reparte en dos segmentos (minutos de cada día suman la duración). Documentar y fijar el comportamiento esperado en la reescritura.
15. `getMonthlyActivity` para febrero 2024 (bisiesto), logs el 29/02 a las 23:59 y 01/03 a las 00:00; mes con 31 días.
16. Rango `custom` con solo inicio, solo fin y ninguno; `end` incluido hasta fin de día (evitar el defecto de `AnalyzerService.custom`, que usa 00:00).
17. Periodos de Actividad: `week` desde lunes hasta "ahora" (no fin de semana); `yesterday`; inclusividad en bordes.

**Solapamientos** (`groupOverlappingLogs`)
18. A 10:00-11:00, B 10:30-11:30, C 11:30-12:00 -> grupos [A,B], [C] (C empieza en el fin exacto del grupo: `start < maxEnd` es falso -> grupo nuevo).
19. Encadenado A 10-11, B 10:30-12, C 11:30-13 -> un solo grupo de 3 (comportamiento actual de reparto igual); definir si en la reescritura se quiere asignación por columnas (A y C en la misma columna).
20. Logs idénticos (duplicados con Alt), `start==end`, `start>end` (se descartan en `renderTimeBlocks`), orden de entrada aleatorio.
21. Detección de solapamiento entre un timer vivo y un Pomodoro vivo (hoy permitido): debería poder señalarse.

**Pomodoro**
22. `remaining(start, duration, now)`: a mitad = `duration/2*60` s; justo en el límite = 0; pasado el límite = 0 (clamp); overtime = segundos totales desde `startTime` (verifica que no usa `overtimeStartTime`).
23. Elección de descanso: ciclos 1..8 con `cyclesBeforeLongBreak=4`: largo solo en 4 y 8; ciclos 0 nunca. (Con el código actual, falla por el defecto 4.7-1 al integrarlo.)
24. `isSpecificTask`: descripción == basename -> false; descripción == ruta -> false; vacía -> false; descripción con texto -> true; descripción que coincide por casualidad con el nombre -> false (limitación).
25. Notas del log: sin overtime `Sesión Pomodoro (25/25 min)`, con overtime `... + Overtime (40 min total)`, con ciclos > 0 se añade ` - Ciclos completados: N`, con notas de usuario se separa con `\n\n`; no se registra si `< 1` minuto o sin `taskPath`.
26. `updateStats`: una sesión completa suma una vez (no dos si entra en overtime); `today*` se resetea al cambiar de día; suma minutos reales.
27. Reanudación tras reinicio: `now < end` continúa; `now >= end` debe generar estado "completada mientras estaba cerrado" con fin = `start+duration`, no `now`.

**Texto de tareas (cierre y estado)**
28. `getTaskState`: `- [ ] x` open; `- [/] x` in-progress; `- [x]`/`- [X]` completed; `- [!]`, `- [-]`, `- [?]` other; `* [ ] x` null; `- [ ]` sin texto (válida para `getTaskState`, no para `isValidTaskLine`); indentada con tabulaciones.
29. `createCompletedTaskLine`: añade ` ✅ YYYY-MM-DD` al final; si ya contiene `✅` no duplica; línea con 🔁 (recurrente) -> decidir comportamiento; línea con espacios finales; línea con `⏳ 2025-08-25` y `🆔 abc123` al final (la fecha va después del id: confirmar formato esperado por el plugin Tasks: `🆔` antes de `✅`).
30. `findTaskLine`: dos tareas con subcadena común (`Revisar API` y `Revisar API pública`) -> debe elegir la exacta, no la primera; descripción ya cerrada + otra tarea abierta en el archivo -> **no debe cerrar la otra** (reproduce el defecto 4.7-3); descripción inexistente -> `-1`, sin fallback.
31. `analyzeSelection`: sin selección, selección parcial dentro de la línea (válida), selección de dos líneas (error), línea no tarea (error), tarea completada (¿debe iniciar?).

**Persistencia / merge (simulables sin Obsidian)**
32. `mergeDefaults(loaded)` profundo: archivo sin `pomodoroSettings` -> copia independiente de defaults; archivo con `pomodoroSettings` parcial -> campos nuevos con default.
33. Fusión multi-dispositivo (cuando se rediseñe): A añade L1, B añade L2, B borra L0; unión por id con tombstones -> {L1, L2} sin L0; idempotencia al fusionar dos veces; commutatividad.
34. Migración: `timelogs.json` con 3 registros y ids repetidos de `data.json` -> importa 2, sin duplicar.

---

## 8. Lista de verificación de archivos clave

- `src/main.ts` (866 líneas): ciclo de vida, comandos, sync, barra de estado, glue Pomodoro/timer.
- `src/modules/moduloGTDv3/timeTrackerService.ts` (103): CRUD de logs + agregaciones (una muerta).
- `.../timeTrackerCommands.ts` (248): 3 comandos + 2 ribbons + detección de selección.
- `.../timeTrackerView.ts` (543): UI de control; sin consultas a logs.
- `.../pomodoroService.ts` (473): lógica de sesiones; `.../pomodoroModal.ts` (569): modales de cierre/ajustes/opciones; `.../timeLogModal.ts` (506): alta/edición/parada.
- `.../statisticsView.ts` (633), `.../timelineView.ts` (734): consultas reales sobre `timeLogs`.
- `src/modules/moduloActividad/analyzerService.ts` (137), `activityView.ts` (282): actividad (no tiempo).
- Referencias históricas: `docs/contexto-vault/historia/PGTD-Dovela-v0.2/Ax 250709 - Refactorización del archivo de datos timelogs.json a data.json.md`, `Ax 250814 - Entendimiento del time Tracker.md` (obsoleta: describe `startTimer/stopTimer/saveTimeLog`, `TimeLog.json` y campos `task/summary/project/context` que ya no existen), `Ax 250819 - Mejora del comando de inicio de registro de tiempo.md` (origen de la detección de selección y sus dos mensajes de error, hoy implementados tal cual), `PGTD-Dovela-v0.9/Ax 250821 - Prompt para el cierre de tareas...` (origen del toggle de cierre; pedía "seleccionado por defecto", "no duplicar ✅", "avisar si la tarea fue eliminada": solo lo primero y segundo están implementados, el tercero devuelve false con `console.warn` sin aviso al usuario), `PGTD 250918 - Modulo de Pomodoro v1.0` (lista de pruebas con ítems marcados como hechos que no se reflejan en el código: sesiones agrupadas por <30 min, ronda "1 de 4", stats de hoy, botón tras descanso).
