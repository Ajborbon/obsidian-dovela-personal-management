# D - Ingeniería inversa: módulos FOCO y BACKLINKS

Repo: `/home/user/obsidian-dovela-personal-management` (rama `main`, commit `378e5af`, plugin v1.0.0).
Alcance leído completo: `src/modules/moduloFoco/*.ts` (9 archivos, 4 544 líneas), `src/modules/moduloBacklinks/*.ts` (5 archivos, 1 472 líneas), `Documentacion/Implementacion-Breadcrumbs.md`, `Documentacion/Resumen-Refactor-Vista-Jerarquica.md`, las bitácoras Btx de 2026-07-06 y el PGTD de la retoma. Para comparar duplicación también se leyeron/difirieron `moduloGTDv3/{model,parser,gtdProcessor,hierarchyBuilder,htmlGenerator,view,dateUtils}.ts` y los puntos de integración en `src/main.ts`.

Convención: `archivo:línea` o `archivo::función`. Todo lo marcado "(no verificado en runtime)" sale de leer el código y de la semántica de la API de Obsidian, no de ejecutar el plugin.

---

## 0. Resumen ejecutivo

| Tema | Hallazgo |
|---|---|
| Foco | Es una **copia fork de la vista GTD** (`moduloGTDv3`) alimentada por un conjunto de notas calculado a partir de **una nota fija** (no sigue la nota activa). ~64 % del código de Foco (~2 900 de 4 544 líneas) es copia casi literal de GTDv3. El código realmente propio son ~1 650 líneas: expansión de enlaces (`focoParser.ts`), settings + modal, cabecera colapsable, estadísticas y badges de origen. |
| Expansión | BFS en dos pasadas independientes (salientes, luego entrantes) a partir de **todas las notas de la carpeta de la nota activa (recursivo)**. Dedupe global por `processedPaths`; los ciclos son inocuos. Profundidad por defecto 2 salientes / 5 entrantes. Las "carpetas/notas de terminación" se incluyen pero no se expanden desde nivel >1. |
| Rendimiento Foco | Cada clic (cambiar pestaña, agrupar, ordenar, toggle vencidas, refrescar, clic en dependencia) vuelve a ejecutar `parseFocus` completo. La expansión entrante es O(|base| × |vault| × enlaces) con `getFirstLinkpathDest` por enlace, y hay `console.log` por archivo. Una capa de índice con enlaces invertidos lo reduciría a O(enlaces del subgrafo). |
| Backlinks | Vista lateral (`dovela-backlinks-view`) que **sí sigue la nota activa**. "Backlink" = nota en la **misma carpeta** (solo la carpeta directa) **o** nota con un `[[enlace]]` al archivo activo. Lista plana o árbol de carpetas (cuando se ordena por "Ruta"), visor de pestañas abiertas, breadcrumb de carpeta con 3 estilos. **No tiene búsqueda**: la "búsqueda jerárquica" del commit `0dd4bbe` está en las vistas jerárquicas de GTD y Foco. |
| Bug julio 2026 | Recursión mutua `createBreadcrumb -> createCompactBreadcrumb -> createPathBreadcrumbs -> createBreadcrumb`. Corregido en `ef3b3e1` haciendo que `createPathBreadcrumbs` delegue a `createFullBreadcrumb`. Estilos `compact` y `smart` (cuando ruta > máx.) con ≤2 segmentos o ruta corta provocaban `Maximum call stack size exceeded` al restaurar la vista en el arranque. |
| Campos | Ninguno de los dos módulos lee `origen::` / `origen:`. Foco lee frontmatter `type` y `estado`; Backlinks lee `type`, `estado`, `moneda`, `monto`. Ambos usan `cache.links` (solo cuerpo, no `frontmatterLinks`), así que **una nota hija enlazada solo por `origen:` no cuenta como backlink ni como enlace entrante de Foco**. |
| Hallazgos críticos | (1) `renderBacklinksList` retorna antes de poder mostrar pestañas/árbol si no hay backlinks. (2) `formatMoney` construye `Intl.NumberFormat` fuera del `try`: una `moneda` con código inválido rompe todo el render. (3) `parseTasks` de Foco es un fork **desactualizado** (sin `additionalDates`, regex `week` vieja). (4) `noteOriginMap` es global de módulo: dos vistas Foco se pisan los badges. (5) Vista Foco no persiste (sin `getState/setState`): tras reiniciar Obsidian queda con el mensaje de error. (6) `data-content="${task.content.replace(/"/g, '"')}"` es un no-op (rompe el atributo si la tarea tiene comillas). Detalle en sección 7. |

---

## 1. FOCO

### 1.1 Qué es exactamente

Es la **vista GTD (listas + jerarquía + en progreso + tracker + estadísticas + cronograma) restringida a un subconjunto de notas** determinado por una nota ancla. Se abre con:

- Comando `open-focus-view` "Dovela: Mostrar Vista de Foco del Proyecto" (`main.ts:137`, `checkCallback` exige nota activa).
- Ribbon `crosshair` "Abrir Vista de Foco" (`main.ts:205`).
- Ambos llaman `main.ts::activateFocoView(activeFile)` (`main.ts:319`).

Flujo de activación (`main.ts:319-356`):
1. Busca una hoja Foco existente con `getDisplayText().includes(activeFile.basename)` (comparación por **subcadena**: el basename `"A"` coincide con `"Vista de Foco: Alpha"`; ver bugs).
2. Si no existe, `getLeaf('tab')`, `setViewState({type: FOCO_VIEW_TYPE, state:{activeFile: path}})`, asigna por corchetes el campo privado `(leaf.view as FocoView)['activeFile'] = activeFile` y llama a mano `onOpen()` (que ya se había ejecutado una vez con `activeFile = null`, mostrando el mensaje "No se ha proporcionado un archivo activo...").
3. `registerView` crea siempre `new FocoView(leaf, this, null)` (`main.ts:109-110`). `FocoView` **no implementa `getState/setState`**, así que el `state` pasado se ignora y, tras reiniciar Obsidian, las pestañas Foco restauradas muestran el error y no se recuperan.

Cada nota ancla tiene su propia hoja. **No hay seguimiento de la nota activa**: el ancla se fija al abrir; solo cambia si el usuario ejecuta el comando desde otra nota (abre otra hoja). Título de pestaña: `Vista de Foco: <basename>` (`focoView.ts:51`).

### 1.2 Diferencias con GTD (moduloGTDv3)

| Aspecto | GTD (`GtdView`, `parseVault`) | Foco (`FocoView`, `parseFocus`) |
|---|---|---|
| Universo de notas | `vault.getMarkdownFiles()` menos exclusiones (`EXCLUDED_FOLDERS` Plantillas SGP Dovela y cualquier ruta con segmento `99 - Adjuntos`, `moduloGTDv3/parser.ts:5-13,41`) | Carpeta de la nota activa **recursiva** + enlaces salientes (N niveles) + entrantes (M niveles). **Sin exclusiones** (plantillas y adjuntos entran si están enlazados o en la carpeta). |
| Resolución de dependencias `⛔` | `allTaskMap` de todo el vault | `allTaskMap` solo del subconjunto: una dependencia fuera del foco **no se encuentra y se trata como resuelta** (`hasUnresolvedDependencies` devuelve false si `depTask` no existe), a diferencia de GTD. |
| Cabecera | Controles de vista + total | Añade botón "⚙️ Configurar", título de foco colapsable (`#focus-view-title`), estadísticas de expansión (`.foco-expansion-stats`). |
| Jerarquía | Todo el vault | Solo las notas del foco, pero `buildHierarchy` genera igual la cadena de carpetas ancestrales hasta la raíz del vault: las ancestras que no están en el foco aparecen como placeholders `[FALTA] <carpeta>`. Cada nota lleva badge de origen (📁 ➡️ ⬅️ 🛑). |
| Settings | `data.json` del plugin | `localStorage` (ver 1.6) |
| Parser de tareas | `moduloGTDv3/parser.ts::parseTasks` (actual: `additionalDates`, regex `week` nueva) | `focoParser.ts::parseTasks` (fork antiguo; ver 1.3) |
| Clases CSS en listas | `gtd-list gtd-list-hope-today/next-actions/assigned/overdue` | Solo `gtd-list` (el generador de Foco no añade las clases extra: cualquier CSS que dependa de ellas no aplica en Foco). |
| Persistencia de la vista | Registrada, sin estado | Ancla en campo privado, sin estado de vista |
| Refresco | Manual / al abrir | Manual / al abrir (ver 1.8) |
| Reutilizado de GTDv3 sin copiar | — | `TimeTrackerService`, `TimeTrackerView`, `StatisticsView`, `TimelineView`, `processInProgressTasks` (Foco los importa de `../moduloGTDv3/`). Acoplamiento inverso: `moduloGTDv3/stalledProjectService.ts:3` importa `parseTasks` de `moduloFoco/focoParser.js`. |

### 1.3 Duplicación respecto a moduloGTDv3 (qué unificar)

Medición hecha con `diff` de ficheros y `comm` de líneas únicas:

