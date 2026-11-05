# 04 · Matriz de paridad v1 → v2

Estados: **pendiente** · **en curso** · **hecha** (paridad) · **mejorada** (paridad + cambios documentados) · **descartada** (con motivo) · **parcial** (qué falta en la nota).
“Fase” = fase del [plan](03-plan-de-desarrollo.md). “Prueba” = automatizada (A) / manual (M, ver guía 05).

Última actualización: F1 (2026-11-05).

## Núcleo de tareas

| ID | Funcionalidad v1 | Fuente | Fase | Estado v2 | Prueba | Notas |
|---|---|---|---|---|---|---|
| F01 | Parser de línea de tarea (estados ` `,`x`,`X`,`/`; fechas 🛫⏳📅; 🆔/^; hI/hF; duración; `[w::]`; ⛔; #cx/#px; tags GTD; prioridad) | RI-A §2 | F1 | parcial | A | R1–R12; núcleo `core/tasks/parse.ts` + 15 pruebas; integración en índice F2 |
| F02 | Detección de conflictos hora/duración → Inbox | RI-A §2.4 | F1 | parcial | A | núcleo hecho; horas fuera de rango ahora son conflicto |
| F03 | Tipos de nota por frontmatter/prefijo | RI-A §1.2 | F1 | parcial | A | acepta `Wly/Mly/Qly/Yly`; `core/notes/types.ts`; lee cualquier `type` conocido del frontmatter |
| F04 | Exclusión de plantillas y `99 - Adjuntos` | RI-A §1.1 | F2 | pendiente | A | configurable |
| F05 | Jerarquía carpeta↔nota, placeholders `[FALTA]`, conteos, orden | RI-A §5 | F1 | parcial | A | corrige B-H1; `core/notes/hierarchy.ts`, B-H1 corregido; UI en F5 |
| F06 | Clasificación 10 listas GTD + displayStatus | RI-A §4 | F1 | parcial | A | 21 escenarios oro; `core/gtd/classify.ts`; 23 escenarios oro + 11 reglas; B-G1, B-G2, B-P6 corregidos; ciclos → Inbox |
| F07 | Navegación (orden dinámico, ids de ancla, iconos) | RI-A §4.4 | F1 | parcial | A | `navigationItems`, anclas sin acentos |
| F08 | En Progreso: métricas, agrupaciones, orden cíclico | RI-A §4.6 | F1 | parcial | A | `core/gtd/inprogress.ts`; orden total (comparador transitivo) |
| F09 | Marcar en progreso `[ ]→[/]` | RI-A §6.3 | F1/F4 | parcial | A | sin fallback peligroso; `markInProgress` + localización segura |
| F10 | Cerrar tarea `[x] ✅ fecha` | RI-A §6.3 | F1/F4 | parcial | A | ✅ antes de `^bloque`; `markDone`, ✅ antes de `^bloque`, conserva CRLF |
| F11 | Dependencias `⛔ id` con enlace 🔗 navegable | RI-A §4.2 | F1/F5 | pendiente | A+M | ciclos → Inbox |
| F12 | Proyectos estancados (🟢 sin tareas, carpeta+2 niveles de enlaces) | RI-A §6.1 | F7 | pendiente | A+M | cuenta `[/]` como abierta |

## Dashboard GTD (vista `gtd-view`)

| ID | Funcionalidad v1 | Fuente | Fase | Estado v2 | Prueba | Notas |
|---|---|---|---|---|---|---|
| F13 | Comando “Open GTD Dashboard” + ribbon `list-checks` | RI-B §0.1 | F5 | pendiente | M | |
| F14 | Pestañas (Jerárquica, Listas, En Progreso, Seguimiento, Estadísticas, Cronograma) + Refrescar | RI-B §0.2 | F5 | pendiente | M | refresco reactivo |
| F15 | Contador de tareas abiertas (únicas) | RI-B §1.1 | F5 | pendiente | A+M | |
| F16 | Filtros contexto/persona/texto con datalist y contadores filtrados | RI-B §1.3 | F5 | pendiente | A+M | filtra datos, no DOM |
| F17 | Navegación rápida con sublistas y scroll suave | RI-B §1.3 | F5 | pendiente | M | |
| F18 | Toggle Vencidas fecha‑primero / contexto‑primero | RI-B §1.3 | F5 | pendiente | A+M | |
| F19 | Agenda de Hoy con total de tiempo y rango ⏰ | RI-B §1.3 | F5 | pendiente | A+M | orden por minutos |
| F20 | Breadcrumb plegable de origen por tarea | RI-B §1.3 | F5 | pendiente | M | |
| F21 | Clic abre nota en la línea | RI-B §1.1 | F5 | pendiente | M | |
| F22 | Header pegajoso + filtros colapsables en móvil | RI-B §1.1 | F5 | pendiente | M | |
| F23 | Vista Jerárquica: árbol, contadores, `[FALTA]`, expandir/colapsar todo | RI-B §1.2 | F5 | pendiente | M | render perezoso |
| F24 | Búsqueda jerárquica por título y contenido | RI-B §1.2 | F5 | pendiente | M | contenido vía índice/cachedRead con cancelación |
| F25 | Resaltado de notas con tareas en progreso | RI-B §1.1 | F5 | pendiente | M | sin lecturas extra |

## Captura

| ID | Funcionalidad v1 | Fuente | Fase | Estado v2 | Prueba | Notas |
|---|---|---|---|---|---|---|
| F26 | Smart Inbox (comando + ribbon `plus-circle`) | RI-B §3 | F6 | pendiente | M | |
| F27 | `@` proyectos/áreas 🟢 con nota activa primero | RI-B §3.5 | F6 | pendiente | A+M | incluye `PQ -` |
| F28 | `#` menú en cascada cx/px/gtd con filtrado incremental | RI-B §3.6 | F6 | pendiente | A+M | sin valores de ejemplo |
| F29 | `!` calendario Start/Schedule/Due + accesos rápidos | RI-B §3.7 | F6 | pendiente | A+M | |
| F30 | Fechas legacy `!hoy`, `!mañana`, día de semana | RI-B §3.3 | F6 | pendiente | A | + `YYMMDD` (backlog v0.9) |
| F31 | Inserción en `## Tareas` o `00 - Inbox/Bandeja de entrada.md`, `#inbox`, `➕` | RI-B §3.4 | F6 | pendiente | A | ruta configurable |

## Tiempo y Pomodoro

| ID | Funcionalidad v1 | Fuente | Fase | Estado v2 | Prueba | Notas |
|---|---|---|---|---|---|---|
| F32 | Iniciar temporizador para nota activa / tarea seleccionada (validación de selección) | RI-C §1.3 | F4 | pendiente | A+M | |
| F33 | Detener con modal (fecha, inicio, fin, notas, cerrar tarea) | RI-C §3.5 | F4 | pendiente | M | |
| F34 | Cancelar registro | RI-C §3.9 | F4 | pendiente | M | con confirmación |
| F35 | Modificar temporizador en curso (inicio, notas) | RI-C §3.6 | F4 | pendiente | M | valida inicio ≤ ahora |
| F36 | Registro manual | RI-C §3.7 | F4 | pendiente | M | permite cruzar medianoche |
| F37 | Editar/borrar registros | RI-C §3.7 | F7 | pendiente | M | borrado con confirmación |
| F38 | Barra de estado con tiempo; clic abre Seguimiento | RI-C §1.10 | F4 | pendiente | M | |
| F39 | Sincronización del temporizador entre dispositivos | RI-C §2.5 | F3/F4 | pendiente | A+M | por eventos, sin sondeo |
| F40 | Pomodoro trabajo/descanso, ciclos, overtime con alertas | RI-C §4 | F4 | pendiente | A+M | corrige 10 defectos |
| F41 | Modal de fin de Pomodoro (descanso/otro/overtime/finalizar, notas, cerrar tarea) | RI-C §4.4 | F4 | pendiente | M | |
| F42 | Sonido, vibración, notificaciones | RI-C §4.2 | F4 | pendiente | M | |
| F43 | Recuperación tras recarga (timer y pomodoro) | RI-C §4.6 | F4 | pendiente | A+M | fin = start+duración si expiró cerrado |
| F44 | Ajustes Pomodoro (duraciones, ciclos, overtime, auto‑inicio, sonido, notificaciones) | RI-B §4 | F4 | pendiente | M | auto‑inicio implementado |
| F45 | Estadísticas Pomodoro | RI-B §4 | F7 | pendiente | A | recalculadas desde logs |
| F46 | Selector de tarea con 3 fuentes y búsqueda | RI-C §5.1 | F4/F7 | pendiente | M | desde índice |
| F47 | Almacenamiento `data.json.timeLogs` | RI-C §2 | F3 | pendiente | A | **reemplazado** por eventos por dispositivo; importador |

## Estadísticas, cronograma, actividad

| ID | Funcionalidad v1 | Fuente | Fase | Estado v2 | Prueba | Notas |
|---|---|---|---|---|---|---|
| F48 | Árbol de tiempo por ruta con %, registros, nodos de tránsito, salto inteligente, colores por tipo | RI-B §1.6 | F7 | pendiente | A+M | |
| F49 | Periodos (hoy/semana/mes/año/siempre/rango/día) + navegación ‹ › + DatePicker + heatmap | RI-B §1.6–1.7 | F7 | pendiente | A+M | |
| F50 | Exportar a Excel (nodo + descendientes) | RI-B §1.6 | F7 | pendiente | A | **CSV** en lugar de xlsx (mismas columnas) |
| F51 | Cronograma día/3/semana, zoom, mover/redimensionar/crear/copiar, multi‑día, colores, tooltip | RI-B §1.8 | F7 | pendiente | A+M | Pointer Events (táctil) |
| F52 | Panel de actividad (capturadas/completadas, notas nuevas/modificadas, periodos, detalle) | RI-C §5.5 | F7 | pendiente | A+M | sobre índice |
| F53 | Panel de revisión (añadir tarea, archivar 🔵, abrir carpeta) | RI-B §1.9 | F7 | pendiente | M | |

## Foco y Backlinks

| ID | Funcionalidad v1 | Fuente | Fase | Estado v2 | Prueba | Notas |
|---|---|---|---|---|---|---|
| F54 | Vista de Foco (comando, ribbon `crosshair`) | RI-D §1 | F8 | pendiente | M | sin fork: dashboard con scope |
| F55 | Expansión bidireccional (salientes N, entrantes M, terminación carpeta/notas) | RI-D §1.4 | F8 | pendiente | A | |
| F56 | Badges de origen ➡️/⬅️ y estadísticas de foco | RI-D §1 | F8 | pendiente | M | |
| F57 | Cabecera colapsable persistida | RI-D §1.6 | F8 | pendiente | M | caché por dispositivo |
| F58 | Ajustes de Foco | RI-D §1.7 | F8 | pendiente | M | |
| F59 | Backlinks: misma carpeta + enlaces, sigue nota activa (comando, ribbon `link`, menú de archivo) | RI-D §2.1 | F8 | pendiente | A+M | + `origen` opcional |
| F60 | Árbol de backlinks con expansión inteligente de carpetas | RI-D §2.2–2.3 | F8 | pendiente | A+M | |
| F61 | Visor de pestañas abiertas agrupadas | RI-D §2.4 | F8 | pendiente | M | |
| F62 | Ordenamientos (archivo, tipo, estado, ruta, creación, modificación) | RI-D §2.5 | F8 | pendiente | A | |
| F63 | Fechas detalladas + monto/moneda para Tx | RI-D §2.6 | F8 | pendiente | A | formato seguro |
| F64 | Breadcrumbs (completo/inteligente/compacto) | RI-D §2.7 | F8 | pendiente | A | sin recursión |
| F65 | Títulos multilínea | RI-D §2.8 | F8 | pendiente | M | |

## Journal, Weekly, notas

| ID | Funcionalidad v1 | Fuente | Fase | Estado v2 | Prueba | Notas |
|---|---|---|---|---|---|---|
| F66 | `journalAPI.renderTasksForDate` + `getTaskCounts` (8 grupos) | RI-E §3 | F9 | pendiente | A+M | firmas idénticas |
| F67 | `journalAPI.getDailyNotePath`, `generateWeeklyLink`, `ensureFolderStructure`, `validateJournalSettings` | RI-E §3.3 | F9 | pendiente | A | trimestre corregido |
| F68 | `weeklyAPI.renderTasksForWeek` + `getTaskCounts` + `ensureFolderStructure` | RI-E §4 | F9 | pendiente | A+M | |
| F69 | Interacciones (abrir tarea, enlaces, dependencia) | RI-E §3.7 | F9 | pendiente | M | checkbox ahora completa |
| F70 | Ajustes Journal con vista previa | RI-B §4 | F9 | pendiente | M | |
| F71 | Plantillas de notas (22 tipos) — hoy vía Templater | RI-E §5 | F9 | pendiente | A | motor propio (02 §1) |
| F72 | Notas de journal (Dly/Wly/Mly/Qly/Yly) con enlaces entre periodos | RI-E §5.6 | F9 | pendiente | A | sin nombrar a mano |
| F73 | Selector de estado de nota 🟡🟢🔵🔴 | índice; RI-C §0.1 | F9 | pendiente | M | **no existía en v1**: nueva |

## Plataforma

| ID | Funcionalidad v1 | Fuente | Fase | Estado v2 | Prueba | Notas |
|---|---|---|---|---|---|---|
| F74 | Persistencia `data.json` (ajustes) | RI-C §2 | F2 | pendiente | A | schemaVersion 2, backup |
| F75 | Pestaña de ajustes | RI-B §4 | F2+ | pendiente | M | + carpetas, prefijos, Inbox, exclusiones |
| F76 | Soporte móvil | RI-F §2.20 | todas | pendiente | M | |
| F77 | Escritura incremental en menús | RI-B §3.6 | F6 | pendiente | A | |
| F78 | Migración `timelogs.json` | RI-C §2.4 | F3 | pendiente | A | v1 la perdía; v2 la importa |

## Descartadas / no portadas (con motivo)

| ID | Elemento v1 | Motivo |
|---|---|---|
| D01 | `xlsx` / exportación `.xlsx` | Peso del bundle (~1 MB) y móvil; reemplazado por CSV compatible con Excel (F50) |
| D02 | Sondeo de `data.json` cada 15 s | Reemplazado por eventos de archivo (F39) |
| D03 | `pomodoroStats` persistidas | Inexactas; se recalculan (F45) |
| D04 | `TimeTrackerService.getStatistics` (código muerto) y `saveInterruptedSession` (no‑op) | Sin uso |
| D05 | Valores de ejemplo de contextos/personas (`juan`, `maria`, `oficina`…) en el menú | Datos falsos; se usan solo los del vault |
| D06 | `DovelaPluginData` duplicados de `focoModel.ts` | Obsoletos |
| D07 | `detachLeavesOfType` en `onunload` | Desaconsejado por Obsidian; las hojas se restauran solas |
