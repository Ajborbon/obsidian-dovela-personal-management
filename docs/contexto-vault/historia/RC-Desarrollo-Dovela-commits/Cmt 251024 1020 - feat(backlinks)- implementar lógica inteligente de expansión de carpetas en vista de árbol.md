---
type: Cmt
commit: 396fe22
branch: feat/mejoras-varias
tagVersion:
estado: 🟢
tags:
origen: "[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/RC - Desarrollo Dovela]]"
---

**Ojo: Este commit fue para almacenar cambios que tenia y que no habia guardado desde la ultima sesion de desarrollo.**

  feat(backlinks): implementar lógica inteligente de expansión de carpetas en vista de árbol

  - Agregar método shouldExpandFolder() con lógica contextual de expansión
  - Expandir automáticamente nivel 0 (carpetas principales)
  - Expandir ruta hacia la nota activa cuando existe
  - En modo expandido: expandir hasta nivel 2 para mejor navegación
  - Reemplazar lógica fija de expansión por sistema adaptativo
  - Mejorar experiencia de usuario con navegación más intuitiva
  - Mantener consistencia con el seguimiento de nota actual

  Los cambios incluyen:
  • Nueva interfaz FolderNode para estructura jerárquica
  • Sistema completo de vista de árbol expandible
  • Visor de pestañas abiertas con agrupación por paneles
  • 400+ líneas de estilos CSS para ambas vistas
  • Manejo inteligente de archivos actuales y modo expandido
  • Soporte para abrir archivos en nuevas pestañas (Cmd/Ctrl+click)
  • Detección automática de cambios de archivo activo
  • Navegación jerárquica mejorada en vistas GTD y Foco