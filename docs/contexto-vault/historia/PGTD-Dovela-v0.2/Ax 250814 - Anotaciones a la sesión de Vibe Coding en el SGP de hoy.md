---
type: Ax
estado: 🟢
tags:
---
- Validar en que Commit voy.
	- [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/RC - Desarrollo Dovela|RC - Desarrollo Dovela]]
	- [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/Cmt 250715 2229 - fix(Core)- Corrige errores de inicialización y estado en Smart Inbox y Time Tracker|Cmt 250715 2229 - fix(Core)- Corrige errores de inicialización y estado en Smart Inbox y Time Tracker]]
- Establecer el contexto de lo que voy a realizar a la IA. 
	- Este desarrollo lo tengo organizado por "modulos" los cuales inicialmente estan separados por carpetas. Estan el modulo de Actividad, el Foco y el GTDv3. En el plugin tengo la posibilidad de registrar los tiempos que estoy llevando en mis asuntos. El comando mas visible es "Control de Tiempo: Iniciar Temporizador para la nota Activa." el cual al lanzar el plugin se establece como boton en el ribbon. Quiero que me digas, estas funcionalidades estan dentro de que "Modulo"?
		- los archivos relacionados con la lógica del control de tiempo, como timeTrackerService.ts, timeTrackerView.ts y timeLogModal.ts, se encuentran dentro de src/modules/moduloGTDv3/.
	- Quiero que analices toda la estructura del Timetracker y entiendas como funciona porque vamos a hacer algunas mejoras en ese sistema. Comprende como funcionan La vista "Cronograma" dentro de la vista "GTD Dashboard" y como se almacenan actualmente los registros de tiempo en el archivo JSON. Dame una explicación general de lo que comprendes.
		- [[Ax 250814 - Entendimiento del time Tracker|Ax 250814 - Entendimiento del time Tracker]]
	...
	Muchas modificaciones.