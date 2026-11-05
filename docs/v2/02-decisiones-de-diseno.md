# 02 · Decisiones de diseño de Dovela v2

> Cada decisión: **contexto → alternativas → decisión → motivo → riesgo**. Donde había ambigüedad se eligió
> la opción **más segura para los datos del usuario** (regla del encargo) y se registra aquí.
> Referencias: [01-ingeniería inversa](01-ingenieria-inversa.md) y anexos `RI-*`.

## 0. Restricciones que gobiernan todo

1. Datos existentes se leen y escriben **sin migrar a mano** (tareas, frontmatter, bloques `datacorejsx`/`base`, `data.json`).
2. `isDesktopOnly: false`: sin Node/Electron/`fs`/`path`/`crypto` de Node; solo API de Obsidian y Web APIs. Presupuesto de CPU/RAM móvil.
3. Obsidian Sync: nada de un archivo único que todos reescriban; escrituras escasas; conflictos imposibles por diseño o resueltos por regla explícita.
4. Arranque rápido (`onload` sin I/O pesado), índices incrementales, vistas que no reparsean.
5. No tocar `main` hasta aprobación. `manifest.id` se mantiene (`obsidian-dovela-personal-management`) para que la API y `data.json` sigan siendo los mismos.

---

## 1. Plantillas: ¿motor propio que reemplace a Templater?

**Contexto.** 22 plantillas Templater (RI-E §5). Se ejecutan sobre un archivo recién creado “Sin título” y lo renombran/mueven; las de Journal leen `tp.file.title`.
Solo usan 12 funciones de Templater (RI-E §5.7). No hay `tp.user/web/frontmatter/hooks`. Los bloques incrustados (`datacorejsx`, `base`, embeds) son texto estático.

**Alternativas.**
A. Seguir con Templater (dependencia externa, JS arbitrario, requiere crear “Sin título”, flujo distinto en móvil, efectos laterales por plantilla, bugs de año ISO duplicados en cada una).
B. Ejecutar las plantillas `.md` existentes con un intérprete propio de `<% %>` (AsyncFunction): compatible pero sin sandbox y reimplementa Templater.
C. **Motor declarativo propio**: cada tipo de nota es una *especificación tipada* (nombre, carpeta destino, frontmatter, cuerpo) renderizada con interpolación `{{var}}` sin código; creación vía comando con modales nativos.

**Decisión: C**, con coexistencia: Templater puede seguir instalado; v2 no lo toca.
- Núcleo `src/core/notes/`: `NoteTypeSpec` por tipo (Ax, Btx, Cmt, Podx, Prx, Tx, Vx, Ref, Sue, Reu, PGTD, AV, AI, RR, RC y journals Dly/Wly/Mly/Qly/Yly). Funciones puras: nomenclatura (`Tipo YYMMDD - Nombre`, saneo de caracteres), frontmatter exacto (valores vacíos `clave:` y `origen: "[[padre]]"` idénticos a los de las plantillas), reglas de carpeta (misma carpeta / Inbox / carpeta propia para PGTD‑AV‑AI‑RR‑RC), enlace bidireccional al padre.
- **Journal sin nombrar a mano**: comandos “Abrir/crear diaria|semanal|mensual|trimestral|anual” calculan nombre y ruta (año ISO correcto) y crean la nota con propiedades `semana/mes/trimestre`. Esto cierra además el bug de trimestre y los de año ISO.
- Cuerpos por defecto = los de las plantillas del vault (copiados al código como constantes). Personalizables: si existe un archivo en la carpeta de plantillas configurada con nombre `Plt - <Tipo>.md`, se usa su **texto** como cuerpo, sustituyendo solo `{{fecha}}`, `{{titulo}}`, `{{padre}}`, etc. (sin ejecutar JS; las llamadas `<% %>` se dejan intactas y se avisa).
- `cursor_append` ambiguo → siempre se inserta el enlace en el padre con `editor.replaceSelection` si hay editor activo, y si no, se añade a la sección `## Historial` del padre (o al final).
- Se crea la carpeta destino antes de `vault.create` (no hace falta “Sin título”+mover).

