/**
 * Cuerpos por defecto de las 22 plantillas del vault (docs/contexto-vault/reglas-vault/plantillas),
 * copiados como texto y con cada interpolación Templater sustituida por un marcador `{{variable}}`
 * (ver `templateText.ts`). Los bloques `datacorejsx`, `base` y los embeds son texto estático.
 *
 * NO editar a mano sin actualizar las pruebas: `tests/notes/bodies.test.ts` vuelve a derivar cada
 * cuerpo de la plantilla real y exige igualdad exacta (incluidos espacios y saltos de línea).
 * Los cuerpos `*_CAPTURA` corresponden al carril “captura rápida” de Ref/Sue/Reu.
 */

export const BODY_AX = ``;

export const BODY_BTX = `
# {{titulo}}

## 1. Período y Participantes
- **Fecha:** {{fecha}}
- **Horario:** HH:MM - HH:MM (UTC-5)
- **Responsables:** Andres Borbon & Asistente IA

## 2. Objetivo de la Sesión
Una o dos frases claras sobre el objetivo principal a lograr.

## 3. Lo que se hizo (Hechos y Decisiones)
1. 
2. 

## 4. Hallazgos y Cambios de Arquitectura
- 

## 5. Estado al cierre
| Componente / Módulo | Estado | Detalle |
|---|:---:|---|
| ... | ✅ / ⏳ / ❌ | ... |

## 6. Pendientes al cierre
<!-- IMPORTANTE: Redactar siempre en texto plano como viñetas informativas (- ). Las tareas operativas van en el PGTD raíz -->
- 

## 7. Punto de continuación
> **La próxima sesión arranca aquí:** [descripción exacta del paso siguiente y contexto para retomar]
`;

export const BODY_CMT = `
{{origenInline}}
`;

export const BODY_PODX = `
## Podcast
`;

export const BODY_PRX = `
`;

export const BODY_TX = `
# Soportes
`;

export const BODY_VX = `
Link: 

## Resumen del video


## Secciones

`;

export const BODY_PGTD = `
## Descripción


## Historial


## Recursos


## Tareas


## Tareas del proyecto
\`\`\`datacorejsx
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
                    const lines = content.split("\\n");

                    for (const item of openItems) {
                        const line = lines[item.position.start.line] || "";
                        const match = line.match(/^[\\s\\t]*-\\s+\\[\\s\\]\\s+(.*)/);
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
\`\`\`


## Estructura PGTD

### Proyectos GTD y RR
\`\`\`base
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

\`\`\`

### Contenido Completo
\`\`\`base
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

\`\`\`

------
`;

export const BODY_AV = `
## Descripción


## Historial


## Recursos


## Tareas

## Estructura AV
### AI
\`\`\`base
filters:
  and:
    - or:
        - type == "AI"
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
    name: Areas de Interes en AV
    groupBy:
      property: formula.Carpeta
      direction: ASC
    order:
      - estado
      - file.name
    sort:
      - property: file.folder
        direction: ASC
      - property: estado
        direction: ASC
    markers: number

\`\`\`

### AI, Proyectos GTD y RR
\`\`\`base
filters:
  and:
    - or:
        - type == "PGTD"
        - type == "AI"
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
    name: AI, PGTD y RR de Areas de Vida
    groupBy:
      property: formula.Carpeta
      direction: ASC
    order:
      - estado
      - file.name
      - formula.CarpetaFinal
    sort:
      - property: estado
        direction: DESC
      - property: file.folder
        direction: ASC
      - property: file.mtime
        direction: DESC
    markers: number
    columnSize:
      file.name: 393

\`\`\`

### Contenido Completo
\`\`\`base
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

\`\`\`
`;

export const BODY_AI = `
## Descripción


## Historial


## Recursos


## Tareas

## Estructura Áreas de Interés

### AI, Proyectos GTD y RR
\`\`\`base
filters:
  and:
    - or:
        - type == "PGTD"
        - type == "AI"
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
    name: AI, PGTD y RR de Areas Interes
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

\`\`\`

### Contenido Completo
\`\`\`base
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

\`\`\`

------
`;