| Archivo Foco | Contra | Duplicado | Naturaleza de las diferencias | Acción de unificación |
|---|---|---|---|---|
| `focoDateUtils.ts` (54) | `dateUtils.ts` | **100 %** (diff = 0 líneas) | ninguna | Borrar; importar el compartido. |
| `focoHierarchyBuilder.ts` (157) | `hierarchyBuilder.ts` | **~99 %** (solo cambia el `import` del modelo) | ninguna | Borrar; importar el compartido. |
| `focoModel.ts` (152) | `model.ts` (232) | **~96 %**: `Task`, `HierarchicalItem`, `HierarchicalItemType`, `NavigationItem`, `ProcessedVaultData`, `InProgressData`, `TimeLogEntry`, `ActiveTimerState` idénticos | Foco omite Pomodoro/Journal settings y su `DovelaPluginData` es distinto (`schemaVersion`, `interruptedTimer`; GTD tiene `activeTimer`, pomodoro, journal). **`focoModel.DEFAULT_SETTINGS`/`DovelaPluginData` son código muerto/divergente.** | Un único `model.ts` de tipos de dominio. |
| `focoProcessor.ts` (647) | `gtdProcessor.ts` (720) | **~94 %**: `processGtdLists`, `hasUnresolvedDependencies`, `getRegularTaskDisplayStatus`, `getDependentTaskDisplayStatus`, `addTaskToOverdueWithGrouping`, `sortCalendarTasks`, `sortHopeTodayTasksByTime`, `generateNavigationItems`, `getListIcon` son idénticos salvo comentarios y prefijos de `console.log` ("(Foco)"). Única diferencia funcional: GTD limpia `displayLabel` (quita `cx-/px-`) al crear sublistas de navegación y tiene `getSublistIcon` más tolerante (`px:`); Foco limpia la etiqueta después en `generateQuickNavHtml`. Resultado visual igual. | Unificar en una sola función pura `processGtdLists(tasks, allTaskMap, mode)`. Es el mejor candidato a extraer a una capa de dominio testeable. |
| `focoHtmlGenerator.ts` (981) | `htmlGenerator.ts` (887) | **~87 %**: `renderTask`, `renderInProgressTask`, `renderInProgressView`, `renderOverdueGroupedTasks`, `renderGtdListsView`, `calculateEndTime/convertTo24Hour/addMinutesToTime/calculateAgendaTotalTime`, `generateFiltersHtml`, `generateQuickNavHtml`, `renderHierarchyViewRecursive`. Foco añade: `generateOriginIndicator` (badges), `generateExpansionStatsHtml`, bloque de cabecera foco, botón Configurar, 3 `console.log` por nodo. Foco usa `(task as any).displayStatus` donde GTD usa `task.displayStatus`. GTD añade clases `gtd-list-*`. | Un generador con opciones (`focusFileName?`, `renderBadge?`, `headerExtras?`). |
| `focoView.ts` (1 221) | `view.ts` (1 029) | **~78 % de las líneas únicas**: `createTaskBreadcrumbMap`, `handleDependencyLinkClick`, `addEventListeners` (filtros, búsqueda jerárquica, delegación de clics), `initializeMobileFiltersOptimization` (~300 líneas), `toggleOverdueGroupingMode`, `checkInProgressTasks`. Foco-propio: ancla `activeFile`, `FocoSettingsModal`, `expansionStats`, `toggleFocusHeaderCollapse`/`initializeFocusHeaderState`, `updateOverdueToggleButton`, listeners de stats/título (~280 líneas). Las `applyFilters` de Foco son más defensivas (try/catch en `JSON.parse` de datasets). | Clase base `BaseGtdView` con método abstracto `loadData(): Promise<ProcessedVaultData>`; `FocoView` solo aporta ancla, cabecera y settings. |
| `focoParser.ts` (519) | `parser.ts` (279) | `parseTasks`, `determineItemType`, `parseTimeToMinutes`, `PREFIX_TO_TYPE_MAP`, `FRONTMATTER_TYPE_MAP` son copias (**con divergencias, ver abajo**); `collectFocusFiles`/`expand*`/`parseFocus` son propios. | Un `parseTasks` único en la capa de datos. |

**Divergencias entre las copias que hay que resolver (no son idénticas) al unificar:**

1. **`additionalDates`**: GTD (`parser.ts:142-160,232`) recoge todas las fechas 🛫⏳📅 y deja en `task.additionalDates` las posteriores a la primera. Foco (`focoParser.ts:97-105`) solo la primera. Consecuencia: en Foco el estado visual (`overdue/today/paused-start`), Hope Today y Overdue solo miran la fecha primaria. Una tarea `🛫 2026-01-01 📅 2026-02-01` (start pasado, due vencido) no es "vencida" en Foco pero sí en GTD. La rama de Foco de validación de start>due usa el fallback por regex sobre `task.content` (que sigue conteniendo las fechas secundarias), por eso sí detecta la configuración inválida.
2. **`week`**: GTD `/\s*\[(?:w|W)\s*::\s*\[\[(?:.*?\|)?(\d{4}-W\d+)\]\]\s*\]/` → devuelve `"2025-W43"` **sin corchetes**. Foco `/ \[w::\s*(\[\[\d{4}-W\d{2}\]\])\]/` → devuelve `"[[2025-W43]]"` con corchetes. `isWeekPast/Today/Future` (idénticas en ambos módulos) hacen `match(/\[\[(\d{4})-W(\d{2})\]\]/)`, por lo que **funcionan con el formato Foco y devuelven siempre `false` con el formato GTD** (hallazgo colateral: en GTD las tareas `[w::]` nunca se pausan ni van al Inbox por semana; no verificado en runtime). Al unificar, decidir un formato único (recomendado: devolver `"YYYY-Www"` normalizado y que `isWeek*` acepte ambos).
3. **Exclusiones**: GTD excluye plantillas y `99 - Adjuntos`; Foco no.
4. **Task id**: ambos usan `crypto.randomUUID()` si la tarea no tiene `^id`/`🆔id`: los ids **no son estables entre parseos**.
5. **Clases `gtd-list-*`** solo en GTD.

Nota: `import moment from 'moment'` (focoProcessor/focoDateUtils) empaqueta moment en `main.js`; Obsidian exporta `moment` desde `'obsidian'`.

### 1.4 Algoritmo de expansión bidireccional de enlaces

Archivo: `focoParser.ts`. Entrada: `activeFile`, `vault`, `metadataCache`. Settings: `FocoSettingsManager.load()` (localStorage) en cada llamada, **sin `validate()`** (solo se valida al guardar en el modal).

`collectFocusFiles` (línea 184):

1. **Ancla**: `focusFiles = {activeFile}`, `processedPaths = {activeFile.path}`, origen `folder-base`, nivel 0.
2. **Grupo base** (`folderBaseGroup`): todos los `.md` de `activeFile.parent` y de **todas sus subcarpetas** (recorrido recursivo de `TFolder.children`, línea 226). Origen `folder-base`, nivel 0. Si la nota activa está en la raíz del vault, `parent` es la raíz y **el foco incluye todo el vault**. `stats.folderBaseNotes` cuenta los archivos de la carpeta **excluyendo** al ancla (se añade antes a `processedPaths`).
3. **Salientes** (`expandOutgoingLinksFromGroup`, línea 277), si `outgoingLinksLevels > 0`:
   - `currentLevel` = copia de `folderBaseGroup`.
   - Para `level = 1..outgoingLinksLevels`: para cada `file` de `currentLevel`:
     - si `isTerminationFile(file)` **y `level > 1`** → se omite (no se expande desde él). En nivel 1 las fuentes son la carpeta base, así que **nunca se omiten**, aunque la carpeta base esté dentro de una carpeta de terminación (p. ej. el ancla es un Journal).
     - `cache = metadataCache.getCache(file.path)`; recorre `cache.links` (solo enlaces del cuerpo; no `embeds`, no `frontmatterLinks`); resuelve con `metadataCache.getFirstLinkpathDest(link.link, file.path)`; acepta si es `TFile` con extensión `md` y **no está en `processedPaths`**.
     - Lo añade a `nextLevel`, `targetGroup (outgoingGroup)`, `focusFiles`, `processedPaths`; origen `outgoing-link` (o `termination-folder` si el destino cae en una carpeta/nota de terminación) con `level`.
   - `currentLevel = nextLevel`; si queda vacío → `break`. `stats.maxOutgoingLevel = level` solo si el nivel produjo notas.
4. **Entrantes** (`expandIncomingLinksFromGroup`, línea 340), si `incomingLinksLevels > 0`:
   - `allFiles = vault.getMarkdownFiles()`; `currentTargets` = copia de `folderBaseGroup`.
   - Para `level = 1..incomingLinksLevels`: para cada `targetFile` de `currentTargets` (omitido si es de terminación y `level > 1`): recorre **todo el vault**; salta archivos ya en `processedPaths`; para cada `link` de la fuente, `getFirstLinkpathDest(link.link, sourceFile.path) === targetFile` → añade `sourceFile` (origen `incoming-link` o `termination-folder`), `break` al primer enlace coincidente.
   - `currentTargets = nextLevel` (solo lo hallado en este nivel); corta si queda vacío.
5. `stats.totalNotes = focusFiles.size`; `processingTimeMs` mide **solo** esta fase (no la lectura/parseo/render).

**Propiedades del algoritmo:**

