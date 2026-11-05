---
type: Btx
fecha: 2026-07-06
estado: 🟢
origen: "[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD 260706 - Dovela v1.0 - Retoma y estabilización del plugin/RR - Sesiones de trabajo Dovela v1.0/RR - Sesiones de trabajo Dovela v1.0|RR - Sesiones de trabajo Dovela v1.0]]"
tags:
---

## Objetivo

Diagnosticar el crash "Reiniciando bóveda" que ocurría al abrir notas con consultas, corregir el bug del plugin Dovela que lo causaba, y redescubrir el escenario de desarrollo del plugin tras la pausa desde octubre de 2025.

## Hechos

### Diagnóstico del crash
- El síntoma era `Failed to open view RangeError: Maximum call stack size exceeded` en la consola, con ciclo visible: `createCompactBreadcrumb → createBreadcrumb → createPathBreadcrumbs → createCompactBreadcrumb...`
- La causa: **recursión mutua infinita** en `src/modules/moduloBacklinks/breadcrumbRenderer.ts`. El método `createPathBreadcrumbs` (alias de compatibilidad) delegaba a `createBreadcrumb`, que según settings volvía a `createCompactBreadcrumb`, que en dos ramas (path corto ≤ maxLength, o ≤ 2 segmentos) llamaba de nuevo a `createPathBreadcrumbs`.

### Fix aplicado
- `createPathBreadcrumbs` ahora delega a `createFullBreadcrumb` (que nunca recursa) en lugar de `createBreadcrumb`.
- TypeScript compila sin errores (`npx tsc --noEmit` exit 0).
- Build con `pnpm build`, `main.js` copiado a la bóveda real `AJBB Crezco360`.
- **Verificado:** se abrieron múltiples notas con el panel de backlinks sin ningún error en consola.

### Redescubrimiento del entorno de desarrollo
Existían tres copias del plugin que causaban confusión. El mapa real quedó así:

| Ubicación | Rol |
|---|---|
| `Mi unidad/Desarrollo Obsidian/Desarrollo 2025/.obsidian/plugins/obsidian-dovela-personal-management/` | **Repositorio activo** — src/, git (82 commits), package.json, .env |
| `~/GDrive-Crezco360/Desarrollo Obsidian/Desarrollo 2025/` | Vault de prueba — destino del hot-reload de `pnpm dev` |
| `~/GDrive-Crezco360 Backup/Desarrollo Obsidian/...` | Backups antiguos (jul 2025) — NO usar |

### Radiografía git del repositorio activo
- Rama activa: `feat/journal-sistema-tareas-diarias`, último commit 2025-10-25 (módulo Weekly).
- 65 commits adelante de `main` local; `main` local tiene 16 commits sin push a GitHub.
- Cambios sin commitear: el fix de esta sesión (`breadcrumbRenderer.ts`) + non-null assertions en `weeklyTaskRenderer.ts`.
- Sin versionar: `Copia de styles.css`, `Documentacion/Agentes-Desarrollo/`, `.claude/`.
- 1 stash pendiente en `feature/smart-inbox`.

### Contexto adicional de la sesión (rendimiento de la bóveda)
- El diagnóstico inicial reveló también que la bóveda pagaba 3 indexadores (Dataview + Datacore + Bases) y doble sincronización (Google Drive streaming + Obsidian Sync). Se deshabilitó DataviewJS con mejora inmediata. La migración de las ~13 notas Dataview restantes a Bases/Datacore quedó como tema aparte, fuera de este proyecto.

## Pendientes al cierre

- Commitear el fix de breadcrumbs y el ajuste de weeklyTaskRenderer (sin commitear al cierre de la sesión).
- Registrar el Cmt en RC - Desarrollo Dovela.
- Consolidar ramas y hacer push a GitHub (65 commits en riesgo).
- Auditar el backlog de 40 tareas de PGTD - Dovela v0.9.

(Las tareas quedaron formalizadas en el PGTD de la retoma.)

## Punto de continuación

Abrir [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD 260706 - Dovela v1.0 - Retoma y estabilización del plugin/PGTD 260706 - Dovela v1.0 - Retoma y estabilización del plugin|PGTD 260706 - Dovela v1.0 - Retoma y estabilización del plugin]] y ejecutar las tareas en orden: primero el commit del fix (⏫), luego la consolidación de ramas (⏫), después la auditoría del backlog v0.9.
