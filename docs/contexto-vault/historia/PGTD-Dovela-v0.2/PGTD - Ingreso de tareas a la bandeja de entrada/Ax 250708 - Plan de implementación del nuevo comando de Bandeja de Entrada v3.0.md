---
type: Ax
estado: 🟢
tags:
---

## Propuesta de Mejora: Comando de "Bandeja de Entrada Inteligente"


  Concepto General: El objetivo es crear un comando de captura universal que sea rápido, inteligente y contextual. En lugar de simplemente añadir texto
   a un archivo, este comando interpretará lo que escribes, permitiéndote asignar proyectos, etiquetas y fechas de vencimiento sobre la marcha, y
  decidirá de forma inteligente dónde guardar la tarea.

  ---


  Proceso para el Usuario (El Flujo de UX)


   1. Activación Instantánea: El usuario presiona un atajo de teclado global (ej. Ctrl+Espacio o Cmd+J). No necesita tener ninguna nota o panel abierto.
      La clave es la inmediatez.


   2. Aparece una Barra de Entrada: En lugar de un modal que bloquea la pantalla, aparece una barra de entrada sutil y elegante en la parte superior,
      similar a la paleta de comandos de Obsidian. No interrumpe su flujo de trabajo visual.


   3. Captura Inteligente: El usuario escribe su tarea usando una sintaxis simple y natural. El sistema le da "superpoderes" a su texto:
       * Para asignar un proyecto o área, usa @. Ejemplo: Comprar los repuestos del carro @Finanzas/Compras
       * Para añadir etiquetas, usa #. Ejemplo: Llamar al proveedor #urgente #llamada
       * Para asignar una fecha de vencimiento, usa !. Ejemplo: Preparar la presentación !mañana, Revisar el reporte !2025-08-15, Pagar la tarjeta 
         !viernes


      Ejemplo completo: Reunión de seguimiento con el equipo de diseño @ProyectoDovela #reunion !viernes a las 10am


   4. Confirmación y Cierre: El usuario presiona Enter. La barra desaparece instantáneamente. Una notificación discreta aparece en la esquina
      confirmando: "✅ Tarea añadida al Inbox". La fricción es mínima; capturar una idea toma segundos.

  ---


  Proceso en el Sistema (La Implementación Técnica)


   1. Registro del Comando y la UI:
       * En main.ts, registras un nuevo comando: this.addCommand({ id: 'smart-inbox', name: 'Smart Inbox', hotkeys: [...], callback: () => { 
         this.openSmartInbox(); } });
       * La función openSmartInbox() no crea un Modal estándar. Crea un componente de UI personalizado (una clase que maneje un elemento div posicionado
         en la parte superior de la ventana de la app) que contiene un <input type="text">. Esta clase manejará la lógica de la barra.


   2. Lógica de Parseo (El "Cerebro"):
       * Cuando el usuario presiona Enter, el callback de la barra de entrada toma el texto.
       * Se utiliza una función de parseo (con expresiones regulares o split) para extraer las partes:
           * Busca patrones como /@(\S+)/g para los proyectos.
           * Busca patrones como /#(\S+)/g para las etiquetas.
           * Busca patrones como /!(\S.*)/g para la fecha. La parte de la fecha puede usar una librería como chrono-node (si decides añadirla) o tu
             propia lógica para interpretar "mañana", "viernes", "next week".
       * El texto restante, después de quitar estos elementos, es la descripción de la tarea.


   3. Lógica de Destino Contextual (La "Inteligencia"):
       * Aquí es donde superamos a la versión anterior. En lugar de un checkbox, el sistema decide el destino:
       * Regla 1 (Contexto de Proyecto): Si el archivo activo (app.workspace.getActiveFile()) es una nota de proyecto (ej. Proyecto Dovela.md), la tarea
         se añade dentro de esa misma nota bajo una sección ## Tareas, y se le añade automáticamente el tag #ProyectoDovela.
       * Regla 2 (Contexto de Nota Diaria): Si el archivo activo es la nota del día, la tarea se añade allí.
       * Regla 3 (Por Defecto - Inbox Global): Si no hay un contexto claro (o no hay archivo activo), la tarea se añade al archivo global de Inbox, tal
         como lo hacía la versión anterior. Este path al archivo Inbox se define en los settings del plugin.


   4. Formateo y Escritura:
       * Con la descripción, proyecto, etiquetas y fecha extraídas, se formatea la línea de la tarea. Podrías usar el formato de Tasks de Obsidian para
         máxima compatibilidad:
           * - [ ] Reunión de seguimiento con el equipo de diseño 📅 2025-07-12 🔗 [[ProyectoDovela]] #reunion
       * Se utiliza app.vault.process() o app.vault.append() para añadir la tarea al archivo de destino determinado en el paso anterior, asegurando que
         se inserte en el lugar correcto (ej. al final de la sección de tareas o al inicio del archivo Inbox).


   5. Feedback al Usuario:
       * Se llama a new Notice('✅ Tarea añadida a [[ArchivoDestino]]') para que el usuario sepa que todo funcionó y dónde puede encontrar su nueva
         tarea.

  Resumen de la Mejora



  ┌──────────────────────┬─────────────────────────────┬──────────────────────────────────────────────────────────┐
  │ Característica       │ Versión Anterior            │ **Propuesta UX Mejorada**                                │
  ├──────────────────────┼─────────────────────────────┼──────────────────────────────────────────────────────────┤
  │ **Activación**       │ Comando desde paleta        │ Atajo de teclado global e instantáneo.                   │
  │ **UI**               │ Modal que bloquea la vista. │ Barra de entrada sutil no intrusiva.                     │
  │ **Entrada de Datos** │ Solo texto plano.           │ **Parseo de lenguaje natural** (`@`, `#`, `!`).          │
  │ **Destino**          │ Manual (checkbox).          │ **Automático y contextual** (depende de la nota activa). │
  │ **Feedback**         │ Notificación simple.        │ Notificación informativa con enlace al destino.          │
  │ **Fricción**         │ Baja.                       │ **Casi nula.**                                           │
  └──────────────────────┴─────────────────────────────┴──────────────────────────────────────────────────────────┘


  Esta evolución transformaría el comando de una simple herramienta de "añadir texto" a un asistente de productividad inteligente que entiende la
  intención del usuario y se integra de manera fluida en su flujo de trabajo.


