---
type: Ax
estado: 🟢
tags:
---
El sistema actual ya cumple con varias de las bases (como la clasificación por contextos, dependencias o tags específicos como #GTD-AlgunDia), pero para alcanzar la funcionalidad que describes, hacen falta las siguientes capacidades y modificaciones.

  Aquí está el listado de las funcionalidades que faltan por cubrir:

  1. Lógica de Clasificación y Resolución de Conflictos en la "Bandeja de Entrada"

  La "Bandeja de Entrada" (Inbox) necesita una lógica más sofisticada para actuar como un verdadero centro de "elementos que requieren revisión".

   * Falta Detección de Conflictos: El parser actual no valida inconsistencias. Se debe implementar lógica para detectar y enviar a la Inbox tareas con:
       * Hora final ([hF::]) anterior a la hora de inicio ([hI::]).
       * Una duración ([Xmin] o [Xh]) que no coincide con el intervalo entre la hora de inicio y la hora final.
   * Falta Manejo de Formatos Incorrectos: No hay un sistema que capture tareas con fechas o sintaxis mal formadas para enviarlas a la Inbox.
   * Falta Regla para Semanas Pasadas: No existe una regla que mueva a la Inbox una tarea cuya semana de planificación ([w::]) ya pasó y no tiene un contexto o asignación para ser movida a "Próximas Acciones".

  2. Manejo Avanzado de Fechas (Pasadas y Futuras)

  El sistema actual se centra principalmente en fechas futuras (isDateInFuture) y la fecha de hoy (isDateToday), pero carece de la lógica para manejar tareas vencidas o transiciones automáticas.

   * Falta Sección de "Tareas Vencidas": En la lista "Ojalá Hoy", no existe el concepto de una sección separada para tareas de fechas pasadas que están vencidas. Actualmente, simplemente no aparecerían o caerían en otra categoría de forma no intencionada.
   * Falta Transición Automática por Fecha: El sistema no "mueve" tareas automáticamente. Por ejemplo, una tarea "En Pausa" porque su fecha 📅 era futura no transita a "Próximas Acciones" o "Inbox" cuando esa fecha llega. El estado se recalcula cada vez, pero no sigue la lógica de transición explícita que defines.

  3. Duplicidad de Tareas en Múltiples Listas
   * Falta Capacidad de Duplicación: La regla de "Ojalá Hoy" que especifica que "las tareas de fechas de actual o pasadas sin contexto o asignación se muestran en este listado pero también se muestran en Inbox" es una funcionalidad inexistente. El modelo actual asume que una tarea pertenece a una y solo una lista GTD a la vez. Implementar esto requiere un cambio fundamental en el modelo de datos y en la lógica de renderizado.

  3. Funcionalidades de Interfaz de Usuario (UI)

   * Falta Agrupación dentro de Listas: La lista "Ojalá Hoy" requiere que las tareas se agrupen por contexto y/o persona asignada. El htmlGenerator actual renderiza una lista plana de tareas dentro de cada categoría GTD, sin un segundo nivel de agrupación.
   * Falta Priorización Visual entre `📅` y `⏳`: No hay una distinción visual o de ordenamiento en "Ojalá Hoy" que dé mayor prioridad a las tareas con 📅 sobre las que tienen ⏳.

  5. Capacidades Avanzadas: Alertas y Lógica de Duración

   * Falta Sistema de Alertas: La regla de "Asignadas o Delegadas" que requiere una alerta cuando el plazo de una tarea con dependientes termina es una capacidad avanzada que no existe. El plugin no tiene un sistema de monitoreo o notificaciones.
   * Falta Duración por Defecto en Calendario: No se asigna una duración por defecto de 30 minutos a las tareas del "Calendario" que tienen hora de inicio pero no tienen hora final ni duración explícita.


  En resumen, para cumplir con los nuevos requisitos, el gtdProcessor.ts necesita una refactorización significativa para adoptar el nuevo orden de reglas y la lógica de manejo de fechas pasadas. El parser.ts debe ser extendido para incluir la validación de conflictos. Finalmente, el htmlGenerator.ts y el modelo de datos (model.ts) necesitarían ser modificados para soportar la agrupación de tareas y la posible duplicación de tareas en distintas listas.