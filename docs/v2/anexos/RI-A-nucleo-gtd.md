# A. Ingeniería inversa del NÚCLEO DE DATOS del módulo GTD (src/modules/moduloGTDv3)

Alcance: `model.ts`, `parser.ts`, `hierarchyBuilder.ts`, `gtdProcessor.ts`, `inProgressProcessor.ts`, `taskStateManager.ts`, `stalledProjectService.ts`, `taskSelectionAnalyzer.ts`, `dateUtils.ts`, `durationUtils.ts`, `colorUtils.ts`, `calendarDataProvider.ts`, `calendarTypes.ts`, más (por dependencia directa) `moduloFoco/focoParser.ts` (usado por el servicio de proyectos estancados), `main.ts` (carga de `data.json`, eventos), `view.ts` (orquestación) y la documentación de reglas `Documentacion/Ax 250705 - Reglas y estructura de las listas de Tareas GTD de Dovela.md` (en adelante "DOC-REGLAS").

Convención: `archivo:Lnn` = línea del fichero en el estado actual del repo (commit 378e5af). Todo lo marcado "(verificado)" lo ejecuté con un arnés fuera del repo (`scratchpad/t/`: copia del código fuente con tipos eliminados + `moment@2.30.1`), no es deducción por lectura. Nada del repo fue modificado.

---

## 0. Visión general del pipeline

```
Vault ──parseVault()──────────────► ProcessedVaultData{hierarchicalData(plano), allTasks, uniqueContexts, uniquePeople}   parser.ts:L243
           │
           ├─ buildHierarchy(items) ─► [virtualRoot] con children/parent/conteos                                         hierarchyBuilder.ts:L59
           ├─ allTaskMap = Map(task.id → task)  (TODAS las tareas, incl. completadas)                                    view.ts:L140
           ├─ processGtdLists(allTasks, allTaskMap, overdueMode) ─► gtdLists + navigationItems + uniqueContexts/People   gtdProcessor.ts:L259
           └─ processInProgressTasks(allTasks, grouping, sorting) ─► InProgressData                                       inProgressProcessor.ts:L67
                                   │
                                   ▼  generateGtdViewHtml(...)  → contentEl.innerHTML   (view.ts:L155-158)
```

Escrituras en ficheros (única vía de mutación de notas desde este núcleo): `TaskStateManager.closeTask / setTaskInProgress` (taskStateManager.ts) y `TaskSelectionAnalyzer.changeTaskStateToInProgress` (vía editor). El resto del plugin además duplica la lógica de cierre en `timeLogModal.ts:L387` y `pomodoroModal.ts:L458` (copias casi idénticas).

Hallazgo estructural clave: el parser de GTDv3 (`parser.ts`) y el de Foco (`focoParser.ts`) son **copias divergentes** de `parseTasks`; el servicio de proyectos estancados usa la versión de Foco, no la de GTDv3 (stalledProjectService.ts:L3).

---

## 1. Cómo se leen las notas

### 1.1 Escaneo (parser.ts `parseVault`, L243-279)
- Universo: `vault.getMarkdownFiles()` (L249) = TODOS los `.md` indexados por Obsidian (no incluye carpetas ocultas tipo `.obsidian`). Orden = el del índice interno de Obsidian (no ordenado ni garantizado); ese orden determina el orden de las tareas dentro de cada sublista (no hay ordenación por prioridad en las listas GTD).
- Filtro `shouldBeExcluded(file)` (L39-49):
  1. `file.extension !== 'md'` → excluir (en la práctica nunca ocurre).
  2. `file.path.startsWith(EXCLUDED_FOLDERS[i])` con `EXCLUDED_FOLDERS = ['03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/Plantillas']` (L6-8). Es `startsWith` sin `/` final: también excluye cualquier carpeta/nota hermana cuyo nombre empiece igual.
  3. Cualquier segmento de la ruta (incluido el nombre del archivo) igual a `'99 - Adjuntos'` (`DYNAMIC_EXCLUDED_FOLDER_NAMES`, L10-12, comprobación L44-47).
- No hay filtro por tipo de nota, carpeta de usuario, estado del frontmatter (`estado`), etiquetas ni "archivadas": se parsean tareas de TODAS las notas restantes (incluyendo diarios, notas `Ax`, proyectos con estado ⚫/🔴, etc.). Tampoco se ignoran bloques de código, comentarios HTML ni frontmatter (ver 2.8).
- Contenido: `await vault.cachedRead(file)` (L252) — secuencial, un `await` por archivo (sin `Promise.all`). `cachedRead` devuelve el texto cacheado por Obsidian (puede quedar desfasado unos instantes respecto a disco si el archivo cambió fuera del editor).
- Frontmatter: SIEMPRE por `metadataCache.getCache(file.path)?.frontmatter || {}` (L253; no se parsea YAML a mano). Es el único uso de `metadataCache` en `parseVault`; las tareas NO se obtienen de `metadataCache.listItems` sino de regex sobre el texto.
- Por archivo se construye un `HierarchicalItem` plano (L264-267): `id=file.path`, `type=determineItemType`, `name=file.basename`, `children=[]`, `tasks`, `ownTaskCount = tasks.filter(t => !t.completed).length` (incluye `in-progress`), `descendantTaskCount=0`, `frontmatter`.
- `uniqueContexts/uniquePeople` de `parseVault` (L246-262) incluyen contextos de tareas completadas; el pipeline de la vista los ignora y usa los de `processGtdLists` (solo tareas abiertas, ordenados con `localeCompare`; gtdProcessor.ts:L288-289, L511-512).

### 1.2 Detección del tipo de nota (`determineItemType`, L26-37)
1. Si `frontmatter.type` existe y es clave de `FRONTMATTER_TYPE_MAP` (`GrupoAV, Dly, Wk, M, Q, H, Y`; L22-24) → ese tipo. Solo esos 7 valores se leen del frontmatter (un `type: PGTD` en frontmatter se IGNORA).
2. Si no, primer prefijo (en orden de inserción de `PREFIX_TO_TYPE_MAP`: `AV, AI, PGTD, PQ, RR, Tx, Vx, Reu, Rf, Sue, Cp, EMkt, RT, RL, Ax`; L16-20) tal que `file.basename.startsWith(prefix + ' ')` (prefijo + UN espacio; p. ej. `"PGTD - X"` → `PGTD`).
3. Si no, `'Ax'` (por defecto).
Matiz: `FRONTMATTER_TYPE_MAP[x]` se evalúa sobre un objeto literal, por lo que un `type: toString` o `constructor` devolvería una función (truthy). Caso extremo, sin impacto práctico.

### 1.3 Otros puntos de lectura directa de ficheros
- `StalledProjectService` lee con `vault.cachedRead` solo los archivos de la jerarquía del proyecto (ver §6.1).
- `view.ts:checkInProgressTasks` (L1006-1028) hace `vault.read` de cada archivo marcado en el HTML tras renderizar y busca `/^- \[\/\]/m` (solo `- [/]` sin indentación) para pintar un indicador: es una SEGUNDA lectura/criterio de "en progreso" distinto del parser (que acepta indentación y `-\s+`).
- `TaskStateManager` usa `vault.read` + `vault.modify` (no `vault.process`/`cachedRead`).
- `main.ts:collectMetadata` (L293-317) usa `metadataCache.getFileCache(file).tags` para `gtdContextTags` (`#cx-*`) y `gtdPersonTags` (`#px-*`) y `getMarkdownFiles()` con prefijos `PGTD -`, `AV -`, `AI -` para `gtdProjectsAndAreas`. Aquí SÍ se usa metadataCache (tags indexados), distinto del parser de tareas.

---

## 2. Formato de tarea reconocido por el parser (parser.ts `parseTasks`, L80-241)

### 2.1 Línea candidata
Regex de línea (L83):
```
/^\s*-\s+\[( |x|X|\/)\]\s+(.*)/
```
- Solo bullets `-` (no `*`, no `+`, no numeradas `1.`). Indentación libre (`^\s*`: espacios o tabs, cualquier nivel).
- `-\s+` admite varios espacios entre `-` y `[`.
- Estados de checkbox aceptados: `' '`, `x`, `X`, `/`. **Cualquier otro (`[-]`, `[!]`, `[?]`, `[>]`, `[<]`, `[~]`...) hace que la línea NO sea tarea** (se ignora por completo: no cuenta en listas, ni en conteos, ni en "estancado"). (verificado)
- `\s+` obligatorio tras `]` y contenido `(.*)` no vacío: `- [ ] ` (vacía) y `- [ ]texto` NO son tareas. (verificado)
- No se reconocen tareas dentro de citas/callouts (`> - [ ] ...`). (verificado)
- No se detectan bloques de código (```), frontmatter YAML ni comentarios `%% %%`: una línea con aspecto de tarea dentro de un code fence SÍ se parsea.
- CRLF: `split('\n')` deja `\r` al final; `.` no lo captura y la regex no está anclada al final, por lo que el parser sí lo tolera (verificado), pero ver §6.4 (el manager de estados no).
- `lineNumber = i` (0-based, índice en `content.split('\n')`; L226).

Estados → campos (L93-110): `x/X` → `status:'completed', completed:true`; `/` → `status:'in-progress', completed:false`; `' '` → `status:'incomplete', completed:false`. (`DOC-REGLAS` usa `- [-]` en todos los ejemplos; el parser real no los reconocería. Probablemente se escribieron así para que el propio doc no contamine el dashboard. Para fixtures hay que usar `- [ ]`).

### 2.2 Subtareas / anidamiento
No existe relación padre-hijo. Una subtarea indentada es una tarea independiente, sin `parentId`; no hereda contexto/fecha/ID del padre; el padre no se "completa" por sus hijos. Las líneas de texto/bullets hijos de una tarea no se asocian. (verificado: `"  \t- [ ] anidada con tab 🆔 n1"` → tarea normal con `id:"n1"`).

### 2.3 Orden de extracción y mutación de `currentTaskContent`
`currentTaskContent` empieza = texto tras el checkbox y se va "limpiando". El ORDEN importa (cada paso opera sobre lo que dejó el anterior):

| # | Campo | Regex (línea) | Qué captura | ¿Se elimina del `content`? |
|---|-------|---------------|-------------|-----------------------------|
| 1 | fechas (todas) | `allDatesRegex = /(🛫\|⏳\|📅)\s*(\d{4}-\d{2}-\d{2})/g` (L142) | lista en orden de aparición | no (solo se usa para `additionalDates`) |
| 2 | fecha principal | `/(🛫\|⏳\|📅)\s*(\d{4}-\d{2}-\d{2})/` (L146) | PRIMERA fecha del texto, sea cual sea el símbolo → `dateSymbol`, `date` | SÍ, solo esa primera ocurrencia (L157) |
| 2b | `additionalDates` | `allDatesMatches.slice(1)` (L160) | resto de fechas (símbolo+fecha) | NO: quedan en `content` como texto |
| 3 | id | `/\s*(?:\^\|🆔)\s*([a-zA-Z0-9]+)/` (L166) | PRIMER `^xxx` o `🆔 xxx` del texto (alfanumérico ASCII) o `crypto.randomUUID()` si no hay | SÍ |
| 4 | hora inicio | `/ \[hI::\s*([^\]]+)\]/` (L167) | texto crudo (p. ej. `10am`, `15:00`) → `startTime` | SÍ |
| 5 | hora fin | `/ \[hF::\s*([^\]]+)\]/` (L168) | `endTime` | SÍ |
| 6 | duración | `/ \[([0-9]+h\|[0-9]+min)\]/` (L169) | `30min`, `2h` → `duration` (string con unidad) | SÍ |
| 7 | semana | `/\s*\[(?:w\|W)\s*::\s*\[\[(?:.*?\|)?(\d{4}-W\d+)\]\]\s*\]/` (L172) | solo el código `2025-W43` (SIN `[[ ]]`) → `week` | SÍ |
| 8 | dependencias | `/⛔\s*(\^?[a-zA-Z0-9]+)/g` (L136, vía `extractDependenciesWithoutCleaning`) | todos los ids (con o sin `^`; el `^` queda dentro del grupo) → `dependencies[]` | NO (el `⛔ id` queda en `content`) |
| 9 | contextos | `/#cx-([\w-]+)/g` (L174) | → `contexts[]` (sin `#cx-`) | SÍ (todos) |
| 10 | personas | `/#px-([\w-]+)/g` (L175) | → `assignedPeople[]` | SÍ (todos) |
| 11 | tags | `/#(GTD-AlgunDia\|GTD-EstaSemanaNo\|inbox)/g` (L176) | → `tags[]` (sin `#`) | SÍ (todos) |
| 12 | prioridad | `/(⏫\|🔼\|🔽\|⏬)/` (L204) | PRIMER símbolo del texto | SÍ (solo esa ocurrencia) |

