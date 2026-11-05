---
type: Cmt
commit: c73bd29
branch: main
tagVersion: 
estado: 🟢
tags:
---

Se ha añadido una nueva vista al dashboard de GTD llamada **"En Progreso"**, diseñada para proporcionar un centro de mando enfocado en las tareas que el usuario ha marcado como activas (`- [/]`).

### **Cambios Principales**

**1. Reconocimiento del estado `[/]`:**

- Se ha modificado `parser.ts` para que reconozca el estado `[/]` como `'in-progress'`.
    
- Se ha actualizado el modelo de datos en `model.ts`, añadiendo un campo `status` a la interfaz `Task` para manejar los estados: `'incomplete'`, `'completed'` e `'in-progress'`.
    

**2. Nueva lógica de procesamiento:**

- Se ha creado un nuevo módulo `inProgressProcessor.ts` que aísla la lógica específica de esta vista.
    
- Este procesador filtra las tareas "en progreso", calcula estadísticas (total de tareas, tareas vencidas, tiempo estimado total) y las agrupa en secciones lógicas: **"Vencidas"**, **"Prioridades de Hoy"** y **"Otras Tareas"**.
    

**3. Implementación de la interfaz de usuario:**

- Se ha añadido un nuevo botón **"En Progreso"** a los controles de la vista en `htmlGenerator.ts`.
    
- Se ha creado la función `renderInProgressView` para generar el HTML de la nueva vista, incluyendo una cabecera con resumen y las listas de tareas agrupadas.
    
- Se ha actualizado el componente `view.ts` para manejar el estado de la nueva vista y renderizarla cuando está activa.
    

---

Este desarrollo proporciona una herramienta potente para que el usuario gestione su foco diario, permitiéndole visualizar rápidamente la carga de trabajo comprometida y priorizar de manera efectiva.
