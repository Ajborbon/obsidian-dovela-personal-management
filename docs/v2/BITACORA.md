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
