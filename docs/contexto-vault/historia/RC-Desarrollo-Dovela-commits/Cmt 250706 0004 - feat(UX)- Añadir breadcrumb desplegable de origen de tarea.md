---
type: Cmt
commit: cc48394
branch: main
tagVersion: 
estado: 🟢
tags:
---
  
 Implementa una nueva funcionalidad para mejorar el contexto de las tareas en la vista de "Listas GTD". Ahora, cada tarea muestra un icono de documento que, al ser presionado, revela la ruta jerárquica completa de su nota de origen.
    
Esta actualización incluye:

1.  **Breadcrumb Desplegable:**
	*   Se añade un icono (`📄`) a cada tarea. Al hacer clic, se despliega suavemente un "breadcrumb" (ej. `Área de Vida > Proyecto > Nota Origen`) debajo de la tarea.
	*   La ruta se oculta al volver a hacer clic, manteniendo la interfaz limpia y mostrando el contexto solo bajo demanda.
	*   La etiqueta `[FALTA]` se elimina de los breadcrumbs para una visualización más limpia.

2.  **Corrección de Eventos:**
	*   Se ha refactorizado la gestión de eventos de la vista para usar un `AbortController`. Esto soluciona un bug crítico que causaba la duplicación de "event listeners" en cada redibujado, lo que impedía que la interacción de "toggle" funcionara correctamente.

3.  **Mejoras Estructurales y de Estilo:**
	*   Se ha añadido lógica en `view.ts` para generar un mapa de breadcrumbs para cada tarea.
	*   `htmlGenerator.ts` ha sido actualizado para renderizar los nuevos elementos de la UI.
	*   Se han añadido y refinado los estilos en `styles.css` para soportar la nueva interacción, incluyendo una animación de transición suave para el despliegue.
