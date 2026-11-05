---
type: Cmt
commit: 233fdea
branch: feat/mejoras-varias
tagVersion: 
estado: 🟢
tags:
---

Agrega navegación mejorada con contadores y enlaces directos a sublistas:

### Nuevas características:
- Navegación en dos niveles: principal y sublistas
- Contadores automáticos para todas las listas y sublistas
- Enlaces directos con scroll suave a cualquier sección
- Iconos distintivos (📋 contextos, 👤 personas, específicos por lista)

### Sublistas dinámicas implementadas:
- "Próximas Acciones": agrupadas por contexto
- "Asignadas o Delegadas": agrupadas por persona
- "Ojalá Hoy": agrupadas por contexto/persona

### Mejoras técnicas:
- Consistencia entre GTD Dashboard y Vista de Foco
- Generación unificada de IDs para navegación
- Nuevo modelo NavigationItem para metadata de navegación
- Procesamiento de agrupamiento movido al processor para mejor rendimiento

### Archivos modificados:
- model.ts: nueva interfaz NavigationItem
- gtdProcessor.ts: generación automática de navigationItems
- htmlGenerator.ts: navegación expandida con enlaces funcionales
- focoProcessor.ts, focoHtmlGenerator.ts: consistencia con módulo principal
- view.ts, focoView.ts: integración de navigationItems
- styles.css: estilos para navegación expandida

Resuelve la necesidad UX de acceso rápido a sublistas específicas con
información visual inmediata de carga de trabajo por contexto/persona.
