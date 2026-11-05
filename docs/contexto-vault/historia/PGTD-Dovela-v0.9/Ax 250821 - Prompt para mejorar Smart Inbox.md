---
type: Ax
estado: 🟢
tags:
---

# Prompt: Mejora UX del Comando Smart Inbox

**Contexto:** Tengo un comando dentro del plugin llamado **“Smart Inbox”** que permite a los usuarios asignar contextos, personas y estados GTD a las tareas usando los prefijos #cx-, #px- y #gtd-. Necesito mejorar significativamente la experiencia de usuario implementando un sistema de menús contextuales en cascada.

## Comportamiento Actual

**Sistema de etiquetado existente:**

- **#cx-** → Contextos (ej: #cx-oficina, #cx-llamadas, #cx-casa)
- **#px-** → Personas asignadas (ej: #px-juan, #px-maria, #px-carlos)
- **#gtd-** → Estados/Vistas GTD (ej: #GTD-EstaSemanaNo , #GTD-AlgunDia )

**Método actual:** El usuario debe escribir manualmente el prefijo completo y en ese momento se muestra un menu contextual con las opciones, de acuerdo al prefijo. De alli termina de escribir el valor o lo elige.

## Mejora Requerida: Sistema de Menús Contextuales en Cascada

### Paso 1: Trigger Inicial

**Activador:** Cuando el usuario escriba el símbolo **#** (numeral)
**Resultado:** Aparece un menú contextual con las tres opciones principales

```
Menú Principal (al escribir #):
┌─────────────────────────────┐
│ cx-  │ Contextos            │
│ px-  │ Personas Asignadas   │  
│ gtd- │ Estados GTD          │
└─────────────────────────────┘
```

### Paso 2: Menú Secundario Dinámico

**Activador:** Al seleccionar una opción del menú principal
**Resultado:** Aparece un segundo menú contextual con las opciones disponibles para esa categoría

#### Si eligió “cx-” (Contextos):

```
Menú de Contextos:
┌─────────────────────────┐
│ oficina                 │
│ casa                    │
│ llamadas                │
│ reuniones               │
│ urgente                 │
│ [otros contextos...]    │
└─────────────────────────┘
```

#### Si eligió “px-” (Personas):

```
Menú de Personas:
┌─────────────────────────┐
│ juan                    │
│ maria                   │
│ carlos                  │
│ sofia                   │
│ equipo                  │
│ [otras personas...]     │
└─────────────────────────┘
```

#### Si eligió “gtd-” (Estados GTD):

```
Menú de Estados GTD:
┌─────────────────────────┐
│ EstaSemanaNo            │
│ AlgunDia                │
└─────────────────────────┘
```

## Especificaciones Técnicas

### Comportamiento del Menú

1. **Posicionamiento:** El menú debe aparecer cerca del cursor/posición de escritura
2. **Navegación:** Permitir navegación con teclas de flecha (↑↓) y Enter para seleccionar
3. **Filtrado:** Opcional - permitir escribir para filtrar opciones en tiempo real
4. **Escape:** Tecla ESC o clic fuera del menú para cancelar
5. **Inserción:** Al seleccionar, insertar automáticamente el tag completo (ej: #cx-oficina)

### Fuente de Datos

**Las opciones de cada menú secundario deben obtenerse de:**

- **Contextos:** Lista de contextos existentes en el sistema
- **Personas:** Lista de personas ya utilizadas en tareas previas
- **Estados GTD:** Lista predefinida de estados/vistas GTD disponibles

### Integración con Comportamiento Existente

- **Conservar funcionalidad actual:** El usuario debe poder seguir escribiendo manualmente si prefiere
- **Compatibilidad:** No romper el funcionamiento actual del comando Smart Inbox
- **Múltiples tags:** Permitir agregar múltiples tags en la misma tarea (ej: #cx-oficina #px-juan)

## Ejemplos de Flujo de Usuario

### Ejemplo 1: Agregar Contexto

```
Usuario escribe: "Revisar propuesta #"
→ Aparece menú principal
→ Usuario selecciona "cx-"
→ Aparece menú de contextos
→ Usuario selecciona "oficina"
→ Resultado: "Revisar propuesta #cx-oficina"
```

### Ejemplo 2: Múltiples Tags

```
Usuario escribe: "Llamar cliente #"
→ Selecciona "cx-" → "llamadas"
→ Resultado: "Llamar cliente #cx-llamadas"
→ Usuario continúa escribiendo " #"
→ Aparece menú principal nuevamente
→ Selecciona "px-" → "juan"
→ Resultado final: "Llamar cliente #cx-llamadas #px-juan"
```

## Solicitud de Implementación

Desarrolla la funcionalidad para el comando **Smart Inbox** que incluya:

1. **Detector de trigger** (#) que active el menú principal
2. **Menú contextual principal** con las tres opciones (cx-, px-, gtd-)
3. **Menús secundarios dinámicos** que muestren opciones específicas por categoría
4. **Sistema de navegación** intuitivo (teclado + mouse)
5. **Inserción automática** del tag completo al seleccionar
6. **Compatibilidad total** con el funcionamiento actual del Smart Inbox
7. **Soporte para múltiples tags** en la misma entrada

**Objetivo:** Reducir significativamente el tiempo y esfuerzo requerido para etiquetar tareas, mejorando la productividad y experiencia de usuario del comando Smart Inbox.