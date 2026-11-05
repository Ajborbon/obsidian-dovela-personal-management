---
type: Cmt
commit: 64b124c
branch: feature/time-tracker-dashboard
tagVersion: 
estado: 🟢
tags:
---
Este commit introduce la funcionalidad completa de **seguimiento de tiempo (Time Tracker)** en el plugin, permitiendo a los usuarios registrar y visualizar de forma granular y jerárquica el tiempo dedicado a sus tareas.

#### Principales características del Time Tracker:

- Registro de tiempo en vivo mediante temporizador.
    
- Registro manual de sesiones pasadas, incluyendo fecha y notas.
    
- Dashboard de estadísticas con vista jerárquica del tiempo acumulado por proyectos y áreas.
    
- Filtros de tiempo predefinidos (Hoy, Semana, Mes, Año, Siempre) y personalizados.
    
- Gestión automática de sesiones interrumpidas al cerrar o recargar Obsidian.
    
- Indicador visual del temporizador activo en la barra de estado de Obsidian.
    

#### Corrección de regresiones:

Este commit también resuelve varias regresiones introducidas durante el desarrollo del Time Tracker, restaurando funcionalidades clave del **dashboard GTD**, incluyendo:

- Expansión y colapso global en la vista jerárquica.
    
- Apertura de notas al hacer clic sobre ellas.
    
- Visibilidad del breadcrumb de tareas.
    
- Filtros por contexto y persona en las listas GTD.
    
- Agrupación y ordenación en la vista "En Progreso".
    

Además, se han realizado ajustes y refactorizaciones internas para garantizar la **robustez, modularidad y mantenibilidad** del código.

