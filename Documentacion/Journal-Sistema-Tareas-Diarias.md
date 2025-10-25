# Sistema de Journal - Tareas Diarias y Semanales

## Descripción General

El sistema de Journal es un módulo completo que permite visualizar y organizar tareas en una vista diaria estructurada. Integra tareas con diferentes tipos de programación (calendario, fechas, semanas) y las presenta de manera organizada con funcionalidades de navegación e interacción.

## Características Principales

### 📋 Vista Diaria Organizada
- **Formato de fecha**: `YYYY-MM-DD EEEE` (ej: "2025-10-24 viernes")
- **Estructura de carpetas**: `03 - Gestion Personal/AV - Gerente de Vida/AI - Journals/YYYY/MM`
- **Integración con DataviewJS**: Exposición de API para uso en bloques de código

### 🎯 Categorización Inteligente de Tareas

#### 1. ⏰ Calendario del Día
- Tareas con horario específico `[hI:: hora]`
- Ordenadas cronológicamente por hora de inicio

#### 2. 📅⏳🛫 Programadas para Hoy
- Tareas con `due`, `scheduled` o `start` para la fecha objetivo
- Ordenamiento: `due` → `scheduled` → `start`, luego por prioridad

#### 3. 📊 Tareas para esta Semana
- Tareas con campo semanal `[w::]` o `[W::]` para la semana actual
- Ordenadas por prioridad

#### 4. 🔥📊 Tareas de Semanas Anteriores
- Tareas semanales vencidas de semanas anteriores
- **Mostradas en rojo** para indicar que están atrasadas
- Ordenadas por semana (más antigua primero), luego por prioridad

#### 5. 🔄 En Progreso
- Tareas con estado `[/]`
- Ordenadas por prioridad

#### 6. 🔥 Vencidas a Hoy
- Tareas con fechas anteriores a la fecha objetivo
- Opción de límite configurable
- Collapsible por defecto

#### 7. ⛔ Bloqueadas por Dependencias
- Tareas con dependencias `⛔` no completadas
- Enlaces navegables a las tareas dependientes

#### 8. ✅ Completadas Hoy
- Tareas marcadas como completadas en la fecha objetivo
- Collapsible por defecto

## Implementación Técnica

### Arquitectura del Módulo

```
src/modules/moduloJournal/
├── journalModel.ts         # Interfaces y tipos TypeScript
├── journalTaskRenderer.ts  # Lógica de renderizado y procesamiento
├── journalAPI.ts          # API expuesta para DataviewJS
└── journalPathHelper.ts    # Utilidades para generar rutas configurables
```

### Configuración del Sistema

El sistema incluye una sección completa de configuración en la pestaña de configuración del plugin:

```
🗓️ Journal - Configuración de Carpetas
├── Carpeta Base (configurable)
├── Subcarpetas por Año (opcional)
├── Subcarpetas por Trimestre (opcional)
├── Subcarpetas por Mes (opcional)
└── Patrón de Carpetas Semanales (configurable)
```

### Archivos Principales

#### 1. `journalModel.ts`
Define las interfaces principales del sistema:

```typescript
export interface JournalDayData {
    targetDate: string;
    calendarTasks: Task[];          // Tareas con [hI:: hora]
    programmedToday: Task[];        // Due/Schedule para hoy
    weeklyTasksThisWeek: Task[];    // Tareas [w::] para esta semana
    weeklyTasksOverdue: Task[];     // Tareas [w::] de semanas anteriores
    overdueToday: Task[];          // Due/Schedule vencidas hasta hoy
    inProgress: Task[];            // Tareas [/]
    blockedDependencies: Task[];   // Tareas con ⛔ para hoy o vencidas
    completedToday: Task[];        // Tareas completadas hoy
}

export interface JournalRenderOptions {
    showOverdueLimit?: number;      // Límite de vencidas a mostrar
    groupOverdueByWeek?: boolean;   // Agrupar vencidas por semana
    showOnlyCritical?: boolean;     // Solo mostrar 🔺⏫ en vencidas
    enableQuickActions?: boolean;   // Botones rápidos de acción
}
```