export const BODY_RR = `
## Creados localmente


## Tareas

\`\`\`datacorejsx
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
                    const lines = content.split("\\n");

                    for (const item of openItems) {
                        const line = lines[item.position.start.line] || "";
                        const match = line.match(/^[\\s\\t]*-\\s+\\[\\s\\]\\s+(.*)/);
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
                "RR sin tareas abiertas en sus notas de contenido."
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
\`\`\`

## Estructura RR

### Proyectos GTD y RR
\`\`\`base
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
    name: PGTD y RR de RR
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

\`\`\`

### Contenido Completo
\`\`\`base
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

\`\`\`

------
`;

export const BODY_RR_TX = `
## Creados localmente


## Tareas
\`\`\`datacorejsx
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
                    const lines = content.split("\\n");

                    for (const item of openItems) {
                        const line = lines[item.position.start.line] || "";
                        const match = line.match(/^[\\s\\t]*-\\s+\\[\\s\\]\\s+(.*)/);
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
                "RR sin tareas abiertas en sus notas de contenido."
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
\`\`\`

## Estructura RR Transacciones

### Proyectos GTD y RR
\`\`\`base
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
    name: PGTD y RR de RR
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

\`\`\`

### Transacciones

\`\`\`base
filters:
  and:
    - type == "Tx"
    - file.inFolder(this.file.folder)
formulas:
  Sin título: ""
  Carpeta: file.folder.split("/").slice(-2)[0]
views:
  - type: table
    name: Transacciones
    order:
      - estado
      - file.name
      - monto
      - moneda
    sort:
      - property: estado
        direction: DESC
      - property: file.name
        direction: DESC
    markers: number

\`\`\`

### Contenido Completo
\`\`\`base
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

\`\`\`

------
`;

export const BODY_RR_BTX = `
## Creados localmente


## Bitácoras de Sesión

\`\`\`datacorejsx
return function View() {
    const current = dc.useCurrentFile();
    const folder = current?.$path?.includes("/")
        ? current.$path.substring(0, current.$path.lastIndexOf("/"))
        : "";

    const indexVersion = dc.useIndexUpdates();
    const [sessions, setSessions] = dc.useState(null);

    dc.useEffect(() => {
        let cancelled = false;

        async function loadSessions() {
            try {
                const vault = dc.app.vault;
                const meta = dc.app.metadataCache;
                const files = vault.getMarkdownFiles().filter(function(f) {
                    return f.path.startsWith(folder + "/") && f.path !== current.$path;
                });

                const list = [];
                for (const file of files) {
                    const cache = meta.getFileCache(file);
                    const fm = cache?.frontmatter || {};
                    const isBtx = fm.type === "Btx" || file.basename.startsWith("Btx ") || file.basename.startsWith("Ax ");
                    if (isBtx) {
                        list.push({
                            path: file.path,
                            name: file.basename,
                            fecha: fm.fecha || "",
                            estado: fm.estado || "🟢",
                            mtime: file.stat.mtime
                        });
                    }
                }

                // Ordenar por fecha descendente
                list.sort(function(a, b) {
                    return (b.fecha || "").localeCompare(a.fecha || "") || (b.name).localeCompare(a.name);
                });

                if (!cancelled) setSessions(list);
            } catch (err) {
                if (!cancelled) setSessions([]);
            }
        }

        loadSessions();
        return function() { cancelled = true; };
    }, [folder, indexVersion]);

    function openNote(path) {
        const file = dc.app.vault.getAbstractFileByPath(path);
        if (!file) return;
        dc.app.workspace.getLeaf(false).openFile(file);
    }

    if (sessions === null) {
        return h("div", { style: { color: "var(--text-muted)", fontSize: "0.9em" } }, "Cargando sesiones...");
    }

    if (!sessions.length) {
        return h("div", { style: { borderLeft: "3px solid var(--color-blue)", paddingLeft: "10px", margin: "4px 0" } },
            h("strong", null, "ℹ️ Sin sesiones registradas"),
            h("p", { style: { margin: "4px 0", fontSize: "0.9em", color: "var(--text-muted)" } },
                "Usa el skill /session-log o la plantilla Plt - Bitacora para crear la Sesión 01."
            )
        );
    }

    return h("div", null,
        h("p", { style: { margin: "0 0 8px 0" } },
            h("strong", null, "📑 " + sessions.length + " sesión" + (sessions.length !== 1 ? "es" : "") + " registrada" + (sessions.length !== 1 ? "s" : ""))
        ),
        h("div", { style: { display: "flex", flexDirection: "column", gap: "6px" } },
            sessions.map(function(s, idx) {
                const isDone = s.estado === "🔵";
                return h("div", {
                    key: s.path,
                    onClick: function() { openNote(s.path); },
                    style: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        background: "var(--background-secondary)",
                        cursor: "pointer",
                        borderLeft: "4px solid " + (isDone ? "var(--color-blue, #4a90e2)" : "var(--color-green, #2ecc71)")
                    }
                },
                    h("div", { style: { display: "flex", alignItems: "center", gap: "8px" } },
                        h("span", null, s.estado),
                        h("span", { style: { fontWeight: "500", color: "var(--text-normal)" } }, s.name)
                    ),
                    h("span", { style: { fontSize: "0.85em", color: "var(--text-muted)" } }, s.fecha)
                );
            })
        )
    );
}
\`\`\`

## Tareas

\`\`\`datacorejsx
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
                    const lines = content.split("\\n");

                    for (const item of openItems) {
                        const line = lines[item.position.start.line] || "";
                        const match = line.match(/^[\\s\\t]*-\\s+\\[\\s\\]\\s+(.*)/);
                        if (match) {
                            tasks.push({
                                text: match[1].trim(),
                                filePath: file.path,
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

    if (openTasks === null) return h("div", null, "Cargando...");
    if (!openTasks.length) return h("p", { style: { color: "var(--text-muted)", fontSize: "0.9em" } }, "Sin tareas abiertas en las bitácoras.");

    return h("div", null,
        openTasks.map(function(t, i) {
            return h("div", { key: i, style: { fontSize: "0.9em", color: "var(--text-accent)" } }, "☐ " + t.text + " (" + t.fileName + ")");
        })
    );
}
\`\`\`

## Estructura RR

### Contenido Completo
\`\`\`base
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
    name: Sesiones de Trabajo
    groupBy:
      property: estado
      direction: DESC
    order:
      - type
      - estado
      - file.name
    sort:
      - property: estado
        direction: DESC
      - property: file.mtime
        direction: DESC

\`\`\`

------
`;

