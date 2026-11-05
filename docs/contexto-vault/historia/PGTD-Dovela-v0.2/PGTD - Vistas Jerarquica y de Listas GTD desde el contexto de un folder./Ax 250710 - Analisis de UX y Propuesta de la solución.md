---
type: Ax
estado: 🟢
tags:
---

> Bueno, quiero que nuevamente actues como UX y analices el siguiente problema, brindandome la mejor solución que ofrezca una alternativa practica y util al usuario final. 
 Requiero tener una versión ajustada de las vistas "Vista Jerarquica" y "Listas GTD", pero  ahora considerando que no abre todas las notas de la boveda para buscar las tareas en ella, sino que va a construir el arbol desde la nota en la que se abra ese comando y va a considerar, las notas que estan al interior de la misma carpeta, y todas las que esten en las subcarpetas dentro de su carpeta contenedor. En el arbol, Tambien va a agregar las notas que no esten en la misma estructura de notas, pero a las que haya algun enlace saliente desde cualquiera de las notas que ya hacen parte de la estructura, y de manera recursiva un nivel mas, las notas a las que tenga. un enlace saliente desde esas ultimas notas. En este ultimo caso, ambos niveles de notas pueden estar por fuera del folder contenedor de la nota desde la que estamos haciendo este despliegue. 
No quiero que este desarrollo afecte las funciones que ya existen por lo que prefiero que se tomen las funciones que ya existen y se copien en una nueva estructura, ajustandolas al requerimiento.  Deseo que analices muy bien la situación, me des la mejor alternativa, y consideres que todas las funcionalidades que hay en la vista de Jerarquia y la de Listas GTD son las que deseo ofrecer al usuario final, pero solamente abriendo las tareas que estan contenidas en las notas que ya te mencione.

# Análisis de UX y Propuesta de Solución


  El núcleo de tu solicitud es pasar de un modo "ver todo" a un modo "ver lo relevante para esto". La solución debe reflejar esta intención de "enfocarse".


##   Nombre de la Nueva Funcionalidad:
  Propongo llamarla "Vista de Foco del Proyecto" o simplemente "Vista de Foco". Este nombre comunica inmediatamente que es una vista contextual y limitada, en contraposición a la vista global.


##   La Experiencia de Usuario Propuesta:


   1. Punto de Entrada: Se creará un nuevo comando en la paleta de comandos de Obsidian, por ejemplo: "Dovela: Mostrar Vista de Foco del Proyecto". Este
      comando solo estará activo cuando tengas una nota abierta en el editor.


   2. Activación y Visualización:
       * Al ejecutar el comando desde una nota (ej. Proyecto-A/Reunión-Kickoff.md), se abrirá una nueva vista en el panel lateral (o donde estén las
         vistas actuales).
       * Esta vista tendrá la misma apariencia que la actual, con dos pestañas: "Jerarquía de Foco" y "Listas GTD de Foco". Esto mantiene la
         familiaridad y el poder de las vistas existentes.
       * El "raíz" de la jerarquía no será la bóveda, sino la carpeta que contiene la nota activa (ej. Proyecto-A/).


   3. Claridad sobre el Alcance (El Toque UX Clave):
       * El desafío más grande es que el usuario entienda por qué ciertas notas (y sus tareas) aparecen en la vista, especialmente las que vienen de
         enlaces.
       * Solución: Implementaremos un tooltip informativo al pasar el ratón sobre cualquier nota en la jerarquía.
           * Notas de la Carpeta: Al pasar el ratón, el tooltip podría ser neutral o no aparecer.
           * Notas Vinculadas (Nivel 1): Al pasar el ratón sobre una nota que está fuera de la estructura de carpetas, el tooltip dirá: "Incluido por 
             enlace desde: `Proyecto-A/Reunión-Kickoff.md`".
           * Notas Vinculadas (Nivel 2): Si una nota de Nivel 1 enlaza a otra, el tooltip de esta última dirá: "Incluido por enlace desde: 
             `Nota-Vinculada-Nivel-1.md`".
       * Esta simple adición proporciona una trazabilidad completa y responde a la pregunta del usuario "¿Y esto por qué está aquí?", convirtiendo una
         lista potencialmente confusa en un mapa de conocimiento explorable.


   4. Funcionalidad Completa: Dentro de estas dos pestañas, el usuario tendrá acceso al 100% de las funcionalidades que ya conoce: filtrar, ordenar,
      completar tareas, navegar a las tareas, etc. La única diferencia es el conjunto de datos subyacente, que ahora está "enfocado".

