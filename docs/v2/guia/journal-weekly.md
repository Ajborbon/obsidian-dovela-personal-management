# Guía de pruebas · Journal y Weekly (F9)

> Matriz: F66 (vista diaria + conteos), F67 (rutas/carpetas/validación), F68 (vista semanal), F69 (interacciones), F70 (ajustes con vista previa).
> Código: `src/features/journal/` (API, vista viva, bloques nativos, vista previa de ajustes); lógica pura en `src/core/journal/`
> (`daily.ts`, `weekly.ts`, `common.ts`, `validate.ts`, `block.ts`; pruebas en `tests/journal/`, `pnpm test`).
> Requisito previo: plugin v2 instalado en un **vault de prueba** (ver [05 · Guía de pruebas](../05-guia-de-pruebas.md) §1), plugin
> **Datacore** activo (para los bloques `datacorejsx` de las plantillas) y el índice construido (“Dovela: Diagnóstico: estado del índice” = listo).

## 0. Preparación de datos (una vez)

Usa como fecha objetivo **2025-10-24 (viernes, semana `2025-W43`, lunes 20 → domingo 26)**: así los resultados coinciden con los
vectores verificados de RI-E §8.4–8.5 y con las pruebas automáticas.

1. Crea la nota diaria `…/AI - Journals/2025/10/2025-10-24 viernes.md` copiando el **texto completo** de la plantilla real
   `docs/contexto-vault/reglas-vault/plantillas/Journal/Plt - Diaria.md` (sección `# Tareas` con su bloque ```` ```datacorejsx ````).
   El nombre importa: el bloque toma la fecha con `fileName.split(" ")[0]`.
2. Crea la nota semanal `…/AI - Journals/2025/2025-W43.md` con el texto de `Plt - Semanal.md` (sección `### Tareas`, bloque `datacorejsx`
   con `showOverdueLimit: 10`). El bloque toma la semana con `/\d{4}-W\d{1,2}/` del nombre.
   (Las partes Templater `<% %>` de las plantillas no importan para esta prueba; puedes dejarlas o borrarlas.)
3. Crea `Pruebas/Journal tareas.md` con estas líneas (cada letra es el “nombre” de la tarea en las tablas de abajo):

```markdown
## Tareas
- [ ] A 📅 2025-10-24 [hI:: 10:00]
- [ ] A2 📅 2025-10-24 [hI:: 9:00]
- [ ] B ⏳ 2025-10-24
- [ ] C 🛫 2025-10-24
- [ ] D 📅 2025-10-23 [[Nota enlazada J]]
- [ ] E 🛫 2025-10-01
- [ ] F 📅 2025-10-23 [hI:: 08:00]
- [ ] G 📅 2025-10-25
- [/] H
- [ ] I [w::[[2025-W43]]]
- [ ] J [w::[[2025-W42]]]
- [ ] K [w::[[2025-W44]]]
- [ ] L [w::[[2025-W43]]] 📅 2025-10-10
- [/] M [w::[[2025-W43]]]
- [ ] N ⛔ x 📅 2025-10-24
- [ ] O ⛔ x
- [ ] P ⛔ ^y 📅 2025-10-24
- [ ] P2 ⛔ noexiste 📅 2025-10-24
- [x] Q ✅ 2025-10-24
- [x] R
- [x] S ✅ 2025-10-23
- [ ] W ⏫ 📅 2025-10-22
- [ ] X 🆔 x
- [x] Y 🆔 y ✅ 2025-10-20
- [-] Z 📅 2025-10-24
- [ ] K4 📅 2025-10-26
- [ ] K6 📅 2025-10-19
- [ ] K7 🛫 2025-10-19
- [ ] K8 ⏳ 2025-10-27
- [x] K9 ✅ 2025-10-22
```

4. Crea `Pruebas/Nota enlazada J.md` (vacía).

> Si tu vault tiene muchas tareas reales, aparecerán también; compara solo las de `Pruebas/Journal tareas.md`
> (sus filas se identifican por el texto `A`, `B`…). Para una comparación limpia usa un vault de prueba.

---

