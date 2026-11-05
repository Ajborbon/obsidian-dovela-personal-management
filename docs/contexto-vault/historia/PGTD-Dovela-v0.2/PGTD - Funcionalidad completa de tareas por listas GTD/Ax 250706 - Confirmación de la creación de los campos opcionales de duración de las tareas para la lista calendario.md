---
type: Ax
estado: 🔵
tags:
---
>En la vista de Listas GTD, dentro de las reglas definidas en la documentación hablamos del campo opcional de duración de las tareas, el cual se puede definir usando [Xmin], [Xm] ó [Xh], el uso es asi: por ejemplo [30min], o [30m] ó [0.5h], en este caso, las tres significan lo mismo. Quiero que revises si dentro de las reglas para ti es clara esta descripción y quiero que revises en el codigo que se implemento dentro de la lista de Calendario en el listado de listas GTD del comando Open GTD Dashboard si se implemento algo sobre este requerimiento.  


✦ Entendido. Analizaré la documentación y el código para responder a tu pregunta.


  Primero, voy a buscar y leer el documento de reglas que mencionaste para evaluar la claridad de la definición de duración.
 ╭────────────────────────────────────────────────────────────────────────────────────────╮
 │ ✔  ReadFile /Ax 250705 - Reglas y estructura de las listas de Tareas GTD de Dovela.md  │
 ╰────────────────────────────────────────────────────────────────────────────────────────╯
✦ La documentación que me proporcionaste es clara en cuanto a la definición de la duración de las tareas. Especifica que se puede usar [Xmin] para
  minutos y [Xh] para horas, y da ejemplos como [60min] y [1.5h].


  Sin embargo, el formato [Xm] (por ejemplo, [30m]) que mencionaste no está explícitamente incluido en las reglas del documento. La documentación es
  consistente en usar min y h.


  Ahora, voy a revisar el código para ver si esta funcionalidad de duración fue implementada en la lista de "Calendario". Empezaré por el archivo que
  procesa el texto de las tareas.
 ╭────────────────────────────────────────────────╮
 │ ✔  ReadFile src/modules/moduloGTDv3/parser.ts  │
 ╰────────────────────────────────────────────────╯
✦ He revisado parser.ts y he encontrado lo siguiente:


   1. Sí hay una implementación para la duración. El código busca y extrae la duración de la tarea usando esta expresión regular:


   1     const duration = extractAndClean(/ \[([0-9]+h|[0-9]+min)\]/);

   2. La implementación coincide con la documentación, no con tu suposición. La expresión regular solo reconoce h y min como unidades de tiempo válidas,
      exactamente como se describe en el documento de reglas. No reconoce m.
   3. La duración se utiliza para detectar conflictos. El código verifica si la duración especificada coincide con las horas de inicio y fin, y marca la
      tarea como conflictiva si no lo hacen.

  Conclusión:


  La funcionalidad de duración está implementada en el sistema, pero solo para los formatos [Xh] y [Xmin]. El formato [Xm] no está soportado
  actualmente. La implementación se alinea con lo que está escrito en la documentación.


  Si deseas que se añada el soporte para [Xm], puedo hacerlo.