---
type: Cmt
commit: fb345ab
branch: feat/mejoras-varias
tagVersion: 
estado: 🟢
tags:
---

Este commit refactoriza los filtros de "Contexto" y "Persona" en las vistas de "Listas GTD" y "Foco del Proyecto" para mejorar la usabilidad.

Cambios principales:
- Se reemplazaron los menús desplegables `<select>` por campos de texto `<input>` con `<datalist>`. Esto permite al usuario escribir directamente para buscar y filtrar en listas largas de contextos o personas.
- Se añadió ordenamiento alfabético a las listas de contextos y personas en los filtros para facilitar su localización visual.
- Se actualizó la lógica de los manejadores de eventos para que funcionen con los nuevos campos de texto, utilizando el evento `input` para un filtrado dinámico e instantáneo.
- Se corrigió la lógica de filtrado para que un campo vacío se interprete como "mostrar todo", adaptándose al comportamiento de los nuevos campos de texto.
 
 Estos cambios se aplicaron de manera consistente en los módulos `moduloGTDv3` y `moduloFoco` para garantizar una experiencia de usuario uniforme en ambas vistas.