## 1. Vista diaria desde la plantilla real (F66) — escritorio y móvil

| Paso | Resultado esperado |
|---|---|
| Abre `2025-10-24 viernes` en **vista de lectura** (escritorio) o en la app móvil | Bajo “Tareas del día” aparece primero “Cargando tareas…” (solo si el índice aún se construye) y luego el bloque `📋 Tareas del Día - 2025-10-24 viernes` |
| Revisa los grupos (en este orden) | `⏰ Calendario del Día (2)` → `A2`, `A` (**9:00 antes que 10:00**) · `📅⏳🛫 Programadas para Hoy (4)` → `P`, `P2`, `B`, `C` (📅 → ⏳ → 🛫) · `📊 Tareas para esta Semana (2)` → `I`, `L` · `🔥📊 Tareas de Semanas Anteriores (1)` → `J` (borde rojo) · `🔄 En Progreso (2)` → `H`, `M` · `🔥 Vencidas a Hoy (6)` **plegado** → `E`, `K6`, `K7`, `W`, `D`, `F` (fecha → tipo 📅<⏳<🛫 → prioridad; Journal sí incluye 🛫 vencidas, como v1) · `⛔ Bloqueadas por Dependencias (1)` → `N` · `✅ Completadas Hoy (1)` **plegado** → `Q` |
| Comprueba lo que NO aparece | `G` (futura), `K` (semana futura), `O` (bloqueada sin fecha), `R` (sin ✅), `S` (cerrada otro día), `Z` (cancelada `[-]`), `X` (sin fecha) |
| Mira `W` | Muestra **⏫** (v1 lo pintaba como 🔺) |
| Mira `P2` | Chip `⛔ noexiste ⚠️` (la dependencia no existe: no bloquea, avisa) |
| Mira `N` | Chip `⛔ x 🔗` (navegable) |
| Abre/cierra grupos, luego edita cualquier tarea de la nota de pruebas (paso 3.4) | Tras el refresco automático, los grupos conservan el estado abierto/cerrado que elegiste |

**Móvil:** mismos resultados. Las cabeceras de grupo tienen ≥ 44 px de alto (fácil de tocar); los chips se ajustan en varias líneas.

**Comparar con v1** (vault copia con v1 de `main`): mismos grupos y orden, salvo las correcciones documentadas:
`A2` antes que `A` (v1 ordenaba la hora como texto), `P` en Programadas (v1 la dejaba en Bloqueadas por el `^`), `P2` en Programadas
(v1 la bloqueaba), `W` con ⏫ (v1: 🔺), `Z` no aparece en ningún caso, la casilla completa la tarea (v1 no hacía nada) y la vista se
actualiza sola (v1 había que reabrir la nota).

## 2. Vista semanal desde la plantilla real (F68)

| Paso | Resultado esperado |
|---|---|
| Abre `2025-W43` (lectura o móvil) | Encabezado `Semana 2025-W43` y `20 de octubre - 26 de octubre, 2025` |
| Grupos (en orden) | `📊 Tareas Semanales (3)` → `I`, `L`, `M` (Weekly no distingue `[/]`, como v1) · `🔥 Tareas Vencidas por Fecha (1)` → `K6` (solo 📅/⏳ anteriores al lunes: **no** `K7` ni `E`, que son 🛫) · `📅 Tareas por Día` con subgrupos `Miércoles 22` (`W`), `Jueves 23` (`F`, `D`), `Viernes 24` (`A2`, `A`, `N`, `P`, `P2`, `B`, `C`: tipo 📅<⏳<🛫 → prioridad → hora; Weekly no mira dependencias, como v1), `Sábado 25` (`G`), `Domingo 26` (`K4`) · `🔥 Tareas Vencidas de Semanas Anteriores (1)` → `J` · `✅ Completadas esta Semana (4)` **plegado** → `Y`, `K9`, `S`, `Q` (por fecha de cierre) |
| No aparecen | `K` (W44), `K8` (⏳ 27-oct), `R` (sin ✅), `Z` (`[-]`), `H` (`[/]` sin fecha ni semana, como v1) |
| `showOverdueLimit: 10` (lo pasa la plantilla) | Si una lista de vencidas tiene > 10, se ven 10 y la línea `… y N tareas más` |
| Abre la nota de la semana actual (créala con el comando de notas de journal o a mano, p. ej. `2026-W45`) y añade una tarea `📅 <hoy>` | El día de hoy aparece como `<Día> <n> 📍 Hoy` (p. ej. `Jueves 5 📍 Hoy`) resaltado con borde de acento |
| Contextos/personas | En Weekly se muestran como chips `📋 contexto` / `👤 persona` (como v1); en Journal no (como v1) |

