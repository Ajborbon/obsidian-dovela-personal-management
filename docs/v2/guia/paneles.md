# Guía de pruebas · Paneles de Actividad y de Revisión GTD (F7)

> Matriz: F12 (estancados), F52 (panel de actividad), F53 (panel de revisión).
> Código: `src/features/panels/`, lógica pura en `src/core/panels/` (pruebas en `tests/panels/`, `pnpm test`).
> Requisito previo: plugin v2 instalado en un **vault de prueba** (ver [05 · Guía de pruebas](../05-guia-de-pruebas.md) §1) y el índice construido
> (“Dovela: Diagnóstico: estado del índice” dice “listo”).

## 0. Preparación de datos (una vez)

Crea en el vault de prueba (o localiza en la copia del vault real):

| Nota | Contenido mínimo | Para probar |
|---|---|---|
| `Pruebas/PGTD Panel A/PGTD Panel A.md` | frontmatter `estado: 🟢`, sección `## Tareas` con solo `- [x] hecha ✅ <hoy>` | estancado |
| `Pruebas/PGTD Panel B/PGTD Panel B.md` | `estado: 🟢`, `- [/] en curso` | NO estancado (`[/]` cuenta como abierta) |
| `Pruebas/PGTD Panel C/PGTD Panel C.md` | `estado: 🟢`, sin sección `## Tareas`, enlace `[[Nota enlazada C]]` | estancado; luego no (paso 2.4) |
| `Pruebas/Nota enlazada C.md` | vacía al principio | enlaces a 1–2 niveles |
| `Pruebas/PGTD Panel A/PGTD Hijo/PGTD Hijo.md` | `estado: 🟡` | resumen 2.º nivel |
| `Pruebas/Ax 261105 - Idea con tarea.md` | `- [ ] tarea en nota de conocimiento` | lint de notas de conocimiento |
| Cualquier nota | `- [ ] capturada ➕ <hoy>` y `- [x] cerrada ➕ <ayer> ✅ <hoy>` | panel de actividad |

`<hoy>`/`<ayer>` en formato `YYYY-MM-DD`.

---

## 1. Panel de Actividad (F52)

### 1.1 Apertura
| Paso (escritorio) | Paso (móvil) | Resultado esperado |
|---|---|---|
| Icono de la cinta “Panel de Actividad” (icono `activity`) | Menú ☰ → icono de la cinta, o paleta de comandos | Se abre una pestaña “Panel de Actividad”. Si ya estaba abierta, se revela (no se duplica) |
| Paleta: **“Panel de Actividad: Mostrar resumen de actividad”** | Igual (paleta en la barra inferior) | Igual. El id del comando es el de v1 (`open-activity-panel`): los atajos de teclado asignados en v1 siguen funcionando |

Comparación con v1: misma vista (`dovela-activity-view`), mismo comando, mismo icono. Si el layout guardado de v1 tenía la vista abierta, v2 la restaura.

### 1.2 Periodos
1. Pulsa **Hoy**, **Ayer**, **Esta semana**, **Este mes**. Bajo el título aparece el rango exacto:
   - Hoy = hoy→hoy; Ayer = ayer→ayer; Esta semana = **lunes** de la semana actual → hoy; Este mes = día 1 → hoy.
2. Cierra y reabre el panel: recuerda el último periodo **en este dispositivo** (no viaja por Sync).
3. **Personalizado**: aparece un calendario (lunes primero). Toca un día inicial y luego el final → el rango se resalta y las métricas se recalculan. “Cancelar” anula una selección a medias. Las flechas ‹ › cambian de mes.
   - Si eliges primero el día final y luego el inicial, el rango se ordena solo.
   - Al entrar por primera vez en Personalizado, el rango por defecto son los últimos 30 días.

**Diferencia con v1 (corrección):** en v1 el fin del rango personalizado se cortaba a las 00:00, así que las notas creadas/modificadas ese último día no contaban. En v2 el último día cuenta **entero**. Prueba: rango personalizado que termine hoy → una nota que modifiques ahora aparece en “Modificadas”.

### 1.3 Métricas
| Tarjeta | Métrica | Esperado |
|---|---|---|
| 📊 Balance de tareas | Capturadas (➕) | Tareas (de cualquier estado) con `➕ fecha` dentro del rango |
| | Completadas (✅) | Tareas `[x]` con `✅ fecha` dentro del rango |
| | Balance neto | Completadas − capturadas; verde si > 0, rojo si < 0 |
| 📝 Actividad de notas | Creadas | Notas cuya fecha de creación (ctime) cae en el rango |
| | Modificadas | Notas cuya fecha de modificación (mtime) cae en el rango (incluye las creadas, como en v1) |

