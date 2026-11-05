# F - Intención de las funcionalidades según la historia del proyecto

Fuente: `docs/contexto-vault/historia/` (solo lectura). Se leyeron completas las 82 notas `Cmt` + el índice `RC - Desarrollo Dovela` (83 archivos), `PGTD - Dovela v0.9`, todo `PGTD-Dovela-v1.0-retoma`, `PGTD-Sistema-de-Gestion-Personal-DOVELA`, `Ax 250703 - Reglas y Estructura de las listas de tareas GTD de Dovela v1.0`, los Ax de Smart Inbox y cierre de tarea (`Ax 250821 *`), el PGTD de Pomodoro, los PGTD/Ax de Journal y Weekly y la mayor parte de v0.2 (Time Tracker, En Progreso, Cronograma, Foco, Smart Inbox, listas GTD). v0.1 solo skimeado (es entorno/repositorio/licencia; sin reglas de negocio).

Convenciones: las citas entre comillas son fieles al contenido, con tildes/ortografía normalizadas en algunos casos (los originales tienen erratas, p. ej. "problable", "este" por "esté"). "(inferencia)" = lo deduzco y no lo dice textualmente la nota. Las citas entre comillas son literales y llevan el nombre de la nota origen. "Cmt AAMMDD HHMM" = nota `Cmt 25MMDD HHMM - ...`. El estado `🔵` en un PGTD significa "archivado/cerrado" (ver `Cmt 250715 0733`: "cambiando su estado a `🔵` para archivarlo"); `🟢` = activo.

---

## 0. Advertencias de lectura (inconsistencias de las propias notas)

1. **Glifo de tarea abierta ambiguo.** `Ax 250703 - Reglas y Estructura...` escribe todos sus ejemplos como `- [-] ...` (y `Cmt 250913 1816` dice "detecta tareas abiertas [-] y las pasa a progreso [/]"), pero en el vault real `[-]` es "cancelada" (`PGTD - Dovela v0.9`: `- [-] Desarrollo de complemento de campañas...`). El parser y los comandos usan `- [ ]` (abierta) y `- [/]` (en progreso): `Cmt 250819 1649` ("Tarea válida (- [ ] o - [/])"), `Cmt 250715 0733` (busca "tareas abiertas (`- [ ]`)"), `Ax 250821 - Prompt para el cierre...`. Probable artefacto de transcripción; no asumir que `[-]` es abierta.
2. **Reglas v1.0 vs. implementación.** El Ax de reglas habla de "nueve listas"; la implementación añadió una décima, **Vencidas** (`Cmt 250705 1910`: "nueva lista 'Vencidas'"), y la tabla de transiciones del Ax dice que "Ojalá Hoy -> Next Actions cuando la fecha pasa", lo que contradice la lista Vencidas. Prevalece lo corregido por Andrés en pruebas (ver sección 2.1).
3. **Símbolo de En Pausa.** La IA planeó con `✈️` (`Ax 250705 - Plan de corrección...`); el símbolo correcto es `🛫` (`Cmt 250705 2147`: "capturar el símbolo de la fecha (`🛫`, `⏳`, `📅`)").
4. **Documento obsoleto.** `Ax 250814 - Entendimiento del time Tracker` describe `Dovela/TimeLog.json` / `timelogs.json` en la ruta del vault; ya migrado a `data.json` (`Cmt 250709 2152`). Y el ATP original (`Ax 250706 - ATP del time tracker`, ATP-3.2/3.3: preguntar al reabrir si guardar la sesión interrumpida) fue **superado**: `Cmt 250714 2006` marca "Manejo de Sesiones Interrumpidas (Deprecado)".
5. **El backlog v0.9 está contradictorio en el tiempo.** `PGTD - Dovela v0.9` tiene hoy 57 tareas `[x]` (36 con `✅ 2026-08-26`, es decir cerradas en bloque ese día), 1 `[-]` y 0 `[ ]`, mientras que `PGTD 260706 - Dovela v1.0 - Retoma...` (julio 2026) dice "40 tareas abiertas por auditar" y mantiene `- [ ] Auditar las 40 tareas abiertas...` sin marcar. Cierre `✅ 2026-08-26` NO prueba implementación: varias no tienen ningún commit (ver sección 3.2).
6. **Huecos en la historia de commits:** 2025-07-15 -> 2025-08-14; 2025-08-30 -> 2025-09-10; 2025-09-17 -> 2025-10-24; y pausa 2025-10-25 -> 2026-07-06 (`Cmt 260706 1621`: "retoma del proyecto tras pausa oct 2025-jul 2026"). La última funcionalidad commiteada es Weekly (`Cmt 251025 0919`). Tareas v0.9 fechadas 2025-10-27 no pueden estar en commits.
7. `Cmt 251024 1020` aclara: "este commit fue para almacenar cambios que tenia y que no habia guardado desde la ultima sesion de desarrollo" (mezcla trabajo de sep 2025: árbol de backlinks/pestañas).
8. `Cmt 251025 0919`: "a partir de este commit empece a implementar los agentes de Claude" (antes: Copilot en v0.1, Gemini CLI en v0.2 - `PGTD - Dovela v0.2` cita `Ax 250701 - Sistema de Conocimiento para desarrollo de plugin para gemini CLI`).

---

## 1. Tabla cronológica commit -> funcionalidad -> intención -> decisiones/problemas

Versiones: tag `0.1.0` (Cmt 250702 2247), `0.2.1` (Cmt 250703 0218); `manifest.json` estaba en `0.0.0` hasta el 2026-07-06 (-> `1.0.0`, `PGTD 260706`).

