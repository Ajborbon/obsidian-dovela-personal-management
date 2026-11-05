---
type: PGTD
estado: 🔵
tags:
origen: "[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Sistema de Gestion Personal DOVELA|PGTD - Sistema de Gestion Personal DOVELA]]"
---

## Descripción
Nueva versión de mi sistema de gestión. Es como la versión 3.0. El nombre de este sistema es DOVELA. Una Dovela es la piedra clave del arco que sostiene toda la estructura. Elemento central que mantiene todo en pie.
## Historial

## [[2025-06-10 martes]]
- [x] Hacer Plantilla de Recursos Recurrentes con busqueda automatica de las notas que apuntan a esta nota. Considerar que este recurso es el que estare usando para agrupar reuniones, considerando que en una sola reunión puedo estar hablando de diferentes temas, como por ejemplo de TBCC e ITG. En donde deberia quedar esa nota en la automatización? 📅 2025-06-10 ✅ 2025-06-10
	- [x] [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Dovela v0.1/Ax 250611 - Adaptación del Selector de Estado de Nota al Nuevo Plugin|Ax 250611 - Adaptación del Selector de Estado de Nota al Nuevo Plugin]] ✅ 2025-06-11
	- [x] [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Dovela v0.1/Ax 250610 - Uso de Copilot, primera compilación en producción y comando para compilación desarrollo|Ax 250610 - Uso de Copilot, primera compilación en producción y comando para compilación desarrollo]] ✅ 2025-06-11
	- [x] [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Dovela v0.1/PGTD - Creación del repositorio y base github para Dovela|PGTD - Creación del repositorio y base github para Dovela]] ✅ 2025-06-11
	- [x] [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RR - Recursos de uso frecuente para el desarrollo de Dovela/Ax 250610 - Sinconización de archivos md desde la boveda en producción a la boveda de desarrollo|Ax 250610 - Sinconización de archivos md desde la boveda en producción a la boveda de desarrollo]] ✅ 2025-06-11

### [[2025-06-07 sábado]]
Creación del GTD principal: [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Sistema de Gestion Personal DOVELA|PGTD - Sistema de Gestion Personal DOVELA]]

### [[2025-06-06 viernes]]
Definición inicial de la [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/Plantillas/Plt - Anotacion|Plt - Anotacion]] y la [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/Plantillas/Plt - Transacción|Plt - Transacción]]. Instalación inicial de los primeros [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Configuración de Plugins Obsidian/PGTD 250607 - Configuración de Plugins Obsidian|plugins de la boveda]] 
### [[2025-06-05 jueves]]
Definición del concepto para esta tercera entrega, creación de la estructura de notas, consideraciones tecnicas de integrar la Boveda de Obsidian

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
