<%*
/* ─────────────────────────────────────────────────────────────
   PLANTILLA: Ref — Reflexión  |  Versión 2.0
   Dos carriles: A) Nombrada  |  B) Captura rápida por voz
   ───────────────────────────────────────────────────────────── */

const activeFile   = tp.config.active_file;
const fechaNombre  = tp.date.now("YYMMDD");
const fechaHoraN   = tp.date.now("YYMMDD-HHmm");
const fechaISO     = tp.date.now("YYYY-MM-DD");
const fechaHoraISO = tp.date.now("YYYY-MM-DD HH:mm");
const tipo         = "Ref";

/* ── PASO 1: Modo de creación ── */
const opciones = ["✅ Sí, ya sé el nombre", "🎙️ No, captura rápida por voz"];
const modo     = await tp.system.suggester(opciones, ["a", "b"], true,
                   "¿Cómo vas a crear esta reflexión?");

if (!modo) {
  throw new Error("Creación cancelada: modo no seleccionado.");
}

let nuevoTitulo, destPath;
const esCaptura  = (modo === "b");
let enlaceOrigen = "";

/* ── CARRIL A: NOMBRADO ── */
if (modo === "a") {
  const nombre = await tp.system.prompt("¿Sobre qué reflexionas?", "", true);

  if (!nombre || !nombre.trim()) {
    new Notice("❌ Creación cancelada: el nombre no puede estar vacío.");
    throw new Error("Creación cancelada por nombre vacío.");
  }

  nuevoTitulo  = `${tipo} ${fechaNombre} - ${nombre.trim()}`;

  if (activeFile) {
    enlaceOrigen = `"[[${activeFile.basename}]]"`;
    const opts   = ["Misma carpeta que la nota actual", "Inbox"];
    const sel    = await tp.system.suggester(opts, ["misma", "inbox"], true,
                     "¿Dónde guardar la reflexión?");

    if (!sel) {
      throw new Error("Creación cancelada: destino no seleccionado.");
    }

    if (sel === "misma") {
      const rutaBase = activeFile.path.substring(0, activeFile.path.lastIndexOf("/"));
      destPath = `${rutaBase}/${nuevoTitulo}`;
      await tp.file.rename(nuevoTitulo);
      await tp.file.move(destPath);
      await tp.file.cursor_append(`[[${nuevoTitulo}|${nuevoTitulo}]]`);
    } else {
      await tp.file.rename(nuevoTitulo);
    }
  } else {
    await tp.file.rename(nuevoTitulo);
  }

/* ── CARRIL B: CAPTURA RÁPIDA ── */
} else {
  nuevoTitulo = `${tipo} ${fechaHoraN} - Sin título`;
  destPath    = `00 - Inbox/${nuevoTitulo}`;
  if (activeFile) {
    enlaceOrigen = `"[[${activeFile.basename}]]"`;
  }
  await tp.file.rename(nuevoTitulo);
  await tp.file.move(destPath);
}

/* ── ABRIR EN SPLIT VIEW si hay destino fijo ── */
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
fecha: <% fechaISO %>
<%* if (esCaptura) { %>fechaHora: <% fechaHoraISO %>
<%* } %>origen: <% enlaceOrigen || '""' %>
estado: <% esCaptura ? "🟡" : "🟢" %>
rol_analisis: ""

tags:
---
<%* if (esCaptura) { %>
> 🎙️ **Captura rápida** — Graba tu reflexión y arrastra los audios a la sección de abajo.
> Esta nota será procesada por Claude con `/obsidian-procesar-reflexion`.

## Audios

<!-- Arrastra aquí tus grabaciones. Ejemplo: ![[audio-reflexion-01.m4a]] -->

## Notas rápidas

<!-- Texto adicional mientras grabas, si lo necesitas -->

---
<%* } else { %>

## Contexto

## Análisis

## Conclusiones

## Recursos

<%* } %>
<%* if (esCaptura) { %>
## Contexto

## Análisis

## Conclusiones

## Recursos

---
<%* tR += "- [ ] Transcribir y procesar esta reflexión #cx-procesarReflexion\n"; } %>
