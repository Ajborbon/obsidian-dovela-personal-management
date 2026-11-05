---
type: PGTD
estado: 🔵
tags:
origen: "[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Dovela v0.9/PGTD - Dovela v0.9|PGTD - Dovela v0.9]]"
---

## Descripción

El sistema de Journal es un módulo completo que permite visualizar y organizar tareas en una vista diaria estructurada. Integra tareas con diferentes tipos de programación (calendario, fechas, semanas) y las presenta de manera organizada con funcionalidades de navegación e interacción.
## Historial


## Recursos
1. [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Dovela v0.9/PGTD 251024 - Funcion de revisión de tareas desde la nota diaria/Ax 251024 - Funcion para ser invocada por Bloque Dataviewjs desde nota diaria|Ax 251024 - Funcion para ser invocada por Bloque Dataviewjs desde nota diaria]]
2. [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Dovela v0.9/PGTD 251024 - Funcion de revisión de tareas desde la nota diaria/Ax 251024 - Incluir a la vista diaria las tareas que estan abiertas y estan apuntando a la semana en la que esta ese dia|Ax 251024 - Incluir a la vista diaria las tareas que estan abiertas y estan apuntando a la semana en la que esta ese dia]]



Documentación: 
v1. [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Dovela v0.9/PGTD 251024 - Funcion de revisión de tareas desde la nota diaria/Ax 251024 - Documentación Sistema de Journal - Tareas Diarias y Semanales|Ax 251024 - Documentación Sistema de Journal - Tareas Diarias y Semanales]]
v1.1 [[Ax 251024 - Documentación Sistema de Journal incluyendo tareas de la semana|Ax 251024 - Documentación Sistema de Journal incluyendo tareas de la semana]]

Commit: [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/Cmt 251024 1535 - feat- Implementar módulo Journal para gestión de tareas diarias|Cmt 251024 1535 - feat- Implementar módulo Journal para gestión de tareas diarias]]

## Tareas


## Tareas del proyecto
```datacorejsx
return function View() {
    const current = dc.useCurrentFile();
    const folder = current?.$path?.includes("/")
        ? current.$path.substring(0, current.$path.lastIndexOf("/"))
        : "";

    const indexVersion = dc.useIndexUpdates();
    const [openTasks, setOpenTasks] = dc.useState(null);

    dc.useEffect(() => {
        let cancelled = false;

        async function loadTasks() {
            try {
                const vault = dc.app.vault;
                const meta = dc.app.metadataCache;
                const files = vault.getMarkdownFiles().filter(function(f) {
                    return f.path.startsWith(folder + "/");
                });

                const tasks = [];
                for (const file of files) {
                    const cache = meta.getFileCache(file);
                    if (!cache || !cache.listItems) continue;
                    const openItems = cache.listItems.filter(function(item) {
                        return item.task === " ";
                    });
                    if (!openItems.length) continue;

                    const content = await vault.cachedRead(file);
                    const lines = content.split("\n");

                    for (const item of openItems) {
                        const line = lines[item.position.start.line] || "";
                        const match = line.match(/^[\s\t]*-\s+\[\s\]\s+(.*)/);
                        if (match) {
                            tasks.push({
                                text: match[1].trim(),
                                filePath: file.path,
                                fileFolder: file.path.substring(0, file.path.lastIndexOf("/")),
                                fileName: file.basename,
                                lineNumber: item.position.start.line
                            });
                        }
                    }
                }

                if (!cancelled) setOpenTasks(tasks);
            } catch (err) {
                if (!cancelled) setOpenTasks([]);
            }
        }

        loadTasks();
        return function() { cancelled = true; };
    }, [folder, indexVersion]);

    function navigateToTask(filePath, lineNumber) {
        const file = dc.app.vault.getAbstractFileByPath(filePath);
        if (!file) return;
        const leaf = dc.app.workspace.getLeaf(false);
        leaf.openFile(file, {
            eState: { line: lineNumber, cursor: { from: { line: lineNumber, ch: 0 }, to: { line: lineNumber, ch: 0 } } }
        });
    }

    if (openTasks === null) {
        return h("div", { style: { color: "var(--text-muted)", fontSize: "0.9em" } }, "Cargando...");
    }

    if (!openTasks.length) {
        return h("div", { style: { borderLeft: "3px solid var(--color-orange)", paddingLeft: "10px", margin: "4px 0" } },
            h("strong", null, "⚠️ Sin tareas abiertas"),
            h("p", { style: { margin: "4px 0", fontSize: "0.9em", color: "var(--text-muted)" } },
                "Este proyecto GTD requiere revisión: definir si se cierra o necesita nuevas acciones."
            )
        );
    }

    const grouped = {};
    for (const t of openTasks) {
        const relDir = t.fileFolder === folder
            ? "(raíz del proyecto)"
            : t.fileFolder.replace(folder + "/", "");
        if (!grouped[relDir]) grouped[relDir] = {};
        if (!grouped[relDir][t.fileName]) grouped[relDir][t.fileName] = [];
        grouped[relDir][t.fileName].push(t);
    }

    const count = openTasks.length;

    return h("div", null,
        h("p", { style: { margin: "0 0 8px 0" } },
            h("strong", null,
                "☑ " + count + " tarea" + (count !== 1 ? "s" : "") + " abierta" + (count !== 1 ? "s" : "")
            )
        ),
        Object.entries(grouped).map(function(subdirEntry) {
            const subdir = subdirEntry[0];
            const files = subdirEntry[1];
            return h("div", { key: subdir, style: { marginBottom: "6px" } },
                h("div", { style: { fontWeight: "bold", marginBottom: "2px" } },
                    (subdir === "(raíz del proyecto)" ? "📂 " : "📁 ") + subdir
                ),
                Object.entries(files).map(function(fileEntry) {
                    const fn = fileEntry[0];
                    const tasks = fileEntry[1];
                    return h("div", { key: fn, style: { marginLeft: "12px", marginBottom: "3px" } },
                        h("div", { style: { fontSize: "0.85em", color: "var(--text-muted)" } },
                            "📄 " + fn + " (" + tasks.length + ")"
                        ),
                        tasks.map(function(t, i) {
                            return h("div", {
                                key: i,
                                title: "Ir a la tarea en " + t.fileName,
                                style: {
                                    marginLeft: "12px",
                                    fontSize: "0.9em",
                                    cursor: "pointer",
                                    color: "var(--link-color, var(--text-accent))"
                                },
                                onClick: function() { navigateToTask(t.filePath, t.lineNumber); }
                            }, "☐ " + t.text);
                        })
                    );
                })
            );
        })
    );
}
```

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
