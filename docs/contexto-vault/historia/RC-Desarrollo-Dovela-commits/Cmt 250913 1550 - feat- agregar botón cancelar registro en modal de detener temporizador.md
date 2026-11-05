---
type: Cmt
commit: 25ba5bb
branch: feat/mejoras-varias
tagVersion:
estado: 🟢
tags:
origen: "[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/RC - Desarrollo Dovela]]"
---

Implementar funcionalidad para cancelar registro de tiempo activo sin guardarlo

Problema resuelto:
  - Al detener un temporizador activo, el usuario solo podía guardar el registro
  - No existía forma de descartar/cancelar el registro si se inició por error
  - Obligaba a guardar tiempo no deseado en el sistema

Cambios implementados:
  - Nuevo parámetro isStoppingActiveTimer en TimeLogModal constructor
  - Botón "Cancelar Registro" (rojo) visible solo al detener temporizador activo
  - Método cancelActiveTimer() en modal y main.ts para limpiar estado
  - Actualización de stopTracking() para habilitar nueva funcionalidad
  - Preservación de compatibilidad con otros contextos del modal

Archivos modificados:
  - src/modules/moduloGTDv3/timeLogModal.ts
  - src/main.ts

  La funcionalidad permite mayor flexibilidad en el control de tiempo,
  solucionando el caso de uso donde el usuario necesita cancelar un
  registro iniciado por error sin crear entradas no deseadas.