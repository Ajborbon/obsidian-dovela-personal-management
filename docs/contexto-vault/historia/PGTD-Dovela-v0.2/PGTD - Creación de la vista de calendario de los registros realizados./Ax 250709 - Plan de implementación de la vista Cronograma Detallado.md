---
type: Ax
estado: 🟢
tags:
---
# Análisis Técnico de la Propuesta


  La propuesta es excelente y técnicamente sólida. La arquitectura sugerida (separar la lógica de la vista, las utilidades de color y los servicios de
  datos) es la correcta para mantener el código limpio y escalable. La funcionalidad de arrastrar y soltar es la parte más compleja, pero se puede
  lograr de manera eficiente con los eventos del DOM.

  ---

#   Plan de Implementación Detallado


  Dividiremos el desarrollo en 5 fases lógicas, construyendo la funcionalidad de manera incremental.


##   Fase 1: Andamiaje y Estructura Base


  Objetivo: Crear la estructura de archivos y la navegación básica para que la vista "Cronograma" sea accesible, aunque esté vacía.


   1. Crear Nuevos Archivos:
       * src/modules/moduloGTDv3/timelineView.ts: Crear el archivo con una clase TimelineView básica que, por ahora, solo renderizará un mensaje como
         "Vista de Cronograma en construcción".
       * src/modules/moduloGTDv3/colorUtils.ts: Crear el archivo y añadir una función placeholder generateColorFromString(str: string): string que por
         ahora puede devolver un color fijo.


   2. Modificar `view.ts` (`GtdView`):
       * Añadir 'timeline' al tipo activeView: private activeView: 'hierarchy' | 'gtd' | 'inProgress' | 'time-tracker' | 'timeline' = 'hierarchy';
       * En el método drawView, añadir la lógica para instanciar y mostrar TimelineView cuando this.activeView === 'timeline', similar a como se
         gestiona TimeTrackerView.


   3. Modificar `htmlGenerator.ts`:
       * En la función generateGtdViewHtml, añadir el nuevo botón "Cronograma" en la barra de navegación principal, junto a los demás botones de vistas.


   4. Modificar `styles.css`:
       * Añadir una clase base .timeline-view-container para asegurar que el contenedor principal existe.


##   Fase 2: Lógica de Datos y Servicios


  Objetivo: Preparar el `TimeTrackerService` para que soporte las operaciones de edición y borrado que necesitará la nueva vista.


   1. Modificar `timeTrackerService.ts`:
       * Añadir el método updateLogEntry(logId: string, updatedData: Partial\<TimeLogEntry>): Promise\<void>. Este método:
           * Encontrará el TimeLogEntry en this.plugin.data.timeLogs usando el logId.
           * Fusionará los updatedData con el registro existente.
           * Llamará a this.plugin.savePluginData() para persistir los cambios.
       * Añadir el método deleteLogEntry(logId: string): Promise\<void>. Este método:
           * Filtrará this.plugin.data.timeLogs para eliminar el registro con el logId correspondiente.
           * Llamará a this.plugin.savePluginData().

##   Fase 3: Renderizado Visual (Estático)


  Objetivo: Dibujar el cronograma completo con los datos reales, pero sin ninguna interactividad.


   2. Implementar `colorUtils.ts`:
       * Desarrollar la lógica de la función generateColorFromString para que genere un color HSL consistente y agradable a partir de una cadena (la
         ruta de la carpeta raíz). Esto asegura que los colores sean visualmente distintos pero armónicos.


   3. Desarrollar `timelineView.ts`:
       * Crear el método render().
       * Dentro de render(), añadir la lógica para:
           * Obtener los registros de this.plugin.data.timeLogs.
           * Generar la estructura HTML de la parrilla (eje de tiempo vertical, columnas de días horizontales) usando CSS Grid.
           * Filtrar los registros que caen en el rango de fechas visible.
           * Para cada registro, calcular su posición (top, grid-column) y altura (height) basándose en su hora de inicio y duración.
           * Crear un div para cada bloque, asignarle la clase, el color de fondo (usando colorUtils), la posición y el contenido (nombre de la nota y
             descripción).
           * Añadir los controles de navegación (Hoy, flechas, selector de vista) a la parte superior.


   4. Actualizar `styles.css`:
       * Añadir todo el CSS necesario para estilizar la parrilla, los ejes, los encabezados de día y los bloques de actividad. Definir el aspecto base
         de los bloques.


##   Fase 4: Implementación de la Interacción del Usuario


  Objetivo: Dar vida a la vista, implementando la edición y creación de registros.


   5. Navegación Temporal:
       * En timelineView.ts, añadir los event listeners a los botones de navegación (Hoy, ◄, ►, Día, 3 Días, Semana). Cada clic deberá actualizar el
         estado de la vista (ej. la fecha visible) y llamar de nuevo a render().


   6. Modal de Edición (`TimeLogModal`):
       * Modificar el constructor de TimeLogModal para que acepte un TimeLogEntry opcional.
       * Si se proporciona un registro, el modal se abrirá en "modo edición":
           * Pre-rellenará los campos de fecha, hora y descripción.
           * El botón "Guardar" llamará a timeTrackerService.updateLogEntry.
           * Se mostrará un botón "Eliminar", que al ser presionado (con confirmación), llamará a timeTrackerService.deleteLogEntry.


   7. Interacción de Clic:
       * En timelineView.ts, al renderizar cada bloque, añadirle un onClickEvent que instancie TimeLogModal en modo edición, pasándole los datos de ese
         bloque.


   8. Interacción de Arrastrar y Soltar (Drag \& Drop):
       * En timelineView.ts, añadir event listeners (mousedown, mousemove, mouseup) a los bloques de actividad.
       * Mover: En mousedown, registrar la posición inicial. En mousemove, actualizar la posición del bloque en tiempo real. En mouseup, calcular la
         nueva startTime y endTime y llamar a updateLogEntry.
       * Redimensionar: Añadir un "handle" (un pequeño div) en la parte inferior de cada bloque. Aplicar los mismos eventos de mousedown, mousemove,
         mouseup a este handle para modificar la altura del bloque y, por ende, su durationMinutes y endTime.


   9. Creación Rápida:
       * Añadir un event listener de mousedown al contenedor de la parrilla. Si el evento no se origina en un bloque existente, iniciar una lógica de
         selección. Al soltar (mouseup), abrir el TimeLogModal con las horas de inicio y fin pre-rellenadas según el área seleccionada.

##   Fase 5: Pulido Final y Estilos


  Objetivo: Refinar la experiencia de usuario con feedback visual y un diseño pulcro.


   10. Actualizar `styles.css`:
       * Añadir estilos para el feedback visual durante el arrastre (ej. el bloque se vuelve semitransparente).
       * Estilizar los tooltips que aparecen al hacer hover.
       * Asegurar que los controles, modales y la parrilla se vean bien y sean consistentes con el resto del plugin.
       * Añadir transiciones suaves para una experiencia más fluida.