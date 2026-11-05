---
type: Cmt
commit: 5e417d1
branch: feature/smart-inbox
tagVersion: 
estado: 🟢
tags:
---
Este commit introduce varias mejoras clave en la vista de "Time Tracker" para enriquecer la experiencia de usuario y añadir funcionalidades solicitadas.
    
- **Estado Inicial del Árbol:** Se ajusta la vista de árbol para que inicie con el estado "Colapsar Parcialmente" por defecto, mostrando
  los dos primeros niveles expandidos y mejorando la consistencia visual al cargar la vista.
- **Resumen de Estadísticas Mejorado:** Se rediseña el resumen de estadísticas del período, mostrando ahora el "Tiempo Total" y el total
  de "Registros" en bloques separados para una mayor claridad y una lectura más rápida.
- **Contador de Registros en el Árbol:** Se añade un contador de registros en formato de píldora a cada elemento del árbol de estadísticas . Esto proporciona más contexto en la misma línea, junto a la duración acumulada.
- **Navegación a Tarea Activa:** Se implementa un botón "Ir a la Tarea" (↗️) en el panel de control del temporizador. Este permite navegar directamente a la nota o a la línea específica de la tarea que se está registrando, mejorando significativamente el flujo de trabajo.
