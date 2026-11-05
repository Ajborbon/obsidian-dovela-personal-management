---
type: Ax
estado: 🔵
tags:
---
# Adaptación del Selector de Estado al Nuevo Plugin

## Objetivo

Migrar y modernizar la funcionalidad del selector visual de estado de notas, originalmente implementada en el plugin `addOnsAPI`, para integrarla en el nuevo plugin `obsidian-dovela-personal-management` siguiendo buenas prácticas de separación de lógica.

---

## Cambios realizados

### 1. **Separación de responsabilidades**

- **Lógica de UI**:  
  Se creó/actualizó el archivo  **src/ui/[EstadoSelectorAPI.ts](file:///Users/andresborbon/Library/CloudStorage/GoogleDrive-<CUENTA>/Mi%20unidad/Desarrollo%20Obsidian/Desarrollo%202025/.obsidian/plugins/obsidian-dovela-personal-management/src/ui/EstadoSelectorAPI.ts)** para contener únicamente la función `crearSelectorEstado`, responsable de construir el componente visual (botones, estilos, eventos de UI) y notificar cambios de estado mediante un callback.

- **Lógica de integración/API**:  
  Se creó/actualizó el archivo **src/api/[EstadoSelectorAPI.ts](file:///Users/andresborbon/Library/CloudStorage/GoogleDrive-<CUENTA>/Mi%20unidad/Desarrollo%20Obsidian/Desarrollo%202025/.obsidian/plugins/obsidian-dovela-personal-management/src/api/EstadoSelectorAPI.ts)** para exponer la función `generarSelectorEstado`, que:
	  - Recibe los parámetros de la nota y el estado actual.
	  - Usa la función de UI para mostrar el selector.
	  - Implementa el callback para actualizar el estado en el frontmatter de la nota usando la API de Obsidian.
	  - Muestra notificaciones de éxito/error.

### 2. **Exposición de la API**

- En `src/main.ts`, se expone la función `generarSelectorEstado` como parte de la API pública del plugin, permitiendo su uso desde otros contextos o para depuración.

### 3. **Compatibilidad y buenas prácticas**

- Se mantiene la compatibilidad visual y funcional con el selector original.
- Se mejora la mantenibilidad y escalabilidad del código al separar la lógica de presentación y la lógica de integración con Obsidian.

---

## Ventajas de la nueva arquitectura

- **Reutilización**: La UI puede ser reutilizada en otros contextos o plugins.
- **Mantenibilidad**: Cambios en la lógica de negocio o en la UI pueden hacerse de forma independiente.
- **Claridad**: El código es más fácil de entender y documentar.

---

## Archivos clave
- [src](file:///Users/andresborbon/Library/CloudStorage/GoogleDrive-<CUENTA>/Mi%20unidad/Desarrollo%20Obsidian/Desarrollo%202025/.obsidian/plugins/obsidian-dovela-personal-management/src)
	- `src/ui/EstadoSelectorAPI.ts` — Lógica de presentación (UI)
	- `src/api/EstadoSelectorAPI.ts` — Lógica de integración/API
	- `src/main.ts` [[Ax 250611 - main.ts de la version 0.1 de Dovela|main.ts de la version 0.1 de Dovela]] — Exposición de la API pública del plugin

---

## Uso

Para mostrar el selector de estado en una nota desde el nuevo plugin, se debe llamar a:

```typescript
await window.dovelaPersonalManagementAPI.generarSelectorEstado({
  notaActualPath: 'ruta/de/la/nota.md',
  estadoActual: '🟡'
});
```

### Bloque dataviewjs ajustado
```js
// Bloque dataviewjs para selector de estado con el nuevo plugin
try {
    // Acceder al nuevo plugin y sus APIs
    const gp = app.plugins.plugins['dovela-personal-management'];
    
    // Verificar que el plugin está disponible
    if (!gp || !gp.addOnsAPI) {
        dv.paragraph("Error: No se pudo acceder a la API del nuevo plugin.");
    } else {
        // Limpiar el contenedor y preparar para la UI
        dv.container.innerHTML = '';
        
        // Llamar a la función del plugin para generar el selector de estado
        const params = {
            notaActualPath: dv.current().file.path,
            estadoActual: dv.current().estado
        };
        
        // Obtener y mostrar el selector de estado
        debugger;
        const estadoSelector = await gp.addOnsAPI.generarSelectorEstado(params);
        
        if (estadoSelector) {
            // Añadir el selector al contenedor
            dv.container.appendChild(estadoSelector);
        } else {
            dv.paragraph("Error al generar el selector de estado.");
        }
    }
} catch (error) {
    console.error("Error en el selector de estado:", error);
    dv.paragraph("Error: " + error.message);
}
```
---