**Comparar con v1:** mismo orden y títulos. Diferencias: grupos plegables con `<details>` nativo (v1: clic en el título h3), prioridad
con el símbolo escrito, borde de año ISO correcto (v1 calculaba mal el lunes los días 29–31 de diciembre), checkbox funcional y refresco.

## 3. Interacciones (F69)

| # | Acción (escritorio / móvil) | Resultado esperado |
|---|---|---|
| 3.1 | Clic/toque en el texto de `B` en la vista **diaria** | Se abre `Pruebas/Journal tareas.md` **en la misma pestaña** con el cursor en la línea de `B` (como v1). Ctrl/Cmd+clic → pestaña nueva |
| 3.2 | Clic en una tarea de la vista **semanal** | Se abre en **pestaña nueva** en su línea (como v1) |
| 3.3 | Clic en el enlace `Nota enlazada J` dentro de `D` | Abre `Pruebas/Nota enlazada J.md` (no abre la nota de la tarea) |
| 3.4 | Marca la casilla de `B` | La línea pasa a `- [x] B ⏳ 2025-10-24 ✅ <hoy>`; en < 1 s `B` sale de Programadas y, si `<hoy>` = 2025-10-24, aparece en Completadas Hoy. (v1: solo `console.log`) |
| 3.5 | Desmarca `Q` en “✅ Completadas Hoy” | La línea vuelve a `- [ ] Q` (se quita el sello ✅) y desaparece de Completadas |
| 3.6 | Edita a mano `B` en otra pestaña y cámbiale la fecha a `2025-10-23` | Sin reabrir la nota diaria, `B` pasa a “🔥 Vencidas a Hoy” |
| 3.7 | Clic en `🔗` de `N` | Abre la nota de `X` en su línea |
| 3.8 | Marca `X` como hecha (casilla en cualquier vista o en la nota) | `N` pasa de Bloqueadas a Programadas automáticamente |
| 3.9 | Edita la línea de `B` en el archivo justo antes de marcarla (texto distinto) y marca la casilla vieja | Aviso “no se modificó la tarea: …” y la casilla vuelve a su estado: nunca se escribe en una línea equivocada |
| 3.10 | Con Sync: marca una tarea en el móvil | En el escritorio la vista diaria abierta se actualiza sola al llegar el cambio |

**Fugas (escritorio, opcional):** abre y cierra la nota diaria 10 veces y luego edita una tarea. En las herramientas de desarrollo
(Memory → heap snapshot) no deben quedar elementos `journal-tasks-container` desconectados retenidos; con `logger.debugEnabled` no hay
errores. Los elementos desmontados se desuscriben del índice en el siguiente cambio (comprobación `isConnected`).

## 4. Opciones de render (F66)

Pruébalas copiando el bloque de la Diaria y cambiando la llamada a `renderTasksForDate(targetDate, { … })`, o (más fácil, también en móvil)
con el bloque nativo del §6:

| Opción | Resultado esperado |
|---|---|
| `showOverdueLimit: 2` | `🔥 Vencidas a Hoy (6)` muestra 2 tareas y `… y 4 tareas más` (por defecto el límite es 50, como v1) |
| `showOnlyCritical: true` | Vencidas solo con 🔺/⏫ (`W`); título `(1)` y nota “5 vencidas sin prioridad 🔺/⏫ ocultas” (v1: opción sin efecto) |
| `groupOverdueByWeek: true` | Dentro de Vencidas, subgrupos `📊 2025-W40 (1)` (`E`), `📊 2025-W42 (2)` (`K6`, `K7`), `📊 2025-W43 (3)` (`W`, `D`, `F`) (v1: sin efecto) |
| `enableQuickActions: true` | Cada tarea abierta muestra `🔄` (pasa a `[/]`) y cada `[/]` muestra `⏸` (vuelve a `[ ]`) (v1: sin efecto) |
| Semanal `showCompletedCollapsed: false` / `highlightToday: false` | Completadas abierto / sin `📍 Hoy` |

