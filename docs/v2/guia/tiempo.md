# Guía de pruebas · Registro de tiempo y Pomodoro (F4 + F7‑tiempo)

> Versión 2.0.0‑alpha · 2026‑11‑05 · Matriz: F32–F46, F48–F51.
> Requisitos: vault de prueba (ver [05 · Guía de pruebas](../05-guia-de-pruebas.md) §1), una nota `PGTD - Prueba.md` con:
> ```
> ## Tareas
> - [ ] Tarea A de prueba 🆔 tA0001
> - [ ] Tarea B de prueba
> - [/] Tarea C en progreso
> - [x] Tarea D cerrada ✅ 2026-11-01
> ```
> Los registros se guardan en `Dovela/Registro de tiempo/AAAA-MM · <dispositivo>.md` (bloque ```` ```dovela-tiempo ````). Abre ese
> archivo cuando una prueba diga “comprobar el evento”. **En móvil Obsidian no muestra barra de estado**: allí se usa la vista
> “Dovela: Tiempo” y la paleta de comandos.

## 0. Comandos y accesos

| Acceso | Id (prefijo `obsidian-dovela-personal-management:`) | Nombre |
|---|---|---|
| Paleta | `time-tracker-start-for-active-note` (v1) | Control de Tiempo: Iniciar temporizador para la nota activa o la tarea seleccionada |
| Paleta | `pomodoro-start-for-active-note` (v1) | Control de Tiempo: Iniciar Pomodoro para la nota activa o la tarea seleccionada |
| Paleta | `time-tracker-edit-active-timer` (v1) | Control de Tiempo: Modificar temporizador activo |
| Paleta | `time-tracker-stop` (nuevo) | Control de Tiempo: Detener y registrar la sesión en curso |
| Paleta | `time-tracker-cancel` (nuevo) | Control de Tiempo: Cancelar la sesión en curso (sin registrar) |
| Paleta | `time-tracker-manual` (nuevo) | Control de Tiempo: Registrar tiempo manualmente |
| Paleta | `pomodoro-start-break` (nuevo) | Control de Tiempo: Iniciar descanso |
| Paleta | `time-open-view` (nuevo) | Control de Tiempo: Abrir vista de tiempo |
| Ribbon | `play-circle` | Iniciar temporizador (si ya hay sesión: abre “Detener”) |
| Ribbon | `timer` | Iniciar Pomodoro (si ya hay sesión: abre Seguimiento o la decisión pendiente) |

Los comandos de inicio solo aparecen si hay una nota activa y **ninguna** sesión en curso (igual que v1). Detener/cancelar/modificar
solo aparecen con una sesión en curso. **v1 no tenía comandos para detener, cancelar ni registrar manual** (en móvil era imposible detener sin abrir el dashboard).

## 1. Barra de estado (F38)
**Escritorio.**
1. Inicia un temporizador (§2). Esperado: `⏱️ PGTD - Prueba 00:00:01`, avanzando cada segundo, sin saltos.
2. Pasa el ratón: el tooltip muestra el estado, la tarea y la ruta. Clic → se abre “Dovela: Tiempo” en **Seguimiento**.
3. Pomodoro en trabajo: `🍅 PGTD - Prueba 24:59` (restante). Descanso: `☕ … 04:59` en verde. Overtime: `🔴 … +01:23 (overtime)` en rojo y negrita.
4. Fase cumplida sin decidir (cierra el modal de fin con la X): `⏰ PGTD - Prueba decidir` en naranja; clic → reabre el modal de decisión.
5. Sesión abierta más de `staleLiveHours` (Ajustes → Registro de tiempo): se añade `⚠️`. Con dos sesiones simultáneas: `(+1)`.
6. Detén la sesión: la barra desaparece.

**Móvil.** No hay barra de estado: comprueba lo mismo en el reloj grande de Seguimiento (§8).

**Comparación v1.** Mismo formato y colores. Cambios: overtime cuenta desde el **fin planificado** (`+MM:SS`), no desde el inicio; nuevo estado `⏰ decidir` (en v1 la sesión quedaba colgada sin indicación); un solo intervalo de 1 s para barra y vistas (v1 tenía uno por vista).

## 2. Iniciar temporizador sobre nota o tarea (F32)
**Escritorio y móvil** (en móvil: paleta de comandos con el editor abierto).
| Caso | Pasos | Esperado |
|---|---|---|
| Nota completa | Cursor en cualquier sitio sin seleccionar → comando de inicio | Notice “⏱️ Temporizador iniciado: PGTD - Prueba”; registro sobre la nota |
| Tarea abierta | Selecciona parte del texto de “Tarea B” → comando | La línea pasa a `- [/]`; Seguimiento muestra “📌 Tarea B de prueba” |
| Tarea con 🆔 | Selecciona en “Tarea A” → comando | `[/]`; el evento `live` lleva `"i":"tA0001"` y `"raw"` con la línea |
| Línea entera con triple clic | Triple clic en “Tarea B” → comando | Funciona como una línea (no da error de multilínea) |
| Multilínea | Selecciona A y B → comando | Notice “Verifica la tarea que has seleccionado: la selección ocupa varias líneas.” No inicia |
| No es tarea | Selecciona texto del encabezado → comando | Notice “La selección en la nota no es una tarea.” No inicia |
| Tarea cerrada | Selecciona “Tarea D” → comando | Notice “La tarea seleccionada ya está cerrada.” No inicia |
| Modo lectura | Cambia a lectura → comando | Inicia sobre la nota |
| Ya hay sesión | Con un Pomodoro en curso → ribbon `play-circle` | Abre el flujo de Detener (no inicia un segundo temporizador) |

**Comparación v1.** Mismos mensajes. Cambios a propósito: una tarea `[x]` ya no arranca un temporizador; el paso a `[/]` se hace con
`vault.process` y localización verificada (línea + texto o 🆔), nunca la “primera tarea abierta”; **timer y Pomodoro son excluyentes** (v1 permitía ambos a la vez).

## 3. Detener, cancelar y modificar (F33, F34, F35)
**Detener (escritorio y móvil).** Con un temporizador sobre “Tarea B”: comando *Detener* (o botón ⏹️ en Seguimiento, o ribbon `play-circle`).
1. El modal muestra la tarea (solo lectura, con ↗ para abrir la nota), **Inicio** (fecha + hora) y **Fin** (fecha + hora = ahora), duración calculada, Notas y el toggle **Cerrar tarea** (activado si “Cerrar tarea marcado por defecto” está activo en ajustes).
2. Cambia la hora de fin a una anterior al inicio el mismo día → mensaje rojo “La hora de fin es anterior… Si terminó al día siguiente, cambia la fecha de fin.” Guardar no hace nada.
3. Pon fin = mañana 00:10 → “Duración: …” correcta (se permite cruzar medianoche).
4. Guardar con “Cerrar tarea” → la línea pasa a `- [x] Tarea B de prueba ✅ <hoy>`; Notice “registrado …”; la barra desaparece; el archivo de registro tiene **un** evento `log` con el mismo `id` que el `live`.
5. Repite con **Cancelar**: el modal se cierra y el temporizador **sigue** corriendo (v1: igual, pero a veces el modal no volvía a abrir).
6. Repite con **Cancelar registro** → confirmación → “Descartar”: no se crea registro (evento `cancel`).
7. Inicia sobre la nota completa: el toggle “Cerrar tarea” **no** aparece.

**Cancelar sesión (comando nuevo).** Con una sesión en curso → comando *Cancelar…* → confirmación con el nombre → se descarta. v1 descartaba sin confirmación.

**Modificar (comando v1 `time-tracker-edit-active-timer` o ✏️ Modificar).**
1. Cambia el inicio a ayer 23:00 → se acepta (v1 no permitía cambiar de día); el reloj salta al nuevo transcurrido.
2. Pon un inicio en el futuro → “La hora de inicio no puede estar en el futuro.” y no guarda (v1 lo aceptaba y mostraba tiempo negativo).
3. Edita las notas → aparecen en Seguimiento (📝) y se usan como notas al detener.
4. Con un Pomodoro, el modal solo permite notas (el inicio define la fase).

## 4. Registro manual (F36)
1. Comando *Registrar tiempo manualmente* (o “+ Manual” en Seguimiento). La tarea por defecto es la nota activa; **Cambiar…** abre el selector (Tab cambia de fuente: notas abiertas / en progreso / todas).
2. Elige “Tarea A”, inicio hoy 23:30, fin mañana 00:45, notas → Guardar. Esperado: registro de 1 h 15 min que aparece en Estadísticas de hoy (30 min) y de mañana (45 min) y en el Cronograma partido en dos días.
3. Sin tarea elegida (nota activa ausente) → “Sin tarea: elige una tarea o nota.”; Guardar avisa.
4. Con “Cerrar tarea” activado y una tarea elegida → la tarea se cierra.
**v1:** el modal movía inicio y fin al mismo día (no se podía cruzar medianoche) y reparseaba todo el vault para el selector.

## 5. Pomodoro (F40, F41, F42, F43, F44)
Pon en Ajustes → Pomodoro: trabajo **1 min**, corto 1, largo 2, ciclos 2, alerta overtime 1 min; notificaciones y sonido activados.

| # | Pasos | Esperado |
|---|---|---|
| 1 | Selecciona “Tarea B” → comando *Iniciar Pomodoro* | `- [/]`; Notice “🍅 Pomodoro de 1 min”; barra `🍅 … 00:59` |
| 2 | Espera 1 min | Notice + notificación del sistema (escritorio pide permiso la 1.ª vez) + sonido de 3 tonos + vibración (móvil). Modal “🍅 ¡Pomodoro completado!” con “Pomodoro 1 de 2”, ciclos 1, notas y toggle “Cerrar tarea” **apagado** |
| 3 | Botones de trabajo | “☕ Descanso corto (1 min)” (sugerido, resaltado), “🌴 Descanso largo”, “🍅 Otro pomodoro”, “🔴 Seguir trabajando (overtime)”, “⏹️ Finalizar sesión” |
| 4 | Escribe una nota y pulsa el descanso sugerido | Se registra el trabajo con `k:"pomodoro"`, notas `Sesión Pomodoro (1/1 min) - Ciclos completados: 1\n\n<nota>`; empieza `☕` **con la misma tarea** |
| 5 | Al terminar el descanso | Modal “☕ Descanso terminado”: “🍅 Volver al trabajo” (funciona: en v1 no hacía nada), descanso corto, largo, Finalizar |
| 6 | Volver al trabajo y completar | “Pomodoro 2 de 2”; sugerido **Descanso largo** (v1 nunca lo sugería: ciclos se reiniciaban) |
| 7 | Elige “Seguir trabajando (overtime)” | Barra `🔴 … +00:01 (overtime)`; cada 1 min: Notice “🔴 Overtime — Llevas N min…”, sonido |
| 8 | Comando *Detener* | Modal “🔴 Fin del overtime” → Finalizar: un registro trabajo+overtime con `Sesión Pomodoro + Overtime (N min total)`, `ot` = minutos de overtime |
| 9 | Fin de fase y cierra el modal con la X (o Esc) | Nada se pierde: barra `⏰ … decidir`; en Seguimiento botón **Decidir…**; clic en la barra reabre el modal |
| 10 | Deja el modal abierto 3 min y luego “Finalizar” | El registro termina en el **fin planificado** (1 min), no al hacer clic (v1 inflaba la duración) |
| 11 | Detener un Pomodoro antes de tiempo | Modal “⏹️ Detener Pomodoro”: registra hasta ahora, no suma ciclo; “Seguir con la sesión” cierra sin cambios |
| 12 | Auto‑inicio: activa “Iniciar descansos automáticamente” | Al terminar el trabajo empieza el descanso solo (Notice), sin modal. Con “Iniciar trabajo tras el descanso” igual al revés |
| 13 | Recarga (F43): inicia un Pomodoro, cierra Obsidian 3 min, ábrelo | Aparece el modal de decisión; “Finalizar” registra 1 min (fin = inicio + duración), no 3 min |
| 14 | Recarga en trabajo sin expirar | La cuenta atrás continúa en el punto correcto |
| 15 | Comando *Iniciar descanso* sin sesión | Descanso corto sobre la nota activa (o “Descanso” sin nota) |
| 16 | Toggle “Cerrar tarea” en el modal de trabajo + Finalizar | La tarea se cierra **una vez** y solo esa (v1 podía cerrar otra tarea del archivo) |

**Móvil.** Repite 1–9 con la paleta y la vista de Tiempo. Con la app en segundo plano el aviso llega al volver (el sistema suspende los temporizadores); el registro sigue siendo correcto porque se calcula con el reloj de pared.
**Varios dispositivos.** Solo el dispositivo que inició la sesión abre el modal o auto‑inicia la siguiente fase; los demás muestran `⏰ decidir` y un Notice (evita dos descansos duplicados). Cualquiera puede decidir desde Seguimiento.

## 6. Sesiones abandonadas y simultáneas (F39)
1. Edita a mano en el archivo de registro el `"a"` de un `live` a hace 13 h (o baja “Avisar de sesiones abiertas tras” a 1 h y espera). Al recargar: modal “⚠️ Sesión abierta hace mucho” con **Registrar hasta…** (abre Detener con el fin editable), **Descartar** (con confirmación) y **Dejarla abierta**. Nunca se descarta sola.
2. Con Sync (vault de prueba): inicia un temporizador en el móvil y otro en escritorio sin conexión; al reconectar → Notice “hay 2 sesiones… abiertas a la vez”, la barra muestra `(+1)` y Seguimiento lista ambas con Detener/Cancelar.
3. Detén en el móvil un temporizador iniciado en escritorio: en escritorio desaparece al llegar el archivo (sin sondeo). Si el modal de detener estaba abierto en ambos, el segundo en guardar ve “la sesión ya se cerró”.
**v1:** sondeo de `data.json` cada 15 s que podía resucitar temporizadores o perder registros.

## 7. Vista “Dovela: Tiempo”
- Comando *Abrir vista de tiempo* o clic en la barra. Pestañas Seguimiento / Estadísticas / Cronograma (en móvil < 480 px solo iconos).
- Cambia de pestaña, cierra y reabre la vista: vuelve a la **última pestaña** de este dispositivo. El periodo de Estadísticas y la vista/zoom del Cronograma también se recuerdan **por dispositivo** (no viajan por Sync).
- Las mismas pestañas se montan dentro del Dashboard GTD (si ese módulo las incluye).

## 8. Seguimiento (F46)
1. Sin sesión: reloj `00:00:00` atenuado; botones ▶️ Iniciar, 🍅 Pomodoro, ☕ Descanso, + Manual; línea “Hoy: ⏱️ X registrados · 🍅 N pomodoros”.
2. Selector: fuentes **Notas abiertas** (nota + sus tareas abiertas), **En progreso** (`[/]`), **Todas** (abiertas); búsqueda por texto, `#cx-…`, `#px-…`, etiquetas o ruta (todas las palabras). Toca una fila → “Iniciar sobre: …”; ▶/🍅 de la fila inicia directamente. Con más de 120 resultados la lista se virtualiza (desplazamiento fluido).
3. Con sesión: estado (“Pomodoro 2 de 4”, “Descanso corto”, “overtime”), tarea, “↗ Ir a la tarea” (abre la nota en la línea), inicio, notas; botones Detener/Decidir, Modificar/Notas, Cancelar, Descanso (Pomodoro), + Manual.
4. Edita una tarea en otra pestaña: la lista se actualiza sola (índice) sin perder la búsqueda.
**v1:** reparseaba el vault en cada render y al cambiar de fuente; mostraba todos los resultados sin límite; cronómetro por vista que seguía corriendo oculto.

## 9. Estadísticas (F48, F49, F37, F50, F45)
1. Periodo por defecto **Hoy**. Chips Hoy/Semana/Mes/Año/Siempre; ‹ › desplazan día/semana ISO/mes/año (deshabilitadas en Siempre y rango). Al pasar la medianoche “Hoy” avanza solo.
2. Título → selector: acciones rápidas + calendario (lunes primero) con **mapa de calor por minutos** (< 2 h, < 5 h, ≥ 5 h). Un toque = día; segundo toque = rango (se ordenan solos); “Aplicar día/rango”.
3. Resumen: Tiempo total, Registros, Pomodoros. Árbol: “Todas las áreas” → carpetas → notas, cada nodo con barra, %, duración y nº de registros; colores por tipo (`NN - ` morado, `AV - ` azul, `AI - ` cian, `PGTD/PQ/RR` verde). Se abren los dos primeros niveles.
4. Nodos de tránsito (sin tiempo propio y un hijo) atenuados; clic en uno cerrado → **salto inteligente** (abre toda la cadena).
5. Las notas despliegan sus registros: fecha, día, `🕒 HH:mm → HH:mm`, duración, 📌 tarea, 📝 notas, icono 🍅/✍️/📥. Clic/Enter → modal de edición (F37): cambia fechas/horas/notas y Guardar; **Eliminar** pide confirmación (v1 borraba sin confirmar). El árbol se actualiza solo y conserva lo abierto y el scroll.
6. Un registro de 23:30 a 00:45 aparece repartido: 30 min en el día de inicio y 45 min en el siguiente (v1 lo sumaba entero al día de inicio — cambio documentado).
7. Exportar (F50): clic derecho en un nodo (móvil: botón ⋯) → **Exportar CSV (guardar en el vault)** → `Dovela/Exportaciones/Exportación - <nodo> - <periodo>.csv` (si existe, “(2)”). Ábrelo en Excel: acentos correctos (BOM), separador `;` (configurable), 10 columnas como el Excel de v1. En escritorio además **Descargar CSV**.
8. Estado vacío: “No hay registros de tiempo para el período seleccionado.”
**v1:** acumulaba listeners en cada render, recalculaba con `moment` por registro y exportaba `.xlsx` (dependencia de ~1 MB, sin descarga en móvil).

## 10. Cronograma (F51)
**Escritorio.**
1. Vistas Día / 3 días / Semana (lunes–domingo); ◀ Hoy ▶; título → popover con calendario y mapa de calor; zoom − / + (100 %–400 %, conserva el centro). Al abrir, se desplaza a la hora actual; línea roja de “ahora” que avanza. La sesión en curso se dibuja rayada.
2. Bloques coloreados por carpeta raíz, con nota, tarea, duración y notas según altura; tooltip con detalle. Solapes en **columnas** (bloques que no se pisan comparten columna).
3. Clic en un bloque → modal de edición.
4. Arrastra un bloque → se mueve con ajuste a 5 min (etiqueta con la hora), también a otro día en 3 días/Semana. Un registro multi‑día se mueve entero.
5. Alt + arrastrar → **duplica** (Notice “registro duplicado”).
6. Arrastra el borde inferior → redimensiona (mínimo 5 min).
7. Arrastra en vacío → al soltar se abre *Registrar tiempo* con inicio/fin prellenados.
8. Esc durante un arrastre lo cancela. Clic en la cabecera de un día (3 días/Semana) → vista de ese día.

**Móvil.**
1. Desliza en vacío: la rejilla se desplaza (no crea nada).
2. **Pulsación larga** (≈0,5 s, vibra) en vacío y arrastra → crea (abre el modal manual).
3. Arrastra un bloque directamente → mueve. **Pulsación larga en un bloque** (vibra, borde punteado) y arrastra → duplica.
4. Toque en un bloque → editar. Asa inferior de 16 px para redimensionar.
5. En Semana la rejilla tiene ancho mínimo y se desplaza en horizontal con la columna de horas fija.

**v1:** HTML5 drag&drop (no funcionaba con el dedo), sin ajuste (segundos fraccionarios), sin línea de “ahora”, reparto de ancho a partes iguales en grupos encadenados, fugas de listeners en `document`.

## 11. Ajustes (F44)
Ajustes → Pomodoro: duraciones (trabajo 1–60, corto 1–15, largo 1–30), ciclos 2–8, alerta overtime 1–15 min, “misma sesión” 5–120 min, auto‑inicio de descansos/trabajo (**ahora funcionan**; en v1 no hacían nada), notificaciones, sonido, Restablecer. Ajustes → Registro de tiempo: carpeta, carpeta de exportación, “Cerrar tarea” por defecto, horas para avisar de sesiones abiertas, separador CSV.
