---
type: Ax
estado: 🟢
tags:
---

> Quiero que vuelvas a actuar como un experto en UX. Ahora vamos a crear una vista en la que podamos ver todas las tareas que están en ejecución. Cuando inicio un día, me gusta elegir algunas tareas con las que voy a estar trabajando ese día. En Obsidian yo puedo cambiar el estado de una tarea, a ser una tarea en ejecución cuando el inicio de la tarea es "- [/]"  . Teniendo en cuenta como estamos ahora mostrando las tareas en la vista del comando Open GTD Dashboard, Boton "Listas GTD" en mi plugin, el uso de los elementos breadcrumb para mostrar la ruta de la nota en la que está la tarea en ejecución, y tambien las prioridades que tienen las tareas, como en la fecha de vencimiento y la prioridad que tienen, quiero que consideres como podriamos generar una vista que permita que un usuario vea muy de una manera muy util y funcional tener la posibilidad de gestionar las tareas que ya estan en estado de ejecución, considerando incluso por ejemplo, si tienen el campo duración activo, "[50min]" poder indicar el tiempo estimado que llevara realizar esas tareas que estan en ejecución. Quiero que me des las ideas de lo que consideras que es posible realizar a nivel funcional y de diseño.     
> 

# Concepto General: El "Centro de Mando" del Día


  El objetivo de esta vista no es solo listar tareas, sino crear un centro de mando enfocado para el trabajo diario. Cuando un usuario marca una tarea
  como [/], está haciendo un compromiso consciente. La interfaz debe honrar ese compromiso eliminando todas las distracciones y proporcionando la
  información justa y necesaria para actuar.


  La vista se llamará "En Progreso" y será una nueva pestaña/botón en la cabecera del GTD Dashboard, junto a "Vista Jerárquica" y "Listas GTD".

  ---


##   Diseño Funcional y Visual de la Vista "En Progreso"


  Al hacer clic en esta nueva pestaña, la vista se estructuraría de la siguiente manera:

###   1. Cabecera de Resumen (El "Dashboard" del Día)


  Justo debajo de los controles de la vista, aparecería una sección de resumen que proporciona una visión instantánea de la carga de trabajo del día.
  Esto es clave para la gestión de expectativas y energía.


   * Tareas en Progreso: Un contador grande y claro. (Ej: 7 Tareas Activas)
   * Tiempo Total Estimado: La suma de todas las duraciones [Xmin] y [Xh] de las tareas activas. Esto es un diferenciador clave y responde directamente
     a tu necesidad.
       * Se mostraría como: Tiempo Estimado: 3h 45min.
       * Las tareas sin duración podrían asumir un valor por defecto (ej. 25min) o simplemente no sumarse, mostrando una nota como "más 3 tareas sin
         estimación".
   * Tareas Vencidas: Un indicador de alerta si alguna de las tareas activas tiene una fecha pasada. (Ej: 🔴 2 Vencidas)


###   2. Estructura y Agrupación de Tareas


  En lugar de una lista plana, las tareas se agruparían automáticamente en secciones lógicas para ayudar a la priorización. El orden de las secciones
  es intencional, de lo más urgente a lo más flexible.


  Sección 1: 🔴 Vencidas
   * Contenido: Tareas en progreso (- [/]) cuya fecha (🛫/⏳/📅) es anterior a hoy.
   * Orden: De la más antigua a la más reciente.
   * Diseño: Cada tarea en esta sección tendría un sutil fondo rojo o un icono de alerta prominente para denotar urgencia.


  Sección 2: 📅 Eventos de Hoy (Calendario)
   * Contenido: Tareas en progreso que tienen fecha de hoy Y una hora de inicio [hI::]. Son citas inamovibles.
   * Orden: Cronológico, por hora de inicio.
   * Diseño: Mostraría la hora de forma destacada. (Ej: 10:00 AM - 11:30 AM Reunión de equipo).


  Sección 3: ⭐ Prioridades de Hoy
   * Contenido: El resto de las tareas en progreso. Esta es la lista principal de trabajo flexible.
   * Orden: Este es el punto clave para la priorización. Se ordenarían por la siguiente jerarquía:
       1. Prioridad explícita: ⏫, 🔼, 🔽, ⏬.
       2. Fecha de entrega: Las tareas con fecha 📅 para hoy irían primero.
       3. Alfabéticamente como último recurso.
   * Diseño: Limpio y enfocado.

###   3. Diseño del Elemento Tarea Individual


  Cada tarea en la lista sería rica en información, pero presentada de forma compacta y escaneable, muy similar a la vista actual pero con énfasis en
  la ejecución.



   1 [ ] ⏫ Revisar la propuesta  del Proyecto Alfa [45min]
   2     └─ 📅 2025-07-06 | @cx-Oficina | @px-Ana
   3       └─ 📂 PGTD 01 > Proyectos > Propuesta Alfa



   * Checkbox: El estado [/] se mostraría como un checkbox estándar [ ] para que el usuario mentalmente lo vea como "pendiente de completar".
   * Prioridad: El emoji de prioridad (⏫) al inicio.
   * Texto de la Tarea: El contenido de la tarea.
   * Duración: Un tag visualmente distintivo, como una píldora de color gris claro: [45min]. Esto permite ver de un vistazo el "costo" de la tarea.
   * Metadata (Línea 2): Una línea secundaria con la fecha de vencimiento, contextos y personas. Menos prominente que el texto de la tarea.
   * Breadcrumb (Línea 3): El breadcrumb que ya te gusta, precedido por un icono de carpeta 📂 para indicar que es una ruta de archivo. Es colapsable
     como en la vista actual.

##   Flujo de Usuario


   1. Planificación: El usuario revisa sus listas GTD y marca las tareas que quiere abordar hoy con - [/].
   2. Ejecución: Abre el GTD Dashboard y va a la pestaña "En Progreso".
   3. Visión General: Inmediatamente ve el resumen: "Ok, tengo 6 tareas, que suman unas 4 horas. Ninguna está vencida. ¡Bien!".
   4. Acción: Elige la primera tarea de la lista de "Prioridades de Hoy", hace clic en ella, y Obsidian lo lleva directamente al archivo y la línea para
      empezar a trabajar.
   5. Finalización: Una vez terminada, la marca como - [x].
   6. Actualización: Vuelve al dashboard, presiona "Refrescar", y la tarea completada desaparece de la vista "En Progreso", actualizando los contadores
      del resumen. El sentimiento de progreso es tangible.


##   Resumen de Beneficios de esta Propuesta


   * Foco Absoluto: Elimina el ruido de las demás listas (Inbox, Proyectos, etc.) durante la ejecución.
   * Gestión del Tiempo Realista: La cabecera de resumen con el tiempo total estimado ayuda a no sobrecomprometerse.
   * Priorización Inteligente: La agrupación automática por urgencia y calendario guía al usuario sobre qué hacer a continuación.
   * Consistencia Visual: Mantiene los elementos que ya funcionan y te gustan (breadcrumbs, diseño general) pero adaptados a un nuevo propósito.
   * Reduce la Carga Cognitiva: El usuario no tiene que pensar dónde está cada cosa; la vista organiza el "ahora" por él.