**Qué se gana.** Móvil sin Templater, sin JS arbitrario, pruebas automáticas de nombres/fechas/rutas, ceros bugs de año ISO, journals en un toque, menos ficheros.
**Qué se pierde.** Plantillas del usuario con JS propio dejan de ejecutarse por este motor (siguen funcionando con Templater instalado). Cuerpos de plantilla duplicados en código (mitigado con override por archivo).
**Riesgo.** Fidelidad de frontmatter: se cubren con pruebas de *snapshot* contra los frontmatter reales de las plantillas (RI-E §5.3). Se declara **paridad “mejorada”** únicamente tras esos tests.
**Alcance por fases.** F9. Tipos de reglas de carpeta complejas (RR de transacciones/bitácoras) se implementan con la tabla RI-E §5.5; lo no resuelto queda marcado en la matriz.

---

## 2. Registro de tiempo y Pomodoro: almacenamiento

**Contexto.** Hoy: `timeLogs[]` + `activeTimer` + `activePomodoroSession` + `pomodoroStats` en un único `data.json` reescrito entero (RI-C §2). Pérdida de datos probada por lectura con dos dispositivos (RI-C §2.5), 2,4–6 MB/año, ruta repetida en cada registro (>60 % del peso), `id = Date.now()`, sin borrado lógico, offsets mixtos.

**Alternativas evaluadas.**

| Opción | Sync / conflictos | Móvil | Consultas y stats | Humano / auditable | Veredicto |
|---|---|---|---|---|---|
| 1. Seguir en `data.json` (mejorado) | Un archivo caliente; Sync fusiona por archivo completo → pérdidas | Parseo completo en cada lectura | Todo en memoria | No | ✗ |
| 2. Un archivo JSON por día (`.json` en la carpeta del plugin) | Sin conflictos, pero **Sync solo sincroniza ficheros de configuración conocidos**; `.json` arbitrarios en el vault no se sincronizan por defecto; carpeta del plugin no está garantizada | OK | Muchos archivos pequeños | Poco | ✗ |
| 3. Base propia (IndexedDB / SQLite wasm) | No se sincroniza | Pesado (wasm) | Excelente | No | ✗ (solo útil como *caché local*) |
| 4. Registro dentro de cada nota de tarea | Conflictos en notas valiosas; viola “notas de conocimiento sin estado ajeno” | OK | Lento | Sí | ✗ |
| 5. **Archivos `.md` de eventos append‑only, uno por dispositivo y mes**, en una carpeta visible del vault | Cada dispositivo solo escribe SU archivo → cero conflictos de escritura; `.md` siempre se sincroniza; fusión por unión de eventos | Lectura por mes bajo demanda | Índice en memoria por día/mes, caché local derivada | Sí (texto plano, auditable, consultable) | **✓** |

**Decisión: opción 5.**

- **Ubicación** configurable: `Dovela/Registro de tiempo/` (carpeta visible; los puntos‑carpeta no se indexan ni sincronizan). Archivo: `YYYY-MM · <dispositivo>.md`.
  Frontmatter `type: RT` (tipo ya existente en la jerarquía) y `dispositivo: <id corto>`; el cuerpo es un bloque de código `dovela-tiempo` con **un evento JSON compacto por línea** (JSON Lines). Sin checkboxes (regla del vault).
