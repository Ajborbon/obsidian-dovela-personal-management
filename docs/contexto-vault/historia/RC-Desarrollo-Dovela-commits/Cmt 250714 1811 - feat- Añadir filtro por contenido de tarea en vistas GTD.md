---
type: Cmt
commit: 4e12d34
branch: feat/mejoras-varias
tagVersion: 
estado: 🟢
tags:
---
Este commit introduce una mejora en la usabilidad de las vistas de "Listas GTD" y "Foco del Proyecto" al añadir un nuevo filtro por contenido de tarea.

Cambios principales:
- Se ha añadido un campo de texto en la barra de filtros de ambas vistas que permite a los usuarios buscar tareas escribiendo parte de su descripción.
- Se modificaron los generadores de HTML (`htmlGenerator.ts` y `focoHtmlGenerator.ts`) para incluir el nuevo campo de filtro y para añadir un atributo `data-content` a cada elemento de tarea, haciendo su contenido accesible para el filtrado.
- Se actualizó la lógica de los manejadores de eventos (`view.ts` y `focoView.ts`) para incorporar el nuevo filtro. La visibilidad de las tareas ahora depende de que se cumplan los tres criterios de filtrado: contexto, persona y contenido de la tarea.

 Esta funcionalidad se ha implementado de forma consistente en los módulos `moduloGTDv3` y `moduloFoco`, manteniendo una experiencia de usuario coherente.