- Pasa el ratón (escritorio) sobre “Creadas/Modificadas”: tooltip que explica que con Obsidian Sync la fecha puede reflejar la llegada del archivo al dispositivo. En móvil la misma advertencia se ve como texto “ⓘ …” bajo la tarjeta.
- **Reactividad:** con el panel visible, añade en una nota `- [ ] nueva ➕ <hoy>` → en ~0,5 s “Capturadas” sube en 1 sin tocar nada. Márcala `[x]` con `✅ <hoy>` → sube “Completadas”.
- Con el panel en una pestaña oculta, edita notas: no se recalcula hasta que vuelves a la pestaña (ahorra batería en móvil).

Diferencias con v1 (documentadas):
- v1 leía **todo el vault** en cada apertura/cambio de periodo y contaba cualquier línea con `➕`/`✅` (no solo tareas). v2 usa el índice: solo tareas reales (fuera de bloques de código y comentarios), carga instantánea.
- Una tarea reabierta (`[ ]`) que conserva `✅` ya no cuenta como completada.
- Las notas de las carpetas excluidas (plantillas, `99 - Adjuntos`) y los archivos de registro de tiempo (`Dovela/Registro de tiempo/`) no cuentan como notas creadas/modificadas (los escribe el propio plugin).
- Los números pueden diferir de v1 por estas razones; para comparar: abre v1 y v2 sobre copias idénticas, mismo periodo “Esta semana”, y anota la diferencia; debe explicarse por alguno de los puntos anteriores.

### 1.4 Desglose (clic en cada métrica)
1. Toca “Capturadas”: se abre la lista con título “Tareas capturadas · Esta semana (N)”. Cada fila: estado (☐ ☑ ◐ ☒), texto de la tarea y `➕ fecha · nota`.
2. Toca una fila → abre la nota **en la línea de la tarea**. Si el panel está en el área principal, la nota se abre en otra pestaña (no reemplaza el panel); si la nota ya estaba abierta, se reutiliza su pestaña. Ctrl/Cmd+clic → pestaña nueva.
3. “← Volver al panel” vuelve al resumen.
4. “Creadas/Modificadas”: filas con nombre, “Creada/Modificada: YYYY-MM-DD HH:mm · carpeta”; tocar abre la nota.
5. Métricas con valor 0 no son pulsables (como v1).
6. Con más de 150 elementos (p. ej. “Este mes” en “Modificadas”) la lista se virtualiza: desplazamiento fluido en móvil.

Comparación con v1: v1 mostraba `[x]` delante de todas las tareas (también las capturadas abiertas) y abría siempre en pestaña nueva sin ir a la línea.

### 1.5 Serie del periodo
- Debajo de las tarjetas: “Por día” (≤ 31 días), “Por semana” (≤ 26 semanas) o “Por mes” (rangos más largos).
- Botones **Tareas / Notas**: alternan entre capturadas/completadas y creadas/modificadas. Cada fila tiene dos barras (azul y verde) proporcionales al máximo del periodo; el día/semana actual se resalta. Tooltip con los valores exactos.
- v1 no tenía serie (novedad).

---

## 2. Panel de Revisión GTD (F53 + F12)

### 2.1 Apertura
| Paso | Resultado esperado |
|---|---|
| Cinta: icono `clipboard-check` (“Panel de Revisión GTD”) | Se abre/revela la pestaña |
| Paleta: **“Revisión GTD: Encontrar proyectos estancados”** | Igual; id `open-gtd-review-panel` (el de v1) |

### 2.2 Proyectos estancados (regla de v1)
Un proyecto es una carpeta cuyo nombre empieza por `PGTD ` (con espacio) que contiene su nota-carpeta `PGTD X/PGTD X.md`.
Está **estancado** si su `estado` es 🟢 y **no hay ninguna tarea abierta** (`- [ ]` o `- [/]`) en:
- la carpeta del proyecto y todas sus subcarpetas (incluidos PGTD hijos), ni
- las notas enlazadas desde ellas (enlaces salientes) hasta **2 niveles**.

Con los datos de §0:
1. Aparecen **PGTD Panel A** y **PGTD Panel C**; no aparece **PGTD Panel B** (tiene `[/]`).
2. Texto: “Se encontraron 2 proyectos activos (🟢) que no tienen próximas acciones definidas…”. Cada tarjeta: nombre, `📂 carpeta · N notas revisadas · nivel 1`.
3. `estado: 🟢️` (con selector de variación invisible) también se reconoce como activo (en v1 fallaba la comparación exacta).
4. Si no hay estancados: “✅ ¡Excelente! Todos tus proyectos tienen próximas acciones definidas. ¡Sigue así!” (mismo texto que v1).