| Fecha-hora (hash) | Funcionalidad | Intención / por qué | Decisiones, problemas, regresiones |
|---|---|---|---|
| 250702 2247 (63cd05e, tag 0.1.0) | Base inicial limpia | Reinicio del plugin: "me di cuenta que no se que hice" (`PGTD - Dovela v0.2`, 2025-07-02) | Decisión: reconstruir desde cero con estructura documentada para sumar desde ahí |
| 250702 2323 (c327ff7) | Estructura del plugin | Quitar código de plantilla de Obsidian | `main.ts` mínimo |
| 250703 0202 (2841b29) | Módulo GTD v3 | Parseo por estructura de carpetas/prefijos, jerarquía, clasificación en listas GTD, vista con dos modos (jerárquico y listas), comando + icono | Origen de `moduloGTDv3` |
| 250703 0218 (3d59e12, 0.2.1) | Abrir en pestaña nueva + total de tareas | Dashboard en pestaña propia, contador de tareas abiertas | - |
| 250703 0239 (bfbee23) | Jerarquía | Mostrar estado de la nota; contador `(X) - <Y>` propias vs descendencia | Formato de contador definido |
| 250705 1614 (07d9416) | Refactor motor GTD | Parser con regex para metadatos inline (📅 ⏳ ⛔ `[w::]`); placeholders de carpeta sin nota `[FALTA]`; dependencias vía mapa de tareas | Modelo ampliado (`duration`, `week`, `tags`) |
| 250705 1910 (6f501fd) | Detección de conflictos + lista Vencidas | Tareas con horas/duración incoherentes van a Inbox para revisión (`hasConflict`) | Se crea lista 'Vencidas'; agrupación por contexto/orden por prioridad en 'Ojalá Hoy' |
| 250705 2147 (5937db2) | Fix clasificación y zona horaria | Pruebas (`Ax 250705 - Hallazgos...`) mostraron tareas de hoy fuera de lugar | **Bug UTC vs local** -> moment.js/zona local; `if/else if` estricto para evitar duplicados en Inbox; guardar símbolo de fecha (🛫/⏳/📅) |
| 250705 2221 (9073edd) | Vencidas ordenadas por fecha | "las más antiguas aparezcan primero" | Detectado por Andrés al probar |
| 250705 2301 (6ead31a) | Filtros contexto/persona + navegación rápida | Respuesta instantánea sin recargar; solo contextos/personas con tareas abiertas | Cabecera sticky |
| 250705 2319 (4210c10) | Fix scroll sticky | Que el título de lista no quede tras la cabecera | `scroll-margin-top` |
| 250706 0004 (cc48394) | Breadcrumb desplegable de origen | Saber de qué nota viene la tarea "sin abandonar la vista" (`Ax 250706 - Funcionalidad de Breadcrumb...`) | **Bug crítico: listeners duplicados en cada redibujado** -> `AbortController`; se elimina `[FALTA]` del breadcrumb |
| 250706 0123 (5516d8d) | Rediseño jerárquico ("Jerarquía Fusionada") | Fusionar nota-carpeta con su directorio; tarjetas anidadas `<details>`; Expandir/Colapsar todo | Orden alfabético en grupos |
| 250706 0156 (a77457d) | Jerarquía y filtros | Orden alfabético de áreas de vida; arreglo de filtros contexto/persona | Enlace de navegación robusto |
| 250706 0203 (bc761c9) | Fix ancla 'Algún día/Tal vez' | Bug: `/` sin sanear en el href | Regex: todo no alfanumérico -> `-` |
| 250706 1236 (c73bd29) | Vista En Progreso | "Centro de mando del día" para tareas `- [/]` (`Ax 250706 - Concepto General...`) | Estado `in-progress`; secciones Vencidas / Prioridades de Hoy / Otras |
| 250706 1349 (f9b44d7) | Controles dinámicos En Progreso | "Lentes": agrupar por Contexto/Persona/Proyecto; ordenar por Duración cíclico | Algoritmo de proyecto elegido por Andrés: PGTD > AI > prefijo estructural > carpeta |
| 250706 2209 (64b124c) | Time Tracker completo | Registro en vivo y manual, estadísticas jerárquicas, filtros, barra de estado | **Regresiones del propio desarrollo** (expandir/colapsar, abrir nota, breadcrumb, filtros, agrupación En Progreso) corregidas en el mismo commit |
| 250706 2259 (4312953) | Time Tracker con Moment.js + árbol | Consistencia de fechas; nodos hoja con registros individuales | Se reescribe `timelogs.json` al nuevo formato |
| 250707 0016 (111ce0f) | Rediseño Time Tracker 2 columnas | `Ax 250706 - Análisis de UX... Propuesta de Rediseño` | Estado del temporizador centralizado en `main.ts`; bug de inputs de fecha del filtro Personalizado; actualización en tiempo real |
| 250708 1511 (339f026) | Errores TS / robustez | `exactOptionalPropertyTypes`, undefined | Condiciones de carrera al detener el temporizador |
| 250708 1845 (98c6ca3) | Smart Inbox inicial | Captura "con mínima fricción" (`Ax 250708 - Plan... Bandeja de Entrada v3.0`) | **Este commit borró ~500 líneas de CSS** y rompió botones del dashboard (`Ax 250709 - Recuperación...`) |
| 250709 1159 (9cf52a4) | Fix estilos | `git checkout 339f026 -- styles.css`; CSS de Smart Inbox no cargaba | **Regla: un solo `styles.css` en raíz** (el plugin solo carga ese) |
| 250709 1342 (192c3f9) | Fix parseo de proyectos | Nombres con punto/tilde se truncaban y la tarea caía al Inbox | Regex `@([\w\s-]+)` -> `/@([^#!]+)/` |
| 250709 1656 (5e417d1) | UX Time Tracker | Árbol inicia "colapsar parcialmente"; resumen Tiempo Total/Registros; botón "Ir a la tarea" | Tareas del 2025-07-09 de `PGTD - Dovela v0.2` |
| 250709 2116 (9c6ba58) | Registro de tiempo mejorado | Selector de tarea con búsqueda (Notas abiertas / En progreso / Todas); fechas con `toISOString(true)` | Fruto de `Ax 250709 - Resolviendo de nuevo el problema de la ventana de cerrar tareas que no se abre` (bug recurrente; la IA reconoció un "efecto secundario crítico") |
| 250709 2152 (b495722) | `timelogs.json` -> `data.json` | Alinear con API de Obsidian (`loadData/saveData`); modelo `DovelaPluginData` | Migración automática; bug: Estadísticas vacías por leer fuente obsoleta |
| 250709 2250 (1f3df32) | Cronograma | Calendario tipo Outlook de lo registrado (día / 3 días / semana), arrastrar y redimensionar | Bug de recarga al cambiar de pestaña |
| 250709 2339 (05c2a8f) | Mejoras Cronograma | Paleta curada, tooltip, multi-día segmentado, copia con Alt+arrastre, sticky | Bug al eliminar bloque duplicado |
| 250710 0118 (e50f3ff) | Calendario emergente + enlace a nota | Mapa de calor para saltar a fechas; icono para abrir la nota desde el modal | - |
| 250710 0221 (45a56ed) | Vista de Foco | Vista contextual de un proyecto (`Ax 250710 - Analisis de UX y Propuesta`) | **Decisión: duplicar y adaptar `moduloGTDv3` en `moduloFoco` "evitando así regresiones"** |
| 250714 1654 (4192b91) | Fix tipos | Desactiva `exactOptionalPropertyTypes` | Deuda declarada de tipado |
| 250714 1723 (2674143) | Botón ribbon Smart Inbox | "sin interrumpir su flujo" | - |
| 250714 1737 (fb345ab) | Filtros con `<input>`+`<datalist>` | Listas largas de cx/px; vacío = mostrar todo | Aplicado igual a GTD y Foco |
| 250714 1758 (3d33f15) | Búsqueda ampliada Time Tracker | Buscar también por cx/px/tags GTD | Tarea 2025-07-10 de v0.2 |
| 250714 1811 (4e12d34) | Filtro por contenido | Tercer criterio (contexto, persona, contenido) | `data-content` |
| 250714 2006 (f636d7b) | Sincronización del temporizador entre dispositivos | Iniciar/detener en un dispositivo se refleja en todos | Polling cada 15 s sobre `data.json`; sesiones interrumpidas deprecadas |
| 250714 2015 (ab8c903) | Comando y botón iniciar temporizador | Iniciar para la nota activa | Solo si no hay otro temporizador |
| 250714 2113 (403ec34) | Panel de Actividad | Métricas capturadas vs completadas, notas nuevas vs modificadas | `AnalyzerService` |
| 250715 0733 (0cf9513) | Panel de Revisión (proyectos estancados) | Mantener integridad GTD: proyecto 🟢 sin acciones -> estancado | Acciones: añadir tarea / archivar (🔵) / abrir carpeta |
| 250715 2132 (90c194e) | Refactor estabilidad | null checks, `override`, imports con `.js`, typo `ampmMatch` | - |
| 250715 2229 (4313a10) | Fix inicialización | Smart Inbox: autocompletado solo tras guardar una tarea -> `collectMetadata` en `onLayoutReady`; modal 'X/Esc' dejaba temporizador "fantasma"; filtro de Estadísticas se reseteaba a "Siempre" | 3 bugs recurrentes (ver 2.x) |
| 250814 1339 (cd05d5f) | Modificar temporizador en curso | Cambiar hora de inicio y notas sin detener | **Regresiones corregidas:** Cronograma (abrir modal correcto), botón '+ Registrar Tiempo' sin selector, CSS de botones |
| 250814 1613 (d5c136e) | Zoom del Cronograma | Altura 1x-4x; ocultar contenido progresivamente | - |
| 250814 2025 (1386d12) | UX Estadísticas | Registros editables, badges de fecha, descripción solo si difiere del proyecto | Bug crítico: lista de registros no renderizaba; día de semana siempre en español |
| 250814 2155 (bec55da) | Estadísticas: salto inteligente, colores | Expandir cadena hasta bifurcación o nota con registros; color por tipo de carpeta | Formato `45m` |
| 250814 2328 (61be1a4) | Selector de fechas unificado | Barra única + `DatePickerModal` (día o rango) | - |
| 250815 0028 (f9215b5) | Separar Time Tracker y Estadísticas | Modularidad (`StatisticsView`) | Título de foco |
| 250815 0105 (481b005) | Exportar a Excel | Clic derecho en nodo -> "Exportar a Excel", recursivo | **EROFS** -> generación en memoria + descarga; dependencia `xlsx` |
| 250815 0136 (6fabf40) | Mapa de calor en selector | Ver de un vistazo días con registros | `activity-low/medium/high` |
| 250815 0210 (d4a895a) | Próximas Acciones por contexto | Análogo a Delegadas por persona | Sin contexto -> '(Sin Contexto)'; ocultar sección vacía |
| 250815 0239 (e7ba909) | Scroll suave a anclas | Consistencia en Foco, GTD, Dashboard, Actividad | `.gtd-nav-link` |
| 250819 1559 (e3a7910) | Fix TS | - | Sin detalle |
| 250819 1649 (8cebec7) | Temporizador según tarea seleccionada | Precisión del seguimiento (`Ax 250819 - Mejora del comando...`) | Selección multi-línea o no-tarea -> `Notice`; extracción a `TimeTrackerCommands` |
| 250819 1904 (233fdea) | Navegación expandida con sublistas | Acceso rápido con contadores a contextos/personas | `NavigationItem` |
| 250819 2149 (ef6bd64) | Estados visuales | `displayStatus`: overdue, today, future, paused-dep, paused-start | Orden Ojalá Hoy -> Próximas -> Asignadas |
| 250819 2257 (2a84ed7) | Header pegajoso, filtros responsivos | Móvil; vista por defecto 'gtd' | Contadores sincronizados con filtros |
| 250820 0630 (3edd7b4) | Inputs y móvil | Áreas táctiles >=36px | - |
| 250820 0944 (e8fa765) | Fix z-index móvil | Filtros colapsados interceptaban clics (`v0.9`: "pareciera que se está eligiendo el elemento toggle de alguno de los filtros") | Táctil 44px, fuente >=16px iOS |
| 250820 2200 (9f791e0) | Fechas Start + múltiples referencias | Tareas en todas las sublistas cx/px; Start <= Schedule <= Due | Fechas incoherentes -> Inbox; eliminada duplicación en Vencidas |
| 250820 2317 (5aa0b67) | Dependencias | Triple listado (En Pausa + Ojalá Hoy + Vencidas); `⛔ ID` -> `🔗` navegable | Naranja/rojo |
| 250821 0935 (74e3e94) | Menús en cascada Smart Inbox | `Ax 250821 - Prompt para mejorar Smart Inbox` | Arquitectura `CascadeMenu*` |
| 250821 1422 (b8a43b3) | Checkbox 'cerrar tarea' | `Ax 250821 - Prompt para el cierre de tareas...` | Lógica simplificada por comparación de nombres; botón móvil |
| 250829 1123 (9470de5) | Vencidas dual (fecha-primero / contexto-primero) | Toggle de organización | Overdue pasa a `Map` |
| 250830 1247 (dec855e) | TS + Agenda de Hoy | Hora de cita y tiempo en Ojalá Hoy | Bug toggle Vencidas que revertía |
| 250830 1337 (cb4495a) | Fix toggle Foco, px sin cx, Calendario | `px` sin `cx` solo en Asignadas | Calendario ordenado fecha->hora |
| 250910 2100 (5d84174) | Módulo Backlinks | Alternativa nativa a bloques DataviewJS | 3 estilos de breadcrumb; settings en `localStorage` |
| 250910 2344 (33351fe) | Fechas y monto en backlinks | Contexto de notas de tipo transacción | `moneda`, `monto` del frontmatter |
| 250911 1053 (33621f4) | Títulos multilínea | Los títulos se cortaban | line-clamp 3 |
| 250911 1206 (495cfea) | Header de backlinks | Más espacio, ruta navegable | - |
| 250912 1342 (3a0b3de) | Expansión bidireccional Foco | Salientes (def. 2) + entrantes (def. 5); carpeta de terminación 'AI - Journals' | Grupos separados para evitar contaminación cruzada |
| 250912 1729 (9f1ff61) | Nota activa en Smart Inbox + header colapsable | Primera opción en `@`; móvil | Persistido en `localStorage` |
| 250913 1550 (25ba5bb) | Cancelar registro | Descartar un registro iniciado por error | - |
| 250913 1717 (bb7aeeb) | Pomodoro completo con overtime | Ver sección 2.14 | - |
| 250913 1748 (3409919) | Fix: nota activa siempre primera | No aparecía para PGTD/AV/AI; separador sobraba | - |
| 250913 1816 (f7015bc) | Pomodoro + estados de tarea | Reutilizar reglas del temporizador | `taskStateManager.ts` |
| 250916 1740 (e9a6cde) | Modal Pomodoro + sincronización | Notas editables; sincronizar Foco y GTD | **Bugs:** registro duplicado en overtime y loop infinito en modal |
| 250917 0544 (0dd4bbe) | Árbol de backlinks, pestañas y búsqueda jerárquica | Ver notas abiertas con título completo; buscar en jerarquía | Cache de contenido |
| 251024 1020 (396fe22) | Expansión inteligente de carpetas | Commit de cambios no guardados | `shouldExpandFolder()` |
| 251024 1535 (7645c42) | Módulo Journal | Tareas del día desde la nota diaria | Parser de `[w::[[2025-W43]]]` |
| 251025 0919 (72fb1a1) | Módulo Weekly | Tareas de la semana | Inicio de agentes Claude |
| 260706 1621 (ef3b3e1) | Fix recursión backlinks | Crash 'Reiniciando bóveda' | `createPathBreadcrumbs` -> `createFullBreadcrumb` |

