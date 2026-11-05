# B. Ingeniería inversa: capa de vistas/UI del módulo GTD (`src/modules/moduloGTDv3`)

Alcance: solo lectura. Todo lo afirmado sale del código leído (archivo/función entre paréntesis). Lo que es inferencia o requiere verificación en runtime está marcado como **[verificar]**.

Archivos leídos completos: `view.ts` (1029 l), `htmlGenerator.ts` (887), `calendarManager.ts` (278), `calendarRenderer.ts` (370), `timelineView.ts` (734), `statisticsView.ts` (633), `reviewPanelView.ts` (124), `smartInboxView.ts` (600), `cascadeMenuManager.ts` (417), `cascadeMenuRenderer.ts` (201), `cascadeSuggestionProvider.ts` (206), `cascadeMenuTypes.ts` (32), `datePickerModal.ts` (178), `settingsTab.ts` (384).
Leídos además por dependencia: `calendarDataProvider.ts`, `calendarTypes.ts`, `gtdProcessor.ts`, `inProgressProcessor.ts`, `parser.ts`, `hierarchyBuilder.ts`, `model.ts`, `stalledProjectService.ts`, `timeTrackerView.ts`, `timeTrackerService.ts`, `timeTrackerCommands.ts`, `timeLogModal.ts` (parcial), `dateUtils.ts`, `durationUtils.ts`, `colorUtils.ts`, `main.ts`. Docs: `CASCADE_MENU_DOCS.md`, `UNIFIED_@ _MENU_DOCS.md`, `INCREMENTAL_TYPING_IMPROVEMENT.md`. `styles.css` solo estructura.

---

## 0. Mapa general

### 0.1 Superficies de UI y cómo se abren

| Superficie | Clase / archivo | Tipo Obsidian | ID de vista / comando | Ribbon |
|---|---|---|---|---|
| Dashboard GTD (contenedor de 6 pestañas) | `GtdView` (`view.ts`) | `ItemView`, tipo `gtd-view`, título "GTD Dashboard", icono `list-checks` | comando `open-gtd-dashboard` ("Open GTD Dashboard"); además clic en la barra de estado del temporizador -> `activateView(true)` que cambia a la pestaña Seguimiento | `list-checks` "GTD Dashboard" |
| Panel de Revisión | `ReviewPanelView` (`reviewPanelView.ts`) | `ItemView`, tipo `dovela-gtd-review-panel-view`, icono `clipboard-check` | comando `open-gtd-review-panel` ("Revisión GTD: Encontrar proyectos estancados") | `clipboard-check` "Panel de Revisión GTD" |
| Smart Inbox (captura rápida) | `SmartInboxView` (`smartInboxView.ts`) | NO es ItemView ni Modal: `div` fijo anexado a `document.body` | comando `smart-inbox` ("Smart Inbox"), sin hotkey por defecto | `plus-circle` "Captura Rápida (Smart Inbox)" |
| Selector de fecha de Estadísticas | `DatePickerModal` | `Modal` | se abre desde el botón de fecha de Estadísticas | - |
| Registro de tiempo (alta/edición) | `TimeLogModal` (`timeLogModal.ts`) | `Modal` | desde Timeline, Estadísticas, Seguimiento, `stopTracking` | - |
| Pomodoro | `PomodoroModal` | `Modal` | desde Seguimiento / fin de sesión | - |
| Ajustes | `DovelaSettingsTab` | `PluginSettingTab` | Ajustes de Obsidian | - |
| Time tracker (comandos) | `timeTrackerCommands.ts` | - | `time-tracker-start-for-active-note`, `pomodoro-start-for-active-note`, `time-tracker-edit-active-timer` (con `checkCallback`) | `play-circle` "Iniciar temporizador", `timer` "Iniciar Pomodoro" |

Notas de activación (`main.ts`): `activateView` reutiliza `leaves[0]` o abre `getLeaf('tab')`; `activateReviewPanelView` igual. `onunload` hace `detachLeavesOfType` solo de GTD y Backlinks (no del Review Panel). Ni Estadísticas ni Cronograma tienen comando/ribbon propio: solo se llega por la pestaña del Dashboard.

### 0.2 Las 6 pestañas del Dashboard (`htmlGenerator.ts: generateGtdViewHtml`)

`activeView` (por defecto `'gtd'`, solo en memoria):

| Botón (`data-view`) | Contenido | Quién renderiza |
|---|---|---|
| 📊 Vista Jerárquica (`hierarchy`) | Árbol de notas del vault con contadores de tareas y buscador | HTML string (`renderHierarchyViewRecursive`) |
| 📋 Listas GTD (`gtd`, por defecto) | Listas GTD con filtros y navegación rápida | HTML string (`renderGtdListsView`) |
| ⚡ En Progreso (`inProgress`) | Tareas `- [/]` con agrupación/orden | HTML string (`renderInProgressView`) |
| ⏱️ Seguimiento (`time-tracker`) | Cronómetro/Pomodoro/selector de tarea/alta manual | `TimeTrackerView` (DOM API) en `#time-tracker-container` |
| 📈 Estadísticas (`statistics`) | Árbol de tiempo registrado por carpeta/nota | `StatisticsView` (DOM API) en `#statistics-container` |
| 📅 Cronograma (`timeline`) | Rejilla horaria de registros de tiempo | `TimelineView` (DOM API) en `#timeline-container` |
| 🔄 Refrescar | `drawView()` completo | - |

Importante: **Estadísticas y Cronograma NO trabajan sobre tareas**, sino sobre `plugin.data.timeLogs` (registros de tiempo en `data.json`). Las tareas solo alimentan Jerárquica, Listas GTD y En Progreso.

---

## 1. Detalle por vista

### 1.1 `GtdView` (contenedor) - `view.ts`

**Estado en memoria (nada persistido):** `activeView`, `activeGrouping` (`none|context|person|project`), `activeSorting` (`priority|duration-asc|duration-desc`), `overdueGroupingMode` (`date-first|context-first`), instancias `timeTrackerView`, `statisticsView`, `timelineView` (se crean la primera vez y se reusan con `updateContainer(newEl)` en cada redibujo). No hay `localStorage` en todo el módulo GTD (sí lo usan Foco y Backlinks). Al cerrar la vista se pierde todo (pestaña, agrupación, filtros, fecha de estadísticas, zoom de timeline).

**`onOpen`:** pone `<div class="gtd-loading">` y llama `drawView()`. **`onClose`:** `abort()` del `AbortController`, `timeTrackerView.clearTimerInterval()`, `timelineView.clear()` (vacío) y `contentEl.empty()`.

**`drawView()` (el único "render"):**
1. `abort()` + nuevo `AbortController`.
2. `parseVault(vault, metadataCache)` (lee con `cachedRead` TODOS los `.md` no excluidos y parsea tareas por regex), `buildHierarchy`, `createTaskBreadcrumbMap` (id tarea -> "Raíz > Área > Proyecto"), `processGtdLists`, `processInProgressTasks`. Esto se ejecuta **siempre, aunque la pestaña sea Estadísticas/Cronograma/Seguimiento** (esos datos se descartan).
3. `generateGtdViewHtml(...)` devuelve un string gigante; `contentEl.empty(); contentEl.innerHTML = html`.
4. Para las pestañas basadas en clase, instancia/reubica la clase en su contenedor.
5. `addEventListeners()` y `setTimeout(checkInProgressTasks, 100)`.
6. `catch` -> `div.gtd-error` genérico.

No hay guarda de concurrencia: dos `drawView()` seguidos (doble clic en un botón) se solapan en el `await parseVault` y la última en terminar gana.

**Refresco:** no hay `registerEvent` de vault/metadataCache en la vista, ni `registerInterval`. Se refresca solo: (a) al hacer clic en cualquier botón de pestaña/agrupación/orden/toggle de vencidas/"Refrescar"; (b) `refreshStatistics()` llamado desde `main.refreshAllGtdAndFocoViews()` cuando se detiene o cancela un temporizador (re-renderiza solo Estadísticas); (c) `refreshTimerUI()` / `updatePomodoroDisplay()` del `TimeTrackerView` invocados por `main` en sincronización del temporizador (intervalo de sync de 15 s en `main.startSyncInterval` + evento `modify`). Las listas GTD quedan obsoletas si se edita una nota mientras el dashboard está abierto, hasta pulsar Refrescar. Cronograma no se refresca al parar un temporizador.

**Listeners (`addEventListeners`):** todos colgados de `this.contentEl` con `{signal}` salvo los de los inputs de filtro (se destruyen con el DOM). Click delegado (ver 1.2-1.4).

