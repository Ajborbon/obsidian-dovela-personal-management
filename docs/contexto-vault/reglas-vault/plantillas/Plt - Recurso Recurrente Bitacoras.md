<%*
/* ─────────────────────────────────────────────────────────────
   PLANTILLA: RR - Bitácoras / Sesiones de Trabajo | Versión 1.0
   Contenedor especializado para notas tipo Btx con visor Datacore
   ───────────────────────────────────────────────────────────── */

const activeFile = tp.config.active_file;
const fecha = tp.date.now("YYMMDD");
const tipo = "RR";
const defaultName = "RR - Sesiones de trabajo";

let notaOrigen = null;
let enlaceOrigen = "";
if (activeFile) {
  notaOrigen = activeFile.basename;
  enlaceOrigen = `[[${notaOrigen}]]`;
}

let currentFolderPath = activeFile ? activeFile.parent.path : tp.file.folder(true);
let finalTitle = defaultName;
let newFolderPath = `${currentFolderPath}/${finalTitle}`;

if (!await tp.app.vault.adapter.exists(newFolderPath)) {
    await tp.app.vault.createFolder(newFolderPath);
}

let finalPath = `${newFolderPath}/${finalTitle}`;
await tp.file.move(finalPath);

if (activeFile) {
    await tp.file.cursor_append(`- [[${finalPath}|${finalTitle}]] — Repositorio de sesiones de trabajo del proyecto.\n`);
}

const fileObj = tp.app.vault.getAbstractFileByPath(`${finalPath}.md`);
if (fileObj) {
    const leaf = tp.app.workspace.getLeaf(true);
    await leaf.openFile(fileObj);
}
-%>
---
---
type: <% tipo %>
estado: 🟢
origen: <% enlaceOrigen ? `"${enlaceOrigen}"` : '""' %>
tags:
  - "#cx-SesionesTrabajo"
---

## Creados localmente


## Bitácoras de Sesión

```datacorejsx
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
```

## Tareas

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
```

## Estructura RR

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

```

------
