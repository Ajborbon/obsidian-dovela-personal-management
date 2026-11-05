# 01 · Ingeniería inversa del plugin Dovela v1.0.0

> Fase 0 de la reescritura (`rewrite/v2`). Fecha: 2026-11-05.
> Este documento consolida el inventario funcional. El detalle línea por línea está en los
> seis anexos `docs/v2/anexos/RI-*.md` (cada uno cita archivo y línea del código v1 y
> las notas `Cmt` de origen). Lo marcado **(verificado)** se comprobó ejecutando el código real
> en un arnés fuera del repo; lo marcado **[verificar]** depende del comportamiento de Obsidian en runtime.

Fuentes: código de `src/` (20.542 líneas, 66 archivos, commit `378e5af`), `Documentacion/`,
`docs/contexto-vault/` (reglas del vault, 22 plantillas, 83 notas `Cmt`, historia v0.1–v1.0).

| Anexo | Cubre |
|---|---|
| [RI-A](anexos/RI-A-nucleo-gtd.md) | Parser de tareas, modelo, clasificación GTD, jerarquía, estancados, escritura en notas, pruebas sugeridas con valores verificados |
| [RI-B](anexos/RI-B-vistas-gtd-y-smart-inbox.md) | Dashboard de 6 pestañas, filtros, Smart Inbox, menús en cascada, calendario, ajustes, features a conservar |
| [RI-C](anexos/RI-C-main-tiempo-pomodoro.md) | `main.ts`, `data.json`, Time Tracker, Pomodoro, estadísticas/timeline, Actividad, riesgos de Sync |
| [RI-D](anexos/RI-D-foco-backlinks.md) | Foco, Backlinks, breadcrumbs (bug de julio 2026), consultas al índice |
| [RI-E](anexos/RI-E-journal-weekly-plantillas.md) | Journal, Weekly, las 22 plantillas Templater, fechas ISO |
| [RI-F](anexos/RI-F-historia-intencion.md) | Intención de cada funcionalidad según las 83 notas `Cmt` y el backlog heredado |

---

## 1. Visión general del sistema actual

### 1.1 Módulos y tamaño

| Módulo | Archivos / líneas | Qué es |
|---|---|---|
| `main.ts` | 1 / 866 | Orquestador: carga `data.json`, registra 5 vistas, 9 comandos, 8 ribbons, eventos, sync de temporizador cada 15 s |
| `moduloGTDv3` | 33 / ~11.500 | Núcleo: parser, jerarquía, clasificador GTD, dashboard (6 pestañas), Smart Inbox, menús en cascada, Time Tracker, Pomodoro, estadísticas, cronograma, panel de revisión, ajustes |
| `moduloFoco` | 9 / 4.544 | Fork (~64 % copia literal) de GTD acotado a una nota + carpeta + enlaces (bidireccional) |
| `moduloBacklinks` | 5 / 1.472 | Vista lateral: notas de la misma carpeta o que enlazan a la nota activa; árbol; pestañas abiertas; breadcrumbs |
| `moduloJournal` | 4 / ~1.100 | API para bloques de nota diaria (se invoca desde `datacorejsx`) |
| `moduloWeekly` | 4 / ~1.300 | Ídem para nota semanal |
| `moduloActividad` | 2 / 419 | Panel de actividad (tareas capturadas/cerradas, notas nuevas/modificadas) |
| `styles.css` | 140 KB | Todos los estilos, con duplicados y `!important` |

Dependencias reales: `obsidian`, `moment`, **`xlsx`** (solo para exportar a Excel), `react`/`svelte`
(declaradas, sin uso en `src/`), `obsidian-dev-utils` (build). Bundle `main.js` ≈ 1,6 MB (dominado por `xlsx`).

### 1.2 Flujo de datos (v1)

```
vault.getMarkdownFiles() ── cachedRead de TODOS los .md ── regex por línea ──► Task[] (UUID aleatorio si no hay 🆔)
        │ (se repite entero en cada drawView, cada apertura de modal de tiempo, cada render de Journal/Weekly, cada click de dependencia)
        ├─ buildHierarchy ─► árbol carpeta/nota
        ├─ processGtdLists ─► 10 listas (clasificación por tarea)
        ├─ processInProgressTasks
        └─ generate*Html ─► string gigante ─► contentEl.innerHTML   (sin escape, sin virtualización)
data.json ─ loadData/saveData completo en cada mutación ─ timeLogs[] + activeTimer + activePomodoroSession + settings
main.handleFileChange ─ en CADA 'modify' de CUALQUIER archivo: collectMetadata() recorre todo el vault
```

