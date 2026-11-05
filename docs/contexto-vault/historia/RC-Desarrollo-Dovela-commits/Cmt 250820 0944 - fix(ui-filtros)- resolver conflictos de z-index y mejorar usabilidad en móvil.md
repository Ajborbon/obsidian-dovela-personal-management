---
type: Cmt
commit: e8fa765
branch: feat/mejoras-varias
tagVersion:
estado: 🟢
tags:
---

Corrección y optimización de la experiencia de filtros en pantallas móviles:

### Cambios principales:
- Se soluciona conflicto de z-index en filtros colapsados:
  - Inputs, datalist y grupos ahora quedan invisibles e intocables al estar cerrados.
  - Z-index negativos para evitar interceptar clics.
- Estado expandido:
  - Activación controlada de visibilidad e interacciones.
  - Jerarquía de z-index ajustada (inputs, datalist, nav principal, header).
- Datalist optimizado:
  - Altura máxima y mínima ajustada con scroll interno.
  - Estilos visuales mejorados: bordes, sombra, fondo y contraste.
- UX móvil:
  - Área de toque mínima (44px) en toggle de filtros.
  - Prevención de zoom en inputs en iOS (font-size ≥16px).
  - Animaciones y transiciones optimizadas con control de z-index.
- Fallbacks:
  - Priorización de navegación principal y listas en caso de conflictos extremos.

### Impacto:
- Se eliminan interferencias de interacción al colapsar filtros en móvil.
- Mayor consistencia visual y jerárquica entre header, navegación y contenido.
- Mejor experiencia de usuario en iOS y Android.
