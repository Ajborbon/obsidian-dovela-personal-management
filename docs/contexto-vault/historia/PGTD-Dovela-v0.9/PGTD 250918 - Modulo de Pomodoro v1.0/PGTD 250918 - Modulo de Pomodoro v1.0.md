---
type: PGTD
estado: 🔵
tags:
origen: "[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Dovela v0.9/PGTD - Dovela v0.9|PGTD - Dovela v0.9]]"
---

## Descripción


## Historial


## Recursos
### Test de botones

- [x] #cx-vibeCoding  El mensaje de inicio de Sesion Pomodoro, puede ser el que contenga la información mas clara sobre el numero del pomodoro que se esta ejecutando y cuantos ciclos llevo en el dia. 🆔 0feE9c

- Pomodoro iniciado desde Nota
	- Al finalizar el Pomodoro 
		- Boton Pausa de 5 Minutos
		- Iniciar otro pomodoro de 25 minutos
			- El boton solito si funciona
			- [x] #cx-vibeCoding  Si le doy cerrar la tarea, entonces que me diga de que deseo iniciar el pomodoro. 🆔 HRNUeI
- Pomodoro iniciado desde Tarea
	- [x] #cx-vibeCoding  Mostrar la información de que es la tarea al cerrar el pomodoro para saber si si cierro la tarea o no. Revisar si la tarea ya esta cerrada o no. 🆔 t4JI94
	- [x] #cx-vibeCoding  Boton de Iniciar Pausa no funciona. No inicia la pausa. 🆔 TrdbH3

- Iniciar Sesion Pomodoro.
	- [x] #cx-vibeCoding  Mostrar sobre que es que va a iniciar la sesión. Simplemente dice que iniciar la sesión, pero no se sobre que la voy a abrir. 🆔 quggt2

Descanso corto
- [x] #cx-vibeCoding  Al cierre boton de iniciar otro Pomodoro no funciona. Y deberia mostrar de que fué el ultimo pomodoro, solo si la tarea aun esta abierta, o fué de una nota. 🆔 1OZKfX
- [x] #cx-vibeCoding  El cierre de un descanso no lleva notas de la sesion. 🆔 wGPblM
## Tareas
- [x] #cx-vibeCoding  Mostrar los pomodoros del día y la ronda actual de Pomodoros, para saber en que Pomodoro voy. 1 de 4?  🆔 Cj34Ev
- [x] #cx-vibeCoding  Hacer Sesiones, es decir si entre un pomodoro y otro en iniciar se gasto menos de 30 minutos, sigue siendo la misma sesión grande.  🆔 LWoQY3

- [x] #cx-vibeCoding  Las estadisticas estan mal, el tiempo de hoy es el total. 🆔 2RNLJJ
![[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Dovela v0.9/PGTD 250918 - Modulo de Pomodoro v1.0/99 - Adjuntos/PGTD 250918 - Modulo de Pomodoro v1.0-1.png]]

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