**Router de clic (listener delegado, orden de prioridad):**
1. `.gtd-nav-link` -> `preventDefault` + `scrollIntoView({behavior:'smooth'})` al `[id=...]` (anclas internas, no cambia el hash).
2. `target.classList.contains('gtd-breadcrumb-toggle')` -> alterna clase `breadcrumb-is-open` del `.gtd-task` (muestra el camino "└─ ... > ... > ..." de la tarea).
3. `closest('button')`: `.gtd-view-button` (cambia pestaña y `drawView`), `.gtd-refresh-button`, `.gtd-hierarchy-control-button[data-action=expand-all|collapse-all]` (abre/cierra todos los `details.gtd-card-container`), `.gtd-grouping-button`, `.gtd-sorting-button` (cicla prioridad -> duración asc -> duración desc). Cualquier otro botón retorna sin hacer nada (incluidos `.filters-toggle` y `.gtd-overdue-toggle`, que tienen listener propio).
4. `.dependency-link` -> `handleDependencyLinkClick(id)`: **vuelve a ejecutar `parseVault` completo** para encontrar la tarea con ese id y abre `openLinkText(file.path, '', false, {eState:{line}})` + Notice.
5. `closest('[data-item-path], [data-task-path], .internal-link')` -> `preventDefault`; ruta = `itemPath || taskPath || href`; línea = `data-task-line` (0 si no hay). Abre con `openLinkText(path, '', false, {eState:{line}})`. Efectos: clic en cualquier punto de una fila de tarea abre la nota en esa línea; clic en `[[enlace]]` abre la nota enlazada (el `<a>` es el ancestro más cercano); clic en cabecera de tarjeta jerárquica abre la nota. `newLeaf=false`: no abre pestaña nueva **[verificar si reemplaza la pestaña del Dashboard]**. En la tarjeta jerárquica el `preventDefault` también anula el toggle nativo de `<summary>` cuando se hace clic sobre la cabecera **[verificar]**.
6. Un segundo listener de clic maneja `.gtd-overdue-toggle` (`preventDefault` + `stopPropagation` para que no pliegue el `<details>`), alterna `overdueGroupingMode` y redibuja.

El dashboard es **solo lectura sobre tareas**: no hay completar/editar/postergar tarea desde la UI (el `<input type="checkbox">` de "En Progreso" no tiene handler; el clic lo intercepta el router y abre la nota).

**Header "pegajoso" (`#gtd-sticky-header`):** contiene botones de pestaña, `#gtd-total-tasks` ("Total de Tareas Abiertas: N" = tareas no completadas, con duplicados contados una vez), y solo en pestaña GTD: filtros + navegación rápida. JS: `scrollHandler` escucha `scroll` en `contentEl` y alterna `.scrolled` (sombra, fondo) y `.compact` cuando `scrollTop > 50`. **[verificar]** Según CSS, el scroller real es `.gtd-view-content` (`overflow-y:auto` dentro de `.gtd-view-container{overflow:hidden; display:flex; column}`), y los eventos `scroll` no burbujean, por lo que el handler sobre `contentEl` probablemente nunca dispara (código muerto) y el header queda fijo por layout flex, no por `position:sticky`. Lo mismo aplica al auto-colapso de filtros en móvil al hacer scroll (`smartScrollHandler`).

**Móvil (`initializeMobileFiltersOptimization`, solo pestaña GTD):** `isMobile = window.innerWidth <= 768` (ancho de ventana, no `Platform.isMobile`; en escritorio con panel estrecho no se activa). En móvil: botón `#filters-toggle` ("🔍 Filtros (N activos)", `aria-expanded`) expande/colapsa `.filters-content`; colapsado = inline styles `pointer-events:none; visibility:hidden; z-index:-1` sobre contenido, inputs y grupos (duplica lo que ya hace CSS con `!important` en `styles.css` ~3745-3830); inputs con `autocomplete/autocorrect/spellcheck=off`; foco en input expande y hace `scrollIntoView` tras 300 ms; en `resize`/`orientationchange` colapsa en landscape; en escritorio fuerza `expanded` y limpia estilos. Hay ~12 `console.log` de depuración en esta ruta.

**`checkInProgressTasks`:** tras el render, por cada `.check-in-progress[data-check-path]` (todas las tarjetas jerárquicas con archivo) hace `vault.read` secuencial y, si el contenido cumple `/^- \[\/\]/m` (tarea `/` sin indentar), añade clase `has-in-progress-tasks` (resaltado CSS). N lecturas de archivos por cada render de la jerárquica; no usa `cachedRead` ni el parser ya cargado (la info ya existe en `allTasks`).

### 1.2 Pestaña Jerárquica

- **Datos:** `parseVault` crea un `HierarchicalItem` por nota (tipo por frontmatter `type` ∈ {GrupoAV, Dly, Wk, M, Q, H, Y} o por prefijo del basename "AV ", "AI ", "PGTD ", "PQ ", "RR ", "Tx ", "Vx ", "Reu ", "Rf ", "Sue ", "Cp ", "EMkt ", "RT ", "RL ", "Ax "; por defecto `Ax`). Excluye: no-`.md`, ruta que empiece por `03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/Plantillas`, y cualquier ruta con un segmento `99 - Adjuntos` (constantes hard-coded en `parser.ts`).
- `buildHierarchy` (`hierarchyBuilder.ts`): la jerarquía se deriva de carpetas; una "nota de carpeta" es `Carpeta/Carpeta.md` y se fusiona con la carpeta; si falta se crea placeholder `[FALTA] nombre` (`isNoteMissing`, clase `is-missing`). Raíz virtual "Vault". Orden: nivel 0 por nombre; resto por `TYPE_ORDER`, luego `estado` (frontmatter), luego `ctime` desc. Contadores: `ownTaskCount` (abiertas propias) y `descendantTaskCount`.
- **Render (`renderHierarchyViewRecursive`):** `<details class="gtd-card-container gtd-hierarchy-item">` con `<summary>` -> `.gtd-card-header[data-item-path]` (icono por `data-type`, nombre, `estado` del frontmatter, contadores propios/totales con tooltips "Tareas en esta nota"/"Tareas totales en la jerarquía"). Hojas: `div.gtd-card-leaf`. Abiertos por defecto los de nivel < 2. Atributos de búsqueda `data-search-name` (minúsculas), `-type`, `-has-own`, `-has-desc`, `-total`, `-level`.
- **Controles:** `#hierarchy-search-filter` (texto), toggle "Incluir contenido" (`#hierarchy-include-content`, `role=button`, accesible con Enter/Espacio), `#hierarchy-search-results` (resumen "N: 📄 títulos 📝 contenido"), botones "Expandir Todo" / "Colapsar Todo".
- **Búsqueda (`applyHierarchySearch`, dentro de `addEventListeners`):** por título = `includes` sobre `data-search-name`; con contenido = lee cada archivo (`vault.read`, minúsculas, cache en un `Map` local por `drawView`) y busca substring. Debounce de 300 ms solo en modo contenido (en modo título es síncrono, delay 0 pero igualmente `setTimeout`). Muestra/oculta con `style.display` y `visibility`, abre `<details>` ancestros de coincidencias y aplica clases `search-highlight`, `search-match-title|content`. Sin cancelación de ejecuciones asíncronas ya iniciadas -> resultados obsoletos si se teclea rápido. Para cada ítem no coincidente por título se hace un `await readFileContent` secuencial (O(N) lecturas la primera vez).
- No tiene filtros por tipo/estado a pesar de que `data-search-type/-has-own/-has-desc/-total` están emitidos (atributos sin uso).

### 1.3 Pestaña Listas GTD (la principal)

**Listas (`GtdList`, `gtdProcessor.ts`) y orden de render (`generateDynamicListOrder`):** "Ojalá Hoy" primero SOLO si tiene contenido; luego `Vencidas, Bandeja de Entrada, Calendario, Proyectos, Próximas Acciones, Asignadas o Delegadas, En Pausa, Esta Semana No, Algún Día / Tal Vez`. Las vacías no se muestran.

