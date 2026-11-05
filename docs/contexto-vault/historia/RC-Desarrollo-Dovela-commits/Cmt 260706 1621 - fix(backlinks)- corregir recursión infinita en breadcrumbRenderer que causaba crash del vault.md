---
type: Cmt
commit: ef3b3e1
branch: feat/journal-sistema-tareas-diarias
tagVersion: 
estado: 🟢
tags:
---

origen:: [[RC - Desarrollo Dovela]]

## fix(backlinks): corregir recursión infinita en breadcrumbRenderer que causaba crash del vault

El ciclo de recursión mutua que causaba `RangeError: Maximum call stack size exceeded` y el síntoma "Reiniciando bóveda" al abrir notas con el panel de backlinks.

**Ciclo de recursión (antes del fix):**
`createBreadcrumb` → `createCompactBreadcrumb` → `createPathBreadcrumbs` → `createBreadcrumb` → …

**Fix:** `createPathBreadcrumbs` ahora delega a `createFullBreadcrumb` (que no recursa) en lugar de `createBreadcrumb`.

**Archivos modificados:**
- `src/modules/moduloBacklinks/breadcrumbRenderer.ts` — fix principal (2 líneas)
- `src/modules/moduloWeekly/weeklyTaskRenderer.ts` — non-null assertions en regex match groups (4 líneas)

**Contexto:** retoma del proyecto tras pausa oct 2025–jul 2026. Ver [[PGTD 260706 - Dovela v1.0 - Retoma y estabilización del plugin]].
