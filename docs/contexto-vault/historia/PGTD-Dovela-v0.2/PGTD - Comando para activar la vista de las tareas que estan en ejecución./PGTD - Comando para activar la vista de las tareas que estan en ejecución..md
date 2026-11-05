---
type: PGTD
estado: 🔵
tags:
origen: "[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Dovela v0.2/PGTD - Dovela v0.2|PGTD - Dovela v0.2]]"
---

## Descripción


## Historial

## Recursos

- [[Ax 250706 - Concepto General del Centro de mando del día para el desarrollo de las tareas en ejecución|Ax 250706 - Concepto General del Centro de mando del día para el desarrollo de las tareas en ejecución]]
- [[Ax 250706 - Plan de trabajo de implementación de la vista En Progreso|Ax 250706 - Plan de trabajo de implementación de la vista En Progreso]]
- [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/Cmt 250706 1236 -  feat(gtd)- Implementa la vista En Progreso para tareas activas|Cmt 250706 1236 -  feat(gtd)- Implementa la vista En Progreso para tareas activas]]

- [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Dovela v0.2/PGTD - Comando para activar la vista de las tareas que estan en ejecución./Ax 250706 - Concepto y definición del escenario para el desarrollo de botones para la vista de tareas en ejecución|Ax 250706 - Concepto y definición del escenario para el desarrollo de botones para la vista de tareas en ejecución]]
- [[Ax 250706 - Plan de implementación de la mejora de listas para la vista de tareas en ejecución|Ax 250706 - Plan de implementación de la mejora de listas para la vista de tareas en ejecución]]
	- [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/Cmt 250706 1349 - feat(gtd)- Añade controles dinámicos y mejora la UX de la vista En Progreso|Cmt 250706 1349 - feat(gtd)- Añade controles dinámicos y mejora la UX de la vista En Progreso]]
## Tareas

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
