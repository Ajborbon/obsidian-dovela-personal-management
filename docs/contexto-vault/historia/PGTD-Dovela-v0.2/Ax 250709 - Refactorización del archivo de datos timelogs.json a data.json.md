---
type: Ax
estado: 🟢
tags:
---

# Análisis del Código Actual


  Tu TimeTrackerService es un ejemplo perfecto para esta discusión.


   1. Gestión Manual de Archivos: Como sospechábamos, los métodos loadTimeLogs y saveTimeLogs implementan una lógica manual usando
      this.app.vault.adapter.exists, read y write. Estás reinventando una rueda que la API de Obsidian ya te da, y de forma más segura.


   2. Ruta Codificada (Hardcoded): La constante TIME_LOGS_FILE contiene la ruta .obsidian/plugins/obsidian-dovela-personal-management/timelogs.json.
      Aunque la ruta es técnicamente correcta, es frágil. Si tu ID de plugin cambiara o si Obsidian modificara su estructura de directorios en el futuro,
      tu código dejaría de funcionar. El objetivo de la API es precisamente abstraer esa ruta para que no tengas que preocuparte por ella.


   3. La Pista Clave en tu Propio Código: ¡Y aquí está lo más interesante! En el mismo archivo, los métodos saveInterruptedSession, loadInterruptedSession
       y clearInterruptedSession ya están usando la forma correcta: this.plugin.loadData() y this.plugin.saveData(). Esto demuestra que ya estás
      familiarizado con la API correcta. El objetivo ahora es simple: usar ese mismo método para los `timelogs` también.

# Plan de Refactorización


  Te propongo un camino claro para alinear todo tu plugin con las mejores prácticas.

##   Paso 1: Unificar tu Modelo de Datos


  En lugar de tener datos dispersos, centralízalos. En tu archivo principal (main.ts o src/modules/moduloGTDv3/model.ts), define una única interfaz
  para todos los datos de tu plugin.


```ts
    1 // En model.ts o un archivo similar
    2 import type { TimeLogEntry, ActiveTimerState } from './model.js';
    3 
    4 export interface DovelaPluginData {
    5   schemaVersion: number;
    6   timeLogs: TimeLogEntry[];
    7   interruptedTimer?: ActiveTimerState; // Usamos el mismo objeto que ya tienes
    8 }
    9 
   10 export const DEFAULT_SETTINGS: DovelaPluginData = {
   11   schemaVersion: 1,
   12   timeLogs: [],
   13   interruptedTimer: undefined
   14 };
```


##   Paso 2: Centralizar la Carga y Guardado en main.ts


  Tu clase principal DovelaPersonalManagementPlugin debe ser la única responsable de interactuar con el data.json de Obsidian.


```ts
    1 // En main.ts
    2 import { DovelaPluginData, DEFAULT_SETTINGS } from './modules/moduloGTDv3/model';
    3 
    4 export default class DovelaPersonalManagementPlugin extends Plugin {
    5   public data: DovelaPluginData;
    6 
    7   async onload() {
    8     await this.loadPluginData();
    9     // ... resto de tu inicialización
   10     // Aquí instanciarías tu TimeTrackerService, pasándole una referencia
   11     // a `this` o a `this.data`.
   12   }
   13 
   14   async loadPluginData() {
   15     // loadData() lee .obsidian/plugins/obsidian-dovela-personal-management/data.json
   16     const loadedData = await this.loadData();
   17     this.data = Object.assign({}, DEFAULT_SETTINGS, loadedData);
   18     // Aquí iría la lógica de migración si `schemaVersion` cambia
   19   }
   20 
   21   async savePluginData() {
   22     // saveData() escribe en .obsidian/plugins/obsidian-dovela-personal-management/data.json
   23     await this.saveData(this.data);
   24   }
   25 
   26   // ...
   27 }
```


##   Paso 3: Refactorizar TimeTrackerService

  El servicio ya no debe manejar archivos. Su única responsabilidad es aplicar la lógica de negocio a los datos que recibe.


