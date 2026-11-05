---
type: PGTD
estado: 🔵
tags:
origen: "[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Dovela v0.2/PGTD - Dovela v0.2|PGTD - Dovela v0.2]]"
---

## Descripción


## Historial

[[Ax 250709 - Propuesta de UX - La Vista de "Cronograma"|Ax 250709 - Propuesta de UX - La Vista de "Cronograma"]]
[[Ax 250709 -   Propuesta de UX UI La Vista "Cronograma" v2|Ax 250709 -   Propuesta de UX UI La Vista "Cronograma" v2]]

[[Ax 250709 - Plan de implementación de la vista Cronograma Detallado|Ax 250709 - Plan de implementación de la vista Cronograma Detallado]]
Siguiendo ese plan se desarrollo el commit: [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/Cmt 250709 2250 - feat(gtd)- Añade vista de cronograma interactiva|Cmt 250709 2250 - feat(gtd)- Añade vista de cronograma interactiva]]

Luego se hicieron mejoras: [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/Cmt 250709 2339 - feat(timeline)- Mejoras de UX y funcionalidad en cronograma|Cmt 250709 2339 - feat(timeline)- Mejoras de UX y funcionalidad en cronograma]]

Finalmente se hicieron otras mejoras en UX y se hizo el commit [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/Cmt 250710 0118 - feat(UX)- Navegación por calendario y enlace a nota|Cmt 250710 0118 - feat(UX)- Navegación por calendario y enlace a nota]]

## Recursos


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
