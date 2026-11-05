# Guía de pruebas · Notas DOVELA, notas de journal y estado (F9-notas)

> Matriz: **F71** (plantillas de los 22 tipos, sin Templater), **F72** (notas de journal Dly/Wly/Mly/Qly/Yly), **F73** (selector de estado 🟡🟢🔵🔴, nuevo).
> Código: `src/features/notes/` (comandos, modales, barra de estado) y lógica pura en `src/core/notes/`
> (`specs/*` = 17 tipos de creación, `journalNotes.ts` = 5 journals, `naming.ts`, `frontmatter.ts`, `folders.ts`, `parentLink.ts`, `templateText.ts`).
> Pruebas automáticas: `tests/notes/` (`pnpm test`). Comparan **byte a byte** cada nota generada con la plantilla Templater real
> (`docs/contexto-vault/reglas-vault/plantillas/`), los vectores de RI-E §8.3 y la cascada de embeds entre periodos (2020–2030).
> Requisito previo: plugin v2 en un **vault de prueba** (ver [05 · Guía de pruebas](../05-guia-de-pruebas.md) §1).

## 0. Preparación

1. Ajustes → Dovela → General: **Nota de Bandeja de Entrada** = `00 - Inbox/Bandeja de entrada.md` (de ella sale la carpeta `00 - Inbox`);
   **Carpeta de plantillas** vacía (se prueba en §5). Ajustes → Journal: valores por defecto (`AI - Journals/YYYY/MM/`, periodos en `{YYYY}`).
2. Crea estas notas de prueba:

| Nota | Contenido | Para probar |
|---|---|---|
| `Pruebas/PGTD 251001 - Proyecto X/PGTD 251001 - Proyecto X.md` | frontmatter `type: PGTD`, `estado: 🟢`, secciones `## Historial` y `## Recursos` | padre de notas hijas; enlace en `## Historial` |
| carpeta vacía `Pruebas/PGTD - Sin índice/` | (sin nota índice) | pregunta “¿Crear el proyecto principal…?” |
| `Pruebas/AV - Salud/AV - Salud.md` | `type: AV` | carpeta del tipo con índice → sub-ítem directo |
| `Pruebas/Suelta.md` | sin frontmatter | barra de estado oculta |

3. **Cómo comparar con v1 (Templater).** Usa una copia del vault con v1 + Templater (o el mismo vault con Templater todavía
   instalado: v2 no lo toca). Con la misma nota activa, ejecuta *Templater: Create new note from template* → `Plt - X`, responde lo mismo,
   y compara ambos archivos (p. ej. “Compare files” de VS Code o `diff`). Lo único que debe diferir son los cambios listados en §7
   (y la hora `HHmm` si no creaste ambas notas en el mismo minuto).

---

## 1. Apertura y cancelación (F71)

| Paso (escritorio) | Paso (móvil) | Resultado esperado |
|---|---|---|
| Paleta: **“Dovela: Nueva nota DOVELA…”** con una nota abierta | Paleta (deslizar hacia abajo) o icono de cinta `file-plus-2` | Selector “Nueva nota DOVELA: ¿qué tipo?” con 17 tipos (Ax, Btx, PGTD, Tx, Reu, Cmt, Ref, Sue, Vx, Podx, Prx, AV, AI, RR, RR de transacciones, RR de bitácoras, RC) y 5 journals; cada fila muestra el patrón de nombre |
| Escribir “reu” | Igual | Filtra por nombre o patrón |
| Paleta: **“Dovela: Nueva nota DOVELA: Anotación (Ax)”** (uno por tipo) | Igual | Salta el selector de tipo (útil para asignar atajos como los que tenías en Templater) |
| Clic derecho sobre una **carpeta** del explorador → “Nueva nota DOVELA aquí…” | Mantener pulsada la carpeta | Sin nota padre: la nota se crea en esa carpeta (equivale a `tp.file.folder(true)`) |
| Clic derecho sobre una **nota** → “Nueva nota DOVELA hija…” | Mantener pulsada la nota | Esa nota es el padre aunque no esté abierta |
| En cualquier pregunta: **Esc**, clic fuera o **Cancelar** | Botón atrás / tocar fuera / Cancelar | Aviso “creación cancelada”; **no se crea ningún archivo ni carpeta** |
| Campo obligatorio vacío + Enter/Aceptar | Igual | El modal no se cierra y muestra “No puede quedar vacío” (v1 cancelaba la creación con un aviso) |

