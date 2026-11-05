# 03 · Plan de desarrollo de Dovela v2

> Rama: `rewrite/v2` (desde `docs/contexto-vault`). `main` no se toca.
> Cada fase termina con: `pnpm build` limpio (tsc estricto + esbuild), `pnpm lint` sin errores, `pnpm test` en verde,
> matriz de paridad actualizada, entrada en `BITACORA.md`, commit propio y `git push -u origin rewrite/v2`.

## Criterios globales de aceptación (todas las fases)
- TypeScript `strict` + `@tsconfig/strictest`, sin `any` explícito, sin `@ts-ignore`.
- `src/core/**` no importa `obsidian` (verificado por regla de lint `no-restricted-imports`).
- Ningún `innerHTML` con datos del vault (regla de lint).
- Sin `console.log` (solo `logger` con nivel, apagado por defecto).
- Ninguna API de Node en `src/` (`no-restricted-imports`: `fs`, `path`, `crypto`, `child_process`, `electron`).
- `manifest.json`: `isDesktopOnly: false`, `id` sin cambios, `minAppVersion` ≥ 1.5.0 (`vault.process`, `processFrontMatter`, `saveLocalStorage`).

---

## F0 · Plan (este documento) ✅
Entregables: `01`–`04`, anexos `RI-*`, `BITACORA.md`. Aceptación: documentos en la rama.

## F1 · Fundaciones y núcleo puro
**Alcance.** Nueva cadena de build (esbuild, tsc, vitest, eslint flat config), `package.json` sin `xlsx/react/svelte/obsidian-dev-utils`; esqueleto `src/` (§8 de 02);
`core/dates` (fecha local, ISO week con año ISO, trimestres, formatos `YYMMDD`, `YYYY-MM-DD dddd` en es), `core/duration`, `core/color`;
`core/tasks/parse` (R1–R12), `core/tasks/edit` (markInProgress/markDone/localizar línea segura), `core/tasks/priority`;
`core/gtd/classify` (10 listas + displayStatus + navegación), `core/gtd/inprogress`; `core/notes/types` (tipos y prefijos), `core/notes/hierarchy` (corrige B‑H1).
`main.ts` mínimo que carga y registra un comando de diagnóstico.
**Orden.** build → dates → parse → edit → classify → inprogress → hierarchy.
**Aceptación.** Las 21 filas de RI‑A §8.2 como pruebas de oro (adaptadas a R1–R12 donde aplique); todos los vectores verificados de RI‑A §8 (parseTime, formatDuration, color) y RI‑E §8.2 (semanas ISO) en verde; bundle generado.

## F2 · Capa de datos y plataforma
**Alcance.** `host/VaultIndex` (prefiltro `listItems`, eventos, lotes, debounce, índice invertido de enlaces, consultas de 02 §3), `host/settings` (schemaVersion 2, deep‑merge, backup v1, `onExternalSettingsChange`), `host/deviceCache`, `ui/` base (h, VirtualList, Tabs, Menu, MonthGrid, modales), logger, carga diferida de features.
**Aceptación.** Pruebas del índice con `FakeHost` (alta/cambio/borrado/renombrado, enlaces invertidos, dependencias); pruebas de merge de ajustes (defaults no compartidos, parciales).

## F3 · Almacenamiento de tiempo
**Alcance.** `core/time/events` (formato JSONL), `merge` (LWW por `u`, desempate por dispositivo, tombstones), `stats` (árbol por ruta, rangos, reparto por día), `timeline` (segmentos y columnas de solape), `csv`; `core/time/legacy-import` (data.json + timelogs.json); `host/storage/EventLogStore` (un archivo por dispositivo y mes, cola de escritura con `vault.process`, recarga por `modify`).
**Aceptación.** Propiedades de merge (conmutativo, idempotente), importador idempotente con datos reales de RI‑C §2.1, sumas por mes iguales antes/después, CSV con columnas del export v1.

## F4 · Servicio de tiempo, Pomodoro y comandos
**Alcance.** `core/time/pomodoro` (máquina de estados pura: work/break/overtime/awaiting; ciclos correctos; fin de sesión = momento real), `TimeService` (timer y pomodoro excluyentes), barra de estado, comandos de paleta (iniciar en nota/tarea seleccionada, detener, cancelar, modificar, registro manual, iniciar pomodoro, descanso), `TimeLogModal`, `PomodoroModal`, notificaciones/sonido/vibración, recuperación tras recarga.
**Aceptación.** Pruebas de la máquina de estados (RI‑C §7 casos 22–27), de selección de tarea (casos 28–31) y de escritura de estado de tarea.