Mapa de prioridad (L207-211): `⏫`→`Highest`, `🔼`→`High`, `🔽`→`Medium`, `⏬`→`Low`, sin símbolo → `None`. **Desplazado un nivel respecto al plugin Obsidian Tasks** (ahí ⏫=high, 🔼=medium, 🔽=low, ⏬=lowest, 🔺=highest). `🔺` no se reconoce.

Símbolos NO interpretados (permanecen en `content`): `➕ fecha creación`, `✅ fecha cierre`, `🔁 recurrencia`, `❌`, `🏁`, `🔺`. El campo `creationDate?` existe en el modelo pero el parser de GTDv3 nunca lo llena. La fecha de cierre `✅ YYYY-MM-DD` se queda en `content` y los consumidores (p. ej. Journal `isTaskCompletedOnDate`, journalTaskRenderer.ts) la rescatan con regex sobre `content`. El Smart Inbox emite `➕ YYYY-MM-DD HH:mm` (smartInboxView.ts:L420-433), que queda en `content`.

Los `trim()` solo recortan extremos: quitar un token del medio deja DOBLE espacio en `content` (p. ej. `"foo  bar"`), lo que rompe después la búsqueda `includes` del TaskStateManager si se usa `content` limpio (§6.3).

### 2.4 Detección de conflictos de hora/duración (L178-202)
Solo se evalúa si existen `startTime` Y `endTime`:
- `parseTimeToMinutes(str)` (L52-78): primero `/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i` (12am→0h, 12pm→12h, pm<12 suma 12); si no, `/(\d{1,2}):(\d{2})/` (24 h, SIN validar rango: `25:99` → 1599 min); si no, `null`. Regex sin anclar, "primer match".
- `hasConflict = true` si alguna de las dos horas es `null`, o `end <= start`, o (hay `duration` y no hay conflicto previo) `end - start !== duración en minutos` (L191-201; la duración se reparsea con `/(\d+)(h|min)/`).
- No hay conflicto si falta una de las horas (p. ej. `[hI::]` sin `[hF::]` con `[90min]` incoherente, o solo `[hF::]`), ni se aplica la regla "30 min por defecto" que cita DOC-REGLAS.

### 2.5 Objeto resultante (`Task`, L215-236)
Siempre presentes: `id, content, status, completed, priority, dependencies, contexts, assignedPeople, tags, sourceFile, lineNumber, hasConflict`. Opcionales (solo si existen, L230-236): `date, dateSymbol, additionalDates, startTime, endTime, duration, week`. `displayStatus` lo añade después `processGtdLists` (mutando el objeto Task).

### 2.6 Ejemplos línea → objeto (todos (verificado) ejecutando el parser real; `sourceFile` omitido, `id:<uuid>` = `crypto.randomUUID()`)

| Línea | Resultado relevante |
|-------|---------------------|
| `- [ ] reunión 📅 2025-03-25 [hI:: 10am] [hF:: 11:30am] [90min] ⏫ 🆔 k1` | `{id:"k1", content:"reunión", status:"incomplete", priority:"Highest", date:"2025-03-25", dateSymbol:"📅", startTime:"10am", endTime:"11:30am", duration:"90min", hasConflict:false}` |
| `- [ ] reunión 📅 2025-03-25 [hI:: 10am] [hF:: 11:30am] [60min]` | igual pero `duration:"60min"`, `hasConflict:true` (90 ≠ 60) |
| `- [ ] reunión [hI:: 10am] [hF:: 9am]` | `hasConflict:true` (fin ≤ inicio) |
| `- [/] en progreso [30min] 🆔 p1` | `status:"in-progress", completed:false, duration:"30min", id:"p1"` |
| `- [x] hecha ✅ 2025-03-01 🆔 d1` | `status:"completed", completed:true, content:"hecha ✅ 2025-03-01", id:"d1"` |
| `- [ ] fechas ⏳ 2025-03-24 📅 2025-03-25 🛫 2025-03-20 texto` | `date:"2025-03-24", dateSymbol:"⏳", additionalDates:[{📅 2025-03-25},{🛫 2025-03-20}], content:"fechas  📅 2025-03-25 🛫 2025-03-20 texto"` (las dos fechas extra quedan en el texto) |
| `- [ ] sem [w:: [[2025-W43]]] #cx-Of` | `week:"2025-W43"` (sin corchetes), `contexts:["Of"]`, `content:"sem"` |
| `- [ ] sem [w:: [[Journal/2025/Q4/2025-W43\|2025-W43]]]` | `week:"2025-W43"` |
| `- [ ] tarea ⛔ dep1 🆔 me1` | `id:"me1", dependencies:["dep1"], content:"tarea ⛔ dep1"` |
| `- [ ] tarea ⛔ a,b ⛔ c` | `dependencies:["a","c"]` (la lista `a,b` pierde `b`) |
| `- [ ] prio 🔼 y ⏬ ➕ 2025-01-01 🔁 every day 🔺` | `priority:"High"`, `content:"prio  y ⏬ ➕ 2025-01-01 🔁 every day 🔺"` |
| `- [ ] #inbox2 #GTD-AlgunDia #cx-a #cx-a #px-José_X #px-Ana-Maria` | `tags:["inbox","GTD-AlgunDia"]`, `contexts:["a","a"]` (duplicado), `assignedPeople:["Jos","Ana-Maria"]`, `content:"2    é_X"` |
| `- [-] cancelada`, `- [!] x`, `* [ ] x`, `1. [ ] x`, `> - [ ] x`, `- [ ] ` | sin tarea |
| `-   [ ] tres espacios` / `  \t- [ ] anidada` | tarea normal |

### 2.7 Bugs y ambigüedades del parser (numerados B-P*)

- **B-P1 (alto) Contextos/personas con acentos o ñ se truncan.** `[\w-]` es ASCII. `#cx-Teléfono 📅 2025-03-25 🆔 abc123` → `contexts:["Tel"]`, `content:"Llamar cliente éfono"`. El propio DOC-REGLAS usa `#cx-Teléfono` como ejemplo (L60). Afecta también `#px-José`. Los contextos truncados contaminan listas y filtros (`Tel`).
- **B-P2 (alto) El `^` en cualquier parte del texto se interpreta como id.** `Calcular 2^10 hoy` → `id:"10"`, `content:"Calcular 2 hoy"`. Además `^abc-123` (id de bloque Obsidian con guion) → `id:"abc"` y deja `-123` en el texto.
- **B-P3 (alto) `⛔ ^dep` NO funciona como dependencia si va antes del `🆔`.** El regex de id (paso 3) corre antes que el de dependencias y devuelve el primer `^`/`🆔`: `tarea ⛔ ^dep1 🆔 me1` → `id:"dep1"`, `dependencies:[]`, `content:"tarea ⛔ 🆔 me1"` (la tarea se autoasigna el id de su dependencia y pierde la dependencia). `gtdProcessor.hasUnresolvedDependencies` (L47) y el tipo de `extractDependenciesWithoutCleaning` suponen que `^` es soportado, pero solo funciona si el id propio con `🆔`/`^` aparece antes en la línea.
- **B-P4 (alto) Ids no estables y colisionables.** Sin id explícito se usa `crypto.randomUUID()` en CADA parseo → `Task.id` cambia entre re-parseos; solo las tareas con `🆔`/`^` pueden ser destino de dependencias. Un mismo id repetido en dos notas colisiona en `allTaskMap` (último gana; view.ts:L140).
- **B-P5 (medio) Duración solo entera.** `[1.5h]`, `[45 min]`, `[30m]` NO se reconocen (quedan en `content`); DOC-REGLAS cita `[1.5h]` como válido (L94). Inconsistente con `inProgressProcessor.parseDuration` que sí acepta decimales (`\d+\.?\d*`), `m` y espacios. Con varios `[Nmin]` solo se extrae el primero.
- **B-P6 (alto) `week` sin corchetes vs `dateUtils` con corchetes.** El parser GTDv3 guarda `"2025-W43"` (grupo de captura sin `[[ ]]`), pero `isWeekPast/Today/Future` (dateUtils.ts:L20-54) hacen `weekString.match(/\[\[(\d{4})-W(\d{2})\]\]/)`, que falla con ese formato y devuelve `false` siempre. (verificado: `isWeekPast('2020-W01')=false`, `isWeekFuture('2099-W01')=false`, con `'[[2020-W01]]'` sí da `true`). Consecuencia: toda la lógica de semana de `processGtdLists` está muerta (`isWeekFutureFlag` siempre false; regla de Inbox por semana nunca se cumple). Una tarea `[w:: [[2099-W01]]] #cx-Casa` aparece en Próximas Acciones y NO en En Pausa. Journal/Weekly sí consumen `"YYYY-Wnn"`, por lo que el cambio del regex (L170-172) parece hecho para ellos. Además `\d+` en el parser vs `\d{2}` en dateUtils (semana de 1 dígito no se reconoce).
- **B-P7 (medio) La "fecha principal" depende del ORDEN del texto, no del tipo.** `⏳ 2025-03-24 📅 2025-03-25 [hI:: ..]` → `dateSymbol:'⏳'` → NO es item de Calendario. La validación de coherencia Start ≤ Schedule/Due solo se hace si la primera fecha es 🛫 (gtdProcessor L311): `📅 X 🛫 Y` con Y>X no se detecta. Todo el procesador sigue esta asimetría.
- **B-P8 (medio) Fechas sin validar.** `⏳ 2025-13-45` se acepta como `date`; `moment(x,'YYYY-MM-DD')` inválido hace que `isDatePast/Today/Future` devuelvan `false` (la tarea queda sin estado de fecha, no va a Inbox por fecha). Solo se aceptan 4+2+2 dígitos; `📅2025-03-25bar` (sin espacio) también se parsea.
- **B-P9 (medio) Etiquetas por prefijo.** `#(GTD-AlgunDia|GTD-EstaSemanaNo|inbox)` sin límite de palabra: `#inbox2` → tag `inbox` y deja `2`; `#inboxes`. Sensible a mayúsculas (`#Inbox` no vale). `#cx-`/`#px-` también son sensibles a mayúsculas.
- **B-P10 (medio) `[hI::` / `[hF::` / duración exigen un espacio literal delante** (` \[`). Si el token fuese lo primero tras el checkbox no se detectaría (caso raro). `startTime/endTime` conservan el texto crudo, con posibles espacios finales (`[hI:: 10am ]` → `"10am "`).
- **B-P11 (bajo) Dependencias múltiples estilo Tasks (`⛔ a,b`)**: solo se captura `a`. `⛔` seguido de texto libre captura la primera palabra como id (`⛔ bloqueado por X` → dep `bloqueado`).
- **B-P12 (bajo) Duplicados**: `#cx-a #cx-a` produce `contexts:["a","a"]` y la tarea se inserta dos veces en la misma sublista de Próximas Acciones (pushToMap por cada contexto).
- **B-P13 (bajo) `crypto.randomUUID()`** requiere contexto seguro; en Obsidian desktop/móvil existe, pero impide ejecutar el parser en Node < 19 sin polyfill (relevante para tests).
- **B-P14 (info) Parser duplicado**: `focoParser.parseTasks` (focoParser.ts:L53-159) es el mismo algoritmo SIN `additionalDates`, con regex de semana distinto (`/ \[w::\s*(\[\[\d{4}-W\d{2}\]\])\]/`: exige espacio previo, `w` minúscula, sin alias, y CAPTURA los corchetes `[[2025-W43]]`) y sin soporte de ruta con alias. Mismo `taskRegex`. Diferencias de comportamiento entre dashboard, Foco y detección de estancados.