Móvil: los campos de texto miden ≥ 44 px y usan letra de 16 px (el teclado no hace zoom); las opciones del selector miden ≥ 44 px.

## 2. Tipos y resultado esperado (F71)

Fecha de ejemplo: 5‑nov‑2025, 14:30, nota activa = `PGTD 251001 - Proyecto X`. En **todos** los casos la nota se crea directamente en su
ruta final (sin archivo “Sin título”), las carpetas que falten se crean antes y la nota nueva se abre en una pestaña nueva.

| Tipo | Preguntas | Archivo creado | Enlace en el padre | Comparar con |
|---|---|---|---|---|
| Ax | nombre “Idea”; destino “Misma carpeta de nota actual” | `Pruebas/PGTD 251001 - Proyecto X/Ax 251105 - Idea.md` | `[[Ax 251105 - Idea\|Ax 251105 - Idea]]` | `Plt - Anotacion` |
| Ax | destino “Inbox - Creado desde Carpeta” | `00 - Inbox/Ax 251105 - Idea.md` (frontmatter conserva `origen`) | ninguno | ídem (v1 la dejaba en la ubicación de notas nuevas: ver §7) |
| Ax sin nota activa (o desde carpeta) | solo nombre | carpeta del explorador o “ubicación por defecto de notas nuevas” de Obsidian; `origen: ""` | ninguno | ídem |
| Podx / Prx / Vx / Tx | igual que Ax (Tx: “Misma carpeta” / “Inbox”) | `Podx 251105 - …` etc. | `[[t\|t]]` si “misma” | `Plt - Podcast/Prompt/Video/Transacción` |
| Btx | nº sesión (por defecto `01`), descripción | siempre en la carpeta del padre: `Btx 251105 - Sesión 03 - Motor de notas.md` (descripción ≤ 50, nombre ≤ 80) | `- [[Btx …]] — 2025-11-05 \| Motor de notas` (línea propia) | `Plt - Bitacora` |
| Cmt | nombre “fix: a/b”, hash, destino | `Cmt 251105 1430 - fix- ab.md` (`:`→`-`, se quitan `/ \ < > \| " ? *`) | `[[t\|t]]` si “misma” | `Plt - Commit` (cuerpo `origen:: [[padre]]`) |
| Ref | “✅ Sí, ya sé el nombre” → nombre → destino | `Ref 251105 - Nombre.md`, `estado: 🟢`, secciones Contexto/Análisis/Conclusiones/Recursos | `[[t\|t]]` si “misma” | `Plt - Reflexión` |
| Ref | “🎙️ No, captura rápida por voz” | `00 - Inbox/Ref 251105-1430 - Sin título.md`, `fechaHora`, `estado: 🟡`, tarea `#cx-procesarReflexion` | ninguno | ídem |
| Sue | igual que Ref | `Sue 251105 - Título.md` / `00 - Inbox/Sue 251105-1430 - Sueño sin título.md`; `rol_analisis` y `tags: suenos` | ídem | `Plt - Sueño` |
| Reu | modo, nombre, hora inicio/fin (por defecto la actual), participantes “Ana, [[Luis]], #Bob”, destino | `Reu 251105 - Kickoff.md`; `participantes:` con `- "Ana"`, `- "Luis"`, `- "Bob"` | `[[t\|t]]` si “misma” | `Plt - Reunión` |
| Reu | “🎙️ con grabación” y nombre vacío | `Reu 251105-1430 - Sin título.md` en Inbox (o en la carpeta del padre si eliges “Misma carpeta”) | — | ídem |
| Reu | “sin grabación” → destino “Dejar aquí” | ubicación por defecto de notas nuevas | — | ídem |

