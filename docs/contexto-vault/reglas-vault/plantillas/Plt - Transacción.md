<%*
/* 1. Variables iniciales */
const activeFile = tp.config.active_file;
const fecha = tp.date.now("YYMMDD");
const tipo = "Tx";
const nombre = await tp.system.prompt("Nombre de la Transacción?", "", true);

if (!nombre || !nombre.trim()) {
  new Notice("❌ Creación cancelada: el nombre no puede estar vacío.");
  throw new Error("Creación cancelada por nombre vacío.");
}

const nuevoTitulo = `${tipo} ${fecha} - ${nombre.trim()}`;

/* Guardar información de la nota origen */
let notaOrigen = null;
let enlaceOrigen = "";

/* 2. Determinar carpeta destino */
let destPath;
if (activeFile) {
  notaOrigen = activeFile.basename; // Nombre sin extensión
  enlaceOrigen = `[[${notaOrigen}]]`;
  const opts = ["Misma carpeta", "Inbox"];
  const sel = await tp.system.suggester(opts, opts, true, "¿Dónde guardar?");

  if (!sel) {
    throw new Error("Creación cancelada: destino no seleccionado.");
  }

  if (sel === "Misma carpeta") {
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

/* 3. Abrir en split view (opcional) */
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
tags: 
monto: 
moneda: COP
tipoTransaccion: Crédito
cuenta: Bancolombia Ahorros
origen: <% enlaceOrigen ? `"${enlaceOrigen}"` : '""' %>
---

# Soportes
