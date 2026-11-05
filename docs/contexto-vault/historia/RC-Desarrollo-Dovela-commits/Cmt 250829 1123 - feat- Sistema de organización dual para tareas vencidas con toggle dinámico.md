---
type: Cmt
commit: 9470de5
branch: feat/mejoras-varias
tagVersion:
estado: 🟢
tags:
---

Implementa sistema de organización bidireccional para lista "Vencidas":
  - Modo fecha-primero: agrupa por fecha de vencimiento, luego por contexto/persona
  - Modo contexto-primero: agrupa por contexto/persona, luego por fecha
  - Toggle dinámico con indicadores visuales (📅→📋 ↔ 📋→📅)

  Cambios técnicos:
  - Convierte Overdue de Task[] a Map<string, Task[]> para agrupación jerárquica
  - Implementa addTaskToOverdueWithGrouping() con lógica dual
  - Añade renderOverdueGroupedTasks() para renderizado en cascada
  - Sincroniza orden de listas entre navegación y renderizado
  - Aplica cambios a GTD Dashboard y Vista de Foco

  Correcciones TypeScript:
  - Añade validaciones undefined para claves de Map
  - Corrige método .includes() en estructuras Map
  - Resuelve errores de compilación en modo estricto
