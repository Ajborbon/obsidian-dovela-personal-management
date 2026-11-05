# Bitácora de la reescritura v2

Una entrada por fase. Formato: fecha · fase · qué se hizo · decisiones · verificación · siguiente paso.

## 2026-11-05 · F0 · Plan
- Rama `rewrite/v2` creada desde `docs/contexto-vault`.
- Ingeniería inversa en seis frentes (núcleo GTD, vistas y Smart Inbox, main/tiempo/Pomodoro, Foco/Backlinks, Journal/Weekly/plantillas, historia de 83 notas `Cmt`). Informes completos en `docs/v2/anexos/RI-*.md`; varios comportamientos se verificaron ejecutando el código v1 en un arnés aislado.
- Documentos: `01-ingenieria-inversa.md`, `02-decisiones-de-diseno.md`, `03-plan-de-desarrollo.md`, `04-matriz-de-paridad.md`.
- Decisiones clave: motor de notas declarativo propio; registros de tiempo como eventos append‑only en `.md` por dispositivo y mes; `VaultIndex` incremental único con prefiltro `listItems`; DOM nativo + virtualización; `data.json` solo ajustes (schemaVersion 2); eliminar `xlsx`, `react`, `svelte`, `obsidian-dev-utils`.
- Hallazgos que cambian el alcance: el selector de estado de nota no existía en v1; la migración `timelogs.json` de v1 perdía datos; varias reglas de semanas y del Pomodoro estaban inoperantes.
- Verificación: solo documentación.
- Siguiente: F1 (cadena de build y núcleo puro con pruebas).

## 2026-11-05 · F1 · Fundaciones y núcleo puro
- Cadena de build nueva: esbuild (bundle CJS único), `tsc` con `@tsconfig/strictest`, vitest, eslint (flat config). Eliminados `xlsx`, `react`, `svelte`, `obsidian-dev-utils`, `package-lock.json`. `styles.css` se genera desde `src/styles/`.
- Código v1 movido a `legacy-v1/` (solo referencia; fuera del build).
- Núcleo puro en `src/core/` (sin `obsidian`): `dates` (ISO 8601 independiente de la fecha actual, trimestres correctos), `duration`, `color`, `tasks/parse` (R1–R12), `tasks/edit` (cierre/progreso y localización segura sin fallback), `gtd/classify` (10 listas, displayStatus, navegación, ciclos de dependencias), `gtd/inprogress`, `notes/types`, `notes/hierarchy`.
- Reglas de lint que protegen el diseño: `src/core` no puede importar `obsidian`; prohibidos `innerHTML`, `console` y módulos de Node en `src/`.
- Verificación: `pnpm typecheck` (src + tests), `pnpm lint`, `pnpm test` → 85 pruebas en verde (escenario de oro de 23 tareas verificado contra v1), `pnpm build` → `main.js` mínimo.
- Comportamientos que cambian a propósito respecto a v1 (todos con prueba): acentos en `#cx-`/`#px-`, `2^10` no es id, `⛔ ^id`, `⛔ a,b`, duraciones decimales, semanas activas, horas fuera de rango = conflicto, Start≤Scheduled≤Due completo, tareas en bloques de código/comentarios ignoradas, Vencidas agrupa por 📅 vencida, Ojalá Hoy ordenado, ciclos de dependencias → Bandeja.
- Siguiente: F2 (índice incremental, ajustes, UI base).

## 2026-11-05 · F2 · Capa de datos y plataforma
- `core/index/store.ts`: almacén puro del índice (notas, tareas, enlaces de cuerpo y de `origen` con índice invertido incremental, memoización por versión, ids duplicados).
- `host/index/VaultIndex.ts`: alimenta el almacén con `metadataCache` (`changed`, `deleted`, `resolved`) y `vault.rename`; **solo lee archivos cuyo `listItems` tiene tareas**; construcción inicial en lotes de 40 cediendo el hilo tras `onLayoutReady`; notificación de cambios con debounce de 250 ms.
- `core/settings.ts` + `host/settingsStore.ts`: `data.json` v2 (`schemaVersion: 2`), merge profundo tipado, migración de v1 que conserva `timeLogs`/`activeTimer`/`activePomodoroSession`/`pomodoroStats` intactos en `legacy`, respaldo único `data.v1.backup.json`, guardado con debounce, recarga en `onExternalSettingsChange`.
- `host/deviceCache.ts` (preferencias y `deviceId` por dispositivo), `host/taskWriter.ts` (ediciones con `vault.process` y localización segura), `host/navigation.ts`, `host/logger.ts`, `ui/VirtualList.ts`.
- `main.ts` mínimo con registro de features (`features/registry.ts`); pestaña de ajustes extensible; comandos de diagnóstico del índice.
- Verificación: 92 pruebas, typecheck, lint, build (`main.js` 25 KB).
- Siguiente: F3 (almacenamiento de tiempo por eventos e importador).