---

## 2. Por funcionalidad

### 2.1 Listas GTD (Dashboard "Listas GTD")
**Comportamiento esperado:** botón que muestra todas las tareas abiertas clasificadas en listas canónicas GTD con sección `<details>`, contador y orden definido (`Ax 250705 - Documentación funcional del boton Listas GTD...`).

**Reglas de negocio (`Ax 250703 - Reglas y Estructura...`, corregido por pruebas del 2025-07-05):**
- **Inbox:** `#inbox`, sin tags/metadatos, "no clasifican claramente", fecha sin contexto/asignación, `[w::]` pasada sin contexto/asignación, conflictos hI/hF/duración.
- **Próximas Acciones:** al menos un `#cx-`; puede tener `#px-`. "Aunque la persona (#px-) esté presente, si hay contexto (#cx-), se sitúa aquí y no en Asignadas". 🛫/⏳/📅 hoy o pasada con contexto; dependencias cumplidas; semana comenzada. Agrupada por contexto (`Cmt 250815 0210`).
- **Calendario:** "REQUISITO OBLIGATORIO: Deben incluir AMBOS elementos: 📅 + `[hI::]`". "Una tarea con 📅 pero sin [hI::] NO pertenece a esta lista, sino a 'Ojalá Hoy'". Duración por defecto 30 min; hF y duración en discrepancia -> Inbox; `[Xmin]`/`[Xh]` (`[Xm]` no soportado, `Ax 250706 - Confirmación...`). `Cmt 250830 1337`: muestra TODAS las `isDueDate + startTime`, ordenadas fecha (antiguas primero) y hora; 'Agenda de Hoy' solo para hoy.
- **Ojalá Hoy:** ⏳ o 📅 (sin hI) de hoy; 📅 con más prioridad que ⏳ y luego ⏫🔼🔽⏬; agrupada por cx/px. "Las tareas de fechas actual o pasadas sin contexto o asignación se muestran en este listado según corresponda, pero también se muestran en Inbox".
- **Asignadas o Delegadas:** `#px-` SIN `#cx-` (`Cmt 250830 1337`: "Eliminada duplicación incorrecta"). "Cuando termina el plazo de la tarea y esta tiene dependientes, el sistema debe alertar" (no implementado, `Ax 250705 - Funcionalidades faltantes`). Debe seguir apareciendo también si tiene contexto y fecha vencida/hoy, en color: rojo vencida, naranja hoy (`PGTD - Dovela v0.2`, 2025-08-15).
- **Proyectos:** `#cx-ProyectoGTD` o `#cx-Entregable`; "Al revisar esta lista, se debe definir la siguiente acción concreta".
- **Algún día/Tal vez:** `#GTD-AlgunDia`. **Esta semana no:** `#GTD-EstaSemanaNo`.
- **En Pausa:** SOLO 🛫 futura, `⛔` pendiente, o `[w::]` futura. `Ax 250705 - Problemas en las tareas creadas...`: "Aquí solo deberían aparecer las tareas que tienen fecha futura con el símbolo 🛫, no con ningún otro símbolo como ⏳/📅".
- **Vencidas (añadida):** 📅/⏳ pasados con contexto o asignación, orden por fecha ascendente; toggle fecha-primero/contexto-primero.
- **Conflictos -> Inbox:** hora final < inicial; duración incoherente; dependencias circulares; formato de hora/fecha incorrecto; fecha presente/pasada sin cx/px.
- **Una tarea una sola lista** salvo duplicaciones explícitas: múltiples cx/px (cada sublista), Start vencido+Due hoy (varias listas), dependientes (En Pausa + Ojalá Hoy + Vencidas).
- Transiciones: se recalculan en cada render (`Ax 250705 - Funcionalidades faltantes` lo señala como diferencia con "mover").

**Bugs recurrentes:** zona horaria UTC (`Cmt 250705 2147`); duplicados en Inbox y Vencidas (`Ax 250705 - Hallazgos`, `Cmt 250820 2200`); "contador total no debe incluir duplicadas" (`PGTD - Dovela v0.9`); px sin cx duplicado en Próximas (2025-08-21 -> `Cmt 250830 1337`); ancla con `/` (`Cmt 250706 0203`); la IA no entendió los símbolos al pasarle las reglas (`PGTD - Funcionalidad completa de tareas por listas GTD`: "los simbolos 🛫/⏳/📅 no los recibió adecuadamente").
**Deuda declarada:** alertas por plazo vencido con dependientes; transiciones no persistentes; `[Xm]`; hallazgo 2025-07-05 de que el modelo asumía "una tarea = una lista" (cambio fundamental para duplicación).

