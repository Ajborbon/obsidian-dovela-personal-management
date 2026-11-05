# Guía de pruebas · Dashboard GTD y Vista de Foco (F5 · F8‑Foco)

> Código: `src/features/gtd/` (UI), `src/core/gtd/{filters,viewmodel,focus}.ts`, `src/core/links/expand.ts` (lógica pura).
> Pruebas automáticas: `tests/gtd/*.test.ts` (`npx vitest run tests/gtd`).
> Comparar con v1: instalar el `main.js` de la rama `main` en un vault de prueba (copia del vault real) y abrir la misma vista.

## 0. Preparación

1. Vault de prueba con una nota `PGTD - Prueba/PGTD - Prueba.md` que contenga:

   ```markdown
   - [ ] A sin metadatos
   - [ ] B #cx-Casa
   - [ ] C #cx-Oficina #px-Ana
   - [ ] D #px-Ana
   - [ ] E reunión 📅 <HOY> [hI:: 09:00] [hF:: 10:30]
   - [ ] F demo 📅 <HOY> [hI:: 14:00] [45min]
   - [ ] G vencida 📅 <AYER> #cx-Casa #cx-Oficina
   - [ ] H depende #cx-Casa ⛔ idz
   - [ ] Z predecesora 🆔 idz
   - [ ] R rota ⛔ noexiste
   - [ ] S algún día #GTD-AlgunDia
   - [/] P en progreso #cx-Casa [30min] 🔼
   ```
   (sustituye `<HOY>`/`<AYER>` por fechas `YYYY-MM-DD`).
2. Una carpeta `Lib/` con `x.md` que contenga `- [ ] tarea de x #cx-Lib` y enlace `[[PGTD - Prueba]]` desde otra nota `Fuera/in.md` (`- [ ] entrante`).
3. En escritorio: abrir con la ventana ancha y también con un panel estrecho. En móvil: Obsidian iOS/Android con el vault sincronizado.

## 1. Apertura (F13, F14)

| Paso | Escritorio | Móvil | Esperado | v1 |
|---|---|---|---|---|
| 1 | Paleta → “Dovela: Abrir GTD Dashboard” | Igual (menú ⋮ → paleta) | Se abre una pestaña “GTD Dashboard” (icono list-checks) en **Listas GTD** | v1: comando “Open GTD Dashboard”, mismo id `open-gtd-dashboard` (los atajos asignados siguen funcionando) |
| 2 | Clic en el icono list-checks de la cinta | Icono en la barra lateral | Revela la misma pestaña, no abre otra | Igual |
| 3 | Cambia a “En Progreso”, cierra la pestaña y vuelve a abrir | Igual | Reabre en **En Progreso** (pestaña recordada por dispositivo) | v1 siempre volvía a Listas GTD |
| 4 | Recién abierto Obsidian (índice construyéndose) | Igual | Mensaje “⏳ Construyendo índice…”, que se sustituye solo por las listas | v1 bloqueaba hasta leer todo el vault |
| 5 | Botón 🔄 | Igual | Redibuja; conserva pestaña, filtros y scroll | v1 reparseaba todo el vault |

## 2. Listas GTD (F06–F07 UI, F15–F22)