### 2.8 Falsos positivos por contenido no-tarea
Tareas dentro de bloques de código, ejemplos en notas de documentación (como el propio DOC-REGLAS si usase `[ ]`), plantillas fuera de `Plantillas`/`99 - Adjuntos`, o notas de "tareas de prueba" se contabilizan como tareas reales.

---

## 3. Modelo de datos (model.ts)

### 3.1 Tipos escalares
- `HierarchicalItemType` (L10-39): `GrupoAV | AV | AI | Root` (estructurales) · `PGTD` (Proyecto GTD), `PQ` (Proyecto de Trimestre), `RR` (Recurso Recurrente), `Tx` (Transacción), `Vx` (Video), `Reu` (Reunión), `Rf` (Reflexión), `Sue` (Sueño), `Cp` (Campaña), `EMkt` (Entregable Marketing), `RT` (Registro Tiempo), `RL` (Registro Lectura), `Ax` (Asunto/nota estándar; defecto) · por frontmatter `Dly | Wk | M | Q | H | Y` (diario, semanal, mensual, trimestral, semestral, anual). `Root` es virtual (sólo lo crea `buildHierarchy`).
- `DateSymbol = '🛫' | '⏳' | '📅'` (L41).
- `TaskStatus = 'incomplete' | 'completed' | 'in-progress'` (L42).
- `DisplayStatus = 'overdue' | 'today' | 'future' | 'paused-dep' | 'paused-start' | null` (L43). `'future'` nunca se asigna en el código (valor huérfano).

### 3.2 `Task` (L46-68)
| Campo | Tipo | Significado / origen |
|-------|------|----------------------|
| `id` | string | `🆔 xxx`/`^xxx` o UUID aleatorio (ver B-P2/B-P4) |
| `content` | string | texto residual tras extraer metadatos (conserva dependencias `⛔ id`, fechas adicionales, `✅`, `➕`, `🔁`, hashtags no gestionados) |
| `status` | TaskStatus | por el carácter del checkbox |
| `completed` | boolean | `true` solo con `x/X`; `in-progress` es `false` ("retrocompatibilidad", L50) |
| `priority` | `'Highest'\|'High'\|'Medium'\|'Low'\|'None'` | ⏫/🔼/🔽/⏬/ninguno |
| `creationDate?` | string | declarado, NUNCA poblado por el parser |
| `date?`, `dateSymbol?` | string, DateSymbol | primera fecha del texto y su símbolo |
| `additionalDates?` | `{symbol,date}[]` | fechas siguientes (solo si hay más de una) |
| `startTime?`, `endTime?` | string | texto crudo de `[hI::]`/`[hF::]` |
| `duration?` | string | `"30min"`/`"2h"` |
| `week?` | string | `"2025-W43"` (sin corchetes) |
| `dependencies` | string[] | ids tras `⛔` (puede incluir `^`) |
| `contexts` | string[] | tras `#cx-` (sin prefijo) |
| `assignedPeople` | string[] | tras `#px-` |
| `tags` | string[] | solo `inbox`, `GTD-AlgunDia`, `GTD-EstaSemanaNo` |
| `sourceFile` | TFile | archivo origen |
| `lineNumber` | number | índice de línea 0-based al parsear (queda obsoleto si el archivo cambia) |
| `hasConflict?` | boolean | incoherencia hora/duración (§2.4) |
| `displayStatus?` | DisplayStatus | asignado por `processGtdLists` (§4.2) |

### 3.3 `HierarchicalItem` (L71-83)
`id` (ruta del archivo, o ruta de carpeta para placeholders; `'root'` para la raíz) · `type` · `name` (basename; placeholders `"[FALTA] <carpeta>"`) · `file?` (ausente en placeholders y raíz) · `parent?` · `children[]` · `tasks[]` (todas las del archivo, también completadas) · `ownTaskCount` (abiertas = no `completed`, incluye `/`) · `descendantTaskCount` (suma recursiva de `own + descendant` de los hijos) · `frontmatter` · `isNoteMissing?`.

### 3.4 `NavigationItem` (L86-94) y `ProcessedVaultData` (L97-105), `InProgressData` (L107-115)
- `NavigationItem{id,label,count,icon,isSublist,parentList?,anchor}`.
- `ProcessedVaultData{hierarchicalData, gtdLists: Record<string, Task[] | Map<string, Task[]>>, inProgressData, allTasks, uniqueContexts, uniquePeople, navigationItems}`.
- `InProgressData{groups:{[name]:Task[]}, stats:{total, overdue, definedTimeMinutes, estimatedTimeMinutes}}`.

### 3.5 Time tracking, Pomodoro, Journal (L117-183)
- `TimeLogEntry{id, taskNotePath, startTime, endTime, durationMinutes, notes, taskDescription?}`: `id = Date.now().toString()` (timeTrackerService.ts:L14); `startTime/endTime` ISO 8601 CON offset local (`moment().local().toISOString(true)`, main.ts:L461).
- `ActiveTimerState{taskNotePath, startTime, taskDescription?, notes?, lineNumber?}`.
- `PomodoroSettings{workDuration=25, shortBreakDuration=5, longBreakDuration=15, cyclesBeforeLongBreak=4, autoStartBreaks=false, autoStartWork=false, soundEnabled=true, notificationsEnabled=true, overtimeAlertInterval=5}` (defaults L197-207).
- `PomodoroSession{id, type:'work'|'shortBreak'|'longBreak', startTime(ISO), duration(min), taskPath?, taskDescription?, completedCycles, notes?, isOvertime?, overtimeStartTime?, lastOvertimeAlert?}`.
- `PomodoroStats{totalWorkSessions, totalWorkMinutes, completedCycles, todayWorkSessions, todayWorkMinutes}` (defaults a 0; el contador "today" no tiene lógica de reseteo en model.ts).
- `JournalSettings{baseFolderPath, yearSubfolder, quarterSubfolder, monthSubfolder, weekFolderPattern}`; defaults L217-223: `"03 - Gestion Personal/AV - Gerente de Vida/AI - Journals"`, `true`, `true`, `false`, `"{YYYY}/Q{Q}"`.

### 3.6 Esquema de `data.json` (`DovelaPluginData`, L188-195)
```jsonc
{
  "timeLogs": [ { "id":"1730822400000", "taskNotePath":"ruta/nota.md", "startTime":"2025-11-05T09:00:00.000-05:00",
                  "endTime":"2025-11-05T09:45:00.000-05:00", "durationMinutes":45, "notes":"", "taskDescription":"texto crudo de la tarea" } ],
  "activeTimer": { "taskNotePath":"...", "startTime":"ISO", "taskDescription":"...", "notes":"", "lineNumber": 12 },   // opcional; se omite si undefined
  "pomodoroSettings": { ...9 campos... },
  "activePomodoroSession": { ... },                                                                                // opcional
  "pomodoroStats": { "totalWorkSessions":0, "totalWorkMinutes":0, "completedCycles":0, "todayWorkSessions":0, "todayWorkMinutes":0 },
  "journalSettings": { "baseFolderPath":"...", "yearSubfolder":true, "quarterSubfolder":true, "monthSubfolder":false, "weekFolderPattern":"{YYYY}/Q{Q}" }
}
```
Carga/guardado: `this.data = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())` (main.ts:L247) — **merge superficial**: si el JSON trae `pomodoroSettings` parcial, reemplaza el objeto entero (campos nuevos quedan `undefined`, sin migración). Además `DEFAULT_SETTINGS.timeLogs` es un array compartido a nivel de módulo: si el JSON no trae `timeLogs`, `this.data.timeLogs` ES el array por defecto y `push` lo muta; igualmente `pomodoroSettings/Stats/journalSettings` iniciales son las mismas referencias que `DEFAULT_*`, y `settingsTab.ts` (L221-273, p. ej. `settings.workDuration = value`) los muta in situ, con lo que "Restaurar valores por defecto" (`{...DEFAULT_POMODORO_SETTINGS}`, settingsTab.ts:L341) restauraría valores ya modificados mientras dure la sesión. Guardado: `saveData(this.data)` completo (main.ts:L282-284); una migración antigua (`timelogs.json`) está comentada (L266-269) pero SÍ borra el archivo viejo (L272) sin haber migrado los logs. Sincronización multi-dispositivo: poll cada 15 s de `data.json` para `activeTimer` (main.ts:L818-822, L788-816).

---

## 4. Reglas de clasificación (gtdProcessor.ts)

Importante: **solo existen 10 listas** en `GtdList` (L6-17): `Bandeja de Entrada` (Inbox), `Próximas Acciones`, `Calendario`, `Ojalá Hoy`, `Asignadas o Delegadas`, `Proyectos`, `Algún Día / Tal Vez`, `Esta Semana No`, `En Pausa`, `Vencidas`. No existen listas "En espera", "Completadas hoy" ni "Bloqueadas" en este procesador:
- "En progreso" es otro pipeline (§4.6, inProgressProcessor).
- "Completadas hoy" y "Bloqueadas por dependencias" existen SOLO en el renderizador del Journal (journalTaskRenderer.ts `processTasksForDate`), con reglas propias (§4.7).
- "En espera" ≈ `Asignadas o Delegadas`. "Proyectos" aquí son TAREAS marcadas con `#cx-ProyectoGTD`/`#cx-Entregable`, no notas PGTD (los proyectos como notas viven en la jerarquía y en el servicio de estancados).

