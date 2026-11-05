---
type: Cmt
commit: 111ce0f
branch: feature/time-tracker-dashboard
tagVersion: 
estado: 🟢
tags:
---
Este commit introduce una serie de mejoras importantes en la funcionalidad y la experiencia de usuario del módulo de seguimiento de tiempo (Time Tracker).

### Cambios clave:

1. **Rediseño de la Interfaz de Usuario (UX):**
    
    - La vista del Time Tracker ha sido completamente rediseñada en formato de dashboard de dos columnas, mejorando la legibilidad y organización de los controles y estadísticas.
        
    - Se han introducido _tarjetas_ (`control-card`) para agrupar lógicamente los elementos de control (temporizador, selección de tarea).
        
    - Se ha mejorado la presentación de los filtros de fecha y los controles de expansión/colapso del árbol.
        
2. **Vista de Estadísticas Mejorada:**
    
    - La tabla de estadísticas ahora presenta una estructura jerárquica expandible y contraíble, facilitando la navegación por carpetas y archivos.
        
    - Las columnas de duración y porcentaje se muestran de forma más flexible junto al nombre de la tarea o carpeta, permitiendo que los nombres largos se ajusten en múltiples líneas.
        
    - Se ha añadido una barra de progreso visual junto al porcentaje, facilitando la comprensión del peso de cada elemento.
        
    - Se incluye un indicador claro del tiempo total registrado para el período seleccionado.
        
    - Las filas de tareas son ahora expandibles, mostrando detalles de cada registro de tiempo individual (fecha, día de la semana, horas de inicio/fin, duración y notas).
        
3. **Centralización y Sincronización del Estado del Temporizador:**
    
    - La lógica de inicio, detención y actualización del temporizador se ha centralizado en el archivo principal del plugin (`main.ts`), asegurando que el estado y la visualización del temporizador se mantengan sincronizados incluso al cerrar y volver a abrir la pestaña del GTD Dashboard.
        
    - La lista de tareas disponibles (`availableTasks`) para el selector del temporizador también se ha movido a `main.ts`, garantizando que el modal de registro de tiempo siempre tenga acceso a la lista completa, evitando que el selector aparezca vacío.
        
4. **Mejoras de Usabilidad y Correcciones:**
    
    - Al hacer clic en el indicador del temporizador en la barra de estado, se abre o enfoca directamente la vista del Time Tracker dentro del GTD Dashboard.
        
    - Se han añadido botones globales para "Expandir Todo" y "Colapsar Parcialmente" el árbol de estadísticas, permitiendo dejar abiertos los dos primeros niveles al colapsar.
        
    - Se corrigió un error donde los inputs de fecha del filtro "Personalizado" no se mostraban correctamente.
        
    - Se solucionó un problema donde el indicador de control de tiempo en el GTD Dashboard no se actualizaba en tiempo real al iniciar un registro manual.
        

---

Estos cambios mejoran significativamente la **robustez**, **estética** y **experiencia de usuario** del módulo de seguimiento de tiempo.

