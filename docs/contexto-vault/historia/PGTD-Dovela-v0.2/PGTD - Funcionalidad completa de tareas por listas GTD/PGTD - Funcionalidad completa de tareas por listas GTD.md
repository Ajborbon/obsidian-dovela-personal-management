---
type: PGTD
estado: 🔵
tags:
origen: "[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Dovela v0.2/PGTD - Dovela v0.2|PGTD - Dovela v0.2]]"
---

## Descripción


## Historial

### [[2025-07-06 domingo]]
[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Dovela v0.2/PGTD - Funcionalidad completa de tareas por listas GTD/Ax 250706 - Confirmación de la creación de los campos opcionales de duración de las tareas para la lista calendario|Ax 250706 - Confirmación de la creación de los campos opcionales de duración de las tareas para la lista calendario]]

### [[2025-07-05 sábado]]

Hasta este momento, el boton de listas GTD ya cubre estas funcionalidades: [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Dovela v0.2/PGTD - Funcionalidad completa de tareas por listas GTD/Ax 250705 - Documentación funcional del boton Listas GTD del comando Open GTD Dashboard|Ax 250705 - Documentación funcional del boton Listas GTD del comando Open GTD Dashboard]]. Las funcionalidades que deseo cubrir con ese boton son [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Dovela v0.2/Ax 250703 - Reglas y Estructura de las listas de tareas GTD de Dovela v1.0|Ax 250703 - Reglas y Estructura de las listas de tareas GTD de Dovela v1.0]] y haciendo un análisis detallado, hace falta cubrir las siguientes tareas [[Ax 250705 - Funcionalidades faltantes del boton listas GTD en la versión actual de desarrollo.|Ax 250705 - Funcionalidades faltantes del boton listas GTD en la versión actual de desarrollo.]] 

Antes de continuar, hice un nuevo commit [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/Cmt 250705 1614 - refactor(gtd) - Refactoriza el motor GTD para un procesamiento avanzado de tareas|Cmt 250705 1614 - refactor(gtd) - Refactoriza el motor GTD para un procesamiento avanzado de tareas]].

Muy bien, el plan que sugiere entonces la IA para pasar al siguiente commit es [[Ax 250705 - Plan de Implementación para todas las Reglas GTD|Ax 250705 - Plan de Implementación para todas las Reglas GTD]] 

Hice un commit [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/Cmt 250705 1910 - feat(gtd) - Implementar detección de conflictos y mejorar procesador GTD|Cmt 250705 1910 - feat(gtd) - Implementar detección de conflictos y mejorar procesador GTD]] 

Luego desarrolle este listado de tareas para probar el estado del desarrollo. [[Ax 250705 - Tareas para probar las funcionalidades de la lista de 9 reglas|Ax 250705 - Tareas para probar las funcionalidades de la lista de 9 reglas]] y encontré [[Ax 250705 - Problemas en las tareas creadas y su ubicación en las listas GTD|Ax 250705 - Problemas en las tareas creadas y su ubicación en las listas GTD]]

Aqui me di cuenta que al haberle pasado las reglas de las listas, los simbolos 🛫/⏳/📅 no los recibió adecuadamente y por eso desarrollo cosas con problemas, lo puse a leer de nuevo las reglas, pero desde el archivo en la boveda y para arreglar las cosas, me propuso este plan de trabajo [[Ax 250705 - Plan de corrección y desarrollo de las listas, luego de descubrir que no habia comprendido bien los simbolos y la primera prueba de tareas.|Ax 250705 - Plan de corrección y desarrollo de las listas, luego de descubrir que no habia comprendido bien los simbolos y la primera prueba de tareas.]]

Creé entonces un [[Ax 250705 - Segundo archivo de tareas de prueba para validar que se cumplen las reglas de las listas GTD|Ax 250705 - Segundo archivo de tareas de prueba para validar que se cumplen las reglas de las listas GTD]] y ahora encontré los [[Ax 250705 - Hallazgos en la segunda prueba de tareas en las listas GTD.|Ax 250705 - Hallazgos en la segunda prueba de tareas en las listas GTD.]] 

Programe los nuevos cambios con IA y ahora todo funcionó al parecer excelente. 

Hice un nuevo commit [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/Cmt 250705 2147 - fix(gtd)- Corregir lógica de clasificación y zona horaria|Cmt 250705 2147 - fix(gtd)- Corregir lógica de clasificación y zona horaria]] y creo que en este punto ya quedó lista la tarea del boton de listas GTD.

Me di cuenta que faltaba una oganización de las tareas por fecha de vencimiento en la lista de tareas vencidas. Se implemento y se guardo en el commit [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/Cmt 250705 2221 - feat(GTD)- Ordenar tareas vencidas por fecha|Cmt 250705 2221 - feat(GTD)- Ordenar tareas vencidas por fecha]].


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
