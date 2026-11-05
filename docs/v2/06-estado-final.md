# 06 · Estado final de la reescritura v2

> Fecha: 2026-11-05 · Rama: `rewrite/v2` (espejo: `claude/docs-contexto-vault-xlfm8g`) · `main` sin tocar.
> **Advertencia principal:** nada se ha ejecutado aún dentro de Obsidian (ni escritorio ni móvil). Todo lo que este
> documento llama “hecho” está implementado, compila con tipos estrictos, pasa lint y tiene pruebas automáticas
> de su lógica pura; la interfaz y la integración con Obsidian/Sync deben validarse con la
> [guía de pruebas](05-guia-de-pruebas.md) antes de usar la rama con el vault real.

## 1. Resumen

| Indicador | v1 | v2 |
|---|---|---|
| Código TypeScript (`src/`) | 20.542 líneas, 66 archivos | 19.929 líneas, 125 archivos (≈ 60 % vistas/UI, 40 % lógica pura) |
| Pruebas automáticas | 0 | **504** (vitest, 30+ archivos, ~4.300 líneas) |
| `main.js` | ≈ 1,6 MB | **≈ 357 KB** (objetivo 250 KB no alcanzado, ver §5) |
| Dependencias de ejecución | `xlsx`, `moment` (empaquetado), `react`/`svelte` declarados | **ninguna** |
| Reparseo del vault | en cada vista, clic, modal y bloque de journal | **nunca**: índice incremental por eventos; solo lee notas con tareas |
| Almacenamiento de tiempo | un `data.json` reescrito entero (pérdidas con Sync) | eventos append-only por dispositivo y mes en `.md` |
| Matriz de paridad | — | 78 funcionalidades v1: 14 hechas, 63 mejoradas, 1 parcial (móvil, pendiente de validación manual), 0 descartadas sin motivo; 10 nuevas |

## 2. Lo hecho (por fase)

| Fase | Entregado | Commits |
|---|---|---|
| F0 | Ingeniería inversa (6 anexos), decisiones, plan, matriz | `74ba717` |
| F1 | Cadena esbuild/tsc/vitest/eslint; núcleo puro: fechas ISO, parser R1–R12, edición segura, clasificador GTD, En Progreso, jerarquía | `aed47a8` |
| F2 | `VaultIndex` incremental, `data.json` v2 con migración y respaldo, caché por dispositivo, escritor de tareas seguro, ajustes extensibles, diagnóstico | `2752e6a` |
| F3 | Registro de tiempo por eventos, fusión con cierre terminal, estadísticas, cronograma, CSV, Pomodoro corregido, importador idempotente, `TimeService` | `fc535b2` |
| F4–F9 | UI compartida y contratos; paneles; backlinks; journal/weekly; Smart Inbox; Dashboard GTD + Foco; UI de tiempo y Pomodoro; motor de notas + journals + selector de estado | `f50aa1c` … `2d9eae1` |
| F10 | Integración, revisión de código independiente (18 hallazgos; corregidos todos los de gravedad alta y media y la mayoría de los bajos), guía de pruebas, este documento | `e0ce7de` … |

Detalle por funcionalidad: [matriz de paridad](04-matriz-de-paridad.md). Detalle por fase: [bitácora](BITACORA.md).

### Respuestas a las preguntas de diseño (resumen de `02`)
1. **Plantillas** → motor declarativo propio para los 22 tipos (frontmatter y cuerpo verificados byte a byte contra las plantillas reales); Templater puede seguir instalado; no se ejecuta JS de plantillas.
2. **Pomodoro y tiempo** → eventos JSONL en `.md` por dispositivo y mes; cada dispositivo escribe solo su archivo; fusión LWW con cierre terminal; historial v1 importado sin tocar el original.
3. **Capa de datos única** → sí: `VaultIndex` + `IndexStore`, compartido por todas las vistas.
4. **Interfaz** → DOM nativo con helpers, render perezoso/por tandas y `VirtualList`; sin frameworks.
5. **Configuración** → `data.json` solo ajustes (schemaVersion 2); vault para datos; caché local por dispositivo para preferencias de UI.
6. **Dependencias** → eliminadas `xlsx`, `react`, `svelte`, `obsidian-dev-utils`; `moment` no se empaqueta.

## 3. Pendiente