## Evolución

Estrategia de Captura Inteligente (El Flujo de UX)


  Imaginemos el comando Smart Inbox funcionando en dos niveles de complejidad, ambos accesibles desde la misma interfaz.


  Nivel 1: La Captura Simple (El Camino de Mínima Fricción)

  Este es el caso de uso principal para no perder una idea.


   1. Usuario presiona `Cmd+J`. Aparece la barra de entrada.
   2. Escribe la idea tal cual: Llamar a mamá para coordinar el viaje.
   3. Presiona Enter.
   4. Resultado: La barra desaparece. Una notificación dice: "✅ Tarea añadida al Inbox".
       * En el sistema, la línea - [ ] Llamar a mamá para coordinar el viaje #inbox se ha añadido al archivo Inbox.md (o como lo definas en los
         ajustes). No hay más clasificación. La tarea está capturada y lista para ser procesada más tarde en tu revisión GTD.


  Nivel 2: La Captura Asistida (El Camino Inteligente)


  Aquí es donde el sistema asiste al usuario para clasificar la tarea al momento de crearla, usando tu nomenclatura.


   1. Usuario presiona `Cmd+J`. Aparece la barra de entrada.
   2. Empieza a escribir: Revisar la propuesta de diseño
   3. Asignar Proyecto/Área: Escribe @. Inmediatamente, aparece un pequeño menú desplegable con una lista de tus notas PGTD, AV y AI. Puede seguir
      escribiendo para filtrar (@Proy...). Selecciona PGTD - Proyecto Dovela con las flechas y Enter.
   4. Asignar Contexto: Escribe #cx-. De nuevo, aparece un desplegable con todos tus tags de contexto existentes (cx-oficina, cx-casa, cx-llamada).
      Selecciona cx-oficina.
   5. Asignar Persona: Escribe #px-. Aparece el desplegable con las personas (px-andres, px-equipo). Selecciona px-andres.
   6. Asignar Fecha: Escribe !mañana.
   7. El texto final en la barra es: Revisar la propuesta de diseño @PGTD - Proyecto Dovela #cx-oficina #px-andres !mañana
   8. Presiona Enter.
   9. Resultado: La barra desaparece. Notificación: "✅ Tarea añadida a [[PGTD - Proyecto Dovela]]".
       * En el sistema, el plugin ha abierto el archivo PGTD - Proyecto Dovela.md, ha encontrado la sección ## Tareas y ha añadido la línea:
          - [x] Revisar la propuesta de diseño 📅 2025-07-09 #cx-oficina #px-andres 🆔 Ipa0HR ✅ 2025-08-19

  ---


  Plan de Implementación Técnica (El Proceso del Sistema)

  Esta es la estrategia técnica para lograr la UX descrita.


  Fase 1: Análisis y Preparación (Mi Próximo Paso)


  Antes de escribir una línea de código para la nueva función, debo entender completamente tu sistema actual.


   10. Analizar la Documentación: Leeré los archivos en la carpeta Documentacion para internalizar las reglas de tus listas GTD y el propósito de cada
      tag.
   11. Estudiar el Código Existente: Analizaré el código que genera los botones "Vista Jerárquica" y "Listas GTD" en tu GtdView. Esto me mostrará cómo
      estás parseando y utilizando actualmente los tags cx- y px-, y cómo identificas los archivos PGTD, AV, etc. Esto es clave para mantener la
      consistencia.
   12. Crear un Recolector de Metadatos: Implementaré una función interna en el plugin que se ejecute al inicio. Esta función usará
      app.vault.getMarkdownFiles() y app.metadataCache para escanear todo tu vault y crear listas cacheadas de:
       * Todos los archivos que son Proyectos (PGTD - ... .md).
       * Todos los archivos que son Áreas de Vida (AV - ... .md).
       * Todos los tags de contexto (#cx-...).
       * Todos los tags de persona (#px-...).
       * Estas listas serán la fuente de datos para el autocompletado.

  Fase 2: Desarrollo del Comando Smart Inbox


   13. UI del Comando: Crearé una clase para la barra de entrada. No será un Modal de Obsidian, sino un elemento HTML inyectado en la parte superior del
      DOM de la aplicación para que no sea intrusivo.
   14. Motor de Autocompletado: El input de la barra de entrada tendrá listeners. Al teclear @, #cx- o #px-, se activará una función que filtrará la lista
      correspondiente del recolector de metadatos y mostrará las sugerencias en un div posicionado debajo del input.
   15. Motor de Parseo: Al presionar Enter, una función tomará el string final y lo descompondrá usando expresiones regulares para extraer:
       * El destino (@...).
       * Los tags (#...).
       * La fecha (!...).
       * El texto restante (la descripción de la tarea).
   16. Lógica de Inserción de Tareas (Crucial):
       * Si no hay destino (`@`): El destino es el archivo Inbox por defecto. La tarea se formatea con el tag #inbox y se añade al final de ese archivo.
       * Si hay destino (`@`):
           * Se busca el archivo correspondiente (ej. PGTD - Proyecto Dovela.md).
           * Se lee el contenido del archivo.
           * Se busca la línea que contiene ## Tareas.
           * Si se encuentra la sección: Se inserta la nueva tarea en la línea siguiente. Para mantener el formato, se buscará el final de la lista de
             tareas bajo ese heading.
           * Si no se encuentra la sección: Se añade la sección ## Tareas al final del archivo, y luego se inserta la tarea debajo.
           * Se utiliza app.vault.process() para realizar esta modificación de forma segura.
   17. Procesamiento Posterior (El Flujo GTD): La belleza de este sistema es que las tareas capturadas en el Inbox global (#inbox) pueden ser procesadas
      más tarde. Se podría incluso crear un comando futuro llamado "Procesar Siguiente Tarea del Inbox" que te presente la tarea y te ofrezca las mismas
      herramientas de clasificación (@, #, !) para moverla a su lugar definitivo.


  Esta estrategia combina la inmediatez que necesitas con la inteligencia de tu propio sistema de organización, haciendo que la captura de tareas sea
  potente pero opcionalmente compleja.


  