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