##   Ventajas de esta Solución:


   * Contexto sobre Ruido: Filtra la información irrelevante de toda la bóveda, permitiendo al usuario concentrarse únicamente en el proyecto o área de
     interés actual.
   * Descubrimiento de Conexiones: La inclusión de notas vinculadas permite descubrir dependencias y relaciones entre proyectos que de otro modo podrían
     pasar desapercibidas.
   * Cero Curva de Aprendizaje: Al reutilizar la interfaz existente, el usuario ya sabe cómo usarla desde el primer segundo.
   * Seguridad y Claridad: Es una operación no destructiva que no afecta a las vistas globales y, gracias a los tooltips, el usuario siempre entiende el
     alcance de lo que está viendo.

  ---


#   Plan de Implementación Técnica


  Para lograr esto sin afectar lo existente, seguiremos tu directriz de duplicar y adaptar.


   1. Paso 1: Duplicar la Estructura (Andamiaje Seguro)
       * Crearé una nueva carpeta en src/modules/, por ejemplo, moduloFoco/.
       * Copiaré los archivos relevantes de moduloGTDv3/ a moduloFoco/, renombrándolos para mayor claridad (ej. gtdProcessor.ts -> focoProcessor.ts,
         hierarchyBuilder.ts -> focoHierarchyBuilder.ts, view.ts -> focoView.ts).


   2. Paso 2: El Algoritmo "Recolector" (El Cerebro de la Función)
       * Crearé una nueva función central, collectFocusFiles(activeFile: TFile). Esta función será la responsable de construir el conjunto de notas a
         procesar.
       * A. Recolección por Carpetas:
           * Obtendrá la carpeta padre del activeFile.
           * Recursivamente, escaneará esa carpeta y todas sus subcarpetas, añadiendo todas las notas .md a un Set para garantizar que no haya
             duplicados.
       * B. Recolección por Enlaces (Recursiva):
           * Iterará sobre las notas recolectadas en el paso A. Usando la API de metadatos de Obsidian (app.metadataCache), encontrará todos los enlaces
             salientes.
           * Para cada enlace a una nota que no esté ya en el Set, la añadirá a una lista de "Nivel 1".
           * Luego, iterará sobre la lista de "Nivel 1" y repetirá el proceso, añadiendo los nuevos enlaces a una lista de "Nivel 2".
       * C. Devolución del Alcance: La función devolverá un Set con las rutas de todos los archivos que deben ser procesados.


   3. Paso 3: Adaptar el Procesador y el Modelo de Datos
       * El nuevo focoProcessor.ts será modificado. En lugar de escanear toda la bóveda, llamará a collectFocusFiles() para obtener el alcance.
       * Procesará las tareas únicamente de los archivos dentro de ese alcance.
       * Importante: Para habilitar los tooltips, modificaremos el modelo de datos. Al procesar una nota, guardaremos por qué fue incluida (ej. { type: 
         'linked', source: 'path/to/source/note.md' }).


   4. Paso 4: Adaptar la Vista
       * La nueva focoView.ts usará el focoProcessor.
       * Al renderizar la jerarquía, leerá la información de "motivo de inclusión" y la usará para generar los tooltips correspondientes.


   5. Paso 5: Registrar el Nuevo Comando
       * En main.ts, añadiré el nuevo comando "Dovela: Mostrar Vista de Foco del Proyecto".
       * Este comando activará la focoView, pasándole el archivo activo como punto de partida.