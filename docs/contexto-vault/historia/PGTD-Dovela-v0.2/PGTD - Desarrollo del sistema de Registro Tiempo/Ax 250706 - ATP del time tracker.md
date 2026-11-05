---
type: Ax
estado: 🟢
tags:
---

# ATP (Acceptance Test Protocol) - Lista de Características


##   Feature 1: Registro de Tiempo en Vivo
* ATP-1.1: Dado que el panel "Time Tracker" está visible, cuando selecciono una tarea de la lista y hago clic en "▶️ Iniciar", entonces el cronómetro
     empieza a contar, el botón cambia a "⏹️ Detener" y la tarea seleccionada se bloquea.
   * ATP-1.2: Dado que un temporizador está activo, cuando miro la barra de estado de Obsidian, entonces veo un indicador con el ícono del reloj y el
     tiempo transcurrido.
   * ATP-1.3: Dado que un temporizador está activo, cuando hago clic en "⏹️ Detener", entonces aparece un modal con la hora de inicio y fin
     pre-rellenadas.
   * ATP-1.4: Dado que seleccioné una tarea de la lista GTD (p.ej., - [>] Mi Tarea), cuando detengo el temporizador y se abre el modal, entonces el campo
     "Notas de la Sesión" está pre-rellenado con "Mi Tarea".
   * ATP-1.5: Dado que el modal de fin de sesión está abierto, cuando hago clic en "Guardar Sesión", entonces el registro se guarda en timelogs.json y la
     vista de estadísticas se actualiza.


##   Feature 2: Registro de Tiempo Manual
* ATP-2.1: Dado que estoy en el panel "Time Tracker", cuando hago clic en "+ Registrar Intervalo Manual", entonces se abre un modal con un formulario
     en blanco.
   * ATP-2.2: Dado que el modal de registro manual está abierto, cuando selecciono una tarea, ingreso una duración (o horas de inicio/fin) y guardo,
     entonces el registro se guarda correctamente y las estadísticas se actualizan.


##   Feature 3: Persistencia y Recuperación
* ATP-3.1: Dado que he guardado al menos una sesión, cuando reviso el archivo .obsidian/plugins/obsidian-dovela-personal-management/timelogs.json,
     entonces el archivo existe y contiene los datos correctos en formato JSON.
   * ATP-3.2: Dado que un temporizador está activo, cuando cierro y vuelvo a abrir Obsidian, entonces aparece una notificación preguntando si deseo
     guardar la sesión interrumpida.
   * ATP-3.3: Dado la situación anterior, cuando elijo "Guardar", entonces el registro de tiempo se guarda correctamente.


##   Feature 4: Vista de Estadísticas
* ATP-4.1: Dado que he registrado 45 min en .../AI - Doc/Tarea1.md y 30 min en .../PGTD - Dovela/Tarea2.md, cuando veo las estadísticas, entonces "AI
- Doc" muestra 45 min, "PGTD - Dovela" muestra 30 min, y la carpeta padre común a ambos muestra un total de 1h 15m.
* ATP-4.2: Dado que tengo registros de ayer y hoy, cuando selecciono el filtro "Hoy", entonces solo se muestran y agregan los tiempos de los registros
     de hoy.
   * ATP-4.3: Dado que la vista de estadísticas está visible, cuando guardo un nuevo registro de tiempo, entonces la vista se actualiza automáticamente
     sin necesidad de recargar el dashboard.


##   Feature 5: Regresión y UX
* ATP-5.1: Dado que la nueva funcionalidad está implementada, cuando navego a la pestaña "Vista GTD" del dashboard, entonces todas las listas (Inbox,
     Proyectos, etc.) funcionan exactamente como antes.
   * ATP-5.2: Dado que la lista de tareas para el selector de tiempo está poblada, entonces no hay rutas de notas duplicadas.


  Este plan nos da una hoja de ruta clara y el ATP nos asegura que el resultado final sea robusto, funcional y cumpla con todos tus requerimientos.
  Podemos empezar con la Fase 1 cuando estés listo.