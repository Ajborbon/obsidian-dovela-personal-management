---
type: Cmt
commit: 6fabf40
branch: feat/mejoras-varias
tagVersion: 
estado: 🟢
tags:
---

# feat(stats): Añadir Mapa de Calor de Actividad al Selector de Fechas

Se mejora la experiencia de usuario en la vista de **Estadísticas** al implementar un **mapa de calor** en el calendario del selector de fechas.

Esta funcionalidad ofrece una referencia visual inmediata de los días que contienen registros de tiempo, permitiendo identificar y seleccionar períodos de actividad de forma más **rápida** e **intuitiva**.

---

## Cambios Técnicos

- Modificación de `DatePickerModal.ts` para aceptar y renderizar un `activityMap`, aplicando clases CSS (`activity-low`, `activity-medium`, `activity-high`) a las celdas de los días con registros.
- Implementación en `statisticsView.ts` de la lógica para calcular el número de registros por día.
- Generación del mapa de calor a partir de todos los registros de tiempo existentes y envío de este al `DatePickerModal` en el momento de su apertura.