### 2.2 Jerarquía
**Esperado:** árbol que refleja la estructura de carpetas del vault: nota-carpeta fusionada, placeholders `[FALTA]` si la carpeta no tiene nota, estado de nota visible, contador `(propias) - <descendencia>`, tarjetas anidadas, Expandir/Colapsar todo, primer nivel alfabético (`Cmt 250703 0239`, `250705 1614`, `250706 0123/0156`). Búsqueda jerárquica por título o contenido con cache (`Cmt 250917 0544`). v0.9: "En la vista jerárquica, debería tener una funcionalidad de búsqueda de notas" (cerrado 2025-10-21).
**Bugs/regresiones:** botones perdidos tras Smart Inbox y tras Time Tracker (`Cmt 250706 2209`: "Expansión y colapso global... Apertura de notas... Visibilidad del breadcrumb").
**Duda declarada:** v0.9 2025-09-10 "Validar si debo cambiar la lógica de la suma de las tareas hijo, dado que estoy cambiando el concepto de los enlaces de las notas, prevalece el enlace de la nota hija, apuntando a la nota padre diciendo que es el origen" (marcada hecha 2026-08-26, sin commit identificable).

### 2.3 Filtros y navegación
**Esperado:** filtros por contexto, persona y contenido en tiempo real (sin recargar), solo valores con tareas abiertas, orden alfabético, vacío = todo; nav rápida de dos niveles con contadores que se sincronizan con los filtros y ocultan listas vacías; header sticky; toggle de filtros en móvil con indicador de filtro activo; iconos 📋 contextos / 👤 personas; Ojalá Hoy primero (`Cmt 250705 2301`, `250714 1737/1811`, `250819 1904/2149/2257`).
**Bug recurrente:** personas nuevas no aparecían en el filtro (2025-07-21 -> 2025-08-20); filtros en móvil interceptando clics (z-index); filtros "funcionales" corregidos a las 01:56 del primer día (`Cmt 250706 0156`).

### 2.4 En Progreso
**Esperado** (`Ax 250706 - Concepto General del Centro de mando del día...`): vista de tareas `- [/]`; "Cuando inicio un día, me gusta elegir algunas tareas con las que voy a estar trabajando ese día". Cabecera con contador, Tiempo Estimado (suma de `[Xmin]/[Xh]`), Tiempo Definido y Vencidas; secciones Vencidas / Eventos de Hoy / Prioridades de Hoy; agrupar por Contexto/Persona/Proyecto; ordenar por duración cíclico (3 estados). Agrupación por proyecto (Andrés): "primer proyecto GTD que encuentres... si no, el Área de Interés más profunda... si no, Área de Vida o carpeta"; refinada: PGTD > AI > prefijo estructural > carpeta > "Tareas Generales".
**Reglas:** `[/]` se muestra como checkbox pendiente; clic abre archivo y línea (`Ax 250706 - Concepto General`).
**Backlog:** botón para iniciar registro desde aquí (cerrado 2025-08-19); organización manual "personalizado" guardada en json + botón de orden por prioridad (v0.9, 2025-09-10, marcado `[x]` 2026-08-26 sin commit visible); botón que reparte las tareas en ejecución por día/hora con IA Gemini (v0.9, 2025-08-17, sin commit).
**Regresión:** agrupación/ordenación de En Progreso rota por el Time Tracker (`Cmt 250706 2209`).

### 2.5 Time Tracker
**Esperado** (`Ax 250706 - Estructuración del nuevo sistema de registro tiempo`, palabras de Andrés): registrar en tiempo real o manual con hora inicio/fin y notas; "Cada tarea puede desarrollarse en una o mas sesiones, lo unico importante para poder iniciar o registrar un intervalo de tiempo de la tarea es que esta este abierta"; el tiempo se suma a cada elemento de la ruta ("Lo importante es que se suma tiempo en los elementos que hacen parte del sistema de gestion como RR, PGTD, etc"). Fuentes de tarea: notas abiertas, en ejecución, o todas; se registra siempre la ruta de la nota y, si viene de una tarea, su texto como valor inicial de las notas. Persistencia en la carpeta del plugin.
**Reglas posteriores:**
- Todo en `data.json` vía `loadData/saveData` (`Cmt 250709 2152`).
- Iniciar con texto seleccionado: una sola línea `- [ ]`/`- [/]` -> descripción; multilínea o no-tarea -> avisos (`Ax 250819 - Mejora del comando...`, `Cmt 250819 1649`).
- Modal de cierre: checkbox 'Cerrar la tarea' marcado por defecto; `- [/]` o `- [ ]` -> `- [x] ... ✅ YYYY-MM-DD`; no duplicar fecha; solo se muestra cuando `taskDescription` != nombre del archivo (`Ax 250821 - Prompt para el cierre...`, `Cmt 250821 1422`).
- Botón 'Cancelar registro' (`Cmt 250913 1550`); modificar temporizador activo = solo hora de inicio y notas (`Cmt 250814 1339`).
- Comando 'Control de Tiempo: Iniciar temporizador para la nota activa' (ribbon `play`), indicador en barra de estado cuyo clic abre el Time Tracker (`Cmt 250707 0016`).
- Buscador de tareas por texto + cx + px + tags GTD (`Cmt 250714 1758`).
**Bugs recurrentes:** modal de detener que no abre (`Ax 250709 - Resolviendo de nuevo...`, "Bug: cuando se cierra el modal... para volver a abrirlo requiero cerrar y abrir Obsidian de nuevo" `PGTD - Dovela v0.2` 2025-07-15, `Cmt 250715 2229`); botón de cierre/checkbox no funcionaban visualmente (v0.9, 2025-08-21; `Cmt 250821 1422`); selector de tareas vacío (`Cmt 250707 0016`); botón '+ Registrar Tiempo' sin selector tras `250814 1339`; carrera al detener (`Cmt 250708 1511`); filtro Estadísticas se reseteaba.
**Deuda declarada:** `exactOptionalPropertyTypes` desactivado; código del Time Tracker vive en `moduloGTDv3`; v0.9 "Validar el color Rojo al empezar a registrar una tarea. Pero no está apareciendo en todos los tipos de sesiones" (2025-09-16, sin commit).

### 2.6 Timeline / Cronograma
**Esperado** (`Ax 250709 - Propuesta de UX - La Vista de "Cronograma"`): "una vista similar a la vista de calendario de outlook"; nombrada Cronograma para no confundir con eventos futuros; vistas 1/3/7 días, botón Hoy, calendario emergente (mapa de calor), color por carpeta raíz, clic edita, arrastrar mueve, borde redimensiona, arrastrar vacío crea, Alt+arrastre copia, zoom 1x-4x, tooltip con duración, eventos multi-día segmentados.
**Bugs:** recarga al cambiar de pestaña; bloque duplicado no se actualizaba; clic abría modal incorrecto tras `250814 1339`.
**Backlog:** v0.9 "Hacer una vista en la que me muestre todas las sesiones de tiempo de una carpeta en particular, pero organizadas a lo largo del tiempo, y que me muestre la estructura de carpetas como algo secundario" (2025-08-16; cerrada sin commit específico).

### 2.7 Estadísticas
**Esperado:** árbol jerárquico expandible con duración, porcentaje con barra, píldora de registros, total del período, filtros Hoy/Semana/Mes/Año/Siempre/personalizado -> luego barra unificada con `DatePickerModal` y navegación Anterior/Siguiente; vista por defecto "Hoy" (`PGTD - Dovela v0.2` 2025-07-09); tras registrar manual debe quedar en "Hoy"; registros editables; carpetas atenuadas si son de tránsito; salto inteligente; color por tipo de carpeta (Raíz, Área de Vida, Área de Interés, Proyectos).
**Bugs:** vista vacía por fuente obsoleta (`Cmt 250709 2152`); filtro reseteaba (`Cmt 250715 2229`); lista no renderizaba (`Cmt 250814 2025`).

### 2.8 Export Excel
`Cmt 250815 0105`: clic derecho en cualquier nodo -> "Exportar a Excel"; incluye todos los descendientes (tarea, proyecto o todas las áreas); columnas Ruta Completa, Tarea, Descripción, Fecha, Día de la Semana, Hora Inicio/Fin, Duración (min y hh:mm), Notas; nombre = nodo + rango del filtro; generación en memoria (EROFS). Tarea origen: "Exportar Sesiones en Excel" (`PGTD - Dovela v0.2`, 2025-08-14). Nota (inferencia): el `main.js` minificado de ~1.6MB (`PGTD 260706`) probablemente incluye `xlsx`.

