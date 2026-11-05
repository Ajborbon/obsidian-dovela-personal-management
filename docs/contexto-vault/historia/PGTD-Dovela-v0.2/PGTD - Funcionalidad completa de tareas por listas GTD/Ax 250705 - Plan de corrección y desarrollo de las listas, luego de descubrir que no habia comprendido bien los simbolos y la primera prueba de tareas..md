---
type: Ax
estado: 🟢
tags:
---
# Plan de Corrección y Desarrollo

  
##   Fase 1: Análisis y Preparación (El Fundamento)


  El error principal es que el parser actual extrae la fecha, pero ignora el símbolo que la precede. Sin esa información, el gtdProcessor no puede
  tomar decisiones correctas. Necesitamos arreglar esto primero.


   * Paso 1.1: Leer las Reglas Definitivas.
       * Leeré el archivo .../Ax 250705 - Reglas y estructura de las listas de Tareas GTD de Dovela.md para internalizar la lógica exacta, prestando especial atención a qué símbolo (📅, ⏳, ✈️, etc.) corresponde a cada lista.

   * Paso 1.2: Enriquecer el Modelo de Datos y el Parser.
       1. Modificar `model.ts`: Actualizaré la interfaz Task para que pueda almacenar no solo la fecha, sino también el tipo de fecha (ej. startDate,
          dueDate, scheduledDate) basándome en el símbolo encontrado.
       2. Modificar `parser.ts`: Ajustaré la expresión regular en la función parseTasks para que capture el símbolo (📅, ⏳, ✈️) junto con la fecha. La tarea se guardará con esta nueva información.

##   Fase 2: Reescritura del Motor de Clasificación (La Lógica)

  Con el modelo de datos corregido, reescribiré el motor de clasificación desde cero para que sea un reflejo fiel de las reglas.

   * Paso 2.1: Reescribir `processGtdLists` en `gtdProcessor.ts`.
       * Eliminaré la lógica actual.
       * Implementaré una nueva cadena de if / else if que siga el orden de prioridad exacto de las 9 reglas del documento.
       * Correcciones clave a implementar:
           * Regla "En Pausa": Se activará únicamente por una fecha futura precedida del símbolo de avión (✈️), por una dependencia (⛔) o por una
             semana futura ([w::]). Las tareas con 📅 y ⏳ para fechas futuras ya no irán aquí.
           * Regla "Calendario": Se activará con 📅 + [hI::]. Esto hará que la lista aparezca correctamente.
           * Regla "Vencidas": Crearé esta lista explícitamente. Contendrá tareas con 📅 o ⏳ en fechas pasadas que tengan contexto o asignación.
           * Regla "Ojalá Hoy": Contendrá tareas con 📅 o ⏳ para la fecha de hoy y sin hora de inicio.
           * Regla "Inbox": Se ajustará su lógica para capturar correctamente las tareas vencidas sin contexto ni asignación y otros casos mal formados.

  
##   Fase 3: Ajuste de la Interfaz de Usuario (La Presentación)


   * Paso 3.1: Actualizar `htmlGenerator.ts`.
       1. Aseguraré que las listas "Calendario" y "Vencidas" se rendericen en el orden correcto.
       2. Dentro de la lista "Asignadas o Delegadas", añadiré una sub-agrupación o un indicador visual para las tareas que estén vencidas, como
          solicitaste.
       3. Verificaré que la agrupación y el ordenamiento en "Ojalá Hoy" funcionen como se espera.

##   Fase 4: Verificación


   * Paso 4.1: Prueba con el Caso de Uso.
       * Una vez implementados los cambios, usaré tu lista de 24 tareas como caso de prueba para verificar que cada una cae en la lista correcta según
         las reglas del documento.
   * Paso 4.2: Compilación Final.
       * Ejecutaré pnpm build para asegurar que no hay errores de compilación.

  ---