1. **Orden y listas**: Ojalá Hoy (si hay), Vencidas, Bandeja de Entrada, Calendario, Proyectos, Próximas Acciones, Asignadas, En Pausa, Esta Semana No, Algún Día. Las vacías no aparecen. Comparar con v1: mismo orden; el contenido de cada lista coincide salvo las correcciones documentadas (02 §4).
2. **Contador global**: “Total de Tareas Abiertas: N” = tareas abiertas únicas (una tarea en 3 sublistas cuenta 1). En v1 igual.
3. **Agenda de Hoy**: dentro de Ojalá Hoy, primer grupo “📅 Agenda de Hoy  2 citas - 2h 15min” (E = 90 min, F = 45 min; sin hora fin ni duración = 30 min). Filas con `⏰ 09:00-10:30`, ordenadas por minutos (v1 ordenaba por texto: `10am` antes de `9am`).
4. **Vencidas**: botón `📅→📋` en el título de la sección. Pulsar: agrupa por contexto primero (`📋 Casa` › fecha); pulsar de nuevo vuelve. El modo se recuerda por dispositivo. No pliega la sección al pulsarlo. v1: igual, pero no se recordaba.
5. **Filtros** (cabecera):
   - Contexto: escribe `casa` (o elige del desplegable `datalist`): solo tareas cuyo contexto es exactamente Casa (sin distinguir mayúsculas; `#cx-Casa` también vale). `Cas` no muestra nada (coincidencia exacta, como v1).
   - Persona: `Ana` → C y D.
   - Tarea: `reun` → E (subcadena).
   - El contador pasa a “Tareas filtradas: X (de Y)”; la navegación rápida y los contadores de cada sección se recalculan; las sublistas vacías desaparecen; “Limpiar” lo restablece.
   - Cierra y reabre la vista: los filtros siguen (por dispositivo).
   - v1: filtraba el DOM; tras borrar el filtro los subgrupos de Vencidas quedaban ocultos (bug corregido).
6. **Navegación rápida** (“🧭 Navegación rápida”): enlaces por lista con contador y desplegables “🌟 Ojalá Hoy”, “📋 Contextos”, “👥 Asignadas” con sublistas. Clic → desplazamiento suave hasta la lista/sublista (abre la sección si estaba cerrada), quedando visible bajo la cabecera pegajosa. En móvil el panel de navegación se cierra tras saltar.
7. **Filas**:
   - Clic en la fila → abre la nota en la línea de la tarea. Ctrl/Cmd+clic → en pestaña nueva. El Dashboard no se reemplaza.
   - Clic en `[[enlace]]` del texto → abre la nota enlazada.
   - Casilla → la tarea se marca `- [x] … ✅ hoy` en la nota (escritura segura) y desaparece de las listas en ~0,5 s. v1: el Dashboard era solo lectura.
   - Chip `⛔ idz 🔗` (H) → abre la tarea Z. Chip `⛔ noexiste ⚠️` (R) no navega y lleva aviso. v1: el 🔗 reparseaba todo el vault.
   - Chip 📄 → despliega “└─ Vault > PGTD - Prueba”. 
   - Borde de color por estado: rojo vencida, verde hoy, azul 🛫 futura, naranja pausada por dependencia.
8. **Reactividad**: con el Dashboard visible, edita la nota y añade `- [ ] nueva #cx-Casa`. En < 1 s aparece en Próximas Acciones › Casa, sin perder scroll, secciones plegadas ni filtros. Con el Dashboard en una pestaña oculta, el cambio se aplica al volver a ella. v1: había que pulsar Refrescar.
9. **Secciones**: pliega “Bandeja de Entrada”, cierra y reabre la vista → sigue plegada. Con más de 60 tareas en una lista aparece “Mostrar 60 más (quedan N)”.
10. **Móvil**: botón “🔍 Filtros (N activos) ▸” plegado por defecto; al desplegar, inputs de 16 px (iOS no hace zoom) y áreas táctiles ≥ 44 px; las pestañas muestran solo el icono (con nombre accesible) y se desplazan horizontalmente.

## 3. En Progreso (F08 UI)

1. Cabecera: Tareas Activas, Tiempo Definido (suma de `[Xmin]`), Tiempo Estimado (definido + 20 min por tarea sin duración), Vencidas (solo si > 0).
2. Botones Agrupar: Ninguno (🔴 Vencidas / ⭐ Prioridades de Hoy / Otras Tareas), Contexto (`@Casa`), Persona, Proyecto (`📂 PGTD - Prueba`).
3. Botón de orden cíclico: ⏫ Prioridad → ⏱️ Duración ↑ → ⏱️ Duración ↓.
4. Casilla → completa la tarea. Agrupación y orden se recuerdan por dispositivo.
v1: mismas métricas y grupos; cada cambio reparseaba el vault; la casilla no hacía nada.

## 4. Vista Jerárquica (F05 UI, F23–F25)