Reglas de pertenencia (resumen de `processGtdLists`; una tarea puede estar en varias):
- Tareas completadas: ignoradas. Se recogen contextos/personas únicos (alimentan los `datalist` de filtros).
- Tag `GTD-AlgunDia` -> solo "Algún Día / Tal Vez"; `GTD-EstaSemanaNo` -> solo "Esta Semana No" (listas exclusivas).
- **Bandeja de Entrada:** `hasConflict` (hora inicio/fin inválidas, fin <= inicio, o duración != fin-inicio), tag `inbox`, fechas incoherentes (🛫 posterior a ⏳/📅; en ese caso solo Inbox), tarea con fecha pasada/hoy sin contexto ni persona, o con semana `[w::[[YYYY-Www]]]` pasada/actual sin contexto/persona; fallback final si no está en ninguna lista.
- **En Pausa:** dependencia `⛔ id` sin resolver, semana futura, o `displayStatus='paused-start'` (🛫 futuro). Las de 🛫 futuro no pasan a más listas; las dependientes pueden duplicarse.
- **Calendario:** `📅 fecha` + `[hI:: hora]`. Las de hoy además van a "Ojalá Hoy" > grupo "📅 Agenda de Hoy" (título con "N citas - Xh Ymin", fin = `hF` o inicio+duración o +30 min por defecto).
- **Vencidas:** `displayStatus==='overdue'` (⏳ o 📅 pasada). Mapa con clave compuesta `"📅 fecha|cx-X"` (modo `date-first`) o `"📋 cx-X|fecha"` (modo `context-first`; personas con 👤 `px-`), "cx-Sin Contexto" si no hay. Render jerárquico en `renderOverdueGroupedTasks` (grupo primario `.gtd-overdue-primary-group` + subgrupos `.gtd-subgroup.gtd-overdue-secondary-group`). Botón en el `<summary>`: `📅→📋` / `📋→📅` (`.gtd-overdue-toggle`).
- **Ojalá Hoy:** sin hora y con ⏳/📅 = hoy (o dependencia pausada con fecha hoy); agrupado por `cx-ctx` / `px-persona` / `cx-Sin Contexto`.
- **Asignadas:** una entrada por persona `px-`. **Próximas Acciones:** una entrada por contexto `cx-`; sin contexto pero con 🛫 activo -> `cx-Sin Contexto`. **Proyectos:** contexto `ProyectoGTD` o `Entregable`.
- `displayStatus` (clases `task--overdue|today|future|paused-start|paused-dep`, colores rojo/verde/azul/naranja): prioridad overdue > today > paused-start; con dependencias sin resolver: overdue si ⏳/📅 vencida, si no `paused-dep`.

**Render de una tarea (`renderTask`):** `<li class="gtd-task task--X" data-task-path data-task-line data-contexts='[json]' data-people='[json]' data-content="...">` con símbolo de prioridad (⏫🔼🔽⏬), `⏰ HH:mm-HH:mm` si tiene hora, contenido con `[[x]]` -> `<a class="internal-link" href="x">` y `⛔ id` -> `⛔ id <span class="dependency-link" data-dependency-id>🔗</span>`; metadatos (símbolo+fecha con clase `is-overdue`, contextos sin prefijo, personas, 📄 toggle de breadcrumb); contenedor `.gtd-breadcrumb-container` oculto hasta toggle.

**Controles de filtro (`generateFiltersHtml` + `applyFilters`):** tres inputs de texto: Contexto (`#context-filter`, `datalist`), Persona (`#person-filter`, `datalist`) y Tarea (`#task-content-filter`). Contexto/Persona hacen **coincidencia exacta** contra `data-contexts`/`data-people` (JSON.parse por tarea en cada pulsación); Tarea es substring en minúsculas sobre `data-content`. Evento `input` sin debounce, recorre todo el DOM `.gtd-task`. Actualiza: visibilidad y contador de cada `.gtd-list` y `.gtd-group`, enlaces de la navegación rápida y sus contadores, y `#gtd-total-tasks` ("Tareas Filtradas: X (de Y totales)"; unicidad por `path:line`). Clase `.has-value` en el grupo del input.

**Bugs/riesgos concretos en esta pestaña:**
- `applyFilters` recorre `.gtd-subgroup` pensando en la navegación (`details.gtd-subgroup` de `.gtd-sub-nav`), pero los subgrupos de **Vencidas** también llevan la clase `gtd-subgroup` (`gtd-subgroup gtd-overdue-secondary-group`). Como no contienen `.gtd-sub-nav-link`, se les asigna `display:none` en cuanto se teclea cualquier filtro y no se restauran al limpiarlo hasta pulsar Refrescar. **[verificar]** (lectura directa de `view.ts` líneas 398-408 y `htmlGenerator.ts` 459).
- `data-content="${task.content.replace(/"/g, '"')}"` es un no-op (probablemente se quiso `&quot;`): una tarea con `"` rompe el atributo y el filtro de texto.
- No hay escape HTML en `task.content`, `sourceFile.path`, nombres de nota (`item.name`), `groupName`, opciones de `datalist`, etc. Todo va a `innerHTML`. Vulnerabilidad de inyección/ruptura de DOM con contenido del vault.
- Los contadores de lista cuentan duplicados (una tarea aparece en N sublistas); el total superior cuenta únicos.
- Alias `[[ruta|alias]]` se muestra como `ruta|alias` y se usa entero como `href`.

**Navegación rápida (`generateQuickNavHtml`):** enlaces principales por lista (icono + nombre + contador) más, bajo `details.gtd-subgroup`, "Ojalá Hoy"(🌟), "Contextos" (Próximas Acciones) y "Asignadas" con sub-enlaces separados por " | ". Anclas por `createAnchorId` (minúsculas, elimina todo lo no `[a-z0-9 -]`: `Ojalá` -> `ojal`).

### 1.4 Pestaña En Progreso

- Tareas con `status==='in-progress'` (`- [/]`).
- Cabecera de métricas: Tareas Activas (`stats.total`), Tiempo Definido (suma de `[Xmin|Xh]`), Tiempo Estimado (definido + 20 min por tarea sin duración), Vencidas (si > 0).
- Agrupar por: Ninguno (grupos "🔴 Vencidas", "⭐ Prioridades de Hoy" [= tienen fecha no pasada, aunque no sea hoy], "Otras Tareas"), Contexto (`@ctx`), Persona (`@px`), Proyecto (`getProjectGroupForTask`: primer segmento `PGTD - ` -> `📂`, último `AI - ` -> `🧠`, `AV -|PQ -|RR -` -> `🏠`, si no `📁 carpeta`). Orden: botón cíclico prioridad(+fecha) / duración asc / duración desc.
- Cada tarea: `renderInProgressTask` (similar a `renderTask` pero con checkbox inerte y duración `[..]`). Sin filtros, sin búsqueda. Estado de agrupación/orden en memoria; cada cambio -> `drawView()` completo.

### 1.5 Pestaña Seguimiento (`timeTrackerView.ts`, para contexto)

Dos tarjetas: "Control de Tiempo" (display `00:00:00`, ↗️ ir a la tarea con `openLinkText(..., {eState:{line}})`, botones ▶️ Iniciar / 🍅 Pomodoro / ⏹️ Detener / ✏️ Modificar / + Manual) y "Seleccionar Tarea" (botones de fuente Notas Abiertas / En Progreso / Todas + input de búsqueda + resultados). Fuente de tareas = `plugin.loadAvailableTasks(source)` (**ejecuta `parseVault` completo cada vez** que se renderiza la pestaña o se cambia de fuente). El cronómetro es un `setInterval` de 1 s por instancia (`activeTimerInterval`); solo se limpia en `syncTimerUI` y `onClose`, por lo que **sigue corriendo (actualizando nodos desmontados) al cambiar a otra pestaña** hasta que se vuelva a renderizar. Estado persistente: `data.activeTimer`, `data.activePomodoroSession`, `data.timeLogs`.

### 1.6 Pestaña Estadísticas (`statisticsView.ts`)

**Fuente de datos:** exclusivamente `plugin.data.timeLogs` (campos `id, taskNotePath, startTime, endTime, durationMinutes, notes, taskDescription`). Un log pertenece al periodo si su `startTime` cae dentro de [inicio, fin] (un log que cruza medianoche cuenta completo en el día de inicio).

**Estado (memoria):** `activeDateFilter` (por defecto `'today'`), `currentDateFocus`, `customStartDate/EndDate`.

**Controles:** barra superior con flechas ‹ › (desplazan 1 día/semana ISO/mes/año según el filtro; deshabilitadas en `all`/`custom`), botón central con título ("Estadísticas de Tiempo: Lunes, 3 de noviembre de 2025" / "D MMM - D MMM, YYYY" / "Mes de YYYY" / "Año YYYY" / "Siempre" / rango) que abre `DatePickerModal`, y toolbar 🔽 expandir todo / 🔼 colapsar a nivel < 2.

**Métricas:**
- Bloque "Tiempo Total" (suma de `durationMinutes`, `Xh Ym`) y "Registros" (cantidad).
- Árbol por segmentos de `taskNotePath` (`buildTree`): cada nodo (carpeta o archivo `.md`) con `duration` acumulada, `recordCount`, `ownDuration`, y porcentaje sobre el total del periodo (`toFixed(1)%`). Tipo de nodo por prefijo del nombre (`NN - `=ROOT, `AV - `, `AI - `, `PGTD - `, `PQ - `, DEFAULT) -> `data-folder-type` (colores CSS). Icono 📁/📄. `isTransitNode` = sin tiempo propio y exactamente 1 hijo.
- Hojas (archivos) despliegan sus logs ordenados por fecha: badge fecha (mes/día), día de la semana y año, rango `🕒 HH:mm → HH:mm`, píldora de duración (`formatDuration`), `📌 Tarea:` (si difiere del nombre) y `📝 Nota:`. Clic en un log abre `TimeLogModal` para editar/eliminar y luego re-renderiza.
- Interacciones: "salto inteligente" (clic en un nodo de tránsito cerrado abre toda la cadena de nodos de tránsito); `contextmenu` sobre un nodo -> `Menu` con "Exportar a Excel".
- Estado vacío: "No hay registros de tiempo para el período seleccionado."