### 2.9 Smart Inbox
**Intención** (`Ax 250708 - Plan de implementación... v3.0`): "La clave es la inmediatez"; capturar sin fricción, sintaxis `@proyecto`, `#cx-`/`#px-`/`#GTD-...`, `!fecha`; destino automático: sin proyecto -> `00 - Inbox/Bandeja de entrada.md` con `#inbox`; con proyecto -> sección `## Tareas`. Viene de v2 (`Ax 250708 - Como funcionaba el comando...`): modal con checkbox 'guardar en nota actual'.
**Reglas:** formato de tarea consistente `[tags] [fecha_creación][fecha_vencimiento]`; `!date` en inglés (today, tomorrow, monday) según `Cmt 250708 1845`; `@` captura todo hasta `#` o `!`; solo proyectos/áreas con estado 🟢; la nota activa siempre primera, sin separador (`Cmt 250913 1748`, tarea v0.9 2025-09-13); sugerencias disponibles al arrancar (`onLayoutReady`).
**Bugs:** CSS roto y ~500 líneas borradas (`Ax 250709 - Recuperación...`); proyectos con punto/tilde; autocompletado vacío antes de guardar la primera tarea; PGTD/AV/AI activo no salía primero.
**Backlog sobre Smart Inbox (v0.9):** mostrar el texto de la tarea en el popup, indicar cómo escribir la fecha, aceptar `YYMMDD`, facilitar cx y px (cerrado 2025-08-21: sólo hay evidencia de menús cascada, no de formato fecha); permitir fecha de entrega vía campo `w`  (2025-10-25, sin commit); "agregar esa tarea a la nota que está activa... en la posición en la que está el cursor o en la primera línea de la nota o en la sección de tareas" (2025-08-30; solo la priorización en `@` está documentada); "Crear un comando que me permita gestionar todas las tareas que estén en la bandeja de entrada y que me permita mover las notas y cambiarles los tags" (2025-07-16; sin commit; también previsto como "Procesar Siguiente Tarea del Inbox" en `Ax 250708 - Plan...`).

### 2.10 Menús en cascada
`Ax 250821 - Prompt para mejorar Smart Inbox` + `Cmt 250821 0935`: al escribir `#` aparece menú principal (cx-, px-, gtd-); al elegir uno, menú secundario con valores existentes (contextos y personas de tareas previas; estados GTD predefinidos `EstaSemanaNo`, `AlgunDia`); filtrado incremental; teclado (↑↓ Enter Esc) y ratón; "Conservar funcionalidad actual: el usuario debe poder seguir escribiendo manualmente"; múltiples tags en la misma tarea; menú `@` unificado. Arquitectura `CascadeMenuTypes/Manager/Renderer/SuggestionProvider`. Deuda: ninguna declarada; riesgo: el estado `🟢` del frontmatter define qué sale en `@`.

### 2.11 Fechas Start y dependencias
**Reglas** (`Cmt 250820 2200`, `250820 2317`; v0.9):
- Orden obligatorio Start <= Schedule <= Due; incoherente -> Inbox "(fuerza corrección)".
- Start futura -> Pausadas; Start vencida -> Próximas (incluso sin contexto).
- v0.9: "Si una tarea tiene fecha de start y fecha de schedule o due date, que no aparezca en las proximas sino hasta que llege el start, y que cuando sea el due o schedules, aparezca en la lista ojala hoy. De ahi en adelante, que aparezca vencida. Que aparezca en proximas acciones tambien".
- Colores: 🔴 Schedule/Due vencida; 🟢 cualquier fecha = hoy; 🔵 Start futuro; 🟠 dependencia activa; 🔴 dependencia vencida.
- Dependiente: siempre en 'En Pausa'; si hay fecha hoy, también 'Ojalá Hoy'; si vencida, también 'Vencidas'. v0.9: "Cuando una tarea esta en pausa porque tiene dependencia de otra, no aparece en los listados de contexto hasta que la dependencia se haya cumplido. Solo aparece en los listados de Ojala hoy o vencidas si tienen fecha due o Scheduled."
- `⛔ ID` se convierte en `⛔ ID 🔗` que navega y valida existencia.
- Orden interno de contextos/asignadas (v0.9, 2025-08-30): vencidas, alta importancia, normales, por último pausadas por tarea previa.
**Bugs:** duplicación en Vencidas; Start vencida + Due hoy.
**Deuda:** doble implementación gtd/foco (sección 2.12); en Journal/Weekly la regla de dependencias se pidió corregir el 2025-10-27 ("Arreglar el journey semanal para que las tareas que tienen tarea dependiente que aun esta abierta, se muestren en tareas suspendidas").

### 2.12 Vista de Foco
**Esperado** (`Ax 250710 - Analisis de UX y Propuesta de la solución`): misma UI que Listas GTD/Jerarquía pero acotada: nota activa + notas de la misma carpeta y subcarpetas + notas enlazadas (2 niveles); tooltip "Incluido por enlace desde: ..."; ahora bidireccional (`Cmt 250912 1342`): salientes (def. 2), entrantes (def. 5), carpeta de terminación configurable (def. `AI - Journals`), notas de terminación opcionales; las agregadas por salientes solo expanden salientes, y viceversa; las notas de terminación no son objetivo de búsqueda entrante; iconos ➡️/⬅️; título colapsable (persistido) para móvil.
**Regla de oro (Andrés):** "No quiero que este desarrollo afecte las funciones que ya existen por lo que prefiero que se tomen las funciones que ya existen y se copien en una nueva estructura".
**Bugs:** Bandeja de entrada de Foco mostraba todas las tareas de la bóveda (2025-07-30 -> 2025-08-20); toggle de Vencidas se revertía (`Cmt 250830 1337`); "Solucionar problema de renderizado de vista de foco cuando lo estoy abriendo desde el móvil" (2025-08-20); Pomodoro + overdue: "dos sesiones de tiempo... y el temporizador no funciona en la vista de foco" (2025-09-13); sincronización con GTD (`Cmt 250916 1740`).
**Deuda declarada:** cada commit dice "replicado/sincronizado" entre `moduloGTDv3` y `moduloFoco` (focoProcessor/focoHtmlGenerator/focoView): lógica duplicada que hay que mantener en paralelo; ajustes `localStorage` (no `data.json`).

### 2.13 Backlinks
**Intención** (`Cmt 250910 2100`): "alternativa nativa y más eficiente a los bloques DataViewJS"; sidebar; detecta backlinks y archivos de la misma carpeta; orden por archivo, tipo, estado, ruta, creación, modificación; breadcrumb completo/inteligente/compacto; tres puntos de acceso (paleta, menú contextual, ribbon). v0.9 (2025-09-10): si es de tipo transacción, mostrar monto y moneda; fechas ordenables asc/desc; fechas de creación y modificación; listado con ubicación jerárquica; "vista que muestre las notas abiertas con los títulos completos a mano derecha" con estado de la nota; vista simple/detalle. `Cmt 250917 0544`: árbol (doble clic en 'Ordenar por ruta' = modo expandido, 📍 nota actual), pestañas 🗂️ agrupadas por splits, Cmd+clic nueva pestaña.
**Bug crítico:** recursión mutua `createBreadcrumb -> createCompactBreadcrumb -> createPathBreadcrumbs -> createBreadcrumb` ("Maximum call stack size exceeded", "Reiniciando bóveda") hasta el 2026-07-06 (`Cmt 260706 1621`, `Btx 260706 - Sesión 01`). Había estado latente desde sep-2025 (inferencia por fechas).
**Deudas:** `backlinkSettings.ts` usa `localStorage` mientras la regla del proyecto es `data.json` (inferencia); CSS en archivo propio integrado a `styles.css` (`Cmt 250910 2344`).

### 2.14 Pomodoro
**Esperado** (`Cmt 250913 1717`, `1816`, `250916 1740`; `PGTD 250918 - Modulo de Pomodoro v1.0`): duraciones desde 1 min (trabajo 1-60, descansos 1-15/30), descansos cortos/largos, ciclos y estadísticas; modo overtime ("Seguir trabajando en el mismo ciclo") con contador rojo y alertas cada 1-15 min configurables; registro final incluye overtime; modal de inicio que muestra sobre qué (nota/tarea) se va a trabajar; barra de estado; recuperación al recargar; notificaciones con sonido/vibración.
**Reglas de tarea** (v0.9 2025-09-13, texto de Andrés): "Al cerrar una sesión de Pomodoro... si el pomodoro es sobre una tarea directamente, la pregunta de si se cierra la tarea... de igual forma que se hace cuando se está haciendo en la lógica de registrar tiempo. De igual forma, si se empieza a realizar un pomodoro sobre una tarea que está solamente abierta '- [ ]', sin estar en estado de en desarrollo '- [/]', entonces que ponga la tarea en desarrollo. Quiero que revises como esta funcionando esas reglas en el comando de iniciar registro tiempo... Ojo, no vayas a dañar nada de lo que ya este funcionando."
**Reglas de sesión** (PGTD Pomodoro): mostrar número de pomodoro del día y ronda ("1 de 4?"); "Hacer Sesiones, es decir si entre un pomodoro y otro en iniciar se gasto menos de 30 minutos, sigue siendo la misma sesión grande"; el mensaje de inicio debe indicar nº de pomodoro y ciclos del día; el cierre de un descanso debe llevar notas; notas automáticas "Sesión Pomodoro + Overtime (45 min total) - Ciclos: 2\n\n[notas usuario]".
**Bugs:** botón 'Iniciar pausa' no funcionaba; 'iniciar otro Pomodoro' tras descanso no funcionaba; "Las estadísticas están mal, el tiempo de hoy es el total"; registro duplicado en overtime; loop infinito en modal de finalización; temporizador no funciona en Foco.
**Backlog:** botón de Pomodoro en menú izquierdo + icono móvil (`timer`); modificar el detalle del Pomodoro al iniciar (v0.9 2025-09-15).