- **Dispositivo**: `deviceId` aleatorio guardado en *caché local del dispositivo* (`app.saveLocalStorage`), nunca en `data.json` ni en el vault; si se pierde, se genera otro (el histórico sigue siendo legible).
- **Eventos** (todos con `id` ULID‑like generado sin Node, `u` = epoch ms de actualización):
  - `{"t":"log","id","a":"<ISO UTC>","b":"<ISO UTC>","p":"ruta/nota.md","d":"descripción","n":"notas","k":"timer|manual|pomodoro|import","l":42,"i":"abc123"}` — registro cerrado. `l` = línea y `i` = 🆔 de la tarea si existen.
  - `{"t":"log","id",…,"x":1,"u":…}` — **borrado lógico** (tombstone).
  - `{"t":"live","id","k":"timer|pomodoro","a","p","d","n","l","i", …campos de pomodoro}` — inicio de una sesión en curso.
  - `{"t":"end","id","u"}` — la sesión en vivo terminó (se publica `log` con el mismo `id` y/o `end`); `{"t":"cancel","id","u"}` — descartada.
- **Resolución de conflictos (regla única).** Estado de un `id` = evento con mayor `u`; empate → mayor `dispositivo` en orden lexicográfico. Es conmutativo, asociativo e idempotente (pruebas de propiedad). Editar un registro = nuevo evento con mismo `id`. Un `log` o `cancel` posterior a un `live` lo cierra.
- **Sesión en vivo entre dispositivos**: derivada de eventos `live` sin cierre. Se actualiza **reaccionando al evento `vault.on('modify'|'create')`** de la carpeta (Sync materializa el archivo → modify), no por sondeo. Un `live` con más de 12 h (configurable) se marca “posiblemente abandonado” y ofrece *descartar / registrar hasta…*; el reloj de pared sigue siendo la fuente de verdad del tiempo transcurrido.
- **Volumen de escritura**: 1 append por inicio, 1 por parada/edición. Nada de latidos. Pomodoro‑overtime ya no persiste alertas.
- **Atomicidad**: los apéndices usan `vault.process` sobre el propio archivo del dispositivo (read‑modify‑write atómico de Obsidian), serializados por una cola. La “parada” es **un solo evento** (`log` cierra el `live` de mismo `id`) → no puede quedar log sin cierre (defecto RI-C §3.5).
- **Rutas e identidad de tarea**: se guarda `p` (ruta) + `i` (🆔 si existe) + `l` (línea al momento). Resolución al leer: 🆔 → ruta actual; si no, `p`. Se registran renombrados (`vault.on('rename')`) como evento `{"t":"move","from","to"}` por dispositivo para que el histórico siga a la nota (opcional, F3).
- **Pomodoro como dato estructurado**: `k:"pomodoro"` con `pl` (min planificados), `ot` (min de overtime), `cy` (ciclo). Los descansos **no** se registran (como en v1) salvo opción.
- **Estadísticas**: agregación pura sobre `ReadonlyArray<TimeLog>` indexada por día (`Map<yyyy-mm-dd, TimeLog[]>`); un log que cruza medianoche se **reparte** por día en timeline y en estadísticas (en v1 las estadísticas lo atribuían al día de inicio; el cambio se documenta en la matriz como “mejorado”). Caché local derivada por mes (invalidación por `mtime`).
- **Zona horaria**: instantes UTC en disco; se muestran en hora local del dispositivo; el día de un registro se calcula en local.
- **Estado de Pomodoro stats** (`pomodoroStats`): se **recalculan** desde los logs (eran inexactos); no se persisten.
- **Importador (idempotente).** Comando y arranque automático (ofrecido una vez) que lee `data.json.timeLogs` y `timelogs.json`:
  - id nuevo `leg-<idViejo>` ⇒ re‑ejecutar no duplica; deduplica además por (ruta, inicio, fin);
  - normaliza offsets a UTC, recalcula duración `floor((b-a)/60000)` y conserva `durationMinutes` original en `n` si difiere;
  - infiere `k:"pomodoro"` por el prefijo “Sesión Pomodoro” en notas (el texto íntegro se conserva);
  - extrae 🆔 de la descripción; registros con `endTime<startTime` se importan marcados `bad:1` y se listan, no se descartan;
  - escribe en `YYYY-MM · importado.md` (un archivo fijo para el histórico);
  - **no borra ni modifica `data.json.timeLogs`** hasta que el usuario ejecute “Verificar e archivar histórico” (que compara conteos y sumas por mes y solo entonces permite vaciar). `activeTimer`/`activePomodoroSession` viejos se convierten en eventos `live` *solo si* tienen < 12 h; si no, se ofrece registrarlos o descartarlos.
