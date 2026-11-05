---
type: Ax
estado: 🟢
tags:
---

# Plan de Implementación: Controles de Foco Dinámicos

  ---


##   Fase 1: Mejorar el Procesador de la Vista "En Progreso" (El Cerebro)


  El objetivo es dotar a nuestro procesador de la capacidad de agrupar y ordenar dinámicamente.


   1. Actualizar `inProgressProcessor.ts`:
       * Acción: Modificaremos la función principal processInProgressTasks para que acepte parámetros de control.
       * Detalle:
           * La firma de la función cambiará de processInProgressTasks(tasks: Task[]) a:
   De
```ts
processInProgressTasks(
   tasks: Task[],
   grouping: 'none' | 'context' | 'person' | 'project',
   sorting: 'priority' | 'duration-asc' | 'duration-desc'
): InProgressData
```


   * Moveremos la lógica de agrupación y ordenamiento que ya existe dentro de esta función a un bloque if (grouping === 'none').
   * Añadiremos nuevos bloques else if para las otras opciones de agrupación (context, person, project). Cada bloque contendrá la lógica para
	 crear los grupos correspondientes.
   * Para la agrupación por 'proyecto', crearemos una nueva función auxiliar privada dentro de este mismo archivo: getProjectGroupForTask(task: 
	 Task): string. Esta función implementará el algoritmo refinado que acordamos (PGTD > AI > Prefijo > Carpeta > "Tareas Generales").
   * Al final de la función, después de la agrupación, aplicaremos el ordenamiento. Crearemos una función sortTasks(tasks: Task[], sorting: 
	 'priority' | ...) que contendrá la lógica para ordenar por duración (asc/desc) o por la prioridad por defecto. Esta función se aplicará a
	 las tareas dentro de cada grupo.
* Impacto: Este es el cambio más complejo, pero está aislado en un solo módulo. Al centralizar la lógica aquí, el resto del código solo necesitará pasar los parámetros correctos.

   2. Actualizar el Modelo de Datos (`model.ts`):
       * Acción: La estructura de InProgressData debe cambiar para soportar grupos dinámicos.
       * Detalle:
           * Modificaremos la interfaz InProgressData para que en lugar de tener listas fijas (overdueTasks, todayTasks), tenga una estructura que
             acepte grupos con nombres dinámicos.


   1             export interface InProgressData {
   2                 groups: { [groupName: string]: Task[] }; // Un objeto donde la clave es el nombre del grupo
   3                 stats: { ... };
   4             }

   * Justificación: Este cambio es crucial para la flexibilidad. Ya no estamos atados a un conjunto predefinido de grupos.

  ---


##   Fase 2: Integrar los Controles en la Vista Principal (Los Disparadores)


  Ahora conectaremos la nueva lógica del procesador con la interfaz de usuario.


   3. Actualizar el Componente de la Vista (`view.ts`):
       * Acción: Añadiremos estado local al componente para mantener la selección actual de agrupación y ordenamiento, y actualizaremos la llamada al
         procesador.
       * Detalle:
           * Añadiremos dos nuevas propiedades privadas a la clase GtdView:


   1             private activeGrouping: 'none' | 'context' | 'person' | 'project' = 'none';
   2             private activeSorting: 'priority' | 'duration-asc' | 'duration-desc' = 'priority';

   * En la función drawView, modificaremos la llamada a processInProgressTasks para que pase los valores de estas nuevas propiedades:
	  const inProgressData = processInProgressTasks(parsedData.allTasks, this.activeGrouping, this.activeSorting);
   * En la función addEventListeners, añadiremos la lógica para manejar los clics en los nuevos botones de control.
	   * Un clic en un botón de agrupación cambiará el valor de this.activeGrouping y llamará a this.drawView() para redibujar todo.
	   * Un clic en el botón de ordenamiento ciclará a través de los tres estados de this.activeSorting y también llamará a this.drawView().
* Impacto: Cambios localizados que actúan como el "pegamento" entre la UI y la lógica de negocio.

  ---

##   Fase 3: Renderizar la Interfaz de Usuario Dinámica (La Cara Visible)

  Finalmente, haremos que el HTML refleje el estado dinámico.


   4. Actualizar el Generador de HTML (`htmlGenerator.ts`):
       * Acción: Modificaremos la función renderInProgressView para que pueda renderizar grupos dinámicos y añadiremos los nuevos botones de control.
       * Detalle:
           * En generateGtdViewHtml, dentro de la sección de la vista "En Progreso", añadiremos el HTML para los nuevos "Controles de Foco" (los botones
             de agrupación y el botón de ordenamiento). El estado "activo" de estos botones se determinará pasando activeGrouping y activeSorting como
             parámetros.
           * La función renderInProgressView ya no recibirá listas fijas, sino el nuevo objeto InProgressData con la propiedad groups.
           * Iteraremos sobre las claves (nombres de grupo) del objeto data.groups para renderizar dinámicamente cada bloque \<details>/\<summary>.
           * Añadiremos los iconos sugeridos (📂, 🧠, 🏠, 📁) a los títulos de los grupos dentro de esta función de renderizado.
       * Justificación: Este cambio desacopla completamente el renderizado de una estructura de datos fija, permitiendo que muestre cualquier conjunto de
         grupos que el procesador le envíe.


  Este plan de tres fases nos permite abordar la complejidad de manera estructurada, asegurando que la base de datos y la lógica de negocio estén sólidas antes de construir la interfaz de usuario sobre ellas.