1. Árbol de carpetas con nota‑carpeta fusionada; carpetas sin nota como `[FALTA] Nombre` (gris cursiva); niveles 0–1 abiertos.
2. Contadores `(propias) - total` (total = propias + descendencia). Estado `🟢/🔵…` visible.
3. Notas con tareas `[/]` resaltadas (fondo amarillo e icono ⚡) — sin lecturas extra de archivos (v1 releía cada nota).
4. Clic en el nombre → abre la nota (Ctrl/Cmd → pestaña nueva); clic en el resto de la fila → pliega/despliega. Los hijos se construyen al desplegar.
5. “⊞ Expandir todo” / “⊟ Colapsar todo”.
6. Buscar `prueba`: solo coincidencias y sus ancestros (abiertos); resumen “N: 📄 t títulos”. Activa “📝 Incluir contenido” y busca una palabra que solo esté en el cuerpo de una nota: aparece con 📝 tras ~300 ms; teclear rápido no deja resultados obsoletos (búsquedas canceladas).
7. Editar una nota mientras se busca: el árbol se actualiza sin perder la búsqueda ni el foco del buscador.

## 5. Seguimiento / Estadísticas / Cronograma

Las pestañas montan la UI de tiempo (`mountTimeTab`, feature `time`). Cambiar de pestaña desmonta la anterior (sin cronómetros huérfanos, defecto v1). Ver la guía de tiempo para su contenido.

## 6. Vista de Foco (F54–F58)

| Paso | Acción | Esperado | v1 |
|---|---|---|---|
| 1 | Con `PGTD - Prueba.md` activa: paleta → “Dovela: Mostrar Vista de Foco del Proyecto” (o icono 🎯 crosshair) | Pestaña “Foco: PGTD - Prueba” con las mismas pestañas del Dashboard | Igual (id `open-focus-view`) |
| 2 | Sin nota activa | El comando no aparece; el icono muestra un aviso | Igual |
| 3 | Listas GTD del foco | Solo tareas de la carpeta (y subcarpetas), de las notas enlazadas (➡️ hasta 2 niveles) y de las que enlazan (⬅️ hasta 5). `tarea de x` lleva badge `➡️1`, `entrante` lleva `⬅️1` | Igual; v1 a veces mostraba el vault entero en Inbox |
| 4 | Dependencia a una tarea fuera del foco | Sigue “En Pausa” (se resuelve contra todo el vault) | v1 la daba por resuelta (cambio documentado) |
| 5 | Cabecera “🎯 Foco: … ▾” | Resumen “📁 n carpeta · ➡️ n salientes (nivel k) · ⬅️ … · N notas”, botones ⚙️ Ajustes, 📍 Fijar nota activa, 👁 Seguir nota activa. Clic en el título la pliega; se recuerda por dispositivo | v1: clave global en localStorage |
| 6 | ⚙️ Ajustes: salientes 0, entrantes 1, Guardar | El foco se recalcula al instante; los ajustes se guardan en este dispositivo y se aplican a todas las vistas Foco | v1: localStorage; se migran una vez las claves `dovela-foco-expansion-settings` y `dovela-focus-header-collapsed` |
| 7 | Carpeta de terminación por defecto `AI - Journals` | Un diario enlazado aparece (🛑) pero sus enlaces no se siguen | v1 usaba la ruta completa (sigue funcionando si se migró) |
| 8 | Reinicia Obsidian | La pestaña Foco se restaura con la misma nota fijada | v1 mostraba “No se ha proporcionado un archivo activo” |
| 9 | Activa 👁 Seguir nota activa y abre otra nota | El foco cambia a esa nota (título de pestaña incluido) | No existía |
| 10 | Renombra la nota fijada | El foco sigue a la nota renombrada | v1 perdía la referencia |
| 11 | Jerárquica en Foco | Solo notas del ámbito (con `[FALTA]` para carpetas ancestrales) y badges ➡️/⬅️ | Igual |

## 7. Comprobaciones de rendimiento (opcional)

- Vault grande: abrir el Dashboard no debe congelar la UI; cambiar de pestaña/filtro no relee archivos (solo la búsqueda por contenido usa `cachedRead`).
- Con la consola de depuración (comando de diagnóstico → logger) no deben aparecer errores al abrir/cerrar varias veces las vistas.
