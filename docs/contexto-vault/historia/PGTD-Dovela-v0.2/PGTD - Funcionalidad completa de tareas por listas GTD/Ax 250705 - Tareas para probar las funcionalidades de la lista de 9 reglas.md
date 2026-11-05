---
type: Ax
estado: 🟢
tags:
---

## Tareas

-  **Tarea 1:** Revisar la propuesta del cliente Alpha ^task001
-  **Tarea 2:** Comprar leche de camino a casa #inbox ^task002
-  **Tarea 3:** Llamar al proveedor para confirmar entrega ⏳ 2025-07-04 ^task003
-  **Tarea 4:** Planificar la reunión de equipo [hI:: 10:00] [hF:: 09:00] ^task004
-  **Tarea 5:** Revisar informe semanal [w:: [[2025-W26]]] ^task005

-  **Tarea 6:** Enviar correo de seguimiento a María #cx-Email ^task006
-  **Tarea 7:** Preparar presentación para #px-Jefe en la #cx-Oficina 📅 2025-07-01 ^task007
-  **Tarea 8:** Comprar material para el prototipo #cx-Compras ⏳ 2025-07-05 ^task008
-  **Tarea 9:** Implementar feedback del sprint [w:: [[2025-W27]]] #cx-Dev ^task009

-  **Tarea 10:** Reunión de sincronización con el equipo de diseño 📅 2025-07-07 [hI:: 11:00] ^task010
-  **Tarea 11:** Cita con el dentista 📅 2025-07-08 [hI:: 16:30] [hF:: 17:00] ^task011
-  **Tarea 12:** Taller de formación 📅 2025-07-09 [hI:: 09:00] [2h] ^task012

-  **Tarea 13:** Terminar el borrador del informe ⏳ 2025-07-05 #cx-Redaccion ^task013
-  **Tarea 14:** Llamar a Ana para felicitarla 📅 2025-07-05 #px-Ana ^task014
-  **Tarea 15:** Revisar métricas de la campaña ⏳ 2025-07-03 #cx-Marketing ^task015

-  **Tarea 16:** #px-Carlos preparar el reporte de ventas mensual ^task016
-  **Tarea 17:** #px-Laura_Diseño crear los mockups para la nueva app ⏳ 2025-07-10 ^task017

-  **Tarea 18:** Lanzar la nueva web de la empresa #cx-ProyectoGTD ^task018
-  **Tarea 19:** Escribir el capítulo 3 del libro #cx-Entregable ^task019

-  **Tarea 20:** Aprender a tocar el ukelele #GTD-AlgunDia ^task020
-  **Tarea 21:** Organizar el garaje #GTD-EstaSemanaNo #cx-Casa ^task021

-  **Tarea 22:** Comprar los billetes para las vacaciones 📅 2025-08-01 #cx-Personal ^task022
-  **Tarea 23:** Escribir el post del blog sobre el viaje ⛔ ^task022 ^task023
-  **Tarea 24:** Planificar la estrategia del Q4 [w:: [[2025-W40]]] #cx-Estrategia ^task024


  ---

  ## Análisis de Clasificación por Tarea

  Aquí explico dónde debería aparecer cada tarea según las 9 reglas:

  Regla 1: Bandeja de Entrada (Inbox)
   * Tarea 1: Bandeja de Entrada. No tiene ningún metadato, tag, fecha o contexto. Es una captura pura.
   * Tarea 2: Bandeja de Entrada. Tiene el tag explícito #inbox.
   * Tarea 3: Bandeja de Entrada y Ojalá Hoy. Es una tarea con fecha pasada (ayer) pero sin contexto ni persona asignada. Requiere procesamiento.
   * Tarea 4: Bandeja de Entrada. Tiene un conflicto: la hora final (09:00) es anterior a la inicial (10:00).
   * Tarea 5: Bandeja de Entrada. La semana (W26) es pasada, pero no tiene contexto ni persona asignada, por lo que necesita ser procesada.


  Regla 2: Próximas Acciones (Next Actions)
   * Tarea 6: Próximas Acciones. Tiene un contexto (#cx-Email) y no depende de nada más.
   * Tarea 7: Próximas Acciones. Tiene contexto (#cx-Oficina) y persona (#px-Jefe), pero el contexto tiene prioridad. La fecha de inicio es pasada, por
     lo que está activa.
   * Tarea 8: Próximas Acciones. Tiene contexto (#cx-Compras) y la fecha deseada es hoy.
   * Tarea 9: Próximas Acciones. La semana (W27) es la actual y tiene un contexto (#cx-Dev).


  Regla 3: Calendario (Calendar)
   * Tarea 10: Calendario. Tiene fecha de inicio (📅 2025-07-07) y hora de inicio (hI:: 11:00).
   * Tarea 11: Calendario. Tiene fecha (📅), hora de inicio (hI::) y hora de fin (hF::).
   * Tarea 12: Calendario. Tiene fecha (📅), hora de inicio (hI::) y duración ([2h]).


  Regla 4: Ojalá Hoy y Vencidas
   * Tarea 13: Ojalá Hoy. Tiene fecha deseada (⏳) para hoy y no tiene hora de inicio. Se agrupará bajo el contexto "Redaccion".
   * Tarea 14: Ojalá Hoy. Tiene fecha de inicio (📅) para hoy y no tiene hora de inicio. Se agrupará bajo la persona "Ana".
   * Tarea 15: Vencidas. Tiene fecha deseada (⏳) pasada (2025-07-03) y tiene un contexto (#cx-Marketing), por lo que se clasifica como vencida y no va
     a Inbox.


  Regla 5: Asignadas o Delegadas
   * Tarea 16: Asignadas o Delegadas. Tiene una persona asignada (#px-Carlos) y no tiene contexto.
   * Tarea 17: Asignadas o Delegadas. Tiene persona (#px-Laura_Diseño) y una fecha deseada. Como no hay contexto, se considera delegada.


  Regla 6: Proyectos
   * Tarea 18: Proyectos. Tiene el contexto #cx-ProyectoGTD.
   * Tarea 19: Proyectos. Tiene el contexto #cx-Entregable.


  Regla 7: Algún Día / Tal Vez
   * Tarea 20: Algún Día / Tal Vez. Tiene el tag explícito #GTD-AlgunDia.


  Regla 8: Esta Semana No
   * Tarea 21: Esta Semana No. Tiene el tag explícito #GTD-EstaSemanaNo.


  Regla 9: En Pausa
   * Tarea 22: En Pausa. La fecha de inicio (📅 2025-08-01) es futura.
   * Tarea 23: En Pausa. Depende (⛔) de la Tarea 22 (^task022), que aún no está completada.
   * Tarea 24: En Pausa. Está planificada para una semana futura (W40).

  ---