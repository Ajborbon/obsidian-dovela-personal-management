---
type: Cmt
commit: 05c2a8f
branch: feature/timeline-view
tagVersion: 
estado: 🟢
tags:
---

  Descripción:


  Este commit introduce una serie de mejoras significativas en la usabilidad y la apariencia de la vista de "Cronograma", transformándola en una
  herramienta de planificación más robusta, intuitiva y estéticamente agradable.

  Mejoras Clave:


   - Paleta de Colores Curada: Se reemplaza la generación algorítmica de colores por una paleta predefinida y armoniosa. Se introducen variaciones
     sutiles de luminosidad para diferenciar proyectos que comparten un color base, garantizando coherencia visual y escalabilidad.


   - Divulgación Progresiva de Información:
     - Los bloques ahora solo muestran el nombre del proyecto para una vista más limpia.
     - Un tooltip enriquecido aparece al pasar el cursor, mostrando detalles completos (Proyecto, Tarea, Notas, Periodo).


   - Manejo de Eventos Multi-Día:
     - Los eventos que abarcan varios días ahora se segmentan visualmente en cada día correspondiente.
     - Se utilizan indicadores visuales (bordes afilados) para mostrar la continuidad del evento.
     - El resaltado al pasar el cursor se aplica a todos los segmentos del mismo evento de forma unificada.


   - Copia de Bloques con `Alt` + Arrastrar:
     - Se implementa la capacidad de duplicar un bloque de tiempo manteniendo presionada la tecla Alt mientras se arrastra.
     - El cursor cambia para proporcionar retroalimentación visual clara de la acción de copia.


   - Correcciones de Interfaz:
     - Se implementa una cabecera de días fija ("sticky") para que el contexto del día nunca se pierda al hacer scroll vertical.
     - Se elimina una línea de borde sobrante al final de la parrilla de horas para un acabado más pulcro.
     - Se corrige un bug que impedía la correcta actualización visual al eliminar un bloque duplicado.
     
