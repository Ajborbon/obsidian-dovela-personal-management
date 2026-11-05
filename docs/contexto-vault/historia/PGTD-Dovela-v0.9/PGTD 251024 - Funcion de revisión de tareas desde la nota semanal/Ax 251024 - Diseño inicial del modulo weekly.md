---
type: Ax
estado: 🟢
tags:
origen: "[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Dovela v0.9/PGTD 251024 - Funcion de revisión de tareas desde la nota semanal/PGTD 251024 - Funcion de revisión de tareas desde la nota semanal]]"
---

## 📐 Diseño del Módulo Weekly

### Estructura de Archivos

  src/modules/moduloWeekly/
  ├── weeklyModel.ts          # Interfaces y tipos TypeScript
  ├── weeklyTaskRenderer.ts   # Lógica de procesamiento y renderizado
  ├── weeklyAPI.ts           # API expuesta para DataviewJS
  └── weeklyPathHelper.ts    # Utilidades para rutas semanales

### weeklyModel.ts - Interfaces
```js
  import type { Task } from '../moduloGTDv3/model.js';

  /**
   * Datos procesados para una semana específica
   */
  export interface WeeklyData {
      targetWeek: string;              // Código semana: "2025-W43"
      year: number;                    // 2025
      week: number;                    // 43
      weekDateRange: {                 // Rango de fechas
          start: string;               // "2025-10-20" (Lunes)
          end: string;                 // "2025-10-26" (Domingo)
      };

      // Tareas W:: para esta semana
      weeklyTasks: Task[];

      // Tareas con fechas en esta semana, agrupadas por día
      dailyTasks: {
          monday: Task[];
          tuesday: Task[];
          wednesday: Task[];
          thursday: Task[];
          friday: Task[];
          saturday: Task[];
          sunday: Task[];
      };

      // Tareas W:: de semanas anteriores (vencidas)
      overdueWeeklyTasks: Task[];

      // Tareas completadas esta semana
      completedThisWeek: Task[];
  }

  export interface WeeklyRenderOptions {
      showOverdueLimit?: number;       // Límite de vencidas
      showCompletedCollapsed?: boolean; // Completadas colapsadas
      highlightToday?: boolean;        // Destacar día actual
  }
  ```
  

### weeklyTaskRenderer.ts - Procesamiento y Renderizado

  Funciones principales:
  - generateForWeek(weekCode: string) - Punto de entrada principal
  - processTasksForWeek(allTasks, weekCode) - Clasifica tareas en categorías
  - getWeekDateRange(year, week) - Calcula lunes-domingo de semana ISO
  - isDateInWeek(date, year, week) - Verifica si fecha está en semana
  - getDayOfWeek(date) - Retorna 'monday' | 'tuesday' | ... | 'sunday'
  - generateWeeklyHTML(weeklyData, options) - Genera HTML con estructura:

  <div class="weekly-tasks-container">
      <!-- Header con rango de fechas -->
      <div class="weekly-header">
          <h2>Semana 2025-W43</h2>
          <p>20 de octubre - 26 de octubre, 2025</p>
      </div>

      <!-- Sección: Tareas W:: para esta semana -->
      <div class="weekly-group">
          <h3>📊 Tareas Semanales (5)</h3>
          <!-- Lista de tareas W:: -->
      </div>

      <!-- Sección: Tareas por día -->
      <div class="weekly-group">
          <h3>📅 Tareas por Día</h3>

          <div class="daily-group">
              <h4>Lunes 20 📍 Hoy</h4>
              <!-- Tareas del lunes -->
          </div>

          <div class="daily-group">
              <h4>Martes 21</h4>
              <!-- Tareas del martes -->
          </div>

          <!-- ... resto de días -->
      </div>

      <!-- Sección: Vencidas de semanas anteriores -->
      <div class="weekly-group collapsible">
          <h3>🔥 Tareas Vencidas de Semanas Anteriores (3)</h3>
          <!-- Lista de tareas W:: vencidas -->
      </div>

      <!-- Sección: Completadas esta semana -->
      <div class="weekly-group collapsible collapsed">
          <h3>✅ Completadas esta Semana (12)</h3>
          <!-- Lista de tareas completadas -->
      </div>
  </div>

