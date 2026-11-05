---
type: Ax
estado: 🟢
tags:
---
>Bueno, me gustaria ahora tener una vista tipo calendario en la que pueda ver las actividades que he registrado. Una vista similar a la vista de calendario de outlook, por ejemplo, en la que pueda ver los bloques de las tareas registradas a lo largo del día. Me gustaria tener, un calendario en el que pueda elegir el día que voy a elegir, y poder elegir que en el render se vea 1 dia, 3 dias o la semana completa. Esta vista quiero que se invoque desde un boton nuevo, al nivel de los botones "En Progreso", "Time Tracker" y los demas. Tambien me gustaría que al hacer click en alguna tarea, yo pueda editar los datos de la hora de inicio o finalización de esa tarea, o modificar el detalle que escribi de la tarea. Quiero que actues como UX especializado y me hagas una propuesta que sea muy util y practica para el usuario. 


# Propuesta de UX: La Vista de "Cronograma"

  En lugar de llamarla "Calendario", que puede confundirse con eventos futuros, la llamaremos "Cronograma", ya que su propósito es visualizar el
  tiempo ya registrado.


##   1. Diseño General y Controles


  La interfaz se dividirá en dos áreas principales: los controles de navegación y el cronograma en sí.


   * Nuevo Botón Principal: Se añadirá un botón "Cronograma" junto a "Time Tracker" para acceder a esta nueva vista.
   * Controles de Navegación (Barra Superior):
       * Navegación de Fecha: Un botón "Hoy" para volver rápidamente al día actual. Flechas ◄ y ► para moverse al día/período anterior o siguiente. El
         nombre del mes y año actual (ej. "Julio 2025") será visible y al hacerle clic, se abrirá un mini-calendario para saltar a cualquier fecha.
       * Selector de Vista: Botones claros para cambiar entre "Día", "3 Días" y "Semana". La vista "Día" será la predeterminada.


##   2. El Cronograma Visual

  Esta es la parte central y la diseñaremos para que sea rica en información pero fácil de escanear.


   * Eje de Tiempo (Vertical): Una columna a la izquierda mostrará las horas del día (ej. de 7:00 a 22:00). Esto proporciona un anclaje visual
     inmediato.
   * Eje de Días (Horizontal): La parte superior mostrará las columnas para cada día en la vista seleccionada (ej. "Miércoles 9", "Jueves 10", etc.).
   * Bloques de Actividad:
       * Contenido: Cada bloque mostrará la información esencial:
           1. Nombre del Proyecto/Nota (en negrita): Para identificar rápidamente el contexto principal.
           2. Descripción de la Tarea: El detalle específico del registro.
           3. Duración: (ej. "45m" o "1h 30m").
       * Código de Color (¡Mejora Clave!): Para una identificación visual instantánea, los bloques se colorearán sutilmente según la carpeta raíz del
         proyecto (ej. "01 - Productividad" en azul, "04 - Finanzas" en verde). Esto permite ver patrones de un solo vistazo.
       * Indicador de Notas: Si un registro tiene notas detalladas, se mostrará un pequeño icono 📝 en la esquina del bloque. Al pasar el ratón por
         encima, un tooltip mostrará las notas completas.


##   3. Interacción Inteligente (La Magia de la UX)

  Aquí es donde la vista pasa de ser informativa a ser una herramienta de trabajo productiva.


   * Clic para Editar (Tu Solicitud): Al hacer clic en un bloque, se abrirá un modal de edición (una versión adaptada del TimeLogModal que ya existe).
     Este modal permitirá:
       * Editar la hora de inicio y fin con campos de texto.
       * Modificar la descripción/notas del registro.
       * Cambiar la tarea asociada (si es necesario).


   * ¡Propuesta de Mejora: Edición por Arrastrar y Soltar!
       * Mover (Arrastrar): ¿Registraste una tarea a las 10:00 pero en realidad fue a las 11:00? Simplemente arrastra el bloque a la nueva hora. La duración se mantiene, solo cambia el inicio/fin.
       * Ajustar Duración (Redimensionar): ¿Olvidaste parar el temporizador? Simplemente toma el borde inferior del bloque y arrástralo hacia arriba para acortar la duración. Lo mismo para alargarla.


   * Crear Nuevos Registros: ¿Ves un hueco en tu día que olvidaste registrar? Haz clic y arrastra en un espacio vacío del cronograma. Al soltar, se
     abrirá el modal de registro con las horas de inicio y fin ya pre-rellenadas.

##   Plan de Implementación Técnico

   1. Crear el Nuevo Componente:
       * Crear src/modules/moduloGTDv3/timelineView.ts. Esta clase será responsable de toda la lógica de renderizado y manejo de eventos de la vista de cronograma.


   2. Integrar la Nueva Vista:
       * En view.ts, añadir "timeline" como una nueva activeView posible.
       * En htmlGenerator.ts, añadir el botón "Cronograma" a la barra de controles principal.


   3. Renderizar el Cronograma:
       * La TimelineView obtendrá los registros de TimeTrackerService para el rango de fechas seleccionado.
       * Se generará la parrilla del calendario usando CSS Grid. Es perfecto para este tipo de layout.
       * Cada registro se convertirá en un div (un bloque). Su posición y altura se calcularán con JavaScript:
           * top = (hora_inicio - hora_minima_vista) * altura_por_minuto
           * height = duracion_en_minutos * altura_por_minuto
       * Se asignarán clases CSS para el código de color basado en la ruta del archivo.


   4. Implementar la Interacción:
       * Clic: Se añadirá un onClickEvent a cada bloque que instanciará y abrirá el TimeLogModal con los datos de ese registro.
       * Arrastrar y Soltar: Se usarán los eventos mousedown, mousemove y mouseup en los bloques para implementar la lógica de arrastre y redimensión.
         Al soltar (mouseup), se calcularán las nuevas horas y se llamará a un método en TimeTrackerService para actualizar el registro en
         timelogs.json.


  Esta propuesta crea una herramienta visual, intuitiva y potente que no solo permite ver, sino también gestionar y corregir el tiempo registrado de
  una forma increíblemente eficiente.