### 2.3 Acciones
| Botón | Pasos | Resultado esperado | v1 |
|---|---|---|---|
| **+ Añadir tarea** | Pulsa en “PGTD Panel A” | La nota se abre en modo edición, se añade `- [ ] ` al final de la sección `## Tareas` (tras su última línea no vacía, antes del siguiente encabezado) y el cursor queda listo para escribir. En móvil se abre el teclado | v1 solo abría la nota |
| | Pulsa en “PGTD Panel C” (sin `## Tareas`) | Se crea `## Tareas` al final de la nota con `- [ ] ` debajo; aviso “Sección «## Tareas» creada…” | — |
| | Escribe el texto de la tarea | Al cabo de ~0,5 s el proyecto **desaparece** de la lista (reactivo) | v1 no se actualizaba |
| **🔵 Archivar** | Pulsa en un estancado | Diálogo “Archivar proyecto” con Cancelar / 🔵 Archivar. Cancelar o Esc no cambia nada. Confirmar → `estado: 🔵` en el frontmatter (resto del frontmatter intacto), aviso, y el proyecto sale de la lista | v1 archivaba sin confirmación |
| **Abrir nota** | Pulsa | Abre la nota-carpeta (en otra pestaña si el panel está en el área principal) | v1 tenía “📂 Abrir carpeta” solo en escritorio (`openWithDefaultApp`); en móvil fallaba |

- El encabezado usado es el de Ajustes → General → “Encabezado de tareas” (por defecto `## Tareas`).
- Durante una acción los botones de esa tarjeta se desactivan (evita dobles toques en móvil).

### 2.4 Enlaces a 2 niveles
1. En `Nota enlazada C.md` escribe `- [ ] algo` → **PGTD Panel C** deja de estar estancado (nivel 1).
2. Borra esa tarea; crea `Nivel 2.md` con `- [ ] algo` y enlázala desde `Nota enlazada C` → sigue sin estar estancado (nivel 2).
3. Mueve la tarea a una `Nivel 3.md` enlazada solo desde `Nivel 2.md` → vuelve a aparecer como estancado (el 3.er nivel no cuenta, como en v1).

Nota: v2 usa los enlaces resueltos de Obsidian (`resolvedLinks`), que incluyen incrustaciones y enlaces de propiedades; v1 solo usaba enlaces del cuerpo. Puede haber algún proyecto que en v1 salía estancado y en v2 no (si su única tarea abierta está en una nota incrustada).

### 2.5 Refrescar
- Botón **⟳ Refrescar**: recalcula y actualiza “Actualizado YYYY-MM-DD HH:mm”. El panel también se actualiza solo con los cambios de las notas (si está visible).

### 2.6 Resumen de proyectos PGTD por nivel (backlog v0.9)
- Tabla con filas **1.er nivel**, **2.º nivel**, **3.er nivel o más** (número de carpetas `PGTD ` en la ruta) y columnas 🟢 activos, 🟡 pausados, 🔴 bloqueados, 🔵 archivados, — sin estado, ⏳ sin modificar, Total; fila de totales.
- Con §0: “PGTD Hijo” cuenta en 2.º nivel como 🟡.
- **Sin modificar hace más de [30] días**: cambia el número (p. ej. 1) → la columna ⏳ y la lista plegable “Proyectos sin modificar hace más de N días” se recalculan. El valor se recuerda por dispositivo.
  - Solo cuentan proyectos no archivados (🔵 se excluye).
  - “Modificado” = la fecha más reciente de **cualquier nota de la carpeta del proyecto** (recursiva).
  - Cada fila de la lista: estado, nombre, “hace N días”; tooltip con carpeta y fecha; tocar abre la nota.
- En móvil la tabla cabe en pantalla o se desplaza horizontalmente dentro de su caja (sin desbordar la vista).

### 2.7 Tareas en notas de conocimiento (informativo)
- Sección plegable “Tareas en notas de conocimiento (N)” (cerrada por defecto; se recuerda abierta/cerrada por dispositivo). Su contenido se construye al abrirla.
- Lista las notas de tipo Ax, Btx, Vx, Ref/Rf, Sue, Podx, Prx, Cmt **con tipo declarado** (propiedad `type` o prefijo `Tipo ` en el nombre) que tienen tareas abiertas, con el número de abiertas. Con §0 aparece “Ax 261105 - Idea con tarea · 1 abierta”.
- Las notas sin tipo declarado no se listan (aunque el índice las trate como Ax por defecto).
- Tocar una fila abre la nota en su primera tarea abierta. No se modifica nada (lint solo informativo, 02 §9.13). v1 no tenía esta sección.

---

## 3. Comprobaciones de plataforma

| Comprobación | Esperado |
|---|---|
| Móvil: botones, métricas, filas de listas, días del calendario | Altura táctil ≥ 44 px |
| Móvil: teclado al “+ Añadir tarea” | El editor queda en modo edición con el cursor tras `- [ ] ` |
| Cerrar las pestañas de los paneles y seguir editando | Sin errores en consola (los suscriptores al índice se liberan al cerrar) |
| Tema claro/oscuro | Colores con variables de Obsidian; legible en ambos |
| Sync (vault de prueba) | Archivar en un dispositivo → en el otro, al llegar el cambio, el proyecto desaparece de la lista. Las preferencias (periodo, días) no se sincronizan |
| Rendimiento | Abrir el panel de actividad en un vault grande es instantáneo (no lee archivos); v1 tardaba segundos |
