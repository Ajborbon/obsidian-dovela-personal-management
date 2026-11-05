# Contexto del vault para la reescritura del plugin Dovela

Esta carpeta es una copia, hecha el 2026-11-04, de las notas del vault de Obsidian de Andrés Borbón (AJBB) que explican qué hace el plugin, por qué se construyó así y qué reglas del sistema implementa. Quien reescriba el plugin no tiene acceso al vault: esta carpeta es su única ventana a él. Las notas están tal cual, con wikilinks que pueden apuntar a notas que no se copiaron. Las rutas locales con la cuenta de Google Drive se reemplazaron por `<CUENTA>`.

## Qué es el vault (30 segundos)

Un segundo cerebro de ~2.700 notas Markdown con metodología propia llamada DOVELA, inspirada en PARA y GTD. Jerarquía: `Grupo → AV (Área de Vida) → AI (Área de Interés) → PGTD (Proyecto) → notas hijas`. Cada nota tiene `type:` y `estado:` (🟡🟢🔵🔴) en el frontmatter YAML. Las tareas son checkboxes `- [ ]` con emojis de Tasks (➕ creada, 🛫 inicio, ⏳ agendada, 📅 vencimiento, ✅ hecha, ⏫ prioridad) y etiquetas `#cx-...`. Las tareas solo viven en notas contenedor (`PGTD`, `RR`, `Inbox`, `Reu`); las notas de conocimiento nunca llevan checkboxes.

## Restricciones no negociables

1. **Compatibilidad con los datos existentes.** El plugin debe seguir leyendo y escribiendo las notas, tareas, frontmatter y bloques dataview/datacore actuales sin migrarlas. Si se propone un formato nuevo (por ejemplo para pomodoros o registros de tiempo), debe incluir un importador de lo existente y no perder historial.
2. **Obsidian móvil.** Andrés usa el plugin en iOS/Android (`isDesktopOnly: false`). No se pueden usar APIs de Node/Electron, ni dependencias nativas, ni asumir rutas de sistema de archivos. Todo debe funcionar con el `Vault` API de Obsidian. Tener en cuenta el menor presupuesto de memoria y CPU del móvil.
3. **Obsidian Sync.** El vault se sincroniza con el servicio oficial Obsidian Sync entre escritorio y móvil. Cualquier almacenamiento propio del plugin (`data.json`, archivos de datos, notas generadas) debe tolerar ediciones concurrentes desde dos dispositivos y sincronizaciones tardías: preferir datos append-only o por-día/por-entidad en vez de un único archivo grande que todos reescriben, evitar escrituras frecuentes y de alto volumen (Sync sube cada cambio) y definir una estrategia clara de resolución de conflictos.
4. **Rendimiento y memoria.** El plugin actual indexa y reparsea mucho al inicio. Un objetivo central de la reescritura es arranque rápido (carga diferida de módulos), índices incrementales basados en `metadataCache` y eventos, sin reescanear el vault completo, y vistas virtualizadas.
5. **No tocar `main`** hasta que Andrés pruebe y apruebe.

## Mapa de esta carpeta

| Ruta | Qué contiene |
|---|---|
| `reglas-vault/CLAUDE-vault.md` | Reglas del vault: estructura, tipos de nota, nomenclatura, estados, regla de tareas centralizadas |
| `reglas-vault/referencia-vault.md` | Detalle de los 13 tipos de nota, patrón RR y jerarquía |
| `reglas-vault/plantillas/` | Plantillas (hoy en Templater) de cada tipo de nota, incluidas las del Journal (diaria, semanal, mensual, trimestral, anual) |
| `reglas-vault/Ax 250607 - ...` | Estructura de subcarpetas dentro de las carpetas DOVELA |
| `historia/PGTD-Dovela-v0.1`, `v0.2` | Origen del plugin, creación del repo y entorno base |
| `historia/PGTD-Dovela-v0.9` | Backlog heredado: módulo Pomodoro, Smart Inbox, Time Tracker, revisión de tareas en notas diaria y semanal |
| `historia/PGTD-Dovela-v1.0-retoma` | Retoma de julio de 2026, bitácoras de las sesiones y estado actual |
| `historia/RC-Desarrollo-Dovela-commits` | 83 notas `Cmt`: una por commit, con qué se hizo y por qué. Es la mejor fuente de la intención de cada funcionalidad |
| `historia/PGTD-Sistema-de-Gestion-Personal-DOVELA.md` | Proyecto madre del sistema |

Dentro del propio repo, `Documentacion/` y `Documentacion/Agentes-Desarrollo/` tienen documentación técnica previa: arquitectura, patrones, reglas de tareas GTD, journal, weekly, breadcrumbs, estados de proyectos.

## Funcionalidades que deben conservarse (inventario por módulo actual)

- **moduloGTDv3:** parser y jerarquía de tareas GTD, vistas (calendario, línea de tiempo, estadísticas), Smart Inbox, Time Tracker, Pomodoro con modo overtime y modal de cierre, registro de tiempo por tarea, menús en cascada, pestaña de ajustes.
- **moduloFoco:** vista de foco, espejo filtrado de GTD, expansión bidireccional de enlaces, colapso de encabezado, ajustes propios.
- **moduloBacklinks:** vista de árbol expandible que sigue la nota activa, visor de pestañas abiertas, búsqueda jerárquica, breadcrumbs.
- **moduloActividad**, **moduloJournal** (tareas diarias, bloque invocable desde dataviewjs), **moduloWeekly** (tareas semanales).
- Transversal: selector de estado de nota, menú `@` unificado, escritura incremental, soporte móvil.

El inventario es un punto de partida. La ingeniería inversa del código y de las notas `Cmt` manda sobre esta lista.

## Preguntas de diseño que la reescritura debe contestar por escrito (antes de programar)

1. **Plantillas.** Hoy dependen de Templater. ¿Conviene un motor de plantillas propio, ligero y móvil, que cree notas con frontmatter, nomenclatura y enlace bidireccional al padre según las reglas del vault? ¿Qué se gana y qué se pierde?
2. **Pomodoros y registro de tiempo.** ¿Dónde y cómo se almacenan hoy? ¿Es la mejor opción para Sync, móvil, consultas y estadísticas? Evaluar alternativas (un archivo de datos por día o mes, líneas append-only, notas, base propia) y decidir.
3. **Capa de datos única.** ¿Pueden GTD, Foco, Journal, Weekly y Backlinks compartir un solo índice incremental de tareas y notas, en vez de que cada módulo reparsee por su cuenta?
4. **Interfaz.** ¿Qué patrón de vistas es más ligero (DOM nativo, virtualización, Web Components, framework mínimo)? Hoy el bundle pesa ~1,6 MB.
5. **Configuración y estado.** ¿Qué debe vivir en `data.json`, qué en el vault y qué en caché local por dispositivo?
6. **Dependencias.** Revisar `xlsx` y las demás: eliminarlas o aislarlas si afectan al peso o al móvil.
