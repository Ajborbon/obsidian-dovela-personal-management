---
type: Cmt
commit: b495722
branch: feature/smart-inbox
tagVersion: 
estado: 🟢
tags:
---

Descripción:

Refactoriza por completo el sistema de persistencia de datos del Time Tracker para alinearlo con las mejores prácticas de Obsidian.

Cambios clave:

1.  **Migración a `data.json`**: Se elimina el uso del archivo `timelogs.json` codificado en la ruta. Toda la persistencia de datos del
  plugin, incluyendo los registros de tiempo y el estado del temporizador interrumpido, se centraliza ahora en el archivo `data.json`
  gestionado por la API de Obsidian a través de `loadData()` y `saveData()`.

2.  **Modelo de Datos Unificado**: Se introduce la interfaz `DovelaPluginData` en `model.ts` para definir una estructura única y clara
  para todos los datos guardados, junto con `DEFAULT_SETTINGS` para una inicialización segura.

3.  **Centralización de Lógica**: La clase principal `DovelaPersonalManagementPlugin` es ahora la única responsable de leer y escribir en
  `data.json`. El `TimeTrackerService` y las vistas (`GtdView`, `TimeTrackerView`) han sido refactorizados para consumir los datos desde la
  instancia principal del plugin (`this.plugin.data`), eliminando la duplicación de lógica y la creación de instancias de servicio
  innecesarias.
   
4.  **Script de Migración Automática**: Se ha añadido una rutina de migración única en `main.ts` que, al cargar el plugin por primera vez
  tras la actualización, lee los datos del antiguo `timelogs.json`, los mueve a `data.json` y elimina el archivo antiguo para garantizar una
  transición transparente para el usuario sin pérdida de datos.

5.  **Corrección de Errores**: Se soluciona el bug por el cual la vista de "Estadísticas de Tiempo" no mostraba ninguna información, ya
  que intentaba leer de una fuente de datos incorrecta y obsoleta.
   
   Este refactor mejora significativamente la robustez, la fiabilidad de la sincronización y la mantenibilidad del plugin, asegurando la
      compatibilidad con el ecosistema de Obsidian.
