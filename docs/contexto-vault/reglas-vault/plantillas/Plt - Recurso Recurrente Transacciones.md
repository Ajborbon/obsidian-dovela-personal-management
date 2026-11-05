<%*
/* ================================================================== */
/*            PLANTILLA DE CREACIÓN DE PROYECTOS GTD (PGTD)           */
/* ================================================================== */
/*
 * Autor: Gemini & Andres Borbon
 * Fecha: 2025-07-02
 * Descripción: Este script automatiza la creación de notas de 
 * proyectos (PGTD) siguiendo una lógica condicional para determinar
 * el nombre y la ubicación del archivo y/o carpeta del proyecto.
 */


// --- 1. OBTENER CONTEXTO ACTUAL ---
const fecha = tp.date.now("YYMMDD");                                         // 
const activeFile = tp.config.active_file;
const activeView = tp.app.workspace.getActiveViewOfType(tp.obsidian.MarkdownView);
debugger;
let currentFolder;
let currentFolderPath;

/* 2. Guardar información de la nota origen */
let notaOrigen = null;
let enlaceOrigen = "";

if (activeFile) {
  notaOrigen = activeFile.basename; // Nombre sin extensión
  enlaceOrigen = `[[${notaOrigen}]]`;
}


// Determinar la carpeta de trabajo según el contexto de invocación
if (activeView && activeFile) {
    // Invocado desde una nota activa: usar la carpeta de esa nota.
    currentFolderPath = activeFile.parent.path;
    currentFolder = activeFile.parent.name;
    // Manejar caso de la carpeta raíz
    if (currentFolder === "/") currentFolder = "";
} else {
    // Invocado desde el explorador (ej. clic derecho en carpeta): usar la carpeta de destino.
    currentFolderPath = tp.file.folder(true);
    currentFolder = tp.file.folder();
}

const tipo = "RR";
let finalTitle = "";
let finalPath = "";
let moveFile = false;

// --- 2. LÓGICA PRINCIPAL ---
const useInbox = await tp.system.suggester(
    ["No, usar carpeta actual","Sí, crear en Bandeja de Entrada"],
    [false, true],
    true,
    "¿Deseas crear el proyecto en la Bandeja de Entrada?"
);

if (useInbox) {
    currentFolderPath = "00 - Inbox";
    currentFolder = "00 - Inbox";
    new Notice("Creando en la Bandeja de Entrada.");
}

// CASO A: La nota se crea dentro de una carpeta de proyecto existente.
if (currentFolder.startsWith("RR - ")) {
    const expectedFileName = `${currentFolder}`;
    const expectedFilePath = `${currentFolderPath}/${expectedFileName}.md`;
    const fileExists = await tp.app.vault.getAbstractFileByPath(expectedFilePath);

    let useFolderName = false;
    if (!fileExists) {
        const projectName = currentFolder.replace("RR - ", "").trim();
        useFolderName = await tp.system.suggester(
            [`Sí, crear la nota del recurso principal "${projectName}"`, "No, crear un sub-item dentro de la carpeta"],
            [true, false],
            true,
            "¿Crear la nota del Recurso principal para esta carpeta?"
        );
    }

    if (useFolderName) {
        finalTitle = currentFolder;
        finalPath = `${currentFolderPath}/${finalTitle}`;
        moveFile = true;
    } else {
        const creationType = await tp.system.suggester(
            ["Crear Sub-item con Carpeta", "Crear Sub-item sin Carpeta (solo archivo)"],
            ["folder", "file"],
            true,
            "¿Cómo deseas crear el nuevo sub-item PGTD?"
        );

        const itemName = await tp.system.prompt("¿Cuál es el nombre del nuevo sub-item?", "", true);
        if (!itemName || !itemName.trim()) {
            new Notice("❌ Creación cancelada: el nombre no puede estar vacío.");
            throw new Error("Creación cancelada por nombre vacío.");
        }
        finalTitle = `${tipo} - ${itemName.trim()}`;

        if (creationType === "folder") {
            const newFolderPath = `${currentFolderPath}/${finalTitle}`;
            if (!await tp.app.vault.adapter.exists(newFolderPath)) {
                await tp.app.vault.createFolder(newFolderPath);
                new Notice(`Sub-carpeta "${finalTitle}" creada.`);
            }
            finalPath = `${newFolderPath}/${finalTitle}`;
            moveFile = true;
        } else { 
            finalPath = `${currentFolderPath}/${finalTitle}`;
            moveFile = true;
        }
    }

} else {
    // CASO B: La nota se crea en una carpeta que no es de proyecto (ej. Inbox).
    const creationType = await tp.system.suggester(
        ["Crear Recurso con Carpeta", "Crear Recurso sin Carpeta (solo archivo)"],
        ["folder", "file"],
        true,
        "¿Cómo deseas crear el nuevo Recurso Recurrente?"
    );

    const projectName = await tp.system.prompt("¿Cuál es el nombre del Recurso?", "", true);
    if (!projectName || !projectName.trim()) {
        new Notice("❌ Creación cancelada: el nombre no puede estar vacío.");
        throw new Error("Creación cancelada por nombre vacío.");
    }
    finalTitle = `${tipo} - ${projectName.trim()}`;

    if (creationType === "folder") {
        const newFolderPath = `${currentFolderPath}/${finalTitle}`;
        if (!await tp.app.vault.adapter.exists(newFolderPath)) {
            await tp.app.vault.createFolder(newFolderPath);
            new Notice(`Carpeta "${finalTitle}" creada.`);
        }
        finalPath = `${newFolderPath}/${finalTitle}`;
        moveFile = true;
    } else { 
        finalPath = `${currentFolderPath}/${finalTitle}`;
        moveFile = true;
    }
}

// --- 3. EJECUTAR CREACIÓN Y RENOMBRADO ---
// Templater crea un archivo vacío "Sin título" que debemos mover/renombrar.
// El archivo actual (tp.file) es ese "Sin título".
await tp.file.move(`${finalPath}`);
new Notice(`Recurso Recurrente creado: ${finalTitle}`);


// --- 4. INSERTAR ENLACE EN NOTA ACTIVA (SI APLICA) ---
if (activeView && activeFile) {
    const linkToInsert = `[[${finalPath}|${finalTitle}]]`;
    activeView.editor.replaceSelection(linkToInsert);
    new Notice(`Enlace insertado en: ${activeFile.basename}`);
}

// --- 5. ABRIR LA NUEVA NOTA (OPCIONAL) ---
const fileObj = tp.app.vault.getAbstractFileByPath(`${finalPath}.md`);
if (fileObj) {
    const leaf = tp.app.workspace.getLeaf(true);
    await leaf.openFile(fileObj);
}

_%>
---
type: <% tipo %>
estado: 🟢
origen: <% enlaceOrigen ? `"${enlaceOrigen}"` : '""' %>
tags:
---

## Creados localmente


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
```

## Estructura RR Transacciones

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

```

### Transacciones

```base
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
