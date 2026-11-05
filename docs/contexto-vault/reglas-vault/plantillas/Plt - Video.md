<%*
/* 1. Variables iniciales */
const activeFile = tp.config.active_file;
const fecha = tp.date.now("YYMMDD");
const tipo = "Vx";
const nombre = await tp.system.prompt("¿Título del video?", "", true);

if (!nombre || !nombre.trim()) {
  new Notice("❌ Creación cancelada: el nombre no puede estar vacío.");
  throw new Error("Creación cancelada por nombre vacío.");
}

const nuevoTitulo = `${tipo} ${fecha} - ${nombre.trim()}`;

/* 2. Guardar información de la nota origen */
let notaOrigen = null;
let enlaceOrigen = "";

if (activeFile) {
  notaOrigen = activeFile.basename; // Nombre sin extensión
  enlaceOrigen = `[[${notaOrigen}]]`;
}

/* 3. Determinar carpeta destino */
let destPath;
if (activeFile) {
  const opts = ["Misma carpeta de nota actual", "Inbox - Creado desde Carpeta"];
  const sel = await tp.system.suggester(opts, opts, true, "¿Dónde guardar?");

  if (!sel) {
    throw new Error("Creación cancelada: destino no seleccionado.");
  }

  if (sel === "Misma carpeta de nota actual") {
    const rutaCompleta = tp.config.active_file?.path || "";
    const carpetaAct = rutaCompleta.substring(0, rutaCompleta.lastIndexOf("/"));
    await tp.file.rename(nuevoTitulo);
    destPath = `${carpetaAct}/${nuevoTitulo}`;
    await tp.file.move(destPath);
    await tp.file.cursor_append(`[[${nuevoTitulo}|${nuevoTitulo}]]`);
  } else {
    await tp.file.rename(nuevoTitulo);
  }
} else {
  await tp.file.rename(nuevoTitulo);
}

/* 4. Abrir en split view (opcional) */
if (destPath) {
  const fileObj = tp.app.vault.getAbstractFileByPath(`${destPath}.md`);
  if (fileObj) {
    const leaf = tp.app.workspace.getLeaf(true);
    await leaf.openFile(fileObj);
  }
}
-%>
---
type: <% tipo %>
estado: 🟢
origen: <% enlaceOrigen ? `"${enlaceOrigen}"` : '""' %>
destacado:
tags:
---

Link: 

## Resumen del video


## Secciones

