# Guía de pruebas · Backlinks organizados (F8)

> Matriz: F59–F65. Código: `src/features/backlinks/` (vista), lógica pura en `src/core/backlinks/` y
> `src/core/links/breadcrumbs.ts` (pruebas en `tests/backlinks/`, `pnpm test`). Estilos: `src/styles/60-backlinks.css`.
> Requisito previo: plugin v2 instalado en un **vault de prueba** (ver [05 · Guía de pruebas](../05-guia-de-pruebas.md) §1) y el índice
> construido (“Dovela: Diagnóstico: estado del índice” dice “listo”). Para comparar con v1, abre la misma copia del vault con el
> `main.js` de `main` en otra instalación (o antes de instalar v2) y repite el mismo paso.

## 0. Preparación de datos (una vez)

| Nota | Contenido mínimo | Para probar |
|---|---|---|
| `Pruebas BL/Proyecto/PGTD Alfa.md` | `estado: 🟢`, `type: PGTD` | nota activa principal |
| `Pruebas BL/Proyecto/Ax 261105 - Hermana.md` | vacía, `type: Ax`, `estado: 🟡` | backlink por **carpeta** (📁) |
| `Pruebas BL/Proyecto/Sub/Ax 261105 - En subcarpeta.md` | cuerpo con `[[PGTD Alfa]]` | backlink por **enlace** (🔗); NO por carpeta |
| `Pruebas BL/Otra/Ax 261105 - Enlaza.md` | cuerpo con `[[PGTD Alfa]]` | 🔗 desde otra carpeta |
| `Pruebas BL/Otra/Ax 261105 - Hija.md` | frontmatter `origen: "[[PGTD Alfa]]"` (sin enlace en el cuerpo) | backlink por **origen** (🌱) |
| `Pruebas BL/Proyecto/Tx 261105 - Pago.md` | `type: Tx`, `moneda: COP`, `monto: 1500000` | fila 💰 |
| `Pruebas BL/Proyecto/Tx 261105 - Mala.md` | `type: Tx`, `moneda: pesos`, `monto: "1.500"` | moneda inválida (defecto v1) |
| `Pruebas BL/Sola/Ax 261105 - Aislada.md` | vacía, sola en su carpeta, nadie la enlaza | 0 backlinks (defecto v1) |
| `Pruebas BL/Un nombre de nota muy largo que ocupa más de tres líneas en la barra lateral para probar el recorte de títulos multilínea.md` | `[[PGTD Alfa]]` | títulos multilínea |
| Rutas largas: `Pruebas BL/Carpeta con nombre largo número uno/Carpeta con nombre largo número dos/Carpeta tres/Nota profunda.md` | `[[PGTD Alfa]]` | breadcrumbs abreviados |

---

## 1. Apertura y seguimiento de la nota activa (F59)

### 1.1 Puntos de acceso
| Paso (escritorio) | Paso (móvil) | Resultado esperado |
|---|---|---|
| Icono de la cinta **🔗 “Backlinks organizados”** (icono `link`) | Menú ☰ → icono de la cinta | Se abre (o se revela, sin duplicarse) la vista **Backlinks** en la **barra lateral derecha** (en móvil, el cajón derecho) |
| Paleta: **“Dovela: Mostrar Backlinks Organizados”** | Igual | Igual. Id del comando `open-backlinks-view` (el de v1): los atajos asignados en v1 siguen funcionando |
| Clic derecho sobre una nota en el explorador → **“Ver Backlinks Organizados”** | Pulsación larga sobre la nota → misma entrada | Se abre la vista mostrando los backlinks de **esa** nota (aunque no sea la activa). Al cambiar de nota activa vuelve a seguirla |

Comparación con v1: misma vista (`dovela-backlinks-view`), comando e icono. Si el layout guardado tenía la vista abierta, se restaura.
Diferencias: v1 exigía nota activa para el comando (ahora siempre está disponible: sin nota se puede usar el visor de pestañas);
en v1 el menú de archivo mostraba los backlinks de la nota *activa*, no de la pulsada.

### 1.2 Detección
1. Abre `PGTD Alfa`. La cabecera muestra el nombre, `N enlaces` y el desglose `🔗 n · 🌱 n · 📁 n` (solo los que no son cero).
2. Esperado con los datos de §0 (y “Backlinks: contar `origen`” activado en Ajustes → General, valor por defecto):
   - 📁 `Hermana`, `Tx … Pago`, `Tx … Mala` (misma carpeta **directa**);
   - 🔗 `En subcarpeta` (subcarpeta → solo por enlace), `Enlaza`, la nota de nombre largo, `Nota profunda`;
   - 🌱 `Hija` (solo `origen:`).
