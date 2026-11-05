---
type: PGTD
estado: 🔵
tags:
origen: "[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Dovela v0.2/PGTD - Dovela v0.2|PGTD - Dovela v0.2]]"
---

## Descripción


## Historial
1. Hacer backup de los archivos:
	- LICENSE (GPL‑3.0‑o‑posterior)        
	- COMMERCIAL-LICENSE_ES.TXT y COMMERCIAL-LICENSE_EN.TXT
	- README.md (con tabla CE vs Pro, instalación, patrocinio)
	- .gitignore (Node + extras de Obsidian)
Desde [obsidian-dovela-personal-management/](file:///Users/andresborbon/GDrive-Crezco360/Desarrollo%20Obsidian/Desarrollo%202025/.obsidian/plugins/obsidian-dovela-personal-management) hacia [Backup Files Plugin definition/](file:///Users/andresborbon/GDrive-Crezco360/AJBB%20Crezco360/03%20-%20Gestion%20Personal/AV%20-%20Gerente%20de%20Conocimiento/AI%20-%20Sistema%20Gestión%20Personal%20SGP%20Dovela/PGTD%20-%20Sistema%20de%20Gestion%20Personal%20DOVELA/PGTD%20-%20Dovela%20v0.2/PGTD%20-%20Recreación%20del%20entorno%20base%20para%20desarrollo%20del%20plugin%20de%20Dovela/Backup%20Files%20Plugin%20definition)

2. Borrar lo que ya está.. Voy a dejar un backup pos si acaso en [20250702 obsidian-dovela-personal-management](file:///Users/andresborbon/GDrive-Crezco360/Desarrollo%20Obsidian/Backup%20Versiones%20Dovela/20250702%20obsidian-dovela-personal-management)

3. Se realiza el montaje del espejo de proyecto desde “yo” usando `yo obsidian-plugin --skip-install`. Este genera el file manifest.json y package.json
	- Descripción: Personal Productivity Hub is an all‑in‑one GTD task manager and Second‑Brain toolkit for Obsidian. Capture and clarify tasks, organise projects, and surface insights with powerful query blocks and custom dashboards—turning your vault into a friction‑free personal management system.
		 ![[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Dovela v0.2/PGTD - Recreación del entorno base para desarrollo del plugin de Dovela/99 - Adjuntos/PGTD - Recreación del entorno base para desarrollo del plugin de Dovela-1.png]]
4. Copia de los archivos que habia hecho backup en [Backup Files Plugin definition/](file:///Users/andresborbon/GDrive-Crezco360/AJBB%20Crezco360/03%20-%20Gestion%20Personal/AV%20-%20Gerente%20de%20Conocimiento/AI%20-%20Sistema%20Gestión%20Personal%20SGP%20Dovela/PGTD%20-%20Sistema%20de%20Gestion%20Personal%20DOVELA/PGTD%20-%20Dovela%20v0.2/PGTD%20-%20Recreación%20del%20entorno%20base%20para%20desarrollo%20del%20plugin%20de%20Dovela/Backup%20Files%20Plugin%20definition)

5. [[Ax 250702 - Documentación de Acciones GIT realizadas para retomar la primera parte y hacer tag inicial del plugin Dovela|Ax 250702 - Documentación de Acciones GIT realizadas para retomar la primera parte y hacer tag inicial del plugin Dovela]]
6. [[Ax 250702 - Como conseguir que el compilado del plugin se copie en la carpeta correcta para las pruebas automaticas usando pnpm dev|Ax 250702 - Como conseguir que el compilado del plugin se copie en la carpeta correcta para las pruebas automaticas usando pnpm dev]]
En este punto, ya tengo el plugin base corriendo, con la configuracion de yo, que trae varias cosas.

7. [[Ax 250702 - Dejando el plugin base en su minima expresion.|Ax 250702 - Dejando el plugin base en su minima expresion.]]
## Recursos
- [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Dovela v0.1/PGTD - Creación del repositorio y base github para Dovela|PGTD - Creación del repositorio y base github para Dovela]] 

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
