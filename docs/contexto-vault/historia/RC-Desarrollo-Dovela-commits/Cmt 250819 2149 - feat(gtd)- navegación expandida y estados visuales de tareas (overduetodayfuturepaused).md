---
type: Cmt
commit: ef6bd64
branch: feat/mejoras-varias
tagVersion: 
estado: 🟢
tags:
---

Se amplía la navegación y se añaden estados visuales a las tareas en vistas GTD y Foco.

### Navegación expandida
- Sublistas dinámicas reestructuradas en grupos colapsables (details).
- Orden ajustado: Ojalá Hoy → Próximas Acciones → Asignadas.
- Limpieza de labels de prefijos internos (cx-/px-) para visualización más clara.
- Nuevos separadores visuales (.gtd-sublist-sep, .gtd-sublist-hr) en navegación.

### Estados visuales de tareas
- Nuevo campo displayStatus en modelo (overdue, today, future, paused-dep, paused-start).
- Procesadores (gtdProcessor/focoProcessor) calculan el estado según fecha, dependencias y tipo de inicio.
- Generadores HTML aplican clases y atributos data-display-status dinámicos.
- Estilos CSS agregados para resaltar cada estado con colores y bordes específicos.

### Archivos modificados
- focoModel.ts, model.ts: definición de DisplayStatus en Task.
- focoProcessor.ts, gtdProcessor.ts: lógica de asignación de displayStatus y agrupamiento mejorado.
- focoHtmlGenerator.ts, htmlGenerator.ts: renderizado con clases y atributos de estado, navegación colapsable.
- styles.css: estilos para displayStatus y separadores de sublistas.

Impacto:
- Mejora la usabilidad y la claridad visual en la gestión de tareas.
- Permite identificar rápidamente tareas vencidas, de hoy, futuras o pausadas.
- Navegación más intuitiva y estructurada entre listas y sublistas.