No existe índice, caché ni suscripción a cambios: **toda vista es "reparsear el vault completo"**.
Foco añade expansión de enlaces entrantes O(|base|×|vault|×enlaces); Backlinks recorre todo el vault en cada `modify`.

---

## 2. Inventario funcional (resumen; detalle en anexos)

Cada línea se mapea a una fila de la [matriz de paridad](04-matriz-de-paridad.md) (ID `Fnn`).

### 2.1 Tareas y listas GTD (RI-A, RI-B §1.3)
- **Parser** (`parser.ts`): línea `^\s*-\s+\[( |x|X|/)\]\s+(.*)`; otros estados (`[-]`, `[!]`…) no son tarea. Extrae en orden: fechas `🛫 ⏳ 📅`
  (la **primera** del texto es la principal, el resto `additionalDates`), `🆔|^id`, `[hI:: ]`, `[hF:: ]`, `[Nmin|Nh]`, `[w:: [[YYYY-Wnn]]]`, `⛔ id`,
  `#cx-`, `#px-`, tags `#inbox|#GTD-AlgunDia|#GTD-EstaSemanaNo`, prioridad `⏫🔼🔽⏬`. `➕`, `✅`, `🔁`, `🔺` permanecen en el texto.
  Sin relación padre-hijo entre subtareas. Detalle de regex y 14 defectos (B-P1…B-P14) en RI-A §2.
- **Tipos de nota** (jerarquía): `GrupoAV, AV, AI, PGTD, PQ, RR, Tx, Vx, Reu, Rf, Sue, Cp, EMkt, RT, RL, Ax, Dly, Wk, M, Q, H, Y`. Solo `GrupoAV, Dly, Wk, M, Q, H, Y` se leen del frontmatter; el resto por prefijo del nombre (`PREFIJO␠`); defecto `Ax`.
- **10 listas** (`gtdProcessor.ts`): Bandeja de Entrada, Próximas Acciones (por contexto), Calendario, Ojalá Hoy (+ “Agenda de Hoy”), Asignadas o Delegadas (por persona), Proyectos, Algún Día/Tal Vez, Esta Semana No, En Pausa, Vencidas (toggle fecha-primero / contexto-primero). Una tarea puede estar en varias. Reglas exactas y tabla de 21 escenarios verificados en RI-A §4 y §8.2. “Una tarea, una lista” solo con duplicaciones explícitas (varios `cx`/`px`, dependientes).
- **displayStatus**: `overdue` (rojo) > `today` (verde) > `paused-start` (azul, 🛫 futuro) ; `paused-dep` (naranja, dependencia abierta).
- **Jerarquía** (`hierarchyBuilder.ts`): árbol por carpetas con fusión carpeta↔folder-note (`X/X.md`), placeholders `[FALTA] X`, contadores propias/descendientes `(n) - <m>`, orden por `TYPE_ORDER`, `estado`, `ctime` desc. Defecto B-H1: nota hermana de una carpeta homónima se pierde.
- **En Progreso**: tareas `[/]`; métricas (activas, tiempo definido, estimado = definido + 20 min por tarea sin duración, vencidas); agrupar ninguno/contexto/persona/proyecto; orden cíclico prioridad/duración asc/desc.
- **Filtros** (contexto, persona, texto), navegación rápida con contadores y sublistas, header pegajoso, scroll suave a anclas, breadcrumb plegable por tarea, enlaces de dependencia `⛔ id 🔗`, clic abre nota en la línea exacta, optimizaciones móviles (RI-B §1.1, §1.3).
- **Estados de tarea escritos en notas**: `[ ]→[/]` al iniciar tiempo/pomodoro; `[ ]|[/]→[x] + ✅ YYYY-MM-DD` al cerrar (`TaskStateManager`, copiado 3 veces; localiza la línea por *subcadena de texto* con fallback a “primera tarea abierta” — defecto B-S1).
- **Panel de revisión**: proyecto `estado: 🟢` en carpeta `PGTD *` sin tareas abiertas (carpeta + subcarpetas + enlaces salientes a 2 niveles) → acciones añadir tarea / archivar (`🔵`) / abrir carpeta.