### Contenedores PGTD / AV / AI / RR / RR de transacciones / RC (RI-E §5.5)

| Situación | Preguntas | Resultado |
|---|---|---|
| Padre en `Pruebas/` (carpeta normal), “No, usar carpeta actual”, “Crear Proyecto con Carpeta”, nombre “Lanzamiento” | 3 | `Pruebas/PGTD 251105 - Lanzamiento/PGTD 251105 - Lanzamiento.md`; en el padre, en el cursor: `[[Pruebas/PGTD 251105 - Lanzamiento/PGTD 251105 - Lanzamiento\|PGTD 251105 - Lanzamiento]]` |
| Igual con “sin Carpeta (solo archivo)” | 3 | `Pruebas/PGTD 251105 - Lanzamiento.md` |
| “Sí, crear en Bandeja de Entrada” | 3 | todo bajo `00 - Inbox/` |
| Clic derecho en `Pruebas/PGTD - Sin índice/` → Nueva nota aquí → PGTD | “Sí, crear el proyecto principal "Sin índice"” | `Pruebas/PGTD - Sin índice/PGTD - Sin índice.md` |
| Ídem, “No, crear un sub-proyecto…” | modo + nombre | `PGTD 251105 - Nombre` dentro de esa carpeta |
| Nota activa `AV - Salud.md` → AV | no pregunta “principal” (el índice existe); “¿Cómo deseas crear el nuevo sub-item AV?” | `Pruebas/AV - Salud/AV - Nombre/AV - Nombre.md` |
| AI / RR / RR de transacciones / RC | mismas reglas con prefijo `AI - `, `RR - `, `RC - ` | RC no lleva `origen`; RR de transacciones añade la tabla `### Transacciones` |
| RR de bitácoras con `Proyecto X` activo | ninguna | `…/Proyecto X/RR - Sesiones de trabajo/RR - Sesiones de trabajo.md`; en el padre `- [[…\|RR - Sesiones de trabajo]] — Repositorio de sesiones de trabajo del proyecto.` |
| Repetir RR de bitácoras | ninguna | aviso “ya existe; se abre sin modificarla” (no se sobrescribe nada) |

Comprobar además en cada nota: el frontmatter tiene **exactamente** las claves y el orden de la plantilla (p. ej. Ax termina en `tags: ` con
espacio; Tx `monto: `; Ref tiene una línea en blanco antes de `tags:`), y los bloques `datacorejsx`/`base` se ven igual que en las notas
creadas con v1 (Datacore y Bases deben estar activos en el vault).

## 3. Enlace en el padre

| Caso | Resultado esperado |
|---|---|
| Padre abierto en **modo edición** y activo | El enlace se inserta en el cursor (como `cursor_append` / `editor.replaceSelection`) **antes** de abrir la nota nueva |
| Padre en modo lectura, o elegido desde el explorador sin estar activo | Se añade como línea propia al final de la sección `## Historial`; si no existe, al final de la nota |
| Tipo/destino que en v1 no enlazaba (Inbox, capturas) | No se toca el padre |

## 4. Errores y casos límite

| Caso | Resultado |
|---|---|
| Nombre solo con caracteres inválidos (`???`) | Aviso “❌ Creación cancelada: el nombre no puede estar vacío.”; no se crea nada |
| La nota de destino ya existe (mismo nombre en la misma carpeta) | Aviso y se abre la existente; no se sobrescribe ni se inserta enlace |
| Nota creada por Sync en otro dispositivo al mismo tiempo | Igual que el caso anterior (no hay escritura ciega) |

## 5. Plantillas personalizadas (opcional)

