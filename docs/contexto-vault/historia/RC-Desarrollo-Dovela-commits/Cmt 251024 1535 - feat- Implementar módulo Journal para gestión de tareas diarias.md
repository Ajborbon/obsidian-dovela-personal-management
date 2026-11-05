---
type: Cmt
commit: 7645c42
branch: feat/journal-sistema-tareas-diarias
tagVersion:
estado: 🟢
tags:
origen: "[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/RC - Desarrollo Dovela]]"
---

Documentación: [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Dovela v0.9/PGTD 251024 - Funcion de revisión de tareas desde la nota diaria/Ax 251024 - Documentación Sistema de Journal - Tareas Diarias y Semanales|Ax 251024 - Documentación Sistema de Journal - Tareas Diarias y Semanales]]


Se añade un nuevo módulo completo de Journal que permite gestionar tareas 
diarias mediante carpetas jerárquicas (Año/Trimestre/Mes/Semana).

Características implementadas:
- JournalAPI: Núcleo del sistema con funciones para crear estructura de 
  carpetas, validar configuración, y calcular rutas de periodos temporales
- JournalFolderManager: Creación automática de carpetas jerárquicas con 
  notas de índice y configuración personalizable
- JournalTaskRenderer: Renderizado en tiempo real de tareas diarias con 
  filtros, contadores, y acciones interactivas (check/uncheck)
- Configuración en Settings: Panel completo con vista previa en vivo, 
  validación de estructura de carpetas, y patrón personalizable de semanas
- Integración con GTD: Parser mejorado para semanas en formato wikilink 
  (ej: [w::[[2025-W43]]])
- Estilos CSS: Diseño responsive con soporte para tema claro/oscuro

Archivos nuevos:
- src/modules/moduloJournal/journalAPI.ts
- src/modules/moduloJournal/journalFolderManager.ts
- src/modules/moduloJournal/journalTaskRenderer.ts
- Documentacion/Journal-Sistema-Tareas-Diarias.md

Archivos modificados:
- src/main.ts: Inicialización del JournalAPI
- src/modules/moduloGTDv3/model.ts: Añadir JournalSettings al modelo
- src/modules/moduloGTDv3/parser.ts: Mejorar regex para semanas
- src/modules/moduloGTDv3/settingsTab.ts: Añadir sección de configuración
- styles.css: Estilos para el renderizador de tareas