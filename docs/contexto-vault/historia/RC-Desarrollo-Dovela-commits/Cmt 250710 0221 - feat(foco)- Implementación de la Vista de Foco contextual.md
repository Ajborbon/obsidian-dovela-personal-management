---
type: Cmt
commit: 45a56ed
branch: feat/contextual-focus-view
tagVersion: 
estado: 🟢
tags:
---

Se introduce la "Vista de Foco", una nueva funcionalidad diseñada para analizar y visualizar tareas en un contexto delimitado, en lugar de en toda la bóveda.

Esta vista se activa desde una nota específica y construye una jerarquía de tareas basada en:
1. La nota activa.
2. Todas las notas en la misma carpeta y sus subcarpetas.
3. Notas vinculadas desde el conjunto anterior, con una profundidad de hasta 2 niveles de enlaces.

Para garantizar la estabilidad, esta funcionalidad se ha construido en un nuevo módulo (`moduloFoco`), duplicando y adaptando la lógica de la vista GTD existente, evitando así regresiones en las vistas globales.

Se han añadido dos puntos de entrada para el usuario:
- Un nuevo comando en la paleta: "Dovela: Mostrar Vista de Foco del Proyecto".
- Un nuevo icono en la paleta izquierda para un acceso rápido.
