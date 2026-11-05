---
type: Ax
estado: 🟢
tags:
---
## Plan de Implementación para las Nuevas Reglas GTD

###   Fase 1: Fortalecer el Modelo de Datos y el Parser

  Objetivo: Asegurar que podamos leer y representar toda la información necesaria, incluyendo la detección de errores en las tareas.


   1. Actualizar el Modelo de Datos (`model.ts`):
       * Añadiremos un nuevo campo opcional a la interfaz Task, llamado hasConflict: boolean. Este campo se usará para marcar tareas que tienen
         inconsistencias (ej. hora final anterior a la inicial) y deben ser revisadas en la "Bandeja de Entrada".


   2. Implementar Detección de Conflictos (`parser.ts`):
       * Modificaremos la función parseTasks para que valide las tareas mientras las lee.
       * Implementaremos la lógica para detectar inconsistencias temporales (duración vs. horas de inicio/fin) y otros formatos incorrectos.
       * Si se detecta un conflicto, la propiedad hasConflict de la tarea se establecerá en true.

###   Fase 2: Reconstruir el Motor de Clasificación GTD

  Objetivo: Reemplazar la lógica de clasificación actual con el nuevo conjunto de reglas, respetando el orden de prioridad y los nuevos criterios.


   1. Reescribir `processGtdLists` (`gtdProcessor.ts`):
       * Eliminaremos la lógica de clasificación actual y la reconstruiremos desde cero siguiendo el orden exacto de las 9 reglas que definiste.
       * La estructura será una cadena de if / else if que asigne cada tarea a la primera lista que cumpla los criterios.
       * Añadiremos una nueva lista Vencidas para manejar las tareas de "Ojalá Hoy" que no se completaron a tiempo.
       * Implementaremos la lógica para que una tarea pueda aparecer en más de una lista si las reglas lo requieren (específicamente para tareas que
         deben estar en "Ojalá Hoy" y también en "Inbox").


   2. Crear Funciones de Ayuda para Fechas:
       * Crearemos un conjunto de funciones robustas para comparar fechas (isPast, isToday, isFuture) que serán utilizadas por el motor de clasificación
         para manejar correctamente las tareas vencidas, presentes y futuras.

###   Fase 3: Adaptar la Interfaz de Usuario (UI)


  Objetivo: Modificar la vista para que refleje la nueva estructura de datos y las nuevas capacidades de agrupación.


   1. Actualizar el Generador de HTML (`htmlGenerator.ts`):
       * Modificaremos renderGtdListsView para que pueda manejar la nueva lista "Vencidas".
       * Implementaremos la agrupación de tareas dentro de la lista "Ojalá Hoy". Las tareas se anidarán bajo sub-encabezados según su contexto o la
         persona asignada.
       * Añadiremos una lógica de ordenamiento para dar prioridad visual a las tareas con 📅 sobre las que tienen ⏳ dentro de la lista "Ojalá Hoy".