- **Profundidad**: salientes por defecto 2, entrantes 5; `validate()` limita 0..10 pero el slider del modal 0..8; `load()` no valida, así que un JSON manipulado puede superar esos límites.
- **Ciclos**: `processedPaths` es global a ambas pasadas → cada archivo entra una sola vez; A→B→A no itera. No hay riesgo de bucle infinito. Un efecto lateral: **prioridad de clasificación**: si una nota es alcanzable por salientes y por entrantes, queda como `outgoing-link` (salientes se ejecuta primero) y la pasada entrante la ignora (y no la usa como destino de nivel siguiente porque `currentTargets` solo contiene lo que *esa pasada* añadió).
- **No hay mezcla de direcciones**: desde un nodo hallado por entrantes no se siguen sus salientes y viceversa (`outgoingGroup`/`incomingGroup` se rellenan pero **nunca se usan como fuente**). Solo la carpeta base alimenta ambas direcciones.
- **Terminación**: la nota de terminación **se incluye** pero no se expande desde nivel ≥2 (salientes: no se siguen sus enlaces; entrantes: no se buscan notas que la enlacen). Se compara `file.path.startsWith(folder + '/') || file.path === folder` y, para notas, `file.basename + '.md' === note || file.name === note` (solo por nombre de archivo, no por ruta). El tipo `termination-note` existe pero **nunca se asigna** (todas se marcan `termination-folder`). Default: la carpeta `03 - Gestion Personal/AV - Gerente de Vida/AI - Journals` (evita que los diarios, que enlazan todo, conviertan el foco en el vault entero).
- **Tipos de enlace considerados**: `cache.links` únicamente. Los enlaces en frontmatter (`origen: "[[...]]"`) están en `cache.frontmatterLinks` y **no cuentan**; los embeds (`![[...]]`) tampoco. Enlaces con `#encabezado`/`^bloque`: `link.link` incluye el subpath; `getFirstLinkpathDest` espera un linkpath sin subpath (la práctica habitual es pasar por `getLinkpath()`), por lo que probablemente no resuelven (no verificado en runtime).
- **Complejidad**: salientes O(enlaces de las notas visitadas). Entrantes O(niveles × |targets| × |vault| × enlaces/nota) llamadas a `getFirstLinkpathDest`; en el nivel 1, |targets| = tamaño de la carpeta base. Ejemplo: carpeta de 200 notas, vault de 5 000, 20 enlaces/nota ⇒ hasta ~20 M resoluciones en el nivel 1 (atenuado porque las fuentes ya procesadas se saltan y se hace `break` al primer acierto, pero sigue siendo el punto caliente del módulo).
- **Estado global**: `noteOriginMap` (línea 164) es un `Map` de módulo; `parseFocus` lo vacía y rellena (`noteOriginMap.clear(); originMap.forEach(...)`, línea 434). `generateOriginIndicator` lo lee en el render. Con dos vistas Foco abiertas, los badges de una reflejan el último parseo de la otra.

`parseFocus` (línea 417) tras `collectFocusFiles`: por cada archivo, `vault.adapter.exists(file.path)` (acceso a disco innecesario), `vault.cachedRead`, `determineItemType`, `parseTasks`, y arma un `HierarchicalItem` plano (con `frontmatter` completo, incluida la clave `position`). Los errores por archivo se capturan y se continúa. `allTasks = allTasks.concat(tasks)` por archivo (O(n²) en copias; poco relevante a esta escala).

### 1.5 Jerarquía y colapso

- `focoHierarchyBuilder.ts::buildHierarchy` (idéntico a GTD): mapa nota-por-ruta-sin-ext; carpetas inferidas de las rutas; **modelo de fusión** (nota `Carpeta/Carpeta.md` = nodo de la carpeta; si no existe, placeholder `[FALTA] Carpeta` con `isNoteMissing`); enlaza por ruta padre; raíz virtual `Vault` (`type: 'Root'`); orden: nivel 0 por nombre (`localeCompare`), niveles inferiores por `TYPE_ORDER` (GrupoAV 1 … Y 22), luego `estado` (`localeCompare`, solo si ambos lo tienen y difieren), luego `ctime` descendente, luego nombre. `calculateTaskCountsRecursive` suma tareas propias abiertas de la descendencia.
  - Caso borde detectado: si existen `A/X.md` y una subcarpeta `A/X/` **sin** `A/X/X.md`, el placeholder de carpeta ocupa la clave `A/X` y la nota `A/X.md` se descarta del árbol (`hierarchyMap.has(path)` en el paso 3). Sus tareas siguen en las listas GTD pero faltan en la jerarquía y en el mapa de breadcrumbs.
  - Tipos de nota: `determineItemType` mira primero `frontmatter.type` solo si ∈ {GrupoAV, Dly, Wk, M, Q, H, Y}; si no, prefijo del nombre de archivo (`AV `, `AI `, `PGTD `, `PQ `, `RR `, `Tx `, `Vx `, `Reu `, `Rf `, `Sue `, `Cp `, `EMkt `, `RT `, `RL `, `Ax `); si no, `Ax`. **El vocabulario difiere del vault real** (`referencia-vault.md`: `Wly`, `Ref`, `Cmt`, `Btx`… no están mapeados; caen en `Ax`).
- **Estado de apertura** (`focoHtmlGenerator.ts::renderHierarchyViewRecursive`): hoja → `div.gtd-card-leaf`; con hijos → `<details open>` si `level < 2`. Botones "Expandir Todo"/"Colapsar Todo" ponen `open` en todos los `.gtd-card-container` (`focoView.ts:690-699`). Esto supera lo que describe `Resumen-Refactor-Vista-Jerarquica.md` (fechado **2025-07-06**, fases 3 y 4 pendientes entonces: CSS y listeners): el documento está desactualizado, las fases ya están implementadas.
- **Marca ⚡** de tareas en progreso: tras renderizar, `setTimeout(checkInProgressTasks, 100)` relee **cada** `.check-in-progress[data-check-path]` con `vault.read` y comprueba `/^- \[\/\]/m` (solo tareas `[/]` sin indentación) para añadir `has-in-progress-tasks`.
- **Búsqueda jerárquica** (`focoView.ts:477-654`, commit `0dd4bbe`): input `#hierarchy-search-filter` + toggle "Incluir contenido". Atributos `data-search-name/type/has-own/has-desc/total/level` generados en el HTML. Título: `itemName.includes(term)`. Contenido (si el toggle está activo): lee el archivo con `vault.read` **secuencialmente** (`await` en bucle), cachea el texto en minúsculas en un `Map` local (se pierde en cada redibujado), debounce 300 ms solo con contenido. Oculta con `display:none`/`visibility:hidden` los no coincidentes y reabre `<details>` ancestros de las coincidencias. Resumen "N: 📄 t 📝 c". Backlinks no tiene búsqueda.

### 1.6 Colapso de encabezado

- Elemento `#focus-view-title` (🎯 "Foco: <basename>") sobre `#focus-collapsible-content` (total de tareas, stats de expansión, filtros, navegación rápida) (`focoHtmlGenerator.ts::generateGtdViewHtml`).
- Hay **dos mecanismos solapados** que se disparan con el mismo clic:
  1. Listener directo (`focoView.ts:274-278`): alterna la clase CSS `collapsed` del título.
  2. Listener delegado (`:787-796`) → `toggleFocusHeaderCollapse()` (`:802`): muestra/oculta `#focus-collapsible-content` (`display:none`), cambia el indicador a "👆 Click para colapsar"/"👇 Click para expandir" y guarda en `localStorage['dovela-focus-header-collapsed'] = 'true'|'false'` (**clave global, compartida por todas las vistas Foco**).
  3. El scroll (`:255-269`) añade/quita `collapsed` en `#gtd-sticky-header`, `#gtd-total-tasks` y `#focus-view-title` al pasar de 50 px (efecto compacto, no persiste).
- `initializeFocusHeaderState()` (`:823`) re-aplica el estado persistido tras cada `drawView`.
- Las estadísticas (`.foco-expansion-stats`) alternan resumen/detalle con clic (`:760-784`).

### 1.7 Settings propios

Almacenamiento: `localStorage` del navegador/Electron (no `data.json`, no se sincroniza entre dispositivos ni entre vaults), sin `try/catch` en la creación del valor por defecto pero con `try/catch` en `save/load/reset`.

| Clave de almacenamiento | Tipo | Default | Uso |
|---|---|---|---|
| `dovela-foco-expansion-settings` (JSON de `FocoExpansionSettings`) | objeto | ver abajo | Mezclado con defaults al cargar (`Object.assign`). |
| `.outgoingLinksLevels` | number | `2` | Niveles salientes (0 = desactivado). |
| `.incomingLinksLevels` | number | `5` | Niveles entrantes (0 = desactivado). |
| `.terminationFolders` | string[] | `["03 - Gestion Personal/AV - Gerente de Vida/AI - Journals"]` | Carpetas "tope". |
| `.terminationNotes` | string[] | `[]` | Notas "tope" (se guardan con `.md`). |
| `.showOriginIndicators` | boolean | `true` | Badges 📁➡️⬅️🛑. |
| `.enableNetworkVisualization` | boolean | `false` | **Sin implementación** (solo toggle en el modal; no hay consumidor en el código). |
| `dovela-focus-header-collapsed` | `'true'`/`'false'` | ausente | Estado del encabezado colapsable. |

`FocoSettingsManager` (estático): `save/load/reset/validate`. `validate` acota niveles a 0..10 y repara arrays no válidos. `FocoSettingsModal` (`focoSettingsModal.ts`, 710 líneas): sliders 0..8, listas editables de carpetas/notas con autocompletado propio (`allFolders`/`allFiles` calculados en el constructor a partir de `getMarkdownFiles()` y `getAllLoadedFiles()`), toggles, vista previa, botones Guardar/Restablecer; inyecta un `<style id="foco-settings-modal-styles">` en `document.head` (nunca se retira). El callback `onSave` redibuja la vista (`drawView`). El modal usa `innerHTML` con la consulta del usuario sin escapar en las sugerencias (`<mark>` con texto de rutas del propio vault).

### 1.8 Cómo sigue la nota activa, eventos y refresco

- **No sigue la nota activa.** El ancla es `FocoView.activeFile`, fijado en la activación.
- **Eventos de Obsidian registrados por Foco: ninguno** (`grep registerEvent|metadataCache.on|vault.on` en `moduloFoco` = 0 coincidencias). Foco **no se actualiza** cuando cambian las notas. La única conexión externa es `main.ts::refreshAllGtdAndFocoViews()` (al guardar un registro de tiempo) que solo llama a `refreshStatistics()`; y `updatePomodoroInAllViews`/`refreshAllTimerViews` que actualizan `timeTrackerView`.
- Eventos DOM (todos con `AbortController`, que se aborta y recrea en cada `drawView` y en `onClose`): `scroll` del contenedor, `click` delegado (navegación por anclas, toggle de breadcrumb de tarea `.gtd-breadcrumb-toggle` → clase `breadcrumb-is-open`, botones de vista/refresco/ajustes/agrupar/ordenar, enlaces de dependencia `.dependency-link`, apertura de notas con `openLinkText` y `eState.line`), `input` de filtros, `resize`/`orientationchange` de `window`.
- **Refresco**: cualquier acción de UI ejecuta `drawView(activeFile)` entero, que vuelve a llamar `parseFocus` (re-colecta + relee archivos). Esto incluye cambiar entre "Jerárquica / GTD / En progreso / Seguimiento / Estadísticas / Cronograma", cambiar agrupación u orden, el toggle de vencidas y el botón "Refrescar". `handleDependencyLinkClick` hace **otro** `parseFocus` completo solo para localizar la tarea por id (y, de paso, sobrescribe `noteOriginMap`).
- Filtros contexto/persona/contenido son 100 % DOM (sin reparseo): recalculan contadores iterando `.gtd-task`.
- `getDisplayText()` usa el ancla; al restaurar el layout, `activeFile` es `null` (ver 1.1).

