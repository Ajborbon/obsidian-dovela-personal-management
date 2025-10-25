# Sistema de Weekly - Tareas Semanales

## Descripción General

El sistema de Weekly es un módulo completo que permite visualizar y organizar tareas en una vista semanal estructurada. Integra tareas con diferentes tipos de programación (semanal, fechas específicas) y las presenta de manera organizada con funcionalidades de navegación e interacción agrupadas por día de la semana.

## Características Principales

### 📅 Vista Semanal Organizada
- **Formato de semana**: ISO 8601 (ej: "2025-W43")
- **Rango de fechas**: Lunes a Domingo de la semana objetivo
- **Estructura de carpetas**: Reutiliza configuración de Journal (configurable)
- **Integración con DataviewJS**: Exposición de API para uso en bloques de código

### 🎯 Categorización Inteligente de Tareas

#### 1. 📊 Tareas Semanales
- Tareas con campo semanal `[W::[[YYYY-Www]]]` para la semana objetivo
- Ordenadas por prioridad
- Ideales para objetivos semanales sin fecha específica

#### 2. 🔥 Tareas Vencidas por Fecha
- Tareas con `due` (📅) o `scheduled` (⏳) anteriores al **lunes** de la semana
- **NO incluye** tareas con `start` (🛫)
- Ordenamiento: fecha (más antigua primero) → tipo → prioridad
- **Mostradas en rojo** para indicar urgencia
- Collapsible por defecto

#### 3. 📅 Tareas por Día
- Tareas con fechas que caen en cualquier día de la semana (Lunes-Domingo)
- Agrupadas por día de la semana
- **Día actual destacado** con marcador "📍 Hoy"
- Ordenamiento dentro de cada día:
  - Primero por tipo: `due` (📅) → `scheduled` (⏳) → `start` (🛫)
  - Luego por prioridad

#### 4. 🔥📊 Tareas de Semanas Anteriores
- Tareas semanales `[W::]` vencidas de semanas anteriores
- **Mostradas en rojo** para indicar que están atrasadas
- Ordenamiento inteligente:
  - **Por año**: 2024 antes de 2025
  - **Por número de semana**: W5 → W27 → W42 (manejo correcto de 1 y 2 dígitos)
  - **Por prioridad**: Highest → High → Medium → Low → None
- Soporta semanas de 1 dígito (W5) y 2 dígitos (W43) sin problemas de ordenamiento

#### 5. ✅ Completadas esta Semana
- Tareas marcadas como completadas durante la semana objetivo
- Detectadas por patrón `✅ YYYY-MM-DD` en el contenido
- **Ordenadas cronológicamente** por fecha de ejecución (lunes → domingo)
- Collapsible y colapsadas por defecto

## Implementación Técnica

### Arquitectura del Módulo

```
src/modules/moduloWeekly/
├── weeklyModel.ts          # Interfaces y tipos TypeScript
├── weeklyTaskRenderer.ts   # Lógica de procesamiento y renderizado
├── weeklyAPI.ts           # API expuesta para DataviewJS
└── weeklyPathHelper.ts     # Utilidades para generar rutas semanales
```

### Configuración del Sistema

El sistema reutiliza la configuración existente de Journal:

```
🗓️ Weekly - Configuración de Carpetas (reutiliza Journal)
├── Carpeta Base (compartida con Journal)
├── Subcarpetas por Año (opcional)
├── Subcarpetas por Trimestre (opcional)
├── Subcarpetas por Mes (opcional)
└── Patrón de Carpetas Semanales (basado en configuración Journal)
```

### Archivos Principales

#### 1. `weeklyModel.ts`
Define las interfaces principales del sistema:

