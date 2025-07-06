---
type: Documentacion
estado: Completo
feature: Breadcrumb de Origen de Tarea
---

# Documentación: Funcionalidad de Breadcrumb de Origen de Tarea

## 1. Introducción

Este documento detalla la funcionalidad del "Breadcrumb de Origen de Tarea", una mejora de experiencia de usuario (UX) implementada en la vista de "Listas GTD". El objetivo principal de esta característica es permitir al usuario conocer el contexto jerárquico de una tarea (es decir, de qué nota o proyecto proviene) de forma rápida e intuitiva, sin abandonar la vista de listas.

## 2. ¿Qué es un "Breadcrumb"?

Un "breadcrumb" (o "miga de pan") es un patrón de diseño de interfaces de usuario que actúa como una ayuda para la navegación. Su nombre proviene del cuento de Hansel y Gretel, que dejaban un rastro de migas de pan para encontrar el camino a casa.

En el software, un breadcrumb muestra la ruta que el usuario ha seguido para llegar a una ubicación o, como en nuestro caso, la posición de un elemento dentro de una jerarquía.

**Ejemplo Común:**
`Home > Electrónica > Portátiles > Modelo XYZ`

En nuestra implementación, el breadcrumb no representa un historial de navegación, sino que revela la **ruta estructural** de la nota que contiene la tarea, proporcionando un contexto invaluable sobre su pertenencia a un área de vida, proyecto o área de interés.

## 3. Implementación Técnica

La solución fue desarrollada en cuatro fases, abordando la lógica de datos, la generación de la interfaz, la interactividad y los estilos finales. Se optó por un enfoque de **revelación progresiva**, donde la información está oculta por defecto y se muestra solo bajo demanda del usuario.

### Fase 1: Lógica de Datos - Creación del Mapa de Breadcrumbs

- **Archivo:** `src/modules/moduloGTDv3/view.ts`
- **Función Clave:** `createTaskBreadcrumbMap()`

La base de esta funcionalidad es un `Map` de JavaScript que asocia el `id` de cada tarea con su ruta jerárquica en formato de texto.

1.  Se recorre de forma recursiva la estructura jerárquica (`hierarchicalData`) previamente construida.
2.  Durante el recorrido, se mantiene un array con los nombres de los nodos padre.
3.  Para cada nota (item) en la jerarquía, se itera sobre sus tareas. A cada tarea se le asigna en el `Map` la ruta construida (ej. `Gerente de Vida > Journals > 2025-07-08 martes`).
4.  **Detalle importante:** Para mantener la vista limpia, se eliminó la etiqueta `[FALTA]` de los nombres de las notas usando la expresión regular `item.name.replace(/\s*\[FALTA\]\s*/g, '')` antes de construir la ruta.

### Fase 2: Generación de la UI (HTML)

- **Archivo:** `src/modules/moduloGTDv3/htmlGenerator.ts`
- **Función Clave:** `renderTask()`

La función que renderiza cada tarea fue modificada para incluir dos nuevos elementos dentro del `<li>` principal:

1.  **Icono de Interacción:** Un `<span>` con la clase `.gtd-breadcrumb-toggle` y un icono (`📄`) para que el usuario haga clic.
2.  **Contenedor del Breadcrumb:** Un `<div>` con la clase `.gtd-breadcrumb-container` que contiene la ruta textual obtenida del mapa. Este contenedor está oculto por defecto mediante CSS.

La estructura resultante para cada tarea es, en esencia:

```html
<li class="gtd-task">
    <!-- Contenido principal de la tarea -->
    <div class="gtd-task-content">...</div>
    
    <!-- Metadatos y el icono clicable -->
    <div class="gtd-task-metadata">
        ...
        <span class="gtd-breadcrumb-toggle">📄</span>
    </div>
    
    <!-- Contenedor del breadcrumb, oculto por defecto -->
    <div class="gtd-breadcrumb-container">
        └─ Gerente de Vida > Journals > 2025-07-08 martes
    </div>
</li>
```

### Fase 3: Interactividad (JavaScript)

- **Archivo:** `src/modules/moduloGTDv3/view.ts`
- **Función Clave:** `addEventListeners()`

La interactividad se logró mediante las siguientes técnicas:

1.  **Método del "Estado Padre":** En lugar de manipular directamente el contenedor del breadcrumb, se optó por un método más robusto. Al hacer clic en el icono, se añade o quita la clase `breadcrumb-is-open` al elemento `<li>` padre (`.gtd-task`). Este enfoque evita conflictos de renderizado con `display: flex`.

2.  **Gestión de Eventos con `AbortController`:** Se detectó un bug crítico donde se duplicaban los "event listeners" cada vez que la vista se redibujaba. Esto causaba que un solo clic activara el evento múltiples veces, cancelando la acción. Se solucionó implementando un `AbortController` que garantiza que solo haya un único "event listener" activo en todo momento, eliminando el anterior antes de añadir uno nuevo.

### Fase 4: Estilos (CSS)

- **Archivo:** `styles.css`

Los estilos se diseñaron para controlar la visibilidad y la animación del despliegue:

1.  El contenedor `.gtd-breadcrumb-container` tiene por defecto `max-height: 0` y `opacity: 0`, haciéndolo invisible y sin ocupar espacio.
2.  Se añadió una `transition` a estas propiedades para crear un efecto de animación suave.
3.  La regla de CSS clave es:
    ```css
    .gtd-task.breadcrumb-is-open .gtd-breadcrumb-container {
        max-height: 5em !important;
        opacity: 1 !important;
    }
    ```
    Esta regla indica que cuando el elemento `.gtd-task` tiene la clase `breadcrumb-is-open`, su hijo `.gtd-breadcrumb-container` se vuelve visible. El uso de `!important` fue necesario para asegurar la prioridad sobre otros estilos de Obsidian que pudieran causar conflictos.

## 4. Flujo de Usuario Final

1.  El usuario ve una lista de tareas limpia, cada una con un sutil icono de documento.
2.  Al hacer clic en el icono, un panel se desliza suavemente hacia abajo, mostrando la ruta jerárquica completa de la tarea.
3.  Un segundo clic en el mismo icono contrae el panel, ocultando la información y devolviendo la vista a su estado limpio original.