- **Mitigación del riesgo de que el vault no sincronice la carpeta**: la carpeta está en el vault, así que va por el mismo canal que las notas. Si el usuario quiere carpeta oculta, se documenta que Sync puede no propagarla.
- **Riesgo.** Archivos `.md` grandes en el listado del usuario → se evita con nombre claro, carpeta única y `excluded files` sugerido en la guía; el cuerpo no se renderiza (bloque de código).

---

## 3. Capa de datos única (`VaultIndex`)

**Decisión.** Un índice incremental compartido por GTD, Foco, Journal, Weekly, Backlinks, Smart Inbox, estancados y selectores de tarea. Cero módulos hacen `vault.getMarkdownFiles()+cachedRead` por su cuenta.

- **Fuente de verdad**: `metadataCache`. Se *prefiltra* con `cache.listItems` (existe `task !== undefined` solo en archivos con checkboxes): los archivos sin tareas **no se leen**. Solo los que tienen tareas se leen (`vault.cachedRead`) y se parsean con el parser puro.
- **Registros por nota** (`NoteRecord`): `path, basename, folder, ctime, mtime, type (normalizado), estado, fm subset (moneda, monto, origen, fecha), outLinks (de resolvedLinks), tasks[]`.
- **Eventos**: `metadataCache.on('changed')` (reparsea ese archivo), `on('deleted')`, `vault.on('rename')`, `metadataCache.on('resolved')` (invalida enlaces con debounce). Resultado: un único `onChange(paths)` con **debounce de 250 ms** y *microlotes*.
- **Construcción inicial** tras `onLayoutReady`, en lotes de ~25 archivos cediendo el hilo (`await sleep(0)`), con indicador discreto; las vistas pintan lo que haya y se refrescan al terminar (patrón “stale‑while‑revalidate”). Los archivos sin `listItems` no cuestan I/O.
- **Índice invertido de enlaces** (para Backlinks y Foco entrantes): derivado de `metadataCache.resolvedLinks` en O(enlaces), no de recorrer el vault por cada nota. Decisión de producto: `origen::`/`origen:` **cuenta** como enlace entrante configurable (por defecto activado en Backlinks, desactivado en Foco para no cambiar su semántica; ver §9).
- **Consultas** (API pura, testeable con un `FakeHost`): `getNote`, `listFolder`, `getOutLinks/getInLinks`, `getSiblings`, `getTasksByFile`, `getAllTasks`, `resolveDependency(id)`, `buildNoteTree`, `expandNeighborhood` (BFS puro).
- **IDs de tarea estables**: `taskKey = path + '#' + line` y, si hay 🆔, `id` explícito. Se **abandona** `randomUUID` por parseo (B‑P4). Dependencias se resuelven solo contra ids explícitos y se avisa de ids inexistentes en lugar de ignorarlos en silencio.
- **Memoria**: tareas como objetos planos pequeños, strings internados para contextos; sin referencias a `TFile` en el modelo puro (se guarda `path`); sin árbol `parent` circular (la jerarquía se calcula bajo demanda).
- **Caché persistente** del índice: no en F1–F9 (el prefiltro `listItems` hace el arranque suficientemente barato). Queda como mejora si las medidas lo piden.
- **Riesgo.** `metadataCache.listItems` no distingue tareas dentro de callouts/citas igual que el parser → el parser puro es la autoridad, `listItems` solo decide si leer. Un archivo recién creado por Sync se detecta por `changed`.