### 2.15 Journal (nota diaria)
**Esperado** (Andrés, `Ax 251024 - Funcion para ser invocada por Bloque Dataviewjs desde nota diaria`): "desde cada nota de día poder ver las tareas vencidas, las que vencen ese día, ordenadas por prioridad.. las de vista calendario... Tambien deseo poder ver las tareas que estan 'en Progreso'... La información del tiempo que requiero para finalizar las tareas también es importante para mi... poder ver la cantidad de tareas que se han cerrado cada día, e incluso poder hacer una consulta en la que se muestren las tareas que se cerraron ese día".
**Reglas:** grupos Calendario del Día (`[hI::]`), Programadas para hoy (due -> scheduled -> start, luego prioridad), Tareas para esta semana (`[w::]`), semanas anteriores en rojo, En Progreso, Vencidas a hoy (fecha -> tipo -> prioridad; límite configurable; colapsable), Bloqueadas por dependencias (hoy o vencidas; enlace 🔗; rojo si vencida), Completadas hoy (colapsable). Prioridades 🔺⏫🔼🔽⏬. Semanas ISO `YYYY-W##` (1 o 2 dígitos); formato `[w::[[2025-W43]]]` o con ruta; `w`/`W`. Estructura de carpetas configurable (`Año/Trimestre/Mes/Semana`, nombre `YYYY-MM-DD EEEE`). Debe "sacar ventaja de lo que ya tenemos desarrollado, pero sin que se vea afectado nada de lo que ya existe".
**Mecanismo:** API `journalAPI.renderTasksForDate()` para bloque DataviewJS; `Ax 251024 - Incluir a la vista diaria...`: la nota semanal es una por semana en `AI - Journals/YYYY/Qq`.
**Deuda declarada ("Desarrollo Futuro"):** integración completa con `TaskStateManager` para marcar tareas completadas; filtros por contexto/proyecto/etiquetas; vista multi-día; estadísticas; notificaciones. Estados: PGTD diaria `🔵`.
**Riesgo (inferencia):** `Btx 260706 - Sesión 01` "Se deshabilitó DataviewJS con mejora inmediata" y quedan "~13 notas Dataview restantes" por migrar a Bases/Datacore, "fuera de este proyecto", pero la entrada de Journal/Weekly en las notas es DataviewJS (`Ax 251024 - Documentación... "Tareas no aparecen: ... indexados por Dataview"`). Sin alternativa documentada.

### 2.16 Weekly (nota semanal)
**Esperado** (v0.9 2025-08-31): "Que sobre la nota semanal se pueda correr un comando que me muestre todas las tareas que están programadas para esa semana, por día o por campo semana". `Cmt 251025 0919`: `W::[[YYYY-Www]]`, agrupación Lunes-Domingo con día actual destacado, vencidas por semana (año -> semana W5, W27, W43 -> prioridad) y por fecha, diarias por tipo (due -> scheduled -> start) -> prioridad, completadas por fecha de ejecución cronológica, API DataviewJS, 50+ tareas renderizadas en pruebas.
**Deuda declarada ("Desarrollo Futuro" `Ax 251025 - Documentación del modulo weekly v1.1`):** integración con `TaskStateManager`, filtros avanzados, vista multi-semana ("planificación mensual"), estadísticas semanales, notificaciones. Bug previo: ordenamiento de semanas de 1 dígito (W5 antes de W27).
**Sin resolver:** dependencias abiertas deben ir a "suspendidas" en weekly y diario (v0.9, 2025-10-27, sin commit posterior); comentario inicial en `weeklyTaskRenderer.ts` con non-null assertions (se tuvo que parchar el 2026-07-06).

### 2.17 Sincronización del temporizador
`Cmt 250714 2006`: polling cada 15 s a `data.json` para reflejar inicio/parada entre dispositivos; `initializeTimerFromState`/`clearActiveTimer` únicos; listener en `onload`/`onunload`; `refreshAllTimerViews` en GTD y Foco. Reemplaza "sesiones interrumpidas".
**Contexto agravante** (`Btx 260706 - Sesión 01`): la bóveda tiene "doble sincronización (Google Drive streaming + Obsidian Sync)" y 3 indexadores (Dataview + Datacore + Bases).

### 2.18 Panel de actividad
`Cmt 250714 2113`; origen: "Quiero contar con alguna información como la cantidad de notas creadas cada día, las notas que se modificaron, la cantidad de tareas cerradas por día..." (`PGTD - Dovela v0.2`, 2025-07-14). Métricas: tareas capturadas vs completadas, notas nuevas vs modificadas; períodos Hoy/Ayer/Semana/Mes/personalizado; drill-down; `AnalyzerService`. Robustez: fechas de captura/cierre ausentes (`Cmt 250715 2132`).

### 2.19 Panel de revisión de estancados
`Cmt 250715 0733`: proyecto con estado `🟢` sin tareas `- [ ]` en su jerarquía (misma carpeta, subcarpetas y hasta 2 niveles de enlaces salientes) = estancado; acciones: añadir tarea, archivar (🔵), abrir carpeta; mensaje de felicitación si no hay. Origen: "Comando para buscar proyectos GTD que no tengan tareas en su estructura descendente" (✅ 2025-07-16). Plantilla del dashboard de proyecto (Datacore): "⚠️ Sin tareas abiertas ... definir si se cierra o necesita nuevas acciones" (`PGTD - Dovela v0.9`).
**Pendiente (v0.9):** botón para actualizar el panel (2025-08-30); contar proyectos GTD de 1.er, 2.º y 3.er nivel: abiertos, archivados, sin modificar y hace cuánto, integrándolo al comando existente (2025-08-30). Mejoró compatibilidad móvil (`Cmt 250830 1247`).
**Hueco (inferencia):** busca solo `- [ ]`, así que un proyecto con solo `- [/]` aparecería estancado.

### 2.20 Móvil
**Esperado:** que el GTD Dashboard y Foco funcionen y se vean bien en móvil: filtros colapsables con indicador, fuente >=16px (iOS), áreas táctiles >=36-44px, header de Foco colapsable, datalist con scroll, ribbon icons `play-circle` (temporizador) y `timer` (Pomodoro), botón de cierre del modal táctil, Panel de revisión compatible.
**Bugs recurrentes:** conflicto z-index que dejaba tocables inputs ocultos (`Cmt 250820 0944`); renderizado de Foco (2025-08-20); búsqueda de Proyectos sin tareas (2025-08-21 -> 2025-08-30); modal de cierre (`Cmt 250821 1422`).
**Declarado:** `PGTD - Mejora del look n feel de gtd dashboard para moviles` está vacío y su tarea `[-] Desarrollar mejoras para la vista desde el móvil` está cancelada en `PGTD - Dovela v0.2`.

---

## 3. Backlog heredado y pendientes

### 3.1 Estado declarado por Andrés (julio 2026)
- `PGTD 260706 - Dovela v1.0 - Retoma y estabilización del plugin` (🟢): repositorio consolidado el 2026-07-06 (`main` con 84 commits, `1.0.0`, rama `feat/journal...` fusionada por fast-forward, push a GitHub, stash de `feature/smart-inbox` "UI: Mejoras visuales en Time Tracker" **descartado** por antiguo). Entorno: repo activo en `~/Proyectos/obsidian-dovela-personal-management/` (HEAD `2887407`); no editar la copia de Google Drive; flujo `pnpm dev` -> vault de prueba, `pnpm build` -> copiar `main.js` a la bóveda real. `Cmt` registrado hasta 2025-10-25 + el de 2026-07-06.
- Única tarea abierta: "Auditar las 40 tareas abiertas de PGTD - Dovela v0.9 con /obsidian-dovela-gtd-auditor y migrar a este proyecto las que sigan vigentes".
- `Btx 260706 - Sesión 02`: "Próximo paso: `/obsidian-dovela-gtd-auditor auditar-proyecto PGTD - Dovela v0.9` para clasificar el backlog heredado".
- `PGTD - Sistema de Gestion Personal DOVELA`: referencias a `Ax 251109 - Evolución natural de Dovela Core a Dovela Systems for Teams en el marco de Crezco360` y `PGTD 251110 - Prompts para analisis con IA...`; tarea `[-] Investigar cuál es la forma por estándar, en la que podría desarrollar funcionalidades del plugin por las que pueda cobrar` (cancelada). Contexto de licencia: GPL-3.0 + licencia comercial, tabla CE vs Pro (`PGTD - Creación del repositorio... v0.1`).

