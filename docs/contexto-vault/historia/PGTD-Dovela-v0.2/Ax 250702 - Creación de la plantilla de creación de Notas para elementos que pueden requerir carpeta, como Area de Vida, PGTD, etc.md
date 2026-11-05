---
type: Ax
estado: 🔵
tags:
---
#  Documentación: Plantilla Avanzada de Creación de Notas en Obsidian

## Resumen General


  Esta documentación detalla el funcionamiento y la estructura de la plantilla de Templater diseñada para la creación de Proyectos GTD (PGTD). El
  objetivo principal de este script es automatizar y estandarizar la creación de notas y carpetas de proyectos, adaptándose de forma inteligente al
  contexto desde el cual se invoca.

  El script no solo crea la nota, sino que también gestiona la estructura de carpetas, renombra archivos, y enlaza la nueva nota desde su punto de
  origen, optimizando significativamente el flujo de trabajo.

## Características Principales

   * Detección de Contexto: El script sabe si se está ejecutando desde una nota activa o desde el explorador de archivos (haciendo clic derecho en una
     carpeta).
   * Redirección a Bandeja de Entrada: Permite forzar la creación de la nota en la carpeta 00 - Inbox, sin importar el contexto original.
   * Lógica de Proyectos (Prefijo `PGTD - `):
       * Si se ejecuta dentro de una carpeta de proyecto (PGTD - ...), detecta si la nota principal del proyecto ya existe.
       * Si no existe, ofrece crearla automáticamente con el nombre de la carpeta.
       * Si ya existe (o si el usuario lo prefiere), permite crear "sub-items" dentro del proyecto, ya sea como notas sueltas o con su propia
         sub-carpeta.
   * Creación Flexible: Fuera de una carpeta de proyecto, permite crear un nuevo proyecto con su propia carpeta o como una única nota.
   * Enlace Automático: Si se invoca desde una nota, inserta automáticamente un enlace a la nota recién creada en la posición del cursor.
   * Apertura Automática: Abre la nueva nota en un panel dividido para empezar a trabajar en ella inmediatamente.

##   Flujo de Ejecución Detallado


  El script se puede dividir en 5 fases principales:


###    Fase 1: Obtener Contexto
   * Determina si la plantilla fue llamada desde una nota activa o desde el explorador.
   * Establece las variables currentFolder y currentFolderPath que se usarán como la ruta de trabajo base.


### Fase 2: Decidir Ubicación (Bandeja de Entrada)
   * Pregunta al usuario si desea crear la nota en la 00 - Inbox.
   * Si la respuesta es afirmativa, sobrescribe las variables de ruta para apuntar a la bandeja de entrada.


### Fase 3: Lógica Principal de Creación
   * Si la carpeta actual empieza con `PGTD - `:
           1. Verifica si ya existe un archivo .md con el mismo nombre que la carpeta.
           2. Si no existe, pregunta si se desea crear la nota principal del proyecto.
           3. Si ya existe (o el usuario no quiso crear la nota principal), pregunta cómo crear un sub-item (con o sin carpeta).
       * Si la carpeta actual NO empieza con `PGTD - `:
           1. Pregunta cómo se desea crear el nuevo proyecto (con o sin carpeta).
       * En todos los casos, se solicita el nombre del proyecto/item y se preparan las variables finalTitle y finalPath.


### Fase 4: Ejecución y Enlazado
   * Utiliza tp.file.move() para renombrar y/o mover el archivo temporal "Sin Título" a su destino final (finalPath).
   * Si el script fue invocado desde una nota, inserta un enlace [[ruta/final|título final]] en la nota de origen.


### Fase 5: Apertura de la Nota
   * Busca el archivo recién creado en la bóveda.
   * Lo abre en un nuevo panel (split) y mueve el cursor al final del documento.

##  Cómo Adaptar la Plantilla para Otros Tipos de Notas (Ej: "Área de Vida")


  Replicar esta plantilla para otro sistema (como "Áreas de Vida", "Recursos", etc.) es sencillo si se siguen estos pasos. La clave es identificar las
  variables y textos que son específicos del sistema "PGTD".

  Pasos para la Adaptación


   1. Duplicar la Plantilla: Crea una copia del archivo Plt - PGTD.md y renómbralo a algo descriptivo, como Plt - AreaVida.md.

   2. Modificar las Variables Clave: Abre la nueva plantilla y edita las siguientes variables al principio del script:
       * const tipo: Cambia el prefijo que se usará en los nombres de archivo.
       * const prefijoCarpeta: Es recomendable crear una nueva variable para el prefijo de la carpeta para que sea fácil de cambiar.

   3. Actualizar la Lógica Principal: Localiza la condición principal del if y actualízala con el nuevo prefijo.
       * if (currentFolder.startsWith("PGTD - "))

   4. Personalizar los Diálogos: Revisa todas las llamadas a tp.system.suggester y tp.system.prompt y cambia los textos para que reflejen el nuevo tipo
      de nota.

   5. Ajustar el Frontmatter (YAML): Modifica la sección final de la plantilla para que los metadatos (type, tags, etc.) sean los correctos para el nuevo
      sistema.

  Ejemplo Práctico: Adaptación para "Área de Vida (AV)"

  Supongamos que queremos una plantilla para "Áreas de Vida" cuyo prefijo sea AV.

   6. Duplicar: Plt - PGTD.md -> Plt - AreaVida.md

   7. Variables Clave:

```js
   1     // ANTES
   2     const tipo = "PGTD";
   3 
   4     // DESPUÉS
   5     const tipo = "AV";
   6     const prefijoCarpeta = "AV - "; // Nueva variable para claridad
```

   8. Lógica Principal:

```js
   1     // ANTES
   2     if (currentFolder.startsWith("PGTD - ")) {
   3 
   4     // DESPUÉS
   5     if (currentFolder.startsWith(prefijoCarpeta)) { // Usamos la nueva variable

      Y también hay que cambiar replace("PGTD - ", ...) por replace(prefijoCarpeta, ...)
```

   9. Diálogos:

```js
   1     // ANTES
   2     const projectName = await tp.system.prompt("¿Cuál es el nombre del proyecto?", "", true);
   3 
   4     // DESPUÉS
   5     const areaName = await tp.system.prompt("¿Cuál es el nombre de la nueva Área de Vida?", "", true);
```


  Siguiendo estos pasos, puedes crear un ecosistema de plantillas inteligentes y consistentes para todos los sistemas de tu bóveda de Obsidian.