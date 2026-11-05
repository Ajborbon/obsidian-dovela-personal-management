<%*
/* ─────────────────────────────────────────────────────────────
   PLANTILLA: Reu — Reunión
   Dos carriles: A) Reunión sin grabación | B) Captura con grabación
   ───────────────────────────────────────────────────────────── */

const activeFile = tp.config.active_file;
const fechaNombre = tp.date.now("YYMMDD");
const fechaHoraN = tp.date.now("YYMMDD-HHmm");
const fechaISO = tp.date.now("YYYY-MM-DD");
const horaActual = tp.date.now("HH:mm");
const tipo = "Reu";
const modalidad = "virtual";

const opciones = [
  "📝 Reunión sin grabación",
  "🎙️ Reunión con grabación",
];
const modo = await tp.system.suggester(
  opciones,
  ["sin_grabacion", "con_grabacion"],
  true,
  "¿Cómo vas a registrar esta reunión?"
);

if (!modo) {
  throw new Error("Creación cancelada: modo no seleccionado.");
}

const esCaptura = (modo === "con_grabacion");

let nombre = await tp.system.prompt(
  esCaptura
    ? "¿Qué nombre provisional tiene esta reunión?"
    : "¿Qué nombre tiene esta reunión?",
  "",
  true
);
nombre = (nombre || "").trim();
if (!nombre) {
  if (esCaptura) {
    nombre = "Sin título";
  } else {
    new Notice("❌ Creación cancelada: el nombre no puede estar vacío.");
    throw new Error("Creación cancelada por nombre vacío.");
  }
}

const horaInicio = (await tp.system.prompt("Hora de inicio (HH:mm)", horaActual, true) || "").trim() || horaActual;
const horaFin = (await tp.system.prompt("Hora de finalización (HH:mm)", horaActual, true) || "").trim() || horaActual;

const participantesRaw = await tp.system.prompt(
  "Participantes separados por coma. Puedes usar [[wikilinks]] si aplica.",
  "",
  true
);
const participantes = (participantesRaw || "")
  .split(",")
  .map(p => p.trim())
  .filter(Boolean)
  .map(p => p.replace(/^\[\[/, "").replace(/\]\]$/, "").replace(/^#/, "").trim());

let nuevoTitulo;
if (esCaptura) {
  nuevoTitulo = nombre === "Sin título"
    ? `${tipo} ${fechaHoraN} - Sin título`
    : `${tipo} ${fechaNombre} - ${nombre}`;
} else {
  nuevoTitulo = `${tipo} ${fechaNombre} - ${nombre}`;
}

let destPath = "";
let enlaceOrigen = "";

if (activeFile) {
  enlaceOrigen = `"[[${activeFile.basename}]]"`;
}

if (activeFile) {
  const opts = [
    "Misma carpeta que la nota actual",
    esCaptura ? "Inbox" : "Dejar aquí",
  ];
  const values = [
    "misma",
    esCaptura ? "inbox" : "aqui",
  ];
  const sel = await tp.system.suggester(opts, values, true, "¿Dónde guardar la reunión?");

  if (!sel) {
    throw new Error("Creación cancelada: destino no seleccionado.");
  }

  if (sel === "misma") {
    const rutaBase = activeFile.path.substring(0, activeFile.path.lastIndexOf("/"));
    destPath = `${rutaBase}/${nuevoTitulo}`;
    await tp.file.rename(nuevoTitulo);
    await tp.file.move(destPath);
    await tp.file.cursor_append(`[[${nuevoTitulo}|${nuevoTitulo}]]`);
  } else if (sel === "inbox") {
    destPath = `00 - Inbox/${nuevoTitulo}`;
    await tp.file.rename(nuevoTitulo);
    await tp.file.move(destPath);
  } else {
    await tp.file.rename(nuevoTitulo);
  }
} else {
  if (esCaptura) {
    destPath = `00 - Inbox/${nuevoTitulo}`;
    await tp.file.rename(nuevoTitulo);
    await tp.file.move(destPath);
  } else {
    await tp.file.rename(nuevoTitulo);
  }
}

if (destPath) {
  const fileObj = tp.app.vault.getAbstractFileByPath(`${destPath}.md`);
  if (fileObj) {
    const leaf = tp.app.workspace.getLeaf(true);
    await leaf.openFile(fileObj);
  }
}

const participantesYaml = participantes.length
  ? participantes.map(p => `  - "${p.replace(/"/g, '\\"')}"`).join("\n")
  : "  - ";
_%>
---
type: <% tipo %>
fecha: <% fechaISO %>
hora_inicio: <% horaInicio %>
hora_fin: <% horaFin %>
modalidad: <% modalidad %>
participantes:
<% participantesYaml %>
origen: <% enlaceOrigen || '""' %>
estado: 🟢
tags:
---
<%* if (esCaptura) { %>
> 🎙️ **Captura rápida de reunión** — agrega aquí los audios y notas rápidas.
> Esta nota será procesada luego mediante la tarea `#cx-procesarReunion`.

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
<%* } else { %>
## Objetivo

## Contexto

## Notas

## Decisiones

## Acuerdos

## Próximos pasos

## Recursos
<%* } %>