#### 2. `journalTaskRenderer.ts`
Contiene la lógica central de procesamiento:

**Funciones principales:**
- `generateForDate()`: Punto de entrada principal
- `processTasksForDate()`: Clasifica tareas en categorías
- `extractWeekInfo()`: Detecta información de semanas ISO desde `task.week`
- `getWeekDateRange()`: Calcula rangos de fechas para semanas ISO
- `isWeekOverdue()`: Determina si una semana está vencida
- `generateJournalHTML()`: Genera HTML final
- `generateTaskHTML()`: Renderiza tareas individuales

**Detección de Tareas Semanales:**
Las tareas semanales son detectadas por el parser GTD y almacenadas en `task.week`. Soporta ambos formatos:
```typescript
// Formatos soportados (detectados por el parser):
// [w::[[ruta/completa|2025-W43]]] y [w::[[2025-W43]]]
// [W::[[2025-W5]]] (semanas de 1 dígito también soportadas)

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
    const jan4 = moment().year(year).month(0).date(4);
    const firstMonday = jan4.clone().startOf('isoWeek');
    const weekStart = firstMonday.clone().add(week - 1, 'weeks');
    const weekEnd = weekStart.clone().add(6, 'days');
    return { start: weekStart, end: weekEnd };
}
```

#### 3. `journalAPI.ts`
API expuesta para uso en DataviewJS:

```typescript
export class JournalAPI {
    // Función principal para DataviewJS
    async renderTasksForDate(targetDate: string, options?: JournalRenderOptions): Promise<HTMLElement>

    // Obtener solo conteos
    async getTaskCounts(targetDate: string): Promise<TaskCounts>
}
```

#### 4. `journalPathHelper.ts`
Utilidad para manejo de rutas configurables:

```typescript
export class JournalPathHelper {
    // Genera ruta completa para nota diaria
    getDailyNotePath(date: string | Date): string

    // Genera ruta para enlaces semanales
    getWeeklyLinkPath(weekCode: string): string

    // Genera enlace completo de Obsidian
    generateWeeklyLink(weekCode: string): string

    // Valida carpeta base
    async validateBaseFolderPath(vault: any): Promise<{valid: boolean; message?: string}>

    // Crea estructura de carpetas
    async ensureFolderStructure(vault: any, date?: string | Date): Promise<void>

    // Vista previa de rutas
    getPathPreview(sampleDate?: string | Date): {dailyNotePath: string; weeklyLinkPath: string; weeklyLinkFull: string}
}
```

### Integración con el Plugin Principal

En `src/main.ts`:
```typescript
import { JournalAPI } from './modules/moduloJournal/journalAPI.js';

export default class DovelaPersonalManagementPlugin extends Plugin {
    journalAPI!: JournalAPI;

    async onload() {
        // ... otras inicializaciones
        this.journalAPI = new JournalAPI(this);
    }
}
```

## Sistema de Prioridades

El sistema utiliza un ordenamiento específico para las prioridades:

1. 🔺 **Highest** - Máxima prioridad
2. ⏫ **High** - Alta prioridad
3. 🔼 **Medium** - Prioridad media
4. 🔽 **Low** - Baja prioridad
5. ⏬ **None** - Sin prioridad (mostrado como ⏬)

## Formatos de Campo Semanal Soportados

### Formato Completo con Ruta
```
[w::[[03 - Gestion Personal/AV - Gerente de Vida/AI - Journals/2025/Q3/2025-W43|2025-W43]]]
```

### Formato Simplificado
```
[w::[[2025-W43]]]
```

### Variaciones Permitidas
- Minúscula: `[w::]`
- Mayúscula: `[W::]`
- Código de semana: `YYYY-W##` (ej: `2025-W43`) o `YYYY-W#` (ej: `2025-W5`)
- **Espacios tolerados**: El parser ignora espacios dentro de la definición del campo