### 2.2 Captura (RI-B §3)
- **Smart Inbox** (overlay propio, no `Modal`): `@proyecto` (solo notas `PGTD -|AV -|AI -` con `estado: 🟢`; nota activa primero), `#` menú en cascada `cx-/px-/gtd-` con filtrado incremental, `!` calendario con Start/Schedule/Due y accesos rápidos, fecha legacy `!hoy`. Línea final: `- [ ] desc #tags ➕ YYYY-MM-DD HH:mm [🛫][⏳][📅]`, `#inbox` si no hay tags; destino `00 - Inbox/Bandeja de entrada.md` o sección `## Tareas` del proyecto (`vault.process`).
- Defectos: Enter bloqueado con menú “colgado”, `@Proyecto texto` consume todo, `➕` con hora no estándar, personas/contextos de ejemplo hard-coded, `PQ -` nunca llega.

### 2.3 Registro de tiempo y Pomodoro (RI-C)
- **Timer**: inicia sobre nota activa o sobre tarea seleccionada (una línea `- [ ]|[/]`; multilínea/no-tarea → aviso); barra de estado; detener abre `TimeLogModal` (tarea, fecha, inicio, fin, notas, “Cerrar tarea” activado por defecto); cancelar registro; modificar hora de inicio y notas del timer en curso; registro manual; editar/borrar registros (sin confirmación).
- **Pomodoro**: trabajo/descanso corto/largo, ciclos, **overtime** con alertas cada N min, modal de cierre (descanso, otro pomodoro, seguir en overtime, finalizar), cierra/pone en progreso la tarea, sonido/vibración, recuperación al recargar. 10 defectos funcionales verificados por lectura (RI-C §4.7: ciclos siempre 0, descanso sin tarea, doble cierre de tarea, notas perdidas, duración inflada, stats de hoy no se resetean…).
- **Sincronización entre dispositivos**: sondeo de `data.json` cada 15 s mirando solo si hay `activeTimer`; nunca recarga memoria → pérdida de registros y “timer zombi” (RI-C §2.5).
- **Estadísticas**: árbol jerárquico por segmentos de ruta (tiempo, %, nº registros), periodos hoy/semana/mes/año/siempre/rango/día, navegación, mapa de calor, salto inteligente, edición de registros, **export Excel** (`xlsx`).
- **Cronograma**: día/3 días/semana, zoom 1x–4x, arrastrar/redimensionar/crear/copiar con Alt, multi-día segmentado, color por carpeta raíz.
- **Panel de actividad**: tareas capturadas (`➕`) vs completadas (`✅`), notas nuevas vs modificadas (ctime/mtime), periodos; **lee todo el vault** en cada apertura.

### 2.4 Foco y Backlinks (RI-D)
- **Foco** (`foco-gtd-view`): misma UI que el dashboard sobre el conjunto {notas de la carpeta de la nota fijada (recursivo)} ∪ {enlaces salientes hasta N niveles (def. 2)} ∪ {entrantes hasta M (def. 5)}, con carpeta/notas de terminación configurables (def. `AI - Journals`), badges de origen ➡️/⬅️, título colapsable persistido. No sigue la nota activa; no persiste tras reiniciar.
- **Backlinks** (`dovela-backlinks-view`): “backlink” = misma carpeta directa **o** enlace `[[ ]]` en el cuerpo; lista o **árbol** (orden por ruta) que sigue la nota activa y expande carpetas inteligentemente; visor de pestañas abiertas agrupadas por split; orden por archivo/tipo/estado/ruta/creación/modificación; fechas, `moneda`+`monto` para `Tx`; 3 estilos de breadcrumb (bug de recursión infinita corregido el 2026-07-06). Settings en `localStorage`.
- Ninguno lee `origen::`/`origen:`; ambos usan `cache.links` (no `frontmatterLinks`).

### 2.5 Journal y Weekly (RI-E)
- API pública `plugin.journalAPI.renderTasksForDate('YYYY-MM-DD', opts)` y `plugin.weeklyAPI.renderTasksForWeek('YYYY-Wnn', opts)` invocadas desde bloques **`datacorejsx`** de las plantillas Diaria y Semanal (no `dataviewjs`); además `getTaskCounts`, `getDailyNotePath`, `generateWeeklyLink`, `ensureFolderStructure`, `validateJournalSettings`. **Contrato a mantener tal cual** (los bloques existentes en el vault de Andrés los llaman).
- Grupos diarios: Calendario del día, Programadas hoy, Tareas de esta semana (`[w::]`), Semanas anteriores, En Progreso, Vencidas a hoy (límite 50, colapsada), Bloqueadas por dependencias, Completadas hoy (colapsada). Weekly: Lunes–Domingo, vencidas por semana/fecha, completadas.
- Defectos: trimestre `Math.ceil(month0/3)+1` (Feb→Q2, Nov→Q5), `moment().year(Y).isoWeek(W)` dependiente de la fecha actual, checkbox sin efecto (solo `console.log`), prioridad ⏫ se muestra como 🔺, opciones documentadas sin implementar.
- Rutas: el código genera `base/YYYY/Qn/…`; el vault real y `Plt - Diaria` usan `AI - Journals/YYYY/MM/YYYY-MM-DD dddd.md`.