---

## 4. Parser de tareas y reglas GTD

**Decisión.** Un solo `parseTaskLine(line)` puro reemplaza a `parser.ts` y `focoParser.ts` (y a las copias en Journal/Weekly). Compatible con v1 salvo estos **cambios documentados** (cada uno con prueba):

| ID | Cambio | Motivo / compatibilidad |
|---|---|---|
| R1 | Contextos/personas con `[\p{L}\p{N}_-]` (acentos, ñ, `_`) | B‑P1. Estrictamente más amplio que `[\w-]`: nada que antes parseaba cambia de significado |
| R2 | `^id` solo cuenta como id si está al final de línea o precedido por espacio y seguido de fin/espacio (`^[A-Za-z0-9-]+`); `2^10` no | B‑P2 |
| R3 | `🆔` e id de bloque se extraen **antes** que `⛔`; `⛔ ^id` se normaliza a `id` | B‑P3 |
| R4 | `⛔ a,b` y `⛔ a b` → varias dependencias separadas por coma; texto libre tras `⛔` no genera dep | B‑P11 |
| R5 | Duración acepta `[Nmin] [Nh] [N.Mh] [N min] [Nm]` y combinaciones `1h30min` | B‑P5; unifica con `parseDuration` |
| R6 | `week` se guarda siempre normalizado `YYYY-Wnn` (2 dígitos); lectura acepta `W5`/`w`/alias | B‑P6, E‑§7.7 |
| R7 | Se reconoce `🔺` y se mapea por orden relativo **sin cambiar el orden de ningún símbolo existente** (🔺 > ⏫ > 🔼 > 🔽 > ⏬ > ninguno); cada símbolo se **muestra tal cual se escribió** (corrige el ⏫→🔺 de Journal) | E hallazgo 7 / pregunta 4 |
| R8 | `➕ fecha`, `✅ fecha`, `🔁 regla`, `❌` se extraen a campos (`created`, `done`, `recurrence`) **y siguen en el texto original**; `Task.text` es el texto sin metadatos para mostrar | B‑P8 + Journal “completadas hoy” |
| R9 | `[-]` = *cancelada*: no es abierta ni completada; no cuenta (mismo efecto observable que v1, que la ignoraba) | RI‑F §0.1 |
| R10 | Fechas validadas (`YYYY-MM-DD` real); inválida → conflicto → Inbox (v1: pasaba sin estado) | B‑P8 |
| R11 | Código dentro de ``` fences, frontmatter y comentarios `%% %%` **no** produce tareas | RI‑A §2.8. Es un cambio de comportamiento deliberado y seguro |
| R12 | `Task.id` solo explícito; `taskKey` = `path#line` | B‑P4 |

**Clasificador GTD** (`classifyTasks(tasks, ctx{today, taskById})`, puro, `today` como parámetro):
- Se **conserva el comportamiento de código v1** (no el de `DOC-REGLAS`) cuando difieren, porque es lo que Andrés ha usado/probado: Asignadas incluye tareas con `#px` aunque tengan `#cx`; Próximas Acciones incluye cualquier contexto salvo 🛫 futuro; dependientes se listan además en las demás listas con `paused-dep`; “Ojalá Hoy” incluye “Agenda de Hoy”.
- Se **corrigen**: orden de Calendario/Agenda por minutos (no por string, B‑G1); fecha de agrupación en Vencidas = la más antigua *vencida* de ⏳/📅 con 📅 preferido sobre ⏳ solo a igual fecha (B‑G2, se documenta); semanas (B‑P6); `inAnyList` O(N²) → marca `placed`; ciclos de dependencia → Inbox; id de dependencia inexistente → se muestra aviso y NO bloquea (igual que v1) ; duración por defecto 30 min en Agenda (igual que v1).
- Divergencias código‑vs‑doc se listan en RI‑A §9.3 y quedan **no implementadas** (marcadas en la matriz), salvo ciclos de dependencia.