### 4.1 Entradas y zona horaria
- `processGtdLists(allTasks, allTaskMap, overdueGroupingMode?)` (L259). Itera `allTasks` una vez; ignora `completed` (L285) pero **mantiene `in-progress`** (son abiertas).
- Fechas: strings `YYYY-MM-DD` sin zona. `isDatePast/Today/Future` (dateUtils.ts:L5-18) = `moment(str,'YYYY-MM-DD')` (medianoche LOCAL) comparado con `moment()` (ahora local) con granularidad `'day'`. Por tanto "hoy" = día natural del reloj local del dispositivo; sin UTC, sin offsets; se recalcula en cada llamada (cada `moment()` es un "ahora" distinto, aunque en la práctica da lo mismo salvo cruce de medianoche a mitad de procesado). Fechas inválidas → los tres devuelven `false`.
- Semanas: `moment().year(Y).isoWeek(W)` comparado por `'isoWeek'` con hoy (dateUtils L26-29). Aritmética de semana ISO sobre la fecha de hoy con el año reemplazado; no valida W (00, 54...).
- Otras fuentes de "hoy": `TaskStateManager.closeTask` usa `moment().format('YYYY-MM-DD')` local para `✅`.

### 4.2 `displayStatus` (L363-374; funciones L56-120 y L201-257)
Orden de decisión:
1. `hasInvalidDateConfiguration` → `null`.
2. `isPausedByDependency` → `getDependentTaskDisplayStatus`:
   - sin `date` → `'paused-dep'`;
   - con fechas: `'overdue'` si CUALQUIER fecha ⏳ o 📅 (principal o adicional) es pasada; si no `'paused-dep'` (🛫 y fechas de hoy/futuras no cambian nada).
3. `isWeekFutureFlag` → `'paused-start'` (código muerto por B-P6).
4. `getRegularTaskDisplayStatus`: sin `date` → `null`. Si no, sobre TODAS las fechas (principal + adicionales): `overdue` si alguna ⏳/📅 es pasada; si no `today` si CUALQUIER fecha (incluida 🛫) es hoy; si no `paused-start` si alguna 🛫 es futura; si no `null`. Prioridad overdue > today > paused-start. Nota: una 🛫 pasada no da estado; una 🛫 de hoy da `'today'`.

`hasUnresolvedDependencies` (L45-51): `true` si ALGUNA dependencia (id tras quitar `^` inicial) existe en `allTaskMap` Y no está `completed`. Si el id no existe en el vault (typo, borrada, tarea sin 🆔 explícito) → NO bloquea. `in-progress` bloquea. No hay detección de ciclos (una tarea que depende de sí misma o ciclos A↔B quedan bloqueadas para siempre; DOC-REGLAS pide llevarlas a Inbox).

Validación de fechas (L305-333): si la fecha principal es 🛫 y alguna fecha adicional ⏳/📅 es estrictamente anterior (start posterior) → `hasInvalidDateConfiguration = true`. El `else` (L321-332, buscar ⏳/📅 en `task.content`) es código inalcanzable: si `additionalDates` está vacía, el contenido ya no tiene más fechas.

### 4.3 Reglas por lista (en el orden exacto en que se evalúan por tarea)

Orden de evaluación dentro del bucle (L284-498): displayStatus → Someday (exclusivo) → ThisWeekNot (exclusivo) → Inbox → (si fecha inválida: `continue`) → Paused → (si paused-start sin dependencia: `continue`) → Calendar → Overdue → Agenda/HopeToday → Assigned → NextActions → Projects → fallback Inbox. Las listas NO son excluyentes salvo donde se indica `continue`; una tarea puede estar en varias.

1. **Algún Día / Tal Vez** (L377-380): `tags` incluye `GTD-AlgunDia`. Lista plana `Task[]`. Exclusiva: `continue` antes de cualquier otra regla (incluye tareas vencidas, con conflicto, etc.). Precede a Esta Semana No.
2. **Esta Semana No** (L381-384): `tags` incluye `GTD-EstaSemanaNo`. Plana, exclusiva. (La tarea con ambos tags va solo a Algún Día.)
3. **Bandeja de Entrada** (L387-397), plana. Se inserta si alguna de:
   - `hasConflict` (hora/duración incoherente);
   - tag `inbox`;
   - `hasInvalidDateConfiguration` (y entonces `continue`: no entra en NINGUNA otra lista);
   - `task.date` (cualquier símbolo, solo la fecha principal) y sin contexto y sin persona y fecha pasada u hoy;
   - `task.week` y sin ctx/persona y semana pasada/actual (inoperante, B-P6).
   Para el resto de condiciones NO hay `continue`: la tarea sigue evaluándose (puede estar además en Paused, Calendario, Vencidas...).
   Fallback (L484-497): si tras todo no está en ninguna de Calendar, Vencidas, Ojalá Hoy, Asignadas, Próximas Acciones, Proyectos, En Pausa o Inbox → se inserta en Inbox. Casos típicos: tarea sin ningún metadato; tarea solo con fecha FUTURA y sin ctx/persona; solo `#px`... no (esa va a Asignadas).
4. **En Pausa** (L400-408), plana. Si `isPausedByDependency || isWeekFutureFlag(muerto) || displayStatus==='paused-start'`:
   - `paused-start` (alguna 🛫 futura y ninguna fecha vencida/hoy, ver §4.2) y SIN dependencia → se añade a En Pausa y `continue` (no entra en Próximas Acciones ni Asignadas ni Calendario...), salvo que ya hubiera entrado en Inbox antes (conflicto/tag inbox).
   - con dependencia sin resolver → En Pausa Y sigue el procesado ("doble/triple listado"): puede aparecer también en Próximas Acciones (si tiene ctx), Asignadas, Ojalá Hoy, Vencidas, Calendario, Proyectos. DOC-REGLAS dice que deben esperar en Pausa hasta que se complete la predecesora; el código las duplica a propósito (comentario L399) y la UI las pinta según `displayStatus='paused-dep'`. (verificado: `M … #cx-Casa ⛔ idz` aparece en Próximas Acciones/cx-Casa y En Pausa)
5. **Calendario** (L335-336, L411-413), plana: `dateSymbol==='📅'` (fecha PRINCIPAL = primera del texto) Y `startTime` presente. No filtra por fecha: incluye pasadas y futuras. Ordenación final `sortCalendarTasks` (L521-540): `a.date.localeCompare(b.date)` ascendente; empate (o falta de fecha) → `startTime.localeCompare` con `'00:00'` por defecto. **Bug B-G1**: se comparan los strings crudos (`'10am'` < `'9am'`, `'10:00'` < `'9:00'`, `'3pm'` vs `'15:00'`), no minutos; debería usarse `parseTimeToMinutes`. (verificado) Además `console.log` en cada ordenación.
6. **Vencidas** (L416-418; helper L125-196), `Map<string,Task[]>` (clave compuesta con `|`): entra si `displayStatus==='overdue'` (§4.2: alguna fecha ⏳/📅 pasada; en tareas con dependencia el mismo criterio). No excluye de otras listas (una vencida con contexto sale en Vencidas Y en Próximas Acciones; sin ctx también en Inbox por la regla de fecha). Fecha de agrupación `overdueDate`: empieza = `task.date` (PRINCIPAL, aunque sea 🛫 o futura); luego, mirando SOLO `additionalDates`: si hay 📅 pasadas → la más reciente; si no, si hay ⏳ pasadas → la más reciente. **Bug B-G2**: la fecha principal 📅 pasada se ignora frente a un ⏳ adicional (prioridad "Due > Schedule" solo se aplica entre las adicionales). (verificado: `📅 ayer ⏳ hace3días #cx-Casa` se agrupa bajo el ⏳ de hace 3 días con etiqueta 📅). Claves:
   - modo `date-first` (defecto; también constante `OVERDUE_GROUPING_MODE`, L23; la vista usa `overdueGroupingMode`): `"📅 {fecha}|cx-{ctx}"` por CADA contexto; si no hay contextos, `"📅 {fecha}|px-{persona}"` por cada persona; si no `"📅 {fecha}|cx-Sin Contexto"`.
   - modo `context-first`: `"📋 cx-{ctx}|{fecha}"`, `"👤 px-{persona}|{fecha}"`, `"📋 cx-Sin Contexto|{fecha}"`.
   Orden visual: el HTML ordena claves primarias (por fecha asc. si empiezan con 📅, si no alfabético) y secundarias alfabéticamente (htmlGenerator.ts:L407-441). Contextos Y personas simultáneos: solo se usan contextos.
7. **Ojalá Hoy** (L420-455), `Map`:
   - Si `isCalendarToday` (📅 principal = hoy + `startTime`): clave `"📅 Agenda de Hoy"` (la tarea NO entra en los grupos por contexto). Orden: `sortHopeTodayTasksByTime` (L546-569) por `startTime` string (mismo bug B-G1); los demás grupos no se ordenan (solo `console.log`). DOC-REGLAS pide ordenar por 📅 > ⏳ y por prioridad: no implementado.
   - Si no, y (`isHopeTodayCandidate` o [dependencia sin resolver con `displayStatus==='paused-dep'` y (fecha principal de cualquier símbolo == hoy, o adicional ⏳/📅 == hoy)]): `isHopeTodayCandidate` = SIN `startTime` y (fecha principal ⏳/📅 == hoy, o alguna adicional ⏳/📅 == hoy). Claves: `cx-{ctx}` por contexto, `px-{persona}` por persona (una tarea con ambos aparece en ambos grupos), o `cx-Sin Contexto` si no tiene ninguno.
   - Una tarea 🛫-hoy sin ⏳/📅 NO entra en Ojalá Hoy (salvo el caso de dependencias).
   - Aparece como primera lista en la navegación si no está vacía.
8. **Asignadas o Delegadas** (L458-463), `Map` clave `px-{persona}`: `assignedPeople.length>0`, **independientemente de que tenga contexto**. (DOC-REGLAS: solo `#px` SIN `#cx`; el código es más amplio: `C #cx-Oficina #px-Ana` aparece en Próximas Acciones y Asignadas.) (verificado)
9. **Próximas Acciones** (L465-476), `Map`: por cada contexto `cx-{ctx}` — para CUALQUIER tarea con contexto, sin importar la fecha (una `📅` futura con ctx entra), salvo `paused-start` (que ya salió con `continue`) y fecha inválida. Sin contexto: solo si fecha principal es 🛫 pasada u hoy y no tiene persona → `cx-Sin Contexto` (y de paso Inbox por la regla de fecha). (verificado) DOC-REGLAS exige además fecha ≤ hoy; el código no.
10. **Proyectos** (L478-481), plana: `contexts` incluye `ProyectoGTD` o `Entregable`. Además aparece en Próximas Acciones (grupo `cx-ProyectoGTD`).

Detalles de conteo: los `count` de navegación para listas Map suman las longitudes de los arrays (L625), por lo que una tarea con 2 contextos cuenta 2.

Ordenación general: no existe ordenación por prioridad ni por fecha dentro de las listas (excepto Calendario y Agenda de Hoy); el orden es el de `getMarkdownFiles()` y luego el de línea. Las sublistas (claves del Map) se ordenan alfabéticamente en `generateNavigationItems` (L642 `.sort()`, orden UTF-16) y con `localeCompare` en el HTML (htmlGenerator.ts:L575-580).

