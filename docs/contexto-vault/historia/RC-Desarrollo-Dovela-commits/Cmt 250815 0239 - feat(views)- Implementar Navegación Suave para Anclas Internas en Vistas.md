---
type: Cmt
commit: e7ba909
branch: feat/mejoras-varias
tagVersion: 
estado: 🟢
tags:
---

# feat(views): Implementar Navegación Suave para Anclas Internas en Vistas

Se añade una nueva funcionalidad para mejorar la **navegación interna** en varias vistas del plugin, incluyendo:

- **Foco**  
- **Listas GTD**  
- **Dashboard GTD**  
- **Panel de Actividad**  

---

## Descripción de la Funcionalidad

- Los enlaces de navegación internos (anclas que comienzan con `#`) ahora activan un **desplazamiento suave** (*smooth scroll*) hacia la sección correspondiente dentro de la misma vista.
- La funcionalidad se implementa capturando el evento de clic en elementos con la clase `.gtd-nav-link`, previniendo la acción por defecto y utilizando `scrollIntoView` para proporcionar una experiencia más **fluida** y **consistente** en todo el plugin.
