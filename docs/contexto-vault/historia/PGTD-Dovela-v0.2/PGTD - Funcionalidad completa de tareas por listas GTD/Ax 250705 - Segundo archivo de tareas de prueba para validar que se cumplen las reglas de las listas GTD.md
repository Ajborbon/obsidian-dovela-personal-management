---
type: Ax
estado: 🟢
tags:
---

## Tareas
 Fichero de Tareas de Prueba Definitivo (Test-Definitivo.md)



- [-] **T-IN-01:** Organizar los archivos descargados ^tst01
- [-] **T-IN-02:** Llamar al seguro #inbox ^tst02
- [-] **T-IN-03:** Sincronizar agenda [hI:: 14:00] [hF:: 13:00] ^tst03
- [-] **T-IN-04:** Comprar billetes de tren 📅 2025-07-05 ^tst04
- [-] **T-IN-05:** Revisar el borrador del Q3 [w:: [[2025-W27]]] ^tst05

- [-] **T-NA-01:** Enviar reporte de gastos #cx-Admin ^tst06
- [-] **T-NA-02:** Preparar la llamada con el cliente 🛫 2025-07-01 #cx-Llamadas ^tst07
- [-] **T-NA-03:** Comprar regalo para Ana ⏳ 2025-07-06 #cx-Compras ^tst08
- [-] **T-NA-04:** #px-David revisar la documentación del API #cx-Dev [w:: [[2025-W27]]] ^tst09

- [-] **T-CA-01:** Reunión de equipo semanal 📅 2025-07-07 [hI:: 10:00] ^tst10
- [-] **T-CA-02:** Cita con el médico 📅 2025-07-08 [hI:: 16:30] [hF:: 17:00] ^tst11

- [-] **T-HT-01:** Escribir el post para el blog 📅 2025-07-06 #cx-Marketing ^tst12
- [-] **T-HT-02:** Hacer la colada ⏳ 2025-07-06 #cx-Casa ^tst13

- [-] **T-OV-01:** Enviar factura a cliente XYZ 📅 2025-06-30 #cx-Finanzas ^tst14
- [-] **T-OV-02:** #px-Marta confirmar asistencia al evento ⏳ 2025-07-01 ^tst15

- [-] **T-AS-01:** #px-Juan_Contabilidad procesar las nóminas ^tst16
- [-] **T-AS-02:** #px-Laura_Diseño entregar los nuevos iconos 📅 2025-07-15 ^tst17

- [-] **T-PR-01:** Planificar el lanzamiento del producto V2 #cx-ProyectoGTD ^tst18
- [-] **T-PR-02:** Borrador del informe anual #cx-Entregable ^tst19

- [-] **T-SM-01:** Investigar sobre un viaje a Nueva Zelanda #GTD-AlgunDia ^tst20
- [-] **T-TW-01:** Limpiar el trastero #GTD-EstaSemanaNo ^tst21

- [-] **T-PA-01:** Empezar a preparar los impuestos 🛫 2025-09-01 #cx-Finanzas ^tst22
- [-] **T-PA-02:** Revisar el contrato final ⛔ tst16 ^tst23
- [-] **T-PA-03:** Definir los OKRs del próximo trimestre [w:: [[2025-W40]]] #cx-Estrategia ^tst24

- [-] **T-EC-01:** Agendar vacaciones de invierno 📅 2025-11-10 #cx-Personal ^tst25


  ---

  Análisis de Clasificación (Según el Nuevo Código)


  1. Bandeja de Entrada (Inbox)
   * T-IN-01: Correcto. Sin metadatos, cae por defecto en el Inbox.
   * T-IN-02: Correcto. El tag #inbox la envía directamente al Inbox.
   * T-IN-03: Correcto. El conflicto de horas (hasConflict: true) la envía al Inbox.
   * T-IN-04: Correcto. Fecha pasada (2025-07-05) pero sin contexto ni asignación. La regla específica del gtdProcessor la captura y la envía al Inbox
     para que sea procesada.
   * T-IN-05: Correcto. Semana actual (W27) pero sin contexto ni asignación. Misma lógica que la anterior, va al Inbox.


  2. Próximas Acciones (Next Actions)
   * T-NA-01: Correcto. Tiene contexto y no tiene fecha, es una acción disponible.
   * T-NA-02: Correcto. Tiene contexto y su fecha de inicio 🛫 es pasada.
   * T-NA-03: Correcto. Tiene contexto y su fecha deseada ⏳ es hoy.
   * T-NA-04: Correcto. Tiene contexto y la semana es la actual. El gtdProcessor prioriza el contexto sobre la asignación para esta lista.


  3. Calendario (Calendar)
   * T-CA-01 & T-CA-02: Correcto. Ambas tienen el símbolo 📅 y una hora de inicio [hI::], cumpliendo la regla estricta del Calendario.


  4. Ojalá Hoy (Hope Today)
   * T-HT-01 & T-HT-02: Correcto. Ambas son para hoy (2025-07-06), no tienen hora de inicio y usan los símbolos 📅 y ⏳. El htmlGenerator las ordenará,
     dando prioridad visual a la T-HT-01 (📅).


  5. Vencidas (Overdue)
   * T-OV-01 & T-OV-02: Correcto. Ambas tienen fechas pasadas y tienen contexto o asignación, por lo que se clasifican como Vencidas y no van al Inbox.


  6. Asignadas o Delegadas (Assigned)
   * T-AS-01: Correcto. Solo tiene asignación (#px-) y ningún contexto.
   * T-AS-02: Correcto. Tiene asignación y no tiene contexto. La fecha futura con 📅 no la envía a "En Pausa", lo cual es correcto según las nuevas
     reglas.


  7. Proyectos (Projects)
   * T-PR-01 & T-PR-02: Correcto. Sus contextos #cx-ProyectoGTD y #cx-Entregable las colocan aquí.


  8. Algún Día / Tal Vez & Esta Semana No
   * T-SM-01 & T-TW-01: Correcto. Los tags #GTD-AlgunDia y #GTD-EstaSemanaNo funcionan como selectores directos.


  9. En Pausa (Paused)
   * T-PA-01: Correcto. La regla ahora es estricta: solo la fecha futura con el símbolo 🛫 la pone En Pausa.
   * T-PA-02: Correcto. La dependencia ⛔ a una tarea no completada la pone En Pausa.
   * T-PA-03: Correcto. La semana futura [w::] la pone En Pausa.


  Caso Especial (Edge Case)
   * T-EC-01: Correcto. Tiene una fecha futura (2025-11-10) con el símbolo 📅. No cumple la regla de "En Pausa" (que exige 🛫), ni la de "Calendario"
     (porque es futura y la procesamos de otra forma), ni ninguna otra. Por tanto, el código la dejará caer hasta el final y la clasificará como Inbox
     para que el usuario decida qué hacer. Este es el comportamiento más seguro y predecible.