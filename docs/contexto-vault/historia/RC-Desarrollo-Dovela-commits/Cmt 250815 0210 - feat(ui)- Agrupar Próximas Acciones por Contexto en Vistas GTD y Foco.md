---
type: Cmt
commit: d4a895a
branch: feat/mejoras-varias
tagVersion: 
estado: 🟢
tags:
---

# feat(ui): Agrupar "Próximas Acciones" por Contexto en Vistas GTD y Foco

Se mejora la organización de las tareas en el **Dashboard GTD** y en la **Vista de Foco** al agrupar la lista de **"Próximas Acciones"** por su contexto (`cx-`).

Este cambio transforma la lista plana de acciones en una vista **estructurada**, similar a la agrupación de tareas **"Delegadas"** por persona, facilitando la visualización y gestión de tareas según el **entorno** o **herramienta** requerida.

---

## Cambios Principales

### 1. Procesamiento de Tareas
- Modificación de `gtdProcessor.ts` y `focoProcessor.ts` para procesar la lista de **"Próximas Acciones"** como un `Map` (`contexto -> Tarea[]`) en lugar de un array plano.
- Las tareas sin contexto se agrupan bajo la categoría **(Sin Contexto)**.

### 2. Renderizado en HTML
- Actualización de `htmlGenerator.ts` y `focoHtmlGenerator.ts` para:
  - Iterar sobre el `Map` de contextos.
  - Generar un encabezado de grupo para cada contexto.
  - Listar las tareas correspondientes bajo cada grupo.

### 3. Correcciones de UI
- Ajuste de la lógica de renderizado para que:
  - La sección **"Próximas Acciones"** y su enlace de navegación rápida se oculten si no hay tareas.
  - Se mantenga la consistencia visual con el resto de las secciones.