export const BODY_RC = `
## Creados localmente


## Tareas
`;

export const BODY_REF = `

## Contexto

## Análisis

## Conclusiones

## Recursos



`;

export const BODY_REF_CAPTURA = `
> 🎙️ **Captura rápida** — Graba tu reflexión y arrastra los audios a la sección de abajo.
> Esta nota será procesada por Claude con \`/obsidian-procesar-reflexion\`.

## Audios

<!-- Arrastra aquí tus grabaciones. Ejemplo: ![[audio-reflexion-01.m4a]] -->

## Notas rápidas

<!-- Texto adicional mientras grabas, si lo necesitas -->

---


## Contexto

## Análisis

## Conclusiones

## Recursos

---
- [ ] Transcribir y procesar esta reflexión #cx-procesarReflexion

`;

export const BODY_SUE = `

## Recuerdo literal

<!-- Escribe el sueño como ocurrió, sin interpretarlo todavía. Conserva escenas, saltos, rarezas y frases exactas. -->

## Escenas

1. 

## Emociones y cuerpo

- **Al despertar:**
- **Durante el sueño:**
- **Sensaciones físicas:**

## Personajes, lugares y símbolos

- **Personas:**
- **Lugares:**
- **Objetos o símbolos:**
- **Frases o mensajes:**

## Contexto de la víspera

- **Antes de dormir:**
- **Eventos recientes relacionados:**
- **Preocupaciones activas:**

## Interpretación inicial

<!-- Hipótesis propias, sin forzar conclusiones. ¿Qué parece estar procesando este sueño? -->

## Patrones o conexiones

- Similar a: [[]]
- Puede conectarse con: [[]]
- Tema recurrente:

## Conclusiones

## Acciones o ritual de cierre

- 


`;