**Escritura en notas** (`applyTaskEdit`): funciones puras `markInProgress(line)`, `markDone(line, today)`, `appendDone`. Localización de la línea: por `lineNumber` **verificando** que el contenido coincida con el esperado; si no coincide, búsqueda por 🆔, luego por texto *exacto único*; si hay 0 o >1 candidatos → **no se escribe** y se avisa (adiós al fallback “primera tarea abierta”, B‑S1). Todas con `vault.process`. `✅` se añade tras 🆔 y antes de `^bloque` (B‑S4).

---

## 5. Interfaz: patrón de vistas

**Decisión.** DOM nativo sin framework, con tres piezas comunes en `src/ui/`:

1. **`h()` / `el()`**: constructor DOM tipado (`createEl` de Obsidian); *nunca* `innerHTML` con datos (elimina la clase de errores de escape).
2. **`VirtualList`**: ventana de filas por altura estimada/medida para listas planas > 150 elementos (listas GTD, backlinks, selector de tareas, registros). Secciones y árboles usan **render perezoso**: los hijos de un `<details>` se crean al abrir.
3. **Delegación de eventos** única por vista + `AbortController`/`registerDomEvent`; cronómetros con `registerInterval`; vistas solo se redibujan si están visibles y el índice reportó cambios relevantes (con *preservación* de scroll, filtros y secciones abiertas).

Alternativas descartadas: React/Svelte (ya declarados pero sin uso; +40–100 KB y runtime en móvil), Web Components (poco beneficio sobre DOM helpers y peor integración con CSS de Obsidian), virtualizar todo (no merece la pena en árboles).

- **Estilos**: CSS dividido por módulo (`src/styles/*.css`), concatenado en `styles.css` por el build; solo variables CSS de Obsidian (sin `prefers-color-scheme`), 2 breakpoints (768, 480) y `Platform.isMobile`/`ResizeObserver` en vez de `window.innerWidth`.
- **Modales**: `Modal`/`SuggestModal` nativos (foco, Esc, teclado móvil, accesibilidad). El Smart Inbox conserva su atajo y sintaxis pero se monta sobre un `Modal` ligero; el menú `@ # !` es **un solo componente** (lista + cabecera + filtrado) con tokenizador común.
- **Carga diferida**: `main.ts` solo registra comandos/vistas con *factories*; cada módulo se importa con `import()` dinámico la primera vez (esbuild `splitting` no aplica a un bundle único de Obsidian, así que se usa **un bundle con carga diferida lógica**: los módulos se construyen al primer uso y no se instancian en `onload`). El peso del bundle objetivo es < 250 KB minificado.

---

## 6. Configuración y estado: qué va dónde

| Dato | Dónde | Por qué |
|---|---|---|
| Ajustes del usuario (Pomodoro, Journal, carpetas, prefijos, Inbox, exclusiones, flags) | `data.json` — pequeño, `schemaVersion`, *deep‑merge* con defaults, copia (nunca referencia compartida) | Sync de config; < 4 KB |
| Registros de tiempo, sesión en vivo | Vault: `.md` de eventos por dispositivo y mes (§2) | Append‑only, auditables, sin conflictos |
| Notas creadas, tareas | Vault (como siempre) | Fuente de verdad |
| Preferencias de UI **por dispositivo** (pestaña activa, filtros, cabecera colapsada, zoom, ajustes de Backlinks/Foco, `deviceId`, estado de migración local) | Caché local (`app.saveLocalStorage/loadLocalStorage`, prefijo `dovela:`) | No debe viajar entre móvil y escritorio |
| Índice de tareas/enlaces | Memoria (reconstruible) | Más barato que mantener una caché sincronizada |
| Estadísticas derivadas (Pomodoro, agregados por mes) | Memoria / caché local | Recalculables |

