---
type: PGTD
estado: 🔵
tags:
origen: "[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Dovela v0.2/PGTD - Dovela v0.2|PGTD - Dovela v0.2]]"
---

## Descripción


## Historial

Organice este plan para la implementación, pidiendole a la IA que actuara como UX.[[Ax 250705 - Plan de Implementación - Filtros Interactivos y Navegación Rápida para Listas GTD|Ax 250705 - Plan de Implementación - Filtros Interactivos y Navegación Rápida para Listas GTD]]

Al final fue necesario pedirle que estructurara las listas de contextos y personas para que solo aparecieran las que tienen tareas activas. 

Luego realice el commit [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/Cmt 250705 2319 - fix(CSS)- Ajustar el anclaje del scroll para la cabecera pegajosa|Cmt 250705 2319 - fix(CSS)- Ajustar el anclaje del scroll para la cabecera pegajosa]] para que las cabeceras de las listas aparecieran justo debajo de la cabecera pegajosa cuando se hacia click en alguno de los botones para las listas.

Finalmente, queria resolver el tema de poder ver el archivo al que pertenecia la tarea, para ello me propuso hacer [[Ax 250706 - Funcionalidad de Breadcrumb de Origen de Tarea|Ax 250706 - Funcionalidad de Breadcrumb de Origen de Tarea]] y todo se almaceno en el commit [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/Cmt 250706 0004 - feat(UX)- Añadir breadcrumb desplegable de origen de tarea|Cmt 250706 0004 - feat(UX)- Añadir breadcrumb desplegable de origen de tarea]].

Con esto ya queda hecha esta parte del plugin.

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