### 1.9 Campos que lee Foco

| Origen | Campo | Dónde | Para qué |
|---|---|---|---|
| Frontmatter | `type` (solo valores `GrupoAV, Dly, Wk, M, Q, H, Y`) | `focoParser.ts::determineItemType` | Tipo de nodo y orden. |
| Frontmatter | `estado` | `focoHierarchyBuilder.ts:25`, `focoHtmlGenerator.ts:725` | Badge y desempate de orden. |
| Frontmatter | objeto completo | `parseFocus` → `item.frontmatter` | Se guarda sin usar más. |
| Nombre de archivo | prefijo `AV|AI|PGTD|PQ|RR|Tx|Vx|Reu|Rf|Sue|Cp|EMkt|RT|RL|Ax` + espacio | `determineItemType` | Tipo de nodo por defecto (`Ax`). |
| Metadata cache | `cache.links[].link` | `expand*` | Grafo de enlaces. |
| Metadata cache | `getFirstLinkpathDest` | `expand*` | Resolución. |
| TFile.stat | `ctime` | `focoHierarchyBuilder.ts:30` | Desempate. |
| Tareas | `- [ ]`, `[x]`, `[X]`, `[/]` (regex `^\s*-\s+\[( |x|X|\/)\]\s+(.*)`) | `parseTasks` | estado `incomplete/completed/in-progress`. |
| Tareas | `🛫`/`⏳`/`📅` + `YYYY-MM-DD` (solo la primera) | `parseTasks` | `date`, `dateSymbol`. |
| Tareas | `^id` o `🆔 id` (`[a-zA-Z0-9]+`) | `parseTasks` | `id` (si falta: `randomUUID`). |
| Tareas | `[hI:: ...]`, `[hF:: ...]` (campo inline Dataview, requiere espacio previo) | `parseTasks` | `startTime`, `endTime` (acepta `HH:mm` y `h[:mm]am/pm`). |
| Tareas | `[30min]`, `[2h]` | `parseTasks` | `duration`; conflicto si `fin-inicio != duración`. |
| Tareas | `[w:: [[YYYY-Www]]]` | `parseTasks` | `week`. |
| Tareas | `⛔ id` / `⛔ ^id` | `parseTasks` (sin limpiar contenido) | `dependencies`. |
| Tareas | `#cx-*`, `#px-*`, `#GTD-AlgunDia`, `#GTD-EstaSemanaNo`, `#inbox` | `parseTasks` | contextos, personas, listas excluyentes. `cx-ProyectoGTD`/`cx-Entregable` alimentan la lista "Proyectos". |
| Tareas | `⏫ 🔼 🔽 ⏬` | `parseTasks` | Prioridad Highest/High/Medium/Low. |
| Contenido | texto completo del archivo | búsqueda jerárquica, `checkInProgressTasks` | Búsqueda y ⚡. |
| `localStorage` | ver 1.7 | — | Settings. |

**No lee**: `origen::`/`origen:`, `valor`, `moneda`, `monto`, `fecha`, `✅`, `➕`, `🔁`.

### 1.10 Rendimiento y memoria (Foco)

Puntos calientes, de mayor a menor impacto:

1. **Entrantes** (`focoParser.ts:359-402`): barrido del vault por cada destino y nivel con `getFirstLinkpathDest` por enlace. Se arregla con un índice invertido (`metadataCache.resolvedLinks` invertido una vez, o mantenido incrementalmente).
2. **Reparseo total en cada interacción** (`drawView` → `parseFocus`), incluida la relectura de cada archivo (`vault.adapter.exists` + `cachedRead`) y de nuevo `vault.read` por cada item de jerarquía en `checkInProgressTasks`, más `vault.read` por ítem en la búsqueda por contenido.
3. **`console.log` masivo**: 8-12 logs por archivo en `parseFocus`, logs por nodo en `renderHierarchyViewRecursive`, logs por enlace hallado, logs por elemento `.check-in-progress` (incluyen volcado de `dataset` y de 200 caracteres de contenido). En móviles con DevTools abiertos esto es costoso.
4. **`processGtdLists`**: `inAnyList` recorre todas las listas con `includes` por tarea (O(n × tamaño de listas)); `isDatePast/isDateToday` crean objetos `moment` en cada llamada (varias por tarea). A escala de Foco es tolerable; a escala vault (GTD) es cuadrático.
5. **Render**: HTML completo por plantilla y asignación `innerHTML` (sin virtualización); `applyFilters` hace `JSON.parse` por tarea y por pulsación de tecla.
6. **`allTasks.concat`** por archivo.

Fugas / riesgos de memoria:
- `eventAbortController` se aborta en `drawView` y `onClose`: correcto para los listeners DOM propios.
- Temporizadores no cancelados al cerrar: `setTimeout(checkInProgressTasks, 100)`, `searchTimeout` (debounce), `setTimeout` de blur/hover en el modal.
- `noteOriginMap` global conserva el último mapa mientras el plugin esté cargado (solo rutas, bajo coste) y es incorrecto con múltiples vistas.
- `TimeTrackerView`, `StatisticsView`, `TimelineView` se crean una vez por vista y se reasignan contenedores (`updateContainer`); `onClose` solo limpia timer y timeline.
- El estilo del modal queda en `document.head` tras descargar el plugin.
- `main.ts::onunload` solo desacopla `GTD_VIEW_TYPE` y `BACKLINKS_VIEW_TYPE`; las hojas Foco no se desacoplan.
- Seguridad de render: `task.content` y `[[...]]` se interpolan en HTML sin escapar (inyección de HTML desde el contenido de una nota); `data-content` tiene el reemplazo `.replace(/"/g, '"')` (no-op, parece haber perdido `&quot;`).

---

## 2. BACKLINKS

Archivos: `backlinkDetector.ts` (120), `backlinkModel.ts` (49), `backlinkSettings.ts` (46), `backlinkView.ts` (1 074), `breadcrumbRenderer.ts` (183). Registro en `main.ts`: vista `dovela-backlinks-view` (línea 124), comando `open-backlinks-view` "Dovela: Mostrar Backlinks Organizados" (línea 177, `checkCallback` exige nota activa), ribbon icono `link` tooltip "Backlinks" (línea 222), ítem de menú de archivo "📎 Ver Backlinks Organizados" (línea 86-98), `activateBacklinksView` (línea 421: reutiliza hoja existente con `revealLeaf`, si no `getRightLeaf(false)` + `setViewState`). `onunload` desacopla las hojas Backlinks.

### 2.1 Algoritmo de detección (`BacklinkDetector.findBacklinks`, línea 11)

```
folder = currentFile.parent?.path || ''
para cada file de vault.getMarkdownFiles(), file != currentFile:
    isInSameFolder = (file.parent?.path === folder)         // SOLO la carpeta directa, no subcarpetas
    hasBacklink    = hasLinkToFile(file, currentFile.path)
    si isInSameFolder || hasBacklink -> BacklinkItem(file, isInSameFolder, hasBacklink)
```

- `hasLinkToFile` (línea 36): `getFileCache(file).links.some(link => getFirstLinkpathDest(link.link, file.path)?.path === targetPath || link.link === targetPath_sin_md)`. La segunda condición solo acierta con enlaces escritos con ruta completa sin extensión.
- Se consideran únicamente `cache.links`: **no** `embeds`, **no** `frontmatterLinks` (`origen: "[[...]]"`), **no** enlaces con `#heading`/`^block` si no resuelven (ver 1.4).
- `createBacklinkItem` (línea 48): `type`, `estado` del frontmatter (cadena vacía si faltan), `folderPath`, `creationDate = new Date(stat.ctime)`, `modificationDate = new Date(stat.mtime)`, `moneda`, `monto`. Es `async` sin ningún `await` real.
- Resultado: una nota puede ser a la vez "misma carpeta" y "con enlace". Ícono en lista: 🔗 si `hasBacklink`, 📁 si solo comparte carpeta; clase CSS `has-backlink` / `same-folder`.
- Costo: O(|vault| + Σ enlaces). Se ejecuta en cada cambio de nota activa y **en cada evento `vault.modify`** (ver 2.9).

### 2.2 Vista de árbol que sigue la nota activa

