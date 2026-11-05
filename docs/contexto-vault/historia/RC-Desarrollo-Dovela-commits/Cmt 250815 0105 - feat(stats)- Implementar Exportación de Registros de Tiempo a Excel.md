---
type: Cmt
commit: 481b005
branch: feat/mejoras-varias
tagVersion: 
estado: 🟢
tags:
---

# feat(stats): Implementar Exportación de Registros de Tiempo a Excel

Se añade una nueva funcionalidad en la vista de **Estadísticas** que permite exportar los registros de tiempo a un archivo **Excel (.xlsx)**.

---

## Características Principales

### 1. Exportación Contextual
- El usuario puede hacer **clic derecho** en cualquier nodo del árbol jerárquico (carpeta o archivo de tarea) para abrir un menú contextual y seleccionar la opción **"Exportar a Excel"**.

### 2. Recopilación Recursiva
- La exportación incluye todos los registros de tiempo del nodo seleccionado y **de todos sus nodos descendientes**.
- Esto permite exportar:
  - Una tarea individual.
  - Un proyecto completo.
  - Todas las áreas.

### 3. Formato de Archivo Detallado
- El archivo Excel generado incluye las siguientes columnas:
  - Ruta Completa.  
  - Tarea.  
  - Descripción.  
  - Fecha.  
  - Día de la Semana.  
  - Hora de Inicio y Fin.  
  - Duración (en minutos y en formato `hh:mm`).  
  - Notas.

### 4. Manejo Seguro de Archivos
- La generación del archivo se realiza **en memoria** y se descarga a través del navegador, evitando problemas de permisos con el sistema de archivos (corrige error **EROFS**).

### 5. Nomenclatura Automática
- El nombre del archivo exportado se genera dinámicamente, incluyendo:
  - Nombre del nodo seleccionado.
  - Rango de fechas del filtro actual.  
- Esto facilita la identificación del archivo exportado.

---

## Cambios Técnicos
- Se añade la librería **xlsx** (*SheetJS*) como dependencia para manipulación de archivos Excel.
- Se modifica `durationUtils.ts` para permitir el formato de duración `hh:mm`.
- Se implementa la lógica de recolección de datos y generación del archivo en `statisticsView.ts`.