**Detalles técnicos y problemas:**
- `renderStatistics` añade un `container.addEventListener('click', ...)` **en cada llamada** sobre el mismo contenedor (navegar con ‹ › o refrescar acumula listeners, sin `signal`) -> fuga y ejecución duplicada. Se "reinicia" solo cuando `GtdView.drawView` entrega un contenedor nuevo.
- `attr: { open: level < 2 }` pasa un booleano (atributo `open="false"` seguiría abriendo); queda corregido por el bucle posterior que fija `detail.open`.
- `sortRecursive` tiene una condición simétrica errónea (`if (!bIsFile && aIsFile) return -1;`).
- Navegación del `DatePickerModal` por sub-componentes con `moment.locale('es')` global (ver 2.7).
- `activityObject` (logs por día, para el heatmap del modal) se recalcula recorriendo todos los logs en cada apertura.
- Re-renderiza todo el árbol DOM en cada cambio (sin virtualización).

**Exportación a Excel (`exportNodeToExcel`):**
- Disparo: clic derecho en un nodo -> "Exportar a Excel". Exporta los logs del nodo y descendientes **ya filtrados por el periodo activo** (`collectLogsFromNode` sobre el árbol construido con `filteredLogs`), ordenados por `startTime`. Si no hay: Notice "No hay registros de tiempo para exportar en este nodo."
- Una sola hoja `Registros de Tiempo`. Columnas (10, en orden):
  1. `Ruta Completa` = `taskNotePath` sin `.md`
  2. `Tarea` = nombre del archivo sin `.md` (o `N/A`)
  3. `Descripción Tarea` = `taskDescription`
  4. `Fecha` = `YYYY-MM-DD`
  5. `Día de la Semana` = `dddd` en `es`
  6. `Hora Inicio` = `HH:mm`
  7. `Hora Fin` = `HH:mm`
  8. `Duración (Minutos)` = número `durationMinutes`
  9. `Duración (hh:mm)` = `formatDuration(min, true)` -> `HH:MM` con ceros
  10. `Notas del Registro` = `notes`
- Ancho de columna auto (`!cols` con `wch = max longitud + 2`). Nombre: `Exportación - {node.name} - {rangeText}.xlsx` (`getFilterDateRangeText`: Hoy / Semana del D MMM / MMMM YYYY / Año YYYY / Siempre / rango / día). Descarga con `Blob` + `<a download>` + `URL.createObjectURL`, Notice "La exportación a Excel ha comenzado."
- Dependencias: `xlsx` 0.18.5 (import completo `* as XLSX`, miles de KB en el bundle) y `@types/xlsx` (stub obsoleto) en `package.json`. 0.18.5 tiene avisos conocidos (prototype pollution / ReDoS) y la descarga con `<a download>` suele **no funcionar en Obsidian móvil** **[verificar]**.

**Cómo reemplazar xlsx por CSV (mismos datos, cero dependencias):**
1. Construir las mismas 10 columnas como arreglo de arreglos.
2. Escapar cada celda: si contiene `"`, `,`/`;`, `\n` o `\r` -> `"` + `valor.replace(/"/g,'""')` + `"`.
3. Separador: `;` si se apunta a Excel en locale español (que usa `;` y coma decimal), `,` en caso contrario (o hacerlo setting). Saltos `\r\n`.
4. Prefijo BOM `﻿` para que Excel abra UTF-8 (acentos, emoji).
5. Los números (`Duración (Minutos)`) sin comillas; `Fecha` en ISO (Excel la reconoce); `Duración (hh:mm)` queda como texto "01:30" (Excel lo interpreta como hora; para forzar texto prefijar `'` o usar sólo minutos).
6. Entrega: desktop `Blob('text/csv;charset=utf-8')` + `<a download>` como ahora; **móvil y escritorio de forma robusta**: `vault.create('Exportaciones/{nombre}.csv', csv)` (o `adapter.write`) y `Notice` con la ruta + `workspace.openLinkText`. Se pierden: formato de ancho de columna y tipado nativo (aceptable). Se eliminan `xlsx` y `@types/xlsx` de `dependencies`.

### 1.7 `DatePickerModal` (`datePickerModal.ts`)

Modal con `contentEl.addClass('date-picker-modal')`. Izquierda "Acciones Rápidas": Hoy / Esta Semana / Este Mes / Este Año / Siempre (devuelven `{filter: today|week|month|year|all}`), y "Selección Manual" con botón dinámico ("Aplicar Día (D MMM)" / "Aplicar Rango (D MMM - D MMM)", deshabilitado sin selección). Derecha: calendario mensual con ‹ › (cabecera L M X J V S D, semana ISO), celdas con heatmap por **cantidad de logs** del día (`<3` low, `<7` medium, resto high), `is-today`, `is-start-date/is-end-date/is-in-range`. Clic 1 = inicio, clic 2 = fin (se intercambian si invertidos), clic 3 = reinicia. Resultado: `custom` (rango) o `single-day`. Cada clic redibuja todo el modal (`renderModalContent`). El resultado se aplica en `StatisticsView.renderStatistics(result.filter)`.

### 1.8 Pestaña Cronograma (`timelineView.ts`)

**Qué es:** calendario tipo agenda de **registros de tiempo** (no de tareas) sobre `plugin.data.timeLogs`. 24 h verticales por día; columnas 1, 3 o 7 (lunes-domingo ISO).

**Estado (memoria):** `viewType` (`day|3-day|week`, por defecto `day`), `currentDate`, `hourScale` (1.5 por defecto = "Zoom: 150%", rango 1-4 en pasos de 0.25 -> 100%-400%), `calendarCurrentDate` del popover. `BASE_HOUR_HEIGHT=50` px por hora (a 150%: 75 px/h = 1800 px/día).

**Controles:** ◄ Hoy ► (salta 1/3/7 días según vista), botón de título (rango de fechas) que abre `timeline-calendar-popover` con calendario mensual y heatmap de actividad (`getMonthlyActivity`: minutos por día; `<120` low, `<300` medium, resto high), selector Día/3 Días/Semana, zoom − / +.

**Bloques:**
- Se seleccionan logs que intersectan el día; se agrupan por solapamiento (`groupOverlappingLogs`; comparación con el fin máximo del grupo) y se reparte el ancho `100/N` por columnas. Posición/altura en % del día (sin cálculo de carriles óptimo: dos logs solapados a distintas horas dentro de un mismo grupo comparten ancho aunque no se pisen entre sí).
- Color por hash del primer segmento de `taskNotePath` (carpeta raíz; `colorUtils.generateColorFromString`, 10 tonos pastel fijos x 8 luminosidades).
- Contenido adaptable por altura en px (`size-tiny` < 35, `size-small` < 70): proyecto (nombre de archivo), tarea, notas, duración. Tooltip nativo (`title`) con proyecto, tarea, duración, periodo y notas.
- Logs multidía se parten en segmentos con clases `timeline-block-continuation-start|middle|end`; clic abre el modal; sin drag/resize. Segmentos < 10 min de un log multidía se pintan como `timeline-short-event-indicator`.
- Hover cruzado: `mouseenter` consulta `document.querySelectorAll(...)` (global) para resaltar todos los segmentos del mismo `logId`.

**Interacciones:**
- Clic en bloque -> `TimeLogModal` (editar/eliminar) y `render()`.
- **Arrastrar y soltar HTML5** (`draggable=true`, `dataTransfer text/plain = logId`) a otra columna/hora: mueve (y con Alt/Option copia, `dropEffect=copy`). El minuto de destino se calcula como `(dropY/alturaColumna)*1440` **sin redondear** (puede producir segundos/fracciones en el ISO). `updateLogEntry` (mover) o `addLogEntry` (copiar). **No funciona con táctil** (HTML5 DnD no se dispara con touch en WebView móvil).
- Redimensionar con el asa inferior (solo eventos de ratón `mousedown/mousemove/mouseup` en `document`); actualiza `endTime` y `durationMinutes`. Sin soporte táctil. Umbral de 5 px para distinguir clic de arrastre.
- Crear arrastrando en zona vacía (`mousedown` directo sobre la columna) -> previsualización `timeline-block-preview` -> al soltar abre `TimeLogModal` con inicio/fin prellenados (sin snap; mínimo 5 px). Si se suelta fuera de la columna, el `mouseup` (registrado en la columna) no llega y la previsualización queda hasta el próximo `render()`.
- No hay auto-scroll a la hora actual ni línea de "ahora".