- Seguimiento (`backlinkView.ts:54-94`): al abrir, `currentFile = getActiveFile()`; eventos `active-leaf-change` y `file-open` → `handleActiveFileChange()` con `setTimeout(50 ms)` y compara `newActiveFile !== currentFile` antes de `render()`. Registrados con `this.registerEvent` (se limpian solos al cerrar la vista).
- `render()` (`:104`): vacía el contenedor; sin nota → estado vacío "No hay nota activa"; si hay nota: `refreshBacklinks` (detecta y ordena) + cabecera + ruta actual + controles + lista.
- **Vista de árbol** (`renderTreeView`, `:417`): se activa cuando `sortConfig.column === 3` (botón 📁 "Ruta"). Construye `allFiles = backlinks + archivo actual (isCurrentFile, icono 📍) + (si expandedTreeMode) todos los .md de la carpeta de la nota actual y subcarpetas (isExpandedModeFile, icono 📋)`. Los ítems añadidos tienen `type: ''` y `estado: ''` fijos (no leen frontmatter) ni fechas/dinero en el árbol.
- `buildFolderStructure` (`:521`): divide `folderPath` por `/` y crea `FolderNode {name, path, files, subfolders: Map, level}`; archivos en raíz del vault caen en un nodo `'Root'`. `renderFolderStructure` (`:558`): primero los archivos del nodo, luego subcarpetas **ordenadas por `localeCompare` del nombre (la dirección asc/desc del botón no afecta al árbol)**; el nodo `Root` de nivel 0 se aplana. Cada carpeta es `<details class="folder-item">` con `<summary>` (📁 nombre `(N archivos incluyendo descendientes)`) y `padding-left = level*20px`; los ítems usan `(level+1)*20px`.
- Dentro de una carpeta los archivos conservan el orden de `backlinks` (que a su vez viene ordenado por `folderPath` y por tanto, entre notas de la misma carpeta, en orden de `getMarkdownFiles()`); la nota actual y las de modo expandido se agregan **al final** del array, así que aparecen tras las demás de su carpeta.
- Doble clic en "Ruta" (ventana `DOUBLE_CLICK_DELAY = 800 ms`, estado `lastClickTime/lastClickedButton`, `handleColumnSort`, `:871`) alterna `expandedTreeMode`; el botón muestra `📁+` y su `title` cambia. Cada clic además alterna la dirección asc/desc (efecto lateral irrelevante para el árbol).

### 2.3 Lógica de expansión de carpetas (`shouldExpandFolder`, `:495`; commit `396fe22`)

```
shouldExpandFolder(folderPath, level):      // level = nivel de renderizado (0 = primeras carpetas visibles)
  si level == 0                                  -> true
  si currentFile:
      cur = currentFile.parent.path || ''
      si cur == folderPath || cur.startsWith(folderPath + '/') -> true   // ruta hacia la nota actual
  si expandedTreeMode                            -> level < 2
  -> false
```
`folderItem.setAttribute('open','true')` si procede. Observaciones: `level` es el nivel de render, no la profundidad real en el vault (el nodo `Root` aplanado no suma nivel). El estado de apertura manual del usuario se pierde en cada re-render (cada `modify`).

### 2.4 Visor de pestañas abiertas (`toggleTabsViewer :683`, `renderTabsView :701`, `renderTabItem :814`)

- Botón 🗂️ (clase `open-tabs-btn`) alterna `showingTabs` y cambia a 📋 / title "Volver a backlinks".
- Obtiene `getLeavesOfType('markdown')` + `getLeavesOfType('canvas')`. Agrupa por "tipo de split": compara `leaf.parent` con `leftSplit`/`rightSplit` (en la práctica `leaf.parent` es un contenedor de pestañas, no el dock, por lo que esa comparación rara vez acierta; no verificado en runtime), si no sube por `parent` hasta `rootSplit` buscando `type === 'split'` y etiqueta `split-<direction>`; si no, `main`. Solo muestra encabezados de grupo si hay más de un grupo con pestañas (`groupOrder = main/left/right`, luego otros).
- Cada ficha: icono (📄 markdown, 🎨 canvas, 📋 otro), título `leaf.getDisplayText()`, ruta de la carpeta del archivo (o "Raíz"), destaca la pestaña activa (`workspace.activeLeaf`, API obsoleta), clic → `setActiveLeaf(leaf, {focus:true})`, hover con clase.
- Es una **instantánea**: no escucha `layout-change`; solo se repinta al conmutar el botón, al cambiar de nota o en cada `modify`.

### 2.5 Ordenamientos (`BacklinkDetector.sortBacklinks/sortBacklinksByDate`, `backlinkView.ts::applySorting :1002`)

- Columnas (botones `sort-btn`): 0 Archivo (`file.basename`), 1 Tipo, 2 Estado, 3 Ruta (`folderPath`). Comparación: minúsculas + `localeCompare`; `desc` invierte. Columna desconocida → 0 (orden estable). Siempre sobre copia (`[...backlinks]`).
- Fechas: botones 📅 creación / 📝 modificación; `getTime()` diferencia; `desc` invierte.
- Máquina de estados:
  - Default `DEFAULT_SORT_CONFIG = {column:-1, direction:'desc', dateSort:'creation'}` → al abrir: creación descendente.
  - `handleColumnSort(i)`: `direction = (misma columna y era 'asc') ? 'desc' : 'asc'`, `dateSort = null`.
  - `handleDateSort(t)`: doble clic (misma tecla en <800 ms) → invierte dirección; si cambia de tipo de fecha → `desc`; si es clic simple en la misma → mantiene dirección. Pone `column = -1`.
  - Los estados de botones se actualizan con `updateControlsState` (usa selectores `.date-btn[title*="creación"]`, frágil ante cambios de texto).
- El orden persiste solo en memoria de la vista (no en settings).

### 2.6 Fechas detalladas e información financiera

- Commit `33351fe` (2025-09-10). En `renderListView` (`:314`; **no aparecen en el árbol**): fila de fechas con `Creado:` y `Modificado:` formateadas por `formatDateTime` (`Intl.DateTimeFormat('es-ES', {year, month 2-digit, day 2-digit, hour, minute 2-digit, hour12:false})` → "dd/mm/yyyy, hh:mm").
- Fila financiera `💰` si `backlink.moneda && backlink.monto` (si `monto` es `0` o vacío, no se muestra). **Origen: frontmatter de la nota** (`frontmatter.moneda`, `frontmatter.monto`), tal como define la plantilla `Plt - Transacción.md` (`monto:` vacío, `moneda: COP`, `type: Tx`). No hay lectura de campos Dataview inline.
- `formatMoney` (`:1053`): `new Intl.NumberFormat('es-ES', {style:'currency', currency: moneda.toUpperCase(), 2 decimales})`. **El constructor está fuera del `try`**: un `moneda` que no sea un código de 3 letras válido (por ejemplo `COP$`, `pesos`) lanza `RangeError` y aborta todo `renderListView`. Solo `format()` está protegido; el `catch` (fallback `"<MONEDA> 1.234,50"`) es prácticamente inalcanzable. Además `monto` se asume `number`; un string (`"1.500"`) se coerciona a número JS y se interpreta mal.

### 2.7 Breadcrumbs (carpeta) y el bug de recursión de julio 2026

Atención: en el repo existen **dos cosas llamadas breadcrumb**:
1. **Breadcrumb de origen de tarea** (GTD y Foco; `Documentacion/Implementacion-Breadcrumbs.md`): `createTaskBreadcrumbMap(hierarchicalData)` recorre la jerarquía acumulando nombres de nodos (quitando `[FALTA]` con `/\s*\[FALTA\]\s*/g`) y asigna `taskId → "a > b > c"`; el icono 📄 (`.gtd-breadcrumb-toggle`) alterna la clase `breadcrumb-is-open` en el `<li>`. Como `buildHierarchy` devuelve una raíz virtual `Vault`, **la ruta empieza por `Vault > ...`** (el ejemplo de la documentación omite ese prefijo). No participa en el bug.
2. **Breadcrumb de carpeta de Backlinks** (`BreadcrumbRenderer`): es el módulo del bug.

**Algoritmo actual** (`breadcrumbRenderer.ts`):
- `createBreadcrumb(path)` despacha por `settings.breadcrumbStyle`: `full` → `createFullBreadcrumb`; `compact` → `createCompactBreadcrumb(path, maxBreadcrumbLength)`; `smart`/default → `createSmartBreadcrumb(path, maxBreadcrumbLength)`.
- `parsePathSegments`: `path.split('/').filter(Boolean)`, cada segmento con `path` acumulado (`'A'`, `'A/B'`, ...) y `isClickable: true` (campo no usado).
- `createFullBreadcrumb`: `''` → `📁 Root`; si no, `seg › seg › seg` con clic → `openFolder(segment.path, metaKey||ctrlKey)`.
- `createSmartBreadcrumb`: `''` → full; si `long(filtrada).length <= max` → full; si no → compact.
- `createCompactBreadcrumb`: `''` → solo `📁`; si `nombres.join('/').length <= max` → "path" (full); si hay **>2 segmentos** → `primero › ... › último` + `title = folderPath`; si hay ≤2 → "path" (full).
- `createPathBreadcrumbs`: alias "por compatibilidad" (ahora → `createFullBreadcrumb`).
- `openFolder`: abre en la hoja actual o nueva pestaña el **primer** `.md` cuya carpeta coincide (`getMarkdownFiles().filter(...)`, O(|vault|) por clic; no abre la "nota de carpeta" `Carpeta/Carpeta.md`); si no hay ninguno dispara `workspace.trigger('reveal-active-file')`.
- Estilo seleccionado: botón 📁 de la cabecera cicla `full → smart → compact` (`cycleBreadcrumbStyle :1018`, lee `breadcrumbRenderer['settings']` por corchetes) y persiste en `localStorage['dovela-backlink-settings']`.

**El bug** (Btx 260706 Sesión 01 y commit `ef3b3e1`, 2026-07-06): síntoma `Failed to open view RangeError: Maximum call stack size exceeded` y "Reiniciando bóveda" al abrir notas; ciclo observado `createCompactBreadcrumb → createBreadcrumb → createPathBreadcrumbs → createCompactBreadcrumb`. Antes del fix `createPathBreadcrumbs` llamaba a `createBreadcrumb`. Con `style = compact`, o `smart` con ruta larga, las ramas de `createCompactBreadcrumb` que devolvían `createPathBreadcrumbs` (ruta corta ≤ max, o ≤2 segmentos) volvían a `createBreadcrumb` → mismo estilo → mismo caso, sin caso base. Se manifestaba al restaurar la vista de Backlinks del layout (la vista se renderiza al abrir) con el estilo persistido en localStorage. **Corrección**: `createPathBreadcrumbs` → `createFullBreadcrumb` (no recursa). Verificado por el autor abriendo varias notas sin errores. Se registró como `Cmt 260706 1621` y se integró a `main` (merge fast-forward + push en la sesión 02).

