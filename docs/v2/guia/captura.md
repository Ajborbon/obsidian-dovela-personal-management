# Guía de pruebas · Captura rápida “Smart Inbox” (F6)

> Matriz: F26 (comando + cinta), F27 (`@` proyectos), F28 (`#` cascada), F29 (`!` calendario), F30 (fechas legacy), F31 (inserción), F77 (escritura incremental).
> Código: `src/features/capture/` (modal, menú, calendario, escritura); lógica pura en `src/core/capture/` (pruebas en `tests/capture/`, `pnpm test`).
> Requisito previo: plugin v2 en un **vault de prueba** (ver [05 · Guía de pruebas](../05-guia-de-pruebas.md) §1) con el índice construido
> (“Dovela: Diagnóstico: estado del índice” dice “listo”).
> Ajustes usados (Ajustes → Dovela → General): **Nota de Bandeja de Entrada** (`00 - Inbox/Bandeja de entrada.md`), **Encabezado de tareas** (`## Tareas`), **Hora en el sello ➕** (activado = formato v1).

## 0. Preparación de datos (una vez)

| Nota | Contenido mínimo | Para probar |
|---|---|---|
| `Pruebas/PGTD - X/PGTD - X.md` | `estado: 🟢`, `## Tareas` con `- [ ] a #cx-casa` | proyecto activo; coincidencia más larga |
| `Pruebas/PGTD - X Y/PGTD - X Y.md` | `estado: 🟢` (sin `## Tareas`) | coincidencia más larga; encabezado creado al final |
| `Pruebas/PQ - Plan/PQ - Plan.md` | `estado: 🟢` | `PQ -` sí aparece (en v1 no) |
| `Pruebas/RR - Recurso.md` | `estado: 🟢` | `RR` aparece |
| `Pruebas/PGTD - Cerrado/PGTD - Cerrado.md` | `estado: 🔵` | NO aparece en `@` |
| `Pruebas/Ax 261105 - Idea.md` | sin `estado` | nota activa no‑proyecto |
| Cualquier nota | `- [ ] llamar #cx-llamadas #px-maría` y `- [ ] ir #cx-oficina #cx-señal` | contextos/personas reales del menú |

Para comparar con v1: misma copia del vault con `main.js` de `main` (v1) en otra carpeta de plugins, o un segundo vault.

---

## 1. Apertura (F26)

| Paso (escritorio) | Paso (móvil) | Resultado esperado |
|---|---|---|
| Icono `⊕` (plus-circle) de la cinta | Menú ☰ → icono `⊕`, o paleta | Ventana modal “Smart Inbox” con el cursor en el campo de texto |
| Paleta: **“Smart Inbox: captura rápida”** | Igual | Igual. El id del comando es `smart-inbox` (como v1): el atajo que tuvieras asignado en v1 sigue funcionando |
| Esc (sin menú abierto) | Botón ✕ o “Cancelar” | Se cierra sin guardar nada |
| Clic fuera de la ventana | Toque fuera | Se cierra (si había un menú abierto, el primer clic solo cierra el menú) |

- Bajo el campo se ve siempre la **pista de sintaxis** (`@ proyecto · # etiqueta · ! fecha (…!mañana, !viernes, !261120)`) y el desplegable **“Ayuda de sintaxis”** (recuerda si lo dejaste abierto, por dispositivo).
- **Vista previa en vivo**: bajo el campo aparece `→ [[destino]]` y la línea exacta que se escribirá (`- [ ] … ➕ …`). Antes de escribir dice “La línea que se guardará aparecerá aquí”.

Comparación con v1: v1 usaba un overlay propio (`div` a pantalla completa) sin vista previa ni ayuda; v2 usa un `Modal` nativo (foco, Esc, accesibilidad, animación móvil).

## 2. Proyecto `@` (F27)

1. Abre `Ax 261105 - Idea` y lanza el Smart Inbox. Escribe `@`.
   - Esperado: panel “📁 Áreas y proyectos activos”. **Primera opción**: `📝 Ax 261105 - Idea` con detalle “Nota actual · Pruebas”. Luego AV/AI/PQ/PGTD/RR activos (🟢) ordenados por tipo y nombre, cada uno con su **tipo** (insignia) y **carpeta**. `PGTD - Cerrado` (🔵) no aparece.