**Fugas/riesgos:** (1) el constructor registra un `click` en `ownerDocument` sin `signal` ni remoción (el método `clear()` está vacío) -> una fuga por cada apertura del dashboard; (2) `calendarPopover` queda con referencia a un nodo desmontado cuando `render()` hace `container.empty()`; el siguiente clic en el título cree que está abierto; (3) tras guardar, `render()` reconstruye toda la rejilla (7 columnas x N logs, con múltiples `moment()` por log y por columna; `Array.prototype.sort` in-place del array filtrado); (4) no se refresca cuando cambian los logs desde otra parte (temporizador detenido) hasta salir y volver a la pestaña.

### 1.9 Panel de Revisión (`reviewPanelView.ts` + `stalledProjectService.ts`)

- UI: `<h2>Panel de Revisión GTD</h2>`, texto "Buscando proyectos estancados...", luego "Se encontraron N proyectos que no tienen próximas acciones definidas." y lista `ul.review-panel-list` con, por proyecto: nombre (nombre de carpeta), ruta de carpeta, y botones **+ Añadir Tarea** (abre la nota del proyecto con `openLinkText` + Notice; no inserta nada), **🔵 Archivar** (`fileManager.processFrontMatter` -> `estado = '🔵'`, Notice "archivado", re-render completo), **📂 Abrir Carpeta** (`app.openWithDefaultApp(parent.path)`, API interna solo escritorio; en móvil Notice "no disponible"). Estado vacío: "✅ ¡Excelente! Todos tus proyectos tienen próximas acciones definidas. ¡Sigue así!".
- Regla de "estancado" (`findStalledProjects`): carpetas cuyo nombre empieza por `PGTD ` (con espacio) y cuya nota-carpeta `Carpeta/Carpeta.md` existe y tiene `frontmatter.estado === '🟢'` (estados del vault: 🟢 activo, 🔴 cancelado, 🔵 archivado, 🟡 suspendido) y cuya "jerarquía" no tiene ninguna tarea abierta (`parseTasks` del módulo Foco, `!completed`; las `[/]` cuentan como abiertas). Jerarquía = todos los `.md` de la carpeta (recursivo) + notas enlazadas (links salientes del metadataCache) a 1 y 2 niveles (`collectProjectHierarchyFiles`, copiado de Foco). **Riesgo:** enlazar desde el proyecto a un área/nota con tareas abiertas ajenas hace que el proyecto deje de aparecer como estancado (falso negativo).
- Rendimiento: lectura `cachedRead` de cada archivo de la jerarquía por proyecto activo, secuencial; 2 niveles de enlaces pueden arrastrar mucho del vault. Emite ~8 `console.log` con emojis por proyecto.
- Refresco: solo al abrir la vista y tras Archivar; sin botón "Refrescar" ni eventos. `onClose` vacío. Un `async render()` llamado sin `await` desde `onOpen`.
- Persistencia: ninguna propia; la acción Archivar modifica el frontmatter de la nota.

---

## 2. Cómo se renderiza, refresca y comporta (resumen técnico)

### 2.1 Estilos de render
| Zona | Técnica |
|---|---|
| Jerárquica / Listas GTD / En Progreso / header | Template strings gigantes en `htmlGenerator.ts` -> `contentEl.innerHTML` en un solo golpe; `<details>/<summary>` nativos para plegado; atributos `data-*` como "modelo" que luego JS relee del DOM (JSON.parse por tarea y por tecla de filtro). |
| Seguimiento / Estadísticas / Cronograma / Review / Smart Inbox / Calendario / Cascada | API de DOM de Obsidian (`createEl`, `createDiv`, `empty`) con listeners por elemento; muchos estilos inline (`el.style.x = ...`) y hover por `mouseenter/leave` en JS en `calendarRenderer`, `cascadeMenuRenderer`. |
| Ajustes | `Setting` de Obsidian; un `innerHTML` para la vista previa de carpetas (con texto del usuario sin escapar). |

Listeners: delegados en `contentEl` para el dashboard (con `AbortController`), por elemento en el resto. Cualquier acción "de estado" (cambiar pestaña, agrupación, orden, toggle vencidas) reconstruye TODA la vista, perdiendo scroll, filtros tecleados, `<details>` abiertos/cerrados y foco.

### 2.2 Rendimiento
- Cada `drawView` = O(archivos) lecturas + regex por línea de todo el vault + construcción de jerarquía + listas, incluso en pestañas que no usan tareas. Además `handleDependencyLinkClick` y `loadAvailableTasks` repiten `parseVault`.
- `main.handleFileChange` (evento `modify`) llama `collectMetadata()` (itera todos los `.md` y sus tags) en **cada** modificación de cualquier archivo, y `rename`/`delete` también.
- Filtros GTD: recorrido completo del DOM por pulsación + 2 `querySelectorAll` por lista/grupo; sin debounce ni virtualización. Con miles de tareas el HTML puede ser de varios MB (las tareas duplicadas en Contexto/Asignadas/Ojalá Hoy/Vencidas multiplican nodos).
- Hierarchy: lectura de archivos por búsqueda de contenido y por `checkInProgressTasks`.
- Estadísticas/Timeline: re-render total, parseos de fecha con moment repetidos.
- Cientos de `console.log` (50 en el módulo, p. ej. por render de lista, por tarea en SmartInbox, por proyecto estancado).

### 2.3 Fugas de memoria / listeners
1. `TimelineView` constructor: `ownerDocument.addEventListener('click')` nunca removido.
2. `StatisticsView.renderStatistics`: listener de clic acumulativo en el mismo contenedor.
3. `TimeTrackerView`: `setInterval` de 1 s activo mientras otra pestaña está visible; instancias de vista retenidas con contenedores desmontados (`timeTrackerView.updatePomodoroDisplay` desde `main` actúa sobre nodos huérfanos).
4. Búsqueda jerárquica: `setTimeout` y ejecuciones asíncronas sin cancelar al redibujar.
5. `resize`/`orientationchange` y `scroll` sí usan `signal` (OK).
6. `SmartInboxView` crea un `div` en `document.body` una sola vez y lo reutiliza; `remove()` solo se invoca en `onunload`. Los managers de menú y calendario guardan referencias cruzadas por `CustomEvent` en el propio contenedor (se limpian con `destroy`). Sin fuga relevante.
7. `GtdView.onClose` no cancela `drawView`s en vuelo; un `drawView` que termine después de cerrar escribe en un `contentEl` ya vaciado (inocuo pero innecesario).

### 2.4 Móvil / responsive
- `styles.css` (140 KB, 6148 líneas, **global del plugin**: contiene también Foco, Backlinks, Actividad, Journal, Weekly). GTD ocupa aprox. líneas 1-2930 y 3136-3900.
- Breakpoints GTD: `max-width: 768px` (principal), `480px`, `650px/500px` (jerárquica), `400/600px` (filtros), `250px` (otros módulos), más `prefers-contrast`, `prefers-reduced-motion`, `prefers-color-scheme: dark` (esto último solo para `.gtd-sticky-header.scrolled`, desalineado con el tema de Obsidian: hay ~33 reglas `.theme-dark` y colores `rgba` fijos).
- ~179 `!important`, solapamiento de overrides del mismo header en 3 sitios (~567, ~3267, ~3828) y duplicación CSS/JS del estado colapsado de filtros (z-index negativo + inline styles).
- Header "pegajoso": ver nota en 1.1 (probablemente no depende de `position:sticky` sino del layout flex, y el efecto `scrolled` es posiblemente muerto).
- Táctil: Smart Inbox/menús/calendarios responden a clic/tap; Cronograma no (DnD y resize solo ratón); modal de tiempo tiene parche específico para el botón de cerrar en móvil.

---

## 3. Smart Inbox: flujo completo de captura

### 3.1 Montaje y ciclo de vida (`smartInboxView.ts`)
- `main.openSmartInbox()` crea la instancia la primera vez (lazy) y llama `open()`. El constructor crea `div.smart-inbox-container` (fixed, pantalla completa, fondo `rgba(0,0,0,.5)`, `padding-top:15vh`, z-index 9999) con `.smart-inbox-input-container > input[type=text]` y `.smart-inbox-suggestions`; lo anexa a `document.body`. Placeholder: "Escribe una tarea... (@ para proyectos, # para tags, ! para fechas)".
- `open()` (si ya abierto, no hace nada): `activeFileAtOpen = workspace.getActiveFile()` (se captura aquí porque el foco pasa al input), lo propaga al `CascadeMenuManager.setActiveFile`, muestra (`display:flex`) y enfoca.
- `close()`: oculta, limpia input/sugerencias/contexto, `activeFileAtOpen=null`, oculta menús y calendario. Cierra con clic en el scrim (`e.target === viewEl`) o Escape (cuando no hay menú/calendario abierto).
- Los managers se instancian en el constructor; `metadata` (proyectos/contextos/personas) se refresca vía `plugin.collectMetadata()` -> `refreshCascadeMenuConfig()` (cada `modify`/`rename`/`delete` del vault).
- Flags `useCascadeMenu` y `useCalendarPicker` (siempre `true`; los `toggle*` públicos no se invocan desde ningún sitio visible).