export const BODY_SUE_CAPTURA = `
> 🎙️ **Captura rápida de sueño** — Graba lo que recuerdes antes de interpretarlo.
> Esta nota puede procesarse como reflexión con \`/obsidian-procesar-reflexion\`.

## Audios

<!-- Arrastra aquí tus grabaciones. Ejemplo: ![[audio-sueno-01.m4a]] -->

## Fragmentos rápidos

<!-- Palabras sueltas, imágenes, personas, lugares o sensaciones que no quieras perder -->




---
- [ ] Transcribir y procesar este sueño como reflexión #cx-procesarReflexion

`;

export const BODY_REU = `
## Objetivo

## Contexto

## Notas

## Decisiones

## Acuerdos

## Próximos pasos

## Recursos

`;

export const BODY_REU_CAPTURA = `
> 🎙️ **Captura rápida de reunión** — agrega aquí los audios y notas rápidas.
> Esta nota será procesada luego mediante la tarea \`#cx-procesarReunion\`.

## Audios

<!-- Arrastra aquí las grabaciones de la reunión. Ejemplo: ![[reunion-01.m4a]] -->

## Notas rápidas

<!-- Apuntes rápidos, contexto o decisiones mientras ocurre la reunión -->

---

## Objetivo

## Contexto

## Decisiones

## Acuerdos

## Próximos pasos

## Recursos

---
- [ ] Procesar esta reunión #cx-procesarReunion

`;

export const BODY_DLY = `
[[{{anteriorRuta}}|⬅️ {{anteriorTexto}}]] | **📅 {{hoyTexto}}** | [[{{siguienteRuta}}|{{siguienteTexto}} ➡️]]
# Planeación del día
## Plan sugerido en revisión semanal

![[{{semana}}#{{hoyTexto}} Plan y registro actividades Bloques definidos para el {{hoyTexto}}]]

## Planeación del día por bloques

# Pensamientos y sueños del día

\`\`\`base
filters:
  and:
    - or:
        - type == "Ref"
        - type == "Sue"

views:
  - type: list
    name: Reflexiones del día
    filters:
      and:
        - fecha == this.fecha
    groupBy:
      property: file.folder
      direction: ASC
    order:
      - file.name
    markers: number

\`\`\`

# Bitácora del día
## Borrador

# Tareas

\`\`\`datacorejsx
return function View() {
    const current = dc.useCurrentFile();
    const [tasksNode, setTasksNode] = dc.useState(null);
    const [taskError, setTaskError] = dc.useState(null);

    dc.useEffect(() => {
        let cancelled = false;

        async function loadTasks() {
            try {
                const gp = dc.app?.plugins?.plugins?.["obsidian-dovela-personal-management"];

                if (!gp || !gp.journalAPI) {
                    if (!cancelled) setTaskError("Plugin no disponible");
                    return;
                }

                const fileName = current?.$name ?? "";
                const targetDate = fileName.split(" ")[0];

                const node = await gp.journalAPI.renderTasksForDate(targetDate);

                if (!cancelled) {
                    setTasksNode(node);
                    setTaskError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setTaskError(err?.message || String(err));
                }
            }
        }

        loadTasks();

        return () => {
            cancelled = true;
        };
    }, [current?.$path]);

    const allPages = dc.useQuery("@page");

    const backlinks = dc.useMemo(() => {
        if (!current?.$path) return [];

        return allPages
            .filter(p => p.$path !== current.$path)
            .filter(p => {
                const file = dc.app.vault.getAbstractFileByPath(p.$path);
                if (!file) return false;

                const cache = dc.app.metadataCache.getFileCache(file);
                const links = cache?.links ?? [];
                return links.some(link => {
                    const resolved = dc.resolvePath(link.link, p.$path);
                    return resolved === current.$path;
                });
            })
            .sort((a, b) => {
                const aTime = a.$ctime?.toMillis?.() ?? 0;
                const bTime = b.$ctime?.toMillis?.() ?? 0;
                return bTime - aTime;
            });
    }, [allPages, current?.$path]);

    const rows = backlinks.map(p => ({
        file: p.$link,
        tipo: p.value?.("type") ?? "",
        estado: p.value?.("estado") ?? "",
        ruta: p.$path
    }));

    return (
        <dc.Stack>
            <h2>Tareas del día</h2>

            {taskError ? (
                <p>Error: {taskError}</p>
            ) : tasksNode ? (
                <div ref={el => {
                    if (el && tasksNode && !el.hasChildNodes()) {
                        el.appendChild(tasksNode);
                    }
                }} />
            ) : (
                <p>Cargando tareas...</p>
            )}

            <h2>Notas apuntando a hoy</h2>

            <dc.Table
                rows={rows}
                columns={[
                    {
                        id: "file",
                        title: "File",
                        value: row => row.file
                    },
                    {
                        id: "tipo",
                        title: "Tipo",
                        value: row => row.tipo
                    },
                    {
                        id: "estado",
                        title: "Estado",
                        value: row => row.estado
                    },
                    {
                        id: "ruta",
                        title: "Ruta",
                        value: row => row.ruta
                    }
                ]}
            />
        </dc.Stack>
    );
}
\`\`\`

# Reporte diario del Vault

\`\`\`base
filters:
  and:
    - subtipo == "reporte-diario"
    - fecha == this.fecha
    - file.inFolder("03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RR - Reportes Diarios del Vault")

views:
  - type: table
    name: Reporte diario del Vault
    order:
      - file.name
      - notas_creadas
      - notas_modificadas
      - tareas_completadas
      - tareas_vencidas
      - tareas_cx_pendientes
      - total_tareas_abiertas
      - inbox_total
      - total_notas
      - backup_ok
    sort:
      - property: fecha
        direction: DESC
    markers: number

\`\`\`

# Notas creadas hoy
\`\`\`base
filters:
  and:
    - type != "Ref"
views:
  - type: list
    name: Notas creadas hoy
    filters:
      and:
        - fecha == this.fecha
    order:
      - file.name
      - file.ctime
    sort:
      - property: file.ctime
        direction: ASC
    markers: number

\`\`\`

# Notas modificadas hoy
\`\`\`base
filters:
  and:
    - type != "Ref"
views:
  - type: list
    name: Notas modificadas hoy
    filters:
      and:
        - file.mtime == this.fecha
    order:
      - estado
      - file.name
      - file.mtime
    sort:
      - property: file.mtime
        direction: ASC
    markers: bullet

\`\`\`

`;