```typescript
export interface WeeklyData {
    targetWeek: string;              // "2025-W43"
    year: number;                    // 2025
    week: number;                    // 43
    weekDateRange: {
        start: string;               // "2025-10-20" (Lunes)
        end: string;                 // "2025-10-26" (Domingo)
    };

    weeklyTasks: Task[];             // Tareas [W::] para esta semana

    dailyTasks: {                    // Tareas agrupadas por día
        monday: Task[];
        tuesday: Task[];
        wednesday: Task[];
        thursday: Task[];
        friday: Task[];
        saturday: Task[];
        sunday: Task[];
    };

    overdueWeeklyTasks: Task[];      // Tareas [W::] de semanas anteriores
    overdueByDate: Task[];           // Tareas due/scheduled vencidas
    completedThisWeek: Task[];       // Tareas completadas esta semana
}

export interface WeeklyRenderOptions {
    showOverdueLimit?: number;       // Límite de vencidas a mostrar
    showCompletedCollapsed?: boolean; // Completadas colapsadas
    highlightToday?: boolean;        // Destacar día actual
}
```

#### 2. `weeklyTaskRenderer.ts`
Contiene la lógica central de procesamiento:

**Funciones principales:**
- `generateForWeek()`: Punto de entrada principal
- `processTasksForWeek()`: Clasifica tareas en categorías
- `getWeekDateRange()`: Calcula lunes-domingo de semana ISO
- `isDateInWeek()`: Verifica si fecha está en semana
- `getDayOfWeek()`: Retorna día de semana ('monday' | 'tuesday' | ...)
- `sortTasksByTypePriority()`: Ordena por tipo de fecha y prioridad
- `sortTasksByDateTypePriority()`: Ordena vencidas por fecha, tipo, prioridad
- `generateWeeklyHTML()`: Genera HTML final
- `generateTaskHTML()`: Renderiza tareas individuales

**Detección de Tareas Semanales:**
Las tareas semanales son detectadas por el parser GTD y almacenadas en `task.week`. Soporta formatos:
```typescript
// Formatos soportados (detectados por el parser):
// [W::[[ruta/completa|2025-W43]]] y [W::[[2025-W43]]]
// Semanas de 1 y 2 dígitos (W5, W43)

private extractWeekInfo(task: Task): { weekCode: string; year: number; week: number } | null {
    if (!task.week) return null;
    const weekCode = task.week;
    const parts = weekCode.split('-W');
    if (parts.length !== 2) return null;
    const year = parseInt(parts[0]!);
    const week = parseInt(parts[1]!);
    return { weekCode, year, week };
}
```

**Cálculo de Semanas ISO:**
```typescript
private getWeekDateRange(year: number, week: number): { start: moment.Moment; end: moment.Moment } {
    const weekStart = moment().year(year).isoWeek(week).startOf('isoWeek');
    const weekEnd = weekStart.clone().endOf('isoWeek');
    return { start: weekStart, end: weekEnd };
}
```

**Ordenamiento Inteligente:**
```typescript
// Tareas diarias: tipo de fecha → prioridad
private sortTasksByTypePriority(tasks: Task[]): void {
    const typeOrder = { '📅': 0, '⏳': 1, '🛫': 2 }; // due, scheduled, start
    // ... ordenamiento
}

// Tareas vencidas: fecha → tipo → prioridad
private sortTasksByDateTypePriority(tasks: Task[]): void {
    // Ordena por fecha (más antigua primero), luego tipo, luego prioridad
}
```

#### 3. `weeklyAPI.ts`
API expuesta para uso en DataviewJS:

```typescript
export class WeeklyAPI {
    // Función principal para DataviewJS
    async renderTasksForWeek(weekCode: string, options?: WeeklyRenderOptions): Promise<HTMLElement>

    // Obtener solo conteos
    async getTaskCounts(weekCode: string): Promise<TaskCounts>

    // Obtener código de semana para una fecha
    getWeekCodeFromDate(date: string): string

    // Obtener código de semana actual
    getCurrentWeekCode(): string

    // Generar ruta para nota semanal
    getWeeklyNotePath(weekCode: string): string

    // Crear estructura de carpetas
    async ensureFolderStructure(weekCode: string): Promise<void>
}
```

#### 4. `weeklyPathHelper.ts`
Utilidad para manejo de rutas semanales:

```typescript
export class WeeklyPathHelper {
    // Genera ruta completa para nota semanal
    getWeeklyNotePath(weekCode: string): string

    // Crea estructura de carpetas
    async ensureFolderStructure(vault: any, weekCode: string): Promise<void>

    // Vista previa de rutas
    getPathPreview(weekCode?: string): { weeklyNotePath: string }
}
```

