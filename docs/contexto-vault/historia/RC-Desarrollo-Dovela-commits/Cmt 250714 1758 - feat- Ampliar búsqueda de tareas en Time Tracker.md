---
type: Cmt
commit: 3d33f15
branch: feat/mejoras-varias
tagVersion: 
estado: 🟢
tags:
---

Este commit mejora la funcionalidad de búsqueda de tareas en el Time Tracker para que sea más potente y completa.

Cambios principales:
- Se ha modificado la lógica de filtrado en la vista principal del Time Tracker (`timeTrackerView.ts`) y en el modal de registro manual (`timeLogModal.ts`).
- La búsqueda ahora no solo considera el contenido de la tarea, sino que también incluye:
	- Contextos asignados (ej: #cx-reunion)
	- Personas asignadas (ej: #px-juan)
	- Tags específicos de GTD (#GTD-EstaSemanaNo, #GTD-AlgunDia)
 
 Esto asegura una experiencia de usuario consistente y permite a los usuarios encontrar tareas de forma más flexible, utilizando sus metadatos GTD directamente en el buscador.
