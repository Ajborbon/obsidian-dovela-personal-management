# Misión: reescritura profunda del plugin Obsidian Dovela Personal Management

Eres un ingeniero senior de plugins de Obsidian con autonomía total. Trabajas en el repo `Ajborbon/obsidian-dovela-personal-management` (privado). Tu dueño, Andrés Borbón, no estará disponible durante la ejecución: no pidas aprobaciones, confirmaciones ni pruebas. Decide, documenta y avanza. Después él y otro agente probarán tu rama funcionalidad por funcionalidad, así que tu trabajo debe ser fácil de probar.

## Contexto
1. Parte de la rama `docs/contexto-vault`, que ya está en el remoto. Crea desde ella tu rama de trabajo `rewrite/v2`. No toques `main` ni hagas push a otras ramas.
2. Lee primero `docs/contexto-vault/00-INDICE.md` y todo lo que enlaza: reglas del vault, plantillas, historia del proyecto y las 83 notas `Cmt`, que explican la intención de cada funcionalidad. Lee también `Documentacion/` y `Documentacion/Agentes-Desarrollo/`. No tienes acceso al vault de Andrés: lo copiado es todo lo que hay.
3. El plugin actual (v1.0.0, ~20.500 líneas de TypeScript, bundle ~1,6 MB) tiene los módulos moduloGTDv3, moduloFoco, moduloBacklinks, moduloActividad, moduloJournal y moduloWeekly.

## Objetivo
Reescribir el plugin casi desde cero, conservando o mejorando cada funcionalidad actual, con mejor rendimiento, menos memoria, arranque más rápido, y una interfaz mejor y más ligera. Tienes que hacer ingeniería inversa completa del código y de las notas de historia, no solo portar archivos.

## Restricciones (detalle en el índice)
- Compatibilidad total con los datos y notas existentes: tareas, frontmatter, bloques dataview/datacore y `data.json`. Si cambias algún formato de almacenamiento, entrega un importador y no pierdas historial.
- Debe funcionar en **Obsidian móvil** (iOS y Android): sin Node ni Electron, solo APIs de Obsidian, `isDesktopOnly: false`.
- El vault se sincroniza con **Obsidian Sync** entre dispositivos: el almacenamiento propio debe tolerar ediciones concurrentes y sincronizaciones tardías, y evitar escrituras frecuentes o archivos únicos grandes que todos reescriban.
- Respeta las reglas del vault: tareas solo en notas contenedor, jerarquía de tipos de nota, estados 🟡🟢🔵🔴, nomenclatura.

## Cuestiona el diseño actual
No te limites a reexpresar lo que existe. Evalúa por escrito y decide, con justificación, al menos estas preguntas:
1. ¿Conviene un motor de plantillas propio, ligero y compatible con móvil, que reemplace la dependencia de Templater para crear notas (frontmatter, nomenclatura, enlace al padre)?
2. ¿Cuál es la mejor forma de almacenar sesiones de Pomodoro y registros de tiempo, pensando en Sync, móvil, estadísticas y consultas? Compara alternativas.
3. ¿Se puede tener una capa de datos única e incremental (basada en `metadataCache` y eventos) compartida por todos los módulos?
4. ¿Qué patrón de interfaz es más ligero (virtualización, DOM nativo, etc.)?
5. ¿Qué va en `data.json`, qué en el vault y qué en caché por dispositivo?
6. ¿Qué dependencias se pueden eliminar (por ejemplo `xlsx`)?
Si ves otras mejoras de arquitectura, rendimiento o experiencia, inclúyelas.

## Proceso
**Fase 0, plan.** Antes de escribir código, crea y haz commit de:
- `docs/v2/01-ingenieria-inversa.md`: inventario completo de funcionalidades, módulos, flujos de datos, formatos de datos y comportamientos, con referencias a archivos y notas `Cmt`.
- `docs/v2/02-decisiones-de-diseno.md`: respuestas razonadas a las preguntas anteriores, arquitectura propuesta y riesgos.
- `docs/v2/03-plan-de-desarrollo.md`: fases con alcance, orden, criterios de aceptación y plan de migración de datos.
- `docs/v2/04-matriz-de-paridad.md`: tabla de cada funcionalidad actual → estado en v2 (pendiente, hecha, mejorada, descartada con motivo).
**Fases siguientes.** Ejecuta el plan fase por fase. Cada fase termina con commit propio, build limpio (`pnpm build`), tipos estrictos sin errores, lint, y la matriz de paridad actualizada. Haz push a `rewrite/v2` al cerrar cada fase.
**Pruebas.** Escribe pruebas automáticas para la lógica pura (parser de tareas, índice, plantillas, almacenamiento, importadores). No se te pide probar la UI en Obsidian: eso lo hará Andrés.
**Entrega para pruebas manuales.** Crea `docs/v2/05-guia-de-pruebas.md` con, por funcionalidad, los pasos exactos para probarla en escritorio y en móvil, el resultado esperado y cómo compararla con el comportamiento de v1. Incluye cómo instalar la rama en un vault de prueba sin tocar el vault real.
**Cierre.** Deja `docs/v2/06-estado-final.md` con lo hecho, lo pendiente, lo descartado, riesgos conocidos y recomendaciones. Mantén un `docs/v2/BITACORA.md` con una entrada por fase.

## Reglas de trabajo
- Commits pequeños y claros, en español.
- No incluyas secretos, tokens ni credenciales en el repo.
- Si algo es ambiguo, elige la opción más segura para los datos del usuario, regístrala en las decisiones y sigue.
- Si una funcionalidad no se puede conservar, no la elimines en silencio: márcala en la matriz con el motivo.
