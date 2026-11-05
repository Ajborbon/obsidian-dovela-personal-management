---
type: Cmt
commit: d5c136e
branch: feat/mejoras-varias
tagVersion: 
estado: 🟢
tags:
---

# Mejoras en la Vista de Cronograma (Timeline)

Se implementan varias mejoras para optimizar la **usabilidad** y la **densidad de la información** en la vista de Cronograma.

---

## Cambios Principales

1. **Control de Zoom (+/-)**  
   - Nuevo control que permite ajustar la altura de las horas de **1x a 4x**, haciendo que los bloques de eventos se escalen dinámicamente.

2. **Ocultamiento Progresivo de Contenido**  
   - El contenido de los bloques de eventos ahora se oculta progresivamente a medida que disminuye la altura del bloque.  
   - Se prioriza mostrar:
     - El nombre del proyecto.  
     - La duración.

3. **Mejora en Tooltips**  
   - El *tooltip* de los eventos ahora incluye la **duración total del registro** (ejemplo: `1 h 30 min`) para referencia rápida.

4. **Optimización del Texto en Bloques**  
   - No se muestran etiquetas.  
   - La descripción de la tarea se oculta si es redundante con el proyecto.  
   - La duración se muestra directamente en el bloque.
