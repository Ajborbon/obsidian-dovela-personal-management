---
type: Cmt
commit: 3edd7b4
branch: feat/mejoras-varias
tagVersion:
estado: 🟢
tags:
---

Mejoras visuales y de usabilidad en filtros y navegación:

### Cambios principales:
- Inputs de filtros:
  - Ajuste flexible con `flex: 1`, reducción de padding y tamaño de fuente.
  - Bordes y radios adaptados a móvil y modo oscuro.
- Filtros en móvil:
  - Estilos optimizados para pantallas pequeñas (<768px).
  - Datalist rediseñado con scroll interno, mejor contraste y área táctil ampliada.
  - Inputs con integración visual mejorada y z-index ajustado para evitar solapamientos.
- Indicadores visuales:
  - Nuevo estado `.filters-toggle.has-active-filters` con acento de color e iconografía resaltada.
  - Toggle expandido con animación de rotación.
- Accesibilidad:
  - Área de toque mínima en inputs (≥36px).
  - Reducción de movimiento en `prefers-reduced-motion`.
  - Eliminación de animaciones innecesarias cuando se reduce movimiento.
- Estilos generales:
  - Header ajustado en z-index para priorizar filtros.
  - Transiciones más suaves en expansión de filtros.
  - Limpieza de estilos antiguos redundantes.

### Impacto:
- Mejora significativa en la experiencia de uso en dispositivos móviles.
- Consistencia visual en filtros activos/inactivos.
- Mayor accesibilidad y ergonomía para usuarios en móvil y escritorio.
