---
type: PGTD
estado: 🔵
tags:
origen: "[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Dovela v0.2/PGTD - Dovela v0.2|PGTD - Dovela v0.2]]"
---

## Descripción


## Historial
[[Ax 250706 - Estructuración del nuevo sistema de registro tiempo|Ax 250706 - Estructuración del nuevo sistema de registro tiempo]]
[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Dovela v0.2/PGTD - Desarrollo del sistema de Registro Tiempo/Ax 250706 - Plan de implementación de la solución del Time Tracker|Ax 250706 - Plan de implementación de la solución del Time Tracker]]
[[Ax 250706 - ATP del time tracker|Ax 250706 - ATP del time tracker]]
[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/Cmt 250706 2209 - feat- Implementación completa del Time Tracker y corrección de regresiones|Cmt 250706 2209 - feat- Implementación completa del Time Tracker y corrección de regresiones]]

[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/Cmt 250706 2259 - feat(time-tracker)- Mejora la gestión de tiempo con Moment.js y vista jerárquica|Cmt 250706 2259 - feat(time-tracker)- Mejora la gestión de tiempo con Moment.js y vista jerárquica]]
[[Ax 250706 - Análisis de la Experiencia de Usuario (UX) Actual y Propuesta de Rediseño|Ax 250706 - Análisis de la Experiencia de Usuario (UX) Actual y Propuesta de Rediseño]]
[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/Cmt 250707 0016 - feat(time-tracker)- Mejoras significativas en la vista y gestión del Time Tracker|Cmt 250707 0016 - feat(time-tracker)- Mejoras significativas en la vista y gestión del Time Tracker]]

## Recursos


## Tareas
- [x] Establecer un boton en la lista de tareas en Progreso, que permita iniciar el registro de las tareas desde alli. #cx-DesarrolloDovela 🆔 jDjdcP ✅ 2025-08-19

## Estructura PGTD

### Proyectos GTD y RR
```base
filters:
  and:
    - or:
        - type == "PGTD"
        - type == "RR"
    - file.inFolder(this.file.folder)
formulas:
  Carpeta: |
    if(
      file.folder == this.file.folder,
      this.file.folder.split("/")[this.file.folder.split("/").length - 1],
      file.folder
        .replace(
          this.file.folder.split("/").slice(0, -1).join("/") + "/",
          ""
        )
        .split("/")
        .slice(0, -1)
        .join("/")
    )
views:
  - type: table
    name: PGTD y RR de PGTD
    groupBy:
      property: formula.Carpeta
      direction: ASC
    order:
      - estado
      - file.name
    sort:
      - property: estado
        direction: DESC
      - property: file.folder
        direction: ASC
      - property: file.mtime
        direction: DESC
    markers: number

```

### Contenido Completo
```base
filters:
  and:
    - file.ext == "md"
    - file.inFolder(this.file.folder)
formulas:
  Carpeta: |
    file.folder
      .replace(
        this.file.folder.split("/").slice(0, -1).join("/") + "/",
        ""
      )
views:
  - type: table
    name: Contenido
    groupBy:
      property: formula.Carpeta
      direction: ASC
    order:
      - type
      - estado
      - file.name
    sort:
      - property: estado
        direction: DESC
      - property: file.mtime
        direction: DESC

```

------
