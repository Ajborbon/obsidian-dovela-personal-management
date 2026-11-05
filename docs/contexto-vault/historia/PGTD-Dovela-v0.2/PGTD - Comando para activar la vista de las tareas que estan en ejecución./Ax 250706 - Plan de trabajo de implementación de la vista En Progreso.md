---
type: Ax
estado: 🟢
tags:
---
# Plan de Trabajo: Implementación de la Vista "En Progreso"


  El plan se divide en tres fases principales, asegurando que cada paso se construya sobre una base sólida y probada.

  ---


##   Fase 1: Extender el Modelo de Datos y el Análisis (El Fundamento)


  El objetivo de esta fase es que nuestro sistema reconozca y entienda el nuevo estado de tarea [/] sin alterar el procesamiento de los estados
  existentes.


   1. Actualizar el Modelo de Datos (`src/modules/moduloGTDv3/model.ts`):
       * Acción: Modificaremos la interfaz Task. Añadiremos un nuevo campo status para representar explícitamente los tres estados posibles.
Detalle:

```ts
export type TaskStatus = 'incomplete' | 'completed' | 'in-progress';

export interface Task {
 // ... campos existentes ...
status: TaskStatus; // Nuevo campo
completed: boolean; // Mantenemos este por retrocompatibilidad
duration?: string; // Asegurarnos de que este campo ya existe
}
```

* Justificación: Tener un campo status es más explícito y escalable que depender solo del booleano completed. Mantenemos completed para no romper
ninguna lógica existente que dependa de él.

2. Actualizar el Analizador de Tareas (`src/modules/moduloGTDv3/parser.ts`):
   * Acción: Modificaremos la función parseTasks para que reconozca el estado [/].
   * Detalle:
	   * Actualizaremos la expresión regular taskRegex para que capture x, X, espacio en blanco, y ahora también /.
		   * const taskRegex = /^\s*-\s+\[( |x|X|\/)\]\s+(.*)/;
	   * Dentro del bucle, al procesar match[1], asignaremos el status y el completed correspondientes:
		   * Si es   (espacio), status será 'incomplete' y completed será false.
		   * Si es x o X, status será 'completed' y completed será true.
		   * Si es /, status será 'in-progress' y completed será false.
	   * También nos aseguraremos de que la lógica que extrae la duración (\[(\d+(min|h))\]) esté funcionando como se espera y se asigne al campo
		 task.duration.
   * Impacto: Mínimo. Esta función es el punto de entrada. Al hacer este cambio aquí, todo el sistema tendrá acceso a la información del nuevo
	 estado sin necesidad de modificar otras partes que consumen los datos.

  ---

##   Fase 2: Lógica de Procesamiento para la Nueva Vista (El Cerebro)


  Ahora que tenemos los datos, crearemos la lógica para agruparlos y calcular las estadísticas de la vista "En Progreso".


   3. Crear un Nuevo Módulo de Procesamiento (`src/modules/moduloGTDv3/inProgressProcessor.ts`):
       * Acción: Crearemos un nuevo archivo para albergar la lógica específica de esta vista. Esto evita sobrecargar gtdProcessor.ts y mantiene el
         código limpio.
       * Detalle:
           * Crearemos una función processInProgressTasks(tasks: Task[]).
           * Esta función primero filtrará todas las tareas para quedarse solo con las que tengan status === 'in-progress'.
           * Luego, implementará la lógica de agrupación: creará tres listas separadas (vencidas, eventosHoy, prioridadesHoy) basándose en las reglas
             que definimos (fechas, hI::, etc.).
           * Implementará la lógica de ordenamiento para cada una de esas listas.
           * Calculará las estadísticas del resumen: conteo total, conteo de vencidas y suma de duraciones. Para la duración, creará una función
             auxiliar que parsee [30min] o [1.5h] a un número de minutos para poder sumarlos.
           * La función devolverá un objeto estructurado, por ejemplo InProgressData, que contenga las tres listas de tareas ordenadas y las
             estadísticas del resumen.
       * Justificación: Aislar esta lógica nos da un control total sobre la nueva vista sin riesgo de afectar el procesamiento de las listas GTD
         existentes.

  ---

##   Fase 3: Implementación de la Interfaz de Usuario (La Cara Visible)

  Con los datos procesados y listos, construiremos la representación visual.


   4. Actualizar el Componente Principal de la Vista (`src/modules/moduloGTDv3/view.ts`):
       * Acción: Integraremos la nueva vista en el flujo de control principal.
       * Detalle:
           * Añadiremos 'inProgress' al tipo de la propiedad activeView: private activeView: 'hierarchy' | 'gtd' | 'inProgress' = 'hierarchy';.
           * En la función drawView, añadiremos una nueva condición. Si this.activeView === 'inProgress', llamaremos a nuestro nuevo
             processInProgressTasks y luego pasaremos el resultado a una nueva función de renderizado en htmlGenerator.ts.
       * Impacto: Cambio controlado y localizado.


   5. Actualizar el Generador de HTML (`src/modules/moduloGTDv3/htmlGenerator.ts`):
       * Acción: Aquí es donde crearemos el HTML de la nueva vista.
       * Detalle:
           * Añadiremos un nuevo botón "En Progreso" en la función generateGtdViewHtml, dentro del div.gtd-view-controls. Su lógica de clase active será
             similar a la de los otros botones.
           * Crearemos una nueva función exportada: renderInProgressView(data: InProgressData).
           * Dentro de esta función, generaremos el HTML para:
               1. La cabecera de resumen, usando las estadísticas del objeto data.
               2. Los títulos de cada sección (Vencidas, Eventos de Hoy, etc.).
               3. Las listas de tareas para cada sección.
           * Crearemos una función auxiliar renderInProgressTask(task: Task) que genere el HTML para un único elemento de tarea, siguiendo el diseño que
             acordamos (con el tag de duración, el breadcrumb, etc.). Esto es preferible a modificar la función renderTask existente para mantener la
             separación de responsabilidades.
       * Justificación: La mayor parte del trabajo se concentra aquí, pero es trabajo de adición. No modificaremos las funciones renderGtdListsView o
         renderHierarchyViewRecursive, garantizando que esas vistas sigan funcionando exactamente igual.


  Este plan nos permite construir la nueva funcionalidad de manera segura y organizada, pieza por pieza, validando cada fase antes de pasar a la
  siguiente y minimizando el riesgo de regresiones en el código existente.