### 2.6 Plantillas del vault (RI-E §5)
22 plantillas Templater (`Ax, Btx, Cmt, Podx, Prx, Tx, Vx, Ref, Sue, Reu, PGTD, AV, AI, RR×3, RC` + `Dly, Wly, Mly, Qly, Yly`). Solo se usan: `tp.file.{title,folder,rename,move,cursor_append}`, `tp.config.active_file`, `tp.date.now`, `tp.system.{prompt,suggester}`, `tp.app.vault/workspace`, `moment`, `Notice`. Nomenclatura `Tipo YYMMDD - Nombre`, `estado: 🟢`, `origen: "[[padre]]"` + enlace insertado en el padre. No hay `tp.user`, `tp.web`, `tp.frontmatter`, `tp.hooks`. Bloques incrustados: `datacorejsx`, `base`, embeds.

### 2.7 Transversal
- **Selector de estado de nota (🟡🟢🔵🔴)**: **no existe en el código v1** (RI-C §0.1; vivía en el plugin `addOnsAPI` de v0.1 y no se portó). El inventario del índice lo lista como funcionalidad a conservar → se **implementa** en v2 (comando + modal; escribe `estado:` con `processFrontMatter`).
- **Menú `@` unificado / escritura incremental**: forman parte del Smart Inbox (§2.2).
- **Móvil**: filtros colapsables, áreas táctiles ≥ 44 px, fuente ≥ 16 px; cierre de modal táctil. Falta: comandos de paleta para detener timer/pomodoro (hoy solo desde la vista).

---

## 3. Formatos de datos que v2 debe leer y escribir sin migrar

### 3.1 Tareas (texto en notas contenedor)
```
- [ ] Texto 📅 2026-11-05 [hI:: 10am] [hF:: 11:30am] [90min] ⏫ #cx-Oficina #px-Ana ⛔ dep1 🆔 k1
- [/] En progreso [30min] 🆔 p1
- [x] Hecha ✅ 2026-03-01 🆔 d1
- [ ] Semana [w:: [[2025-W43]]]           (también [w:: [[ruta/2025-W43|2025-W43]]] y W mayúscula)
- [ ] Captura desde Smart Inbox ➕ 2026-11-05 14:32 #inbox
```
Compatibilidad: se conserva la **semántica de v1** (fecha principal = primera del texto, ⛔ múltiples ids, `_` no
válido en contexto…) con las correcciones documentadas en `02-decisiones-de-diseno.md` §4.

### 3.2 `data.json` v1 (a migrar a v2, sin pérdida)
```jsonc
{ "timeLogs":[{ "id":"<Date.now()>", "taskNotePath":"…md", "startTime":"ISO(-05:00 | Z)", "endTime":"ISO",
                "durationMinutes":41, "notes":"…", "taskDescription":"…" }],
  "activeTimer":{ "taskNotePath":"", "startTime":"", "taskDescription":"", "notes":"", "lineNumber":42 },
  "pomodoroSettings":{ "workDuration":25,"shortBreakDuration":5,"longBreakDuration":15,"cyclesBeforeLongBreak":4,
                       "autoStartBreaks":false,"autoStartWork":false,"soundEnabled":true,"notificationsEnabled":true,"overtimeAlertInterval":5 },
  "activePomodoroSession":{ "id","type":"work|shortBreak|longBreak","startTime","duration","taskPath","taskDescription",
                            "completedCycles","notes","isOvertime","overtimeStartTime","lastOvertimeAlert" },
  "pomodoroStats":{ "totalWorkSessions","totalWorkMinutes","completedCycles","todayWorkSessions","todayWorkMinutes" },
  "journalSettings":{ "baseFolderPath":"03 - Gestion Personal/AV - Gerente de Vida/AI - Journals","yearSubfolder":true,
                      "quarterSubfolder":true,"monthSubfolder":false,"weekFolderPattern":"{YYYY}/Q{Q}" } }
```
- Sin `schemaVersion`. Merge superficial con defaults compartidos por referencia. ~590 B por registro (≈ 2,4–6 MB/año).
- Los offsets de `startTime/endTime` son mixtos (`-05:00` del timer, `Z` de la timeline). Todo se lee con `moment(str)`; v2 debe normalizar a instante.
- `timelogs.json` (formato anterior): la migración v1 estaba comentada y **borraba el archivo sin importar**; si existe, v2 lo importa (formato = array de `TimeLogEntry`).
- Hay dos `DovelaPluginData` más (en `focoModel.ts`, con `schemaVersion`/`interruptedTimer`): **obsoletos y sin uso**.