### Integración con el Plugin Principal

En `src/main.ts`:
```typescript
import { WeeklyAPI } from './modules/moduloWeekly/weeklyAPI.js';

export default class DovelaPersonalManagementPlugin extends Plugin {
    weeklyAPI!: WeeklyAPI;

    async onload() {
        // ... otras inicializaciones
        this.weeklyAPI = new WeeklyAPI(this);
    }
}
```

## Sistema de Prioridades

El sistema utiliza un ordenamiento específico para las prioridades:

1. 🔺 **Highest** - Máxima prioridad
2. ⏫ **High** - Alta prioridad
3. 🔼 **Medium** - Prioridad media
4. 🔽 **Low** - Baja prioridad
5. ⏬ **None** - Sin prioridad

## Ordenamiento de Tareas

### Tareas Semanales (W::)
Las tareas semanales de esta semana se ordenan:
1. **Por prioridad** (Highest → High → Medium → Low → None)

### Por Día de la Semana
Dentro de cada día (Lunes-Domingo), las tareas se ordenan:
1. **Primero por tipo de fecha:**
   - `📅 due` - Las más urgentes (vencimiento)
   - `⏳ scheduled` - Las planificadas
   - `🛫 start` - Las que empiezan
2. **Luego por prioridad** (Highest → None)

### Tareas Vencidas de Semanas Anteriores
Las tareas semanales vencidas se ordenan:
1. **Por año** (2024 → 2025)
2. **Por número de semana** (W5 → W27 → W42, manejo correcto de 1 y 2 dígitos)
3. **Por prioridad** (Highest → None)

### Tareas Vencidas por Fecha
Las tareas con fechas vencidas se ordenan:
1. **Por fecha** (más antigua primero)
2. **Por tipo** (due → scheduled)
3. **Por prioridad** (Highest → None)

### Tareas Completadas
Las tareas completadas se ordenan:
1. **Por fecha de ejecución** (lunes → domingo, extraída del patrón `✅ YYYY-MM-DD`)

## Formatos de Campo Semanal Soportados

### Formato Completo con Ruta
```
[W::[[03 - Gestion Personal/AV - Gerente de Vida/AI - Journals/2025/Q4/2025-W43|2025-W43]]]
```

### Formato Simplificado
```
[W::[[2025-W43]]]
```

### Variaciones Permitidas
- Minúscula: `[w::]`
- Mayúscula: `[W::]`
- Código de semana: `YYYY-W##` (ej: `2025-W43`) o `YYYY-W#` (ej: `2025-W5`)
- **Espacios tolerados**: El parser ignora espacios dentro de la definición del campo

### Integración con Parser GTD

El parser central en `src/modules/moduloGTDv3/parser.ts` detecta campos semanales:

```typescript
// Regex mejorado para campos semanales - soporta 1 y 2 dígitos
const week = extractAndClean(/\s*\[(?:w|W)\s*::\s*\[\[(?:.*?\|)?(\d{4}-W\d+)\]\]\s*\]/);
```

## Estilos CSS

### Clases Principales
```css
.weekly-tasks-container    /* Contenedor principal */
.weekly-header            /* Header con título y rango de fechas */
.weekly-group             /* Grupos de tareas */
.weekly-group--overdue    /* Grupos de tareas vencidas */
.daily-group              /* Grupo de un día específico */
.daily-group--today       /* Día actual destacado */
.weekly-task              /* Tarea individual */
.weekly-task--overdue     /* Tarea vencida */
```

### Metadatos de Tareas
```css
.task-priority    /* Símbolo de prioridad */
.task-date       /* Fechas due/scheduled/start */
.task-week       /* Información semanal 📊 2025-W43 */
.task-duration   /* Duración [30min] */
.task-contexts   /* Contextos #cx-* */
.task-people     /* Personas #px-* */
```

### Estados Visuales
```css
.task-date.is-overdue     /* Fechas vencidas (rojo) */
.task-week.is-overdue     /* Semanas vencidas (rojo) */
.daily-group--today       /* Día actual (azul/accent) */
```

## Uso en DataviewJS