Consecuencias de diseño tras el fix:
- `smart` y `compact` son **funcionalmente idénticos** (misma condición de longitud con la misma `maxBreadcrumbLength` = 60; difieren solo en ruta vacía: `📁 Root` vs `📁`). El `maxLength = 30` por defecto de `createCompactBreadcrumb` nunca se usa.
- Una ruta larga con exactamente 2 segmentos se muestra completa (nunca se trunca).
- Ausencia de una guardia anti-recursión o de pruebas: la regresión solo se evita por convención.

### 2.8 Títulos multilínea, fechas, estilos

- Commit `33621f4`: `.file-title` usa `display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; word-break:break-word; overflow:hidden` (hasta 3 líneas) en `styles.css` (definido dos veces, ~líneas 4130 y 4595). Ambos bloques terminan en `}}` (llave sobrante): por la recuperación de errores de CSS, el selector siguiente (`.metadata-row`) del primer bloque podría descartarse (no verificado en runtime). El módulo es solo CSS; no hay lógica TS.
- Los estilos de backlinks (≈900 líneas, `styles.css` 3930-5560) están duplicados en dos bloques (3930-4350 y 4387-4840), señal de merge/copy-paste.

### 2.9 Eventos, refresco, rendimiento y fugas (Backlinks)

- Eventos (todos `registerEvent`): `workspace.active-leaf-change`, `workspace.file-open` (ambos → `handleActiveFileChange` con retardo de 50 ms) y **`vault.modify` sin filtro ni throttle** → `refreshBacklinks()` (re-detecta sobre todo el vault, reordena y repinta la lista).
  - Problemas: (a) corre en cada guardado de **cualquier** nota (autoguardado del editor cada pocos segundos); (b) se ejecuta antes de que `metadataCache` haya reindexado el archivo (el evento correcto es `metadataCache.on('changed')`/`resolved`), por lo que la detección puede ir un cambio atrasada; (c) no repinta cabecera ni contador (`N enlaces` queda desactualizado); (d) no escucha `rename/delete/create`.
  - Hot path: `findBacklinks` O(|vault| + Σ enlaces) con `getFirstLinkpathDest` por enlace; además crea un `Date`+objeto por coincidencia; y repinta DOM completo (listas de cientos de ítems con breadcrumbs de N segmentos cada uno, cada uno con closures `onclick`).
- Memoria: sin fugas relevantes (DOM reconstruido, eventos registrados vía API). `onClose` está vacío; `setTimeout` de 50 ms no cancelado (puede disparar `render()` tras cerrar la vista, inofensivo salvo excepción). `localStorage` se escribe sin try/catch en `BacklinkSettingsManager.save`.
- Estados que no persisten: orden, modo expandido, `showingTabs`.

### 2.10 Settings (`backlinkSettings.ts`)

| Clave | Tipo | Default | ¿Se usa? |
|---|---|---|---|
| `dovela-backlink-settings` (localStorage, JSON) | `BacklinkSettings` | — | sí |
| `.breadcrumbStyle` | `'full'\|'smart'\|'compact'` | `'full'` | sí |
| `.maxBreadcrumbLength` | number | `60` | sí |
| `.maxSegmentLength` | number | `20` | **no** |
| `.showFolderIcons` | boolean | `true` | **no** |
| `.clickBehavior` | `'open-folder'\|'reveal-in-explorer'` | `'open-folder'` | **no** |

También sin uso: `FilterOptions`, `DEFAULT_FILTER_OPTIONS`, `BreadcrumbSegment.isClickable`. No hay pestaña de ajustes; el único control de usuario es el botón que cicla el estilo.

### 2.11 Campos que lee Backlinks

| Origen | Campo | Uso |
|---|---|---|
| Frontmatter | `type` (string) | Etiqueta y ordenamiento col. 1. Si no es string, `toLowerCase()` fallaría en `sortBacklinks`. |
| Frontmatter | `estado` (string, p. ej. emoji 🟢) | Etiqueta y ordenamiento col. 2. |
| Frontmatter | `moneda` (código ISO 4217) | `formatMoney`. |
| Frontmatter | `monto` (number) | `formatMoney`; oculto si falsy. |
| `cache.links` | `link` | Detección de backlink. |
| `TFile.stat` | `ctime`, `mtime` | Fechas y ordenamiento. |
| `TFile` | `basename`, `parent.path` | Nombre, carpeta, árbol, breadcrumb, misma carpeta. |
| Workspace | hojas `markdown`/`canvas`, `getDisplayText()`, `view.file` | Visor de pestañas. |
| `localStorage` | `dovela-backlink-settings` | Estilo de breadcrumb. |

**No lee**: `origen::`/`origen:`, `fecha`, `valor`, `tags`, `tipoTransaccion`, `cuenta`.

---

## 3. Campos de frontmatter / Dataview inline (consolidado)

| Campo | Foco | Backlinks | Notas |
|---|---|---|---|
| `type` | sí (parcial, 7 valores; resto por prefijo de nombre) | sí (cualquier string) | Vocabulario del vault real (`Ax,PGTD,Tx,Dly,AI,Reu,Cmt,RR,Vx,AV,Wly,GrupoAV,Ref`) no coincide con el del plugin (`Wk`, `Rf`, `Cmt`/`Btx` sin mapear). |
| `estado` | sí | sí | |
| `moneda`, `monto` | no | sí | Plantilla Tx: `moneda: COP`, `monto:` vacío. |
| `origen` (frontmatter wikilink) / `origen::` (inline) | **no** | **no** | La convención del vault lo define como puntero al contenedor padre (`referencia-vault.md:91`, `CLAUDE-vault.md:69`). Ninguno de los dos lo usa para backlinks ni para el árbol; el árbol se infiere por carpetas. |
| `[hI::]`, `[hF::]`, `[w::]` | sí (en líneas de tarea) | no | Campos inline dentro de tareas. |
| Emojis de Tasks (`🛫 ⏳ 📅 ⏫ 🔼 🔽 ⏬ 🆔 ⛔`) | sí | no | |
| Etiquetas `#cx-`, `#px-`, `#GTD-AlgunDia`, `#GTD-EstaSemanaNo`, `#inbox` | sí | no | |

---

## 4. Rendimiento y memoria: resumen de puntos calientes y qué reescanea cada uno

| Acción | Qué reescanea | Costo dominante |
|---|---|---|
| Abrir Foco / cualquier clic de UI de Foco | Carpeta base completa; todo el vault para entrantes; relectura de cada archivo con `adapter.exists` + `cachedRead`; reparseo de tareas; ⚡ relee cada item de jerarquía | Entrantes: |base|×|vault|×enlaces; I/O de lectura |
| Clic en enlace de dependencia (Foco) | Otro `parseFocus` completo | Igual que arriba |
| Búsqueda por contenido (Foco) | `vault.read` secuencial por item de jerarquía | I/O (cacheado por sesión de dibujo) |
| Cambio de nota activa (Backlinks) | Todo el vault + todos los enlaces | O(|vault|+enlaces) |
| Guardado de cualquier nota (Backlinks) | Lo mismo, sin debounce | Ídem, repetido cada autoguardado |
| `main.ts::handleFileChange` (otro módulo, mismo evento `modify`) | `collectMetadata()` | Se suma al anterior |
| Render | innerHTML completo (Foco), DOM completo (Backlinks) | Proporcional al número de tareas/ítems |

Fugas: sin fugas graves; riesgos menores listados en 1.10 y 2.9. Mitigaciones sugeridas: índice incremental, `debounce` + `metadataCache.on('changed')`, cache de resultado por (ancla, settings, versión del índice), quitar `console.log`, escapar HTML, no leer disco para cada archivo.

---

## 5. Integración sobre una capa de datos compartida

### 5.1 Consultas que cada módulo necesita del índice

| Consulta | Foco | Backlinks | Notas de diseño |
|---|---|---|---|
| `getNote(path) -> {path, basename, folder, ctime, mtime, type, estado, moneda, monto, fm}` | sí (type, estado, ctime) | sí (todo) | Normalizar `type` a un vocabulario único. Proveer acceso tipado a `fm`. |
| `listFolder(folder, {recursive})` | sí (base = carpeta recursiva) | sí (modo expandido recursivo) | Backlinks "misma carpeta" es `listFolder(folder, {recursive:false})`. |
| `getOutLinks(path, {kinds: body\|frontmatter\|embed})` -> paths resueltos (solo .md) | sí (salientes, solo `body`) | no | Resolución con `getLinkpath` + `resolvedLinks`. Decidir si `origen:` cuenta (hoy no). |
| `getInLinks(path, {kinds})` (índice invertido) | sí (entrantes, hoy O(vault)) | sí (hasBacklink) | Pieza clave: lo comparten ambos. Equivale a invertir `metadataCache.resolvedLinks` una vez e invalidar por archivo. |
| `getSiblings(path)` | no | sí | `listFolder(parent, {recursive:false}) - self`. |
| `expandNeighborhood(seedPaths, {outLevels, inLevels, stopFolders, stopNotes, kinds})` -> `Map<path, {type, level}>` | sí | opcional | Función **pura sobre el índice**; testeable sin Obsidian (sección 6). |
| `getTasksByFile(path)` / `getTasks(paths[])` | sí | no | Resultado de un único `parseTasks` cacheado por `(path, mtime)`. |
| `getAllTasksById()` / `resolveDependency(id)` | sí (hoy solo subconjunto) | no | Habilita dependencias fuera del foco y evita el `parseFocus` de `handleDependencyLinkClick`. |
| `buildNoteTree(paths[])` -> jerarquía con fusión carpeta/nota y placeholders | sí | sí (árbol de carpetas) | Un solo constructor (`buildHierarchy`). Backlinks podría usar este mismo árbol (carpetas + notas). |
| `getNotesByType(type)` / `getNotesByEstado(estado)` | no hoy | no hoy | Necesario para unificar `TYPE_ORDER`/`estado` y para vistas por tipo. |
| `getOpenLeavesInfo()` | no | sí | No es dato del vault: queda en la capa de UI. |
| Eventos: `onChanged(paths)`, `onRenamed`, `onDeleted`, `onActiveFileChanged` | para refresco opcional del foco | sí | Una suscripción compartida con debounce; reemplaza `vault.modify` sin filtro. |
| Configuración de exclusiones (plantillas, `99 - Adjuntos`) | debería usarla (hoy no) | no | Para uniformar GTD y Foco. |