### 3.2 Cadena de manejo de teclado e input
`handleKeyDown`: 1) `CalendarManager.handleKeyDown` (si el calendario está visible: Esc cierra, Tab cicla Start->Schedule->Due, Enter confirma [fecha elegida o HOY], flechas mueven ±1 día / ±7 días y cambian de mes si hace falta), 2) `CascadeMenuManager.handleKeyDown` (menú visible: ↑↓ con wrap, Enter/Tab seleccionan, Esc cierra el menú, Backspace caso especial), 3) fallback original: lista `.smart-inbox-suggestions` visible (↑↓ Enter/Tab Esc) o, si no, **Enter -> `processInput()`**, Esc -> `close()`.
`handleInput`: calendario -> cascada -> `handleInputOriginal()`.

### 3.3 Sintaxis aceptada

| Token | Cómo se activa | Valor insertado | Lo que `processInput` extrae |
|---|---|---|---|
| Proyecto/Área `@Nombre` | escribir `@` precedido de inicio o espacio (`/(^|\s)@$/`) | `@{basename completo}` (ej. `@PGTD - Dashboard Q3`) | `text.match(/@([^#!]+)/)` -> nombre; busca `vault.getFiles()` (¡todos los tipos!) con `basename.toLowerCase() ===`; el primero que coincida |
| Contexto `#cx-x` | `#` (`/(^|\s)#$/`) -> `cx-` | `#cx-{valor}` | `text.match(/#cx-[\w-]+/g)` |
| Persona `#px-x` | `#` -> `px-` | `#px-{valor}` | `/#px-[\w-]+/g` |
| Estado GTD | `#` -> `gtd-` | `#GTD-AlgunDia` o `#GTD-EstaSemanaNo` | `/#GTD-(AlgunDia|EstaSemanaNo)/gi` |
| Fecha | `!` (`/(^|\s)!$/`) abre calendario | `🛫 YYYY-MM-DD` (Start) / `⏳ YYYY-MM-DD` (Schedule) / `📅 YYYY-MM-DD` (Due, por defecto) | `/🛫\s+(\d{4}-\d{2}-\d{2})/`, `/⏳\s+.../`, `/📅\s+.../` |
| Fecha legacy | `!texto` sin elegir calendario | - | `/!([\w\s-]+)/` -> `parseDate`: `today`, `tomorrow`, `yesterday`, `next <día>`, `<día>` (nombres según el locale global de moment), `YYYY-MM-DD` estricto. Solo si no hay ninguna fecha del sistema nuevo; se registra como **📅 due** |

No hay sintaxis para prioridad, duración, hora, recurrencia, dependencias ni semana.

### 3.4 Inserción y formato final de línea (`processInput` + `appendTaskToFile`)
1. Texto recortado; vacío -> cierra.
2. Se extraen proyecto, tags y fechas; la descripción es el texto original con esos fragmentos eliminados (`replace` de la primera ocurrencia de cada uno, `trim`).
3. Línea generada:
   ```
   - [ ] {descripción} {#cx-... #px-... #GTD-... | #inbox} ➕ {YYYY-MM-DD HH:mm} [🛫 d] [⏳ d] [📅 d]
   ```
   - Los tags van en orden: contextos, personas, estados GTD. **Si no hay ninguno de los tres, añade `#inbox`** (también cuando hay proyecto destino).
   - `➕` lleva fecha **y hora** con espacio (formato `YYYY-MM-DD HH:mm`), distinto del que espera el plugin Tasks (solo fecha); `parser.ts` no lo extrae (`Task.creationDate` se declara en `model.ts` pero nunca se llena), así que el texto "➕ 2025-11-05 14:32" **se ve dentro del contenido de cada tarea en el dashboard**.
   - Fechas en orden Start, Schedule, Due al final.
4. Destino:
   - Si `@Nombre` resuelve a un archivo: ese archivo.
   - Si no: `00 - Inbox/Bandeja de entrada.md` (ruta hard-coded). Si el archivo no existe: `createFolder('00 - Inbox')` (ignora "already exists") y `vault.create(file, '')`.
5. Inserción (`vault.process`, atómica):
   - Archivo recién creado: contenido = `{tarea}\n` (**sin** encabezado).
   - Si existe un `## Tareas` (búsqueda `indexOf('## Tareas')`, también casa con `### Tareas`/`## Tareas pendientes`): inserta al final de esa sección, justo antes del siguiente `## ` (nivel 2 exacto; los `###` se consideran parte de la sección): `before.trimEnd() + '\n' + tarea + '\n\n' + after`.
   - Si no existe el encabezado: añade al final `\n\n## Tareas\n{tarea}\n`. (La primera tarea de un Inbox nuevo queda sobre el encabezado que se crea en la segunda captura.)
6. `Notice("Tarea añadida a [[basename]]")` y `close()`.

### 3.5 Priorización de la nota activa
- `activeFileAtOpen` (nota que estaba activa al abrir el Smart Inbox, solo `.md`) se ofrece como **primera opción** del menú `@` con etiqueta `📝 {basename}` y descripción "Nota actualmente abierta" (`CascadeSuggestionProvider.getProjectMenuOptions`), deduplicada del resto. No requiere `estado: 🟢`, **pero** si el vault no tiene ningún proyecto/área activo (🟢) la función retorna antes con el mensaje "No hay proyectos activos" y la nota activa no se ofrece.
- No se selecciona sola: si el usuario no escribe `@`, la tarea va al Inbox, no a la nota activa. En el fallback original (`handleInputOriginal`) la nota activa también se coloca primera (si coincide con la consulta, o siempre si la consulta es vacía).
- Candidatos (`@`): `plugin.gtdProjectsAndAreas` (`collectMetadata`: archivos `.md` cuyo basename empieza por `PGTD -`, `AV -` o `AI -`) filtrados por frontmatter `estado === '🟢'`, divididos en áreas (`AV -`/`AI -`) y proyectos (`PGTD -`/`PQ -`). **`PQ -` nunca llega porque `collectMetadata` no incluye ese prefijo** (a pesar de lo que dicen los docs). No se generan separadores aunque el renderer los soporta.

### 3.6 Menú en cascada y menú @ unificado
Componentes: `CascadeMenuManager` (estado), `CascadeMenuRenderer` (DOM: `div.cascade-menu-container` hijo del overlay, posición absoluta bajo el input, ajuste a viewport, header por estado, opciones `div.cascade-menu-option` con click/hover), `CascadeSuggestionProvider` (fuentes), tipos en `cascadeMenuTypes.ts` (`MenuState`: NORMAL, MAIN_MENU, CONTEXT_MENU, PERSON_MENU, GTD_MENU, PROJECT_MENU). Comunicación renderer->manager por `CustomEvent('cascade-menu-select')` en el contenedor.

**Niveles:**
- `#` -> MAIN_MENU: opciones `cx-` (Contextos), `px-` (Personas Asignadas), `gtd-` (Estados GTD) (con descripción). Seleccionar una (clic/Enter/Tab) -> `insertPrefixAndContinue`: reemplaza desde el último `#` hasta el cursor por `#cx-`/`#px-`/`#gtd-` y pasa a submenú.
- Submenú CONTEXT/PERSON/GTD: header "Seleccionar Contexto/Persona/Estado GTD". **Fuentes:** contextos y personas = tags del vault (`plugin.gtdContextTags`/`gtdPersonTags`, de `metadataCache.tags` filtrados por `#cx-`/`#px-`) **unidos a listas por defecto codificadas** (`oficina, casa, llamadas, reuniones, urgente` / `juan, maria, carlos, sofia, equipo`); estados GTD = `EstaSemanaNo`, `AlgunDia` fijos. Seleccionar -> `insertFinalTag` -> `#cx-x`/`#px-x`/`#GTD-x`.
- `@` -> PROJECT_MENU: header "📁 Áreas y Proyectos GTD", opciones de 3.5; seleccionar -> `@{basename}`.
- Callback `handleCascadeSelection(tag)` en SmartInbox: busca el último `@` o `#` anterior al cursor (según el tag), reemplaza desde ahí hasta el cursor por `tag + ' '`, coloca el cursor tras el espacio; si no hay trigger, anexa al final.

**Escritura incremental (`INCREMENTAL_TYPING_IMPROVEMENT.md`, `handleInput`):** con submenú activo, lo escrito tras el prefijo filtra en vivo (`filterOptions`: substring en minúsculas sobre `label`, `value` o `description` -> p. ej. "con" coincide con todos los contextos porque la descripción es "Contexto: x"). Si el texto vuelve a ser exactamente el prefijo, se restablecen todas las opciones. En PROJECT_MENU se filtra con el texto tras el último `@` y se regeneran las opciones desde el vault. No hay resaltado de coincidencia ni ordenación por relevancia.