1. Ajustes → General → **Carpeta de plantillas** = `Pruebas/Plantillas`.
2. Crea `Pruebas/Plantillas/Plt - Ax.md` con: `---\ntype: X\n---\n# {{titulo}}\nCreada el {{fecha}} desde {{enlacePadre}}\n<% tp.date.now() %>`.
3. Crea un Ax. Esperado: el **frontmatter es el del motor** (no `type: X`), el cuerpo es `# Ax 251105 - …`, `Creada el 2025-11-05 desde [[Padre]]`,
   y la línea `<% tp.date.now() %>` queda **tal cual** con un aviso “contiene código Templater… sin ejecutarlo”.
4. El archivo se llama `Plt - <código>.md` (`Plt - Ax.md`, `Plt - PGTD.md`, `Plt - RR-Tx.md`, `Plt - Dly.md`, `Plt - Wly.md`…) para no chocar con
   las plantillas Templater del vault (`Plt - Anotacion.md`, …), que nunca se leen.
5. Variables: `{{titulo}} {{tipo}} {{fecha}} {{fechaNombre}} {{hora}} {{fechaHora}} {{padre}} {{enlacePadre}} {{origen}} {{origenInline}} {{carpeta}}`;
   Btx `{{sesion}} {{descripcion}}`; Cmt `{{commit}}`; Reu `{{horaInicio}} {{horaFin}}`; journals: las de su plantilla (`{{semana}} {{mes}} {{trimestre}}`,
   `{{anteriorRuta}}`, `{{enlaces}}`, `{{dias}}`, `{{semanasMes}}`, …; ver `src/core/notes/journalNotes.ts`). Las desconocidas se dejan intactas.

## 6. Notas de journal (F72)

Comandos (paleta, escritorio y móvil): **“Abrir/crear nota diaria de hoy / de mañana / de ayer”**, **“… semanal (esta semana)”**,
**“… mensual (este mes)”**, **“… trimestral (este trimestre)”**, **“… anual (este año)”**; también desde “Nueva nota DOVELA…”.

| Paso | Resultado esperado (defaults) |
|---|---|
| Diaria de hoy (5‑nov‑2025) | crea `…/AI - Journals/2025/11/2025-11-05 miércoles.md` (y las carpetas `2025/11`) y la abre en la pestaña actual |
| Repetir | solo la abre (no la modifica) |
| Semanal | `…/AI - Journals/2025/2025-W45.md`; si ya existe una `2025-W45.md` en otra carpeta (p. ej. `2025/Q4/` de v1) **abre esa** |
| Mensual / trimestral / anual | `…/2025/2025-11.md`, `…/2025/2025-Q4.md`, `…/2025/2025.md` |

Comparar con v1: en la copia v1, crea a mano una nota llamada igual (`2025-11-05 miércoles`, `2025-W45`, `2025-11`, `2025-Q4`, `2025`) y aplica
`Journal/Plt - Diaria|Semanal|Mensual|Trimestral|Anual`. Para fechas normales el contenido es **idéntico** (probado automáticamente para
2025‑08‑12, 2025‑W33, 2025‑08, 2025‑Q2 y 2025). Revisa en la nota v2:

- Diaria: `semana: "[[2025-W45]]"`, `mes: "[[2025-11]]"`, `trimestre: "[[2025-Q4]]"`; enlaces ⬅️/➡️ al día anterior/siguiente con la ruta de **tus ajustes**
  (v1 tenía la ruta escrita en la plantilla); embed `![[2025-W45#2025-11-05 miércoles Plan y registro actividades …]]`.
- Semanal: título `W6 Q4 - Noviembre 2025`, `## Links` `[[2025-W44]] / [[2025-W46]]`, fila ` L [[2025-11-03 lunes|03]] …`, 7 encabezados `#####` por día.
- Mensual: `Semana 05: [[2025-W44]]` … ; trimestral: semanas agrupadas por mes según el jueves.