### 3.2 Backlog v0.9: lo que NO tiene evidencia en commits (aunque conste `[x]`)
Marcadas `[x]` el 2026-08-26 sin commit correspondiente en las notas Cmt (hasta 2025-10-25), a validar con el auditor:
1. "Creación de Campañas y de Entregables" y, cancelada, "[-] Desarrollo de complemento de campañas y entregables con moneda HITS. Usar lo que ya venía de antes" (⏳ 2025-10-28).
2. "Crear un comando que me permita gestionar todas las tareas que estén en la bandeja de entrada y ... mover las notas y cambiarles los tags".
3. "Crear la funcionalidad con la que creo el plan anual y trimestral de tareas para la nueva versión del plugin".
4. "Establecer cómo puedo, desde la instalación del plugin, llevar las plantillas para que se copien en la carpeta establecida".
5. Botón en En Progreso que pregunte día/hora/almuerzo, agrupe >20 min por estructura con IA (Gemini) y <20 min por contexto (30 min por defecto) y escriba en la hoja del día "verificando primero que la hoja del día exista o si no creándola con el Template".
6. Vista/ comando de registros de tiempo de la nota y sus hijas (✅ 2025-08-21: puede estar cubierto por Estadísticas, no explícito).
7. "Hacer una búsqueda tipo calendario que muestre algo, así como la lista de ojalá hoy, pero del día seleccionado" (probablemente cubierta por Journal; no hay un commit de 'día seleccionado').
8. Scripts: renombrar archivo con el primer carácter según el campo `estado` (2025-09-09); carpetas de PGTD/AI/AV que cambian de nombre automáticamente si la nota padre cambia, con posible campo `raíz` (2025-09-10) (inferencia: pertenecen a plantillas/scripts del vault).
9. En Progreso: orden manual con botón 'personalizado' guardado en JSON y botón de orden por prioridad (2025-09-10).
10. Smart Inbox: aceptar fecha `YYMMDD` y mostrar ayuda de fecha; insertar en nota activa en el cursor; fecha de entrega vía `w` (2025-10-25).
11. Tareas dependientes abiertas -> "suspendidas" en weekly/diario (2025-10-27).
12. Contar PGTD por nivel (abiertos/archivados/sin modificar) y botón de refrescar el Panel de Revisión.
13. Color rojo al empezar a registrar en todos los tipos de sesión; "Organizar las tareas Asignadas por fecha due o scheduled"; "En Ojalá hoy, si una tarea tiene cx- y px- se muestra en px- pero no en cx-: validar" (2025-08-29; relacionado con `Cmt 250830 1337` pero no idéntico).
14. Sub-tarea "Programar el uso de las semanas en el sistema GTD" (tag PlaneaciónSemana, campo semana, mostrar tareas en su semana, planeación semanal): resuelta parcialmente por Journal/Weekly (`[w::]`); el tag `PlaneaciónSemana` y la "planeación semanal" activa no aparecen en commits.
15. "Organizar la forma de mover las tareas que voy a ejecutar el día de hoy, y las que estén en ejecución. Tiempos, ingresar datos de cuánto duran" (2025-09-19) y "Que desde la hoja del día, me permita abrir una hoja sobre cómo se vería ese día el GTD Dashboard, o el Vista de Foco" (2025-09-19): parcialmente Journal.

### 3.3 Lo que Andrés quería mejorar (palabras suyas)
- **Smart Inbox:** "Mejorar el Smart Inbox mostrando el texto de la tarea que se mostró en el pop up, indicando cómo debo poner la fecha y aceptando que se ponga la fecha en formato YYMMDD, pensar cómo puedo facilitar el cx y px" (`PGTD - Dovela v0.9`, 2025-08-16). Mejora "Agregar... la posibilidad de que la fecha de entrega sea vía el campo de w" (2025-10-25). Visión original: Nivel 1 captura simple (`Cmd+J`, barra no modal, "casi nula" fricción) y Nivel 2 asistida (`Ax 250708`); futuro "Procesar Siguiente Tarea del Inbox".
- **Time Tracker:** modificar hora de inicio de sesión (hecho 2025-08-14); ver todas las sesiones de un día en modo texto ordenadas por hora (hecho 2025-08-15); "Ver la parrilla más grande" (zoom, hecho); cierre de tarea al parar (hecho); vista por carpeta a lo largo del tiempo (pendiente de verificar); color rojo en inicio de registro (pendiente de verificar); `exactOptionalPropertyTypes` desactivado.
- **Revisión en nota diaria/semanal:** estados `🔵` de ambos PGTD (diaria y semanal) pero ambos con "Desarrollo Futuro" abierto (TaskStateManager, filtros, multi-día/semana, estadísticas, notificaciones). Dependientes abiertas deben ir a "suspendidas" (2025-10-27). Andrés quiere poder "abrir una hoja ... cómo se vería ese día el GTD Dashboard, o la Vista de Foco" desde la nota del día (2025-09-19).
- **Otros:** "Desarrollar función que permita que se mueva de derecha a izquierda el path del archivo que está abierto" (`[-]` cancelada, `PGTD - Dovela v0.2`); `Pomodoro` PGTD cerrado (`🔵`) con todas las pruebas del "Test de botones" marcadas `[x]`.

### 3.4 Deudas técnicas declaradas / observables
- `exactOptionalPropertyTypes` desactivado (`Cmt 250714 1654`).
- Duplicación `moduloGTDv3` <-> `moduloFoco` por decisión de diseño (2.12).
- Settings de Backlinks y Foco en `localStorage` (`Cmt 250910 2100`, `250912 1342`) frente a regla `data.json` + `savePluginData()` (`CLAUDE.md` del repo).
- El código de Time Tracker, Pomodoro, Smart Inbox y menús vive en `moduloGTDv3` (`Ax 250814 - Anotaciones`: "los archivos relacionados con la lógica del control de tiempo... se encuentran dentro de src/modules/moduloGTDv3/").
- Journal/Weekly acoplados a DataviewJS (2.15).
- Falta de tests automáticos: pruebas con archivos de tareas manuales (`Ax 250705 - Tareas para probar...`), ATPs en notas.
- Sin tags/releases desde 0.2.1 hasta el `1.0.0` de 2026-07-06.
- Regresiones recurrentes al generar código con IA ("se borraron partes del código que ya funcionaba muy bien", `Ax 250709 - Recuperación...`): mitigación acordada -> "adición quirúrgica", duplicar en vez de refactorizar, "cero regresiones".
- Importaciones con `.js`, `override` (`Cmt 250715 2132`).
- CSS: todo en `styles.css` raíz (`Cmt 250709 1159`, y el ítem v0.2 "Corregir el problema de la ubicación del archivo styles, no debería ser dentro de src").

---

## 4. Frases textuales que no deben perderse (con fuente)

**Listas GTD y reglas**
- "REQUISITO OBLIGATORIO: Deben incluir AMBOS elementos: 1. Símbolo 📅 seguido de la fecha (YYYY-MM-DD) 2. Campo de hora de inicio [hI:: hora]" - `Ax 250703 - Reglas y Estructura de las listas de tareas GTD de Dovela v1.0`.
- "Aunque la persona (#px-) esté presente, si hay contexto (#cx-), se sitúa aquí y no en Asignadas" - ídem (Próximas Acciones).
- "Si se especifican ambos (hora final y duración) y hay discrepancia, la tarea debe ir a Inbox para revisión" - ídem.
- "Las tareas de fechas de actual ó pasadas sin contexto ó asignación se muestran en este listado según corresponda, pero también se muestran en Inbox" - ídem (Ojalá Hoy).
- "Cuando termina el plazo de la tarea y esta tiene dependientes, el sistema debe alertar para decidir manualmente qué hacer" - ídem (Asignadas).
- "Al revisar esta lista, se debe definir la siguiente acción concreta" - ídem (Proyectos).
- "Aquí solo deberían aparecer las tareas que tienen fecha futura con el símbolo 🛫, no con ningun otro símbolo como ⏳/📅." - `Ax 250705 - Problemas en las tareas creadas y su ubicación en las listas GTD`.
- "Aparecieron las tareas HT 01 y 02, pero es un error, porque hoy es 5 de Julio. Es muy probable que estés usando fechas en GMT 0, Arreglalo." - `Ax 250705 - Hallazgos en la segunda prueba de tareas en las listas GTD`.
- "Una tarea que tiene px- pero no tiene cx- no debería aparecer en próximas acciones Sin Contexto, solamente debería aparecer en Asignadas." - `PGTD - Dovela v0.9`.
- "El contador de total de tareas abiertas, no debería incluir las tareas que se están mostrando duplicadas" - `PGTD - Dovela v0.9`.
- "Organizar las tareas dentro de los contextos de próximas acciones, y dentro de las asignadas, para que primero muestre las vencidas, muestre las de alta importancia, luego las normales, y por último, las que están pausadas por una tarea previa." - `PGTD - Dovela v0.9` (2025-08-30).
- "En las listas de tareas GTD, cuando una tarea está asignada o cuando tiene un contexto y tiene fecha y esta está vencida o es para hoy, entonces la tarea debería seguir apareciendo en el listado de Asignadas o Delegadas, además de la lista a la que pertenece, pero aparecerá con color en texto, por ejemplo Rojo si está vencida y anaranjado si es para hoy." - `PGTD - Dovela v0.2` (2025-08-15; cerrada 2025-08-19). Nota: choca con la regla 'px sin cx solo en Asignadas' de `Cmt 250830 1337`; la regla vigente posterior es la de `250830`.