### 3.3 Otros almacenes
- `localStorage` (Foco: ajustes de expansión y colapso de cabecera; Backlinks: ajustes de vista) — claves en RI-D §1.7 y §2.10.
- Notas: frontmatter `type`, `estado`, `fecha`, `origen`, `tags`, `moneda`, `monto`; campo inline `origen::` en `Cmt`.

### 3.4 APIs expuestas fuera del plugin
`app.plugins.plugins['obsidian-dovela-personal-management'].journalAPI` / `.weeklyAPI` (ver §2.5). Id de plugin y `manifest.id` **no cambian**.

---

## 4. Defectos y deudas relevantes de v1 (resumen; detalle y severidad en anexos)

| # | Defecto | Impacto | Dónde |
|---|---|---|---|
| 1 | Reparseo completo del vault en cada vista/clic/modal/bloque Journal | Arranque y UI lentos; móvil | RI-A §7, RI-B §2.2 |
| 2 | `collectMetadata()` en cada `modify` | CPU constante al escribir | RI-C §1.6 |
| 3 | `data.json` único reescrito entero + sondeo 15 s sin recarga de memoria | Pérdida de registros con Sync, timer zombi | RI-C §2.5 |
| 4 | Migración `timelogs.json` borra sin importar | Pérdida de historial | RI-C §2.4 |
| 5 | `#cx-Teléfono` → `Tel`; `2^10` → id; `⛔ ^id` roba el id | Datos mal clasificados | RI-A B-P1..P3 |
| 6 | `week` sin corchetes vs `dateUtils` con corchetes: lógica de semanas muerta | Listas incorrectas | RI-A B-P6 |
| 7 | `TaskStateManager` cierra “la primera tarea abierta” si no encuentra la descripción | **Corrompe notas** | RI-A B-S1, RI-C §4.7-3 |
| 8 | Orden por *string* de horas (`10am` < `9am`) | Calendario mal ordenado | RI-A B-G1 |
| 9 | Sin escape HTML (`innerHTML` con contenido del vault) | Inyección / DOM roto | RI-B §1.3 |
| 10 | Trimestre mal calculado en rutas de Journal | Rutas incorrectas | RI-E §0.2 |
| 11 | Pomodoro: ciclos, descansos, duración, stats | Funcionalidad rota | RI-C §4.7 |
| 12 | Foco duplica ~64 % de GTD y su parser está desactualizado | Comportamiento divergente | RI-D §1.3 |
| 13 | `console.log` de depuración en rutas calientes (~50+) | Ruido y coste | todos |
| 14 | `xlsx` en el bundle; `react`/`svelte` declarados sin uso | 1,6 MB | RI-F |
| 15 | Selector de estado de nota inexistente | Funcionalidad prometida ausente | RI-C §0.1 |

---

## 5. Lo que v1 hace bien y v2 debe heredar tal cual
- Sintaxis de tarea sobre emojis de Tasks y metadatos inline (`[hI::]`, `[w::]`): los datos del usuario ya la usan.
- Concepto de “centro de mando del día” (En Progreso), Agenda de Hoy con tiempo total, color por `displayStatus`.
- Registrar tiempo en el **nodo de tarea y en cada nivel de la ruta** (RR/PGTD/AI/AV) y mostrar el árbol agregado.
- Escritura de captura con `vault.process` (atómica), `#inbox` por defecto y `➕` de creación.
- Menú en cascada con teclado, múltiples tags por tarea y opción de seguir escribiendo a mano.
- Reglas del vault: tareas solo en notas contenedor (PGTD, RR, Inbox, Reu), estados 🟡🟢🔵🔴, nomenclatura `Tipo YYMMDD - Nombre`, `origen` hacia el padre.

## 6. Preguntas abiertas que se resuelven por defecto más seguro (ver 02 §9)
Ubicación de notas Wly/Mly/Qly/Yly · `type` de journals (`Wly` vs `Wk`) · desplazamiento de símbolos de prioridad ·
regla semana→mes (jueves vs solape) · si `origen:` cuenta como backlink · Asignadas con y sin `#cx`.
