<%*
/* ─────────────────────────────────────────────────────────────
   PLANTILLA: Sue — Sueño  |  Versión 1.0
   Dos carriles: A) Registro nombrado  |  B) Captura rápida por voz
   Basada en Plt - Reflexión.md
   ───────────────────────────────────────────────────────────── */

const activeFile   = tp.config.active_file;
const fechaNombre  = tp.date.now("YYMMDD");
const fechaHoraN   = tp.date.now("YYMMDD-HHmm");
const fechaISO     = tp.date.now("YYYY-MM-DD");
const fechaHoraISO = tp.date.now("YYYY-MM-DD HH:mm");
const tipo         = "Sue";

/* ── PASO 1: Modo de creación ── */
const opciones = ["✅ Sí, recuerdo el sueño y puedo escribirlo", "🎙️ No, captura rápida por voz"];
const modo     = await tp.system.suggester(opciones, ["a", "b"], true,
                   "¿Cómo vas a registrar este sueño?");

if (!modo) {
  throw new Error("Creación cancelada: modo no seleccionado.");
}

let nuevoTitulo, destPath;
const esCaptura  = (modo === "b");
let enlaceOrigen = "";

/* ── CARRIL A: REGISTRO NOMBRADO ── */
if (modo === "a") {
  const nombre = await tp.system.prompt("Título breve del sueño", "", true);

  if (!nombre || !nombre.trim()) {
    new Notice("❌ Creación cancelada: el título no puede estar vacío.");
    throw new Error("Creación cancelada por título vacío.");
  }

  nuevoTitulo  = `${tipo} ${fechaNombre} - ${nombre.trim()}`;

  if (activeFile) {
    enlaceOrigen = `"[[${activeFile.basename}]]"`;
    const opts   = ["Misma carpeta que la nota actual", "Inbox"];
    const sel    = await tp.system.suggester(opts, ["misma", "inbox"], true,
                     "¿Dónde guardar el sueño?");

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
  nuevoTitulo = `${tipo} ${fechaHoraN} - Sueño sin título`;
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
rol_analisis: "[[Rol Análisis - Intérprete de Sueños]]"

tags:
  - suenos
---
<%* if (esCaptura) { %>
> 🎙️ **Captura rápida de sueño** — Graba lo que recuerdes antes de interpretarlo.
> Esta nota puede procesarse como reflexión con `/obsidian-procesar-reflexion`.

## Audios

<!-- Arrastra aquí tus grabaciones. Ejemplo: ![[audio-sueno-01.m4a]] -->

## Fragmentos rápidos

<!-- Palabras sueltas, imágenes, personas, lugares o sensaciones que no quieras perder -->


<%* } else { %>

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

<%* } if (esCaptura) { %>

---
- [ ] Transcribir y procesar este sueño como reflexión #cx-procesarReflexion
<%* } %>