**Puntos débiles detectados (por lectura):**
- *Menú que queda "colgado" y se traga el Enter:* el menú solo se oculta al seleccionar, Esc, o cuando desaparece el último `#`/`@`. Si el usuario teclea manualmente `#cx-casa` y sigue escribiendo la descripción ("... ir al súper"), `handleInput` sigue considerándolo "filtro" (todo lo que viene tras el último `#` o `@` se toma como consulta), las opciones quedan vacías y `handleKeyDown` devuelve `true` para Enter (`handleMenuSelection` sale sin hacer nada): **no se puede enviar con Enter hasta pulsar Esc**. Ocurre también con `@Proyecto` tecleado a mano.
- *Backspace a menú principal:* la condición (`textBeforeCursor.endsWith('#')`) se evalúa en `keydown` antes de borrar; con `#cx-` el texto termina en `-`, por lo que casi nunca se cumple y el submenú queda con las opciones previas.
- *Tags libres imposibles por el menú:* con MAIN_MENU abierto no hay filtrado; escribir `#inbox` + Enter selecciona `cx-` y reemplaza el texto por `#cx-`.
- *Captura del proyecto (`/@([^#!]+)/`):* consume TODO hasta el siguiente `#` o `!`, o hasta el final. `Llamar @PGTD - X #cx-llamadas` funciona; pero `@PGTD - X comprar leche` toma "PGTD - X comprar leche" como nombre -> no existe -> la tarea va al Inbox **y la descripción queda vacía** (se elimina todo el match). Tras elegir una fecha del calendario el `!` desaparece (se sustituye por `📅 fecha`), por lo que `@Proyecto 📅 2025-11-10` también produce un nombre inválido y la tarea cae en el Inbox sin avisar.
- *Regex de tags:* `[\w-]+` excluye acentos/ñ; `#gtd-algundia` en minúsculas se acepta (`/i`) pero se escribe tal cual y el parser, sensible a mayúsculas (`GTD-AlgunDia`), no lo reconocerá.
- *Validación de fechas:* `validateDateCoherence` solo hace `console.warn` (sin UI); Enter con flechas permite elegir fecha pasada para Start/Schedule (el bloqueo es solo para clic).
- Valores por defecto de personas/contextos ("juan", "maria"...) son datos de ejemplo hard-coded.
- Locale: `getWeekdayNames()` fijo `['L','M','M','J','V','S','D']` pero la rejilla usa `startOf('week')` de moment; solo alinea si el locale global es `es` (lo fija `import 'moment/locale/es'` en `statisticsView.ts`/`timeTrackerView.ts` como efecto secundario global); `parseDate` usa `moment.weekdays()` del mismo locale (el legacy "monday" no funcionaría con locale `es`).

### 3.7 Calendario de fechas (`calendarManager/Renderer/DataProvider`)
- Trigger `!` (precedido de inicio o espacio). Contexto: tipo de fecha seleccionado (por defecto Due), fecha seleccionada (null), mes visible.
- UI (`calendar-picker-container`, posicionado bajo el input, 320 px mínimo): selector de tipo (🛫 Start / ⏳ Schedule / 📅 Due), navegación ‹ MMMM YYYY ›, rejilla de días (hoy resaltado, pasados deshabilitados salvo Due, otros meses atenuados y no clicables) y "Accesos rápidos": Hoy, Mañana, Esta Semana (viernes), Próxima Semana (viernes siguiente), Próximo Mes (+1 mes).
- Al seleccionar: texto reemplazado desde el `!` por `{icono} YYYY-MM-DD ` (callback `handleCalendarSelection`).
- El calendario permanece visible mientras exista un `!` antes del cursor (cualquier tecla que no sea las capturadas).
- Estilos inline masivos en el renderer.

---

## 4. Ajustes (`settingsTab.ts`, `DovelaSettingsTab`)

Solo existen ajustes de **Journal** y **Pomodoro**. No hay ajustes para el dashboard GTD, Smart Inbox, ruta del Inbox, prefijos, estados, exclusiones ni exportación. Todo se guarda en `data.json` (`saveData`) a través de `plugin.savePluginData()` en cada `onChange` (cada tecla/tick de slider escribe el archivo). Base: `DEFAULT_SETTINGS` en `model.ts`; `loadPluginData` hace `Object.assign({}, DEFAULT_SETTINGS, loadData())` (fusión superficial: no hereda claves nuevas anidadas, y los objetos por defecto se comparten por referencia; **[verificar]** que con `data.json` sin esas claves, editar un slider muta las constantes `DEFAULT_*` y "Restablecer" no restaura).

### Sección "📋 Configuración Journal" (`data.journalSettings`)
| Ajuste (UI) | Clave | Tipo / control | Default |
|---|---|---|---|
| Carpeta base de Journals | `journalSettings.baseFolderPath` | string (texto; valida existencia con `journalAPI.validateJournalSettings()` en cada cambio, marca `journal-setting-error`) | `"03 - Gestion Personal/AV - Gerente de Vida/AI - Journals"` |
| Crear subcarpeta por año | `journalSettings.yearSubfolder` | boolean (toggle) | `true` |
| Crear subcarpeta por trimestre | `journalSettings.quarterSubfolder` | boolean | `true` |
| Crear subcarpeta por mes | `journalSettings.monthSubfolder` | boolean | `false` |
| Patrón de carpetas para semanas | `journalSettings.weekFolderPattern` | string (variables `{YYYY} {Q} {MM} {WW}`, solo se reemplaza la primera aparición de cada una) | `"{YYYY}/Q{Q}"` |
| Restablecer configuración Journal | - | botón (warning) -> `{...DEFAULT_JOURNAL_SETTINGS}` + `display()` | - |
Más: vista previa "📁 Vista previa de estructura" (`innerHTML`, nombre de nota de ejemplo hard-coded `2025-10-24 viernes.md`).

### Sección "🍅 Configuración Pomodoro" (`data.pomodoroSettings`)
| Ajuste | Clave | Control | Default |
|---|---|---|---|
| Duración de trabajo | `workDuration` | slider 1-60 (paso 1), minutos | 25 |
| Duración descanso corto | `shortBreakDuration` | slider 1-15 | 5 |
| Duración descanso largo | `longBreakDuration` | slider 1-30 | 15 |
| Ciclos antes de descanso largo | `cyclesBeforeLongBreak` | slider 2-8 | 4 |
| Intervalo de alertas en overtime | `overtimeAlertInterval` | slider 1-15 (min) | 5 |
| Auto-iniciar descansos | `autoStartBreaks` | toggle | `false` |
| Auto-iniciar trabajo después del descanso | `autoStartWork` | toggle | `false` |
| Mostrar notificaciones | `notificationsEnabled` | toggle | `true` |
| Reproducir sonido | `soundEnabled` | toggle | `true` |
| Restablecer configuración | - | botón -> `{...DEFAULT_POMODORO_SETTINGS}` | - |
Estadísticas Pomodoro (`data.pomodoroStats`, solo lectura en rejilla): `totalWorkSessions`, `totalWorkMinutes` (h m), `completedCycles`, `todayWorkSessions`, `todayWorkMinutes` (defaults 0). Botón "Resetear estadísticas" con `confirm()` nativo -> `DEFAULT_POMODORO_STATS`.

### Otros datos persistidos en `data.json` (`DovelaPluginData`)
`timeLogs: TimeLogEntry[]` (`id` = `Date.now().toString()`), `activeTimer?` (`taskNotePath, startTime, taskDescription, notes, lineNumber`), `activePomodoroSession?`, `pomodoroSettings`, `pomodoroStats`, `journalSettings`. Sin `localStorage` en GTD. Hay un script de migración de `timelogs.json` (con la parte útil comentada: borra el archivo antiguo sin migrar los logs, "VALIDAR AJBB").

---

## 5. Listado de comandos, ribbon y eventos asociados a esta capa

- Comandos: `open-gtd-dashboard`, `open-gtd-review-panel`, `smart-inbox`, `time-tracker-start-for-active-note`, `pomodoro-start-for-active-note`, `time-tracker-edit-active-timer` (los demás son de Foco/Actividad/Backlinks).
- Ribbon: `plus-circle` (Smart Inbox), `list-checks` (GTD Dashboard), `clipboard-check` (Review), `play-circle` (temporizador), `timer` (Pomodoro).
- Barra de estado: `⏱️ {tarea}... hh:mm:ss` / `🍅`/`☕`/`🔴` (overtime) -> clic abre el Dashboard en Seguimiento (`activateView(true)`).
- Eventos de plugin relevantes: `vault.on('modify'|'rename'|'delete')` -> `collectMetadata`; `modify` de `data.json` -> `syncTimerStateWithFile`; `setInterval` 15 s de sync; `setInterval` 1 s del temporizador (status bar) y 1 s en `TimeTrackerView`.

