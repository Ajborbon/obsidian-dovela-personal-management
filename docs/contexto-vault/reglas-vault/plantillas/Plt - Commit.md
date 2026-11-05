<%*
/* 1. Variables iniciales */
const activeFile = tp.config.active_file;
const fecha = tp.date.now("YYMMDD");
const hora  = tp.date.now("HHmm");
const tipo  = "Cmt";

/* 2. Guardar información de la nota origen */
let notaOrigen = null;
let enlaceOrigen = "";

if (activeFile) {
  notaOrigen = activeFile.basename; // Nombre sin extensión
  enlaceOrigen = `[[${notaOrigen}]]`;
}

// Pedimos el nombre y procesamos caracteres no permitidos:
// — ":" se convierte en "-"
// — Cualquier otro de los caracteres invalidos (\/\<>|"?*) se elimina
const rawNombre = await tp.system.prompt("¿Cómo se llama el commit?", "", true);

if (!rawNombre || !rawNombre.trim()) {
  new Notice("❌ Creación cancelada: el nombre no puede estar vacío.");
  throw new Error("Creación cancelada por nombre vacío.");
}

const nombre = rawNombre.replace(/[:\/\\<>\|"?*]/g, ch => ch === ":" ? "-" : "").trim();

// Continuamos con el hash y el título
const commitHash = await tp.system.prompt("¿Ingresa el hash del commit?", "", true);
const nuevoTitulo = `${tipo} ${fecha} ${hora} - ${nombre}`;

/* 2. Determinar carpeta destino */
let destPath;
if (activeFile) {
  const opts = ["Misma carpeta de nota actual", "Inbox - Creado desde Carpeta"];
  const sel = await tp.system.suggester(opts, opts, true, "¿Dónde guardar?");

  if (!sel) {
    throw new Error("Creación cancelada: destino no seleccionado.");
  }

  if (sel === "Misma carpeta de nota actual") {
    const ruta = tp.config.active_file?.path || "";
    const carpeta = ruta.substring(0, ruta.lastIndexOf("/"));
    await tp.file.rename(nuevoTitulo);
    destPath = `${carpeta}/${nuevoTitulo}`;
    await tp.file.move(destPath);
    await tp.file.cursor_append(`[[${nuevoTitulo}|${nuevoTitulo}]]`);
  } else {
    await tp.file.rename(nuevoTitulo);
  }
} else {
  await tp.file.rename(nuevoTitulo);
}

/* 3. Abrir en split view (opcional) */
if (destPath) {
  const fileObj = tp.app.vault.getAbstractFileByPath(`${destPath}.md`);
  if (fileObj) {
    const leaf = tp.app.workspace.getLeaf(true);
    await leaf.openFile(fileObj);
  }
}
_%>
---
type: <% tipo %>
commit: <% commitHash %>
branch: main
tagVersion: 
estado: 🟢
tags:
---

<% enlaceOrigen ? `origen:: ${enlaceOrigen}` : "" %>