export const BODY_WLY = `# {{titulo}}

## Links
{{enlaces}}
{{dias}}
## Objetivos semanales planteados en la revisión mensual

![[{{mesPrincipal}}#{{semana}} Propósitos principales Objetivos para W{{semanaEnTrimestre}} - semana {{numSemana}} ({{rangoFechas}})]]
## Iniciando semana
### ¿Cuál es mi plan para esta semana?

#### Propósitos principales.

#### ¿Cuál es mi inspiración de esta semana?

#### Semanario
#### Tareas para adelantar, reubicar o acumular

Lista de apoyo para rediseñar la semana: tomar una acción si un bloque termina antes y registrar lo que falta si queda pendiente. Referenciar la tarea/proyecto fuente sin duplicar sus casillas; mantener allí el estado real. Importancia estimada: 1 (menor) a 10 (mayor). Cambiar «No» por «Sí» al completar la acción.

| Acción / resultado pendiente | Proyecto o fuente | Situación al planear | Próximo ajuste | Importancia estimada (1–10) | Ejecutada (Sí/No) |
|---|---|---|---|---|---|
| Por definir | | | | | No |

<!-- En tablas, escapar el separador de los alias de wikilinks: [[Nota\\|Nombre visible]]. -->

**Registro de ajustes durante la semana:**
- Fecha / tarea / qué falta / proyecto fuente / nueva ubicación: por completar durante la ejecución.

#### Bloques por día
{{bloques}}


### Tareas
\`\`\`datacorejsx
return function View() {
    const plugin = dc.app.plugins.plugins["obsidian-dovela-personal-management"];
    const currentFile = dc.useCurrentFile();

    const weekCode = dc.useMemo(() => {
        const fileName = currentFile?.$name ?? currentFile?.name ?? "";
        return fileName.match(/\\d{4}-W\\d{1,2}/)?.[0] || plugin?.weeklyAPI?.getCurrentWeekCode?.() || null;
    }, [currentFile, plugin]);

    const options = dc.useMemo(() => ({
        showOverdueLimit: 10,
        showCompletedCollapsed: true,
        highlightToday: true
    }), []);

    const [weeklyElement, setWeeklyElement] = dc.useState(null);
    const [error, setError] = dc.useState(null);
    const containerRef = dc.useRef(null);

    dc.useEffect(() => {
        let cancelled = false;

        async function loadWeeklyView() {
            try {
                setError(null);
                setWeeklyElement(null);

                if (!plugin?.weeklyAPI?.renderTasksForWeek) {
                    throw new Error("Plugin o weeklyAPI no disponible");
                }

                if (!weekCode) {
                    throw new Error("No se pudo determinar el código de semana");
                }

                const element = await plugin.weeklyAPI.renderTasksForWeek(weekCode, options);

                if (!cancelled) {
                    setWeeklyElement(element);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err);
                }
            }
        }

        loadWeeklyView();

        return () => {
            cancelled = true;
        };
    }, [plugin, weekCode, options]);

    dc.useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.innerHTML = "";

        if (weeklyElement instanceof Node) {
            container.appendChild(weeklyElement);
        }
    }, [weeklyElement]);

    if (error) {
        return <p>Error: {error.message}</p>;
    }

    if (!weeklyElement) {
        return <p>Cargando tareas semanales...</p>;
    }

    return <div ref={containerRef} />;
}
\`\`\`


---
## Finalizando semana

### Resumen de la semana
#### Resumen narrativo

#### Resumen por temas

### Conclusion de la semana?

## Alineación de rituales

### 1. Cuerpo y energía
- Entrené:
- Alimentación base: Baja / Media / Alta
- Energía semanal (1-5):
- Observación:

### 2. Orden financiero
- ¿Hice revisión financiera semanal?: Sí / No
- ¿Registré gastos y pagos relevantes?: Sí / No
- ¿Hubo gasto impulsivo o desorden?: Sí / No
- Observación:

### 3. Construcción de abundancia
- ¿Avancé esta semana en el vehículo escalable?: Sí / No
- Frente trabajado: Autolavado / Trading / Otro / Ninguno
- Avance concreto:
- Observación:

### 4. Balance de vida
- Salud: Muy presente / Bien / Descuidada
- Trabajo: Muy presente / Bien / Descuidada
- Dinero: Muy presente / Bien / Descuidada
- Amor / pareja: Muy presente / Bien / Descuidada
- Familia / amigos: Muy presente / Bien / Descuidada
- Aprendizaje: Muy presente / Bien / Descuidada
- Descanso / disfrute: Muy presente / Bien / Descuidada
- ¿En qué área me quedé pegado esta semana?:

### 5. Presencia y conexión
- Presencia interior (0-7):
- Reflexión consciente (0-7):
- Conexión genuina con alguien (0-7):
- Observación:

### Ajuste para la próxima semana
- Lo que debo sostener:
- Lo que debo corregir:
- Lo que debo soltar:

## Anotaciones diarias de esta semana
{{anotaciones}}

## Notas apuntando a esta semana

\`\`\`base
filters:
  and:
    - file.hasLink(this.file)
    - file.path != this.file.path
views:
  - type: table
    name: Notas apuntando a esta semana
    groupBy:
      property: file.folder
      direction: ASC
    order:
      - fecha
      - file.name
      - estado
      - type
    properties:
      file.link:
        displayName: File
      type:
        displayName: Tipo
      estado:
        displayName: Estado
      file.folder:
        displayName: Ruta

\`\`\`
`;