---

## 6. Features de UI a conservar

Dashboard:
1. Seis vistas con selector de pestaña y botón Refrescar; contador global de tareas abiertas.
2. Listas GTD con las reglas de pertenencia (Vencidas, Inbox, Calendario, Ojalá Hoy + Agenda de Hoy con total de tiempo, Próximas Acciones por contexto, Asignadas por persona, Proyectos, En Pausa, Esta Semana No, Algún Día) y su orden dinámico.
3. Coloreado por `displayStatus` (rojo/verde/azul/naranja), símbolo de prioridad, rango horario `⏰`, enlaces `[[...]]`, enlaces de dependencia `⛔ id 🔗`, breadcrumb plegable por tarea, apertura de la nota en la línea exacta.
4. Filtros por contexto/persona (con `datalist`)/texto + contadores filtrados + navegación rápida (anclas con scroll suave) + conteos por sublista.
5. Toggle Vencidas date-first/context-first.
6. En Progreso: métricas (tiempo definido/estimado/vencidas), agrupación (ninguno/contexto/persona/proyecto), orden cíclico.
7. Jerárquica: árbol con contadores propios/totales, placeholders `[FALTA]`, resaltado de nodos con tareas en progreso, búsqueda por título y por contenido con resumen, expandir/colapsar todo.
8. Seguimiento: cronómetro, Pomodoro, selector de tarea con 3 fuentes y búsqueda, alta manual, ir a la tarea.
9. Estadísticas: árbol de tiempo por carpeta/nota con %, periodos (día/semana/mes/año/siempre/rango/día suelto), navegación ‹ ›, heatmap, salto inteligente, editar log desde la lista, exportación del nodo (a CSV/Excel).
10. Cronograma: día/3 días/semana, zoom, popover de calendario con actividad, bloques con solapamiento, drag para mover/copiar (Alt), redimensionar, crear arrastrando, multidía, color por carpeta raíz, tooltip.
11. Review Panel: detección de proyectos 🟢 sin tareas abiertas, +Añadir Tarea / Archivar (🔵) / Abrir carpeta (escritorio).
12. Smart Inbox: overlay de captura con `@` proyectos activos (con nota activa primero), `#` cascada cx/px/gtd con filtrado incremental, `!` calendario con tipos Start/Schedule/Due y accesos rápidos, fecha legacy `!hoy`..., destino Inbox por defecto, inserción en `## Tareas`, sello `➕` de creación, `#inbox` automático.
13. Ajustes de Journal y Pomodoro con vista previa y botones de reset.
14. Comandos/ribbon/status bar listados en 5.

## 7. Oportunidades de simplificación / mejora

**Arquitectura de render**
- Sustituir strings gigantes + `innerHTML` por componentes reutilizables con DOM API (`createEl`) o un micro-renderer (funciones `TaskRow`, `GroupHeader`, `Card`, `StatBlock`, `Toolbar`, `ButtonGroup`, `FilterInput`). Resuelve de golpe: escape de HTML (XSS/atributos rotos), `data-*` como modelo (`JSON.parse` en cada tecla) y duplicación `renderTask`/`renderInProgressTask`.
- Mantener un modelo en memoria (tareas filtradas) y filtrar sobre datos, no sobre el DOM; aplicar `hidden` por clase, con `requestAnimationFrame`/debounce de 100-150 ms.
- Un único cargador de datos cacheado (`TaskIndex`) invalidado por `metadataCache.on('changed'|'deleted'|'resolved')` con debounce, usado por Dashboard, Seguimiento (`loadAvailableTasks`), dependencias, Review y Foco; no volver a `parseVault` completo por pestaña/clic. Parsear solo la pestaña activa.
- Refresco reactivo: `registerEvent` + debounce para redibujar solo si cambia algo relevante; preservar scroll, filtros y `<details>` abiertos (render incremental o guardar/restaurar estado).
- Reemplazar `checkInProgressTasks` (N lecturas) por el dato ya parseado (`status==='in-progress'` por archivo).
- Eliminar `collectMetadata` en cada `modify` (usar `metadataCache.on('changed')` filtrando por prefijos/tags o recalcular bajo demanda al abrir Smart Inbox).

**Virtualización/listas largas**
- Listas GTD (miles de filas duplicadas), Jerárquica y árbol de Estadísticas: render perezoso de `<details>` (generar hijos al abrir), o ventana virtual para listas planas; evitar duplicar la misma tarea en 4 listas en el DOM (compartir nodo o render colapsado por defecto).
- Timeline: indexar logs por día una vez por render; usar tiempos numéricos en vez de `moment()` repetido; `ResizeObserver` en lugar de recalcular `getBoundingClientRect`.

**Fugas y robustez**
- `registerDomEvent` / `AbortController` en `TimelineView`, `StatisticsView` y `TimeTrackerView` (y `registerInterval` para el cronómetro); `onunload/onClose` coherentes; limpiar el intervalo al cambiar de pestaña.
- Guarda de reentrada en `drawView` (token de render) y cancelación de búsqueda asíncrona.

**Smart Inbox**
- Reescribir el parser: tokenizar `@proyecto` por coincidencia con nombres conocidos (longest-match) o delimitar con un cierre (`@[[Proyecto]]`/comillas); fijar el bug de la descripción vacía; aceptar `PQ -` y archivos de cualquier tipo solo `.md`; resolver duplicados de basename.
- Un único modelo de "token" con triggers configurables (`@ # !`) y un solo componente de menú (lista + header + filtro) que sirva a cascada, `@`, fechas legacy y sugerencias originales; eliminar el sistema original de sugerencias (`.smart-inbox-suggestions`, `handleInputOriginal`, ~110 líneas) o dejarlo como única vía.
- Cerrar el menú cuando el token está completo o se escribe espacio; Enter debe enviar si no hay opciones; permitir tags libres.
- Mover constantes a ajustes: ruta del Inbox, encabezado `## Tareas`, prefijos de proyectos, estado activo (`🟢`), listas por defecto (quitar nombres de ejemplo), formato de `➕` (solo fecha para compatibilidad con Tasks).
- CSS en lugar de `style.*` inline y `mouseenter/leave` para hover; clases `is-selected`.
- Usar `Modal`/`SuggestModal`/`EditorSuggest` nativo de Obsidian para foco, scrim, Esc, accesibilidad y móvil, o conservar el overlay pero reutilizando `Scope` para atajos.

**Estadísticas y exportación**
- CSV (ver 1.6) y quitar `xlsx`/`@types/xlsx`; aprovechar para exportar a archivo del vault en móvil. Compartir `exportRows(logs)` entre CSV y futuro Markdown.
- Escuchas delegadas únicas y re-render solo de la parte cambiada (cabecera de periodo vs árbol).

**Cronograma**
- Añadir snapping (5/15 min) en drop/crear/resize, soporte táctil (Pointer Events en lugar de HTML5 DnD y `mouse*`), línea de "ahora" y scroll inicial, refresco al cambiar `timeLogs` (evento propio del plugin).

**CSS**
- Partir `styles.css` por módulo/vista (build con concatenación), eliminar `!important` y duplicados de overrides del header, unificar claro/oscuro usando solo variables de Obsidian (no `prefers-color-scheme`), reducir breakpoints a 1-2 (`768`, `480`), tokens de espaciado/color, un solo sistema de "botón de pestaña" y "grupo de botones" (`gtd-view-button`, `gtd-grouping-button`, `hierarchy-toggle`, `timeline-view-selector`, `source-selector` son el mismo patrón).
- Usar `Platform.isMobile` y `container.clientWidth` (ResizeObserver) en vez de `window.innerWidth`.

**Código duplicado a unificar**
- Parseo de duración/hora: `parseDurationToMinutes`/`convertTo24Hour`/`addMinutesToTime` (`htmlGenerator.ts`) vs `parseDuration` (`inProgressProcessor.ts`) vs `parseTimeToMinutes` (`parser.ts`) vs `formatDuration` (`durationUtils.ts`).
- Calendarios mensuales: `CalendarRenderer` (smart inbox), popover de `TimelineView` y `DatePickerModal` -> un componente `MonthGrid`.
- Apertura de nota en línea (`openLinkText(..., {eState:{line}})`) repetida en `view.ts`, `timeTrackerView.ts`, etc. -> helper.
- `updateFilterState` definido dos veces en `view.ts`; `createAnchorId` triplicado (`htmlGenerator.ts` x2, `gtdProcessor.ts`).
- Lógica de modales de selección de tarea idéntica en `TimeTrackerView` y `TimeLogModal`.

**Ruido**
- Quitar ~50 `console.log` de depuración del módulo (usar un logger con nivel).