## 5. Resto de la API pública (F66–F68)

En **escritorio** abre la consola (Ctrl/Cmd+Shift+I) y ejecuta `const p = app.plugins.plugins["obsidian-dovela-personal-management"];`.
En **móvil** (sin consola) pega en una nota este bloque y míralo en lectura:

````markdown
```datacorejsx
const p = dc.app.plugins.plugins["obsidian-dovela-personal-management"];
return function View() {
  const [out, setOut] = dc.useState("…");
  dc.useEffect(() => { (async () => {
    const r = {
      ruta: p.journalAPI.getDailyNotePath("2025-10-24"),
      enlace: p.journalAPI.generateWeeklyLink("2025-W43"),
      conteosDia: await p.journalAPI.getTaskCounts("2025-10-24"),
      conteosSemana: await p.weeklyAPI.getTaskCounts("2025-W43"),
      notaSemanal: p.weeklyAPI.getWeeklyNotePath("2025-W43"),
      semanaDe: p.weeklyAPI.getWeekCodeFromDate("2025-12-29"),
      actual: p.weeklyAPI.getCurrentWeekCode(),
      valida: await p.journalAPI.validateJournalSettings(),
    };
    setOut(JSON.stringify(r, null, 2));
  })().catch(e => setOut("Error: " + e.message)); }, []);
  return <pre>{out}</pre>;
};
```
````

| Llamada | Resultado esperado (ajustes por defecto v2: año ✅, trimestre ❌, mes ✅) |
|---|---|
| `getDailyNotePath("2025-10-24")` | `03 - Gestion Personal/AV - Gerente de Vida/AI - Journals/2025/10/2025-10-24 viernes.md` (con trimestre ✅ y mes ❌: `…/2025/Q4/…`; `2025-02-15` → `Q1`, v1 daba `Q2`) |
| `getDailyNotePath("2025-02-30")` | lanza `Formato de fecha inválido: 2025-02-30. Use YYYY-MM-DD` (v1 la aceptaba) |
| `generateWeeklyLink("2025-W43")` | `[w::[[…/AI - Journals/2025/Q4/2025-W43\|2025-W43]]]` |
| `getTaskCounts("2025-10-24")` | `{calendar:2, programmed:4, overdue:6, inProgress:2, blocked:1, completed:1, weekly:2, weeklyOverdue:1}` (solo con los datos de prueba). `programmed` ahora cuenta (en v1 siempre 0 por un fallo de su regex); `weekly`/`weeklyOverdue` son claves nuevas |
| `getTaskCounts("hola")` | todo a 0 (como v1) |
| `weeklyAPI.getTaskCounts("2025-W43")` | claves de v1 `weekly, monday…sunday, overdue, completed` + `overdueByDate` (nueva). `overdue` cuenta solo semanas anteriores, como v1 |
| `getWeeklyNotePath("2025-W43")` | Si existe una nota llamada `2025-W43` → su ruta real; si no → `…/AI - Journals/2025/2025-W43.md` (patrón “Carpeta de notas semanales…” de ajustes) |
| `getWeekCodeFromDate("2025-12-29")` | `2026-W01` |
| `ensureFolderStructure("2030-01-15")` (journal) | Crea `…/AI - Journals/2030/01` (sin errores si ya existe). `weeklyAPI.ensureFolderStructure("2030-W03")` crea `…/AI - Journals/2030` |
| `renderTasksForDate("ayer")` / `renderTasksForWeek("2025-W99")` | Devuelven un recuadro rojo `Error Journal: Formato de fecha inválido…` / `Error Weekly: Formato de semana inválido…`; no lanzan |

