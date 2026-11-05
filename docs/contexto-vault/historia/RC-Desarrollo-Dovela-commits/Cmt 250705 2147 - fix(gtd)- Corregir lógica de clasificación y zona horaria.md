---
type: Cmt
commit: 5937db2
branch: main
tagVersion: 
estado: 🟢
tags:
---
  

Este commit resuelve varias discrepancias críticas en el motor de clasificación GTD y mejora su precisión general.

1.  **Corrección de Zona Horaria (`dateUtils.ts`):**
    *   Se introduce `moment.js` para manejar las fechas, asegurando que todas las comparaciones (`isToday`, `isPast`, `isFuture`) se basen en la zona horaria local del usuario y no en UTC. Esto soluciona los errores de clasificación de tareas fechadas.

2.  **Refactorización del Procesador GTD (`gtdProcessor.ts`):**
    *   Se reestructura la lógica a una cadena `if/else if` estricta para evitar que las tareas se clasifiquen en múltiples listas (ej. duplicados en Inbox).
    *   Se ajusta el orden y la especificidad de las reglas para que coincidan con la documentación, corrigiendo la clasificación de tareas vencidas y futuras.

3.  **Mejoras en el Parser (`parser.ts`):**
    *   Se enriquece el modelo de datos para capturar el símbolo de la fecha (`🛫`, `⏳`, `📅`), permitiendo una clasificación más granular.
    *   Se mejora la detección de IDs en las dependencias.

4.  **Ajustes en la Interfaz (`htmlGenerator.ts`):**
    *   Se actualiza la renderización para reflejar los nuevos datos (símbolos de fecha) y se añaden verificaciones para prevenir errores con grupos de tareas vacíos.