export const BODY_MLY = `# {{titulo}}
## Links
[[{{anterior}}|{{anteriorAlias}}]] / [[{{siguiente}}|{{siguienteAlias}}]]

## Semanas del Mes
{{semanasMes}}

## Objetivos del mes planteados en la revisión trimestral

![[{{trimestre}}#{{anclaObjetivos}}]]

## Iniciando Mes
### ¿Cuál es mi plan para este mes?


### ¿Cuál es mi inspiración para este mes?


## Planeación por semanas
{{planeacion}}

---
## Finalizando Mes
### ¿Cuáles son mis conclusiones de este mes?
- 
### Resumen del mes
- 

## Veredicto de herramientas
Herramientas que cumplieron su ciclo de 4 semanas (ver [[03 - Gestion Personal/AV - Gerente de Vida/AI - Sistema de Visión y Ejecución/RR - Herramientas de interiorización/RR - Herramientas de interiorización|RR - Herramientas de interiorización]]):
- Herramienta:
  - Métrica y resultado observado:
  - Veredicto (mantener / ajustar / retirar):
  - Decisión para el siguiente ciclo:

## Contenido semanal de este mes
### Destacados de las semanas de este mes

\`\`\`base
filters:
  and:
    - type == "Wly"
    - destacado
    - mes == this

views:
  - type: table
    name: Destacados de las semanas
    order:
      - file.name
      - destacado
\`\`\`

### Anotaciones Semanales de este Mes

{{embedsSemanas}}

## Destacados diarios del mes

\`\`\`base
filters:
  and:
    - type == "Dly"
    - destacado
    - mes == this
views:
  - type: table
    name: Destacados diarios del mes
    order:
      - file.name
      - destacado

\`\`\`


---

# **Fin**

- [ ] Crear la planeación del mes {{mes}} #cx-PlanMensual
- [ ] Escribir las conclusiones y hacer el cierre del mes {{mes}} #cx-CierreMensual`;