2. Abre `PGTD - X` (proyecto activo) y escribe `@`: aparece **una sola vez**, primera, marcada como nota actual (sin duplicado).
3. Prueba sin proyectos activos (cambia todos a 🔵 temporalmente): la nota activa **sigue** apareciendo (v1 mostraba “No hay proyectos activos” y la ocultaba). Sin nota activa: mensaje “No hay proyectos ni áreas activos (🟢)”; Enter guarda.
4. Filtrado incremental: `@dov`, `@x y`, `@plan` → solo coincidencias, **resaltado** de lo escrito, ordenadas por relevancia (exacta > empieza por > inicio de palabra > contiene). Insensible a mayúsculas y acentos.
5. Elige con ↑↓ + Enter, Tab, clic o toque → el texto queda `@PGTD - X ` (con espacio) y el menú se cierra.
6. **Corrección v1 (descripción vacía):** escribe a mano `@PGTD - X comprar leche` y pulsa Enter.
   - Esperado v2: tarea `- [ ] comprar leche #inbox ➕ …` en `PGTD - X.md` bajo `## Tareas`.
   - v1: tomaba “PGTD - X comprar leche” como nombre → no existía → la tarea iba al Inbox **con descripción vacía**.
7. Coincidencia más larga: `@PGTD - X Y algo` → va a `PGTD - X Y` (no a `PGTD - X`); `@PGTD - Xylo` → no resuelve (avisa y va al Inbox).
8. `@[[Ax 261105 - Idea]] texto` → va a esa nota (cualquier nota por nombre exacto).
9. `comprar @NoExiste leche` → la vista previa avisa “No encuentro el proyecto «@NoExiste…»”, el texto se conserva íntegro y la tarea va a la Bandeja de entrada.
10. `Revisar @PGTD - X 📅 2026-11-10` (fecha del calendario tras el proyecto) → va a `PGTD - X` (v1 caía en el Inbox sin avisar).

## 3. Etiquetas `#` en cascada (F28, F77)

1. Escribe `#` → menú “🏷️ Etiquetas” con `cx-` (Contextos), `px-` (Personas asignadas), `GTD-` (Estados GTD).
2. Enter/Tab/clic en `cx-` → el texto pasa a `#cx-` y aparece “📍 Contexto” con **los contextos reales** de tus tareas ordenados por frecuencia (“3 tareas”). **No** aparecen los valores de ejemplo de v1 (`oficina, casa, llamadas, reuniones, urgente` / `juan, maria, carlos…`) salvo que existan en tus tareas.
3. Escribe `#cx-se` → filtra a `señal` con “se” resaltado (acentos y ñ funcionan). Enter → `#cx-señal ` y el menú se cierra.
4. **Backspace sobre `#cx-`** (justo tras el guion) → vuelve a `#` y al menú principal (v1 casi nunca lo hacía).
5. `#px-` → personas reales (`maría`). `#gtd-` → `AlgunDia` / `EstaSemanaNo`; el texto final siempre es `#GTD-AlgunDia`/`#GTD-EstaSemanaNo` aunque escribas `#gtd-algundia` a mano (v1 lo guardaba en minúsculas y el Dashboard no lo reconocía).
6. **Etiquetas libres:** escribe `#libro` → el menú dice “Etiqueta libre «#libro»” sin opciones; espacio y sigue escribiendo. En v1 Enter reemplazaba `#libro` por `#cx-`.
7. **Corrección v1 (Enter “tragado”):** escribe a mano `Comprar pan #cx-casa ir al súper` y pulsa Enter → se guarda. Variante: `Comprar #cx-zzz` (sin coincidencias) + Enter → se guarda con `#cx-zzz`. En v1 Enter no hacía nada hasta pulsar Esc.
8. El menú se cierra al escribir un **espacio** tras la etiqueta; Esc cierra el menú (no la ventana) y no vuelve a abrirse para esa misma etiqueta; un segundo Esc cierra la ventana.
9. Varias etiquetas: `x #cx-casa #cx-oficina #px-maría` → todas se guardan en orden contextos, personas, GTD.
10. Sin `#cx/#px/#GTD` se añade `#inbox` (también con proyecto, como v1). `#inbox` escrito a mano no se duplica.
11. El menú queda **debajo del campo** (no flotante): en móvil el teclado no lo tapa; si el espacio es poco, el panel se acorta y hace scroll.

