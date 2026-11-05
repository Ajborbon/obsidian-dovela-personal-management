# 05 · Guía de pruebas manuales de Dovela v2

> Para Andrés y para el agente que valide la rama `rewrite/v2` funcionalidad por funcionalidad.
> Las pruebas automáticas (`pnpm test`) cubren la lógica pura. Esta guía cubre lo que solo se ve en Obsidian.
> Cada funcionalidad tiene su guía detallada en `docs/v2/guia/` (enlaces al final). Este documento explica la instalación,
> las comprobaciones transversales y el orden recomendado.

## 1. Instalar la rama en un vault de prueba SIN tocar el vault real

1. **Copia del vault.** Duplica el vault real a una carpeta nueva (p. ej. `~/Vaults/AJBB-prueba-v2`), **fuera** de Google Drive y sin Obsidian Sync activado en esa copia. Así se prueba con datos reales sin riesgo.
   - En móvil: crea un vault nuevo local (sin Sync) y copia dentro algunas carpetas representativas (un `PGTD` con tareas, `00 - Inbox`, `AI - Journals` del mes actual).
2. **Compilar la rama:**
   ```bash
   git clone -b rewrite/v2 https://github.com/Ajborbon/obsidian-dovela-personal-management.git
   cd obsidian-dovela-personal-management
   pnpm install
   pnpm build
   ```
   Se generan `main.js` (≈ 150–250 KB) y `styles.css`.
3. **Instalar en la copia:** copia `main.js`, `styles.css` y `manifest.json` a `<vault-prueba>/.obsidian/plugins/obsidian-dovela-personal-management/` (reemplazando los de v1 en la copia). **No borres `data.json`**: v2 lo migra y deja un respaldo `data.v1.backup.json` en la misma carpeta.
4. Abre la copia en Obsidian → Ajustes → Complementos de la comunidad → recarga/activa “Obsidian Dovela Personal Management”.
5. Comprobación inicial: paleta de comandos → **“Dovela: Diagnóstico: estado del índice”** debe mostrar el número de notas y tareas. Si dice “construyéndose”, espera unos segundos y repite.
6. Para volver a v1 en la copia: reinstala el `main.js`/`styles.css` de `main` y restaura `data.v1.backup.json` como `data.json`. (Los registros de tiempo creados con v2 viven en `Dovela/Registro de tiempo/` y v1 no los ve; exporta a CSV antes si los necesitas.)

### Probar Obsidian Sync (opcional, con un vault de prueba propio)
Crea un **vault remoto de prueba** en Obsidian Sync (no el real), conéctalo en escritorio y móvil, y ejecuta las pruebas de §3.3. Nunca conectes la rama v2 al vault remoto real hasta aprobarla.

## 2. Orden recomendado
1. Arranque y migración (§3.1) → 2. Índice (§3.2) → 3. Dashboard GTD → 4. Smart Inbox → 5. Tiempo y Pomodoro (incluida la importación del historial) → 6. Foco → 7. Backlinks → 8. Journal/Weekly → 9. Notas y estado → 10. Paneles → 11. Sync (§3.3) → 12. Rendimiento (§3.4).

## 3. Comprobaciones transversales

### 3.1 Arranque y migración de `data.json`
| Paso | Resultado esperado | Comparación con v1 |
|---|---|---|
| Activar v2 sobre un `data.json` de v1 | Aparece `data.v1.backup.json`; `data.json` tiene `"schemaVersion": 2` y una clave `legacy` con `timeLogs` intactos | v1 no versionaba |
| Ajustes → Dovela | Secciones General, Registro de tiempo, Pomodoro, Journal… con los valores de v1 (duraciones Pomodoro, carpeta de journals) | mismos valores |
| Aviso “hay N registros de tiempo de v1 por importar” | Al tocarlo se importa y se muestra un informe; `Dovela/Registro de tiempo/AAAA-MM · importado-<disp>.md` | v1 guardaba en data.json |
| Comando “Tiempo: verificar historial importado” | ✅ y minutos por mes iguales | — |

### 3.2 Índice incremental
| Paso | Esperado |
|---|---|
| Editar una tarea en una nota con el Dashboard abierto | El Dashboard se actualiza solo (≤ 1 s), sin botón Refrescar y sin perder el scroll |
| Crear/borrar/renombrar una nota con tareas | Aparece/desaparece/cambia de ruta en las vistas |
| Tareas dentro de un bloque de código o un comentario `%% %%` | **No** aparecen (v1 sí las contaba) |
| “Diagnóstico: reconstruir índice” | Muestra el tiempo en ms (referencia de rendimiento) |

### 3.3 Obsidian Sync (dos dispositivos, vault de prueba)
| Paso | Esperado |
|---|---|
| Iniciar temporizador en escritorio | En el móvil aparece la sesión en curso cuando llega el archivo `AAAA-MM · <escritorio>.md` (sin sondeo) |
| Detenerlo en el móvil | Se registra una vez; en escritorio desaparece el temporizador y aparece el registro |
| Editar el mismo registro en ambos sin conexión y reconectar | Gana la última edición; no se duplica |
| Borrar un registro en un dispositivo | No revive al sincronizar |
| Cada dispositivo escribe solo su archivo | Comprobar en `Dovela/Registro de tiempo/` que no hay “conflicted copy” |

### 3.4 Rendimiento y memoria
- Tiempo de arranque: Ajustes → Acerca de → (o consola de desarrollador, escritorio) medir desde la recarga del plugin hasta que “Diagnóstico” dice “listo”. Comparar con v1 (v1 reparseaba todo el vault al abrir el Dashboard).
- Escribir en una nota larga durante 1 minuto: Obsidian no debe ralentizarse (v1 recorría todo el vault en cada guardado).
- `main.js`: v1 ≈ 1,6 MB → v2 objetivo < 250 KB.

### 3.5 Móvil (iOS y Android)
- Todas las vistas abren sin errores; botones y filas ≥ 44 px; los campos de texto no hacen zoom (16 px).
- La paleta de comandos permite iniciar, detener y cancelar el temporizador y el Pomodoro (en v1 no se podía detener desde la paleta).

## 4. Guías por funcionalidad
- [Dashboard GTD y Foco](guia/gtd-y-foco.md)
- [Captura (Smart Inbox)](guia/captura.md)
- [Registro de tiempo y Pomodoro](guia/tiempo.md)
- [Paneles de actividad y revisión](guia/paneles.md)
- [Backlinks](guia/backlinks.md)
- [Journal y Weekly](guia/journal-weekly.md)
- [Notas DOVELA y selector de estado](guia/notas-y-estado.md)

## 5. Cómo reportar un fallo
Para cada fallo: guía y paso, dispositivo (escritorio/iOS/Android), resultado obtenido, captura de pantalla y, si aplica, la línea de tarea exacta (copiar el texto de la nota). Activar “Diagnóstico: activar registro de depuración” antes de reproducirlo y copiar la consola en escritorio.