### 4.4 Navegación (`generateNavigationItems`, L574-673)
- Orden: `[Ojalá Hoy si no vacía] + Vencidas, Bandeja de Entrada, Calendario, Proyectos, Próximas Acciones, Asignadas, En Pausa, Esta Semana No, Algún Día` (L590-609).
- Solo se emiten listas con total > 0. Ids: `gtd-list-{createAnchorId(nombre)}`; `createAnchorId` quita todo carácter fuera de `[a-z0-9\s-]` (quita acentos y emojis): `"Próximas Acciones"` → `prximas-acciones`, `"Algún Día / Tal Vez"` → `algn-da-tal-vez`. Riesgo de colisión entre contextos que solo difieren en acentos/símbolos (`Tél` y `Tl`).
- Etiqueta de sublista: clave sin prefijos `cx-/px-/#cx-/#px-` iniciales; para Vencidas queda la clave compuesta tal cual (`📅 2026-11-04|cx-Casa`) porque no empieza por `cx-`.
- Iconos de lista (L678-693): Inbox 📥, NextActions ➡️, Calendar 📅, HopeToday 🌟, Assigned 👥, Projects 💼, Someday 🕰️, ThisWeekNot ⛔, Paused ⏸️, Overdue ⚠️. Sublista (L698-720): persona 👤 si la clave empieza por `#px-`, `px-`, `@` o `px:`; si no 📋.

### 4.5 Detección de conflictos (resumen)
`Task.hasConflict` (§2.4) → Inbox. `hasInvalidDateConfiguration` (§4.2) → solo Inbox. No hay detección de: ciclos de dependencias, dependencia a id inexistente, ⏳ > 📅, hora sin fecha, `[hI::]` sin `📅`. La calendarización (`validateDateCoherence` en el selector de fecha) sí valida Start ≤ Schedule ≤ Due, pero solo en la UI al insertar (§6.6).

### 4.6 En progreso (inProgressProcessor.ts)
`processInProgressTasks(tasks, grouping, sorting)` (L67-149): filtra `status==='in-progress'` (L72) de TODAS las tareas (ya excluidas plantillas/adjuntos).
- `stats`: `total`; `overdue` = con `date` (cualquier símbolo, también 🛫) y `isDatePast`; `definedTimeMinutes` = suma de duraciones > 0; `estimatedTimeMinutes` = definidas + 20 por cada tarea sin duración (L83).
- `parseDuration` (L7-19): `/(\d+\.?\d*)\s*(h|min|m)/` → `h` ×60, otro = minutos; sin match/`undefined` → 0 (`"2h30min"` → 120, ignora el resto; `"1.5h"` → 90).
- `grouping==='none'` (L96-114): grupos en este orden de inserción: `🔴 Vencidas` (fecha pasada; orden por prioridad), `⭐ Prioridades de Hoy` (cualquier tarea con fecha NO pasada: hoy **o futura** — el nombre es engañoso), `Otras Tareas` (sin fecha). Los dos últimos se ordenan con `sorting`.
- `context`: claves `@{ctx}` (tarea repetida en cada contexto) o `Sin Contexto`; `person`: `@{persona}` o `Sin Asignar`; `project`: `getProjectGroupForTask` (L21-45): primer segmento de carpeta que empieza por `"PGTD - "` → `📂 {seg}`; si no, el ÚLTIMO segmento `"AI - "` → `🧠 {seg}`; si no, desde el más profundo el primero con prefijo `AV -`, `PQ -`, `RR -` → `🏠 {seg}`; si no la última carpeta → `📁 {carpeta}`; archivo en la raíz o sin `sourceFile` → `Tareas Generales`. Nota: aquí el prefijo es `"PGTD - "` (con guion), en StalledProjectService es `"PGTD "`.
- `sortTasks` (L47-65): `duration-asc`: sin duración = 9999 (al final); `duration-desc`: sin duración = 0 (al final); `priority`: Highest<High<Medium<Low<None, y solo si AMBAS tienen fecha desempata por `new Date(a.date)` asc.; en el resto devuelve 0. Comparador no transitivo cuando se mezclan tareas con/sin fecha del mismo nivel de prioridad (resultado dependiente de la implementación del sort).
- `Array.sort` es estable en V8, no hay desempate adicional.

### 4.7 Reglas propias del Journal (fuera del procesador GTD pero relacionadas)
`journalTaskRenderer.processTasksForDate(allTasks, targetDate)`: `completedToday` = `completed` y regex `✅\s*(\d{4}-\d{2}-\d{2})` sobre `content` == fecha objetivo; `inProgress` = `status==='in-progress'`; semanales con `task.week` (formato `YYYY-Wnn` sin corchetes; usa `moment().year(y).isoWeek(w).startOf('isoWeek')`); `blockedDependencies` = tiene `dependencies` y alguna no está completa o NO existe en el mapa (a diferencia de gtdProcessor, que NO bloquea por id inexistente; además aquí no se hace `replace(/^\^/,'')` del id); calendario si `startTime`, programadas hoy, vencidas (`date` < objetivo, cualquier símbolo incluido 🛫). Ordenaciones por hora (string), tipo (📅<⏳<🛫) y prioridad.

---

## 5. Construcción de la jerarquía (hierarchyBuilder.ts `buildHierarchy`, L59-158)

Entrada: lista plana de `HierarchicalItem` (una por nota). Algoritmo:
1. (L65-76) `noteMap[ruta sin .md] = item` y `allFolderPaths` = todos los prefijos de carpeta de cada ruta.
2. (L79-104) Para cada carpeta: busca la "folder note" `${carpeta}/${nombreCarpeta}` (misma convención que "Folder Notes": `PGTD - X/PGTD - X.md`). Si existe, esa nota REPRESENTA a la carpeta (`hierarchyMap[carpeta] = nota`); si no, crea un placeholder `{id: carpeta, type:'Ax', name:'[FALTA] <nombreCarpeta>', isNoteMissing:true, sin file}`.
3. (L106-117) Añade al mapa el resto de notas bajo su ruta sin extensión, salvo las que ya figuran como folder-note de su carpeta (comprobación `hierarchyMap.get(carpetaPadre) === note`).
4. (L119-132) Enlaza cada elemento con el elemento cuyo clave es la ruta padre (`key` sin último segmento) → `children.push`, `item.parent`.
5. (L134-151) Raíces = items sin padre; se cuelgan de una raíz virtual `{id:'root', type:'Root', name:'Vault'}`.
6. `calculateTaskCountsRecursive` (L40-52): `descendantTaskCount = Σ hijos (own + descendant)`; hoja = 0. `ownTaskCount` viene del parser (abiertas, incl. `/`). Los placeholders aportan 0 propio.
7. `sortChildrenRecursive` (L11-38): nivel 0 (hijos de la raíz virtual) → `name.localeCompare` (los `[FALTA]` salen antes que los nombres alfanuméricos); niveles ≥ 1 → `TYPE_ORDER` (Root0, GrupoAV1, AV2, AI3, PQ4, PGTD5, Cp6, EMkt7, RR8, Ax9, Tx10, Reu11, Rf12, Sue13, Vx14, RT15, RL16, Dly17, Wk18, M19, Q20, H21, Y22; `?? 99`); luego si AMBOS tienen `frontmatter.estado` y difiere → `localeCompare` del string (emojis); luego **siempre** `b.file.stat.ctime - a.file.stat.ctime` (más reciente primero) si ambos tienen archivo (el comentario dice "si los nombres son iguales" pero no es condicional); por último nombre. El criterio de `estado` solo aplica cuando ambos lo tienen, lo que hace el comparador no transitivo en conjuntos mixtos.
Retorna `[virtualRoot]`.

Verificado con ejemplo (items: `01 - Prod/01 - Prod.md`(GrupoAV), `.../AV - Foo/AV - Foo.md`, `.../PGTD - P1/PGTD - P1.md`+`Ax nota.md`+`RR - R.md`, `02 - Sin/Ax suelta.md`, `Foo.md`, `Foo/Bar.md`, `Raiz.md`): árbol = `[FALTA] 02 - Sin`, `[FALTA] Foo`, `01 - Prod`(GrupoAV)→`AV - Foo`→`PGTD - P1`→(`RR - R` antes que `Ax nota`), `Raiz`.

**Bug B-H1 (medio): colisión nota-hermana/carpeta.** Una nota `X.md` junto a una carpeta `X/` SIN folder-note (o `A/B.md` junto a `A/B/B.md`) comparte clave `X` con la carpeta: el paso 3 hace `hierarchyMap.has(path)` y DESCARTA la nota. En el ejemplo `Foo.md` (9 tareas) desaparece del árbol y de los conteos (root.descendantTaskCount=15 sin esas 9), aunque sigue en `allTasks`/listas GTD. (verificado)
Otros: carpetas que solo contienen archivos excluidos no aparecen; `item.parent` crea referencias circulares (OK para GC). `TYPE_ORDER` depende del tipo, y los placeholders son `Ax`.

---

## 6. Estancados, selección de tareas y escritura en ficheros

### 6.1 `StalledProjectService` (stalledProjectService.ts)
Definición (doc L14-18): proyecto activo (`estado: 🟢`) sin ninguna tarea abierta en su jerarquía.
- `findStalledProjects` (L33-74): `vault.getAllLoadedFiles()` filtrado a `TFolder`; candidatas = `folder.name.startsWith('PGTD ')` (a cualquier profundidad; incluye PGTD anidados); la nota principal debe ser la folder-note `"{folder.path}/{folder.name}.md"` (TFile); si no existe se omite con log. Devuelve `{path, file, name}`.
- `isProjectActive` (L81-84): `metadataCache.getFileCache(file)?.frontmatter?.['estado'] === '🟢'` (igualdad exacta del emoji; un selector de variación o espacio rompe la comparación).
- `projectHasOpenTasks` (L91-130): recolecta archivos (abajo) y para cada `.md` hace `vault.cachedRead` + `parseTasks` (de **focoParser**) y sale al primer `!task.completed` (cuenta también `[/]`). Cualquier excepción general → `true` (conservador); excepción en un archivo → continúa.
- `collectProjectHierarchyFiles` (L138-191): (1) TODOS los `.md` de la carpeta del proyecto y subcarpetas (recursivo); (2) más los archivos enlazados saliente (`metadataCache.getCache(path).links` → `getFirstLinkpathDest(link.link, file.path)`, solo `.md`) a **2 niveles** (nivel 1 desde los archivos de la carpeta; nivel 2 solo desde los del nivel 1), sin repetir.
- Implicaciones: (a) los archivos alcanzados por enlaces (p. ej. una nota `AV - ...`, una persona, un diario) cuentan: cualquier tarea abierta en una nota enlazada hasta 2 saltos evita que el proyecto salga como estancado (falsos negativos); (b) tareas con checkbox `[-]`, `[!]`... no existen para el parser, un proyecto solo con ellas sale estancado; (c) enlaces con `#sección` pueden no resolverse porque no usa `getLinkpath` (a verificar en Obsidian, no pude ejecutarlo); (d) solo `links`, no `embeds` ni enlaces de frontmatter; (e) decenas de `console.log` por proyecto/archivo.
- Consumidor: `reviewPanelView` (comando "Revisión GTD: Encontrar proyectos estancados", main.ts:L159-166).

### 6.2 `TaskSelectionAnalyzer` (taskSelectionAnalyzer.ts)
Regex de línea de tarea propia (L44, L100, L110, L147): `/^(\s*)-\s\[([\s\/xX!?*+-])\]\s*(.*)$/` (una sola `\s` tras `-`, estados admitidos: espacio/blanco, `/`, `x`, `X`, `!`, `?`, `*`, `+`, `-`). Diferencias con el parser: acepta `!?*+-` como estados "other"; NO acepta `-   [ ]` (varios espacios); exige `$` (falla con `\r`).
- `analyzeSelection(editor)` (L18-76): requiere selección no vacía de UNA sola línea (si multi-línea: error "Verifica la tarea..."); si la línea no encaja: error "La selección en la nota no es una tarea..."; devuelve `{isValid, taskContent (texto crudo tras el checkbox, con todos los metadatos), lineNumber (0-based, de la selección), taskState: open|in-progress|completed|other, fullLine}`.
- `isValidTaskLine(line)`: encaja y contenido no vacío. `extractTaskContent(line)`: contenido recortado. `getTaskState(line)`: `open` (` `), `in-progress` (`/`), `completed` (`x|X`), `other` (resto, incluida tabulación) o `null` si no es tarea.
- `changeTaskStateToInProgress(editor, lineNumber, currentLine)` (L121-140): solo si `/^(\s*-\s\[)( )(\]\s*.*)$/`; sustituye con `editor.replaceRange` (edición en el editor, no en disco).

