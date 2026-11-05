# CLAUDE.md — Segundo Cerebro Digital de Andres Borbon

Vault de Obsidian de Andres Borbon (AJBB): ~2.700 notas bajo una metodología propia
inspirada en PARA. Es un segundo cerebro personal y profesional, no un repo de código.

**Detalle completo** (tabla de 13 tipos, patrón RR, jerarquía, contexto de negocios):
`.claude/referencia-vault.md` — léelo cuando lo necesites, no viene precargado.
**Reglas cross-agent** (Antigravity / Codex / Claude Code): `AGENTS.md`.

---

## Estructura

```
Grupo → AV (Área de Vida) → AI (Área de Interés) → PGTD (Proyecto) → notas hijas
```

Grupos raíz: `00 - Inbox`, `01 - Productividad`, `02 - Desarrollo Habilidades`,
`03 - Gestion Personal`, `04 - Finanzas Personales`, `05 - Balance Interior`,
`06 - Relaciones`, `07 - Entretenimiento`.

## Tipos de nota (`type:` en YAML)

Los más frecuentes: `Ax` (anotación), `Btx` (bitácora / sesión de trabajo), `PGTD` (proyecto), `Tx` (transacción),
`Dly` (diario), `Reu` (reunión), `AI` / `AV` (áreas), `RR` (recurso recurrente),
`Cmt` (commit), `Vx` (video), `Wly` (semanal), `Ref` (reflexión), `GrupoAV`.

Un **`RR` es una carpeta**, no una nota suelta: agrupa instancias repetidas del mismo
tipo (pagos mensuales, sesiones recurrentes) y contiene una nota índice homónima.
A diferencia de un `PGTD`, no tiene fin.

## Nomenclatura

| Qué | Formato |
|---|---|
| Bitácoras de sesión | `Btx YYMMDD - Sesión NN [Proyecto] - [Desc Corta].md` (máx 80 caracteres) |
| Notas temporales / docs | `[Tipo] YYMMDD - Descripción.md` |
| Áreas | `AV - Nombre.md` / `AI - Nombre.md` |
| Proyectos | `PGTD YYMMDD - Nombre.md` o `PGTD - Nombre Permanente` |
| Diarios | `YYYY-MM-DD nombre-día.md` (en `AI - Journals/YYYY/MM/`) |
| Semanales | `YYYY-WNN.md` |
| Recursos recurrentes | `RR - Nombre/RR - Nombre.md` |

Fechas: `YYMMDD` en nombres de archivo, `YYYY-MM-DD` en YAML y wikilinks.

## Frontmatter y estados

```yaml
---
type: [según tabla]
estado: 🟢
tags:
---
```

- `🟡` **Amarillo (Captura / Borrador / Pausa):** Audio/video en Inbox por procesar; PGTD pausado ("Algún día"); borrador.
- `🟢` **Verde (Activo / En proceso / Por Leer):** Nota activa, sobre la que se trabaja. Contenido (`Vx`, `Podx`, `Ref`) generado por IA pendiente de lectura de Andres; sesión `Btx` activa del sprint; PGTD activo. En journals (`Dly`/`Wly`/`Mly`/`Qly`) significa pendiente: la nota todavía está en proceso y no hay conclusión.
- `🔵` **Azul (Revisado / Leído / Archivado / Procesado):** Contenido ya leído o estudiado; sesión `Btx` concluida; PGTD completado y archivado. En journals, la nota está procesada y aprobada: bitácora final escrita, sección `## Borrador` eliminada y `destacado:` con texto. La transición de 🟢 a 🔵 la hace el agente tras la aprobación de Andrés, nunca antes.
- `🔴` **Rojo (Bloqueado / Error):** Error de descarga/transcripción; proyecto bloqueado.

---

## Comportamiento esperado

**Al crear notas**
- Tipo correcto según contenido; nomenclatura `[Tipo] YYMMDD - Descripción.md` (o `Btx...`)
- Carpeta correcta según Grupo → AV → AI → PGTD; si no está claro, `00 - Inbox/`
- Frontmatter mínimo: `type`, `estado: 🟢`, `tags:`
- Agregar `origen::` con wikilink al contenedor padre cuando aplique
- Consultar primero la plantilla en `Plantillas/` si existe

**Al editar**
- Edición quirúrgica sobre archivos existentes; nunca sobrescribir completo
- No alterar bloques `dataview` / `dataviewjs` / `datacorejsx` — son queries automáticas
- No tocar `## Tareas` ni `## Estructura PGTD` al modificar texto superior
- No cambiar la estructura de carpetas sin confirmación explícita
- Mantener `estado:` consistente con el contenido real

**Al buscar**
- **Consultas semánticas, antecedentes y contexto:** Usa prioritariamente el MCP `dovela-rag` (`search_vault` o `ask_vault`) para recuperar fragmentos y respuestas del vault (~7.380 notas en `/Users/andresborbon/Vaults/AJBB Crezco360`) sin ejecutar `grep -r` masivo, protegiendo la ventana de contexto del agente y el rendimiento del sistema.
- **Búsquedas exactas o auditoría:** Usa `grep`/`rg` únicamente para auditar checkboxes GTD (`- [ ]`) en notas contenedor concretas, validar frontmatter YAML específico o localizar nombres exactos de archivo.
- Las notas importantes suelen tener hijos en la misma carpeta.

**Registro de sesión (proactivo)**
Ejecutar el skill `obsidian-session-log` sin que el usuario lo pida, ante:
hito de avance · ~8–10 turnos densos o antes de `/compact` · cierre o cambio de tema.
- Crear nota `Btx YYMMDD - Sesión NN...` (máx 80 chars).
- En la nota `Btx` (`## Pendientes al cierre`), redacta siempre en **viñetas descriptivas de texto plano (`- `)**.
- Las tareas operativas resultantes se agregan a la sección `## Tareas` del `PGTD` contenedor: `- [ ] Tarea #cx-Proyecto 🛫 [[Btx YYMMDD - Sesión NN...]]`.
Al arrancar una conversación, leer la última bitácora del `RR - Sesiones de trabajo`
del proyecto activo para sincronizar con Antigravity y Codex.

**Regla de Tareas Centralizadas (GTD DOVELA)**
- Las tareas (`- [ ]`) viven **ÚNICAMENTE** en `PGTD`, `RR`, `00 - Inbox` y acuerdos en `Reu`.
- Las notas de conocimiento (`Ax`, `Btx`, `Vx`, `Ref`, `Sue`, `Podx`, `Prx`, `Cmt`) **NUNCA** llevan checkboxes `- [ ]`.
- Tareas de pipeline (`#cx-procesarReflexion`, etc.) viven solo temporalmente en `00 - Inbox`.


**Operación en Herdr (Multiplexor)**
Si la sesión corre dentro de Herdr (`HERDR_ENV=1`), activa automáticamente el skill `herdr` (o con `/herdr`). Abre paneles a la derecha con `herdr pane split --current --direction right --cwd "$PWD" --no-focus`, espera reactivamente sin encadenar `&&`, e higieniza contexto con `/clear` al cerrar lotes. Al recibir tareas delegadas desde Gemini, opera sobre el contexto predigerido entregado en el prompt/brief; no hagas lecturas masivas exploratorias para proteger tu ventana de contexto. Regla completa en `AGENTS.md`.

**Idioma**
Responder siempre en **español**. Nombres de archivos y carpetas mantienen su
convención original (mezcla español/inglés según contexto).

@AGENTS.md