Bordes (cambia la fecha del sistema o usa los comandos “de mañana/de ayer” cerca de fin de año; también cubiertos por las pruebas):

| Fecha | v1 (Templater) | v2 |
|---|---|---|
| Diaria 2025‑12‑29 | embed a `2025-W01` (no existe) | `2026-W01` |
| Semanal de 2025‑12‑29 (`2026-W01`) | título “W1 Q1 - Diciembre 2026”; días correctos solo en UTC−X | “W1 Q1 - Enero 2026”; días 29‑dic…04‑ene en cualquier zona |
| Semanal `2025-W52` → siguiente | `2025-W01` | `2026-W01` |
| Semanal `2027-W01` → embed del mensual | “W1” (el mensual publica “W2”: embed roto) | “W2” (coincide) |
| Trimestral 2027‑Q3 (14 jueves) | 13 semanas (falta `2027-W39`) | 14 semanas |

## 7. Diferencias deliberadas con v1

1. Sin archivo “Sin título” ni `tp.file.move`: se crea en la ruta final; si existe, no se sobrescribe.
2. Opciones “Inbox” → carpeta de la Bandeja de Entrada de los ajustes; “Dejar aquí” / sin nota activa → carpeta del explorador o
   ubicación por defecto de notas nuevas de Obsidian (donde Templater creaba el “Sin título”).
3. Saneo de nombre (`:`→`-`, sin `/ \ < > | " ? *`) en todos los tipos (v1 solo en Cmt); Btx limita además el nombre total a 80.
4. `RR - Sesiones de trabajo`: frontmatter válido (la plantilla empezaba con `---\n---\n` y dejaba las propiedades como texto).
5. Contenedores: la variante de AI “la carpeta no existe, ¿crearla?” no aplica (la carpeta siempre existe: viene de una nota o del explorador).
6. Journals: correcciones de §6 (año ISO, días sin desfase horario, numeración de semana del trimestre única, 14.ª semana del trimestre,
   rutas de los enlaces diarios según los ajustes). La diaria sigue **sin** `fecha:` en el frontmatter (igual que la plantilla).
7. Enlace en el padre: cuando el editor activo no es el padre se escribe en `## Historial` (v1 dependía de qué editor tuviera el foco).

## 8. Selector de estado (F73, nuevo)

| Paso (escritorio) | Paso (móvil) | Resultado esperado |
|---|---|---|
| Abrir `PGTD 251001 - Proyecto X` | Igual | Barra de estado: `🟢 Activo` (clic → selector). En `Suelta.md` (sin `type`) el indicador desaparece |
| Paleta: **“Cambiar estado de la nota”** | Paleta | Selector con 🟡 Captura / borrador / pausa · 🟢 Activo / en proceso · 🔵 Revisado / archivado / procesado · 🔴 Bloqueado / error; el actual aparece en negrita con “Estado actual” |
| Elegir 🔵 | Igual | `estado: 🔵` en el frontmatter (resto de propiedades intactas), aviso “estado 🔵 Revisado”, el indicador cambia al instante |
| Clic derecho en una nota del explorador → “Cambiar estado de la nota” | Mantener pulsada | Igual, sin abrirla |
| Clic derecho dentro del editor → “Cambiar estado de la nota” | Mantener pulsado el texto | Igual |
| Nota sin `estado` pero con `type` | — | Indicador `⚪ Sin estado`; elegir uno crea la propiedad |
| Esc en el selector | Atrás | No cambia nada |

Notas: la barra de estado no existe en Obsidian móvil (usa paleta o menús). `processFrontMatter` reescribe el bloque YAML con el
formato de Obsidian (p. ej. `tags: ` con espacio final pasa a `tags:`); el contenido de la nota no cambia. En v1 no había selector:
comparar solo que el valor escrito sea uno de los cuatro emojis que usan las vistas (Backlinks, Foco, contenedores).
