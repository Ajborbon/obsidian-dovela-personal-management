# Guía del Proceso de Desarrollo
**Plugin: Obsidian Dovela Personal Management**

Esta guía explica el proceso completo de desarrollo en este proyecto, desde la concepción de una idea hasta su implementación final.

---

## 📋 Índice

1. [Introducción](#introducción)
2. [Filosofía del Proyecto](#filosofía-del-proyecto)
3. [Workflow Estándar](#workflow-estándar)
4. [Ejemplos Completos](#ejemplos-completos)
5. [Troubleshooting](#troubleshooting)
6. [Mejores Prácticas](#mejores-prácticas)

---

## Introducción

Este plugin ha evolucionado orgánicamente a lo largo del tiempo. No todas las decisiones pasadas reflejan las mejores prácticas actuales, **pero el objetivo es que futuros desarrollos sí las sigan**.

### Estado Actual

**Fortalezas:**
- Arquitectura modular bien definida (GTD, Foco, Backlinks, Journal, Actividad)
- Separación clara entre Parser → Processor → View
- Sincronización cross-device funcional
- Integración profunda con APIs de Obsidian

**Áreas de Mejora:**
- Testing automatizado (actualmente inexistente)
- Algunos archivos muy grandes que necesitan refactorización
- Documentación inline limitada en ciertos módulos
- Algunas mezclas de lógica de negocio con rendering

### Objetivo de Esta Guía

Establecer un proceso claro y repetible para que:
- Claude (o cualquier desarrollador) sepa exactamente qué hacer
- Los nuevos desarrollos mantengan consistencia
- Se reduzcan errores y retrabajos
- Se mejore la calidad del código progresivamente

---

## Filosofía del Proyecto

### Principios Fundamentales

1. **Consistencia sobre Perfección**
   - Es mejor seguir patrones existentes (aunque no sean perfectos) que crear nuevos
   - La refactorización masiva es costosa; mejoramos incrementalmente

2. **Separación de Responsabilidades**
   - **Modelos**: Definición de tipos e interfaces
   - **Parsers**: Extracción de datos de markdown
   - **Procesadores**: Lógica de negocio
   - **Servicios**: Gestión de estado y persistencia
   - **Vistas**: Rendering y UI
   - **Utilidades**: Helpers reutilizables

3. **Progresión Gradual**
   - No necesitamos arreglar todo el código legacy ahora
   - Cada nuevo desarrollo debe seguir mejores prácticas
   - Con el tiempo, el código legacy se reemplazará naturalmente

4. **Comunicación Clara**
   - Cuando hay ambigüedad, preguntar antes de asumir
   - Documentar decisiones importantes
   - Mantener al usuario informado del progreso

---

## Workflow Estándar

### Fase 1: Descubrimiento y Planificación

#### 1.1 Entender el Requerimiento

**Preguntas clave:**
- ¿Qué problema estamos resolviendo?
- ¿Para quién es esta funcionalidad?
- ¿Cómo se integra con lo existente?
- ¿Hay módulos similares que podamos usar como referencia?

**Ejemplo:**
```
Usuario: "Quiero agregar un sistema de tags personalizados para filtrar tareas"

Análisis:
- Problema: Necesitamos filtrado más flexible que contextos/personas
- Usuario: Personas que usan GTD intensivamente
- Integración: Similar a #cx- y #px-, pero genérico
- Referencia: Mirar cómo se procesan contextos en parser.ts
```

#### 1.2 Crear Plan con TODOs

**Claude SIEMPRE debe crear una lista de TODOs antes de codificar.**

Ejemplo de TODO list bien estructurada:
```
[ ] Investigar parser.ts para entender extracción de tags
[ ] Diseñar estructura de datos para tags personalizados
[ ] Modificar parser.ts para extraer #tag- patterns
[ ] Crear TagFilterService para gestionar filtros
[ ] Agregar UI de filtrado en GtdView
[ ] Actualizar model.ts con nuevas interfaces
[ ] Integrar en main.ts
[ ] Testing manual
[ ] Documentar en README
```

#### 1.3 Identificar Archivos Relevantes

Claude debe leer archivos de contexto ANTES de empezar:

**Contexto Mínimo (siempre leer):**
- `src/main.ts` - Entry point, servicios globales
- `Documentacion/Agentes-Desarrollo/Arquitectura-Plugin.md` - Referencia rápida

**Contexto Específico (según tipo de desarrollo):**
- Nueva vista → `gtdView.ts`, `focoView.ts`
- Nuevo servicio → `timeTrackerService.ts`, `pomodoroService.ts`
- Parser de markdown → `parser.ts`
- Modal → `timeLogModal.ts`, `pomodoroModal.ts`
- Settings → `src/main.ts` (DovelaSettingsTab)

#### 1.4 Aclarar Ambigüedades

Si algo no está claro, **Claude debe preguntar antes de proceder**.

**Ejemplo de preguntas válidas:**
- "¿Esto debería ser un nuevo módulo o parte de moduloGTDv3?"
- "¿Los datos se persisten en data.json o solo en memoria?"
- "¿Prefieres que use el patrón de sub-vistas como en GtdView?"
- "¿Necesitas settings configurables o usamos valores por defecto?"

---

### Fase 2: Diseño de la Solución

#### 2.1 Definir Estructura de Archivos

**Principio:** Cada feature debe tener archivos separados por responsabilidad.

```
src/modules/[modulo]/
├── [feature]Model.ts          # Interfaces y tipos
├── [feature]Parser.ts         # (si extrae datos de markdown)
├── [feature]Processor.ts      # (si procesa datos)
├── [feature]Service.ts        # (si gestiona estado)
├── [feature]View.ts           # (si tiene UI)
├── [feature]Utils.ts          # (si tiene helpers)
└── [feature]Modal.ts          # (si tiene modal)
```

**Ejemplo Real: Time Tracker**
```
src/modules/moduloGTDv3/
├── model.ts                   # Interface TimeLogEntry, ActiveTimerState
├── timeTrackerService.ts      # Lógica de negocio
├── timeTrackerView.ts         # UI del tracker
├── timeLogModal.ts            # Modal de logging
└── statisticsView.ts          # Visualización de stats
```

#### 2.2 Definir Interfaces y Tipos

**SIEMPRE define los tipos ANTES de implementar lógica.**

```typescript
// ❌ MAL: Código sin tipos claros
function processData(data: any) {
    const result = data.items.map(x => x.value);
    return result;
}

// ✅ BIEN: Tipos primero
interface DataItem {
    id: string;
    value: number;
    metadata: Record<string, unknown>;
}

interface ProcessedData {
    items: DataItem[];
    total: number;
}

function processData(data: ProcessedData): number[] {
    return data.items.map(item => item.value);
}
```

#### 2.3 Presentar Diseño al Usuario

Antes de codificar, Claude debe presentar:
- Archivos a crear/modificar
- Interfaces principales
- Flujo de datos
- Puntos de integración

**Ejemplo de presentación:**
```markdown
## Diseño Propuesto: Sistema de Tags Personalizados

### Archivos a Crear:
- `src/modules/moduloGTDv3/tagModel.ts`
- `src/modules/moduloGTDv3/tagFilterService.ts`

### Archivos a Modificar:
- `src/modules/moduloGTDv3/parser.ts:45` - Agregar extracción de #tag-
- `src/modules/moduloGTDv3/model.ts:120` - Agregar campo `customTags: string[]` a Task
- `src/modules/moduloGTDv3/gtdView.ts:200` - Agregar filtro UI
- `src/main.ts:80` - Registrar TagFilterService

### Interfaces Principales:
[código de interfaces]

### Flujo:
Parser extrae #tag- → Processor agrupa por tag → View renderiza filtros

¿Procedo con esta estructura?
```

---

### Fase 3: Implementación

#### 3.1 Orden de Desarrollo

**SIEMPRE sigue este orden:**

1. **Modelos/Tipos** - Define la estructura de datos
2. **Parsers** - Extrae datos de markdown (si aplica)
3. **Procesadores** - Transforma datos (si aplica)
4. **Servicios** - Lógica de negocio
5. **Vistas** - UI y rendering
6. **Integración** - Conecta con main.ts
7. **Settings** - Configuración (si aplica)

**Razón:** Cada paso depende del anterior. No puedes escribir un servicio sin definir los tipos primero.

#### 3.2 Seguir Convenciones

Ver `Patrones-y-Convenciones.md` para detalles completos.

**Resumen rápido:**

**Nomenclatura:**
- Archivos: `camelCase.ts`, `PascalCaseService.ts`, `PascalCaseView.ts`
- Clases: `PascalCase`
- Variables/métodos: `camelCase`
- Constantes: `SCREAMING_SNAKE_CASE`
- CSS: `kebab-case` con prefijo módulo

**Imports:**
```typescript
// Orden: Obsidian → Terceros → Modelos → Servicios → Utils
import { Plugin, Notice } from 'obsidian';
import moment from 'moment';
import type { Task } from './model.js';
import { TimeTrackerService } from './timeTrackerService.js';
import { isDatePast } from './dateUtils.js';
```

**CRÍTICO:** Todos los imports tienen extensión `.js` (ESM format)

#### 3.3 Implementar con Patrones Establecidos

**Patrón de Vista:**
```typescript
export class FeatureView extends ItemView {
    private plugin: DovelaPersonalManagementPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: DovelaPersonalManagementPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string { return FEATURE_VIEW_TYPE; }
    getDisplayText(): string { return 'Feature Display'; }
    override getIcon(): string { return 'icon-name'; }

    override async onOpen() {
        await this.drawView();
        this.registerEvents();
    }

    override async onClose() {
        this.eventAbortController?.abort();
        this.contentEl.empty();
    }
}
```

**Patrón de Servicio:**
```typescript
export class FeatureService {
    constructor(private plugin: DovelaPersonalManagementPlugin) {}

    async performAction(data: DataType): Promise<void> {
        // 1. Validar
        if (!data) {
            new Notice('Error: datos inválidos');
            return;
        }

        // 2. Modificar plugin.data
        this.plugin.data.feature.push(data);

        // 3. Persistir
        await this.plugin.savePluginData();

        // 4. Sincronizar vistas
        this.plugin.refreshFeatureViews();
    }
}
```

#### 3.4 Actualizar TODOs en Tiempo Real

Claude debe marcar TODOs como `in_progress` y `completed` a medida que avanza.

**Ejemplo:**
```
[x] Crear TagFilterService
[→] Agregar UI de filtrado en GtdView  ← actualmente trabajando
[ ] Testing manual
[ ] Documentar
```

---

### Fase 4: Integración

#### 4.1 Modificar main.ts

**Para nuevos servicios:**
```typescript
// 1. Declarar en clase
export default class DovelaPersonalManagementPlugin extends Plugin {
    public tagFilterService!: TagFilterService;
}

// 2. Inicializar en onload()
async onload() {
    // ... código existente
    this.tagFilterService = new TagFilterService(this);
}
```

**Para nuevas vistas:**
```typescript
// 1. Registrar vista
this.registerView(
    TAG_FILTER_VIEW_TYPE,
    (leaf) => new TagFilterView(leaf, this)
);

// 2. Crear comando
this.addCommand({
    id: 'open-tag-filter',
    name: 'Abrir Filtro de Tags',
    callback: () => this.activateView(TAG_FILTER_VIEW_TYPE)
});
```

**Para nuevos datos persistentes:**
```typescript
// 1. Agregar a interface
export interface DovelaPluginData {
    // ... existente
    customTags?: string[];
}

// 2. Agregar a defaults
const DEFAULT_SETTINGS: DovelaPluginData = {
    // ... existente
    customTags: []
};
```

#### 4.2 Verificar No Romper Código Existente

**Checklist:**
- [ ] ¿Modifiqué interfaces compartidas? → Verificar todos los usos
- [ ] ¿Cambié firmas de métodos públicos? → Verificar llamadas
- [ ] ¿Agregué dependencias nuevas? → Actualizar package.json
- [ ] ¿Modifiqué data.json structure? → Considerar migración

---

### Fase 5: Testing y Validación

#### 5.1 Compilación

```bash
# SIEMPRE compilar antes de reportar
npm run dev

# Si hay errores, resolverlos TODOS antes de continuar
```

**Errores comunes:**
- Imports sin extensión `.js`
- Tipos any implícitos
- Variables no usadas
- Métodos no implementados de interfaces

#### 5.2 Testing Manual (por Claude)

**Checklist básico:**
- [ ] El código compila sin errores ni warnings
- [ ] La vista se abre correctamente (si aplica)
- [ ] Los eventos funcionan (clicks, inputs)
- [ ] Los datos se persisten en data.json (si aplica)
- [ ] No hay errores en la consola del desarrollador
- [ ] La funcionalidad cumple el requerimiento básico

#### 5.3 Testing de Integración (por Claude)

**Verificar:**
- [ ] ¿Afecta módulo GTD? → Probar vista GTD
- [ ] ¿Afecta módulo Foco? → Probar vista Foco
- [ ] ¿Modifica parsers? → Verificar que no rompe parsing existente
- [ ] ¿Usa servicios compartidos? → Verificar sincronización entre vistas

#### 5.4 Protocolo de Pruebas de Aceptación (por el Usuario)

⚠️ **IMPORTANTE:** Las pruebas de aceptación las ejecuta el USUARIO, no Claude.

**División de Responsabilidades:**

**Claude es responsable de:**
1. Proponer protocolo de pruebas adaptado al desarrollo
2. Generar tareas de ejemplo para testing (listas para copiar/pegar)
3. Definir casos de prueba normales (mínimo 3, máximo 10)
4. Definir casos edge case (mínimo 2)
5. Documentar resultados esperados para cada caso
6. Esperar confirmación del usuario antes de marcar como completado

**Usuario es responsable de:**
1. Ejecutar las pruebas propuestas
2. Reportar resultados (✅ PASS / ❌ FAIL)
3. Identificar problemas encontrados
4. Aprobar funcionalidad o solicitar correcciones

---

**Estructura del Protocolo:**

Claude debe generar un protocolo adaptado al tipo de desarrollo siguiendo esta estructura:

```markdown
## 📋 Protocolo de Pruebas: [Nombre del Feature]

### 1. Tareas de Ejemplo para Testing

**Por favor, crea un archivo de prueba con las siguientes tareas:**

[Markdown listo para copiar/pegar con tareas que cubran:]
- Casos normales (escenarios esperados)
- Casos con características especiales (contextos, fechas, etc.)
- Casos edge case (formato irregular, datos extremos, etc.)

### 2. Casos de Prueba a Ejecutar

**CP-01: [Descripción]**
- Objetivo: [Qué verifica]
- Pasos: [1, 2, 3...]
- Resultado Esperado: [Qué debería pasar]
- Instrucciones: [Qué verificar específicamente]

[Repetir para cada caso - cantidad varía según complejidad]

### 3. Escenarios Edge Case

**EC-01: [Nombre]**
- Prueba: [Qué hacer]
- Esperado: [Comportamiento correcto]

[Mínimo 2 edge cases]

### 4. Checklist de Validación

[Lista de verificación específica del desarrollo]

---

**Por favor, ejecuta estas pruebas y reporta:**
- ✅ Qué casos pasaron
- ❌ Qué casos fallaron (con descripción)
- 🐛 Cualquier bug o comportamiento inesperado

*Esperaré tu confirmación antes de marcar como completado.*
```

---

**Adaptación por Tipo de Desarrollo:**

**Vista Nueva:**
- Casos: Apertura, renderizado, eventos (clicks, inputs), cierre
- Edge: Resize window, múltiples instancias, datos vacíos
- Cantidad sugerida: 4-6 casos normales, 2-3 edge cases

**Servicio Nuevo:**
- Casos: Métodos públicos, persistencia, sincronización vistas
- Edge: Datos inválidos, concurrencia, rollback
- Cantidad sugerida: 5-7 casos normales, 3-4 edge cases

**Parser Nuevo:**
- Casos: Formatos válidos, extracción correcta, diferentes símbolos
- Edge: Formato incorrecto, líneas vacías, caracteres especiales
- Cantidad sugerida: 6-8 casos normales, 4-5 edge cases

**Modal Nuevo:**
- Casos: Apertura, submit, cancelación, validación
- Edge: Campos vacíos, submit múltiple, escape key
- Cantidad sugerida: 3-5 casos normales, 2-3 edge cases

---

**Ejemplo de Protocolo Completo:**

Ver archivo `CLAUDE.md` líneas 364-519 para ejemplo completo del sistema Weekly con:
- 17 tareas de ejemplo listas para copiar
- 5 casos de prueba normales detallados
- 4 escenarios edge case
- Checklist de validación de 11 items

---

### Fase 6: Documentación y Reporte

#### 6.1 Actualizar Documentación

**Si agregaste una feature significativa:**
- Actualizar README.md con descripción
- Agregar ejemplos de uso
- Documentar configuraciones nuevas

**Si modificaste APIs:**
- Documentar cambios en interfaces públicas
- Agregar JSDoc comments

#### 6.2 Reporte al Usuario

Claude debe entregar un reporte completo:

```markdown
## ✅ Desarrollo Completado: [Nombre del Feature]

### Resumen
[Descripción breve de qué se implementó y por qué]

### Archivos Creados
- `src/modules/[modulo]/[archivo1].ts` - [Propósito]
- `src/modules/[modulo]/[archivo2].ts` - [Propósito]

### Archivos Modificados
- `src/main.ts:123` - Registro de TagFilterService
- `src/modules/moduloGTDv3/model.ts:45` - Agregado campo customTags

### Funcionalidades Implementadas
1. **Extracción de Tags**: Parser ahora reconoce #tag-nombre
2. **Filtrado UI**: Dropdown en GtdView para filtrar por tag
3. **Persistencia**: Tags se guardan en data.json

### Cómo Usar
1. En cualquier tarea, agregar `#tag-importante`
2. Abrir vista GTD
3. Usar dropdown "Filtrar por Tag" → seleccionar "importante"
4. Solo tareas con ese tag se muestran

### Testing Realizado
- ✅ Compilación exitosa (0 errores)
- ✅ Parser extrae tags correctamente
- ✅ UI de filtrado funciona
- ✅ Datos persisten en data.json
- ✅ No rompe código existente

### Próximos Pasos (Opcional)
- [ ] Agregar filtrado por múltiples tags simultáneos
- [ ] Exportar lista de todos los tags usados
```

---

### Fase 7: Control de Versiones (Commits)

#### 7.1 Cuándo Crear Commits

Después de:
- Completar una funcionalidad completa
- Testing de aceptación exitoso (confirmado por usuario)
- Cuando el usuario lo solicite explícitamente

#### 7.2 Tres Escenarios de Commit

Claude debe reconocer y manejar tres escenarios basados en el prompt del usuario:

**Escenario A: Commit Normal**
- **Situación**: Desarrollo incremental, Claude sabe exactamente qué cambió
- **Proceso**: Recordar sesión → Crear mensaje → Aprobar → Commit con archivo temporal
- **Ver**: `CLAUDE.md` líneas 569-669 para proceso completo

**Escenario B: Commit con Verificación Diferencial**
- **Situación**: Sesión larga, incertidumbre sobre cambios anteriores
- **Proceso**: `git diff HEAD` → Analizar → Listar cambios → Mensaje → Aprobar → Commit
- **Ver**: `CLAUDE.md` líneas 673-732 para proceso completo

**Escenario C: Funcionalidad Nueva en Nueva Rama**
- **Situación**: Feature completamente nuevo que merece rama separada
- **Proceso**: Diferencial → Proponer rama + mensaje → Aprobar → Crear rama → Commit
- **Ver**: `CLAUDE.md` líneas 736-830 para proceso completo

#### 7.3 Estructura del Mensaje de Commit

**Formato estándar:**
```
<type>(<scope>): <título descriptivo>

<cuerpo detallado con bullets>

Archivos creados:
- [lista]

Archivos modificados:
- [lista con líneas modificadas]
```

**Types:**
- `feat`: Nueva funcionalidad
- `fix`: Corrección de bugs
- `refactor`: Refactorización
- `docs`: Solo documentación
- `style`: Formato/estilo
- `test`: Tests

**Ejemplo:**
```
feat(weekly): ordenamiento inteligente de tareas vencidas

- Agregado método sortTasksByWeekPriority()
- Ordenamiento por año → semana → prioridad
- Manejo de 1 y 2 dígitos (W5, W43)
- Navegación en nueva pestaña
- Documentación actualizada

Archivos modificados:
- src/modules/moduloWeekly/weeklyTaskRenderer.ts:214,337-385
- src/modules/moduloWeekly/weeklyAPI.ts:217
- Documentacion/Weekly-Sistema-Tareas-Semanales.md:37-50
```

#### 7.4 Proceso Técnico de Commit

**SIEMPRE usar archivo temporal para evitar problemas con caracteres especiales:**

```bash
# 1. Crear archivo temporal
cat > /tmp/commit_message.txt << 'EOF'
[mensaje del commit]
EOF

# 2. Stage archivos relevantes
git add [archivos específicos]

# 3. Commit usando archivo temporal
git commit -F /tmp/commit_message.txt

# 4. Limpiar
rm /tmp/commit_message.txt

# 5. Verificar
git log -1 --abbrev-commit --pretty=medium
```

#### 7.5 Checklist Pre-Commit

Claude DEBE verificar antes de proponer commit:

- [ ] Código compila (`npm run dev`)
- [ ] TODOs marcados como completed
- [ ] Testing de aceptación aprobado por usuario
- [ ] No hay `console.log` en código final
- [ ] Mensaje en español, descriptivo
- [ ] No incluir: data.json, .env, node_modules, archivos de prueba

#### 7.6 IMPORTANTE

- ❌ Claude NUNCA hace `git push` sin autorización explícita
- ✅ Claude SIEMPRE usa archivo temporal
- ✅ Claude SIEMPRE verifica con `git log -1`
- ✅ Claude ESPERA aprobación antes de ejecutar

**Ver documentación completa con ejemplos en:** `CLAUDE.md` líneas 558-866

---

## Ejemplos Completos

### Ejemplo 1: Agregar Nueva Vista Simple

**Requerimiento:** "Quiero una vista que muestre solo tareas bloqueadas por dependencias"

**Paso a Paso:**

**1. Planificación (TODOs):**
```
[ ] Diseñar estructura de BlockedTasksView
[ ] Crear blockedTasksView.ts
[ ] Filtrar tareas con dependencias no resueltas
[ ] Registrar vista en main.ts
[ ] Testing manual
```

**2. Diseño:**
```typescript
// blockedTasksModel.ts
export interface BlockedTask extends Task {
    unresolvedDependencies: string[];
}

// blockedTasksView.ts
export class BlockedTasksView extends ItemView {
    // ... estructura estándar de vista
}
```

**3. Implementación:**
```typescript
// src/modules/moduloGTDv3/blockedTasksView.ts
import { ItemView, WorkspaceLeaf } from 'obsidian';
import type { DovelaPersonalManagementPlugin } from '../../main.js';
import { parseVault } from './parser.js';
import { hasUnresolvedDependencies } from './dependencyUtils.js';

export const BLOCKED_TASKS_VIEW_TYPE = 'blocked-tasks-view';

export class BlockedTasksView extends ItemView {
    private plugin: DovelaPersonalManagementPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: DovelaPersonalManagementPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string { return BLOCKED_TASKS_VIEW_TYPE; }
    getDisplayText(): string { return 'Tareas Bloqueadas'; }
    override getIcon(): string { return 'blocks'; }

    override async onOpen() {
        await this.drawView();
    }

    override async onClose() {
        this.contentEl.empty();
    }

    private async drawView() {
        const { vault, metadataCache } = this.plugin.app;
        const { allTasks } = await parseVault(vault, metadataCache);

        const blockedTasks = allTasks.filter(task =>
            hasUnresolvedDependencies(task, allTasks)
        );

        this.contentEl.empty();
        this.contentEl.addClass('blocked-tasks-view');

        const header = this.contentEl.createEl('h2', {
            text: 'Tareas Bloqueadas'
        });

        if (blockedTasks.length === 0) {
            this.contentEl.createEl('p', {
                text: '¡No hay tareas bloqueadas!'
            });
            return;
        }

        const list = this.contentEl.createEl('ul');
        blockedTasks.forEach(task => {
            const item = list.createEl('li');
            item.createEl('span', { text: task.content });
            item.createEl('small', {
                text: ` (Bloqueada por ${task.dependencies.length} tareas)`
            });
        });
    }
}
```

**4. Integración en main.ts:**
```typescript
import { BlockedTasksView, BLOCKED_TASKS_VIEW_TYPE } from './modules/moduloGTDv3/blockedTasksView.js';

// En onload()
this.registerView(
    BLOCKED_TASKS_VIEW_TYPE,
    (leaf) => new BlockedTasksView(leaf, this)
);

this.addCommand({
    id: 'open-blocked-tasks',
    name: 'Abrir Tareas Bloqueadas',
    callback: () => this.activateView(BLOCKED_TASKS_VIEW_TYPE)
});
```

**5. Testing:**
```bash
npm run dev
# Abrir Obsidian → Command Palette → "Abrir Tareas Bloqueadas"
# Verificar que muestra tareas con dependencias no resueltas
```

---

### Ejemplo 2: Agregar Nuevo Servicio

**Requerimiento:** "Quiero exportar time logs a CSV"

**Paso a Paso:**

**1. TODOs:**
```
[ ] Crear exportService.ts
[ ] Implementar método exportToCsv()
[ ] Agregar botón de export en StatisticsView
[ ] Testing manual
```

**2. Implementación:**
```typescript
// src/modules/moduloGTDv3/exportService.ts
import type { DovelaPersonalManagementPlugin } from '../../main.js';
import type { TimeLogEntry } from './model.js';
import { Notice } from 'obsidian';

export class ExportService {
    constructor(private plugin: DovelaPersonalManagementPlugin) {}

    async exportTimeLogsToCsv(): Promise<void> {
        const timeLogs = this.plugin.data.timeLogs;

        if (timeLogs.length === 0) {
            new Notice('No hay registros para exportar');
            return;
        }

        // Generar CSV
        const headers = 'ID,Fecha,Proyecto,Tarea,Duración,Notas\n';
        const rows = timeLogs.map(log =>
            `${log.id},${log.date},${log.project || ''},${log.taskDescription},${log.duration},${log.notes || ''}`
        ).join('\n');

        const csv = headers + rows;

        // Guardar archivo
        const fileName = `time-logs-${new Date().toISOString().split('T')[0]}.csv`;
        await this.plugin.app.vault.create(fileName, csv);

        new Notice(`Exportado: ${fileName}`);
    }
}
```

**3. Integración:**
```typescript
// En main.ts
public exportService!: ExportService;

// En onload()
this.exportService = new ExportService(this);

// En statisticsView.ts
const exportButton = container.createEl('button', { text: 'Exportar CSV' });
exportButton.addEventListener('click', async () => {
    await this.plugin.exportService.exportTimeLogsToCsv();
});
```

---

## Troubleshooting

### Problema: "Cannot find module './model.js'"

**Causa:** Olvidaste la extensión `.js` en el import

**Solución:**
```typescript
// ❌ Mal
import { Task } from './model';

// ✅ Bien
import { Task } from './model.js';
```

---

### Problema: "Property 'X' does not exist on type 'DovelaPluginData'"

**Causa:** Agregaste un nuevo campo a data pero no actualizaste la interface

**Solución:**
```typescript
// 1. Actualizar interface
export interface DovelaPluginData {
    // ... existente
    newField?: NewFieldType;
}

// 2. Actualizar defaults
const DEFAULT_SETTINGS: DovelaPluginData = {
    // ... existente
    newField: defaultValue
};
```

---

### Problema: "La vista no se abre al ejecutar el comando"

**Checklist:**
1. ¿Registraste la vista con `registerView()`?
2. ¿El VIEW_TYPE es único?
3. ¿Creaste el comando con `addCommand()`?
4. ¿El callback llama a `activateView()` correctamente?

---

### Problema: "Los cambios no se persisten después de recargar"

**Causa:** Olvidaste llamar a `savePluginData()`

**Solución:**
```typescript
// Después de CUALQUIER modificación a plugin.data
this.plugin.data.something = newValue;
await this.plugin.savePluginData(); // ← CRÍTICO
```

---

### Problema: "Errores de TypeScript que no entiendo"

**Pasos:**
1. Leer el error completo (no solo la primera línea)
2. Verificar que todos los imports tengan `.js`
3. Verificar que las interfaces estén bien definidas
4. Si sigue sin funcionar, preguntar al usuario con el error completo

---

## Mejores Prácticas

### DO ✅

1. **Crear TODOs antes de codificar**
   - Te ayuda a pensar el problema completo
   - El usuario ve el progreso en tiempo real

2. **Leer código existente como referencia**
   - No inventes nuevos patrones
   - Copia estructura de módulos similares

3. **Separar responsabilidades**
   - Model ≠ Service ≠ View
   - Cada archivo tiene un propósito claro

4. **Validar entrada en servicios**
   ```typescript
   if (!data || !data.requiredField) {
       new Notice('Error: datos inválidos');
       return;
   }
   ```

5. **Limpiar recursos en onClose()**
   ```typescript
   override async onClose() {
       this.eventAbortController?.abort();
       this.contentEl.empty();
   }
   ```

6. **Usar event delegation**
   ```typescript
   // ✅ Preferido (un solo listener)
   container.addEventListener('click', (e) => {
       if ((e.target as HTMLElement).matches('.button')) {
           // handle
       }
   });

   // ❌ Evitar (múltiples listeners)
   buttons.forEach(btn => {
       btn.addEventListener('click', () => { ... });
   });
   ```

7. **Compilar antes de reportar**
   - `npm run dev` debe ejecutarse SIN errores
   - No reportes código que no compila

### DON'T ❌

1. **No hardcodear valores**
   ```typescript
   // ❌ Mal
   const workDuration = 25;

   // ✅ Bien
   const workDuration = this.plugin.data.pomodoroSettings.workDuration;
   ```

2. **No dejar console.log en código final**
   - Úsalos para debugging
   - Elimínalos antes de reportar

3. **No ignorar errores de TypeScript**
   - Cada error tiene una razón
   - Resuélvelos todos antes de continuar

4. **No mezclar lógica con rendering**
   ```typescript
   // ❌ Mal
   async drawView() {
       const tasks = await parseVault(...);
       const processed = processGtdLists(tasks);
       const calculated = calculateStats(processed);
       this.contentEl.innerHTML = generateHtml(calculated);
   }

   // ✅ Bien (lógica en servicio, rendering en vista)
   async drawView() {
       const data = await this.gtdService.getProcessedData();
       this.render(data);
   }
   ```

5. **No asumir sin preguntar**
   - Si algo es ambiguo, preguntar
   - Mejor perder 2 minutos preguntando que 2 horas rehaciendo

---

## Conclusión

Este proceso puede parecer tedioso al principio, pero:
- Reduce errores significativamente
- Acelera desarrollo a largo plazo
- Mejora calidad del código
- Facilita mantenimiento futuro

**La clave es seguir el proceso consistentemente, no perfectamente.**

Cada desarrollo que sigue estas guías mejora el proyecto incrementalmente. Con el tiempo, el código legacy se reemplazará con código que sigue mejores prácticas.

---

**Versión: 1.0**
**Última actualización: 2025-10-24**
