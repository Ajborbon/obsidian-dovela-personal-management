---
type: Cmt
commit: 2a84ed7
branch: feat/mejoras-varias
tagVersion: 
estado: 🟢
tags:
---

- Vista por defecto cambiada a "gtd" en FocoView y GtdView.
- Header pegajoso unificado con:
  - Controles de vista, botón de refresco y total de tareas.
  - Título de foco colapsible (🎯) en la vista de Foco.
- Filtros responsivos:
  - Nuevo toggle en móvil (mostrar/ocultar con animación).
  - Indicadores visuales de filtros activos.
  - Inputs con datalist y estilos de enfoque.
- Navegación rápida (quick nav) mejorada:
  - Subgrupos colapsables (Ojalá Hoy / Contextos / Asignadas).
  - Sincronización de contadores con el resultado de los filtros.
  - Oculta listas y sublistas sin resultados.

- Lógica de filtrado mejorada en FocoView y GtdView:
  - Recuento por lista y sublista (Map) para mostrar/ocultar y actualizar contadores.
  - Actualización del total (tareas filtradas vs. totales).
  - Actualiza también los contadores de la navegación.

- Refactor en generadores HTML:
  - Nuevas helpers: generateFiltersHtml() y generateQuickNavHtml().
  - Limpieza en renderGtdListsView y estructura de vistas.

- Gran mejora de estilos (styles.css):
  - Nuevo layout con .gtd-sticky-header y .gtd-view-content.
  - Botones de vista, hover states y accesibilidad (reduced motion).
  - Responsividad móvil/tablet, modo oscuro y ajustes de scroll-padding.
  - Mejoras de UX: chips de navegación, badges de conteo y transiciones.

- Limpieza:
  - Se elimina commit-msg.txt obsoleto.

Refs: UI/UX de vistas GTD y Foco, navegación y filtrado.
