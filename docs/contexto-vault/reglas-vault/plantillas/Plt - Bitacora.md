<%*
/* ─────────────────────────────────────────────────────────────
   PLANTILLA: Btx — Bitácora de Sesión de Trabajo | Versión 1.0
   Estándar DOVELA para registro de sesiones de trabajo con IA y ejecución
   ───────────────────────────────────────────────────────────── */

const activeFile = tp.config.active_file;
const fecha = tp.date.now("YYMMDD");
const fechaISO = tp.date.now("YYYY-MM-DD");
const tipo = "Btx";

/* 1. Contexto de origen */
let notaOrigen = null;
let enlaceOrigen = "";
if (activeFile) {
  notaOrigen = activeFile.basename;
  enlaceOrigen = `[[${notaOrigen}]]`;
}

/* 2. Preguntar datos de la sesión */
const numSesion = await tp.system.prompt("Número de sesión (ej. 01, 02, 15):", "01", true);

if (!numSesion || !numSesion.trim()) {
  new Notice("❌ Creación cancelada: el número de sesión no puede estar vacío.");
  throw new Error("Creación cancelada por número de sesión vacío.");
}

const descCorta = await tp.system.prompt("Descripción corta de la sesión (máx 50 caracteres):", "", true);

if (!descCorta || !descCorta.trim()) {
  new Notice("❌ Creación cancelada: la descripción no puede estar vacía.");
  throw new Error("Creación cancelada por descripción vacía.");
}

// Limitar longitud del nombre para compatibilidad en Mac/Cloud
const descLimpia = descCorta.substring(0, 50).trim();
const nuevoTitulo = `${tipo} ${fecha} - Sesión ${numSesion.trim()} - ${descLimpia}`;

/* 3. Determinar destino */
let destPath;
if (activeFile) {
  const rutaCompleta = tp.config.active_file?.path || "";
  const carpetaAct = rutaCompleta.substring(0, rutaCompleta.lastIndexOf("/"));
  destPath = `${carpetaAct}/${nuevoTitulo}`;
  await tp.file.rename(nuevoTitulo);
  await tp.file.move(destPath);
  await tp.file.cursor_append(`- [[${nuevoTitulo}]] — ${fechaISO} | ${descLimpia}\n`);
} else {
  await tp.file.rename(nuevoTitulo);
}

/* 4. Abrir archivo */
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
fecha: <% fechaISO %>
estado: 🟢
origen: <% enlaceOrigen ? `"${enlaceOrigen}"` : '""' %>
tags:
  - "#cx-SesionesTrabajo"
---

# <% nuevoTitulo %>

## 1. Período y Participantes
- **Fecha:** <% fechaISO %>
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