### weeklyAPI.ts - API para DataviewJS
```js
  export class WeeklyAPI {
      /**
       * Renderiza tareas para una semana específica
       * @param weekCode - Código semana formato "YYYY-W##" (ej: "2025-W43")
       * @param options - Opciones de renderizado (opcional)
       * @returns HTMLElement listo para insertar en DOM
       */
      async renderTasksForWeek(
          weekCode: string,
          options?: WeeklyRenderOptions
      ): Promise<HTMLElement>

      /**
       * Obtiene solo conteos de tareas por categoría
       * @param weekCode - Código semana formato "YYYY-W##"
       * @returns Objeto con conteos
       */
      async getTaskCounts(weekCode: string): Promise<{
          weekly: number;
          monday: number;
          tuesday: number;
          wednesday: number;
          thursday: number;
          friday: number;
          saturday: number;
          sunday: number;
          overdue: number;
          completed: number;
      }>

      /**
       * Genera la ruta para una nota semanal
       * @param weekCode - Código semana formato "YYYY-W##"
       * @returns Ruta completa para la nota semanal
       */
      getWeeklyNotePath(weekCode: string): string

      /**
       * Obtiene código de semana para una fecha
       * @param date - Fecha en formato YYYY-MM-DD
       * @returns Código semana "YYYY-W##"
       */
      getWeekCodeFromDate(date: string): string
  }
```

### weeklyPathHelper.ts - Manejo de Rutas

```js
  export class WeeklyPathHelper {
      /**
       * Genera ruta para nota semanal basada en configuración Journal
       * Reutiliza la configuración existente de Journal
       */
      getWeeklyNotePath(weekCode: string): string

      /**
       * Crea estructura de carpetas para una semana
       */
      async ensureFolderStructure(vault: any, weekCode: string): Promise<void>

      /**
       * Vista previa de ruta generada
       */
      getPathPreview(weekCode: string): {
          weeklyNotePath: string;
      }
  }
```

  Integración en main.ts

```js
  // Importar
  import { WeeklyAPI } from './modules/moduloWeekly/weeklyAPI.js';

  // En la clase DovelaPersonalManagementPlugin
  public weeklyAPI!: WeeklyAPI;

  // En onload()
  this.weeklyAPI = new WeeklyAPI(this);
```

  Uso en DataviewJS
```js
  Ejemplo básico:
  // En una nota semanal "2025-W43.md"
  const weekCode = "2025-W43";
  const weeklyElement = await this.app.plugins.plugins['obsidian-dovela-personal-management']
      .weeklyAPI.renderTasksForWeek(weekCode);
  dv.el('div', '', { container: weeklyElement });

  Con opciones:
  const options = {
      showOverdueLimit: 10,
      showCompletedCollapsed: true,
      highlightToday: true
  };
  const weeklyElement = await this.app.plugins.plugins['obsidian-dovela-personal-management']
      .weeklyAPI.renderTasksForWeek('2025-W43', options);
  dv.el('div', '', { container: weeklyElement });

  Obtener código de semana actual:
  const today = moment().format('YYYY-MM-DD');
  const weekCode = this.app.plugins.plugins['obsidian-dovela-personal-management']
      .weeklyAPI.getWeekCodeFromDate(today);
  // Retorna: "2025-W43"
```

  ---
###   🎨 Clases CSS
```css
  .weekly-tasks-container       /* Contenedor principal */
  .weekly-header               /* Header con título y rango */
  .weekly-group                /* Grupo de tareas */
  .daily-group                 /* Grupo de un día específico */
  .daily-group--today          /* Modificador para día actual */
  .weekly-task                 /* Tarea individual */
  .weekly-task--overdue        /* Tarea vencida */
```

  ---
###   ✅ Ventajas de este Diseño

  1. Reutiliza infraestructura existente: Usa parser GTD, moment.js, y patrones del Journal
  2. Configuración compartida: Reutiliza journalSettings para rutas
  3. API limpia: Similar a Journal, fácil de usar en DataviewJS
  4. Agrupación clara: Por día de semana con marcador de "Hoy"
  5. Extensible: Fácil agregar filtros o vistas adicionales

  