### Mejoras en el Parser GTD

#### Detección Mejorada de Semanas
El parser central en `src/modules/moduloGTDv3/parser.ts` fue actualizado para soportar:

```typescript
// Regex mejorado para campos semanales - soporta 1 y 2 dígitos
const week = extractAndClean(/\s*\[(?:w|W)\s*::\s*\[\[(?:.*?\|)?(\d{4}-W\d+)\]\]\s*\]/);
```

**Cambios implementados:**
- `\d{1,2}` → `\d+`: Soporta semanas de 1 y 2 dígitos (W5, W43)
- Tolerancia a espacios: `\s*` alrededor de los elementos
- Limpieza correcta: Remueve el campo completo del contenido de la tarea
- Manejo de ambos formatos: Con y sin ruta completa en el enlace

## Estilos CSS

### Clases Principales
```css
.journal-tasks-container    # Contenedor principal
.journal-group             # Grupos de tareas
.journal-task              # Tarea individual
.task--overdue             # Tareas vencidas (fondo rojo)
```

### Metadatos de Tareas
```css
.task-duration    # Duración [30min]
.task-date       # Fechas due/scheduled/start
.task-time       # Horarios [hI:: 09:00]
.task-week       # Información semanal 📊 2025-W43
```

### Estados Visuales
```css
.task-date.is-overdue     # Fechas vencidas (rojo)
.task-week.is-overdue     # Semanas vencidas (rojo)
```

## Uso en DataviewJS

### Ejemplo Básico
```javascript
const targetDate = '2025-10-24';
const journalElement = await this.app.plugins.plugins['obsidian-dovela-personal-management'].journalAPI.renderTasksForDate(targetDate);
dv.el('div', '', { container: journalElement });
```

### Con Opciones
```javascript
const options = {
    showOverdueLimit: 20,
    groupOverdueByWeek: true,
    showOnlyCritical: true
};

const journalElement = await this.app.plugins.plugins['obsidian-dovela-personal-management'].journalAPI.renderTasksForDate('2025-10-24', options);
dv.el('div', '', { container: journalElement });
```

### Obtener Solo Conteos
```javascript
const counts = await this.app.plugins.plugins['obsidian-dovela-personal-management'].journalAPI.getTaskCounts('2025-10-24');
dv.paragraph(`📅 Programadas: ${counts.programmed} | 🔥 Vencidas: ${counts.overdue}`);
```

## Funcionalidades Interactivas

### Navegación
- **Click en tarea**: Navega al archivo y línea específica
- **Enlaces internos**: Abre notas vinculadas
- **Enlaces de dependencias**: Navega a tareas dependientes con el ícono 🔗

### Checkboxes
- **Marcar completada**: Checkbox funcional (integración futura con TaskStateManager)

### Grupos Colapsibles
- **Vencidas**: Colapsadas por defecto
- **Completadas**: Colapsadas por defecto
- **Bloqueadas**: Expandidas por defecto

## Sistema de Configuración

### Pestaña de Configuración Journal

El plugin incluye una sección completa de configuración para Journal:

```typescript
interface JournalSettings {
    baseFolderPath: string;          // Carpeta base para almacenar journals
    yearSubfolder: boolean;          // Crear subcarpetas por año
    quarterSubfolder: boolean;       // Crear subcarpetas por trimestre
    monthSubfolder: boolean;         // Crear subcarpetas por mes
    weekFolderPattern: string;       // Patrón para carpetas semanales
}
```

### Funcionalidades de Configuración

1. **Validación en Tiempo Real**: Valida rutas de carpetas mientras el usuario escribe
2. **Vista Previa**: Muestra ejemplos de rutas que se generarían
3. **Creación Automática**: Crea estructura de carpetas automáticamente
4. **Validación de Caracteres**: Previene caracteres inválidos en nombres de carpeta
5. **Verificación de Existencia**: Confirma que las carpetas son válidas o pueden ser creadas

### Ejemplo de Configuración