### 5.2 Efectos esperados

- Entrantes de Foco: de O(|base|×|vault|×enlaces) a O(Σ grado entrante de los nodos visitados).
- Backlinks: `findBacklinks` pasa a `getSiblings ∪ getInLinks` O(k) sin recorrer el vault; el refresco por `modify` se reduce a invalidar las entradas del archivo cambiado.
- Los tres consumidores (GTD, Foco, Backlinks) comparten `getNote`/`getTasks`, eliminando el ~64 % de duplicación de Foco.
- Foco podría **seguir la nota activa** suscribiéndose a `onActiveFileChanged` (decisión de producto, hoy no lo hace) y refrescar incrementalmente con `onChanged`.
- Deben resolverse previamente: formato único de `week`, `additionalDates` en el parser compartido, filtro de exclusiones, y la semántica de enlaces (cuerpo vs `origen`).

---

## 6. Casos de prueba sugeridos para la lógica pura

Recomendación previa: extraer funciones puras para poder testear sin Obsidian (los módulos actuales dependen de `TFile`, `document` y `localStorage`):
`computeBreadcrumb(path, style, maxLen) -> {kind, segments[], ellipsis?}`, `expandNeighborhood(graph, seeds, cfg)`, `sortBacklinks`, `shouldExpandFolder`, `buildFolderTree`, `nextSortState`, `formatMoney`.

### 6.1 Breadcrumbs (backlinks)

Notación: `seg(nombre, ruta)`, `sep` = "›".

| # | Entrada (`path`, estilo, max) | Salida esperada |
|---|---|---|
| B1 | `''`, full, 60 | `[📁 Root]` (clase `root`) |
| B2 | `''`, compact, 60 | `[📁]` (solo icono) |
| B3 | `''`, smart, 60 | `[📁 Root]` (delega a full) |
| B4 | `'A/B/C'`, full | `seg(A,'A') sep seg(B,'A/B') sep seg(C,'A/B/C')` |
| B5 | `'/A//B/'`, full | igual que `'A/B'`: segmentos `A` ('A') y `B` ('A/B') |
| B6 | `'A/B'`, smart, 60 | full (longitud 3 ≤ 60) |
| B7 | `'A/B'`, compact, 60 | full |
| B8 | 5 segmentos de 15 caracteres (≈79 > 60), smart | `seg(primero) " › ... › " seg(último)`; `title == path completo` |
| B9 | igual que B8, compact | idéntico a B8 |
| B10 | 5 segmentos con longitud total **exactamente** 60, smart | full (límite inclusivo `<=`) |
| B11 | 61 caracteres, 5 segmentos, smart | compact |
| B12 | 2 segmentos que suman 81 caracteres, compact/smart | full completo, sin elipsis (regresión del bug: antes recursión infinita) |
| B13 | 1 segmento de 100 caracteres, compact | full |
| B14 | Regresión de recursión: para estilos {full,smart,compact} × rutas {'', 'a', 'a/b', 'a/b/c', 2 largos, 5 largos} × max {0, 1, 30, 60} | termina; número de llamadas a `create*` ≤ 3 por invocación; sin `RangeError` |
| B15 | `createPathBreadcrumbs(p)` | `==` `createFullBreadcrumb(p)` para cualquier `p` (no llama a `createBreadcrumb`) |
| B16 | `max = 0`, `'A/B/C'`, smart | compact: `A › ... › C` (cualquier ruta no vacía supera 0) |
| B17 | clic con `ctrlKey`/`metaKey` en segmento `'A/B'` | `openFolder('A/B', true)` (nueva pestaña) |

Breadcrumb de origen de tarea (`createTaskBreadcrumbMap`):

| # | Entrada | Salida |
|---|---|---|
| T1 | raíz `Vault` > `AV - X` > nota `Ax N` con tarea id `t1` | `t1 -> "Vault > AV - X > Ax N"` |
| T2 | nodo `[FALTA] Carpeta` con tarea en hijo | segmento `Carpeta` (sin `[FALTA]`) |
| T3 | dos tareas con el mismo id | la última escritura gana (documentar) |

### 6.2 Expansión de enlaces (Foco)

Fixture de grafo (rutas abreviadas). Carpeta `P/` (con subcarpeta `P/s/`) contiene `a`, `b`, `s1`; `Z/` fuera.
Enlaces: `a→x`, `b→y`, `x→z`, `z→w`, `s1→a`; entrantes: `i1→a`, `i2→i1`, `i3→i2`, `J/j1→a` (J = carpeta de terminación), `k→J/j1`, `m→b`; ciclo `x→a`.

| # | Config (out, in, termination) | Entrada | Salida esperada |
|---|---|---|---|
| E1 | (2, 5, ['J']) ancla `P/a` | | base = {a, b, s1} (+ ancla); out nivel1 {x, y}, nivel2 {z}; `w` excluida (nivel 3). in nivel1 {i1, j1(term.), m}; nivel2 {i2} (de i1); nivel3 {i3}; `k` excluida (j1 es de terminación y está en nivel 1: no se buscan sus enlazantes). `stats`: `folderBaseNotes = 2` (a se cuenta aparte), `maxOutgoingLevel = 2`, `maxIncomingLevel = 3`, `terminationNotes = 1`. |
| E2 | (0, 0, []) | | solo base. Sin salientes ni entrantes. |
| E3 | (1, 0, []) | | base + {x, y}; `z` no. |
| E4 | (2, 5, []) con ciclo `x→a` | | `a` no se reañade; sin bucle; `x` aparece una vez con nivel 1. |
| E5 | (2, 0, ['X']) con `x` en `X/` y `x→z` | | `x` se incluye con origen `termination-folder`, nivel 1; `z` queda **excluida**: el nivel 2 salta las fuentes de terminación (`level>1`). |
| E6 | Ancla dentro de la carpeta de terminación (p. ej. ancla `J/d`, termination `['J']`) | | La expansión en nivel 1 **sí** ocurre (la guardia es `level>1`); a partir del nivel 2 los hallados de `J` no se expanden. |
| E7 | Nota alcanzable por salientes y entrantes (`a→x`, `x→a` con x fuera de la carpeta) | | `x` clasificada `outgoing-link` (salientes se ejecuta antes); no aparece como `incoming-link`. |
| E8 | Enlace a imagen `![[foto.png]]`/`[[foto.png]]` y a nota inexistente | | ignorados (`extension !== 'md'`, `getFirstLinkpathDest = null`). |
| E9 | Enlace `[[x#Sección]]` | | Documentar el comportamiento: probablemente no resuelve con la implementación actual (`getFirstLinkpathDest` sobre el linktext completo); tras unificar con índice debe resolver a `x`. |
| E10 | Ancla en la raíz del vault | | base = todo el `.md` del vault. |
| E11 | Salientes a profundidad 3 sin vecinos en nivel 2 | | `maxOutgoingLevel` = último nivel con resultados; el bucle corta. |
| E12 | `validate({outgoing: 99, incoming: -3})` | | `{10, 0}`; `validate` con `terminationFolders = 'x'` → default. |
| E13 | `isTerminationFile`: `J/sub/n.md` con `['J']` → termina; `Jx/n.md` con `['J']` → no (el sufijo `/` evita falso positivo); nota `'Plan.md'` coincide por `name` o `basename+'.md'` en cualquier carpeta | | |

Test de paridad (cuando exista índice): `expandNeighborhood` sobre el índice debe producir **exactamente** el mismo conjunto, niveles y origen que la implementación actual (`collectFocusFiles`) para los mismos fixtures.

### 6.3 Ordenamiento y árbol (Backlinks y jerarquía de Foco)

Dados `n1.basename='b'`, `n2='A'`, `n3='a2'` (todos en `C`), `type` `['','Tx','Ax']`, `estado` `['🟢','','🔴']`:

| # | Operación | Resultado |
|---|---|---|
| S1 | `sortBacklinks(col 0, asc)` | `A, a2, b` (minúsculas + `localeCompare`) |
| S2 | `sortBacklinks(col 0, desc)` | `b, a2, A` |
| S3 | `sortBacklinks(col 1, asc)` | `'' (n1), Ax (n3), Tx (n2)` (vacío primero) |
| S4 | `sortBacklinks(col 2, desc)` | `🟢/🔴 según localeCompare…, '' al final` (definir tras fijar locale) |
| S5 | `sortBacklinks(col 99, *)` | orden sin cambios (comparador devuelve 0), instancia nueva |
| S6 | `sortBacklinks` no muta el array de entrada | verdadero |
| S7 | `sortBacklinksByDate('creation','desc')` con ctime `[10, 30, 20]` | `30, 20, 10`; `'asc'` → `10, 20, 30` |
| S8 | empates de fecha | orden estable (Array.sort estable en V8) |
| S9 | `nextSortState` (columna): estado `{col:-1}` clic col 0 → `{col:0,'asc'}`; clic de nuevo → `'desc'`; clic col 1 → `{col:1,'asc'}` y `dateSort=null` | |
| S10 | `nextSortState` (fecha): inicio `{creation,'desc'}`; clic simple en creación → sin cambio; doble clic (<800 ms) → `'asc'`; clic en modificación → `{modification,'desc'}` | |
| S11 | doble clic en "Ruta" (<800 ms entre clics 1 y 2) | `expandedTreeMode` pasa a `true`; tercer par de clics → `false`; clics a >800 ms no lo alternan |
| S12 | `buildFolderStructure` con `folderPath ∈ ['', 'A', 'A/B', 'A/B', 'C']` | nodos: `Root`(1 archivo), `A`(1)→`B`(2), `C`(1); `countFilesInFolder(A) = 3` |
| S13 | `renderFolderStructure` orden | en cada nodo: archivos primero, subcarpetas por `localeCompare`; `Root` de nivel 0 aplanado; la dirección asc/desc no cambia el orden de carpetas |
| S14 | `shouldExpandFolder('A', 0, cur='X/Y', exp=false)` | `true` |
| S15 | `shouldExpandFolder('A/B', 1, cur='A/B/C', exp=false)` | `true` (ruta hacia la nota actual) |
| S16 | `shouldExpandFolder('A/X', 1, cur='A/B/C', exp=false)` | `false` |
| S17 | `shouldExpandFolder('A/X', 1, cur='A/B/C', exp=true)` | `true` (`level<2`) |
| S18 | `shouldExpandFolder('A/X/Q', 2, cur='A/B/C', exp=true)` | `false` |
| S19 | `shouldExpandFolder('A/B', 1, cur=null, exp=false)` | `false` |
| S20 | prefijo engañoso: `shouldExpandFolder('A/B', 1, cur='A/Bc/d')` | `false` (la comparación usa `folderPath + '/'`) |
| S21 | tabs: `tabGroups` con una sola clave | sin encabezados de grupo (`shouldShowGroups=false`) |

`buildHierarchy` (Foco/GTD):

| # | Entrada | Salida |
|---|---|---|
| H1 | `P/P.md`, `P/a.md` | `P` (nota) con hijo `a`; sin placeholders |
| H2 | `P/a.md` sin `P/P.md` | placeholder `[FALTA] P` (`isNoteMissing`) con hijo `a` |
| H3 | raíz: nodos de nivel 0 ordenados por nombre; niveles inferiores por `TYPE_ORDER` (`AV<AI<PQ<PGTD<…<Ax<Tx`) |
| H4 | misma `type`, `estado` distintos (`🟢`,`🔴`) | `localeCompare` entre estados |
| H5 | mismo `type` y `estado`, `ctime` distintos | el más reciente primero |
| H6 | `A/X.md` y carpeta `A/X/` sin `A/X/X.md` | documentar bug: `A/X.md` se pierde del árbol |
| H7 | conteos | `descendantTaskCount` del padre = Σ(`own`+`descendant`) de hijos; hojas = 0 |

### 6.4 Otras funciones puras valiosas

- `formatMoney('COP', 1500.5)` → `"1500,50 COP"` (es-ES no agrupa miles de 4 dígitos; confirmar con el ICU del runner); `formatMoney('pesos', 1)` → hoy **lanza `RangeError`** (debe devolver el fallback tras el arreglo: `"PESOS 1,00"`); `monto=0` o `moneda=''` → no se muestra fila.
- `parseTasks`: `"- [ ] Llamar #cx-oficina 📅 2026-11-05 ⏫ [30min] ^t1"` → `status incomplete`, `priority Highest`, `date 2026-11-05`, `dateSymbol 📅`, `duration 30min`, `contexts ['oficina']`, `id 't1'`; `"- [x] ..."` → `completed true`; `"- [/] ..."` → `in-progress`; `hI 10:00 hF 11:00 [30min]` → `hasConflict true`; `🛫 d1 📅 d2` → hoy `additionalDates` indefinido en Foco y `[{📅,d2}]` en GTD (test de paridad tras unificar); `[w:: [[2026-W45]]]` → formato de `week` según decisión (ver 1.3).
- `processGtdLists` con reloj fijo (mock de `moment`): casos de clasificación (vencida, hoy sin hora, calendario con hora, dependencia sin resolver, `#GTD-AlgunDia`, start futuro), incluidos los de "doble listado".
- `isTerminationFile`, `FocoSettingsManager.validate/load` (con `localStorage` simulado y JSON corrupto).

---

## 7. Lista de defectos y deudas observados (referencia rápida)

| Id | Archivo | Descripción | Gravedad |
|---|---|---|---|
| D1 | `backlinkView.ts:294-302` | Con 0 backlinks `renderBacklinksList` retorna antes de evaluar `showingTabs`/árbol: no se puede ver el visor de pestañas ni la nota actual en el árbol en notas sin backlinks ni compañeras de carpeta. | Media |
| D2 | `backlinkView.ts:1053-1059` | `new Intl.NumberFormat(... currency)` fuera del `try`; `moneda` inválida rompe el render. | Media |
| D3 | `focoParser.ts:53-159` | Fork antiguo de `parseTasks` (sin `additionalDates`, `week` distinta). Difiere de GTD. | Alta (deriva) |
| D4 | `focoParser.ts:164,434` | `noteOriginMap` global compartido entre vistas. | Media |
| D5 | `focoView.ts` / `main.ts:109,345` | Sin `getState/setState`: la vista Foco no sobrevive a reinicios; asignación a campo privado por corchetes y `onOpen()` manual (doble `onOpen`). | Media |
| D6 | `main.ts:328` | Reutilización de hoja por `includes(basename)` (subcadena). Además, con vistas diferidas (Obsidian ≥1.7) `l.view.getDisplayText` podría no existir (no verificado). | Baja/Media |
| D7 | `focoHtmlGenerator.ts:358` | `data-content` con `replace(/"/g, '"')` (no-op): comillas rompen el atributo; contenido/`[[...]]` sin escapar en HTML. | Media (robustez/seguridad) |
| D8 | `backlinkView.ts:78-82` | `vault.modify` sin filtro/debounce y antes de que la caché se actualice; cabecera/contador no se actualizan. | Media (rendimiento) |
| D9 | `breadcrumbRenderer.ts` | `smart`≡`compact`; ajustes `maxSegmentLength`, `showFolderIcons`, `clickBehavior` sin uso; `openFolder` abre "el primer archivo" de la carpeta, no la nota de carpeta. | Baja |
| D10 | `focoSettings.ts` | `enableNetworkVisualization` sin implementación; `termination-note` nunca asignado; `load()` no valida; settings en localStorage (no sincronizan). | Baja |
| D11 | `focoParser.ts` + `backlinkDetector.ts` | Solo `cache.links` (sin `frontmatterLinks`/`embeds`/subpaths) → `origen:` no genera backlinks. | Decisión de diseño |
| D12 | `focoHierarchyBuilder.ts:107-117` | Colisión nota `X.md` vs carpeta `X/` sin nota de carpeta: la nota se descarta de la jerarquía. | Baja |
| D13 | `moduloGTDv3/dateUtils.ts` + `parser.ts` (colateral) | El `week` sin corchetes de GTD no es reconocido por `isWeek*` (esperan `[[...]]`). | Media (en GTD) |
| D14 | `styles.css` ~4139/4607 | Llave `}}` sobrante tras `.file-title`; bloques de estilo de backlinks duplicados. | Baja |
| D15 | `Documentacion/Resumen-Refactor-Vista-Jerarquica.md` | Desactualizado (fases 3-4 ya implementadas); `Implementacion-Breadcrumbs.md` omite el prefijo `Vault >` y no menciona Foco. | Docs |
| D16 | `focoView.ts:274-278` vs `:787-796` | Doble manejador del mismo clic sobre `#focus-view-title` (alterna clase `collapsed` y también el contenido persistido). | Baja |

---

## 8. Referencias de código usadas

- Foco: `focoParser.ts` (determineItemType :17, parseTasks :53, isTerminationFile :166, collectFocusFiles :184, expandOutgoingLinksFromGroup :277, expandIncomingLinksFromGroup :340, parseFocus :417), `focoSettings.ts`, `focoSettingsModal.ts`, `focoView.ts` (drawView :136, addEventListeners :242, búsqueda jerárquica :477-654, header colapsable :802-832, checkInProgressTasks :1181), `focoHtmlGenerator.ts` (renderTask :321, renderGtdListsView :577, renderHierarchyViewRecursive :719, generateGtdViewHtml :781, generateExpansionStatsHtml :909, generateOriginIndicator :960), `focoProcessor.ts`, `focoHierarchyBuilder.ts`, `focoDateUtils.ts`, `focoModel.ts`.
- Backlinks: `backlinkDetector.ts` (findBacklinks :11, hasLinkToFile :36, sortBacklinks :71, sortBacklinksByDate :108), `backlinkView.ts` (onOpen :54, renderTreeView :417, shouldExpandFolder :495, buildFolderStructure :521, renderTabsView :701, handleColumnSort :871, handleDateSort :920, cycleBreadcrumbStyle :1018, formatDateTime :1042, formatMoney :1053), `breadcrumbRenderer.ts`, `backlinkSettings.ts`, `backlinkModel.ts`.
- Integración: `src/main.ts` (líneas 82-98, 109-125, ~160-185, 205-224, 236-243, 319-356, 421-437, 580-593, 750-875).
- Historia: commits `5d84174`, `33351fe`, `33621f4`, `495cfea`, `3a0b3de` (expansión bidireccional), `9f1ff61` (colapso de encabezado), `0dd4bbe` (árbol, pestañas, búsqueda jerárquica), `396fe22` (expansión inteligente de carpetas), `ef3b3e1` (fix recursión). Bitácoras: `docs/contexto-vault/historia/PGTD-Dovela-v1.0-retoma/RR - Sesiones de trabajo Dovela v1.0/Btx 260706 - Sesión 01...md` y `Sesión 02...md`.
