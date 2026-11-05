---
type: Ax
estado: 🟢
tags:
---

# Documentación Funcional: Botón "Listas GTD"

## 1. Resumen General

El botón "Listas GTD" es un componente clave del "GTD Dashboard". Su función principal es cambiar la vista del dashboard para mostrar todas las tareas abiertas, clasificadas y agrupadas en las listas canónicas de la metodología _Getting Things Done_ (GTD).

Cuando un usuario hace clic en este botón, la vista jerárquica del vault se oculta y en su lugar aparece una serie de secciones desplegables, cada una correspondiendo a una lista GTD (ej. "Bandeja de Entrada", "Próximas Acciones", "Proyectos"). Esto permite al usuario pasar de una visión estructural de su información a una visión orientada a la acción.

---

## 2. Flujo de Ejecución Detallado

El proceso completo, desde el clic del usuario hasta la visualización de las listas, involucra varios módulos que trabajan en conjunto.

1. **Inicio y Renderizado Inicial**:
    
    - El usuario ejecuta el comando "Open GTD Dashboard" o hace clic en el ícono de la cinta.
        
    - Obsidian invoca el método `onload` en `src/main.ts`, que registra la `GtdView`.
        
    - Se instancia la clase `GtdView` de `src/modules/moduloGTDv3/view.ts`.
        
    - El método `drawView()` es llamado por primera vez. Por defecto, se muestra la "Vista Jerárquica" (`this.activeView = 'hierarchy'`).
        
    - Se generan los botones de control, incluido `<button data-view="gtd">Listas GTD</button>`, a través de `generateGtdViewHtml` en `htmlGenerator.ts`.
        
2. **Interacción del Usuario (Clic en el Botón)**:
    
    - El usuario hace clic en el botón "Listas GTD".
        
    - El manejador de eventos, definido en el método `addEventListeners` de la clase `GtdView`, captura el clic.
        
    - El código detecta que se ha hecho clic en un botón con el atributo `data-view="gtd"`.
        
3. **Cambio de Estado y Re-renderizado**:
    
    - El valor de la propiedad `this.activeView` en la instancia de `GtdView` se actualiza a `'gtd'`.
        
    - Se invoca nuevamente el método `this.drawView()` para redibujar el contenido del dashboard.
        
4. **Procesamiento y Generación de HTML**:
    
    - Dentro de `drawView()`, se repite el proceso de escaneo y análisis del vault.
        
    - **`parseVault` (`parser.ts`)**: Extrae todas las tareas (`Task`) de los archivos `.md`.
        
    - **`processGtdLists` (`gtdProcessor.ts`)**: Esta es la función crucial para esta vista. Recibe la lista completa de tareas y las clasifica en un objeto `Record<GtdList, Task[]>`, donde cada clave es un nombre de lista GTD (ej. `GtdList.Inbox`) y el valor es un array de las tareas que pertenecen a ella.
        
    - **`generateGtdViewHtml` (`htmlGenerator.ts`)**: Se llama a esta función, pero esta vez con el parámetro `activeView` igual a `'gtd'`.
        
    - Internamente, esta función ahora llama a `renderGtdListsView(gtdLists)` en lugar de la función de jerarquía.
        
5. **Renderizado Final**:
    
    - `renderGtdListsView` itera sobre las listas GTD procesadas. Para cada lista que contiene tareas, crea una sección `<details>` con un `<summary>` que muestra el nombre y la cantidad de tareas.
        
    - Dentro de cada sección, llama a `renderTask` para generar el HTML de cada tarea individual.
        
    - El HTML resultante se inyecta en el `contentEl` de la vista, reemplazando la vista jerárquica.
        
    - Se vuelven a añadir los `event listeners` al nuevo contenido.
        

---

## 3. Componentes Clave Involucrados

### a. `GtdView` (Clase en `view.ts`)

Es el controlador principal de la interfaz de usuario.

- **`activeView: 'hierarchy' | 'gtd'`**: Propiedad que almacena el estado de la vista actual.
    
