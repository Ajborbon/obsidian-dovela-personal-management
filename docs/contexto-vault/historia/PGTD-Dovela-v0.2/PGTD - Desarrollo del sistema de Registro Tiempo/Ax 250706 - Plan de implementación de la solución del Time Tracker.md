---
type: Ax
estado: 🟢
tags:
---
# Plan de Implementación Definitivo y Seguro (Versión 3.0)


  Este plan se centra en la adición quirúrgica en lugar de la refactorización.


##   Fase 1: Lógica de Negocio y Modelos (Sin cambios, 100% seguro)


   * Acción: Crear el archivo src/modules/moduloGTDv3/timeTrackerService.ts.
       * Contenido: Clase TimeTrackerService para manejar la lectura/escritura de timelogs.json, el cálculo de estadísticas y la gestión de sesiones
         interrumpidas.
       * Análisis de Riesgo: Cero. Es un archivo nuevo y aislado.
   * Acción: Modificar el archivo src/modules/moduloGTDv3/model.ts.
       * Contenido: Añadir las interfaces TimeLogEntry y ActiveTimerState.
       * Análisis de Riesgo: Cero. Solo estamos añadiendo tipos, no modificando lógica existente.


##   Fase 2: Creación del Componente de UI Aislado (100% seguro)


   * Acción: Crear el archivo src/modules/moduloGTDv3/timeTrackerView.ts.
       * Contenido: Crear la clase TimeTrackerView. Esta clase será la responsable de toda la UI y la lógica del Time Tracker.
           * Tendrá un método constructor(container: HTMLElement, plugin: DovelaPersonalManagementPlugin, service: TimeTrackerService) que recibe su
             contenedor y las dependencias.
           * Tendrá un método render() que construirá toda la UI dentro de su container: el selector de fuente de tareas, la búsqueda fuzzy, el panel
             del cronómetro, el botón de registro manual y la vista de estadísticas.
           * Manejará todos sus propios eventos de clic y de entrada.
           * Se comunicará directamente con el TimeTrackerService.
       * Análisis de Riesgo: Cero. Es un componente completamente nuevo y autocontenido.


   * Acción: Crear el archivo src/modules/moduloGTDv3/timeLogModal.ts.
       * Contenido: Clase TimeLogModal extends Modal para el formulario de registro. Será instanciada y utilizada exclusivamente por TimeTrackerView.
       * Análisis de Riesgo: Cero. Es un componente de soporte para nuestra nueva vista.


##   Fase 3: Integración Quirúrgica en view.ts (100% seguro)


   * Acción: Modificar src/modules/moduloGTDv3/view.ts.
       * Análisis de Cambios (Mínimos y Precisos):
           1. Importar la nueva clase: import { TimeTrackerView } from './timeTrackerView';.
           2. Añadir un nuevo botón: En el método que crea los botones principales (renderButtons o similar), añadiremos un botón "Time Tracker" junto a
              los existentes.
           3. Añadir un nuevo contenedor: En el área de contenido, añadiremos un div con un id específico, por ejemplo <div id="time-tracker-container" 
              class="dovela-hidden"></div>.
           4. Modificar el manejador de eventos de los botones: En la lógica que gestiona qué vista mostrar, añadiremos un case para nuestro nuevo botón:
               * Al hacer clic en "Time Tracker", se ocultarán los contenedores de "Vista Jerárquica", "Listas GTD", etc., y se mostrará el
                 #time-tracker-container.
               * Importante: Aquí, y solo si es la primera vez que se muestra, instanciaremos la nueva vista: new 
                 TimeTrackerView(document.getElementById('time-tracker-container'), this.plugin, this.timeTrackerService);.
       * Lo que NO se tocará: No se alterará ni una línea de los métodos que renderizan el contenido de las vistas jerárquica, de listas o en progreso.
         No se tocarán sus manejadores de eventos internos. No se cambiarán sus clases CSS.
       * Análisis de Riesgo: Muy bajo. La modificación es aditiva y está aislada en el manejador de clics de los botones principales.


##   Fase 4: Integración en main.ts (100% seguro)


   * Acción: Modificar src/main.ts.
       * Contenido: La lógica aquí es la misma que en el plan anterior, pero ahora es aún más simple.
           1. Instanciar TimeTrackerService.
           2. Manejar el statusBarItem y las sesiones interrumpidas.
           3. Al crear la GTDView (la clase de view.ts), le pasaremos la instancia del timeTrackerService. GTDView la necesitará para poder pasársela a
              TimeTrackerView cuando la cree.
       * Análisis de Riesgo: Cero. Son adiciones necesarias para dar soporte a la nueva funcionalidad.


  Este plan es el camino a seguir. Es robusto, seguro y respeta al 100% el trabajo y la funcionalidad que ya existen. Procederé con la implementación siguiendo estos pasos exactos.De acuerdo. Comenzaré con la Fase 1: Lógica de Negocio y Modelos.