### 6.3 `TaskStateManager` (taskStateManager.ts): cómo se marca/cierra una tarea
Localización de la línea = **por texto, no por número de línea** (el `lineNumber` del Task no se usa aquí):
- `findTaskLine(lines, taskDescription, allowedStates)` (L153-180):
  1. Si hay descripción: primera línea con `isValidTaskLine` cuyo `extractTaskContent(line).includes(taskDescription)` (subcadena, case-sensitive) y cuyo estado está en `allowedStates`.
  2. **Fallback**: si no hubo coincidencia (o no hay descripción) → la PRIMERA línea del archivo cuyo estado esté permitido (`open`/`in-progress` para cerrar; `open` para poner en progreso), ¡aunque sea otra tarea!.
- `closeTask(path, desc)` (L22-69): `vault.getAbstractFileByPath` → `vault.read` → `split('\n')` → busca (`['open','in-progress']`) → si ya está `completed` retorna `false` → `createCompletedTaskLine` → `lines.join('\n')` → `vault.modify`.
- `createCompletedTaskLine` (L188-204): regex `/^(\s*-\s\[)[\s\/xX!?*+-](\]\s*.*)$/` → reemplaza el carácter de estado por `x` y, si la línea NO contiene `✅` en ningún sitio, hace `newLine.trimEnd() + ' ✅ ' + YYYY-MM-DD` (fecha local `moment().format('YYYY-MM-DD')`). Ej.: `- [/] llamar ⏳ 2025-03-01 🆔 a1` → `- [x] llamar ⏳ 2025-03-01 🆔 a1 ✅ 2026-11-05`. No elimina la fecha, ni toca recurrencias (🔁 no genera la siguiente instancia), ni deja `[-]`.
- `setTaskInProgress` (L77-123): estados `['open']`; `replace(/^(\s*-\s\[)\s(\]\s*.*)$/, '$1/$2')`; si no cambia nada → `false`.
- `isSpecificTask(path, desc)` (L132-144): `true` si hay descripción distinta del nombre del archivo, de la ruta y no vacía (para distinguir "registrar tiempo en una nota" vs "en una tarea").
- Qué se pasa como `taskDescription`: desde selección en editor = texto CRUDO tras el checkbox (con emojis); desde nota activa = `basename` (entonces `isSpecificTask`=false); desde el time tracker view (timeTrackerView.ts:L313) = el `taskDescription` que le llegue (origen exacto no verificado; si fuese el `content` limpio de `Task`, aplica B-S1 por el doble espacio).
- Notificación de errores: `console.warn/log` y `Notice` solo en excepción.

Bugs del manager (B-S*):
- **B-S1 (alto) Fallback "primera tarea abierta del archivo"**: si la descripción no coincide (p. ej. la tarea se editó, o se pasó `content` limpio con doble espacio por token eliminado — `"foo 📅 2025-03-25 bar"`.includes(`"foo  bar"`) = `false`), se cierra/pone en progreso OTRA tarea (la primera abierta del archivo). Igualmente, si la descripción solo coincide con una línea ya completada, el fallback cierra otra.
- **B-S2 (medio) Coincidencia por subcadena**: `"Llamar"` coincide con `"Llamar a Pedro"` y `"Llamar a Juan"`; gana la primera.
- **B-S3 (medio) Regex incompatibles con el parser**: el manager exige `-\s\[` (un solo espacio) y `$`; el parser acepta `-\s+\[`. Tareas con 2+ espacios tras `-` (verificado: `-  [ ] foo`) o con fin de línea CRLF (verificado: `"- [ ] foo\r"` no encaja) NO pueden cerrarse ni pasarse a `[/]` desde el plugin (devuelve false / "No se pudo crear la línea").
- **B-S4 (medio) Se añade `✅ fecha` DESPUÉS de un id de bloque Obsidian** (`- [x] foo ^abc ✅ 2026-11-05`): el `^abc` deja de estar al final de línea y Obsidian ya no lo reconoce como block-id (el parser del plugin sí, porque cuenta `^` en cualquier lugar). Con `🆔 abc ✅ ...` no hay problema.
- **B-S5 (medio) Condiciones de carrera**: lectura+modificación completa del archivo con `vault.read/modify` en lugar de `vault.process` (atómico); si el usuario edita el archivo entre medias se pierden cambios.
- **B-S6 (bajo) Lógica triplicada**: `timeLogModal.closeTaskInFile` y `pomodoroModal.closeSessionTask` reimplementan lo mismo (con ligeras diferencias: no filtran por estado permitido al buscar por descripción, por lo que pueden "cerrar" una línea ya completada y descubrirlo después).
- **B-S7 (bajo)** El manager considera válidos estados `!?*+-` para cerrar (`createCompletedTaskLine`), el parser no los ve como tareas.

### 6.4 Resumen del punto de escritura
Única mutación del texto de una tarea: (a) `[ ]`→`[/]` (setTaskInProgress / editor), (b) `[ ]|[/]`→`[x]` + ` ✅ YYYY-MM-DD` (closeTask). Ninguna mutación toca fechas, ids, ni metadatos; no existe "editar tarea" (cambiar fecha/contexto) en este núcleo salvo el insertor del Smart Inbox/selector de fecha (`CalendarDataProvider.formatDateForInsertion`).

### 6.5 `dateUtils.ts`, `durationUtils.ts`, `colorUtils.ts`
- `dateUtils`: ver §4.1. Funciones puras salvo por el reloj (`moment()` interno).
- `formatDuration(minutes, asHoursMinutes=false)`: `asHoursMinutes` → `HH:mm` con relleno de 2 (`125`→`02:05`, `0`→`00:00`); si no: `<1`→`'< 1 min'`; `<60`→`'N min'`; múltiplos de 60→`'N h'`; si no `'N h M min'`. No redondea decimales (verificado: `formatDuration(0.5,true)`=`"00:0.5"`).
- `generateColorFromString(str)`: hash `h = ch + ((h<<5)-h)` (32-bit); paleta curada de 10 pares (H,S) `[[210,80],[160,65],[30,90],[340,85],[260,75],[50,80],[190,70],[0,75],[130,60],[300,70]]`; color = `paleta[|h| % 10]`; luz = `85 + (|h >> 10| % 8)`; devuelve `hsl(H, S%, L%)`. (verificado: `""`→`hsl(210, 80%, 85%)`, `"abc"`→`hsl(260, 75%, 91%)`, `"Dovela"`→`hsl(340, 85%, 86%)`, `"PGTD - X"`→`hsl(130, 60%, 85%)`.)

### 6.6 `CalendarDataProvider` / `calendarTypes.ts` (selector de fechas, UI)
- `DateType` = `START='start' | SCHEDULE='schedule' | DUE='due'`; `getDateTypeOptions` mapea a 🛫 Start, ⏳ Schedule, 📅 Due.
- `getQuickDateOptions` (L30-78): Hoy; Mañana; Esta Semana = viernes de la semana (`day(5)`; si ya pasó, +1 semana); Próxima Semana = viernes de la semana siguiente; Próximo Mes = hoy +1 mes. Los `getDate()` conservan la hora actual del día (no `startOf('day')`).
- `getCalendarDates(viewDate, selectedDate)` (L80-115): rejilla desde `startOf('week')` del 1.º del mes hasta `endOf('week')` del último, con `isCurrentMonth/isToday/isPast/isSelected`. `startOf('week')` depende del locale de moment, pero `getWeekdayNames()` es fijo `['L','M','M','J','V','S','D']` (lunes primero): si el locale arranca en domingo la cabecera queda desalineada (bug latente).
- `formatDateForInsertion(date,type)` → `"{icono} YYYY-MM-DD"` (fallback 📅 si tipo desconocido).
- `validateDateCoherence(newDate,newType,existing[])` (L128-173): comprueba Start ≤ Schedule, Schedule ≤ Due, Start ≤ Due con `isAfter` SIN granularidad de día (`moment.isAfter` por milisegundos). **Bug B-C1**: una fecha elegida con "Hoy" (con la hora actual) frente a una fecha existente del mismo día parseada a 00:00 se considera posterior → falso aviso (p. ej. nuevo Schedule=hoy 15:30 vs Due=hoy 00:00). Devuelve `{isValid:false, warning, suggestion}` en la primera violación.
- `parseExistingDatesFromText` (L175-199): regex `/🛫\s+(\d{4}-\d{2}-\d{2})/g` etc. con `\s+` (mín. un espacio; el parser usa `\s*`), solo fechas válidas.
- `getMonthName`: `format('MMMM YYYY')`; `navigateMonth`: ±1 mes.

---

## 7. Costes de rendimiento y memoria

### 7.1 Qué se re-parsea y cuándo (TODO es "reparsear el vault completo")
- `GtdView.drawView()` (view.ts:L130-199) ejecuta `parseVault` + `buildHierarchy` + `processGtdLists` + `processInProgressTasks` + generación del HTML completo en CADA llamada: apertura (L54), cambio de pestaña interna (L624), botón Refrescar (L627), agrupar y ordenar En Progreso (L642, L653), alternar modo de Vencidas (L707) y `switchToTimeTrackerView` (L67). Se computa todo (también la jerarquía y la lista GTD) aunque la pestaña activa sea Statistics/Timeline. No hay caché ni invalidación por eventos: la vista NO se suscribe a cambios del vault; solo se actualiza manualmente.
- `handleDependencyLinkClick` (view.ts:L80-105) re-parsea el vault entero para localizar una sola tarea.
- `main.loadAvailableTasks` (main.ts:L560) → `parseVault` completo: en `onLayoutReady` (L77), cada vez que se abre `TimeLogModal` (timeLogModal.ts:L161,174) y cada cambio de fuente en `TimeTrackerView` (L139,152).
- Journal/Weekly: `parseVault` en cada render de bloque (journalTaskRenderer.ts:L23, weeklyTaskRenderer.ts:L27, journalAPI.ts:L244). Un dashboard con N bloques `dataviewjs` = N parseos completos.
- `StalledProjectService`: lectura de los archivos de cada proyecto activo + 2 niveles de enlaces, sin caché; I/O secuencial.
- `checkInProgressTasks` (view.ts:L1006): una lectura de archivo por elemento marcado tras cada render.
- `main.handleFileChange` (L580-594): en CADA evento `modify` de cualquier archivo ejecuta `collectMetadata()` (L293), O(F) archivos + recorrido de todos los tags (con autoguardado cada pocos segundos mientras se escribe) → coste constante en segundo plano; además `rename`/`delete` también.
- Poll de `data.json` cada 15 s con lectura+`JSON.parse` incluso inactivo (L821).