## 2026-11-05 · F3 · Almacenamiento de tiempo
- `core/time/events.ts`: eventos `log` / `live` / `cancel` en JSON Lines dentro de un bloque ```dovela-tiempo``` de archivos `YYYY-MM · <dispositivo>.md` (frontmatter `type: RT`). Ids ordenables por tiempo.
- `core/time/merge.ts`: fusión LWW por id con desempate por dispositivo; **el cierre es terminal** (una edición tardía de otro dispositivo no resucita un temporizador detenido); borrado lógico. Probado conmutativo e idempotente.
- `core/time/stats.ts`, `timeline.ts`, `csv.ts`, `pomodoro.ts`, `legacyImport.ts`: árbol por ruta con reparto por día, periodos, mapa de calor, columnas de solape por intervalos, CSV con las columnas del Excel de v1, máquina de Pomodoro corregida, importador idempotente (ids `leg-*`, deduplicación, marca de incoherentes, minutos por mes).
- `host/time/EventLogStore.ts` (lectura de todos los dispositivos, escritura solo propia con `vault.process` en cola, recarga por eventos de Sync) y `host/time/TimeService.ts` (temporizador y Pomodoro excluyentes, registros manuales, edición/borrado, cierre de tareas seguro, importación/verificación/archivado del historial v1).
- Feature `time`: comandos de importar/verificar/archivar el historial, aviso de importación pendiente, sección de ajustes.
- Verificación: 113 pruebas, typecheck, lint, build (`main.js` 45 KB).
- Siguiente: F4–F9 en paralelo por módulos.

## 2026-11-05 · F4–F9 · Funcionalidades (en paralelo por módulos)
- Antes de repartir: componentes de UI compartidos (`ui/taskRow`, `ui/MonthGrid`, `ui/TaskPickerModal`), rutas de journal puras (`core/journal/paths.ts`, trimestre y año ISO corregidos) y contrato `mountTimeTab` entre el Dashboard y la UI de tiempo.
- Siete agentes, cada uno con su carpeta (`features/<x>`, `core/<x>`, `tests/<x>`, `styles/NN-<x>.css`, `docs/v2/guia/<x>.md`), sin tocar contratos compartidos ni hacer commits. El orquestador integró cada área por separado verificando la **instantánea exacta del commit** en un directorio aislado (`git checkout-index`): tipos, lint, pruebas y build. (Incidente: un `git stash` temprano del orquestador ocultó por un instante archivos de los agentes; se recuperaron completos y se dejó de usar stash.)
- F7 paneles (actividad, revisión) · F8 backlinks · F9 journalAPI/weeklyAPI · F6 Smart Inbox · F5/F8 Dashboard GTD + Foco sin fork · F4/F7 UI de tiempo y Pomodoro · F9 motor de notas + journals + selector de estado. Un commit por área.
- Integración: `TimeService.stopTimer` conserva el tipo de sesión (petición del agente de tiempo); objetivos táctiles del calendario a 44 px en móvil.
- Verificación final del árbol: 499 pruebas, typecheck (src + tests), lint, build (`main.js` ≈ 353 KB; v1 ≈ 1,6 MB).
- Decisiones relevantes de los agentes documentadas en cada `docs/v2/guia/*.md` y resumidas en `06-estado-final.md`.

## 2026-11-05 · F10 · Integración, revisión y cierre
- Revisión de código independiente sobre toda la rama (agente revisor, solo lectura): 18 hallazgos verificados. Corregidos: pérdida de registro si fallaba una escritura (reversión del estado optimista y reintento create→process), “cerrar tarea” tras ponerla en progreso (localización que ignora el estado del checkbox), importador que resucitaba registros borrados y duplicaba sesiones vivas, campos de migración perdidos al recargar, historial v1 reescrito en cada ajuste (ahora vive en el respaldo), ajustes sin vaciar al descargar, construcción/reconstrucción frágil del índice, notificaciones por guardados sin cambios, `origen` sin reenlazar, renombrados a otra extensión, selección pisada al enlazar en el padre, fuga en la vista previa de ajustes, carpeta de registros aplicada por tecla, `deviceId` inestable. Pendientes de baja prioridad documentados (P5 de `06`).
- Documentación final: `05-guia-de-pruebas.md` (instalación en vault de prueba, comprobaciones transversales, Sync, rendimiento, móvil) + 7 guías por funcionalidad en `docs/v2/guia/`; `06-estado-final.md`; README con el estado de la rama.
- Verificación final: 504 pruebas, typecheck (src + tests), lint, build (`main.js` ≈ 357 KB).
- Siguiente: validación manual por Andrés según la guía 05.