## 4. Calendario `!` (F29)

1. Escribe `Pagar factura !` → panel “📆 Fecha” con tipos **🛫 Inicio / ⏳ Programada / 📅 Vence** (Vence seleccionado), rejilla del mes (**lunes primero**, hoy marcado) y accesos rápidos.
2. **Tab** alterna Inicio → Programada → Vence (Mayús+Tab al revés); también tocando el tipo.
3. ←/→ mueven un día, ↑/↓ una semana (cambia de mes solo); Enter confirma el día enfocado (por defecto hoy). Clic/toque en un día lo confirma.
4. El texto queda `Pagar factura 📅 2026-11-20 ` (icono según el tipo) y el panel se cierra.
5. Accesos rápidos (hoy = jueves 2026‑11‑05 como ejemplo): **Hoy** 11‑05, **Mañana** 11‑06, **Esta semana (vie)** 11‑06, **Próxima semana (vie)** 11‑13, **Próximo mes** 12‑05. Cada botón muestra su fecha.
6. **Fechas pasadas:** con 🛫/⏳ los días pasados están deshabilitados; con el teclado (←) sobre un día pasado + Enter aparece “… no admite fechas pasadas (solo 📅 Vence)” y no se inserta (en v1 el teclado sí lo permitía). Con 📅 Vence se permiten (como v1).
7. Escribe tras `!` una fecha (`!mañana`, `!viernes`, `!261120`): el calendario salta a esa fecha y muestra “«!mañana» → 2026‑11‑06 · Enter para usarla”; Enter la inserta **con el tipo elegido** (puedes Tab a ⏳ antes de Enter).
8. `!xyz` + Enter → el panel indica que no es fecha; Enter guarda la tarea y la vista previa avisa que `!xyz` se deja en el texto.

Diferencias con v1: rejilla independiente del locale de moment (v1 se desalineaba si el locale no era `es`); “Esta semana” = viernes ≥ hoy y “Próxima semana” = ese viernes + 7 (v1, en sábado, daba el mismo viernes para ambos).

## 5. Fechas escritas sin calendario (F30)

Escribe y guarda directamente (Enter) — todas se convierten en **📅 Vence**:

| Texto | Esperado (hoy = jue 2026‑11‑05) |
|---|---|
| `!hoy` / `!today` | 2026‑11‑05 |
| `!mañana` / `!manana` / `!tomorrow` | 2026‑11‑06 |
| `!ayer` / `!yesterday` | 2026‑11‑04 |
| `!pasado mañana` | 2026‑11‑07 |
| `!viernes` / `!vie` / `!friday` / `!fri` | 2026‑11‑06 (el próximo, **hoy incluido**: `!jueves` = hoy) |
| `!lunes` / `!monday` | 2026‑11‑09 |
| `!próximo viernes` / `!next friday` | 2026‑11‑13 (ese día de la **semana siguiente**, lunes‑domingo) |
| `!próxima semana` / `!próximo mes` | +7 días / +1 mes |
| `!2026-11-20` | 2026‑11‑20 |
| `!261120` (YYMMDD, backlog v0.9) | 2026‑11‑20 |
| `!261332` | no es fecha: queda en el texto con aviso |

v1: dependía del locale global de moment (`!monday` no funcionaba con `es`), no entendía español ni `YYMMDD`, y `next <día>` usaba semanas domingo‑sábado.
**Coherencia:** `x 🛫 2026-11-10 📅 2026-11-09` → la vista previa avisa “🛫 Inicio … es posterior a 📅 Vence …: la tarea aparecerá en la Bandeja de entrada hasta corregirlo” (se puede guardar igualmente; v1 solo hacía `console.warn`). Una 🛫/⏳ anterior a hoy se informa con ℹ️.

