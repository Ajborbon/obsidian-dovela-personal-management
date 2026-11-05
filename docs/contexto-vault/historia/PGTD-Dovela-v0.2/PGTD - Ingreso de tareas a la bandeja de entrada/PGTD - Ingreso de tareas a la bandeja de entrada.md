---
type: PGTD
estado: 🔵
tags:
origen: "[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Dovela v0.2/PGTD - Dovela v0.2|PGTD - Dovela v0.2]]"
---

## Descripción

Si, ahora quiero que vayas al plugin que actualmente estoy desarrollando, y lo analices. Por ahora solo tengo un comando creado alli, desde el cual estoy centralizando las funcionalidades de la gestión de tareas. Dentro del flujo de GTD, el ingreso de tareas a la bandeja de entrada sin tener mayor fricción para el usuario, para despues poder procesarlas es fundamental. Analiza la nueva versión de mi plugin, y tomando ideas de como venia haciendolo antes, en esta versión anterior, actua como experto de UX y dime como lo podrias hacer mejor en mi nueva versión de plugin mejores alternativa para desarrollar ese comando al interior de mi plugin del sistema de gestion con GTD. Explicame en detalle como seria el proceso para el usuario y el proceso en el sistema.

Mi nuevo plugin esta en /Users/andresborbon/GDrive-Crezco360/Desarrollo Obsidian/Desarrollo 2025/.obsidian/plugins/obsidian-dovela-personal-management 
## Historial

### [[2025-07-09 miércoles]]

Se corrige un error en el Smart Inbox que impedía procesar correctamente nombres de proyectos (notas) que contenían caracteres especiales como puntos o tildes. [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/Cmt 250709 1342 - fix(parser)- Mejora el parseo de proyectos en Smart Inbox|Cmt 250709 1342 - fix(parser)- Mejora el parseo de proyectos en Smart Inbox]]
 
Las funcionalidades del open GTD Dashboard habian dejado funcionar [[Ax 250709 - Recuperación de las funcionalidades del comando GTD Dashboard luego del problema al haber implementado Smart Inbox|Ax 250709 - Recuperación de las funcionalidades del comando GTD Dashboard luego del problema al haber implementado Smart Inbox]]

Se guardo el arreglo en el commit [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/Cmt 250709 1159 - fix(styles) - Corrige la visualización perdida de GTD Dashboard integra Smart Inbox y errores de compilación|Cmt 250709 1159 - fix(styles) - Corrige la visualización perdida de GTD Dashboard integra Smart Inbox y errores de compilación]]


### [[2025-07-08 martes]]

Luego de revisar [[Ax 250708 - Como funcionaba el comando de ingresar a la bandeja de entrada en el plugin v2|Ax 250708 - Como funcionaba el comando de ingresar a la bandeja de entrada en el plugin v2]]  diseñamos el [[Ax 250708 - Plan de implementación del nuevo comando de Bandeja de Entrada v3.0|Ax 250708 - Plan de implementación del nuevo comando de Bandeja de Entrada v3.0]].

Se desarrollo el módulo y se generó el commit [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/Cmt 250708 1845 - feat(gtd)- Implementación inicial del Smart Inbox|Cmt 250708 1845 - feat(gtd)- Implementación inicial del Smart Inbox]]
## Recursos


## Tareas
- [x] problema cuando el nombre de una nota lleva tilde o . #inbox ➕ 2025-07-08 19:09 ✅ 2025-07-09
- [x] Corregir el problema de la ubicación del archivo styles, no deberia ser dentro de src  #inbox ➕ 2025-07-08 19:09 ✅ 2025-07-09

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
