---
type: Ax
estado: 🟢
tags:
---

# Propuesta de UX/UI: La Vista "Cronograma"

  El objetivo es crear una vista que se sienta viva, intuitiva y, sobre todo, útil.


##   1. Diseño y Componentes Visuales


  La interfaz será limpia y funcional, dividida en una barra de control y el área del cronograma.


   * Botón de Acceso: Un nuevo botón "Cronograma" en la barra principal, con un icono claro como 📅 o 🗓️.
   * Barra de Controles del Cronograma:
       * Navegación Temporal:
           * Un botón "Hoy" para volver instantáneamente al día actual.
           * Flechas ◄ Anterior y Siguiente ► para moverse entre períodos.
           * Un título central grande que muestra el rango de fechas actual (ej. "9 de Julio, 2025" o "9 - 11 de Julio, 2025"). Al hacer clic, se
             despliega un mini-calendario para una navegación rápida a cualquier fecha.
       * Selector de Rango:
           * Botones para cambiar la vista: `Día`, `3 Días`, `Semana`. La vista de "Día" será la predeterminada.


   * El Cronograma (La Parrilla):
       * Eje de Tiempo (Vertical): Una columna fija a la izquierda mostrará las horas del día (ej. 8 AM, 9 AM, 10 AM...).
       * Columnas de Días (Horizontal): El área principal se dividirá en columnas, una para cada día visible. Cada columna tendrá un encabezado claro
         (ej. "Mié 9", "Jue 10").
       * Bloques de Actividad: Cada registro de tiempo será un bloque visual.
           * Contenido: Mostrará el nombre de la nota/proyecto en negrita y la descripción de la tarea debajo.
           * Color Dinámico (Tu Requisito): Cada bloque tendrá un color de fondo sutil y único basado en su carpeta raíz. Crearé una función que genera
             un color consistente a partir del nombre de la carpeta (ej. "01 - Productividad" siempre será azul, "04 - Finanzas" siempre será verde,
             etc.). Esto crea un mapa de calor visual de tus áreas de enfoque.
           * Interacción al Pasar el Ratón: Al hacer hover sobre un bloque, se mostrará un tooltip con la hora exacta de inicio/fin, la duración y las
             notas completas.

##   2. Interacción y Edición (El Flujo de Trabajo)


   * Clic para Editar (Modal Inteligente):
       * Al hacer clic en un bloque, se abrirá un modal de edición (TimeLogModal adaptado).
       * Este modal permitirá editar la hora de inicio/fin con campos de texto o selectores de tiempo, y modificar la descripción.
       * Mejora UX: El modal también mostrará un botón "Eliminar Registro" para una gestión completa.


   * Creación Rápida de Registros:
       * ¿Ves un hueco en tu día? Haz clic y arrastra en un espacio vacío. Al soltar, se abrirá el modal de registro con las horas de inicio y fin ya
         pre-rellenadas según el área que seleccionaste.


   * Arrastrar y Soltar (Drag & Drop):
       * Mover: Arrastra un bloque verticalmente para cambiar su hora de inicio.
       * Redimensionar: Arrastra el borde inferior de un bloque para ajustar su duración.
       * Feedback Visual: Mientras arrastras o redimensionas, el bloque mostrará la nueva hora/duración en tiempo real. Al soltar, el cambio se guarda
         automáticamente.

##   Plan de Implementación y Arquitectura


  Para mantener el código limpio, modular y escalable, seguiremos esta estructura:


   1. Nuevos Archivos:
       * src/modules/moduloGTDv3/timelineView.ts: La clase principal que gestionará la lógica, el renderizado y los eventos de la vista "Cronograma".
       * src/modules/moduloGTDv3/colorUtils.ts: Un archivo de utilidades con una función pura para generar colores dinámicos a partir de un string (el
         nombre de la carpeta raíz). Esto mantiene la lógica de colores separada y reutilizable.


   2. Modificaciones a Archivos Existentes:
       * view.ts: Se actualizará para reconocer y poder cambiar a la nueva vista "timeline".
       * htmlGenerator.ts: Se modificará para añadir el botón "Cronograma" en la barra de navegación principal.
       * timeTrackerService.ts: Se le añadirá un método updateLogEntry(id, newData) para que la edición (vía modal o drag-and-drop) pueda guardar los
         cambios en timelogs.json.
       * styles.css: Se añadirán todas las nuevas clases CSS para estilizar la parrilla, los controles, los bloques de tiempo, los colores, las
         animaciones de arrastre, etc.


   3. Pasos de Desarrollo:
       1. Andamiaje: Crear los nuevos archivos y realizar las modificaciones básicas en los existentes para que la nueva vista sea accesible.
       2. Lógica de Colores: Implementar la utilidad de generación de colores.
       3. Renderizado Estático: Dibujar la parrilla del cronograma (ejes de tiempo y días) y los bloques de actividad en su posición correcta, con sus
          colores correspondientes, pero sin interacción.
       4. Interacción (Modal): Implementar la funcionalidad de clic para abrir el modal de edición.
       5. Interacción (Drag & Drop): Añadir la lógica de arrastrar y soltar para mover y redimensionar los bloques.
       6. Estilizado Final: Pulir todos los aspectos visuales en styles.css.


  Esta propuesta crea una herramienta de nivel profesional, altamente interactiva y visualmente informativa, que te dará un control sin precedentes sobre el análisis de tu tiempo.