## 6. Guardado e inserción (F31)

1. Sin `@`: `Comprar leche` + Enter → Notice “Tarea añadida a [[Bandeja de entrada]]”; **el enlace del aviso abre la nota en la línea insertada**. Línea: `- [ ] Comprar leche #inbox ➕ 2026-11-05 14:32` (hora local; desactivando “Hora en el sello ➕” queda `➕ 2026-11-05`, formato del plugin Tasks).
2. **Bandeja inexistente:** borra `00 - Inbox/` y captura → se crean carpeta y archivo con `## Tareas` + la tarea (v1 dejaba la primera tarea sin encabezado y lo añadía en la segunda captura).
3. Cambia la ruta del Inbox a `Otra/Carpeta/Inbox` (sin `.md`) → se crea `Otra/Carpeta/Inbox.md` con carpetas intermedias.
4. Con proyecto con `## Tareas` y más secciones después: la tarea queda **al final de la sección** (tras la última línea no vacía, antes del siguiente `##` o `#`); los `###` dentro de la sección cuentan como parte de ella.
5. Proyecto sin `## Tareas` (`PGTD - X Y`) → se añade `## Tareas` al final con la tarea.
6. Encabezados dentro de bloques de código o del frontmatter se ignoran. Un `## Tareas pendientes` (sin `## Tareas` exacto) se usa como sección (como v1); `### Tareas` no se confunde con `## Tareas`.
7. **Descripción vacía:** `@PGTD - X #cx-casa !hoy` + Enter → Notice “la descripción está vacía; no se guardó nada”, la ventana sigue abierta (v1 guardaba `- [ ]` vacío o cerraba).
8. Error de escritura (p. ej. ruta del Inbox `Pruebas/RR - Recurso.md/Inbox`, donde una “carpeta” es en realidad una nota) → Notice con el motivo; el texto sigue en la ventana.
9. La escritura usa `vault.process` (atómica); con Sync, capturas en dos dispositivos al mismo Inbox se fusionan como cualquier edición de nota.
10. Comprueba en el Dashboard GTD que la tarea capturada aparece en Bandeja de entrada (o en su contexto) y que `➕` **no** se muestra dentro del texto (v2 lo extrae; v1 lo mostraba).

## 7. Móvil (iOS/Android)

| Paso | Esperado |
|---|---|
| Abre el Smart Inbox desde la cinta | Ventana arriba de la pantalla, campo enfocado y teclado abierto; el texto se ve a 16 px (sin zoom de iOS) |
| Escribe `@` / `#` | El panel aparece **entre el campo y el teclado**; si no cabe, se acorta y hace scroll |
| Toca una opción | Se inserta sin cerrar el teclado (el campo no pierde el foco) |
| `!` | Calendario con días de 44 px táctiles; tipo y accesos rápidos tocables |
| Tecla “Enviar” del teclado | Guarda (o elige la opción del menú si hay coincidencias) |
| Botón **Guardar** | Guarda aunque el teclado no tenga Enter |
| Gira el dispositivo | El panel se recoloca (recalcula el alto con `visualViewport`) |

## 8. Pruebas automáticas

`pnpm test` → `tests/capture/`:
- `tokenize.test.ts`: `@` más largo, `@[[…]]`, sin consumir el resto; cx/px con acentos; GTD normalizado; etiquetas libres; fechas de calendario y legacy (es/en, YYMMDD); duplicados; coherencia; línea final entendida por el parser de tareas.
- `menu.test.ts`: disparador activo, cierre con espacio, Enter sin opciones, cascada y filtrado con relevancia/resaltado, Backspace sobre `#cx-`, nota activa primero, fuentes del índice, accesos rápidos.
- `insert.test.ts`: semántica de sección, encabezado ausente, archivo nuevo, frontmatter/código, CRLF, línea insertada.