## 6. Bloques nativos `dovela-dia` / `dovela-semana` (alternativa opcional a `datacorejsx`)

No requieren Datacore, se refrescan solos y se desmontan limpiamente (ciclo de vida de Obsidian). En la nota diaria puedes sustituir el
bloque de tareas de la plantilla por:

````markdown
```dovela-dia
```
````

Sin contenido toma la fecha del nombre de la nota (`2025-10-24 viernes` → `2025-10-24`); en una nota sin fecha usa **hoy**. Contenido opcional:

````markdown
```dovela-dia
2025-10-24
limite: 20
agrupar-por-semana: sí
solo-criticas: no
acciones-rapidas: sí
```
````

y en la semanal (`2025-W43` del nombre, o `esta semana`):

````markdown
```dovela-semana
limite: 10
completadas-colapsadas: sí
resaltar-hoy: sí
```
````

También valen los nombres de v1 (`showOverdueLimit: 10`, `highlightToday: false`…). Una línea u opción no reconocida se muestra como
aviso ⚠️ encima de la vista (no rompe el render). Pruebas: repite §1–§4 con el bloque nativo en **modo lectura y en Live Preview**,
en escritorio y móvil; los resultados deben ser idénticos a los del bloque `datacorejsx`. Cierra la nota y edita una tarea: no debe
quedar ningún listener activo (el bloque llama `dispose()` al descargarse).

## 7. Ajustes con vista previa (F70)

| Paso | Resultado esperado |
|---|---|
| Ajustes → Dovela → sección **Journal** | Los campos de v1 (carpeta base, año/trimestre/mes, patrón de semana) + carpeta de notas de periodo |
| Sección **Journal: vista previa** justo debajo | Estado de la carpeta base (✅ existe / ℹ️ se creará / ⚠️ inválida) y tres rutas de ejemplo con la fecha de **hoy**: nota diaria, enlace `[w::…]` y nota semanal |
| Activa “Subcarpeta por trimestre” | La vista previa cambia al instante (`…/2026/Q4/11/…`) |
| Escribe `a:b` en la carpeta base | `⚠️ La carpeta contiene caracteres inválidos: < > : " \| ? *` |
| Escribe la ruta de una **nota** existente como carpeta base | `⚠️ "<ruta>" es un archivo, no una carpeta` |
| “Restablecer Journal” | Vuelve a los valores por defecto v2 y la vista previa se recalcula |

**Comparar con v1:** v1 mostraba un ejemplo fijo (`2025-10-24 viernes.md`) y marcaba el campo en rojo; v2 muestra rutas reales para hoy
(trimestre corregido) y el mensaje de validación textual.

## 8. Diferencias v1 → v2 (resumen)

| Tema | v1 | v2 |
|---|---|---|
| Casilla | no hacía nada (`console.log`) | completa (`✅ hoy`) / reabre; escritura verificada (`vault.process`) |
| Refresco | al reabrir la nota | automático al cambiar el índice, solo mientras la vista está en pantalla |
| Rendimiento | `parseVault` completo en cada render y en cada clic de dependencia | índice compartido; contenido de grupos plegados creado al abrirlos |
| Hora del calendario | texto (`10:00` < `9:00`) | numérica |
| `⛔ ^id` / id inexistente | siempre bloqueada | se resuelve / no bloquea con ⚠️ |
| Prioridad | ⏫ mostrado como 🔺; 🔺 no reconocido | símbolo escrito; 🔺 reconocido |
| Semanas | `moment().year(Y).isoWeek(W)` (falla 29–31 dic) | año ISO anclado al 4 de enero |
| `[-]` cancelada | ignorada | ignorada (no se muestra ni cuenta) |
| Fechas/semanas imposibles | `2025-02-30`, `2025-W99` aceptadas | rechazadas con el mensaje de v1 |
| Opciones `groupOverdueByWeek`, `showOnlyCritical`, `enableQuickActions` | sin efecto | implementadas |
| `getTaskCounts().programmed` | siempre 0 | correcto |
| Nombre del día | locale de Obsidian | español fijo (como el vault) |
