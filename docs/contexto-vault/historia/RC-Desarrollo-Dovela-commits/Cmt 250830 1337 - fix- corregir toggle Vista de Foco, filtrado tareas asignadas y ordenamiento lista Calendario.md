---
type: Cmt
commit: cb4495a
branch: feat/mejoras-varias
tagVersion:
estado: 🟢
tags:
---

Este commit corrige tres problemas funcionales específicos identificados en testing:


### CORRECCIÓN TOGGLE VENCIDAS EN VISTA DE FOCO:

- Solucionado bug donde toggle de organización se revertía inmediatamente tras click

- Agregado parámetro overdueGroupingMode a generateGtdViewHtml en focoHtmlGenerator

- Implementada propagación correcta del estado desde focoView hasta renderizado HTML

- Ahora funciona idénticamente al toggle en GTD Dashboard

  

### CORRECCIÓN FILTRADO DE TAREAS ASIGNADAS:

- Eliminada duplicación incorrecta: tareas con px- pero sin cx- ya no aparecen en "Próximas Acciones > Sin Contexto"

- Estas tareas ahora aparecen únicamente en "Asignadas o Delegadas" como corresponde según metodología GTD

- Agregada validación && !hasAssigned en condición de clasificación de NextActions

- Aplicado en ambos procesadores (GTD y Foco) para consistencia total

  

### MEJORA LISTA CALENDARIO:

- Expandida para mostrar TODAS las tareas con isDueDate + startTime (no solo las de hoy)

- Mantenida funcionalidad "📅 Agenda de Hoy" solo para tareas de fecha actual

- Implementado ordenamiento automático: fecha primero (antiguas primero), luego por hora de inicio

- Creadas variables separadas: isCalendarItem (todas) vs isCalendarToday (solo hoy)

  

### FUNCIONES TÉCNICAS AGREGADAS:

- sortCalendarTasks(): ordenamiento cronológico inteligente con fallbacks

- Separación lógica isCalendarItem vs isCalendarToday para casos de uso específicos

- Logging de debug para monitoreo de ordenamiento

  

### ARCHIVOS MODIFICADOS:

- focoView.ts: Propagación parámetro overdueGroupingMode

- focoHtmlGenerator.ts: Renderizado dinámico toggle y ordenamiento

- gtdProcessor.ts: Lógica filtrado y función sortCalendarTasks

- focoProcessor.ts: Aplicación cambios paralelos para consistencia

  

Resultado: UX mejorada con clasificación GTD correcta y organización cronológica  

Compilación TypeScript: ✅ Sin errores