| # | Pendiente | Por qué / siguiente paso |
|---|---|---|
| P1 | **Validación manual en Obsidian** (escritorio, iOS, Android) de todas las guías `docs/v2/guia/*.md` | No hay Obsidian en el entorno de desarrollo. Es el siguiente paso obligatorio |
| P2 | Prueba de Obsidian Sync con dos dispositivos (05 §3.3) | Ídem; usar un vault remoto de prueba |
| P3 | Medición de rendimiento con el vault real (~2.700–7.400 notas) | El comando “Diagnóstico: reconstruir índice” informa el tiempo |
| P4 | Backlog heredado no implementado: insertar captura en el cursor de la nota activa, fecha de entrega vía `[w::]` en captura, comando “Procesar Inbox”, organización manual de En Progreso, reparto por IA, agrupar pomodoros en “sesiones grandes” (`sessionGapMinutes` existe pero no se usa), zoom con pellizco en el cronograma, configuración rápida en el modal de Pomodoro | Fuera del alcance de paridad; ver RI-F §3 |
| P5 | Revisión: `refold` del registro de tiempo es O(historial) por evento (hallazgo #13) y el Smart Inbox recalcula datos con cada cambio del índice mientras está abierto (#16) | Bajo impacto hasta decenas de miles de eventos; optimizar si las medidas lo piden |
| P6 | `legacy-v1/` sigue en la rama como referencia | Borrarla antes de fusionar con `main` (el código v1 vive en `main`) |
| P7 | Pregunta abierta de las plantillas: la diaria no escribe `fecha:` aunque sus vistas `base` filtran por `this.fecha` (RI-E §10.2) | Decisión de Andrés; v2 reproduce la plantilla tal cual |

## 4. Descartado (con motivo)
Ver “Descartadas” en la matriz: exportación `.xlsx` (→ CSV), sondeo de `data.json` cada 15 s (→ eventos), `pomodoroStats` persistidas (→ recalculadas), código muerto de v1, valores de ejemplo en menús, modelos duplicados de Foco, `detachLeavesOfType` en `onunload`, y “Abrir carpeta” del panel de revisión (solo escritorio → “Abrir nota”).

## 5. Riesgos conocidos

| Riesgo | Mitigación actual | Qué vigilar en pruebas |
|---|---|---|
| UI nunca ejecutada en Obsidian | tipos estrictos, lint, lógica probada, guías detalladas | errores de consola al abrir cada vista; móvil |
| Cambios deliberados de comportamiento (acentos en contextos, semanas activas, `[-]` cancelada, tareas en bloques de código ignoradas, Vencidas agrupadas por 📅, orden por minutos, Asignadas igual que v1…) | cada uno con prueba y documentado en `02` §4 y en las guías | que coincidan con la intención de Andrés |
| Archivos de registro de tiempo visibles en el vault (`Dovela/Registro de tiempo/`) | carpeta única, frontmatter `type: RT`, bloque de código | si molestan en búsquedas, añadirla a “Archivos excluidos” de Obsidian |
| Bundle 357 KB > objetivo 250 KB | 77 KB son los cuerpos de las 22 plantillas copiados literalmente | aceptable frente a 1,6 MB; deduplicar bloques repetidos si se quiere bajar |
| Dos dispositivos que no se ven deciden a la vez sobre un Pomodoro | solo el dispositivo que lo inició decide; los demás muestran `⏰ decidir` | escenario de 05 §3.3 |
| `vault.on('create')` se dispara por cada archivo al arrancar | solo activa una bandera de reenlace | ninguno esperado |
| Índice: notas guardadas sin cambios de contenido no notifican | el panel de actividad ve el `mtime` nuevo en el siguiente redibujo | “notas modificadas hoy” puede tardar en actualizarse |

## 6. Recomendaciones
1. Ejecutar la guía 05 completa en una **copia** del vault (escritorio) y luego en móvil; anotar fallos con el formato de 05 §5.
2. Importar el historial de tiempo en la copia y ejecutar “verificar”; no archivar en el vault real hasta comparar con v1 durante algunos días.
3. Probar Sync con un vault remoto de prueba antes de activar v2 en el vault real; activar v2 primero en un solo dispositivo.
4. Tras la aprobación: borrar `legacy-v1/`, subir `version` del manifest a `2.0.0`, fusionar a `main` y publicar `main.js`/`styles.css` como release.
5. Siguiente iteración sugerida: P4 (backlog) priorizando “Procesar Inbox” y captura en el cursor, y las optimizaciones P5 si las medidas lo justifican.