### 7.2 Complejidad
- `parseVault`: O(F) lecturas **secuenciales** (latencia de I/O acumulada; sin `Promise.all`) + O(L) regex por línea (1 regex de línea; ~12-14 regex adicionales solo en líneas de tarea). `allTasks = allTasks.concat(tasks)` (L256) copia el array acumulado en cada archivo: O(F·T) copias (debería ser `push(...)`/acumulación única).
- `buildHierarchy`: O(F·profundidad) + ordenaciones O(n log n) por nivel; `localeCompare` en comparadores (caro con ICU).
- `processGtdLists`: por tarea abierta, el fallback `inAnyList` (L484-493) hace `Calendar.includes(task)` y, para 4 mapas, `Array.from(map.values()).some(arr => arr.includes(task))` → O(N) por tarea → **O(N²)** total en el peor caso (N = tareas abiertas), además de crear arrays temporales. Se podría reemplazar por un booleano `placed` o un `Set`.
- Cada `isDatePast/Today/Future` crea 2 objetos `moment` y parsea con formato; se llaman varias veces por tarea (displayStatus, validación, Inbox, Hope Today, Next Actions, Overdue) → decenas de miles de objetos `moment` por render con miles de tareas; se podría precalcular "hoy" una vez.
- `console.log` en rutas calientes (sort de Calendario y Agenda, cada grupo de Ojalá Hoy, StalledProjectService, parser Foco con cientos de logs "DEBUG").
- Generación de HTML: se renderizan TODAS las tareas de todas las listas como un único string inyectado con `innerHTML` (sin virtualización); una tarea con 2 contextos se renderiza 2 veces (y otra en Vencidas, etc.).
- `StalledProjectService`: O(carpetas PGTD × archivos de la jerarquía × tamaño), con early-exit; los enlaces a 2 niveles pueden arrastrar buena parte del vault.

### 7.3 Memoria
- Cada parseo crea un grafo completo: todos los `Task` (con `content` y arrays), un `HierarchicalItem` por nota, `parent`↔`children` circulares (recolectable por el GC al soltar la referencia). `drawView` no guarda `parsedData` tras renderizar (variables locales) → no hay fuga directa en la vista.
- Retenciones: `plugin.availableTasks` (main.ts:L37, L560-578) conserva un array de `Task`/`TFile` hasta el siguiente `loadAvailableTasks`; `focoParser` mantiene un `Map` global `noteOriginMap` (focoParser.ts:L164); `gtdProjectsAndAreas/gtdContextTags/gtdPersonTags` en el plugin. `Task.sourceFile` referencia el `TFile` vivo (compartido, no se duplica).
- Listeners: la vista añade listeners de click/scroll/input en cada `drawView`, pero los liga a `eventAbortController.signal` y aborta el anterior al inicio de `drawView` (view.ts:L131-132) → sin acumulación. Hay temporizadores (`setInterval` del timer en main.ts:L603 y TimeTrackerView) que se limpian en `clearActiveTimer`/`clearTimerInterval`; no encontré otras fugas evidentes en el núcleo, pero el `setTimeout(checkInProgressTasks)` (L193) no se cancela si la vista se cierra antes de 100 ms.
- Strings: `content` y las claves duplicadas por contexto; el HTML completo (puede ser MB con miles de tareas).
- `DEFAULT_SETTINGS` mutable compartido (ver §3.6) es un riesgo de estado global, no de memoria.

---

## 8. Funciones puras candidatas a pruebas unitarias y casos de prueba

Hoy NO hay test runner (package.json no define `test`). La mayoría están sin exportar; se listan con el cambio necesario. Dependencias externas: `moment` (se puede usar real + fake timers), `obsidian` (solo tipos en pura lógica; `TFile`, `Vault` deben stubearse; `parser.ts` importa `obsidian` como valor `TFile,Vault,MetadataCache` solo para tipos → sustituir por `import type`).

### 8.1 Lista
| Función | Archivo | Exportada | Notas |
|---------|---------|-----------|-------|
| `parseTasks(content, file)` | parser.ts:L80 | no (exportar) | núcleo; necesita `crypto.randomUUID` |
| `parseTimeToMinutes(str)` | parser.ts:L52 | no | pura |
| `determineItemType(file, metadataCache)` | parser.ts:L26 | no | stub de metadataCache |
| `shouldBeExcluded(file)` | parser.ts:L39 | no | pura con `{path,extension}` |
| `isDatePast/Today/Future`, `isWeekPast/Today/Future` | dateUtils.ts | sí | depende del reloj (fijar fecha) |
| `hasUnresolvedDependencies` | gtdProcessor.ts:L45 | no | pura |
| `getRegularTaskDisplayStatus`, `getDependentTaskDisplayStatus` | gtdProcessor.ts:L56,L201 | no | dependen de reloj |
| `addTaskToOverdueWithGrouping` | gtdProcessor.ts:L125 | no | muta Map |
| `processGtdLists` | gtdProcessor.ts:L259 | sí | principal; también muta `task.displayStatus` |
| `sortCalendarTasks`, `sortHopeTodayTasksByTime`, `generateNavigationItems`, `getListIcon`, `getSublistIcon` | gtdProcessor.ts | no | puras |
| `buildHierarchy` | hierarchyBuilder.ts:L59 | sí | stubs `{file:{path,stat:{ctime}}}` |
| `processInProgressTasks` | inProgressProcessor.ts:L67 | sí | reloj para `isDatePast` |
| `parseDuration`, `getProjectGroupForTask`, `sortTasks` | inProgressProcessor.ts | no | puras |
| `formatDuration`, `generateColorFromString` | durationUtils / colorUtils | sí | puras |
| `TaskSelectionAnalyzer.isValidTaskLine/extractTaskContent/getTaskState` | taskSelectionAnalyzer.ts | sí (static) | puras |
| `TaskStateManager.createCompletedTaskLine`, `findTaskLine`, `isSpecificTask` | taskStateManager.ts | private (`isSpecificTask` público) | extraer a funciones puras |
| `CalendarDataProvider.*` (`formatDateForInsertion`, `validateDateCoherence`, `parseExistingDatesFromText`, `getCalendarDates`, `getQuickDateOptions`, `navigateMonth`) | calendarDataProvider.ts | sí | `moment` |

### 8.2 Casos de prueba (entrada → salida esperada), basados en el código real

**parseTasks** (todos verificados, ver §2.6): usar la tabla de §2.6 como fixtures. Adicionales:
- `"- [X] mayus"` → `status:'completed'`, `completed:true`.
- `"- [x]  texto con [X]"` → `content:"texto con [X]"` (dos espacios tras `]` permitidos).
- `"- [ ] x [1.5h] [45 min] [2h]"` → `duration:"2h"`, `content:"x [1.5h] [45 min]"` (caso que documenta B-P5).
- `"- [ ] foo 📅2025-03-25bar"` → `date:"2025-03-25"`, `dateSymbol:"📅"`, `content:"foo bar"`.
- `"- [ ] rango ⏳ 2025-13-45"` → `date:"2025-13-45"` (sin validar).
- Regresión deseada (fallan hoy): `#cx-Teléfono` → `contexts:["Teléfono"]`; `2^10` → no debe fijar id; `⛔ ^dep1 🆔 me1` → `id:"me1", dependencies:["^dep1"]`.

**parseTimeToMinutes** (verificado): `'10am'→600`, `'9am'→540`, `'12am'→0`, `'12pm'→720`, `'13pm'→780`, `'10:30'→630`, `'25:99'→1599`, `'9'→null`, `'3:5pm'→1020`, `'12:30 am'→30`, `'0am'→0`, `undefined/''→null`.

**shouldBeExcluded**: `{path:'x/99 - Adjuntos/a.md',extension:'md'}`→true; `{path:'x/99 - Adjuntos.md',...}`→false (el segmento es `99 - Adjuntos.md`, no coincide); `{path:'03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/Plantillas/t.md'}`→true; `extension:'png'`→true.

**determineItemType** (con basename/frontmatter): `{fm:{type:'Dly'}, basename:'2025-11-05'}`→`Dly`; `basename:'PGTD - Web'`→`PGTD`; `basename:'PGTD-Web'`→`Ax`; `{fm:{type:'PGTD'}, basename:'Nota'}`→`Ax` (el frontmatter PGTD se ignora); `basename:'AV - Vida'`→`AV`.

**Fechas** (fijar "hoy" = 2026-11-05 con `jest.useFakeTimers/vi.setSystemTime`): `isDatePast('2026-11-04')=true`, `isDateToday('2026-11-05')=true`, `isDateFuture('2026-11-06')=true`; inválida `'2026-13-45'` → las tres `false`; `isWeekToday('[[2026-W45]]')=true` (5-nov-2026 es ISO W45), `isWeekPast('[[2026-W44]]')=true`, `isWeekFuture('[[2026-W46]]')=true`; `isWeekPast('2026-W44')=false` (formato sin corchetes: documenta B-P6).

**displayStatus** (hoy = 2026-11-05, `dep` ausente de mapa salvo se indique):
- sin fecha → `null`; `📅 2026-11-04` → `overdue`; `⏳ 2026-11-05` → `today`; `🛫 2026-11-06` → `paused-start`; `🛫 2026-11-04` solo → `null`; `🛫 2026-11-05` solo → `today`; `📅 2026-11-04` + `🛫 2026-11-06` (primaria 📅) → `overdue`.
- con dependencia no completada y sin fecha → `paused-dep`; con `📅` pasada → `overdue`; con `📅` futura → `paused-dep`; dependencia completada → como regular; dependencia con id inexistente → como regular.
- fecha inválida de configuración (`🛫 2026-11-10 📅 2026-11-08`) → `displayStatus=null` y solo en Inbox.

**processGtdLists** (escenario de §4 ejecutado el 2026-11-05; hoy=H, ayer=Y, mañana=T, +5d=T2). Resultado verificado:
| Tarea (resumen) | Listas esperadas |
|---|---|
| `A` sin metadatos | Inbox (fallback) |
| `B #cx-Oficina` | Próximas/cx-Oficina |
| `C #cx-Oficina #px-Ana` | Próximas/cx-Oficina **y** Asignadas/px-Ana |
| `D #px-Ana` | Asignadas/px-Ana |
| `E 📅 H` (sin ctx) | Inbox + Ojalá Hoy/cx-Sin Contexto |
| `F ⏳ H #cx-Casa` | Ojalá Hoy/cx-Casa + Próximas/cx-Casa |
| `G 📅 Y #cx-Casa` | Vencidas `📅 Y|cx-Casa` + Próximas/cx-Casa |
| `H ⏳ Y` (sin ctx) | Inbox + Vencidas `📅 Y|cx-Sin Contexto` |
| `I #cx-Casa 🛫 T` | solo En Pausa (displayStatus `paused-start`) |
| `J 🛫 Y` (sin ctx) | Inbox + Próximas/cx-Sin Contexto |
| `K 📅 H [hI:: 10am] #cx-Casa` | Calendario + Ojalá Hoy/"📅 Agenda de Hoy" + Próximas/cx-Casa |
| `L 📅 T [hI:: 9am]` | Calendario (no Inbox) |
| `M #cx-Casa ⛔ idz` (idz abierta) | En Pausa + Próximas/cx-Casa; displayStatus `paused-dep` |
| `Z 🆔 idz` | Inbox |
| `N #GTD-AlgunDia #cx-Casa` | solo Algún Día |
| `O #cx-ProyectoGTD` | Proyectos + Próximas/cx-ProyectoGTD |
| `P 🛫 T2 📅 T` (start > due) | solo Inbox (displayStatus null) |
| `Q 📅 T2 #cx-Casa` | Próximas/cx-Casa |
| `R 📅 Y ⏳ Y-2 #cx-Casa` | Vencidas bajo `📅 Y-2|cx-Casa` (bug B-G2) + Próximas |
| `S [w:: [[2099-W01]]] #cx-Casa` | Próximas/cx-Casa (bug B-P6: debería ir a En Pausa) |
| `T [/] ⏳ H #cx-Casa` | Ojalá Hoy/cx-Casa + Próximas/cx-Casa |
| `U 📅 T2` (sin ctx) | Inbox (fallback) |
Navegación de ese escenario (verificada): orden `Ojalá Hoy, Vencidas, Bandeja, Calendario, Proyectos, Próximas, Asignadas, En Pausa, Algún Día`; ids `gtd-list-ojal-hoy`, `gtd-list-prximas-acciones`, `gtd-list-algn-da-tal-vez`; Próximas Acciones count=12 (suma de entradas, no tareas únicas).
Tests simples adicionales: tarea completada → en ninguna lista; `inbox` tag → Inbox aunque tenga ctx; `GTD-AlgunDia` + `inbox` → solo Algún Día; `hasConflict` → Inbox y además sigue a Próximas si tiene ctx; contexto duplicado `#cx-a #cx-a` → dos entradas en `cx-a`.