```ts
    1 // En src/modules/moduloGTDv3/timeTrackerService.ts (versión refactorizada)
    2 import type DovelaPersonalManagementPlugin from '../../main.js';
    3 import type { TimeLogEntry, ActiveTimerState } from './model.js';
    4 import moment from 'moment';
    5 
    6 export class TimeTrackerService {
    7     // El servicio ahora depende del plugin para acceder a los datos y guardarlos
    8     (private plugin: DovelaPersonalManagementPlugin) {}
    9     c
   10     // Ya no necesitas loadTimeLogs ni saveTimeLogs. Se eliminan.
   11     n
   12     async addLogEntry(entryData: Omit<TimeLogEntry, 'id'>): Promise<void> {
   13         const newEntry: TimeLogEntry = {
   14             id: Date.now().(),
   15             ...entryData   t
   16         };                 o
   17                            S
   18         // 1. Modifica el objeto de datos del plugin
   19         this.plugin.data.timeLogs.push(newEntry);
   20                            i
   21         // 2. Llama al método centralizado para guardar
   22         await this.plugin.savePluginData();
   23     }
   24 
   25     getStatistics(filters: { startDate?: moment.Moment, endDate?: moment.Moment }): Map<string, number> {
   26         // Este método ahora lee directamente de los datos del plugin
   27         const logs = this.plugin.data.timeLogs;
   28         const stats = new Map<string, number>();
   29 
   30         // ... (el resto de la lógica de filtrado y cálculo no cambia)
   31         // ...
   32         return stats;
   33     }
   34 
   35     // Los métodos de sesión interrumpida también se simplifican
   36     async saveInterruptedSession(timer: ActiveTimerState): Promise<void> {
   37         this.plugin.data.interruptedTimer = timer;
   38         await this.plugin.savePluginData();
   39     }
   40 
   41     async loadInterruptedSession(): Promise<ActiveTimerState | null> {
   42         return this.plugin.data.interruptedTimer || null;
   43     }
   44 
   45     async clearInterruptedSession(): Promise<void> {
   46         this.plugin.data.interruptedTimer = undefined;
   47         await this.plugin.savePluginData();
   48     }
   49 }
```

##   Paso 4: Migración de Datos (Opcional pero recomendado)


  Para no perder los datos de tus usuarios actuales, puedes añadir una rutina de migración única en tu loadPluginData en main.ts.


```ts
    1 // En main.ts, dentro de loadPluginData()
    2 async loadPluginData() {
    3     this.data = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    4 
    5     // --- INICIO DE MIGRACIÓN ---
    6     const oldTimeLogsFile = '.obsidian/plugins/obsidian-dovela-personal-management/timelogs.json';
    7     if (await this.app.vault.adapter.exists(oldTimeLogsFile)) {
    8         try {
    9             const oldLogsContent = await this.app.vault.adapter.read(oldTimeLogsFile);
   10             const oldLogs = JSON.parse(oldLogsContent);
   11             if (Array.isArray(oldLogs) && oldLogs.length > 0) {
   12                 // Combina los logs, evitando duplicados si es necesario
   13                 this.data.timeLogs = [...this.data.timeLogs, ...oldLogs];
   14                 await this.savePluginData();
   15             }
   16             // Elimina el archivo antiguo para que la migración no se repita
   17             await this.app.vault.adapter.remove(oldTimeLogsFile);
   18             console.log('Dovela PM: Migración de timelogs.json completada.');
   19         } catch (error) {
   20             console.error('Dovela PM: Falló la migración de timelogs.json', error);
   21         }
   22     }
   23     // --- FIN DE MIGRACIÓN ---
   24 }
```

##   Conclusión


  Al realizar esta refactorización, tu plugin no solo será más robusto y fácil de mantener, sino que también se comportará como un ciudadano de
  primera clase en el ecosistema de Obsidian. Estarás garantizando:
   * Sincronización correcta con Obsidian Sync y otros servicios.
   * Limpieza automática cuando el usuario desinstale el plugin.
   * Resiliencia ante futuros cambios en la API de Obsidian.
   * Coherencia en tu propio código, siguiendo un único patrón para la persistencia de datos.