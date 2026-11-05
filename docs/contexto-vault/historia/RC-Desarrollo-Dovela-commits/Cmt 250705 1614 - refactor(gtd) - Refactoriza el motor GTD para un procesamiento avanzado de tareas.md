---
type: Cmt
commit: 07d9416
estado: 🟢
branch: main
tagVersion:
---
Se reestructura por completo el módulo moduloGTDv3 para introducir un sistema de procesamiento de tareas más robusto y detallado.

   - Parser Mejorado: La lógica de parser.ts ahora utiliza expresiones regulares más precisas para extraer metadatos inline de las tareas (ej. 📅, ⏳, ⛔, [w::]), similar a la sintaxis de Dataview.

   - Jerarquía Precisa: hierarchyBuilder.ts ahora crea elementos "placeholder" para carpetas que no tienen una nota principal, asegurando que la vista jerárquica refleje fielmente la estructura de carpetas del vault.

   - Clasificación GTD Avanzada: gtdProcessor.ts ha sido reescrito para manejar reglas más complejas, incluyendo la verificación de dependencias entre tareas a través de un mapa de tareas.

   - Modelo de Datos Extendido: Las interfaces en model.ts han sido actualizadas para incluir los nuevos campos de metadatos como duration, week, tags, etc.