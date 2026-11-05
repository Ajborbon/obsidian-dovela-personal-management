---
type: Cmt
commit: 6f501fd
branch: main
tagVersion: 
estado: 🟢
tags:
---
  

Este commit introduce varias mejoras clave en el módulo GTD:

1.  **Detección de Conflictos (parser.ts):**
    *   Se añade la propiedad `hasConflict` al modelo de `Task`.
    *   El parser ahora detecta inconsistencias en las tareas (ej. horas, duración) y marca las tareas conflictivas para revisión en el Inbox.

2.  **Refactorización del Procesador GTD (gtdProcessor.ts):**
    *   Se refactorizan y amplían las funciones de ayuda para fechas.
    *   Se reestructura la lógica de clasificación para manejar la nueva lista 'Vencidas' y procesar las reglas de forma más robusta.

3.  **Mejoras en la Interfaz (htmlGenerator.ts):
    *   La vista ahora renderiza la lista 'Vencidas'.
    *   Se implementa la agrupación por contexto y el ordenamiento por prioridad en la lista 'Ojalá Hoy'.

Estos cambios sientan las bases para el nuevo motor de clasificación y mejoran la integridad de los datos.