export const BODY_QLY = `# Revisión Trimestral {{trimestre}}

## Links
[[{{anterior}}]] / [[{{siguiente}}]]

## Meses del Trimestre
{{meses}}

## Semanas del Trimestre
{{semanas}}

## Objetivos del trimestre planteados en la revisión anual

![[{{objetivosEmbed}}]]

## 1. Revisión General

### Logros y éxitos del trimestre
- 
- 
- 

### Desafíos y obstáculos
- 
- 
- 

### Lecciones aprendidas
- 
- 
- 

## 2. Revisión por Áreas de Vida

### Áreas de Vida
- **Área 1**: 
- **Área 2**: 
- **Área 3**:

## 3. Veredicto de herramientas
Revisión de las herramientas de [[03 - Gestion Personal/AV - Gerente de Vida/AI - Sistema de Visión y Ejecución/RR - Herramientas de interiorización/RR - Herramientas de interiorización|RR - Herramientas de interiorización]]:
- Herramienta:
  - Resultado del trimestre:
  - Veredicto (mantener / ajustar / retirar):
  - Herramienta nueva que la reemplaza o complementa:

## Planeación por meses
{{planeacion}}

## 3. Estado de Proyectos

### Proyectos completados este trimestre
- 
- 
- 

### Proyectos en progreso
- 
- 
- 

### Nuevos proyectos iniciados
- 
- 
- 

## 4. Objetivos del Trimestre

### Objetivos cumplidos
- 
- 

### Objetivos en progreso
- 
- 

### Objetivos no alcanzados
- 
- 

## 5. Análisis de Tiempo y Productividad

### ¿Dónde invertí más tiempo?
- 

### ¿Fue efectivo el uso de mi tiempo?
- 

### Ajustes para el próximo trimestre
- 

## 6. Metas para el próximo trimestre
- 
- 
- 

## 7. Reflexión personal
- 

## Resumen del trimestre

## Anotaciones Mensuales de este Trimestre
{{embedsMeses}}

# Fin
`;

export const BODY_YLY = `# Visión Anual {{año}}

## Links
[[{{anterior}}]] / [[{{siguiente}}]]

## Trimestres del Año
{{trimestres}}

## Meses del Año
{{meses}}

# Revisión Anual {{año}}

## 1. Revisión General

### Éxitos y logros principales
- 
- 
- 

### Desafíos y obstáculos
- 
- 
- 

### Lecciones aprendidas
- 
- 
- 

## Planeación por trimestres
{{planeacion}}

## Resumen de Trimestres
{{embedsTrimestres}}

## 2. Revisión por Áreas de Vida


## 3. Revisión de Proyectos

### Proyectos completados
- 
- 
- 

### Proyectos en progreso
- 
- 
- 

### Proyectos abandonados o pospuestos
- 
- 
- 

## 4. Resumen Financiero
- Ingresos:
- Gastos: 
- Ahorros:
- Inversiones:
- Deudas:

## 5. Hábitos y rutinas
- Hábitos que funcionaron:
- Hábitos a mejorar:
- Nuevos hábitos a incorporar:

## 6. Metas para el próximo año
- 
- 
- 

## 7. Palabra o tema para el próximo año
-

# Fin
`;