3. Desactiva “Backlinks: contar `origen`” → `Hija` desaparece en ≤ 1 s sin reabrir la vista. Vuelve a activarlo.
4. Comparación con v1: v1 muestra todo salvo `Hija` (v1 ignoraba `origen:`). El resto debe coincidir uno a uno.
   Excepción conocida: las notas en rutas excluidas del índice (Ajustes → General → rutas/carpetas excluidas, p. ej. plantillas) no aparecen en v2.

### 1.3 Seguimiento y refresco
1. Con la vista abierta, abre otras notas (clic en el explorador, enlaces, pestañas): la vista cambia a la nueva nota (~0,1 s).
2. Enfoca un panel sin nota (p. ej. el gráfico): la vista conserva la última nota (no se vacía).
3. En `Ax … Enlaza` borra `[[PGTD Alfa]]` (con `PGTD Alfa` como nota mostrada, p. ej. vía menú de archivo o con dos paneles):
   tras ~0,5 s desaparece de la lista **y** el contador baja (v1 no actualizaba el contador).
4. Crea una nota nueva en `Pruebas BL/Proyecto/` → aparece como 📁. Renombra `PGTD Alfa` → la vista sigue en la nota renombrada.
5. Edita una nota sin relación (otra carpeta, sin enlace) durante 1 min con la vista abierta: la vista **no** parpadea ni pierde el scroll
   (v1 repintaba en cada autoguardado de cualquier nota).
6. Móvil: cierra el cajón derecho, cambia de nota y vuelve a abrir el cajón → muestra la nota nueva (se pinta al hacerse visible).

## 2. Lista, detalle y títulos (F62, F63, F65)

### 2.1 Ordenamientos
Botones bajo la cabecera: 📄 Archivo · 🏷️ Tipo · 🟢 Estado · 📁 Ruta · 📅 Creación · 📝 Modificación.

| Acción | Resultado esperado |
|---|---|
| Primera apertura en el dispositivo | 📅 activo con ↓ (creación descendente, como v1) |
| Clic en 📄 | Orden por nombre ↑ (sin distinguir mayúsculas); otro clic → ↓ |
| Clic en 🏷️ / 🟢 | ↑ por tipo / estado; los vacíos primero en ↑ |
| Clic en 📝 | Modificación ↓. Clic simple en 📝 otra vez → sin cambio. **Doble clic** (< 0,8 s) → ↑ |
| Clic en 📁 | Cambia a **árbol** (§3) |
| Cerrar y reabrir Obsidian | Se conserva el último orden **en este dispositivo** (v1 volvía a creación ↓) |

Comparación con v1: mismos criterios y misma máquina de clics.

### 2.2 Modo detalle / simple
1. Botón ☰ (activo) = detalle: cada fila muestra `📅 Creado: dd/mm/aaaa, hh:mm` y `📝 Modificado: …` (mismo formato que v1).
2. `Tx … Pago` muestra `💰 1.500.000,00 COP` (formato es-ES). `Tx … Mala` (moneda `pesos`) muestra `💰 PESOS 1500,00` (es-ES no agrupa miles de 4 cifras) y **la lista se pinta completa**
   (en v1 esta nota rompía todo el render con `RangeError`). `monto: 0` o vacío → sin fila 💰 (como v1).
3. Pulsa ☰ → ≡ (simple): solo nombre, tipo, estado y ruta. La preferencia se recuerda por dispositivo (también en Ajustes → “Backlinks (este dispositivo)”).

### 2.3 Títulos multilínea
La nota de nombre largo ocupa como máximo **3 líneas** con “…”; el nombre completo aparece al pasar el ratón (escritorio). En móvil, igual en vertical y horizontal.

### 2.4 Abrir notas
| Escritorio | Móvil | Esperado |
|---|---|---|
| Clic en una fila | Toque | Abre la nota en la pestaña actual |
| Ctrl/Cmd+clic o clic central | — | Abre en pestaña nueva (Ctrl/Cmd+Alt: en división) |
| Tab hasta una fila + Enter | — | Abre la nota (accesibilidad por teclado) |

### 2.5 Listas largas
En una nota con > 150 backlinks (p. ej. una nota de la raíz de una carpeta grande o un journal muy enlazado) la lista se virtualiza: el scroll
es fluido y solo existen en el DOM las filas visibles (Inspector → `.dovela-vlist.is-virtual`). Las filas tienen altura fija en este modo.

## 3. Árbol por ruta (F60)
1. Pulsa 📁 Ruta: la lista pasa a árbol de carpetas. Arriba, los archivos de la raíz del vault; después carpetas por nombre (📁 nombre (n)),
   con `n` = notas de la carpeta y subcarpetas. La nota actual aparece con **📍** en su carpeta.
2. Expansión inteligente: las carpetas del primer nivel visible están abiertas; las demás solo si están en la ruta hacia la nota actual.
3. **Doble clic** en 📁 (< 0,8 s): el botón pasa a `📁+` (modo expandido) → se añaden con **📋** todas las notas de la carpeta de la nota actual y
   subcarpetas, y se abren también las carpetas del segundo nivel. Otro doble clic → vuelve a compacto.