- **`drawView()`**: Orquesta el ciclo completo de lectura, procesamiento y renderizado. Es el corazón del dashboard.
    
- **`addEventListeners()`**: Gestiona toda la interactividad, incluyendo los clics en los botones de cambio de vista y en las propias tareas para navegar a su archivo de origen.
    

### b. `gtdProcessor.ts` (Módulo de Lógica)

Contiene la inteligencia para clasificar las tareas.

- **`GtdList` (Enum)**: Define los nombres de las posibles listas GTD: `Bandeja de Entrada`, `Próximas Acciones`, `Calendario`, `Proyectos`, etc.
    
- **`processGtdLists(tasks, taskMap)`**: La función principal. Implementa un conjunto de reglas secuenciales para decidir a qué lista pertenece cada tarea. Una tarea se asigna a la primera lista cuya condición cumple.
    

### c. `htmlGenerator.ts` (Módulo de Renderizado)

Responsable de construir el código HTML.

- **`generateGtdViewHtml(data, activeView)`**: La función de nivel superior que crea el contenedor principal del dashboard y decide qué vista renderizar (`hierarchy` o `gtd`).
    
- **`renderGtdListsView(gtdLists)`**: Itera sobre las listas GTD y crea las secciones `<details>` para cada una.
    
- **`renderTask(task)`**: Renderiza una única tarea en formato `<li>`, incluyendo su prioridad, contenido (convirtiendo wikilinks a enlaces `<a>`), y metadatos.
    

### d. `Task` (Interfaz en `model.ts`)

Define la estructura de datos para una tarea. Las propiedades de esta interfaz (`tags`, `startDate`, `dependencies`, `contexts`, etc.) son las que utiliza `gtdProcessor.ts` para la clasificación.

---

## 4. Capacidades Actuales y Lógica de Clasificación

La lógica de clasificación en `processGtdLists` sigue un orden estricto de reglas. Una tarea (que no esté completada) se asigna a la **primera** categoría que coincida:

1. **Algún Día / Tal Vez (`SomedayMaybe`)**:
    
    - **Condición**: La tarea tiene el tag `#GTD-AlgunDia`.
        
2. **Esta Semana No (`ThisWeekNot`)**:
    
    - **Condición**: La tarea tiene el tag `#GTD-EstaSemanaNo`.
        
3. **En Pausa (`Paused`)**:
    
    - **Condición 1**: Tiene una fecha de inicio (`📅`) en el futuro.
        
    - **Condición 2**: Tiene una semana de planificación (`[w:: [[...]]`) en el futuro.
        
    - **Condición 3**: Depende de otra tarea (`⛔`) que aún no está completada.
        
4. **Calendario (`Calendar`)**:
    
    - **Condición**: Tiene una fecha de inicio (`📅`) y una hora de inicio (`[hI:: HH:mm]`).
        
5. **Asignadas o Delegadas (`Assigned`)**:
    
    - **Condición**: Tiene al menos una persona asignada (`#px-...`) y **no** tiene ningún contexto (`#cx-...`).
        
6. **Proyectos (`Projects`)**:
    
    - **Condición**: Tiene el contexto `#cx-ProyectoGTD` o `#cx-Entregable`.
        
7. **Próximas Acciones (`NextActions`)**:
    
    - **Condición**: Tiene al menos un contexto (`#cx-...`) que no sea de los de la categoría "Proyectos".
        
8. **Ojalá Hoy (`HopeToday`)**:
    
    - **Condición**: Tiene una fecha de inicio (`📅`) o una fecha de vencimiento (`⏳`) que es hoy, pero **no** tiene una hora de inicio.
        
9. **Bandeja de Entrada (`Inbox`)**:
    
	    - **Condición**: Si una tarea no cumple ninguna de las reglas anteriores, se asigna por defecto a la Bandeja de Entrada. Esto la convierte en el receptáculo para todas las tareas nuevas o sin procesar. 