**Configuración predeterminada:**
```
Carpeta Base: "03 - Gestion Personal/AV - Gerente de Vida/AI - Journals"
✅ Subcarpetas por Año
✅ Subcarpetas por Trimestre
✅ Subcarpetas por Mes
Patrón Semanal: "{YYYY}/Q{Q}/{MM}"
```

**Resultado:**
- Nota diaria: `03 - Gestion Personal/AV - Gerente de Vida/AI - Journals/2025/Q4/10/2025-10-24 viernes.md`
- Enlace semanal: `03 - Gestion Personal/AV - Gerente de Vida/AI - Journals/2025/Q4/10/2025-W43`

## Consideraciones de Rendimiento

1. **Parsing Inteligente**: Solo procesa tareas relevantes para la fecha objetivo
2. **Caché de Resultados**: API incluye manejo de errores robusto
3. **HTML Optimizado**: Reutiliza clases CSS existentes del sistema GTD
4. **Lazy Loading**: Solo genera HTML cuando es necesario
5. **Validación Eficiente**: El `JournalPathHelper` optimiza validaciones de carpetas

## Casos de Uso

### 1. Dashboard Diario
Mostrar todas las tareas organizadas para una fecha específica en la nota diaria.

### 2. Revisión Semanal
Identificar tareas semanales pendientes y vencidas para planificación.

### 3. Seguimiento de Progreso
Visualizar tareas completadas y en progreso para evaluar productividad.

### 4. Gestión de Dependencies
Identificar y navegar rápidamente a tareas bloqueadas por dependencias.

## Desarrollo Futuro

### Mejoras Planificadas
1. **Integración completa con TaskStateManager** para marcar tareas completadas
2. **Filtros avanzados** por contexto, proyecto o etiquetas
3. **Vista de múltiples días** para planificación semanal
4. **Estadísticas y métricas** de productividad
5. **Notificaciones** para tareas urgentes o vencidas

### Extensibilidad
El sistema está diseñado para ser extensible:
- Nuevos tipos de agrupación
- Diferentes formatos de visualización
- Integración con otros módulos del plugin
- Personalización de estilos por usuario

## Resolución de Problemas

### Errores Comunes

1. **Formato de fecha inválido**: Usar siempre `YYYY-MM-DD`
2. **Semanas no detectadas**: Verificar formato `[w::[[YYYY-W##]]]` o `[w::[[YYYY-W#]]]`
3. **Tareas no aparecen**: Confirmar que las tareas estén en archivos indexados por Dataview
4. **Configuración de carpetas**: Verificar que la carpeta base existe y es válida
5. **Semanas de 1 dígito**: Asegurarse de usar el formato correcto (W5, no W05)

### Debug
El sistema incluye logging detallado en la consola del desarrollador para facilitar la depuración.

---

## Registro de Cambios

### v1.1.0 (2025-10-24)
- ✅ **Mejoras en Parser GTD**: Soporte completo para semanas de 1 y 2 dígitos
- ✅ **Sistema de Configuración**: Pestaña completa de configuración con validación en tiempo real
- ✅ **JournalPathHelper**: Nueva clase utilitaria para manejo de rutas configurables
- ✅ **Tolerancia a Espacios**: Parser mejorado para manejar espacios en campos semanales
- ✅ **Validación de Carpetas**: Sistema robusto de validación y creación de carpetas
- ✅ **Vista Previa**: Ejemplos en tiempo real de rutas generadas

### v1.0.0 (2025-10-24)
- ✅ **Lanzamiento Inicial**: Sistema Journal completo con categorización de tareas
- ✅ **Soporte Semanal**: Detección y agrupación de tareas semanales con formato [w::]
- ✅ **API DataviewJS**: Integración completa con DataviewJS
- ✅ **Estilos CSS**: Sistema completo de estilos responsivos

---

**Última actualización**: 2025-10-24
**Versión del sistema**: 1.1.0
**Compatibilidad**: Obsidian 1.0+ con plugin Dataview