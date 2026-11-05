---
type: Ax
estado: 🟢
tags:
---

# Plan de Implementación: Filtros Interactivos y Navegación Rápida para Listas GTD


  El objetivo es mejorar la usabilidad de la vista "Listas GTD" permitiendo al usuario filtrar tareas por contexto y persona, y navegar rápidamente
  entre las diferentes listas sin necesidad de hacer scroll manual.


##   Fase 1: Extender el Procesamiento de Datos (Backend)


  Objetivo: Recopilar todos los contextos y personas únicas durante el análisis inicial del vault para poder usarlos en los filtros del frontend.


  Archivo a modificar: src/modules/moduloGTDv3/gtdProcessor.ts y src/modules/moduloGTDv3/model.ts.


   1. Actualizar el Modelo de Datos:
       * En model.ts, modificaremos la interfaz ProcessedVaultData para que pueda almacenar las listas de contextos y personas.


   1     export interface ProcessedVaultData {
   2         // ... propiedades existentes ...
   3         uniqueContexts: string[];
   4         uniquePeople: string[];
   5     }



   2. Recopilar Datos en el Procesador:
       * En gtdProcessor.ts, durante el procesamiento de las tareas, utilizaremos dos Set para almacenar de forma eficiente todos los #cx- y #px- que se
         encuentren. Los Set garantizan que no haya duplicados.
       * Al final del procesamiento, convertiremos estos Set en arrays ordenados alfabéticamente y los añadiremos al objeto ProcessedVaultData que se
         devuelve.


##   Fase 2: Construir la Interfaz de Usuario (HTML)


  Objetivo: Añadir los nuevos elementos de UI (filtros y barra de navegación) a la vista HTML generada.


  Archivo a modificar: src/modules/moduloGTDv3/htmlGenerator.ts.


   1. Añadir Atributos de Datos a las Tareas:
       * En la función renderTask, añadiremos atributos data-* a cada elemento <li> de la tarea. Esto es crucial para que el JavaScript del frontend
         pueda identificarlas y filtrarlas.
       * Ejemplo: <li class="gtd-task" data-contexts='["#cx-Oficina", "#cx-Casa"]' data-people='["#px-Juan"]'>...</li>


   2. Generar los Filtros Desplegables:
       * En la función principal generateGtdViewHtml, usaremos las listas uniqueContexts y uniquePeople (obtenidas en la Fase 1) para generar
         dinámicamente dos menús desplegables (\<select\>).
       * Cada menú tendrá una opción por defecto "Todos".


   3. Generar la Barra de Navegación Rápida:
       * Justo debajo de los filtros, generaremos una barra de navegación.
       * Iteraremos sobre las listas GTD (gtdLists). Por cada lista que no esté vacía, crearemos un enlace de ancla (ej. \<a 
         href="#gtd-list-NextActions">Próximas Acciones\</a\>).
       * A cada sección de lista (\<details\>) le asignaremos un id correspondiente para que los enlaces de ancla funcionen (ej. \<details 
         id="gtd-list-NextActions"\>).

## Fase 3: Implementar la Interactividad (JavaScript)


  Objetivo: Dar vida a los filtros y a la barra de navegación utilizando JavaScript en el lado del cliente.


  Archivo a modificar: src/view.ts (o donde se gestione la lógica de la vista de Obsidian).


   4. Manejador de Eventos para Filtros:
       * Se añadirá un event listener al evento change de ambos menús desplegables.
       * Al cambiar un filtro, una función JavaScript recorrerá todas las tareas (.gtd-task).
       * Comparará los data-contexts y data-people de cada tarea con el valor del filtro.
       * Ocultará (style.display = 'none') o mostrará las tareas que no coincidan o sí coincidan.
       * Después de filtrar, se revisará qué listas y qué enlaces de la barra de navegación deben ocultarse si quedaron vacíos.


   5. Manejador de Eventos para Navegación Rápida:
       * Se añadirá un event listener al evento click de los enlaces de la barra de navegación.
       * La función prevendrá el comportamiento por defecto del enlace de ancla.
       * Obtendrá el id del destino (ej. #gtd-list-NextActions).
       * Utilizará element.scrollIntoView({ behavior: 'smooth' }) para un desplazamiento suave hasta la sección correspondiente.
       * Se asegurará de que la sección de destino (\<details>) esté expandida (element.open = true).


##   Fase 4: Aplicar Estilos (CSS)

  Objetivo: Asegurar que los nuevos elementos de la interfaz se vean bien y estén integrados con el diseño existente.

  Archivo a modificar: styles.css.


   6. Estilos para Filtros y Navegación:
       * Se añadirán reglas de CSS para dar formato a la sección de filtros y a la barra de navegación, utilizando flexbox para una alineación limpia.
       * Se estilizarán los menús desplegables y los enlaces para que coincidan con la estética de Obsidian.
   7. Navegación Fija (Opcional pero recomendado):
       * Se podría hacer que la barra de filtros y navegación sea "pegajosa" (position: sticky; top: 0;) para que permanezca visible en la parte
         superior mientras el usuario se desplaza por las listas.