`onExternalSettingsChange` recarga ajustes. Guardado de ajustes con *debounce* (500 ms) y escritura única al cerrar; **ninguna** escritura de `data.json` ocurre durante un timer.
Migración de `data.json` v1 → v2: `schemaVersion: 2`; se conserva el contenido legacy (`timeLogs`, `activeTimer`, …) bajo la clave `legacy` hasta la verificación (§2); un backup `data.v1.backup.json` se escribe una sola vez en la carpeta del plugin.

---

## 7. Dependencias

| Dependencia | Decisión |
|---|---|
| `xlsx`, `@types/xlsx` | **Eliminar.** Export a **CSV** (UTF‑8 con BOM para Excel, separador configurable) y a Markdown. Excel abre CSV. En móvil se guarda en el vault (`Dovela/Exportaciones/`) y/o se copia al portapapeles |
| `react`, `react-dom`, `svelte`, `@types/react*` | Eliminar (sin uso) |
| `obsidian-dev-utils` | Eliminar: **esbuild + tsc + vitest + eslint** directos; script `pnpm build` equivalente (`tsc --noEmit` + esbuild producción) |
| `moment` | No se empaqueta (Obsidian lo expone). Toda la lógica pura usa un módulo propio de fechas (`src/core/dates.ts`: ISO week, aritmética local, formateo) para ser testeable fuera de Obsidian |
| `@types/node` | Solo `devDependency` para vitest/herramientas; no se importa en `src/` |
| Nuevas runtime | **Ninguna** |

---

## 8. Arquitectura propuesta

```
src/
  main.ts                    # < 120 líneas: carga ajustes, registra vistas/comandos con factories
  core/                      # PURO: sin 'obsidian'. Todo con pruebas
    dates.ts, duration.ts, color.ts
    tasks/  parse.ts  edit.ts  priority.ts
    gtd/    classify.ts  inprogress.ts  navigation.ts
    notes/  types.ts  naming.ts  hierarchy.ts  specs/*.ts  periods.ts   (journals)
    time/   events.ts  merge.ts  stats.ts  timeline.ts  pomodoro.ts  legacy-import.ts  csv.ts
    links/  expand.ts  breadcrumbs.ts
  host/                      # Adaptadores a Obsidian (finos)
    index/VaultIndex.ts  storage/EventLogStore.ts  settings.ts  deviceCache.ts  paths.ts
  features/                  # Cada una expone register(plugin, ctx)
    gtd/  foco/  backlinks/  capture/  time/  journal/  weekly/  activity/  review/  notes/  state/
  ui/                        # h(), VirtualList, Tabs, MonthGrid, Menu (@#!), modales comunes
  styles/*.css               # → styles.css
tests/                       # vitest (lógica pura)
```
- **Inversión de dependencias**: `core/` define interfaces (`VaultHost`, `Clock`) y `host/` las implementa; las pruebas usan `FakeHost`.
- **Un solo `TimeService`** (timer + pomodoro mutuamente excluyentes) con eventos; la barra de estado lo consume.
- **Foco = GTD con otro `scope`**: misma vista parametrizada por un `ScopeProvider` (carpeta/enlaces) → desaparece el fork.
- **Journal/Weekly API**: `journalAPI`/`weeklyAPI` se mantienen con las mismas firmas, implementadas sobre `VaultIndex` + renderer nativo.

## 9. Decisiones de “opción más segura” (ambigüedades)