**Time Tracker / cierre de tarea**
- "Cada tarea puede desarrollarse en una o mas sesiones, lo unico importante para poder iniciar o registrar un intervalo de tiempo de la tarea es que esta este abierta, para poder elegirla." - `Ax 250706 - Estructuración del nuevo sistema de registro tiempo`.
- "Lo importante es que se suma tiempo en los elementos que hacen parte del sistema de gestion como RR, PGTD, etc" - ídem.
- "Quiero que tengas presente que la solución no debe alterar para nada el funcionamiento de los demas botones y vistas que hay en las vistas del comando open GTD dashboard." - ídem.
- "Checkbox seleccionado por defecto: ☑️ Cerrar la tarea" / "Cuando está deseleccionada: Solo guarda el registro de tiempo. NO modifica el estado de la tarea" / "Agrega la fecha de cierre al final de la tarea" (`✅ YYYY-MM-DD`) - `Ax 250821 - Prompt para el cierre de tareas con el cierre de registro de tiempo`.
- "Registro de tiempo de proyecto (taskDescription = nombre archivo) -> Sin checkbox; tarea específica -> Mostrar checkbox" - `Cmt 250821 1422`.
- Intención de iniciar con selección: "Mejorar la precisión del seguimiento cuando el usuario selecciona explícitamente una tarea" - `Cmt 250819 1649`; mensajes: "Verifica la tarea que has seleccionado para hacer seguimiento de tiempo." / "La selección en la nota no es una tarea. Borra la selección o verifica la tarea." - `Ax 250819 - Mejora del comando de inicio de registro de tiempo`.
- "Ojo: no deseo que alteres las estructuras de datos que ya existen ni que afectes los algoritmos que pueden estar interactuando con este comando." - ídem.

**Smart Inbox / cascada**
- "Conservar funcionalidad actual: El usuario debe poder seguir escribiendo manualmente si prefiere" - `Ax 250821 - Prompt para mejorar Smart Inbox`.
- "Objetivo: Reducir significativamente el tiempo y esfuerzo requerido para etiquetar tareas" - ídem.
- "Activación Instantánea... La clave es la inmediatez" - `Ax 250708 - Plan de implementación del nuevo comando de Bandeja de Entrada v3.0`.
- "Dentro del flujo de GTD, el ingreso de tareas a la bandeja de entrada sin tener mayor fricción para el usuario, para después poder procesarlas es fundamental." - `PGTD - Ingreso de tareas a la bandeja de entrada`.
- "Nota activa SIEMPRE aparece como primera opción al usar '@'" - `Cmt 250913 1748`.
- "Mejorar el Smart Inbox mostrando el texto de la tarea que se mostró en el pop up, indicando cómo debo poner la fecha y aceptando que se ponga la fecha en formato YYMMDD, pensar cómo puedo facilitar el cx y px.." - `PGTD - Dovela v0.9`.

**Fechas Start / dependencias**
- "Si una tarea tiene fecha de start y fecha de schedule o due date, que no aparezca en las próximas sino hasta que llegue el start, y que cuando sea el due o schedules, aparezca en la lista ojalá hoy. De ahí en adelante, que aparezca vencida." - `PGTD - Dovela v0.9`.
- "Fechas inválidas van automáticamente a Bandeja de Entrada" (`Start ≤ Schedule ≤ Due`) - `Cmt 250820 2200`.
- "cuando una tarea tiene un depends que no está cerrado, pero también tiene fecha de scheduled o de due hoy, que aparezca en el listado ojalá hoy, pero con el icono de que aún depende de otra tarea." - `PGTD - Dovela v0.9`.

**Foco / jerarquía**
- "No quiero que este desarrollo afecte las funciones que ya existen por lo que prefiero que se tomen las funciones que ya existen y se copien en una nueva estructura, ajustándolas al requerimiento." - `Ax 250710 - Analisis de UX y Propuesta de la solución`.
- "El desafío más grande es que el usuario entienda por qué ciertas notas (y sus tareas) aparecen en la vista" -> tooltip "Incluido por enlace desde" - ídem.
- Jerarquía de proyecto para agrupar: "Buscar Proyecto GTD (PGTD) > Área de Interés (AI) más profunda > prefijo AV/RR/PQ > carpeta padre > 'Tareas Generales'" - `Ax 250706 - Concepto y definición del escenario para el desarrollo de botones...`.

**Pomodoro**
- "Quiero que revises como está funcionando esas reglas en el comando de iniciar registro tiempo para tareas, y que utilices esas mismas reglas... Ojo, no vayas a dañar nada de lo que ya esté funcionando." - `PGTD - Dovela v0.9` (2025-09-13).
- "Hacer Sesiones, es decir si entre un pomodoro y otro en iniciar se gastó menos de 30 minutos, sigue siendo la misma sesión grande." - `PGTD 250918 - Modulo de Pomodoro v1.0`.
- "Las estadísticas están mal, el tiempo de hoy es el total." - ídem.

**Journal / Weekly**
- "Muestra también las tareas que sigan abiertas y que pertenezcan a semanas anteriores, en rojo." - `Ax 251024 - Incluir a la vista diaria las tareas que estan abiertas y estan apuntando a la semana en la que esta ese dia`.
- "la nota '2025-W5' hace referencia a la semana que incluye desde el Lunes 27 de Enero de 2025 hasta el Domingo 2 de Febrero de 2025" - ídem (semanas ISO, lunes-domingo).
- "Que sobre la nota semanal se pueda correr un comando que me muestre todas las tareas que están programadas para esa semana, por día o por campo semana" - `PGTD - Dovela v0.9` (2025-08-31).
- "Arreglar el journey semanal para que las tareas que tienen tarea dependiente que aún esta abierta, se muestren en tareas suspendidas, y no en las que ya se pueden ejecutar. Esto aplica para las de weekly y las de diario" - `PGTD - Dovela v0.9` (2025-10-27).
- "Solo para confirmar las tareas bloqueadas por Dependencia que se muestran, se muestran porque tienen fecha de ese día o porque ya están vencidas y tienen fecha due o scheduled de antes de esa fecha. De acuerdo?" - `Ax 251024 - Funcion para ser invocada por Bloque Dataviewjs desde nota diaria` (la respuesta: "CONFIRMO").

**Retoma / estado**
- "Auditar las 40 tareas abiertas de PGTD - Dovela v0.9 con /obsidian-dovela-gtd-auditor y migrar a este proyecto las que sigan vigentes" - `PGTD 260706 - Dovela v1.0 - Retoma y estabilización del plugin`.
- "Conviene no editar en la de Drive para evitar divergencias." / "Convenio establecido: versión semántica simple, `main` = estable." - `PGTD 260706` y `Btx 260706 - Sesión 02`.
- "Se deshabilitó DataviewJS con mejora inmediata. La migración de las ~13 notas Dataview restantes a Bases/Datacore quedó como tema aparte, fuera de este proyecto." - `Btx 260706 - Sesión 01 Dovela v10`.
- "Ojo.. a partir de este commit empecé a implementar los agentes de Claude." - `Cmt 251025 0919`.
- "Este commit fue para almacenar cambios que tenía y que no había guardado desde la última sesión de desarrollo." - `Cmt 251024 1020`.
- "Dovela... Una Dovela es la piedra clave del arco que sostiene toda la estructura. Elemento central que mantiene todo en pie." - `PGTD - Dovela v0.1` (origen del nombre).

**Persistencia / calidad**
- "Tu clase principal DovelaPersonalManagementPlugin debe ser la única responsable de interactuar con el data.json de Obsidian." - `Ax 250709 - Refactorización del archivo de datos timelogs.json a data.json` (patrón `plugin.data` + `savePluginData()`).
- "Cero regresiones en funcionalidad existente" / "100% retrocompatible" - `Cmt 250820 2200`, `Cmt 250820 2317` (criterio de aceptación habitual).
