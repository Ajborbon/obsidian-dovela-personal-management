---
type: Ax
estado: 🟢
tags:
---
# Análisis de la Experiencia de Usuario (UX) Actual

  La vista actual es funcional, pero sufre de varios problemas comunes en interfaces generadas programáticamente sin un foco de diseño:

   1. Disposición Lineal y Monótona: Todos los controles (selección de tarea, botones del timer) y las estadísticas están apilados verticalmente. Esto crea un "muro de texto y botones" que es difícil de escanear y visualmente poco atractivo.
   2. Falta de Jerarquía Visual: Aparte de los \<h3> y los \<details>, todos los elementos tienen un peso visual similar. El temporizador, que es un elemento de acción clave, no resalta más que un botón de filtro.
   3. Sobrecarga de Información en el Árbol: El árbol de estadísticas mezcla nombres, duraciones y porcentajes en una sola línea de texto. Aunque la información está ahí, es difícil de comparar rápidamente entre filas. El formato (2h 30m) - 15.50% es funcional, pero no escaneable.
   4. Estilo Básico de HTML: La interfaz depende de los estilos por defecto del navegador y Obsidian para elementos como \<button>, \<input> y \<details>, lo que le da un aspecto poco pulido y genérico.
   5. Interacción Clunky: El flujo de "clic en fuente -> buscar -> clic en resultado" para seleccionar una tarea es funcional pero no fluido. La retroalimentación de la selección es débil.
  ---

#   Propuesta de Rediseño UX


  Mi propuesta se basa en transformar la vista de una simple lista de elementos a un dashboard de control y análisis. Lo manejaría dividiendo la  interfaz en componentes claros y aplicando principios de diseño modernos.

##   6. Rediseño Estructural: Layout de Dos Columnas

  En lugar de una sola columna, dividiría la vista en dos secciones principales para separar las acciones del análisis.

   * Columna Izquierda (Panel de Control - 35% del ancho): Dedicada a las acciones del usuario: iniciar/detener el tiempo y seleccionar tareas.
   * Columna Derecha (Panel de Estadísticas - 65% del ancho): Dedicada a la visualización y filtrado de los datos.



   1 +--------------------------------+------------------------------------------------+
   2 | [PANEL DE CONTROL]             | [PANEL DE ESTADÍSTICAS]                        |
   3 |                                |                                                |
   4 |  - Componente de Timer         |  - Controles de Filtro (Hoy, Semana, etc.)     |
   5 |  - Componente de Selección     |  - Vista de Árbol de Tiempos (rediseñada)      |
   6 |    de Tarea                    |                                                |
   7 |                                |                                                |
   8 +--------------------------------+------------------------------------------------+

##   2. Mejoras en el Panel de Control (Columna Izquierda)

  Crearía "tarjetas" (cards) visuales para agrupar la funcionalidad.

   * Tarjeta "Control del Tiempo":
       * Temporizador: Mostrar el 00:00:00 con una fuente grande y prominente. Es el dato más dinámico y debe ser el foco.
       * Botones: Usar iconos claros (ej. Play, Stop, Plus de la librería de iconos de Obsidian) en lugar de emojis. Hacer el botón de "Iniciar" más grande y con un color de acento (el color del tema del usuario).
       * Tarea Activa: Debajo del temporizador, mostrar claramente el nombre de la tarea que se está cronometrando.


   * Tarjeta "Selección de Tarea":
       * Búsqueda Integrada: Un único campo de búsqueda prominente. Los filtros ("Notas Abiertas", "En Progreso") podrían ser botones de tipo "píldora"o un dropdown justo encima o al lado del campo de búsqueda para acotar los resultados.
       * Resultados Claros: Los resultados de la búsqueda deben aparecer de forma limpia debajo del campo, con un ligero sombreado para indicar que es una lista flotante.

  3. Refinar el Panel de Estadísticas (Columna Derecha)

  Aquí es donde la legibilidad es clave.

   * Filtros Mejorados: Agrupar los botones de filtro de fecha ("Hoy", "Semana", etc.) en un "control segmentado" para que ocupen menos espacio y se vean como un único componente.

   * Rediseño del Árbol de Tiempos a una "Tabla Jerárquica":
       * Columnas Definidas: Transformar la lista en una estructura con columnas alineadas. Esto es crucial para la legibilidad.
           * Columna 1: Nombre: Mantiene la estructura de árbol con indentación. Usar iconos de "carpeta" y "archivo" para diferenciar nodos padres de hojas.
           * Columna 2: Duración: El tiempo total (2h 30m).
           * Columna 3: Porcentaje: El valor numérico (15.50%).
       * Visualización Gráfica del Porcentaje: ¡Este es el cambio de mayor impacto! Junto al número del porcentaje, añadir una barra de progreso horizontal. Su longitud representaría visualmente el porcentaje. Esto permite al usuario captar la magnitud de cada ítem de un solo vistazo, sin necesidad de leer el número.

      Ejemplo Visual de una Fila:

   1     └─ 📄 Nombre de la Tarea      2h 30m      15.50% [█████░░░░░░░░░░░]

   * Estilo de Filas: Usar "zebra striping" (filas con colores de fondo alternos y sutiles) para hacer la tabla más fácil de seguir horizontalmente.

  4. Estilo y Consistencia General (CSS)

  Para que todo se vea profesional, aplicaría un CSS consistente:


   * Usar Variables de Obsidian: Utilizar las variables de color del tema del usuario (--background-primary, --text-normal, --interactive-accent, etc.)
     para que la vista se integre perfectamente en modo claro y oscuro.
   * Espaciado Consistente: Aplicar padding y margin de forma regular para que la interfaz "respire" y no se sienta abarrotada.
   * Bordes Redondeados y Sombras Sutiles: Aplicar un border-radius ligero a las tarjetas y botones, y una box-shadow muy sutil a las tarjetas para darles profundidad y separarlas del fondo.

  ---


  En resumen, mi propuesta es evolucionar de una lista funcional a un dashboard interactivo y visualmente informativo. Los cambios clave son el layout
  de dos columnas, la organización en tarjetas, la alineación en columnas de los datos y, sobre todo, la adición de barras de progreso para una
  comprensión visual instantánea.