| # | Ambigüedad | Decisión segura |
|---|---|---|
| 1 | Ubicación de Wly/Mly/Qly/Yly | Configurable; por defecto la **misma carpeta base de Journals** con `YYYY/` y nombre de periodo (`2026-W45`, `2026-11`, `2026-Q4`, `2026`); `getWeeklyLinkPath` sigue aceptando `weekFolderPattern` y **además busca por nombre** (`metadataCache.getFirstLinkpathDest`) para no romper enlaces existentes |
| 2 | Estructura diaria | Defaults v2 = el vault real: año=sí, trimestre=**no**, mes=sí. Al migrar, si `journalSettings` existe en `data.json` **se respeta tal cual** (aunque tenga el bug de trimestre se corrige el cálculo) |
| 3 | `type` de journals | Se aceptan ambos vocabularios al leer (`Dly|Wly|Wk|Mly|M|Qly|Q|Yly|Y|H`); al escribir, se usa el de las plantillas (`Wly, Mly, Qly, Yly`) |
| 4 | Símbolos de prioridad | R7 (conserva orden relativo, añade 🔺, muestra símbolo original) |
| 5 | Semana→mes | **Jueves** (regla ISO) para propiedades de la nota semanal; el mensual lista semanas por solape. Pruebas de ambas |
| 6 | ¿`origen::` es backlink? | Backlinks: sí (opción); Foco: no (opción) |
| 7 | Asignadas con `#cx` | Igual que v1 (aparece en ambas) |
| 8 | Dependencias a ids inexistentes | No bloquea; aviso visible en la tarea (⚠️) |
| 9 | Timers abandonados | Nunca se descartan solos; se avisa y se pide acción |
| 10 | Checkbox en vistas Journal/Weekly (v1: sin efecto) | Marca la tarea como hecha con `markDone` seguro |
| 11 | `[-]` | Cancelada: no se muestra ni cuenta |
| 12 | Selector de estado (🟡🟢🔵🔴) | Comando + modal; escribe `estado:` con `processFrontMatter`; la transición 🟢→🔵 de journals sigue siendo decisión del usuario |
| 13 | Tareas en notas de conocimiento | **No** se bloquean (el índice las muestra), pero se ofrece un lint opcional en el panel de revisión |
| 14 | Carpetas excluidas | Configurables; defaults v1: `…/Plantillas` y segmento `99 - Adjuntos` (se mantienen para no mostrar tareas de plantilla) |

## 10. Riesgos principales

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Alcance enorme (reescritura de ~20 k líneas) | Alta | Alta | Fases con criterios de aceptación y *matriz de paridad honesta*: lo no hecho se marca “pendiente”, no “hecho” |
| Regresión de comportamiento GTD | Media | Alta | Tabla de 21 escenarios verificados (RI‑A §8.2) como pruebas de oro; reglas v1 conservadas |
| Pérdida de datos de tiempo | Baja | Crítica | Importador idempotente, `data.json` no se modifica, verificación de sumas por mes, backup |
| UI no probada en Obsidian por el autor | Alta | Media | Guía de pruebas exhaustiva, lógica sin Obsidian en pruebas automáticas, `FakeHost` |
| Sync materializa archivos tarde | Media | Baja | Modelo de eventos conmutativo; la sesión en vivo se reconcilia al llegar el archivo |
| Rendimiento móvil del índice | Media | Media | Prefiltro `listItems`, lotes con cesión de hilo, debounce, render perezoso; métricas en consola de depuración opt‑in |
| Plantillas del usuario con JS | Media | Baja | Templater sigue funcionando; el motor propio no lo desinstala |
| Desacople de nombres de plugin/API | Baja | Alta | `manifest.id`, `journalAPI`, `weeklyAPI` sin cambios |

## 11. Proceso de trabajo (agentes)

El `CLAUDE.md` del repo define un orquestador que delega en agentes especializados con aprobación del usuario en cada fase. Por instrucción
expresa de la sesión (“autonomía total, sin pedir aprobaciones”) las aprobaciones por fase se sustituyen por: *criterios de aceptación automáticos
(build, tipos estrictos, lint, pruebas) + registro en BITÁCORA + commit/push por fase*. Se conserva la separación de roles: ingeniería inversa y
funcionalidades delegadas a agentes, revisión y commit por el orquestador.