**sortCalendarTasks / sortHopeToday** (documenta B-G1): `[{date:'2026-11-05',startTime:'10am'},{date:'2026-11-05',startTime:'9am'}]` → hoy queda `[10am, 9am]` (incorrecto; esperado `[9am,10am]`); `['9:00','10:00']` idem; fechas distintas ordenan bien.

**addTaskToOverdue / modos**: `date-first`, tarea `📅 2026-11-04 #cx-A #cx-B` → claves `"📅 2026-11-04|cx-A"` y `"📅 2026-11-04|cx-B"`; solo persona → `"📅 …|px-Ana"`; sin nada → `"📅 …|cx-Sin Contexto"`; `context-first` → `"📋 cx-A|2026-11-04"`, `"👤 px-Ana|2026-11-04"`, `"📋 cx-Sin Contexto|2026-11-04"`.

**buildHierarchy** (verificado): ver §5: árbol, conteos (`01 - Prod` own=1/desc=10; `AV - Foo` own=2/desc=8; `PGTD - P1` own=3/desc=5), orden `RR` antes que `Ax`, placeholders `[FALTA] 02 - Sin`/`[FALTA] Foo` con `isNoteMissing`, y regresión B-H1 (`Foo.md` debería aparecer; hoy se pierde). Casos: nota con `estado` 🟢 vs ⚫ del mismo tipo; ctime más reciente primero entre pares sin estado.

**processInProgressTasks** (verificado): tareas `[/]`: a(`date 2000-01-01`, Low), b(`date 2999-01-01`, `30min`), c(`1h`, ctx x,y), d(incomplete) → `grouping='none'`: `{"🔴 Vencidas":[a], "⭐ Prioridades de Hoy":[b], "Otras Tareas":[c]}`, stats `{total:3, overdue:1, definedTimeMinutes:90, estimatedTimeMinutes:110}` (a no tiene duración → +20); `context` → `{"Sin Contexto":[a,b],"@x":[c],"@y":[c]}`; `project` con ruta `A/PGTD - X/n.md` → `{"📂 PGTD - X":[b,c,a]}` con `duration-asc` (b=30, c=60, a=9999). `parseDuration`: `'30min'→30`, `'1h'→60`, `'1.5h'→90`, `'45m'→45`, `''/undefined→0`, `'2h30min'→120`. `getProjectGroupForTask`: `'AV - V/AI - K/AI - Sub/x.md'→'🧠 AI - Sub'`, `'AV - V/PQ - Q/Carp/x.md'→'🏠 PQ - Q'`, `'Carp/x.md'→'📁 Carp'`, `'x.md'→'Tareas Generales'`, sin sourceFile → `'Tareas Generales'`.

**formatDuration** (verificado): `0→'< 1 min'`, `1→'1 min'`, `59→'59 min'`, `60→'1 h'`, `61→'1 h 1 min'`, `120→'2 h'`, `125→'2 h 5 min'`; `asHoursMinutes`: `0→'00:00'`, `59→'00:59'`, `60→'01:00'`, `125→'02:05'`.

**generateColorFromString** (verificado): `''→'hsl(210, 80%, 85%)'`, `'abc'→'hsl(260, 75%, 91%)'`, `'Dovela'→'hsl(340, 85%, 86%)'`, `'PGTD - X'→'hsl(130, 60%, 85%)'`; propiedad: siempre `hsl(H, S%, L%)` con L ∈ [85,92] y determinista.

**TaskSelectionAnalyzer.getTaskState / isValidTaskLine** (por regex; `-\s\[([\s\/xX!?*+-])\]\s*(.*)$`): `"- [ ] a"→'open'`; `"- [/] a"→'in-progress'`; `"- [x] a"|"- [X] a"→'completed'`; `"- [-] a"|"- [!] a"→'other'`; `"-  [ ] a"→null`; `"- [ ] a\r"→null`; `isValidTaskLine("- [ ] ")→false`.

**createCompletedTaskLine** (extraer): `("- [ ] foo", "2026-11-05")→"- [x] foo ✅ 2026-11-05"`; `("  - [/] foo 🆔 a1")→"  - [x] foo 🆔 a1 ✅ 2026-11-05"`; línea que ya contiene `✅` → solo cambia el estado; `("- [!] foo")→"- [x] foo ✅ …"`; no tarea → `null`; `"- [ ] foo ^abc"` → `"- [x] foo ^abc ✅ 2026-11-05"` (documenta B-S4).

**findTaskLine** (extraer): lines=[`"- [x] a"`,`"- [ ] b"`,`"- [ ] c"`], desc `"c"`, estados `['open','in-progress']` → 2; desc `"zzz"` → 1 (fallback peligroso, B-S1); desc `"a"` (solo coincide con completada) → 1; desc `"b"` con `-  [ ] b` (dos espacios) → -1 si no hay otra abierta.

**CalendarDataProvider**: `formatDateForInsertion(new Date(2026,10,5), START)→'🛫 2026-11-05'`, `SCHEDULE→'⏳ …'`, `DUE→'📅 …'`; `validateDateCoherence(2026-11-10,START,[SCHEDULE 2026-11-05])→{isValid:false}`; `(2026-11-05 00:00,SCHEDULE,[DUE 2026-11-05 00:00])→{isValid:true}` pero `(2026-11-05 15:30,SCHEDULE,[DUE 2026-11-05 00:00])→{isValid:false}` (B-C1); `parseExistingDatesFromText('📅 2026-11-05 ⏳ 2026-11-04')` → `[{SCHEDULE 2026-11-04},{DUE 2026-11-05}]` (el orden de salida es por patrón START, SCHEDULE, DUE, no por posición en el texto); `getCalendarDates` para nov-2026 devuelve múltiplos de 7 con `isCurrentMonth` solo del mes; `getQuickDateOptions()[2]` ('Esta Semana') devuelve viernes (o el siguiente si ya pasó); `navigateMonth` ±1.

---

## 9. Resumen consolidado de bugs/ambigüedades y divergencias con DOC-REGLAS

### 9.1 Severidad alta
1. B-P1 acentos/ñ truncan `#cx-`/`#px-` (ej. `Teléfono`→`Tel`).
2. B-P2 `^` en cualquier lugar = id (`2^10`).
3. B-P3 `⛔ ^id` antes de `🆔` roba el id y pierde la dependencia.
4. B-P6 `week` sin corchetes vs `dateUtils`: reglas de semana (En Pausa por semana futura, Inbox por semana pasada) completamente inoperantes.
5. B-S1 fallback del TaskStateManager cierra/pone en progreso la primera tarea abierta del archivo cuando no encuentra la descripción.
6. B-P4 ids aleatorios no estables / colisiones (dependencias solo funcionan con ids explícitos y únicos).

### 9.2 Severidad media
B-G1 orden de Calendario/Agenda por string; B-G2 prioridad Due>Schedule ignora la fecha principal en Vencidas; B-P5 duración solo entera (el doc dice `1.5h`); B-P7 fecha principal por orden de aparición; B-H1 nota hermana de carpeta se pierde de la jerarquía; B-S2/S3/S4/S5 (subcadena, regex incompatibles/CRLF, `✅` tras `^id`, no atómico); B-C1 validación de coherencia con hora; "Prioridades de Hoy" incluye fechas futuras; comparadores no transitivos (`estado` en jerarquía, prioridad/fecha en En Progreso); parsers duplicados (Foco/GTDv3).

### 9.3 Divergencias código vs DOC-REGLAS (Ax 250705)
| Regla en DOC-REGLAS | Código |
|---|---|
| Asignadas = `#px` SIN `#cx` | Asignadas incluye toda tarea con `#px`, también con `#cx` |
| Próximas Acciones: contexto Y fecha 🛫/⏳/📅 ≤ hoy | cualquier tarea con contexto (fecha futura incluida); solo se excluye 🛫 futura |
| Las tareas con fechas futuras (⏳/📅) van a En Pausa | solo 🛫 futura, dependencias (y semana, muerta) van a En Pausa |
| Dependiente espera en En Pausa hasta cumplir la predecesora | además de En Pausa se duplica en Próximas/Asignadas/Ojalá Hoy/Vencidas/Proyectos |
| Dependencias circulares → Inbox | no se detectan |
| Calendario: sin duración asume 30 min | no hay lógica de duración por defecto |
| Duración `[1.5h]` | parser la rechaza |
| Ojalá Hoy: 📅 antes que ⏳ y orden por prioridad ⏫🔼🔽⏬ | sin ordenar (solo Agenda de Hoy por hora) |
| Semana `[w::]` futura → En Pausa; pasada/actual con ctx → Próximas; sin ctx → Inbox | inoperante (B-P6) |
| Aviso al vencer una asignada con dependientes | no implementado |
| Ejemplos con `- [-]` | el parser no reconoce `[-]` |
| 9 listas | 10 (se añade Vencidas); "Ojalá Hoy" incluye subgrupo "Agenda de Hoy" |

### 9.4 Observaciones de diseño útiles para la reescritura
- Unificar un único `parseTask(line)` puro, testeable, con: tokenización de metadatos por emoji (todos los de Tasks), ids/dependencias separados (`🆔` vs `⛔`), `[\p{L}\p{N}_-]` para contextos, duración decimal, `week` normalizado, y estados configurables (incluida `[-]` cancelada).
- Separar "fecha de referencia" (hoy) como parámetro de las funciones de clasificación (hoy es `moment()` implícito) → facilita pruebas y evita recomputar.
- Sustituir `inAnyList` por una marca `placed`; calcular `displayStatus` y flags una sola vez.
- Persistir ids estables o usar `(ruta, línea, hash de contenido)` como clave; localizar líneas en el manager por `lineNumber` + verificación del contenido, nunca por fallback "primera tarea".
- Indexar incrementalmente con `metadataCache` (`listItems`/`'changed'`) en lugar de reparsear todo en cada redibujado.

(Arnés de verificación utilizado, fuera del repo: `/tmp/claude-0/-home-user-obsidian-dovela-personal-management/9bdd212a-97a1-55ad-8235-9d6d1c140d39/scratchpad/t/` — `run.mts` (parser), `run2.mts` (procesador, fechas, color, duración), `run3.mts` (jerarquía y En Progreso).)
