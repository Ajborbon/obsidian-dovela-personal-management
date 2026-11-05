---
type: Ax
estado: 🟢
tags:
---
# Plan de Implementación: Jerarquía Fusionada y Rediseño Premium


  Objetivo Final: Transformar la "Vista Jerárquica" en una herramienta visualmente atractiva y funcional que presente la información de forma clara y
  sin redundancias, utilizando un modelo de "tarjetas anidadas" y fusionando las notas de carpeta con sus directorios.

  ---


##   Fase 1: Implementar el "Modelo de Fusión" (Lógica del Backend)


   * Archivo a Modificar: src/modules/moduloGTDv3/hierarchyBuilder.ts
   * Meta: Modificar el algoritmo de construcción de la jerarquía para que una nota con el mismo nombre que su carpeta contenedora (ej:
     ProyectoA/ProyectoA.md) se convierta en el nodo padre, eliminando la duplicación y el tag [FALTA] innecesario.


   * Pasos Técnicos:
       1. Refactorizar `buildHierarchy`: Ajustaré la función para realizar un proceso de mapeo en dos pasadas.
       2. Primera Pasada (Fusión): Iteraré sobre todos los items. Si un item es una "nota de carpeta" (su nombre coincide con el de su directorio), lo
          añadiré al itemMap usando la ruta de la carpeta como clave. Esto "fusiona" la nota con su carpeta.
       3. Segunda Pasada (Mapeo Estándar): Iteraré de nuevo sobre los items. Aquellos que no fueron fusionados en la primera pasada se añadirán al
          itemMap de la forma habitual (usando su propia ruta de archivo).
       4. Ajustar Enlace de Padres: La lógica que busca el padre de un item (parentKey) funcionará ahora correctamente, encontrando la nota fusionada
          como padre cuando corresponda.
       5. Creación de Placeholders `[FALTA]`: Esta lógica se mantendrá, pero ahora solo se activará para carpetas que realmente no tengan una nota
          principal, que es el comportamiento deseado.

  ---


##   Fase 2: Crear la Estructura HTML para las "Tarjetas Anidadas"


   * Archivo a Modificar: src/modules/moduloGTDv3/htmlGenerator.ts
   * Meta: Cambiar la generación de HTML de una lista simple a una estructura semántica que represente tarjetas anidadas, preparando el terreno para el
     CSS.


   * Pasos Técnicos:
       1. Modificar `renderHierarchyViewRecursive`: La función será actualizada para generar la nueva estructura.
       2. Nueva Estructura HTML: Cada elemento será un \<details> que contendrá un \<summary> (el encabezado de la tarjeta) y un \<div> para los hijos.
           * El \<summary> contendrá el icono, nombre, estado y contadores de tareas.
           * Se eliminará el texto [Tipo] y se reemplazará por un \<span> con un atributo data-type, listo para ser estilizado con un icono vía CSS.
       3. Pasar el Nivel de Profundidad: La función recursiva recibirá un parámetro level para saber en qué nivel de anidación se encuentra, permitiendo
          colapsar niveles profundos por defecto.

  ---


##   Fase 3: Aplicar el Estilo Visual Premium (CSS)


   * Archivo a Modificar: styles.css
   * Meta: Escribir el código CSS que transforme la nueva estructura HTML en una interfaz pulida y fácil de leer.


   * Pasos Técnicos:
       1. Estilo de Tarjeta: Definiré el estilo para .gtd-card-container y .gtd-card-header (bordes, fondos, sombras, espaciado) para crear la apariencia
          de tarjeta.
       2. Jerarquía Visual: Usaré padding-left y border-left en .gtd-card-children para crear la indentación y las líneas de guía verticales que conectan
          padres e hijos.
       3. Iconografía: Utilizaré los selectores de atributo [data-type="..."] para asignar un icono (probablemente emojis o SVGs simples) a cada tipo de
          elemento (PQ, AV, Ax, etc.), reemplazando el texto crudo.
       4. Tipografía y Contadores: Ajustaré los pesos, tamaños y colores de las fuentes para diferenciar nombres de proyectos, estados y contadores. Los
          contadores de tareas se estilizarán como "píldoras" para que sean discretos pero claros.
       5. Estilo para `is-missing`: Los elementos [FALTA] tendrán un estilo distintivo (ej: borde discontinuo, opacidad reducida) para que se entienda que
          son placeholders.

  ---

##   Fase 4: Mejorar la Interacción y Añadir Controles Globales


   * Archivos a Modificar: htmlGenerator.ts y view.ts
   * Meta: Refinar la experiencia del usuario al interactuar con la jerarquía.


   * Pasos Técnicos:
       1. Colapsar por Defecto: En htmlGenerator.ts, modificaré la lógica para que solo los primeros niveles de la jerarquía aparezcan expandidos (open),
          reduciendo la sobrecarga de información inicial.
       2. Añadir Botones de Control: En htmlGenerator.ts, añadiré los botones "Expandir Todo" y "Colapsar Todo" en la barra de controles de la vista.
       3. Implementar Lógica de Control: En view.ts, dentro de addEventListeners, programaré la funcionalidad de estos nuevos botones para que recorran
          todos los elementos \<details> y modifiquen su estado open.
       4. Verificación Final: Me aseguraré de que la funcionalidad de clic para abrir archivos siga funcionando correctamente con la nueva estructura de
          tarjetas.