4. Abre/cierra carpetas a mano y edita una nota relacionada: el árbol se refresca **conservando** lo que abriste/cerraste (v1 lo perdía en cada guardado).
   Al cambiar de nota activa vuelve la expansión inteligente.
5. Abre `Ax … Aislada` (0 backlinks) y pulsa 📁: el árbol muestra la nota con 📍 y “Sin backlinks: solo se muestra la nota actual” (**v1 no mostraba nada**).
6. Rendimiento: en modo expandido sobre una carpeta enorme, las carpetas cerradas no crean sus hijos hasta abrirlas.

Comparación con v1: misma estructura, iconos y reglas de expansión. Mejoras: archivos ordenados por nombre dentro de cada carpeta (v1: orden
del vault), tipo/estado/fechas también en el árbol, estado manual de carpetas conservado.

## 4. Visor de pestañas abiertas (F61)
1. Pulsa 🗂️: el cuerpo muestra las pestañas abiertas (notas, canvas, PDF, imágenes) y el botón cambia a 📋 (“Volver a backlinks”).
2. Con una sola zona de pestañas: lista sin encabezados. Divide el panel central (clic derecho en pestaña → “Dividir a la derecha”) y abre notas en
   ambos lados: aparecen **“📄 Panel central · 1”** y **“· 2”** con su número de pestañas. Pestañas en la barra lateral → “◀️/▶️ Panel …”;
   ventana emergente → “🪟 Ventana”.
3. Cada ficha muestra título completo (hasta 3 líneas), tipo y estado de la nota y su carpeta (o “Raíz”). La pestaña activa del panel central se resalta.
4. Clic → enfoca esa pestaña. Ctrl/Cmd+clic → abre la misma nota en una pestaña nueva.
5. Abre/cierra pestañas con el visor abierto: se actualiza solo (v1 era una instantánea).
6. Abre `Ax … Aislada` o cierra todas las notas: el botón 🗂️ **sigue disponible** (en v1 desaparecía el visor sin backlinks).
7. Móvil: el visor lista las pestañas abiertas; un toque cambia a ella y cierra el cajón según el comportamiento de Obsidian.

## 5. Breadcrumbs (F64)
1. Con `Nota profunda` en la lista: el botón 📁 de la barra superior cicla **Completo → Inteligente → Compacto** (el `title` del botón dice el estilo actual).
   - Completo: `Pruebas BL › Carpeta con nombre largo número uno › … › Carpeta tres` sin abreviar.
   - Inteligente / Compacto: si la ruta supera la longitud máxima (60 por defecto) y tiene más de 2 segmentos → `Pruebas BL › … › Carpeta tres`,
     con la ruta completa al pasar el ratón. Rutas de ≤ 2 segmentos nunca se abrevian.
2. **Regresión del bug de julio 2026**: con estilo **Compacto**, abre notas en la raíz, con 1 y 2 carpetas y con rutas largas de 2 segmentos;
   reinicia Obsidian con la vista abierta. No debe aparecer “Maximum call stack size exceeded” ni “Reiniciando bóveda” (v1 anterior a `ef3b3e1` fallaba aquí).
   Esto está cubierto además por pruebas automáticas (`tests/backlinks/breadcrumbs.test.ts`, B1–B17).
3. Clic en un segmento → abre la **nota de carpeta** (`Carpeta/Carpeta.md`) si existe; si no, la primera nota directa por nombre
   (v1: la primera del orden interno del vault). Ctrl/Cmd+clic → pestaña nueva. El clic en un segmento no abre la fila.
4. Cabecera: bajo el contador aparece la ruta de la carpeta de la nota actual, navegable igual.
5. Ajustes → “Backlinks (este dispositivo)”: estilo y longitud máxima (10–200). Cambiarlos repinta la vista al instante.
6. Móvil: los segmentos de la ruta de la cabecera tienen 44 px de alto; en las filas la ruta es informativa (un toque abre la nota).

## 6. Preferencias por dispositivo y migración de v1
1. En un dispositivo que usó v1 con el estilo de breadcrumb cambiado (clave `localStorage` `dovela-backlink-settings`), al abrir la vista por
   primera vez con v2 se conserva ese estilo y longitud (migración **única**; la clave v1 no se borra para poder volver a v1).
2. Cambia el estilo en v2 y reinicia: se mantiene el de v2 (la clave v1 no vuelve a aplicarse).
3. Las preferencias (estilo, longitud, detalle, orden, modo expandido) **no** viajan por Sync: en el móvil pueden ser distintas que en el escritorio.

## 7. Comprobaciones transversales
- Consola (Ctrl+Shift+I): sin errores ni logs al usar la vista (v1 no registraba, pero repintaba en cada guardado).
- Tema claro/oscuro: colores tomados del tema (sin colores fijos).
- Cerrar la vista y descargar el plugin: no quedan listeners (no hay errores al editar notas después).