## F5 · Dashboard GTD
**Alcance.** Vista `gtd-view` con pestañas Listas GTD, En Progreso, Jerárquica, Seguimiento, Estadísticas, Cronograma (las tres últimas montan componentes de F7); filtros sobre datos, navegación rápida, toggle de vencidas, breadcrumbs, dependencias navegables, refresco reactivo, estado por dispositivo, móvil.
**Aceptación.** Build + pruebas de view‑models (filtro, conteos únicos vs por sublista); guía de pruebas manuales por pestaña.

## F6 · Captura (Smart Inbox)
**Alcance.** Tokenizador puro de la línea de captura (`@`, `#cx-/#px-/#GTD-`, `!` + fechas legacy en español e inglés, `YYMMDD`), generador de línea (`➕ YYYY-MM-DD` compatible con Tasks, opción de hora), inserción en `## Tareas`/Inbox con `vault.process`; menú unificado con teclado; nota activa primero; calendario Start/Schedule/Due.
**Aceptación.** Pruebas del tokenizador (incluye defectos de RI‑B §3.6 corregidos: `@Proyecto texto`, Enter con menú) y del insertador.

## F7 · Vistas de tiempo, actividad y revisión
**Alcance.** Seguimiento, Estadísticas (árbol, periodos, heatmap, salto inteligente, edición, export CSV), Cronograma (día/3/semana, zoom, Pointer Events para mover/redimensionar/crear/copiar, multi‑día), Panel de actividad (sobre índice: `➕`/`✅` y ctime/mtime), Panel de revisión (estancados sobre índice).
**Aceptación.** Pruebas de view‑models de estadísticas y timeline; guía manual.

## F8 · Foco y Backlinks
**Alcance.** Foco = dashboard con `ScopeProvider` (carpeta + `expandNeighborhood` bidireccional + terminación), badges de origen, cabecera colapsable, ajustes por dispositivo, persistencia de la nota fijada (`getState/setState`), opción “seguir nota activa”. Backlinks: misma carpeta ∪ enlaces entrantes (∪ `origen`), lista virtualizada / árbol, pestañas abiertas, ordenamientos, `Tx` con monto/moneda (formato seguro), breadcrumbs sin recursión.
**Aceptación.** Pruebas de `expandNeighborhood` y breadcrumbs (RI‑D §6).

## F9 · Journal, Weekly, notas y estado
**Alcance.** `journalAPI`/`weeklyAPI` con firmas v1 sobre el índice, renderer nativo, checkbox funcional, refresco al cambiar tareas; rutas corregidas (trimestre, año ISO); motor de notas (specs de los 22 tipos), comandos “Nueva nota …” y “Abrir/crear diaria/semanal/mensual/trimestral/anual”; selector de estado 🟡🟢🔵🔴.
**Aceptación.** Pruebas de rutas y periodos (RI‑E §8.1–8.5), snapshots de frontmatter por plantilla.

## F10 · Cierre
**Alcance.** `05-guia-de-pruebas.md`, `06-estado-final.md`, matriz final, limpieza (eliminar `src/modules/` v1 del bundle; el código v1 queda accesible en `main`), medición de bundle.

---

## Plan de migración de datos

1. **Ajustes**: al cargar, si `data.json` no tiene `schemaVersion` → es v1: se escribe `data.v1.backup.json` (una vez) y se migra a v2: `pomodoroSettings`, `journalSettings` se copian (deep‑merge); `timeLogs`, `activeTimer`, `activePomodoroSession`, `pomodoroStats` se mueven sin modificar a `legacy`.
2. **Registros de tiempo**: se ofrece (aviso persistente) “Importar historial v1”. El importador escribe en `Dovela/Registro de tiempo/YYYY-MM · importado.md`, idempotente (`leg-<id>`). Tras importar muestra un informe (n.º importados, duplicados, inválidos, sumas por mes).
3. **Verificación**: comando “Verificar historial importado” compara conteos y minutos por mes legacy↔nuevo. Solo si coinciden se habilita “Archivar historial v1” (vacía `legacy.timeLogs` dejando el backup).
4. **Sesiones vivas v1** (`activeTimer`, `activePomodoroSession`): si < 12 h se recrean como evento `live`; si no, el usuario decide.
5. **`timelogs.json`** (formato previo): si existe se importa igual; nunca se borra automáticamente.
6. **`localStorage` v1** (Foco/Backlinks): se leen las claves antiguas una vez y se copian a la caché por dispositivo.
7. **Notas**: ninguna migración. Lectura tolerante (R1–R12). Las escrituras de v2 producen el mismo formato que v1 (salvo `➕` sin hora por defecto, configurable).
8. **Reversión**: volver a v1 = reinstalar `main.js` de `main`. v1 ignora `schemaVersion`/`legacy`… pero **no** vería registros nuevos → documentado en la guía (exportar CSV antes de volver).

## Orden de ejecución y paralelismo
F1 → F2 → F3 son secuenciales (contratos). F4–F9 dependen de F2/F3 y se reparten por módulos independientes (`features/*`), integrados y verificados por el orquestador.
