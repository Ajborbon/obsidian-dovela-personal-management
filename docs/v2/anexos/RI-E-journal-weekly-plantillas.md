# E. Ingeniería inversa: módulos JOURNAL y WEEKLY + plantillas del vault

Repo analizado: `/home/user/obsidian-dovela-personal-management` (plugin v1.0.0, id de plugin `obsidian-dovela-personal-management`).
Modo: solo lectura. Los vectores de prueba de la sección 8 se calcularon ejecutando la lógica real de código y plantillas con `moment@2.30.1` (+ locale `es`) en un directorio temporal del scratchpad, no en el repo.

---

## 0. Hallazgos clave (lo que más importa para la reescritura)

1. **Ruta real de la nota diaria.** El código usa `JournalPathHelper.getDailyNotePath()`, que se arma con 3 interruptores de `journalSettings` (por defecto año=sí, trimestre=sí, mes=no). Con los defaults genera `…/AI - Journals/2025/Q4/2025-10-24 viernes.md`. La regla del vault y la plantilla `Plt - Diaria.md` usan `…/AI - Journals/YYYY/MM/YYYY-MM-DD dddd.md` (sin Q). Para reproducir el vault real hay que configurar año=sí, trimestre=NO, mes=sí. Los defaults de código no coinciden con el vault.
2. **Bug de trimestre en rutas diarias.** `Math.ceil(month()/3)+1` usa `month()` base 0 y suma 1. Solo acierta en enero, abril, julio y octubre. Febrero y marzo dan Q2, mayo y junio Q3, agosto y septiembre Q4, noviembre y diciembre dan "Q5". Afecta a `getDailyNotePath` y a `ensureFolderStructure` de Journal. El Weekly y `getWeeklyLinkPath` sí calculan bien el trimestre (`Math.ceil((month()+1)/3)`).
3. **La nota Documentacion no dice `Q1/01/01.md`.** Dice `YYYY/MM` en la descripción, ejemplo `…/2025/Q4/10/2025-10-24 viernes.md` en la sección de configuración y `…/Journals/YYYY/Qq` para semanales en el prompt histórico. Ver 3.2 para la tabla comparativa.
4. **La plantilla invoca la API desde `datacorejsx`, no desde `dataviewjs`.** `Plt - Diaria.md` y `Plt - Semanal.md` usan un bloque ```` ```datacorejsx ```` que accede a `dc.app.plugins.plugins["obsidian-dovela-personal-management"]`. Los documentos históricos (Ax 251024) proponían `dataviewjs` y otro id de plugin; el real es el que está en `manifest.json`.
5. **El checkbox de las vistas Journal/Weekly NO completa tareas.** El handler `change` solo hace `console.log` (TODO). No hay escritura al vault.
6. **No hay refresco automático.** Cada render re-parsea todo el vault (`parseVault` lee con `cachedRead` todos los `.md` no excluidos). Se renderiza al abrir la nota; no hay suscripción a eventos. El `useEffect` de Datacore depende de la ruta del archivo (diaria) o de `weekCode/plugin/options` (semanal).
7. **Mapeo de prioridad inconsistente entre parser y renderer.** El parser mapea ⏫→Highest, 🔼→High, 🔽→Medium, ⏬→Low y **no reconoce 🔺**. Los renderers pintan Highest→🔺, High→⏫, Medium→🔼, Low→🔽. Resultado: un ⏫ escrito en la tarea se muestra como 🔺 en Journal/Weekly (símbolo desplazado un nivel). El orden de ordenamiento es consistente entre sí (Highest primero).
8. **Fragilidad de `moment().year(Y).isoWeek(W)`** (usado en rangos de semana de ambos renderers y en `WeeklyPathHelper`). Depende de la fecha actual: si hoy es 29–31 dic (semana ISO 1 del año siguiente), `moment().year(2025).isoWeek(43)` devuelve 2026-10-19 en vez de 2025-10-20. Verificado (sección 8). La forma correcta es `moment(\`${Y}-01-04\`).startOf('isoWeek').add(W-1,'weeks')` (o `isoWeekYear(Y).isoWeek(W)`).
9. **Las plantillas de periodos tienen bugs de borde de año ISO** (diaria: embed semanal con `YYYY` en vez de `GGGG`; semanal: enlace "siguiente" con `YYYY`; semanal: lógica de días con `+1` y `new Date("YYYY-MM-DD")` que solo es correcta en zonas UTC-X). Ver sección 6.
10. **Tipos de nota de journal en frontmatter vs parser.** Plantillas escriben `type: Dly | Wly | Mly | Qly | Yly`. El `FRONTMATTER_TYPE_MAP` del parser (`moduloGTDv3/parser.ts`) conoce `Dly, Wk, M, Q, H, Y`: solo `Dly` coincide. Wly/Mly/Qly/Yly caen al tipo por prefijo de nombre → `Ax`.
11. **Los módulos NO crean notas.** Journal/Weekly solo (a) renderizan tareas, (b) calculan rutas/enlaces y (c) validan/crean carpetas bajo demanda (`ensureFolderStructure`, que nadie invoca en el plugin). La creación de notas diarias/semanales/etc. la hace Templater con las plantillas (el usuario crea la nota con el nombre correcto y aplica la plantilla; la plantilla deduce todo del `tp.file.title`).

---

## 1. Fuentes leídas (completas)

- `src/modules/moduloJournal/{journalAPI,journalModel,journalPathHelper,journalTaskRenderer}.ts`
- `src/modules/moduloWeekly/{weeklyAPI,weeklyModel,weeklyPathHelper,weeklyTaskRenderer}.ts`
- Soporte: `src/modules/moduloGTDv3/{parser.ts (parseTasks/parseVault), model.ts (Task, JournalSettings, defaults), dateUtils.ts, settingsTab.ts (sección Journal)}`, `src/main.ts` (registro de APIs), `styles.css` (clases `.journal-*`, `.weekly-*`, `.daily-group*`).
- `Documentacion/Journal-Sistema-Tareas-Diarias.md`, `Documentacion/Weekly-Sistema-Tareas-Semanales.md`.
- `docs/contexto-vault/historia/PGTD-Dovela-v0.9/PGTD 251024 - …nota diaria/` (5 notas) y `…nota semanal/` (4 notas). El contenido técnico de los Ax "Documentación…" es esencialmente copia de `Documentacion/*.md` (el v1 de Journal no incluye pathHelper ni config; el v1.1 sí; Weekly v1.0 → v1.1 solo añade orden de vencidas por año/semana y completadas ordenadas; el Ax "Funcion para ser invocada…" contiene el prompt original y el patrón de acceso; el Ax "Incluir a la vista diaria las tareas…" es el prompt que pide el campo `[w::[[…]]]`).
- `docs/contexto-vault/reglas-vault/Ax 250607 - Estructura de subcarpetas…md` (11 líneas: define `00-Estructura/` para AV, `98-Archivo/`, `99-Adjuntos/`), `CLAUDE-vault.md`, `referencia-vault.md`.
- Las 22 plantillas: 17 en `plantillas/` + 5 en `plantillas/Journal/`.

---

## 2. Modelo de tarea que consumen Journal y Weekly

Lo produce `parseTasks` (parser.ts). Línea reconocida: `^\s*-\s+\[( |x|X|/)\]\s+(.*)`. Estados: ` `→incomplete, `x/X`→completed, `/`→in-progress. Otros caracteres (`-`, `>`…) **no** son tareas.

Extracciones sobre el texto de la tarea (cada una se elimina del `content`, salvo lo indicado):

| Campo | Regex | Notas |
|---|---|---|
| fecha principal + símbolo | `(🛫\|⏳\|📅)\s*(\d{4}-\d{2}-\d{2})` (primera ocurrencia) | `date`, `dateSymbol`; las demás van a `additionalDates` |
| id | `\s*(?:\^\|🆔)\s*([a-zA-Z0-9]+)` | si no hay: `crypto.randomUUID()` (cambia en cada parse) |
| hora inicio / fin | ` \[hI::\s*([^\]]+)\]`, ` \[hF::\s*([^\]]+)\]` | exigen espacio previo |
| duración | ` \[([0-9]+h\|[0-9]+min)\]` | |
| **semana** | `\s*\[(?:w\|W)\s*::\s*\[\[(?:.*?\|)?(\d{4}-W\d+)\]\]\s*\]` | `task.week` = código sin ruta (p. ej. `2025-W43`, `2025-W5`). Soporta `[w::[[ruta/2025-W43\|2025-W43]]]` y `[w::[[2025-W43]]]`. `\d+` admite 1–N dígitos |
| dependencias | `⛔\s*(\^?[a-zA-Z0-9]+)` | **sin** eliminar del content; el id puede incluir `^` |
| contextos / personas | `#cx-([\w-]+)`, `#px-([\w-]+)` | se eliminan del content |
| tags GTD | `#(GTD-AlgunDia\|GTD-EstaSemanaNo\|inbox)` | |
| prioridad | primer símbolo entre `⏫ 🔼 🔽 ⏬` | ⏫=Highest, 🔼=High, 🔽=Medium, ⏬=Low; ninguno=None; **🔺 no se reconoce** |
| fecha de cierre | no se extrae | `✅ YYYY-MM-DD` queda dentro de `task.content`; Journal/Weekly lo leen con `/✅\s*(\d{4}-\d{2}-\d{2})/` |

`parseVault`: recorre `vault.getMarkdownFiles()`, excluye la carpeta `03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/Plantillas` (prefijo) y cualquier ruta con un segmento `99 - Adjuntos`. Por tanto las tareas dentro de plantillas (p. ej. `- [ ] Crear la planeación del mes… #cx-PlanMensual`) no cuentan mientras estén en esa carpeta.

`displayStatus` **no** se calcula en este camino (solo `moduloFoco`), por eso las clases `task--today/future/…` nunca se aplican en Journal.

---

## 3. JOURNAL

### 3.1 Ajustes (`JournalSettings`, guardados en `data.json` bajo `journalSettings`)

| Campo | Default | Uso |
|---|---|---|
| `baseFolderPath` | `03 - Gestion Personal/AV - Gerente de Vida/AI - Journals` | raíz de journals |
| `yearSubfolder` | `true` | añade `/YYYY` |
| `quarterSubfolder` | `true` | añade `/Q{n}` |
| `monthSubfolder` | `false` | añade `/MM` |
| `weekFolderPattern` | `{YYYY}/Q{Q}` | solo para el enlace `[w::[[…]]]` (tokens `{YYYY} {Q} {MM} {WW}`, `String.replace` ⇒ solo la primera aparición de cada token) |

Nota: `loadPluginData` hace `Object.assign({}, DEFAULT_SETTINGS, data)` (superficial): si `data.json` tiene `journalSettings` parcial, faltan claves. La UI de ajustes (`settingsTab.renderJournalSettings`) edita estos 5 campos, valida la carpeta base con `journalAPI.validateJournalSettings()` y muestra una vista previa fija con el texto `2025-10-24 viernes.md` y `[w::[[…]]]`.

### 3.2 Rutas: `JournalPathHelper` (`journalPathHelper.ts`)

**Qué usa el código y qué hace cada función**

| Función | Firma | Resultado |
|---|---|---|
| `getDailyNotePath` | `(date: string \| Date): string` | `baseFolderPath` + `/${YYYY}` si year + `/Q${q}` si quarter + `/${MM}` si month + `/YYYY-MM-DD ${moment.format('dddd')}.md` |
| `getWeeklyLinkPath` | `(weekCode: string): string` | Regex NO anclada `/(\d{4})-W(\d{1,2})/`; lanza `Error('Formato de semana inválido: …')` si no calza. Calcula lunes de la semana con `jan4 = moment().year(Y).month(0).date(4)` → `startOf('isoWeek')` → `+ (W-1) semanas`; `quarter = ceil((month0+1)/3)` y `MM` del **lunes**; aplica `weekFolderPattern`; devuelve `${base}/${patrón}/${weekCode}` (sin `.md`). `weekCode` se conserva tal cual (no rellena a 2 dígitos) |
| `generateWeeklyLink` | `(weekCode): string` | `[w::[[${linkPath}\|${weekCode}]]]` |
| `validateBaseFolderPath` | `(vault): Promise<{valid:boolean; message?:string}>` | vacío → inválido; caracteres `< > : " \| ? *` → inválido; segmento existente que sea archivo → inválido; si no existe pero es creable → válido |
| `ensureFolderStructure` | `(vault, date?): Promise<void>` | crea base y subcarpetas año/Q/mes según toggles (con el bug de Q) vía `vault.createFolder` |
| `getPathPreview` | `(sampleDate?)` | `{dailyNotePath, weeklyLinkPath, weeklyLinkFull}`; arma `weekCode` con `date.year()` y `isoWeek()` (**no** `isoWeekYear`: error en bordes de año) |

Detalles que afectan al comportamiento:

- `dayName = moment.format('dddd')` **depende del locale global de moment**. El plugin nunca llama `moment.locale()`; usa el locale de Obsidian. Con Obsidian en español sale `viernes` (minúscula, que coincide con el vault); en inglés saldría `Friday` y no coincidiría. Las plantillas de Templater ejecutan `moment.locale('es')` sobre el `moment` global, con efecto secundario para toda la sesión.
- `getDailyNotePath('2025-02-15')` con defaults → `…/2025/Q2/2025-02-15 sábado.md` (Q2 incorrecto, ver hallazgo 2).

**Comparativa de patrones de ruta**

| Fuente | Patrón diaria | Patrón semanal |
|---|---|---|
| Código (defaults; sin bug sería) | `base/YYYY/Qn/YYYY-MM-DD dddd.md` | enlace: `base/YYYY/Qn/YYYY-Www` (patrón `{YYYY}/Q{Q}`); `WeeklyPathHelper.getWeeklyNotePath`: `base[/YYYY][/Qn][/MM]/YYYY-Www.md` |
| `Documentacion/Journal…` (descripción) | `…/AI - Journals/YYYY/MM` + `YYYY-MM-DD EEEE` | `…/2025/Q4/2025-W43` (ejemplo en "Formato Completo con Ruta") |
| `Documentacion/Journal…` (ejemplo config) | `…/2025/Q4/10/2025-10-24 viernes.md` ("✅ año ✅ trimestre ✅ mes") | patrón mostrado `{YYYY}/Q{Q}/{MM}` (no es el default del código) |
| Ax 251024 (prompt original) | `…/AI - Journals/YYYY/MM`, nombre `YYYY-MM-DD EEEE` | `…/AI - Journals/YYYY/Qq`, nombre `YYYY-Ww` (ejemplo con `2025/Q3/2025-W43`, trimestre manifiestamente erróneo para octubre) |
| `CLAUDE-vault.md` (regla del vault) | `YYYY-MM-DD nombre-día.md` en `AI - Journals/YYYY/MM/` | `YYYY-WNN.md` (sin carpeta indicada) |
| `Plt - Diaria.md` (código real) | enlaces prev/next: `03 - Gestion Personal/AV - Gerente de Vida/AI - Journals/${YYYY/MM}/${YYYY-MM-DD dddd}` ⇒ **YYYY/MM** | los enlaces a semanas son por nombre simple `[[2025-W33]]` |
| `Plt - Semanal.md` | enlaces a días por nombre simple `[[2025-08-12 martes\|12]]` | — |
| `Plt - Mensual/Trimestral/Anual` | — | enlaces por nombre simple: `[[2025-05]]`, `[[2025-Q2]]`, `[[2025]]` |

Conclusión: **el vault real usa `YYYY/MM/`** para diarias (settings equivalentes: year=true, quarter=false, month=true). Para semanales el código usa `YYYY/Qn/` y el vault no fija carpeta (los enlaces son por nombre único). Mensual/trimestral/anual: ubicación no definida en ninguna fuente (los wikilinks son por nombre).

### 3.3 API expuesta (`JournalAPI`, accesible como `plugin.journalAPI`)

Se crea en `main.ts onload()` (`this.journalAPI = new JournalAPI(this)`). Cada método reconstruye `JournalPathHelper` con los ajustes actuales.

| Método | Firma | Devuelve | Detalle |
|---|---|---|---|
| `renderTasksForDate` | `(targetDate: string, options: JournalRenderOptions = {}): Promise<HTMLElement>` | `<div class="journal-tasks-container dovela-journal">` con `innerHTML` = HTML del renderer + listeners | valida `^\d{4}-\d{2}-\d{2}$` y `new Date(s)` válido. **`new Date('2025-02-30')` es válido en V8 (rueda a marzo)**, así que `2025-02-30` pasa. En error: `<div class="journal-error">Error Journal: …</div>` con estilos inline (rojo) – no lanza |
| `getTaskCounts` | `(targetDate): Promise<{calendar, programmed, overdue, inProgress, blocked, completed}>` | conteos | genera todo el HTML y extrae los números con regex de los títulos (`⏰ Calendario del Día (n)`, `📅 Programadas para Hoy (n)`, `🔥 Vencidas a Hoy (n)`, `🔄 En Progreso (n)`, `⛔ Bloqueadas por Dependencias (n)`, `✅ Completadas Hoy (n)`). **No** incluye los grupos semanales. En error devuelve ceros |
| `getDailyNotePath` | `(targetDate: string): string` | ruta (ver 3.2) | lanza Error si la fecha es inválida |
| `generateWeeklyLink` | `(weekCode: string): string` | `[w::[[ruta\|código]]]` | |
| `ensureFolderStructure` | `(targetDate: string): Promise<void>` | – | |
| `validateJournalSettings` | `(): Promise<{valid:boolean; message?:string}>` | – | usado por la pestaña de ajustes |

`JournalRenderOptions` (`journalModel.ts`): `showOverdueLimit?`, `groupOverdueByWeek?`, `showOnlyCritical?`, `enableQuickActions?`. **Solo `showOverdueLimit` se usa** (`options.showOverdueLimit || 50`, y recorta solo "Vencidas a Hoy"); las otras tres están declaradas pero sin efecto, aunque la documentación las promete.

### 3.4 Cómo se invoca desde `Plt - Diaria.md`

Sección `# Tareas` de la plantilla: bloque ```` ```datacorejsx ```` con un componente `View()`:

```js
const current = dc.useCurrentFile();
// useEffect(…, [current?.$path]):
const gp = dc.app?.plugins?.plugins?.["obsidian-dovela-personal-management"];
if (!gp || !gp.journalAPI) → setTaskError("Plugin no disponible")
const fileName = current?.$name ?? "";
const targetDate = fileName.split(" ")[0];          // "2025-10-24 viernes" → "2025-10-24"
const node = await gp.journalAPI.renderTasksForDate(targetDate);   // sin options
// render: <h2>Tareas del día</h2> y un <div ref> que hace appendChild(node) si !el.hasChildNodes()
```

Debajo, en el mismo componente, un `dc.Table` "Notas apuntando a hoy" con backlinks calculados con `dc.useQuery("@page")` + `metadataCache.getFileCache(file).links` resueltos con `dc.resolvePath` (columnas File/Tipo/Estado/Ruta; ordena por `$ctime` desc). Esto es independiente del plugin.

Contrato implícito: el nombre del archivo **debe empezar por `YYYY-MM-DD`** seguido de espacio. No se usa `options` desde la plantilla. (Versión histórica propuesta en el Ax: `dataviewjs` con `dv.current().file.basename.split(' ')[0]` y `dv.container.appendChild`.)

### 3.5 Qué tareas incluye y cómo clasifica (`processTasksForDate`)

Entrada: todas las tareas del vault (`parseVault().allTasks`) y `targetDate`. Se evalúa cada tarea **en este orden, con `continue` al primer match**:

1. **Completada hoy**: `task.completed` y `✅ YYYY-MM-DD` en `content` == `targetDate` → `completedToday`. (Una completada sin `✅` no aparece en ningún lado.)
2. Si `task.completed` → se ignora.
3. **En progreso**: `status === 'in-progress'` (`- [/]`) → `inProgress`. Sin filtro de fecha ni de semana: **todas** las `[/]` del vault salen en **cualquier** nota diaria (pasada o futura). Se evalúa antes que cualquier otra regla.
4. **Semanal**: si `task.week` válido (`split('-W')`, `parseInt`):
   - la fecha objetivo cae en el rango lunes–domingo de esa semana (`isBetween(start,end,'day','[]')`) → `weeklyTasksThisWeek`;
   - si el domingo de esa semana es anterior a la fecha objetivo → `weeklyTasksOverdue`;
   - semana futura → no se muestra.
   - Siempre `continue`: una tarea con `[w::]` y fecha **no** aparece en las listas por fecha.
5. **Dependencias**: si `dependencies.length > 0` y alguna dependencia no existe o no está completada (`taskMap.get(depId)`; **sin quitar `^`**, a diferencia de GTD/Foco ⇒ `⛔ ^abc` siempre se considera bloqueada) → si `task.date` existe y `<= targetDate` → `blockedDependencies`; en cualquier caso `continue` (si no tiene fecha o es futura, desaparece). Si las dependencias ya están completas, la tarea sigue al paso 6.
6. **Fecha** (`dateSymbol` ∈ 📅 ⏳ 🛫):
   - misma fecha: con `startTime` → `calendarTasks`; sin → `programmedToday`;
   - fecha anterior → `overdueToday` (incluye 🛫 start vencidos y tareas con hora; Weekly en cambio excluye 🛫);
   - fecha posterior → no se muestra.

Tareas sin fecha ni semana, abiertas, no `[/]`: no aparecen.

**Ordenamientos** (`priorityOrder`: Highest0, High1, Medium2, Low3, None4; `taskTypeOrder`: 📅0, ⏳1, 🛫2):

| Grupo | Orden |
|---|---|
| calendario | `startTime` (`localeCompare` de la cadena, no numérico: `9:00` > `10:00`) → prioridad |
| programadas hoy | tipo de fecha → prioridad |
| vencidas, en progreso, bloqueadas | `date` ascendente (cadena) → tipo → prioridad |
| semanales de esta semana | prioridad |
| semanales vencidas | año → semana (numéricos) → prioridad |
| completadas | sin ordenar (orden de aparición en el vault) |

### 3.6 Render (`generateJournalHTML` / `generateGroupHTML` / `generateTaskHTML`)

Estructura:

```html
<div class="journal-container">
  <div class="journal-header"><h2>📋 Tareas del Día - {YYYY-MM-DD} {dddd}</h2></div>
  <div class="journal-content"> {grupos} </div>
</div>
```

Cada grupo es `<details class="journal-group [collapsible]" [open]><summary class="journal-group-header"><span class="group-title">título (n)</span></summary><div class="journal-group-content">…</div></details>`. Si no hay ningún grupo solo se ve el encabezado (no hay mensaje "sin tareas").

Orden y estado inicial de los grupos (solo se emite si tiene tareas):

| # | Título | Contenido | `open` por defecto |
|---|---|---|---|
| 1 | `⏰ Calendario del Día (n)` | fecha=hoy con `[hI::]` | sí |
| 2 | `📅⏳🛫 Programadas para Hoy (n)` | fecha=hoy sin hora | sí |
| 3 | `📊 Tareas para esta Semana (n)` | `[w::]` de la semana de la fecha | sí |
| 4 | `🔥📊 Tareas de Semanas Anteriores (n)` | `[w::]` de semanas pasadas; cada tarea con clase `task--overdue` y su `📊 semana` con `is-overdue` | sí (detecta el grupo por `title.includes('Semanas Anteriores')`) |
| 5 | `🔄 En Progreso (n)` | todas las `[/]` | sí |
| 6 | `🔥 Vencidas a Hoy (n)` | fecha < hoy; muestra solo las primeras `showOverdueLimit \|\| 50` aunque el título cuenta todas | **no** (colapsado) |
| 7 | `⛔ Bloqueadas por Dependencias (n)` | | sí |
| 8 | `✅ Completadas Hoy (n)` | | **no** (colapsado) |

Tarea individual:

```html
<div class="gtd-task journal-task[ task--{displayStatus}][ task--overdue]" data-task-path="{sourceFile.path}" data-task-line="{lineNumber}">
  <div class="gtd-task-content">
    <input type="checkbox" [checked] />
    [<span class="gtd-task-priority">{símbolo}</span>]       <!-- solo si priority != None -->
    <span class="task-text">{content procesado}</span>
  </div>
  [<div class="gtd-task-metadata"> duración, fecha, hI, hF, semana </div>]
</div>
```

Metadatos: `<span class="task-duration">[30min]</span>`, `<span class="task-date [is-overdue]">📅 2025-10-24</span>` (rojo si `isDatePast(date)` frente a **hoy real**, no frente a la fecha objetivo), `<span class="task-time">[hI:: 09:00]</span>`, `[hF:: …]`, `<span class="task-week [is-overdue]">📊 2025-W43</span>`. Los contextos `#cx-` y personas `#px-` **no** se muestran (el parser los quitó del content).

`processTaskContent`: `[[x]]` → `<a href="x" class="internal-link" data-link-path="x">x</a>` (con `[[ruta|alias]]` se enlaza y muestra `ruta|alias`: el alias no se interpreta); `⛔ id` → `⛔ id <span class="dependency-link" data-dependency-id="id-sin-^">🔗</span>`. **No escapa HTML** (el content se inyecta con `innerHTML`; Weekly sí escapa). El content conserva `✅ fecha` y `⛔ id` ya que el parser no los elimina.

### 3.7 Interacciones (`attachEventListeners` en `JournalAPI`)

Delegación en el contenedor:

- `click` en `.dependency-link` → `preventDefault`; vuelve a ejecutar `parseVault`, busca `task.id === dependencyId` y abre `sourceFile.path` en la pestaña actual con `eState:{line}`; si no la encuentra, `console.warn`. (Los ids generados con `randomUUID` no se pueden resolver; solo funcionan ids explícitos `^abc`/`🆔abc`.)
- `click` en `.internal-link` → `workspace.openLinkText(data-link-path, '', false)`.
- `click` en `.journal-task` (cualquier punto, incluido el checkbox) → `openLinkText(taskPath, '', false, {eState:{line}})`, es decir abre el archivo de la tarea en la misma pestaña y salta a la línea.
- `change` en checkbox → solo `console.log('Marcar tarea como completada:', path)`; no escribe. Efecto práctico: el checkbox se marca visualmente, abre además el archivo (por el click), y al refrescar vuelve a salir abierta.
- Los `<details>/<summary>` se pliegan nativamente.

### 3.8 Refresco y rendimiento

- No hay refresco reactivo. Se renderiza cuando Datacore monta el componente (abrir la nota, cambiar de archivo, recarga de vistas). Para ver cambios hay que reabrir/forzar render.
- Cada llamada a `renderTasksForDate` y `getTaskCounts` ejecuta `parseVault` completo (O(N notas) con lecturas de contenido; el vault tiene ~2.700–7.400 notas según los documentos). `handleDependencyLinkClick` vuelve a parsear.
- `getWeekDateRange` hace `console.log('[Journal Debug] …')` en cada llamada (ruido: una vez por tarea semanal × (isDateInWeek + isWeekOverdue)).
- Implementación del HTML con strings + `innerHTML`.

### 3.9 Defectos / divergencias documentadas (Journal)

1. Q incorrecto en rutas diarias (hallazgo 2).
2. `getWeekDateRange` con `moment().year(Y).isoWeek(W)` (hallazgo 8); la documentación afirma que usa el cálculo `jan4` (que sí es correcto), pero el código real no.
3. `isTaskBlockedByDependencies` no normaliza `^`.
4. Prioridad desplazada y 🔺 no parseado (hallazgo 7). La documentación dice "🔺 Highest … ⏬ None (mostrado como ⏬)"; en código `None` no se pinta.
5. Opciones `groupOverdueByWeek`, `showOnlyCritical`, `enableQuickActions` no implementadas.
6. Completar tarea no implementado.
7. Colapsado: la doc dice "Vencidas: colapsadas, Completadas: colapsadas, Bloqueadas: expandidas" ✔ coincide; el grupo "Semanas anteriores" está abierto.
8. `calendarTasks` ordena por cadena `startTime` (formatos `9:00`/`10:00`/`9am` rompen el orden; el parser acepta `HH:mm` y `h am/pm` para validar conflictos).
9. El header usa `dddd` del locale (ver 3.2).

---

## 4. WEEKLY

### 4.1 Rutas y etiquetas de semana

- Nota semanal: `YYYY-Www` (el código y la plantilla usan 2 dígitos al generar: `padStart(2,'0')`; la plantilla acepta `W\d{1,2}` al leer el título; el parser de tareas acepta `W\d+`).
- Etiqueta en la tarea: `[w::[[…/YYYY-Www|YYYY-Www]]]` o `[w::[[YYYY-Www]]]`, con `w` o `W`. `task.week` queda con el texto tal cual (por ejemplo `2025-W5` sin cero); los renderers comparan año/semana **numéricamente** (`split('-W')` + `parseInt`), no por cadena, pero **muestran** el texto original.
- Semana ISO (lunes–domingo). Año = año ISO.
- `WeeklyPathHelper.getWeeklyNotePath(weekCode)`: regex anclada `^(\d{4})-W(\d{1,2})$` (si no, `Error('Formato de semana inválido: …')`). `weekStart = moment().year(Y).isoWeek(W).startOf('isoWeek')` (frágil, hallazgo 8). Ruta = `base` + `/${Y}` si year + `/Q${ceil((mes_del_lunes+1)/3)}` si quarter + `/${MM del lunes}` si month + `/${weekCode}.md`. Observaciones: usa `year` del **código** (año ISO) pero trimestre/mes del **lunes** (p. ej. `2026-W01` → lunes 29-dic-2025 ⇒ `…/2026/Q4/2026-W01.md`); la plantilla Semanal usa el **jueves** para mes/trimestre. Con los defaults: `…/AI - Journals/2025/Q4/2025-W43.md`.
- Enlace de semana desde Journal: `journalAPI.generateWeeklyLink('2025-W43')` → `[w::[[03 - …/AI - Journals/2025/Q4/2025-W43|2025-W43]]]` (patrón `{YYYY}/Q{Q}`; sin `.md`).

### 4.2 API (`WeeklyAPI`, `plugin.weeklyAPI`)

| Método | Firma | Devuelve |
|---|---|---|
| `renderTasksForWeek` | `(weekCode: string, options: WeeklyRenderOptions = {}): Promise<HTMLElement>` | `<div class="weekly-tasks-container dovela-weekly">` (el renderer ya emite otro con la misma clase ⇒ contenedor duplicado anidado). Valida `^\d{4}-W\d{1,2}$` (acepta `W00`, `W99`). Error ⇒ `<div class="weekly-error">Error Weekly: …</div>` |
| `getTaskCounts` | `(weekCode): Promise<{weekly, monday…sunday, overdue, completed}>` | por regex de títulos y DOM temporal. `overdue` cuenta **solo** `🔥 Tareas Vencidas de Semanas Anteriores (n)`; la sección "Vencidas por Fecha" no se cuenta aunque la doc dice "Vencidas por fecha". Los días se cuentan buscando `Lunes|Martes|Miércoles|…` en `.daily-group-title` y contando `.weekly-task` |
| `getWeeklyNotePath` | `(weekCode): string` | ver 4.1 |
| `getWeekCodeFromDate` | `(date: 'YYYY-MM-DD'): string` | `${isoWeekYear}-W${isoWeek padStart 2}` (correcto en bordes). Lanza Error si formato inválido |
| `getCurrentWeekCode` | `(): string` | igual con `moment()` |
| `ensureFolderStructure` | `(weekCode): Promise<void>` | crea carpetas base/año/Q/mes |

`WeeklyRenderOptions`: `showOverdueLimit?` (recorta ambas listas de vencidas; **por defecto sin límite**, y añade `<div class="weekly-more-tasks">… y N tareas más</div>`), `showCompletedCollapsed?` (default `true`), `highlightToday?` (default `true`).

### 4.3 Invocación desde `Plt - Semanal.md`

Sección `### Tareas`, bloque ```` ```datacorejsx ````:

```js
const plugin = dc.app.plugins.plugins["obsidian-dovela-personal-management"];
const currentFile = dc.useCurrentFile();
const weekCode = useMemo(() => (currentFile?.$name ?? currentFile?.name ?? "").match(/\d{4}-W\d{1,2}/)?.[0] || plugin?.weeklyAPI?.getCurrentWeekCode?.() || null, …);
const options = { showOverdueLimit: 10, showCompletedCollapsed: true, highlightToday: true };
const element = await plugin.weeklyAPI.renderTasksForWeek(weekCode, options);
// efecto: container.innerHTML=""; container.appendChild(element)
```

Mensajes: "Cargando tareas semanales…", "Error: …".

### 4.4 Qué tareas incluye (`processTasksForWeek`)

Rango: `start = lunes`, `end = domingo 23:59:59.999` de la semana (`getWeekDateRange` con `moment().year(Y).isoWeek(W).startOf('isoWeek')`, ver fragilidad). Orden de evaluación:

1. **Completada en la semana**: `completed` y `✅ YYYY-MM-DD` dentro del rango → `completedThisWeek` (orden por fecha de cierre ascendente; comparando cadena).
2. Si `completed` → fuera.
3. **Tiene `[w::]`**: mismo año y semana → `weeklyTasks`; semana anterior (año menor, o mismo año y semana menor) → `overdueWeeklyTasks`; futura → fuera. Siempre `continue` (la fecha de la tarea se ignora).
4. **Tiene fecha** (no semana): dentro del rango → `dailyTasks[día ISO]` (cualquier símbolo, 📅 ⏳ 🛫); anterior al lunes y símbolo 📅 o ⏳ → `overdueByDate` (🛫 se excluye); posterior → fuera.
5. No distingue `[/]`; no mira dependencias (a diferencia de Journal). Tareas `[/]` solo aparecen si tienen fecha o semana.

Ordenamientos: semanales → prioridad; vencidas semanales → año, semana, prioridad; vencidas por fecha → fecha asc, tipo (📅<⏳), prioridad; por día → tipo (📅<⏳<🛫), prioridad; completadas → fecha de cierre.

### 4.5 Render (`generateWeeklyHTML`)

Orden: header → Tareas Semanales → Vencidas por Fecha → Tareas por Día → Vencidas de Semanas Anteriores → Completadas.

```html
<div class="weekly-tasks-container dovela-weekly">
  <div class="weekly-header"><h2>Semana {YYYY-Www}</h2>
    <p class="weekly-date-range">{D [de] MMMM} - {D [de] MMMM, YYYY}</p></div>   <!-- mes según locale moment -->
  <div class="weekly-group"><h3 class="weekly-group-title">📊 Tareas Semanales (n)</h3><div class="weekly-task-list">…</div></div>        <!-- si n>0 -->
  <div class="weekly-group weekly-group--overdue collapsible"><h3 …>🔥 Tareas Vencidas por Fecha (n)</h3>…</div>                        <!-- si n>0; tareas con weekly-task--overdue -->
  <div class="weekly-group"><h3 …>📅 Tareas por Día</h3>
     <div class="daily-group[ daily-group--today]"><h4 class="daily-group-title">Lunes 20[ 📍 Hoy]</h4><div class="daily-task-list">…</div></div> …</div>   <!-- solo días con tareas; "Hoy" si la fecha == moment() y highlightToday -->
  <div class="weekly-group weekly-group--overdue collapsible"><h3 …>🔥 Tareas Vencidas de Semanas Anteriores (n)</h3>…</div>             <!-- si n>0 -->
  <div class="weekly-group weekly-group--completed collapsible[ collapsed]"><h3 …>✅ Completadas esta Semana (n)</h3>…</div>             <!-- colapsado si showCompletedCollapsed (default true) -->
</div>
```

Nombres de día fijos en español (Lunes…Domingo). La sección "Tareas por Día" siempre emite su `<h3>` aunque no haya tareas.

Tarea:

```html
<div class="weekly-task[ weekly-task--overdue]" data-task-path="…" data-task-line="…">
  <input type="checkbox" class="task-checkbox [in-progress]" [checked si status==='completed'] />
  <span class="task-content">{content con HTML escapado}</span>
  <span class="task-metadata">
     [<span class="task-priority">🔺…</span>] [<span class="task-date [is-overdue]">📅 fecha</span>] [<span class="task-week [is-overdue]">📊 2025-W43</span>]
     [<span class="task-duration">[30min]</span>] [<span class="task-contexts">cx1 cx2</span>] [<span class="task-people">p1</span>]
  </span>
</div>
```

Diferencias respecto a Journal: sí muestra contextos y personas (sin el prefijo `#cx-`), muestra `date` sin `hI/hF`, escapa HTML, no procesa wikilinks (quedan como texto `[[…]]`).

### 4.6 Interacciones y refresco

- Click en `.weekly-task` → `openLinkText(taskPath, '', true, {eState:{line}})` ⇒ **nueva pestaña** (Journal abre en la misma).
- Click en `.weekly-group-title` de un `.weekly-group.collapsible` → alterna la clase `collapsed` (CSS oculta `.weekly-task-list`/`.daily-task-list`). Los grupos "vencidas" tienen `collapsible` pero **no** `collapsed` ⇒ abiertos por defecto (la doc dice "collapsible por defecto"; solo "Completadas" arranca colapsada).
- Checkbox: igual que Journal, solo `console.log`.
- Refresco: igual que Journal; nunca reactivo. `weekCode` sale del nombre del archivo, por lo que renombrar la nota cambia la vista.
- Sin `console.log` de depuración en Weekly (el comentario de la doc se refiere a Journal).

### 4.7 Defectos / divergencias (Weekly)

1. `moment().year().isoWeek()` frágil (hallazgo 8).
2. `getTaskCounts().overdue` no incluye "vencidas por fecha".
3. Doc dice "vencidas por fecha: collapsible por defecto"; en código quedan abiertas.
4. La API envuelve un contenedor que ya está envuelto (nesting duplicado).
5. Prioridad desplazada (hallazgo 7).
6. `isWeekOverdue` por (año, semana) numéricos; una etiqueta `2026-W53` en un año ISO de 52 semanas se comporta como 2027-W01 en el cálculo de fechas pero como "mayor" en la comparación numérica.
7. Weekly no excluye tareas bloqueadas por dependencias y no aplica `displayStatus`.

---

## 5. PLANTILLAS DEL VAULT

### 5.1 Mecánica común

- Todas son Templater (`<%* … %>` ejecuciones y `<% … %>` interpolaciones). Las de creación (Ax, Btx, Cmt, Podx, Prx, Tx, Vx, Ref, Sue, Reu, PGTD, AV, AI, RR, RC) se ejecutan sobre un archivo recién creado "Sin título" y lo **renombran/mueven** con `tp.file.rename` / `tp.file.move`, de modo que ejecutan efectos laterales (crear carpetas, insertar enlace en la nota origen, abrir la nota) además de emitir el contenido.
- Las de Journal (Diaria, Semanal, Mensual, Trimestral, Anual) **no preguntan nada y no mueven el archivo**: leen `tp.file.title` (el nombre con el que el usuario creó la nota) y calculan todo a partir de él. Validan el formato y, si no coincide, escriben un mensaje de error en el cuerpo.
- Cierres: `-%>` recorta el salto de línea posterior; `_%>` recorta todos los espacios en blanco posteriores. Este recorte hace que el archivo empiece exactamente con `---` del frontmatter (importante para el motor propio).
- Nomenclatura general: `Tipo YYMMDD - Descripción`, fecha en nombre `YYMMDD` (`tp.date.now("YYMMDD")`), fecha en YAML `YYYY-MM-DD`.
- Estado inicial siempre `estado: 🟢` (captura rápida: 🟡).
- Origen: se guarda en el hijo (`origen: "[[basename-padre]]"` en frontmatter, o `origen:: [[…]]` inline en Cmt) y en el padre se inserta un enlace al hijo (`[[título|título]]` o `[[ruta|título]]`).
- Bloques incrustados: `datacorejsx`, `base` (Obsidian Bases) y embeds `![[nota#encabezado]]`. **No hay ningún bloque `dataview` ni `dataviewjs` en las plantillas actuales** (solo en la documentación histórica).

### 5.2 Tabla resumen (una fila por plantilla)

| Plantilla | `type` | Nombre del archivo | Carpeta destino | Padre (origen / enlace) | Prompts |
|---|---|---|---|---|---|
| `Plt - Anotacion.md` | Ax | `Ax YYMMDD - {nombre}` | con nota activa: elegir "Misma carpeta de nota actual" o "Inbox - Creado desde Carpeta" (= donde se creó); sin nota activa: donde se creó | `origen: "[[basename activo]]"`; `cursor_append("[[título\|título]]")` si misma carpeta | prompt nombre; suggester destino |
| `Plt - Bitacora.md` | Btx | `Btx YYMMDD - Sesión {NN} - {desc≤50}` | siempre la carpeta de la nota activa (sin preguntar); sin nota activa: donde se creó | `origen`; `cursor_append("- [[título]] — YYYY-MM-DD \| desc\n")` | prompt nº sesión (def. "01"), prompt descripción |
| `Plt - Commit.md` | Cmt | `Cmt YYMMDD HHmm - {nombre}` (sanea `:`→`-`, quita `/\<>\|"?*`) | igual que Anotación (2 opciones) | `origen:: [[…]]` inline en el cuerpo; `cursor_append` | prompt nombre, prompt hash, suggester destino |
| `Plt - Podcast.md` | Podx | `Podx YYMMDD - {tema}` | igual que Anotación | `origen` | prompt tema, suggester |
| `Plt - Prompt.md` | Prx | `Prx YYMMDD - {para qué sirve}` | igual que Anotación | `origen` | prompt, suggester |
| `Plt - Transacción.md` | Tx | `Tx YYMMDD - {nombre}` | "Misma carpeta"/"Inbox" (solo si hay nota activa) | `origen` | prompt, suggester |
| `Plt - Video.md` | Vx | `Vx YYMMDD - {título}` | igual que Anotación | `origen` | prompt, suggester |
| `Plt - Reflexión.md` | Ref | A: `Ref YYMMDD - {nombre}`; B: `Ref YYMMDD-HHmm - Sin título` | A: misma carpeta/Inbox (si hay nota activa); B: fijo `00 - Inbox/` | `origen`; A+misma: `cursor_append` | suggester modo, prompt nombre (A), suggester destino |
| `Plt - Sueño.md` | Sue | A: `Sue YYMMDD - {título}`; B: `Sue YYMMDD-HHmm - Sueño sin título` | igual que Reflexión | `origen` | igual |
| `Plt - Reunión.md` | Reu | `Reu YYMMDD - {nombre}`; captura sin nombre: `Reu YYMMDD-HHmm - Sin título` | con nota activa: "Misma carpeta" / ("Inbox" si captura, "Dejar aquí" si no); sin nota activa: captura → `00 - Inbox/`, normal → donde se creó | `origen`; `cursor_append` | suggester modo, prompt nombre, hora inicio, hora fin, participantes, suggester destino |
| `Plt - PGTD Fecha.md` | PGTD | `PGTD YYMMDD - {nombre}` (o igual al nombre de carpeta si crea el principal) | lógica de carpetas (5.5) | `origen`; enlace `[[ruta\|título]]` insertado en la nota activa (`editor.replaceSelection`) | suggesters + prompt |
| `Plt - Area Vida.md` | AV | `AV - {nombre}` | 5.5 | igual | igual |
| `Plt - Area Interes.md` | AI | `AI - {nombre}` | 5.5 (+ confirmación si la carpeta no existe) | igual | igual |
| `Plt - Recurso Recurrente.md` | RR | `RR - {nombre}` | 5.5 | igual | igual |
| `Plt - Recurso Recurrente Transacciones.md` | RR | `RR - {nombre}` | 5.5 | igual | igual (base de Tx) |
| `Plt - Recurso Recurrente Bitacoras.md` | RR | fija: `RR - Sesiones de trabajo` | carpeta nueva `RR - Sesiones de trabajo/` dentro de la carpeta de la nota activa (o `tp.file.folder(true)`) | `origen`; `cursor_append("- [[ruta\|título]] — Repositorio de sesiones de trabajo del proyecto.\n")` | ninguno |
| `Plt - Registro Commits.md` | **RC** | `RC - {nombre}` | 5.5 (prefijo `RC - `) | igual | igual |
| `Journal/Plt - Diaria.md` | Dly | (lo define el usuario) `YYYY-MM-DD dddd` | no la mueve | prop. `semana`, `mes`, `trimestre` (wikilinks) | ninguno |
| `Journal/Plt - Semanal.md` | Wly | `YYYY-Www` | no la mueve | prop. `mes`, `trimestre` | ninguno |
| `Journal/Plt - Mensual.md` | Mly | `YYYY-MM` | no la mueve | prop. `trimestre`, `año` | ninguno |
| `Journal/Plt - Trimestral.md` | Qly | `YYYY-Qn` | no la mueve | prop. `año` | ninguno |
| `Journal/Plt - Anual.md` | Yly | `YYYY` | no la mueve | — | ninguno |

### 5.3 Frontmatter exacto y secciones (por plantilla)

Convención: valores en `<…>` son interpolaciones. Una propiedad vacía se escribe como `clave:` sin valor.

**Ax** (`Plt - Anotacion.md`)
```yaml
---
type: Ax
fecha: <YYYY-MM-DD>
estado: 🟢
origen: "[[<basename activo>]]"   # o ""  (cadena vacía entre comillas)
tags: 
---
```
Sin cuerpo.

**Btx** (`Plt - Bitacora.md`)
```yaml
---
type: Btx
fecha: <YYYY-MM-DD>
estado: 🟢
origen: "[[…]]"  # o ""
tags:
  - "#cx-SesionesTrabajo"
---
```
Cuerpo: `# <título>`; `## 1. Período y Participantes` (Fecha, Horario `HH:MM - HH:MM (UTC-5)`, Responsables `Andres Borbon & Asistente IA`); `## 2. Objetivo de la Sesión`; `## 3. Lo que se hizo (Hechos y Decisiones)`; `## 4. Hallazgos y Cambios de Arquitectura`; `## 5. Estado al cierre` (tabla Componente/Estado/Detalle); `## 6. Pendientes al cierre` (comentario: solo viñetas de texto, no checkboxes); `## 7. Punto de continuación` (cita `> **La próxima sesión arranca aquí:** …`).

**Cmt** (`Plt - Commit.md`)
```yaml
---
type: Cmt
commit: <hash>
branch: main
tagVersion: 
estado: 🟢
tags:
---

origen:: [[<activo>]]      # solo si hay nota activa
```

**Podx**: frontmatter como Ax con `type: Podx`; cuerpo `## Podcast`.
**Prx**: `type: Prx`, `estado: 🟢`, `origen`, `tags:` (sin `fecha`); sin cuerpo.
**Tx**: `type: Tx`, `estado: 🟢`, `tags: `, `monto: `, `moneda: COP`, `tipoTransaccion: Crédito`, `cuenta: Bancolombia Ahorros`, `origen`; cuerpo `# Soportes`.
**Vx**: `type: Vx`, `estado: 🟢`, `origen`, `destacado:`, `tags:`; cuerpo `Link: `, `## Resumen del video`, `## Secciones`.

**Ref** (v2.0)
```yaml
---
type: Ref
fecha: <YYYY-MM-DD>
fechaHora: <YYYY-MM-DD HH:mm>     # solo captura rápida (B)
origen: "[[…]]"                    # o ""
estado: 🟢                         # 🟡 en captura
rol_analisis: ""

tags:
---
```
Cuerpo A: `## Contexto`, `## Análisis`, `## Conclusiones`, `## Recursos`. Cuerpo B: cita `> 🎙️ **Captura rápida** — …/obsidian-procesar-reflexion`, `## Audios` (comentario con ejemplo `![[audio-reflexion-01.m4a]]`), `## Notas rápidas`, `---`, luego Contexto/Análisis/Conclusiones/Recursos, `---` y la tarea `- [ ] Transcribir y procesar esta reflexión #cx-procesarReflexion` (esta plantilla sí crea un checkbox: la regla del vault lo permite solo temporalmente en Inbox).

**Sue**: igual que Ref con `type: Sue`, `rol_analisis: "[[Rol Análisis - Intérprete de Sueños]]"`, `tags:\n  - suenos`. Cuerpo A: Recuerdo literal, Escenas, Emociones y cuerpo, Personajes/lugares/símbolos, Contexto de la víspera, Interpretación inicial, Patrones o conexiones, Conclusiones, Acciones o ritual de cierre. Cuerpo B: cita de captura, `## Audios`, `## Fragmentos rápidos`, `---` y `- [ ] Transcribir y procesar este sueño como reflexión #cx-procesarReflexion`.

**Reu**
```yaml
---
type: Reu
fecha: <YYYY-MM-DD>
hora_inicio: <HH:mm>
hora_fin: <HH:mm>
modalidad: virtual
participantes:
  - "<p1>"
  - "<p2>"             # o "  - " si no hay
origen: "[[…]]"         # o ""
estado: 🟢
tags:
---
```
Cuerpo normal: `## Objetivo`, `## Contexto`, `## Notas`, `## Decisiones`, `## Acuerdos`, `## Próximos pasos`, `## Recursos`. Cuerpo captura: cita + `## Audios`, `## Notas rápidas`, `---`, Objetivo/Contexto/Decisiones/Acuerdos/Próximos pasos/Recursos, `---` y `- [ ] Procesar esta reunión #cx-procesarReunion`. Participantes: se parte por coma, se recortan `[[ ]]` y `#`, y se escriben entre comillas dobles con `"` escapadas.

**PGTD** (`Plt - PGTD Fecha.md`)
```yaml
---
type: PGTD
estado: 🟢
fecha: <YYYY-MM-DD>
origen: "[[…]]"   # o ""
tags:
---
```
Cuerpo: `## Descripción`, `## Historial`, `## Recursos`, `## Tareas`, `## Tareas del proyecto` (datacorejsx), `## Estructura PGTD` con `### Proyectos GTD y RR` (base) y `### Contenido Completo` (base), línea `------`.

**AV** (`Plt - Area Vida.md`): `type: AV`, `estado: 🟢`, `origen`, `tags:`. Cuerpo: `## Descripción`, `## Historial`, `## Recursos`, `## Tareas`, `## Estructura AV` con `### AI` (base type=="AI"), `### AI, PGTD y RR` (base) y `### Contenido Completo` (base). Sin datacore.
**AI** (`Plt - Area Interes.md`): `type: AI`, mismo frontmatter; cuerpo igual salvo `## Estructura Áreas de Interés` → `### AI, Proyectos GTD y RR` + `### Contenido Completo`.
**RR** (`Plt - Recurso Recurrente.md`): `type: RR`, `estado`, `origen`, `tags:`; cuerpo `## Creados localmente`, `## Tareas` (datacorejsx), `## Estructura RR` con bases `### Proyectos GTD y RR` y `### Contenido Completo`.
**RR Transacciones**: igual a RR + `### Transacciones` (base `type == "Tx"` en carpeta; vista tabla con `estado, file.name, monto, moneda`, orden estado/nombre desc).
**RR Bitácoras**: frontmatter RR con `tags:\n  - "#cx-SesionesTrabajo"`; cuerpo `## Creados localmente`, `## Bitácoras de Sesión` (datacorejsx lista notas con `type: Btx` o nombre que empiece por `Btx ` / `Ax `, ordena por `fecha` desc, color según 🔵/🟢 y abre al hacer clic), `## Tareas` (datacorejsx simple con tareas abiertas `- [ ]`), `## Estructura RR` → `### Contenido Completo` (base "Sesiones de Trabajo" agrupada por `estado`).
**RC** (`Plt - Registro Commits.md`): `type: RC`, `estado: 🟢`, `tags:`; cuerpo `## Creados localmente`, `## Tareas`. Sin `origen` en frontmatter. (Encabezado del archivo copia "PLANTILLA DE CREACIÓN DE PROYECTOS GTD", pero crea RC.)

**Diaria (Dly)** – ver 5.6.
**Semanal/Mensual/Trimestral/Anual** – ver 5.6.

### 5.4 Bloques incrustados y qué consultan

| Plantilla | Tipo de bloque | Qué consulta / hace |
|---|---|---|
| Diaria | `base` "Reflexiones del día" | `type` ∈ {Ref, Sue}, filtro de vista `fecha == this.fecha`, agrupa por `file.folder`, lista numerada |
| Diaria | `datacorejsx` (View) | `plugin.journalAPI.renderTasksForDate(nombre.split(" ")[0])` + tabla de backlinks (ver 3.4) |
| Diaria | `base` "Reporte diario del Vault" | `subtipo == "reporte-diario"`, `fecha == this.fecha`, `file.inFolder("03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RR - Reportes Diarios del Vault")`; columnas notas_creadas, notas_modificadas, tareas_completadas, tareas_vencidas, tareas_cx_pendientes, total_tareas_abiertas, inbox_total, total_notas, backup_ok |
| Diaria | `base` "Notas creadas hoy" | `type != "Ref"` y vista con `fecha == this.fecha`; orden por `file.ctime` |
| Diaria | `base` "Notas modificadas hoy" | `type != "Ref"`, vista `file.mtime == this.fecha` |
| Diaria | embed | `![[{YYYY}-W{WW}#{fecha} Plan y registro actividades Bloques definidos para el {fecha}]]` (ancla al `#####` de la nota semanal) |
| Semanal | embed | `![[{YYYY-MM}#{semana} Propósitos principales Objetivos para W{n} - semana {iso} ({DD MMM} - {DD MMM})]]` (encabezado del mensual) |
| Semanal | `datacorejsx` | `weeklyAPI.renderTasksForWeek(código del nombre, {showOverdueLimit:10, showCompletedCollapsed:true, highlightToday:true})` |
| Semanal | `base` "Destacados de la semana" | `type == "Dly"`, `destacado` truthy, `semana == this`; fórmula `Dia: fecha.format("dddd")`; orden Dia, fecha, destacado |
| Semanal | embeds ×7 | `![[{fecha} {día}# Bitácora del día]]` bajo `### {Día}` |
| Semanal | `base` "Notas apuntando a esta semana" | `file.hasLink(this.file)`, `file.path != this.file.path`, agrupa por carpeta |
| Mensual | `base` "Destacados de las semanas" | `type == "Wly"`, `destacado`, `mes == this` |
| Mensual | `base` "Destacados diarios del mes" | `type == "Dly"`, `destacado`, `mes == this` |
| Mensual | embeds | `![[{AAAA-Qn}#{anclaObjetivos}]]` y por semana `![[{YYYY-Www}#Resumen de la semana]]` |
| Trimestral | embeds | `![[{YYYY}#{YYYY-Qn} Objetivos trimestrales Objetivos para el trimestre n del YYYY]]` y por mes `![[{YYYY-MM}#Resumen del mes]]` |
| Anual | embeds | por trimestre `![[{YYYY-Qn}#Resumen del trimestre]]` |
| PGTD | `datacorejsx` "Tareas del proyecto" | lista tareas `- [ ]` abiertas (`cache.listItems` con `task === " "`) de todos los `.md` bajo la carpeta de la nota; agrupa por subcarpeta y archivo; clic → abre archivo en la línea; vacío ⇒ "⚠️ Sin tareas abiertas … requiere revisión" |
| PGTD | `base` ×2 | tabla de PGTD y RR en la carpeta; tabla de todo el contenido de la carpeta agrupado por carpeta |
| AV | `base` ×3 | AI; AI+PGTD+RR; contenido (hay `formula.CarpetaFinal` en `order` sin fórmula definida) |
| AI | `base` ×2 | AI+PGTD+RR; contenido |
| RR | `datacorejsx` + `base` ×2 | tareas abiertas; PGTD+RR; contenido |
| RR Transacciones | `datacorejsx` + `base` ×3 | + base de `Tx` |
| RR Bitácoras | `datacorejsx` ×2 + `base` ×1 | lista de Btx; tareas; contenido |
| Reflexión/Sueño/Reunión captura | texto | cita + tarea `#cx-procesar…` |

Observación: los `base` de la nota Diaria usan `this.fecha`, pero el frontmatter de la plantilla Diaria **no define `fecha`** (solo `type, semana, mes, trimestre, estado, tags, destacado`). O esas propiedades se añaden por otro proceso (p. ej. el reporte diario o un script) o esas vistas quedan vacías: ambigüedad a resolver en la reescritura.

### 5.5 Reglas comunes de carpeta para PGTD / AV / AI / RR / RC

Aplica a `Plt - PGTD Fecha`, `Area Vida`, `Area Interes`, `Recurso Recurrente`, `… Transacciones`, `Registro Commits` (RR Bitácoras es un caso aparte, sin prompts).

1. **Contexto**: si hay `activeFile` y `activeView` (nota abierta): `currentFolderPath = activeFile.parent.path`, `currentFolder = activeFile.parent.name`. Si no (clic derecho en carpeta del explorador): `currentFolderPath = tp.file.folder(true)`, `currentFolder = tp.file.folder()` (en PGTD se queda con el último segmento del nombre).
2. **Inbox**: suggester `["No, usar carpeta actual","Sí, crear en Bandeja de Entrada"]` → si sí, `currentFolderPath = currentFolder = "00 - Inbox"`.
3. **Caso A – la carpeta actual ya es de ese tipo** (nombre empieza por `AV - ` / `AI - ` / `RR - ` / `RC - `; en PGTD: `PGTD - ` o `PGTD \d{6} - `):
   - comprueba si existe la nota índice `{currentFolderPath}/{currentFolder}.md` (patrón "nota de carpeta" donde archivo y carpeta se llaman igual);
   - si **no** existe, pregunta "¿Crear la nota principal de esta carpeta?" (sí ⇒ `finalTitle = currentFolder`, `finalPath = {ruta}/{currentFolder}`; en AI, si la carpeta tampoco existe, ofrece crearla o usar la carpeta padre);
   - si ya existe, o responde "no", crea un **sub-ítem**: pregunta "con carpeta" / "sin carpeta (solo archivo)", pide el nombre y pone el título con el prefijo: `AV - x`, `AI - x`, `RR - x`, `RC - x`, `PGTD YYMMDD - x`.
4. **Caso B – la carpeta actual no es del tipo** (por ejemplo Inbox o un grupo): pregunta "con carpeta"/"sin carpeta", pide nombre, título con prefijo.
5. **Crear carpeta**: "con carpeta" ⇒ `newFolderPath = {currentFolderPath}/{finalTitle}`; si `vault.adapter.exists(newFolderPath)` es falso ⇒ `vault.createFolder(newFolderPath)`; `finalPath = {newFolderPath}/{finalTitle}` (nota índice con el mismo nombre que la carpeta). "sin carpeta" ⇒ `finalPath = {currentFolderPath}/{finalTitle}`.
6. **Mover**: `tp.file.move(finalPath)` (sin `.md`; Templater lo añade). Nombre vacío ⇒ `Notice` + `throw` (cancela).
7. **Enlace al padre**: si hay nota activa, `activeView.editor.replaceSelection('[[finalPath|finalTitle]]')` y `Notice`.
8. **Abrir**: `workspace.getLeaf(true).openFile(fileObj)`.
9. **Ajuste especial RR Bitácoras**: siempre carpeta `RR - Sesiones de trabajo` en la carpeta de la nota activa, nota índice `RR - Sesiones de trabajo.md` dentro, enlace con `cursor_append`.

Convenciones del vault relacionadas (`Ax 250607`, `referencia-vault.md`): dentro de contenedores existen `00-Estructura/`, `98-Archivo/`, `99-Adjuntos/`; un RR es carpeta + nota índice homónima; PGTD permanente se llama `PGTD - Nombre`, PGTD fechado `PGTD YYMMDD - Nombre`.

Plantillas "simples" (Ax, Btx, Cmt, Podx, Prx, Tx, Vx, Ref, Sue, Reu): no crean carpeta. Si hay nota activa y se elige "Misma carpeta" ⇒ `rename` + `move({carpeta de la nota activa}/{título})` + `cursor_append` del enlace; si se elige "Inbox/Dejar aquí" ⇒ solo `rename` (queda en la carpeta donde Templater creó el archivo). La captura rápida de Ref/Sue (y de Reu sin nota activa) fuerza `00 - Inbox/`.

### 5.6 Plantillas de Journal: frontmatter, secciones y cálculo de fechas/enlaces

Todas empiezan con `moment.locale('es')`.

**Diaria** (`tp.file.title` = `2025-08-12 martes` o `2025-08-12`; extrae `\d{4}-\d{2}-\d{2}`)
- `fecha = moment(m[0], "YYYY-MM-DD")`.
- `semanaId = {isoWeekYear}-W{isoWeek:2}` (ISO correcto), `mesId = YYYY-MM`, `trimestreId = {año calendario}-Q{ceil((mes+1)/3)}`.
- Frontmatter: `type: Dly`, `semana: "[[2025-W33]]"`, `mes: "[[2025-08]]"`, `trimestre: "[[2025-Q3]]"`, `estado: 🟢`, `tags:`, `destacado:`.
- Navegación: `[[03 - Gestion Personal/AV - Gerente de Vida/AI - Journals/{YYYY/MM del día anterior}/{YYYY-MM-DD dddd anterior}|⬅️ {anterior}]] | **📅 {hoy}** | [[…{siguiente}|{siguiente} ➡️]]`. Hardcodea la ruta base y el esquema `YYYY/MM` (no lee los ajustes del plugin). Calcula el mes del día anterior/siguiente (cruce de mes/año correcto).
- Secciones: `# Planeación del día` → `## Plan sugerido en revisión semanal` (embed del plan semanal), `## Planeación del día por bloques`; `# Pensamientos y sueños del día` (base); `# Bitácora del día` → `## Borrador`; `# Tareas` (datacorejsx); `# Reporte diario del Vault` (base); `# Notas creadas hoy` (base); `# Notas modificadas hoy` (base).
- Embed semanal: `moment(fecha).format("YYYY-[W]WW")` usa **año calendario** (bug: 2025-12-29 ⇒ `2025-W01`, pero la nota existente es `2026-W01`; 2027-01-01 ⇒ `2027-W53` en vez de `2026-W53`). Debería ser `GGGG-[W]WW`.
- Heading destino del embed: `#####  [[{fecha} {día}#Plan y registro actividades|Bloques definidos para el {fecha} {día}]]` en la nota semanal. Obsidian normaliza el texto del encabezado con enlace a `"{fecha} {día} Plan y registro actividades Bloques definidos para el {fecha} {día}"`, que es exactamente el ancla usada. Se cumple solo si ambos textos son idénticos (incluidos acentos del día).

**Semanal** (`tp.file.title` debe calzar `^(\d{4})-W(\d{1,2})$`)
- `año` = año ISO del nombre; `semanaAnio`.
- `fechaDeLaSemana = moment().isoWeekYear(año).isoWeek(semanaAnio).startOf('isoWeek')` (más robusto que los renderers, pero igualmente relativo a "hoy" en los bordes).
- `juevesSemana = lunes + 3d` decide `mesId = YYYY-MM` y `trimestreId = {año del jueves}-Q{n}` del **frontmatter**.
- Título: `# W{n} Q{q} - {NombreMes} {año}`, con `q` por rango de número de semana (1–13, 14–26, 27–39, 40+), `n = semanaAnio - isoWeek(1er día del trimestre) + 1` (mín. 1) y `NombreMes` del **lunes** con el año ISO (p. ej. `2026-W01` ⇒ `W1 Q1 - Diciembre 2026`; `2025-W40` ⇒ `W1 Q4 - Septiembre 2025`).
- Frontmatter: `type: Wly`, `estado: 🟢`, `mes: "[[YYYY-MM]]"`, `trimestre: "[[YYYY-Qn]]"`, `destacado:`, `tags:`.
- `## Links`: `[[prev]] / [[next]]` calculado con `moment(nombre,"YYYY-[W]WW")` ±1 semana y formateado `YYYY-[W]WW` (bug en año ISO: `2025-W52` ⇒ siguiente `2025-W01` en vez de `2026-W01`; `2024-W52` ⇒ `2024-W01`). Luego una línea con 7 enlaces ` L [[2025-08-11 lunes|11]]  ﹒M …`. **El cálculo suma `i+1` días a `new Date("YYYY-MM-DD")`**: `new Date("YYYY-MM-DD")` es medianoche UTC y `getDate()` usa la hora local, de modo que en zonas UTC−X (Colombia UTC−5) cae el día anterior y el `+1` lo compensa. En UTC o UTC+X sale desplazado un día (martes…lunes siguiente). El `dayName` usa `toLocaleDateString('es-ES',{weekday:'long'})` (minúscula).
- `## Objetivos semanales planteados en la revisión mensual`: embed `![[{YYYY-MM jueves}#{YYYY-Www} Propósitos principales Objetivos para W{semanaEnTrimestre} - semana {iso} ({DD MMM} - {DD MMM})]]`, con `semanaEnTrimestre = numSemana - isoWeek(1er día del trimestre del jueves) + 1` (+52 si <1).
- `## Iniciando semana` → `### ¿Cuál es mi plan para esta semana?` → `#### Propósitos principales.`, `#### ¿Cuál es mi inspiración de esta semana?`, `#### Semanario`, `#### Tareas para adelantar, reubicar o acumular` (texto guía + tabla de 6 columnas con una fila "Por definir … No" + `**Registro de ajustes durante la semana:**`), `#### Bloques por día` (7 encabezados `##### [[{fecha} {día}#Plan y registro actividades|Bloques definidos para el {fecha} {día}]]`), `### Tareas` (datacorejsx).
- `---` `## Finalizando semana` → `### Resumen de la semana` (`#### Resumen narrativo`, `#### Resumen por temas`), `### Conclusion de la semana?`; `## Alineación de rituales` (secciones 1–5 con campos de texto, `### Ajuste para la próxima semana`); `## Anotaciones diarias de esta semana` (base de destacados + `### {Día}` con embed `![[{fecha} {día}# Bitácora del día]]`); `## Notas apuntando a esta semana` (base).

**Mensual** (`tp.file.title` = `YYYY-MM`)
- Frontmatter: `type: Mly`, `mes: 2025-05` (texto plano sin enlace), `estado: 🟢`, `trimestre: "[[2025-Q2]]"`, `año: "[[2025]]"`, `destacado:`, `journal: Mensual`.
- Título `# Mayo del 2025`; `## Links`: `[[2025-04|Abril del 2025]] / [[2025-06|Junio del 2025]]`.
- Semanas del mes: itera lunes desde el lunes de la semana que contiene el día 1 hasta el último día; incluye toda semana ISO que **toque** el mes (por solape, no por jueves). Código `{isoWeekYear}-W{isoWeek:2}`; etiqueta `semanaEnTrimestre = cursor.diff(lunes de la semana del 1er día del trimestre, 'weeks') + 1`. Salidas: `Semana NN: [[YYYY-Www]]`; `##### [[YYYY-Www#Propósitos principales|Objetivos para W{n} - semana {iso} ({DD MMM} - {DD MMM})]]`; `#### [[YYYY-Www]]` + `![[YYYY-Www#Resumen de la semana]]`.
- Ancla al trimestre: `![[2025-Q2#2025-05 Objetivos mensuales Objetivos para mayo del 2025]]`.
- Secciones: `## Links`, `## Semanas del Mes`, `## Objetivos del mes planteados en la revisión trimestral`, `## Iniciando Mes` (`### ¿Cuál es mi plan para este mes?`, `### ¿Cuál es mi inspiración para este mes?`), `## Planeación por semanas`, `---`, `## Finalizando Mes` (conclusiones, `### Resumen del mes`), `## Veredicto de herramientas` (enlace a `RR - Herramientas de interiorización`), `## Contenido semanal de este mes` (base de Wly destacados, embeds), `## Destacados diarios del mes` (base Dly), `# **Fin**` y dos tareas: `- [ ] Crear la planeación del mes {YYYY-MM} #cx-PlanMensual` y `- [ ] Escribir las conclusiones y hacer el cierre del mes {YYYY-MM} #cx-CierreMensual`.

**Trimestral** (`YYYY-Qn`, regex `^(\d{4})-Q([1-4])$` insensible a mayúsculas)
- Frontmatter: `type: Qly`, `año: "[[2025]]"`, `estado: 🟢`, `destacado:`, `journal: Trimestral`.
- `# Revisión Trimestral 2025-Q2`; prev/next con salto de año (`Q1` prev → `{y-1}-Q4`).
- `## Meses del Trimestre`: `- Abril: [[2025-04]]` …
- `## Semanas del Trimestre`: 13 semanas desde el lunes de la semana que contiene el 1er día del trimestre; cada semana se asigna a un mes por su **jueves** y solo se incluye si el jueves está dentro del trimestre; formato jerárquico con tabulador. Enumeración `Semana 01…13` por posición `i+1` (en trimestres donde el primer lunes cae antes y su jueves queda fuera, la semana 01 se omite y el listado empieza en 02: p. ej. 2027-Q1).
- `## Objetivos del trimestre planteados en la revisión anual` ⇒ `![[2025#2025-Q2 Objetivos trimestrales Objetivos para el trimestre 2 del 2025]]`.
- Secciones numeradas: 1 Revisión General, 2 Revisión por Áreas de Vida, "3. Veredicto de herramientas", `## Planeación por meses` (`### [[2025-04#Objetivos mensuales|Objetivos para abril del 2025]]`…), "3. Estado de Proyectos" (numeración repetida), 4 Objetivos, 5 Análisis de Tiempo y Productividad, 6 Metas, 7 Reflexión, `## Resumen del trimestre`, `## Anotaciones Mensuales de este Trimestre` (`### [[YYYY-MM]]` + `![[YYYY-MM#Resumen del mes]]`), `# Fin`.

**Anual** (`YYYY`)
- Frontmatter: `type: Yly`, `estado: 🟢`, `journal: Anual` (sin `destacado` ni `tags`).
- `# Visión Anual 2025`; `## Links`: `[[2024]] / [[2026]]`; `## Trimestres del Año` (`- [[2025-Q1]]`…); `## Meses del Año` (`- Enero: [[2025-01]]`…); `# Revisión Anual 2025` con 1 Revisión General, `## Planeación por trimestres` (`### [[2025-Q1#Objetivos trimestrales|Objetivos para el trimestre 1 del 2025]]`…), `## Resumen de Trimestres` (embeds `![[2025-Qn#Resumen del trimestre]]`), 2 Áreas de vida, 3 Proyectos, 4 Resumen financiero, 5 Hábitos y rutinas, 6 Metas, 7 Palabra o tema; `# Fin`.

**Cascada de enlaces/embeds entre periodos** (clave para un motor propio):

- Hacia abajo (objetivos): Anual publica `### [[YYYY-Qn#Objetivos trimestrales|Objetivos para el trimestre n del YYYY]]` → Trimestral los embebe con ancla `"YYYY-Qn Objetivos trimestrales Objetivos para el trimestre n del YYYY"` → Trimestral publica `### [[YYYY-MM#Objetivos mensuales|Objetivos para {mes} del YYYY]]` → Mensual los embebe → Mensual publica `##### [[YYYY-Www#Propósitos principales|Objetivos para W.. - semana .. (..)]]` → Semanal los embebe (desde el mes del jueves) → Semanal publica `##### [[fecha día#Plan y registro actividades|Bloques definidos para el fecha día]]` → Diaria lo embebe.
- Hacia arriba (resúmenes): Anual embebe `#Resumen del trimestre`; Trimestral `#Resumen del mes`; Mensual `#Resumen de la semana`; Semanal embebe `# Bitácora del día` de cada diaria.
- Frontmatter hacia arriba: Dly→(semana, mes, trimestre); Wly→(mes, trimestre; por jueves); Mly→(trimestre, año); Qly→(año). Los `base` filtran con `semana == this`, `mes == this`.
- Pares prev/next por nombre simple (Semanal/Mensual/Trimestral/Anual) y por ruta completa (Diaria).

### 5.7 Tabla resumen de variables/funciones de Templater realmente usadas

Para diseñar un motor propio compatible (frecuencia = apariciones en las 22 plantillas).

| API | Uso real | Frec. | Semántica requerida |
|---|---|---|---|
| `tR += …` | acumula salida desde bloques `<%* %>` | 15 | texto añadido al resultado |
| `<% expr %>` | interpolación | muchas | valor de expresión JS |
| `<%* … %>`, `-%>`, `_%>` | ejecución y control de espacios | todas | `-%>` recorta 1 salto de línea; `_%>` recorta todo whitespace posterior |
| `tp.file.title` | nombre actual sin extensión (Journal) | 5 | lectura |
| `tp.file.path()` | solo en Diaria (variable `hoyRuta`, no se usa) | 1 | ruta absoluta; descartable |
| `tp.file.folder(absolute?)` | `folder(true)` = ruta, `folder()` = nombre | 16 | carpeta donde se creó el archivo |
| `tp.file.rename(nuevo)` | renombra sin mover | 33 | |
| `tp.file.move(ruta_sin_ext)` | mueve/renombra; añade `.md` | 21 | no crea carpetas faltantes (por eso las plantillas llaman `createFolder` antes) |
| `tp.file.cursor_append(texto)` | inserta enlace a la nota nueva en la nota activa | 11 | comportamiento exacto depende de qué editor está activo; la intención es "enlazar el hijo en el padre" |
| `tp.config.active_file` | nota activa al invocar: `.basename`, `.path`, `.parent.path`, `.parent.name` | 24 | puede ser null |
| `tp.date.now(fmt)` | formatos usados: `YYMMDD`, `YYYY-MM-DD`, `HHmm`, `HH:mm`, `YYMMDD-HHmm`, `YYYY-MM-DD HH:mm` | 29 | moment, hora local |
| `tp.system.prompt(texto, valorDef, throwOnCancel=true)` | siempre con 3er argumento `true` (cancelar lanza error) | 27 | |
| `tp.system.suggester(etiquetas, valores, throwOnCancel=true, placeholder)` | | 37 | |
| `tp.app.vault.getAbstractFileByPath` | existencia de nota índice / abrir nota | 23 (+5 sin `tp.`) | |
| `tp.app.vault.createFolder` | crear carpeta | 14 | |
| `tp.app.vault.adapter.exists` | | 14 | |
| `tp.app.workspace.getLeaf(true).openFile(f)` | abrir en nueva pestaña | 17 (+4) | |
| `tp.app.workspace.getActiveViewOfType(tp.obsidian.MarkdownView)` + `.editor.replaceSelection(txt)` | insertar enlace en el padre | 6 | |
| `moment` global (+ `moment.locale('es')`) | cálculo de fechas | 5 | formatos `dddd`, `MMMM`, `MMM` (con punto en `es`: `ago.`), `YYYY-[W]WW`, `isoWeek`, `isoWeekYear`, `startOf('isoWeek')`, `diff(…,'weeks')`, `isSameOrBefore` |
| `new Notice(msg)` | avisos | 55 | |
| `throw new Error(…)` | cancelar | muchas | |
| JS nativo: `Date`, `toLocaleDateString('es-ES',{weekday:'long'})`, `String.prototype.*`, regex | Semanal | – | |

**No se usa**: `tp.user.*`, `tp.web.*`, `tp.frontmatter.*`, `tp.hooks.*`, `tp.file.include/create_new/exists/find_tfile/tags`, `tp.date.tomorrow/yesterday/weekday`, `tp.system.clipboard`, ni el modo `trigger_on_file_creation` explícito (la configuración de Templater no está en el repo).

---

## 6. Resumen de cómo se calculan fechas y enlaces entre periodos (referencia rápida)

| Cálculo | Fórmula en la plantilla |
|---|---|
| Semana de un día (id) | `{isoWeekYear}-W{isoWeek:2}` (Diaria frontmatter) — **pero** el embed usa `format("YYYY-[W]WW")` |
| Mes de un día | `format('YYYY-MM')` |
| Trimestre de un día | `{año calendario}-Q{ceil((mes0+1)/3)}` |
| Lunes de una semana | `moment().isoWeekYear(Y).isoWeek(W).startOf('isoWeek')` (Semanal) / `moment().year(Y).isoWeek(W)` (Semanal, bloque de embed) |
| Mes/trimestre de una semana | jueves de la semana (frontmatter Wly; trimestre del jueves; embed hacia el mensual) |
| Título de semana | trimestre por rango de nº de semana, mes del **lunes**, año ISO |
| Semana dentro del trimestre | Semanal: `W - isoWeek(1er día trimestre) + 1 (+52 si <1)`. Mensual: `diff(lunes(1er día trimestre), cursor, 'weeks') + 1`. Trimestral: índice 0..12 desde el mismo lunes |
| Semanas de un mes | Mensual: todas las ISO que solapan el mes. Trimestral: por jueves dentro del trimestre |
| prev/next de día | `±1 día`, ruta con `YYYY/MM` del día vecino |
| prev/next de semana | `moment(nombre,"YYYY-[W]WW") ± 1 semana` formateado `YYYY-[W]WW` (bug año ISO) |
| prev/next de mes | `±1 mes`, alias `MMMM [del] YYYY` capitalizado |
| prev/next de trimestre | aritmética de (año,q) con salto |
| prev/next de año | ±1 |

---

## 7. Fragilidades de borde que el motor propio debe tratar explícitamente

1. Año ISO ≠ año calendario (29–31 dic y 1–3 ene): usar `GGGG`/`isoWeekYear` en cualquier id de semana. Casos reales en 2024-12-30, 2025-12-29, 2027-01-01.
2. `moment().year(Y).isoWeek(W)` depende de hoy ⇒ usar `Jan 4` o `isoWeekYear().isoWeek()` desde una fecha ancla fija.
3. Año con 53 semanas (2020, 2026): `W53` válida; en años de 52 semanas `W53` rueda a la W01 del año siguiente.
4. Zona horaria: nunca construir fechas con `new Date('YYYY-MM-DD')` (UTC) y leerlas en local.
5. Locale: `dddd`, `MMMM`, `MMM` dependen del locale; las plantillas usan `es` y los anclas de encabezados dependen de coincidencia exacta de texto (incluidos puntos de `MMM`: `ago.`).
6. Una semana "pertenece" a distinto mes según la regla (jueves para frontmatter Wly; solape para listados mensuales): decidir una regla única y documentar migración.
7. Nombres de semana con 1 dígito (`2025-W5`) en tareas vs `2025-W05` en notas.

---

## 8. Casos de prueba sugeridos (lógica pura)

Todos los valores marcados (V) fueron **calculados ejecutando el código/plantilla real** con moment 2.30.1; los demás se deducen del código.

### 8.1 Rutas

| # | Entrada | Esperado |
|---|---|---|
| R1 (V) | `getDailyNotePath('2025-10-24')`, defaults (año, Q, sin mes), locale `es` | `03 - Gestion Personal/AV - Gerente de Vida/AI - Journals/2025/Q4/2025-10-24 viernes.md` |
| R2 (V) | mismos defaults, fechas `2025-01-15 … 2025-12-15` | Q del código: ene1, feb2, mar2, abr2, may3, jun3, jul3, ago4, sep4, oct4, nov5, dic5 (el motor nuevo debe dar 1,1,1,2,2,2,3,3,3,4,4,4) |
| R3 | año=sí, Q=no, mes=sí (vault real) | `…/AI - Journals/2025/10/2025-10-24 viernes.md` |
| R4 | todos los toggles en false | `…/AI - Journals/2025-10-24 viernes.md` |
| R5 | locale `en` | `Friday` (el nombre de archivo cambia ⇒ decidir locale fijo `es`) |
| R6 (V) | `getWeeklyLinkPath('2025-W43')`, `{YYYY}/Q{Q}` | `…/AI - Journals/2025/Q4/2025-W43` |
| R7 (V) | `getWeeklyLinkPath('2025-W5')` | lunes 2025-01-27 ⇒ `…/2025/Q1/2025-W5` (no rellena el cero) |
| R8 (V) | `getWeeklyLinkPath('2026-W01')` | lunes 2025-12-29 ⇒ `…/2026/Q4/2026-W01` (año del código, trimestre del lunes) |
| R9 | `getWeeklyLinkPath('foo')` | lanza `Formato de semana inválido: foo` |
| R10 | patrón con tokens repetidos `{YYYY}/{YYYY}` | solo se reemplaza el primer `{YYYY}` (comportamiento actual) |
| R11 | `generateWeeklyLink('2025-W43')` | `[w::[[…/2025/Q4/2025-W43\|2025-W43]]]` |
| R12 | `getWeeklyNotePath('2025-W43')` defaults | `…/AI - Journals/2025/Q4/2025-W43.md` |
| R13 | `validateBaseFolderPath` con `""`, `a:b`, `a/b` donde `a` es archivo | inválido (vacía), inválido (caracteres), inválido (es un archivo) |
| R14 | `isValidDateFormat('2025-02-30')` | actual: válido (V8 rueda a 2 de marzo); el motor nuevo debería rechazarlo |
| R15 | `isValidWeekCode('2025-W99')`, `'2025-W0'` | actual: válidos; el motor nuevo debería exigir 1–52/53 |

### 8.2 Semanas ISO

| # | Entrada | Esperado |
|---|---|---|
| W1 (V) | lunes de `2025-W43` | `2025-10-20`; domingo `2025-10-26` |
| W2 (V) | lunes de `2025-W05` | `2025-01-27` (coincide con el Ax: lunes 27-ene → domingo 2-feb) |
| W3 (V) | lunes de `2025-W01` | `2024-12-30` |
| W4 (V) | lunes de `2026-W01` | `2025-12-29` |
| W5 (V) | lunes de `2026-W53` | `2026-12-28` (2026 tiene 53 semanas) |
| W6 (V) | lunes de `2020-W53` | `2020-12-28` |
| W7 (V) | `getWeekCodeFromDate` de `2025-12-29` | `2026-W01` |
| W8 (V) | `getWeekCodeFromDate` de `2027-01-01` | `2026-W53` |
| W9 (V) | `getWeekCodeFromDate` de `2024-12-30` | `2025-W01` |
| W10 (V) | **fragilidad**: fingiendo hoy = 2025-12-29/31 o 2024-12-30, `moment().year(2025).isoWeek(43).startOf('isoWeek')` | `2026-10-19` (incorrecto); con hoy = 2025-12-28 o 2026-01-01 ⇒ `2025-10-20`. El motor nuevo debe ser independiente de "hoy" |
| W11 (V) | `moment().year(2025).isoWeek(1)` con hoy = 2025-12-29 | `2025-12-29` (incorrecto; esperado `2024-12-30`) |
| W12 | comparar semanas: `(2025,52) < (2026,1)`, `(2025,5) < (2025,27) < (2025,42)` numéricamente | y `2025-W5` vs `2025-W05` equivalentes |
| W13 (V) | prev/next de plantilla Semanal | `2025-W52` ⇒ `2025-W01` (bug); `2024-W52` ⇒ `2024-W01` (bug); `2026-W53` ⇒ `2027-W01`; `2026-W01` ⇒ prev `2025-W52`. Esperado correcto: `2026-W01`, `2025-W01`, `2027-W01` |

### 8.3 Plantillas Journal (vectores)

| # | Entrada | Esperado (V) |
|---|---|---|
| T1 | Diaria `2025-08-12 martes` | semana `[[2025-W33]]`, mes `[[2025-08]]`, trimestre `[[2025-Q3]]`; prev `2025/08/2025-08-11 lunes`; next `2025/08/2025-08-13 miércoles` |
| T2 | Diaria `2025-12-29 lunes` | semana `[[2026-W01]]`, mes `[[2025-12]]`, trimestre `[[2025-Q4]]`; embed semanal actual `2025-W01` (bug; correcto `2026-W01`) |
| T3 | Diaria `2027-01-01 viernes` | semana `[[2026-W53]]`, mes `[[2027-01]]`, trimestre `[[2027-Q1]]`; prev `2026/12/2026-12-31 jueves`; embed actual `2027-W53` (bug) |
| T4 | Semanal `2025-W33` | título `W7 Q3 - Agosto 2025`; mes `2025-08`, trimestre `2025-Q3`; embed `![[2025-08#2025-W33 Propósitos principales Objetivos para W7 - semana 33 (11 ago. - 17 ago.)]]`; prev `2025-W32`, next `2025-W34`; días lunes 11…domingo 17 |
| T5 | Semanal `2025-W40` | título `W1 Q4 - Septiembre 2025`; mes `2025-10`, trimestre `2025-Q4`; embed a `2025-10#… W1 - semana 40 (29 sep. - 05 oct.)` |
| T6 | Semanal `2026-W01` | título `W1 Q1 - Diciembre 2026` (nombre de mes del lunes con año ISO: incoherente); mes `2026-01`, trimestre `2026-Q1`; embed `2026-01#… W1 - semana 1 (29 dic. - 04 ene.)` |
| T7 | Semanal `2026-W53` | título `W14 Q4 - Diciembre 2026`; mes `2026-12` |
| T8 | Semanal, enlaces de día con TZ=UTC vs America/Bogota (`2025-W33`) | UTC: `12 ago … 18 ago` (desplazado, bug); Bogotá: `11 ago … 17 ago` (correcto) |
| T9 | Mensual `2025-08` | 5 semanas: `Semana 05: [[2025-W31]]` … `Semana 09: [[2025-W35]]`; ancla `2025-08 Objetivos mensuales Objetivos para agosto del 2025`; título `Agosto del 2025` |
| T10 | Mensual `2025-10` | `Semana 01: [[2025-W40]]` … `Semana 05: [[2025-W44]]`; W44 = `(27 oct. - 02 nov.)` |
| T11 | Mensual `2025-12` | `Semana 10 W49 … Semana 13 W52, Semana 14: [[2026-W01]]` (14 > 13: fuera del trimestre) |
| T12 | Mensual `2026-01` | `Semana 01: [[2026-W01]]` (29 dic.–04 ene.) … `Semana 05: [[2026-W05]]` |
| T13 | Trimestral `2025-Q2` | abril: sem 01–04 (`W14–W17`); mayo: 05–09 (`W18–W22`); junio: 10–13 (`W23–W26`) |
| T14 | Trimestral `2025-Q4` | octubre 01–05 (`W40–W44`), noviembre 06–09 (`W45–W48`), diciembre 10–13 (`W49–W52`) |
| T15 | Trimestral `2027-Q1` | 12 semanas listadas; arranca en `Semana 02: [[2027-W01]]` (la semana 01 = `2026-W53` queda fuera por jueves) |
| T16 | Anual `2025` | trimestres `[[2025-Q1]]…[[2025-Q4]]`, meses `[[2025-01]]…[[2025-12]]`, prev/next `[[2024]] / [[2026]]` |
| T17 | Títulos inválidos | Semanal `2025-W` / Mensual `2025-5` / Trimestral `2025-Q5` / Anual `25` ⇒ mensajes de error del propio template (el motor nuevo debe rechazar) |

### 8.4 Filtros de tareas (Journal, `targetDate = 2025-10-24`)

Suponiendo "hoy" arbitrario y tareas independientes:

| # | Tarea | Grupo esperado |
|---|---|---|
| J1 | `- [ ] A 📅 2025-10-24 [hI:: 09:00]` | Calendario |
| J2 | `- [ ] B ⏳ 2025-10-24` | Programadas |
| J3 | `- [ ] C 🛫 2025-10-24` | Programadas (tras 📅 y ⏳ en el orden) |
| J4 | `- [ ] D 📅 2025-10-23` | Vencidas |
| J5 | `- [ ] E 🛫 2025-10-01` | Vencidas (Journal incluye 🛫; Weekly no) |
| J6 | `- [ ] F 📅 2025-10-23 [hI:: 08:00]` | Vencidas (la hora solo cuenta si es el mismo día) |
| J7 | `- [ ] G 📅 2025-10-25` | no aparece |
| J8 | `- [/] H` (sin fecha) | En progreso (también en cualquier otra fecha) |
| J9 | `- [ ] I [w::[[2025-W43]]]` | Semana (24-oct está en W43) |
| J10 | `- [ ] J [w::[[2025-W42]]]` | Semanas anteriores |
| J11 | `- [ ] K [w::[[2025-W44]]]` | no aparece |
| J12 | `- [ ] L [w::[[2025-W43]]] 📅 2025-10-10` | solo Semana (la fecha se ignora) |
| J13 | `- [/] M [w::[[2025-W43]]]` | En progreso (no en Semana) |
| J14 | `- [ ] N ⛔ x 📅 2025-10-24` con dependencia `x` abierta | Bloqueadas |
| J15 | `- [ ] O ⛔ x` (sin fecha) con `x` abierta | no aparece |
| J16 | `- [ ] P ⛔ ^x 📅 2025-10-24` con `x` completada | actual: Bloqueadas (bug por `^`); esperado: Programadas |
| J17 | `- [x] Q ✅ 2025-10-24` | Completadas hoy |
| J18 | `- [x] R` (sin ✅) | no aparece |
| J19 | `- [x] S ✅ 2025-10-23` | no aparece |
| J20 | `- [ ] T [w::[[2025-W5]]]` y objetivo 2025-02-01 | Semana (W5 = 27-ene…02-feb; semanas de 1 dígito) |
| J21 | Ordenamiento calendario `9:00` vs `10:00` | actual por cadena ⇒ `10:00` antes de `9:00` (bug) |
| J22 | Límite de vencidas 50: 60 vencidas | muestra 50, título `(60)` |
| J23 | Prioridad `⏫` en el texto | `priority=Highest` y símbolo mostrado `🔺` (desplazamiento) |

### 8.5 Filtros de tareas (Weekly, `2025-W43`, lunes 2025-10-20)

| # | Tarea | Grupo |
|---|---|---|
| K1 | `[w::[[2025-W43]]]` | Tareas Semanales |
| K2 | `[w::[[2025-W42]]]`, `[w::[[2024-W52]]]` | Vencidas de Semanas Anteriores |
| K3 | `[w::[[2025-W44]]]` | no aparece |
| K4 | `📅 2025-10-26` | domingo |
| K5 | `🛫 2025-10-20` | lunes (por día incluye 🛫) |
| K6 | `📅 2025-10-19` | Vencidas por Fecha |
| K7 | `🛫 2025-10-19` | no aparece |
| K8 | `⏳ 2025-10-27` | no aparece |
| K9 | `- [x] ✅ 2025-10-22` | Completadas |
| K10 | `- [x] ✅ 2025-10-27` | no aparece |
| K11 | Tarea con `[w::]` y `📅 2025-10-22` | solo Semanales |
| K12 | Tarea `[/]` sin fecha ni semana | no aparece |
| K13 | `showOverdueLimit: 10` con 15 vencidas | muestra 10 + `... y 5 tareas más` en cada lista de vencidas |
| K14 | `getTaskCounts` con vencidas por fecha | `overdue` ignora la sección por fecha |
| K15 | Día hoy | clase `daily-group--today` y `📍 Hoy` solo si `highlightToday` y fecha == hoy |

### 8.6 Parser de campos usados por estos módulos

- `[w::[[2025-W43]]]`, `[W::[[x/y/2025-W5|2025-W5]]]`, `[w :: [[2025-W7]] ]` ⇒ `week`.
- `[w::2025-W43]` (sin wikilink) ⇒ no detecta.
- Duración `[30min]`/`[1h]`; `hI/hF` con espacio previo; id `^abc` / `🆔abc`.
- Fecha de cierre `✅ 2025-10-24` presente en `content`.

---

## 9. Qué se puede hacer con un motor propio (sin Templater) y qué no

**Se puede (y conviene) reimplementar nativamente**

- Todo lo que son strings y `moment`: nombres `Tipo YYMMDD - …`, frontmatter, secciones fijas, bloques `base`/`datacorejsx`/embeds como texto estático (no hay lógica dentro de los bloques).
- Cálculos de periodos (sección 6) como funciones puras, corrigiendo los bugs de año ISO y TZ. Moment está disponible en Obsidian móvil (`import { moment } from 'obsidian'`) o se puede sustituir por aritmética propia ISO.
- `tp.system.prompt` / `suggester` ⇒ `Modal` / `SuggestModal` propios (misma semántica: cancelar aborta la creación).
- `tp.file.rename/move/folder/title` ⇒ `app.fileManager.renameFile`, `vault.create`, `vault.createFolder`, `vault.getAbstractFileByPath`, `vault.adapter.exists`; la ruta destino se conoce de antemano, así que no hace falta crear un "Sin título" y moverlo.
- `tp.config.active_file` ⇒ `app.workspace.getActiveFile()` capturado antes de abrir los modales.
- Insertar enlace al padre ⇒ `activeView.editor.replaceSelection` (PGTD/AV/AI/RR/RC ya lo hacen así; en el resto `cursor_append` es ambiguo y conviene unificar con la misma API).
- Reglas de carpeta 5.5 como una única función `resolveContainerTarget(type, activeFolder, inbox?)` parametrizada por prefijo (`AV - `, `AI - `, `RR - `, `RC - `, `PGTD`) con variantes de nomenclatura.
- Journal: crear notas diarias/semanales/mensuales/trimestrales/anuales sin que el usuario nombre el archivo (hoy lo nombra a mano y la plantilla lee el título).
- Procesos "modo captura": generación condicional de secciones y de la tarea `#cx-procesar…`.
- Frontmatter: escribir con `processFrontMatter` o string directo (cuidado: valores vacíos `clave:` y wikilinks entre comillas deben conservarse idénticos para compatibilidad).

**Requiere decisión o no se resuelve con puro motor**

- Plantillas de usuario con JavaScript arbitrario (`<%* … %>`): si se quiere seguir aceptando plantillas existentes tal cual hay que ejecutar JS (p. ej. `AsyncFunction`) con un objeto `tp` compatible limitado a las APIs de la tabla 5.7; funciona en móvil, pero no hay sandbox.
- Cursor/selección: `tp.file.cursor_append` depende del editor activo.
- Configuración de Templater fuera del repo (carpeta de plantillas, "folder templates", triggers al crear): no está en las fuentes; hay que decidir si el motor propio sustituye esos disparadores.
- Los `base`/`datacorejsx` siguen necesitando los plugins Bases (core) y Datacore en el vault; el motor solo los emite como texto.
- Plantillas con efecto de "captura": las tareas `- [ ] … #cx-procesar…` crean checkboxes fuera de PGTD/RR (excepción documentada: Inbox).

---

## 10. Preguntas abiertas / ambigüedades detectadas

1. Ubicación definitiva de notas Wly/Mly/Qly/Yly (código: `YYYY/Qn/…`; vault: no fijada).
2. ¿Los `base` de la plantilla Diaria esperan una propiedad `fecha` que la plantilla no escribe?
3. ¿Se mantiene `type: Wly/Mly/Qly/Yly` (plantillas) o `Wk/M/Q/H/Y` (parser)? Hay que unificar el mapa de tipos.
4. ¿Se conserva el desplazamiento de símbolos de prioridad (⏫=Highest) o se alinea con Tasks (🔺 highest, ⏫ high, 🔼 medium, 🔽 low, ⏬ lowest)? Hoy el parser y los renderers no coinciden.
5. ¿Regla de pertenencia semana→mes: jueves (frontmatter Wly, trimestral) o solape (listados del mensual)?
6. `Documentacion/` promete opciones/funciones sin implementar (`groupOverdueByWeek`, `showOnlyCritical`, `enableQuickActions`, completar tareas desde la vista).
