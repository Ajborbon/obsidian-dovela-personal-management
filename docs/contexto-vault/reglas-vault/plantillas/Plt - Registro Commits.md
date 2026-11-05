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
let currentFolder;
let currentFolderPath;

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

const tipo = "RC";
let finalTitle = "";
let finalPath = "";
let moveFile = false;

// --- 2. LÓGICA PRINCIPAL ---
const useInbox = await tp.system.suggester(
    ["No, usar carpeta actual","Sí, crear en Bandeja de Entrada"],
    [false, true],
    true,
    "¿Deseas crear el Registro en la Bandeja de Entrada?"
);

if (useInbox) {
    currentFolderPath = "00 - Inbox";
    currentFolder = "00 - Inbox";
    new Notice("Creando en la Bandeja de Entrada.");
}

// CASO A: La nota se crea dentro de una carpeta de proyecto existente.
if (currentFolder.startsWith("RC - ")) {
    const expectedFileName = `${currentFolder}`;
    const expectedFilePath = `${currentFolderPath}/${expectedFileName}.md`;
    const fileExists = await tp.app.vault.getAbstractFileByPath(expectedFilePath);

    let useFolderName = false;
    if (!fileExists) {
        const projectName = currentFolder.replace("RC - ", "").trim();
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
            ["Crear Registro de Commits con Carpeta", "Crear Registro de Commits sin Carpeta (solo archivo)"],
            ["folder", "file"],
            true,
            "¿Cómo deseas crear el nuevo Registro de Commits?"
        );

        const itemName = await tp.system.prompt("¿Cuál es el nombre del nuevo Registro de Commits?", "", true);
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
        ["Crear Registro con Carpeta", "Crear Registro sin Carpeta (solo archivo)"],
        ["folder", "file"],
        true,
        "¿Cómo deseas crear el nuevo Registro de Commits?"
    );

    const projectName = await tp.system.prompt("¿Cuál es el nombre del Registro?", "", true);
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
new Notice(`Registro de Commits creado: ${finalTitle}`);


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
tags:
---

## Creados localmente


## Tareas
