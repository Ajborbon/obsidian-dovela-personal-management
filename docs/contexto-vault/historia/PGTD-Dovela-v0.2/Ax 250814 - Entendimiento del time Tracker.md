---
type: Ax
estado: 🟢
tags:
---

# Flujo de Trabajo General

1. **Inicio del Temporizador**  
   El usuario hace clic en el botón de **"play"** en el *ribbon* o ejecuta el comando **"Control de Tiempo: Iniciar temporizador"**.  
   Esto llama a la función `startTimer` en el `TimeTrackerService`.

2. **Estado Activo**  
   El `TimeTrackerService` crea un objeto `activeTimer` que guarda:
   - La ruta de la nota.  
   - El nombre de la tarea.  
   - La hora de inicio (`startTime`).  

   Esta información se mantiene en la memoria del plugin y se muestra en la barra de estado de Obsidian.

3. **Detención del Temporizador**  
   Cuando el usuario detiene el temporizador (haciendo clic en el icono de **"stop"** en la barra de estado), se invoca `stopTimer`.

4. **Modal de Registro**  
   `stopTimer` calcula la duración y abre un `TimeLogModal`.  
   Este modal recibe la información del temporizador (nombre de la tarea y duración) y solicita al usuario que complete detalles adicionales como:
   - Un resumen.  
   - El proyecto asociado (`#px-`).  
   - El contexto asociado (`#cx-`).

5. **Guardado del Registro**  
   Al hacer clic en **"Guardar"**, el modal llama a `timeTrackerService.saveTimeLog`.  
   Este método toma toda la información, crea un objeto `TimeLogEntry` y lo añade a un archivo JSON.

6. **Actualización de la Vista**  
   Después de guardar, se actualiza la vista del **"GTD Dashboard"**, lo que provoca que la `TimelineView` (el *Cronograma*) se vuelva a renderizar con el nuevo registro.

---

## Almacenamiento de Datos: El Archivo JSON

- **Ubicación**: Los registros de tiempo se guardan en un archivo JSON cuya ruta está definida en la configuración del plugin.  
  Por defecto: `Dovela/TimeLog.json` dentro de tu *vault* de Obsidian.
- **Formato**: El archivo es un arreglo de objetos JSON. Cada objeto es un `TimeLogEntry`.
- **Estructura del Registro (`TimeLogEntry`)**:  
  Cada objeto tiene la siguiente estructura (definida en `model.ts`):
  - `task`: Nombre de la nota o tarea.
  - `startTime`: Fecha y hora de inicio en formato ISO 8601.
  - `endTime`: Fecha y hora de fin en formato ISO 8601.
  - `duration`: Duración total en minutos.
  - `summary`: Resumen escrito por el usuario en el modal.
  - `project`: Tag del proyecto (ej. `#px-ProyectoAlpha`).
  - `context`: Tag del contexto (ej. `#cx-Oficina`).

---

## La Vista "Cronograma" (TimelineView)

Esta es la parte más visual y funciona de la siguiente manera:

1. **Lectura de Datos**  
   Cuando la vista del **"GTD Dashboard"** se activa o refresca, la `TimelineView` lee el contenido completo del archivo `TimeLog.json`.

2. **Procesamiento y Agrupación**  
   - Parsea el JSON para obtener el arreglo de registros.  
   - Filtra los registros según el rango de fechas seleccionado por el usuario (*Hoy*, *Ayer*, *Esta Semana*, etc.).  
   - Agrupa los registros filtrados por día, creando una sección separada para cada día con al menos un registro.

3. **Renderizado en HTML**  
   - Para cada día, crea un contenedor `<div>`.  
   - Dentro de cada día, recorre los registros correspondientes.  
   - Cada registro se representa como una barra visual (`<div>` con clase `timeline-entry`).  
   - La posición y el ancho de la barra se calculan en función de `startTime` y `endTime`.  
     - Ejemplo: un registro de 9:00 a 9:30 ocupará la parte proporcional en la línea de tiempo.  
   - Se asigna un color a la barra, probablemente según el proyecto, usando `colorUtils.ts`.  
   - Al pasar el ratón (*hover*), aparece un *tooltip* con detalles completos (tarea, duración, resumen).

---

**En resumen:**  
El sistema está modularizado:
- **Service** → maneja la lógica.  
- **Modal** → gestiona la interacción con el usuario.  
- **View** → representa visualmente los datos almacenados en el archivo JSON.