### Ejemplo Básico - Semana Actual
```javascript
const plugin = this.app.plugins.plugins['obsidian-dovela-personal-management'];
const weekCode = plugin.weeklyAPI.getCurrentWeekCode();

const weeklyElement = await plugin.weeklyAPI.renderTasksForWeek(weekCode);
dv.container.appendChild(weeklyElement);
```

### Semana Específica
```javascript
const plugin = this.app.plugins.plugins['obsidian-dovela-personal-management'];
const weekCode = "2025-W43";

const weeklyElement = await plugin.weeklyAPI.renderTasksForWeek(weekCode);
dv.container.appendChild(weeklyElement);
```

### Con Opciones Personalizadas
```javascript
const plugin = this.app.plugins.plugins['obsidian-dovela-personal-management'];
const weekCode = plugin.weeklyAPI.getCurrentWeekCode();

const options = {
    showOverdueLimit: 10,           // Mostrar solo 10 tareas vencidas
    showCompletedCollapsed: true,   // Completadas colapsadas por defecto
    highlightToday: true            // Destacar el día actual
};

const weeklyElement = await plugin.weeklyAPI.renderTasksForWeek(weekCode, options);
dv.container.appendChild(weeklyElement);
```

### Extraer Semana del Nombre del Archivo
```javascript
// Para notas con nombres como "2025-W43.md"
const plugin = this.app.plugins.plugins['obsidian-dovela-personal-management'];
const currentFile = dv.current().file.name;
const weekCode = currentFile.match(/\d{4}-W\d{1,2}/)?.[0] ||
    plugin.weeklyAPI.getCurrentWeekCode();

const weeklyElement = await plugin.weeklyAPI.renderTasksForWeek(weekCode);
dv.container.appendChild(weeklyElement);
```

### Obtener Código de Semana de una Fecha
```javascript
const plugin = this.app.plugins.plugins['obsidian-dovela-personal-management'];
const date = "2025-10-24"; // Formato YYYY-MM-DD

const weekCode = plugin.weeklyAPI.getWeekCodeFromDate(date);
dv.paragraph(`La fecha ${date} pertenece a la semana: **${weekCode}**`);

const weeklyElement = await plugin.weeklyAPI.renderTasksForWeek(weekCode);
dv.container.appendChild(weeklyElement);
```

### Solo Conteos (Sin Renderizado Completo)
```javascript
const plugin = this.app.plugins.plugins['obsidian-dovela-personal-management'];
const weekCode = plugin.weeklyAPI.getCurrentWeekCode();

const counts = await plugin.weeklyAPI.getTaskCounts(weekCode);

dv.header(3, `📊 Resumen Semana ${weekCode}`);
dv.paragraph(`
📊 **Tareas Semanales:** ${counts.weekly}
🔥 **Vencidas por Fecha:** ${counts.overdue}
✅ **Completadas:** ${counts.completed}

**Por día:**
- Lunes: ${counts.monday}
- Martes: ${counts.tuesday}
- Miércoles: ${counts.wednesday}
- Jueves: ${counts.thursday}
- Viernes: ${counts.friday}
- Sábado: ${counts.saturday}
- Domingo: ${counts.sunday}
`);
```

## Funcionalidades Interactivas

### Navegación
- **Click en tarea**: Abre el archivo en **nueva pestaña** y navega a la línea específica de la tarea
- **Click en título de grupo**: Expande/colapsa grupos (vencidas, completadas)

### Checkboxes
- **Marcar completada**: Checkbox funcional (integración futura con TaskStateManager)

### Grupos Colapsibles
- **Vencidas por Fecha**: Collapsible por defecto
- **Vencidas de Semanas Anteriores**: Collapsible por defecto
- **Completadas**: Colapsadas por defecto
- **Resto de grupos**: Expandidos por defecto

## Consideraciones de Rendimiento

1. **Parsing Inteligente**: Solo procesa tareas relevantes para la semana objetivo
2. **Caché de Resultados**: API incluye manejo de errores robusto
3. **HTML Optimizado**: Reutiliza clases CSS existentes del sistema GTD
4. **Lazy Loading**: Solo genera HTML cuando es necesario
5. **Validación Eficiente**: El `WeeklyPathHelper` optimiza validaciones de carpetas

## Casos de Uso

### 1. Dashboard Semanal
Mostrar todas las tareas organizadas para una semana específica en la nota semanal.

### 2. Planificación Semanal
Identificar tareas semanales pendientes y distribuir tareas diarias.

### 3. Revisión de Vencidos
Visualizar tareas vencidas tanto por fecha como por semanas anteriores.

### 4. Seguimiento de Progreso
Ver tareas completadas durante la semana para evaluar productividad.

### 5. Organización por Día
Planificar cada día de la semana con tareas específicas ordenadas por urgencia.

## Desarrollo Futuro

### Mejoras Planificadas
1. **Integración completa con TaskStateManager** para marcar tareas completadas
2. **Filtros avanzados** por contexto, proyecto o etiquetas
3. **Vista de múltiples semanas** para planificación mensual
4. **Estadísticas y métricas** de productividad semanal
5. **Notificaciones** para tareas urgentes o vencidas de la semana

### Extensibilidad
El sistema está diseñado para ser extensible:
- Nuevos tipos de agrupación (por proyecto, contexto)
- Diferentes formatos de visualización (compacto, extendido)
- Integración con otros módulos del plugin
- Personalización de estilos por usuario

## Resolución de Problemas

### Errores Comunes

1. **Formato de semana inválido**: Usar siempre `YYYY-W##` o `YYYY-W#`
2. **Semanas no detectadas**: Verificar formato `[W::[[YYYY-W##]]]` o `[W::[[YYYY-W#]]]`
3. **Tareas no aparecen**: Confirmar que las tareas estén en archivos indexados por Dataview
4. **Día actual no destacado**: Verificar que `highlightToday: true` en opciones
5. **Ordenamiento incorrecto**: Asegurarse de que las tareas tengan `dateSymbol` correcto

### Debug

Para verificar qué tareas se están procesando:

```javascript
const plugin = this.app.plugins.plugins['obsidian-dovela-personal-management'];
const weekCode = plugin.weeklyAPI.getCurrentWeekCode();

// Ver conteos
const counts = await plugin.weeklyAPI.getTaskCounts(weekCode);
dv.paragraph(`Tareas semanales: ${counts.weekly}`);
dv.paragraph(`Vencidas por fecha: ${counts.overdue}`);
```

El sistema incluye logging detallado en la consola del desarrollador:
```
[Journal Debug] Week 2025-W43 calculated range: 2025-10-20 to 2025-10-26
```

## Diferencias con el Módulo Journal

| Característica | Journal (Diario) | Weekly (Semanal) |
|---------------|------------------|------------------|
| **Enfoque** | Tareas de un día específico | Tareas de toda la semana |
| **Agrupación** | Por tipo de tarea | Por día de la semana |
| **Campo principal** | Fechas (due/scheduled/start) | `[W::]` + fechas |
| **Rango temporal** | Un solo día | 7 días (Lunes-Domingo) |
| **Destacado** | Tareas de hoy | Día actual dentro de la semana |
| **Vencidos** | Tareas vencidas a hoy | Vencidos por fecha + semanas anteriores |

## Registro de Cambios

### v1.0.0 (2025-10-24)
- ✅ **Lanzamiento Inicial**: Sistema Weekly completo con categorización de tareas
- ✅ **Soporte Semanal**: Detección y agrupación de tareas semanales con formato [W::]
- ✅ **Agrupación por Día**: Tareas organizadas de Lunes a Domingo
- ✅ **Tareas Vencidas por Fecha**: Nueva sección para tareas due/scheduled vencidas
- ✅ **Ordenamiento Inteligente**: Por tipo de fecha (due → scheduled → start), luego prioridad
- ✅ **Destacado de Hoy**: Marca visual del día actual dentro de la semana
- ✅ **API DataviewJS**: Integración completa con DataviewJS
- ✅ **Estilos CSS**: Sistema completo de estilos responsivos
- ✅ **Reutilización de Configuración**: Usa configuración de Journal para rutas

---

**Última actualización**: 2025-10-25
**Versión del sistema**: 1.0.1
**Compatibilidad**: Obsidian 1.0+ con plugin Dataview
**Módulos relacionados**: Journal, GTD v3
