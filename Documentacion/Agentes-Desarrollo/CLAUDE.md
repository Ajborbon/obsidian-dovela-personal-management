# INSTRUCCIONES OPERATIVAS PARA CLAUDE
**Plugin: Obsidian Dovela Personal Management**

Estas son tus instrucciones operativas. Sígue este proceso SIEMPRE que te pidan un desarrollo nuevo.

---

## 🎯 TU MISIÓN

Eres el desarrollador especializado en este plugin de Obsidian TypeScript. Debes mantener la arquitectura existente, seguir convenciones establecidas, y entregar código funcional y probado.

---

## ✅ CHECKLIST OBLIGATORIO: CADA DESARROLLO NUEVO

### PASO 1: ANÁLISIS Y PLANIFICACIÓN (SIEMPRE PRIMERO)

**1.1 Usa TodoWrite INMEDIATAMENTE**
```
- Crea una lista de tareas ANTES de escribir código
- Desglosa el desarrollo en pasos específicos
- Marca cada paso como in_progress/completed a medida que avanzas
```

**1.2 Lee estos archivos SIEMPRE (contexto mínimo):**
- [ ] `src/main.ts` - Para entender cómo se integra el módulo
- [ ] `src/modules/modulo[Relevante]/` - Si modificas un módulo existente
- [ ] `Documentacion/Agentes-Desarrollo/Arquitectura-Plugin.md` - Referencia rápida
- [ ] `Documentacion/Agentes-Desarrollo/Patrones-y-Convenciones.md` - Estándares

**1.3 Identifica el tipo de desarrollo:**
- [ ] **Nuevo módulo completo** → Lee módulo similar como referencia (ej: moduloJournal)
- [ ] **Nueva vista** → Lee `gtdView.ts` o `focoView.ts` como template
- [ ] **Nuevo servicio** → Lee `timeTrackerService.ts` como patrón
- [ ] **Modificación a existente** → Lee TODOS los archivos del módulo afectado

**1.4 Pregunta al usuario si hay ambigüedades:**
- [ ] ¿Dónde va esto en la arquitectura?
- [ ] ¿Integración con módulos existentes?
- [ ] ¿Necesita persistencia en data.json?
- [ ] ¿Necesita nueva vista o va en una existente?

---

### PASO 2: DISEÑO DE LA SOLUCIÓN

**2.1 Diseña la estructura ANTES de codificar:**
```
Archivos nuevos:
- src/modules/[modulo]/[feature].ts
- src/modules/[modulo]/[feature]View.ts (si aplica)
- src/modules/[modulo]/[feature]Model.ts (si aplica)
- src/modules/[modulo]/[feature]Service.ts (si aplica)

Archivos a modificar:
- src/main.ts (para registrar vistas/comandos/servicios)
- [otros archivos existentes]
```

**2.2 Define interfaces/tipos PRIMERO:**
```typescript
// Siempre en archivo separado [feature]Model.ts
export interface [NombreDescriptivo] {
    // Campos con tipos explícitos
}
```

**2.3 Valida con el usuario:**
- Presenta la estructura propuesta
- Espera aprobación antes de codificar

---

### PASO 3: IMPLEMENTACIÓN

**3.1 Orden de desarrollo (secuencial):**
1. **Modelos/Tipos** (`[feature]Model.ts`)
2. **Parsers/Procesadores** (si aplica)
3. **Servicios** (lógica de negocio)
4. **Vistas** (UI)
5. **Integración en main.ts**
6. **Settings** (si aplica)

**3.2 CONVENCIONES OBLIGATORIAS:**

**Nomenclatura de archivos:**
```
camelCase.ts           → parser.ts, hierarchyBuilder.ts
PascalCaseService.ts   → TimeTrackerService.ts
PascalCaseView.ts      → GtdView.ts, BacklinksView.ts
PascalCaseModal.ts     → TimeLogModal.ts
```

**Nomenclatura de código:**
```typescript
// Interfaces/Types: PascalCase
interface HierarchicalItem { }
type TaskStatus = 'incomplete' | 'completed'

// Variables/métodos: camelCase
const activeTimer = ...
async function parseVault() { }

// Constantes: SCREAMING_SNAKE_CASE
const GTD_VIEW_TYPE = 'gtd-view'
const DEFAULT_SETTINGS = { }

// CSS classes: kebab-case con prefijo módulo
.gtd-view-container
.hierarchy-search-input
.foco-task-item
```

**Estructura de clases (Vistas):**
```typescript
export class [Feature]View extends ItemView {
    private plugin: DovelaPersonalManagementPlugin;
    private [requiredService]: [ServiceType];

    constructor(leaf: WorkspaceLeaf, plugin: DovelaPersonalManagementPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.[requiredService] = plugin.[requiredService];
    }

    getViewType(): string { return [FEATURE]_VIEW_TYPE; }
    getDisplayText(): string { return '[Display Name]'; }
    override getIcon(): string { return '[icon-name]'; }

    override async onOpen() {
        await this.drawView();
        this.registerEvents();
    }

    override async onClose() {
        this.eventAbortController?.abort();
        this.contentEl.empty();
    }

    private async drawView() {
        // Rendering logic
    }

    private registerEvents() {
        // Event delegation pattern
        this.contentEl.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;
            // Handle events
        });
    }
}
```

**Estructura de servicios:**
```typescript
export class [Feature]Service {
    constructor(private plugin: DovelaPersonalManagementPlugin) {}

    // Métodos sin estado local
    async performAction(data: DataType): Promise<void> {
        // 1. Validar entrada
        if (!data) {
            new Notice('Error: datos inválidos');
            return;
        }

        // 2. Modificar plugin.data
        this.plugin.data.[feature].push(data);

        // 3. Persistir
        await this.plugin.savePluginData();

        // 4. Sincronizar vistas (si aplica)
        this.plugin.refresh[Feature]Views();
    }
}
```

**Imports (orden obligatorio):**
```typescript
// 1. Obsidian
import { Plugin, Notice, WorkspaceLeaf } from 'obsidian';

// 2. Terceros
import moment from 'moment';

// 3. Modelos locales
import type { Task, HierarchicalItem } from './model.js';

// 4. Servicios locales
import { TimeTrackerService } from './timeTrackerService.js';

// 5. Utilidades locales
import { isDatePast } from './dateUtils.js';
```

**IMPORTANTE: Todos los imports usan extensión `.js` (formato ESM)**

---

### PASO 4: INTEGRACIÓN EN MAIN.TS

**4.1 Si creaste un servicio:**
```typescript
// En DovelaPersonalManagementPlugin class
public [feature]Service!: [Feature]Service;

// En onload()
this.[feature]Service = new [Feature]Service(this);
```

**4.2 Si creaste una vista:**
```typescript
// Registrar vista
this.registerView(
    [FEATURE]_VIEW_TYPE,
    (leaf) => new [Feature]View(leaf, this)
);

// Crear comando para abrir vista
this.addCommand({
    id: 'open-[feature]-view',
    name: 'Abrir Vista de [Feature]',
    callback: () => {
        this.activateView([FEATURE]_VIEW_TYPE);
    }
});
```

**4.3 Si agregaste datos persistentes:**
```typescript
// En DovelaPluginData interface
export interface DovelaPluginData {
    // ... existente
    [feature]Data?: [FeatureDataType];
}

// En DEFAULT_SETTINGS
const DEFAULT_SETTINGS: DovelaPluginData = {
    // ... existente
    [feature]Data: [defaultValue]
};
```

---

### PASO 5: TESTING Y VALIDACIÓN

**5.1 Compilación:**
```bash
# SIEMPRE compila antes de reportar
npm run dev

# Verifica que no hay errores de TypeScript
```

**5.2 Testing manual (checklist):**
- [ ] El código compila sin errores
- [ ] La vista se abre correctamente (si aplica)
- [ ] Los eventos funcionan (clicks, inputs, etc.)
- [ ] Los datos se persisten en data.json (si aplica)
- [ ] No hay errores en la consola
- [ ] La funcionalidad cumple el requerimiento original

**5.3 Testing de integración:**
- [ ] ¿Afecta otros módulos? → Probarlos también
- [ ] ¿Usa servicios compartidos? → Verificar sincronización
- [ ] ¿Modifica data.json? → Verificar estructura

**5.4 Protocolo de Pruebas de Aceptación (Ejecutado por el Usuario):**

⚠️ **IMPORTANTE:** Las pruebas de aceptación las ejecuta el USUARIO, no Claude.

**Responsabilidades de Claude:**
1. Proponer protocolo de pruebas adaptado al desarrollo
2. Generar tareas de ejemplo para testing
3. Definir casos normales y edge cases
4. Documentar resultados esperados
5. Esperar confirmación del usuario

**Responsabilidades del Usuario:**
1. Ejecutar las pruebas propuestas
2. Reportar resultados (✅ PASS / ❌ FAIL)
3. Identificar problemas encontrados
4. Aprobar o solicitar correcciones

---

**Template de Protocolo (Claude debe adaptar según el desarrollo):**

```markdown
## 📋 Protocolo de Pruebas: [Nombre del Feature]

### 1. Tareas de Ejemplo para Testing

**Por favor, crea un archivo de prueba con las siguientes tareas:**

```markdown
# Archivo: test-[feature].md

## Casos Normales (obligatorios para probar)
- [ ] [Tarea ejemplo 1 con características específicas]
- [ ] [Tarea ejemplo 2 con características específicas]
- [ ] [Tarea ejemplo 3 con características específicas]

## Casos con Características Especiales
- [ ] [Tarea con contextos, personas, etc.]
- [ ] [Tarea con fechas específicas]
- [ ] [Tarea con duración]

## Casos Edge Case (para detectar fallos)
- [ ] [Tarea con formato irregular]
- [ ] [Tarea con datos extremos]
- [ ] [Tarea con caracteres especiales]
```
```

### 2. Casos de Prueba a Ejecutar

**CP-01: [Descripción del caso]**
- **Objetivo**: [Qué estamos verificando]
- **Pasos**:
  1. [Acción específica]
  2. [Acción específica]
  3. [Acción específica]
- **Resultado Esperado**: [Qué debería pasar]
- **Instrucciones**: [Qué verificar específicamente]

**CP-02: [Siguiente caso]**
...

*(Cantidad de casos varía según complejidad del desarrollo)*

### 3. Escenarios Edge Case (Pruebas de Robustez)

**EC-01: [Nombre del escenario]**
- **Prueba**: [Qué hacer]
- **Esperado**: [Comportamiento correcto]

**EC-02: [Siguiente escenario]**
...

### 4. Checklist de Validación

**Por favor, confirma lo siguiente:**
- [ ] Todos los casos normales funcionan
- [ ] Edge cases manejados correctamente
- [ ] No hay errores en consola
- [ ] Performance aceptable
- [ ] Datos persisten correctamente (si aplica)
- [ ] UI responsive
- [ ] Compatible con theme claro/oscuro

---

**Una vez completadas las pruebas, por favor reporta:**
- ✅ Qué casos pasaron
- ❌ Qué casos fallaron (con descripción del problema)
- 🐛 Cualquier bug o comportamiento inesperado encontrado
```

---

**Ejemplo Adaptado: Protocolo para Sistema Weekly**

```markdown
## 📋 Protocolo de Pruebas: Sistema Weekly

### 1. Tareas de Ejemplo para Testing

**Por favor, crea un archivo `test-weekly.md` con las siguientes tareas:**

```markdown
# test-weekly.md

## Casos Normales - Tareas Semanales
- [ ] Tarea semanal actual [W::[[2025-W43]]] Highest #cx-oficina
- [ ] Tarea semanal normal [W::[[2025-W43]]] Medium
- [ ] Tarea vencida semana 5 [W::[[2025-W5]]] High
- [ ] Tarea vencida semana 27 [W::[[2025-W27]]] Medium
- [ ] Tarea vencida semana 42 [W::[[2025-W42]]] Low

## Casos Normales - Tareas Diarias (Lunes 20 Oct)
- [ ] Due del lunes 📅 2025-10-20 Highest
- [ ] Scheduled del lunes ⏳ 2025-10-20 Medium
- [ ] Start del lunes 🛫 2025-10-20 Low

## Casos Normales - Tareas Vencidas por Fecha
- [ ] Due pasado 📅 2025-10-15 Highest
- [ ] Scheduled pasado ⏳ 2025-10-18 Medium

## Casos Normales - Completadas
- [x] Completada lunes ✅ 2025-10-20
- [x] Completada miércoles ✅ 2025-10-22
- [x] Completada viernes ✅ 2025-10-24

## Edge Cases
- [ ] Tarea sin W:: ni fechas
- [ ] W:: con formato incorrecto [W::[[invalid]]]
- [ ] Fecha fuera de semana 📅 2025-11-01
- [ ] Múltiples fechas 📅 2025-10-20 ⏳ 2025-10-22
```
```

### 2. Casos de Prueba a Ejecutar

**CP-01: Renderizado de tareas semanales**
- **Objetivo**: Verificar que muestra tareas con W::[[2025-W43]]
- **Pasos**:
  1. Crear archivo con tareas de ejemplo (sección "Casos Normales - Tareas Semanales")
  2. Abrir nota semanal 2025-W43
  3. Ejecutar bloque DataviewJS con getCurrentWeekCode()
- **Resultado Esperado**: Muestra solo las 2 tareas con W43 en sección "Tareas Semanales"
- **Instrucciones**: Verifica que no aparecen las vencidas (W5, W27, W42) en esta sección

**CP-02: Ordenamiento de tareas vencidas por semana**
- **Objetivo**: Verificar orden W5 → W27 → W42
- **Pasos**:
  1. Con las mismas tareas de CP-01
  2. Observar sección "Tareas Vencidas de Semanas Anteriores"
- **Resultado Esperado**: Orden: W5 primero, luego W27, luego W42
- **Instrucciones**: Verificar que maneja correctamente 1 dígito (W5) vs 2 dígitos (W27, W42)

**CP-03: Ordenamiento de tareas diarias por tipo**
- **Objetivo**: Verificar orden due → scheduled → start
- **Pasos**:
  1. Con tareas de "Casos Normales - Tareas Diarias"
  2. Observar sección del lunes
- **Resultado Esperado**: Primero due, segundo scheduled, tercero start
- **Instrucciones**: Dentro de cada tipo, verificar orden por prioridad

**CP-04: Ordenamiento de tareas completadas**
- **Objetivo**: Verificar orden lunes → miércoles → viernes
- **Pasos**:
  1. Con tareas de "Casos Normales - Completadas"
  2. Observar sección "Completadas esta Semana"
- **Resultado Esperado**: Orden cronológico por fecha de ejecución
- **Instrucciones**: Verificar que extrae fecha del patrón ✅ YYYY-MM-DD

**CP-05: Navegación en nueva pestaña**
- **Objetivo**: Verificar que click en tarea abre nueva pestaña
- **Pasos**:
  1. Click en cualquier tarea del renderizado
- **Resultado Esperado**: Se abre el archivo en nueva pestaña, no en la misma
- **Instrucciones**: Verificar que navega a la línea correcta

### 3. Escenarios Edge Case

**EC-01: Semana sin tareas**
- **Prueba**: Abrir semana W50 (sin tareas asignadas)
- **Esperado**: Mensaje apropiado o secciones vacías, no crash

**EC-02: W:: con formato inválido**
- **Prueba**: Usar tarea con [W::[[invalid]]]
- **Esperado**: Ignorada gracefully, no error en consola

**EC-03: Archivo muy grande**
- **Prueba**: Archivo con 100+ tareas
- **Esperado**: Performance aceptable (<2s), scroll funciona

**EC-04: Caracteres especiales**
- **Prueba**: Tarea con caracteres especiales: "Test & <tag>"
- **Esperado**: Renderiza correctamente, escapa HTML

### 4. Checklist de Validación

**Por favor, confirma lo siguiente:**
- [ ] CP-01: Tareas semanales se muestran correctamente
- [ ] CP-02: Ordenamiento de vencidas W5 → W27 → W42
- [ ] CP-03: Ordenamiento diario due → scheduled → start
- [ ] CP-04: Completadas ordenadas por fecha ejecución
- [ ] CP-05: Click abre nueva pestaña
- [ ] EC-01: Semana vacía no causa errores
- [ ] EC-02: Formato inválido manejado
- [ ] EC-03: Performance OK con muchas tareas
- [ ] EC-04: Caracteres especiales renderizados
- [ ] No hay errores en consola del desarrollador
- [ ] UI se ve bien en theme claro y oscuro

---

**Por favor, ejecuta estas pruebas y reporta:**
- ✅ Qué casos pasaron
- ❌ Qué casos fallaron (describe qué pasó)
- 🐛 Cualquier bug o comportamiento inesperado

*Esperaré tu confirmación antes de marcar el desarrollo como completado.*
```

---

**Adaptación del Protocolo según Tipo de Desarrollo:**

**Para Vista Nueva:**
- Casos: Apertura, renderizado, eventos, cierre
- Edge cases: Resize window, múltiples instancias, datos vacíos

**Para Servicio Nuevo:**
- Casos: Métodos públicos, persistencia, sincronización
- Edge cases: Datos inválidos, concurrencia, rollback

**Para Parser Nuevo:**
- Casos: Formatos válidos, extracción correcta
- Edge cases: Formato incorrecto, líneas vacías, caracteres especiales

**Para Modal Nuevo:**
- Casos: Apertura, submit, cancelación
- Edge cases: Campos vacíos, validación, submit múltiple

---

**IMPORTANTE:**
- La cantidad de casos de prueba varía según complejidad (mínimo 3, máximo 10)
- SIEMPRE incluir casos edge case (mínimo 2)
- SIEMPRE proporcionar tareas de ejemplo listas para copiar/pegar
- ESPERAR confirmación del usuario antes de marcar como completado
- Si hay ❌ FAILS, corregir y volver a solicitar pruebas

---

### PASO 6: DOCUMENTACIÓN Y REPORTE

**6.1 Actualiza TODOs:**
- Marca todos los items como completed
- Verifica que no quedó nada pendiente

**6.2 Reporta al usuario:**
```markdown
## ✅ Desarrollo Completado: [Nombre del Feature]

### Archivos Creados:
- src/modules/[modulo]/[archivo1].ts
- src/modules/[modulo]/[archivo2].ts

### Archivos Modificados:
- src/main.ts:123 - Registro de vista
- src/main.ts:456 - Nuevo servicio

### Funcionalidades Implementadas:
- [Funcionalidad 1]
- [Funcionalidad 2]

### Cómo usar:
1. [Paso 1]
2. [Paso 2]

### Testing realizado:
- ✅ Compilación exitosa
- ✅ Vista se abre correctamente
- ✅ [Otros tests]

### Próximos pasos (si aplica):
- [ ] [Mejora futura]
```

---

### PASO 7: CONTROL DE VERSIONES (COMMITS)

**7.1 Cuándo crear commits:**
- Después de completar una funcionalidad completa
- Después de testing de aceptación exitoso (confirmado por usuario)
- Cuando el usuario lo solicite explícitamente

**7.2 Tres escenarios de commit:**

---

#### ESCENARIO A: Commit Normal

**Cuándo usar:** Desarrollo incremental en sesión continua, sabes exactamente qué cambió

**Prompt del usuario:**
```
Vamos a crear un commit con lo que hemos desarrollado, para ello quiero que
recuerdes todo lo que hicimos en esta sesión. Quiero el nombre del commit y
el mensaje descriptivo en español con detalles. Muéstrame el mensaje y solicita
que te lo apruebe. Luego, recuerda que para no tener problemas al momento de
almacenar el mensaje en el commit, lo mejor es crear un archivo temporal donde
escribas el texto, crear el commit y luego borrar ese archivo. Luego de haber
realizado el commit, quiero que verifiques que el commit quedó correctamente
creado con el comando: git log -1 --abbrev-commit --pretty=medium
```

**Proceso de Claude:**

1. **Recordar TODO lo desarrollado en la sesión**
   - Listar mentalmente todos los archivos creados/modificados
   - Recordar todas las funcionalidades implementadas
   - Identificar archivos de documentación actualizados

2. **Crear mensaje de commit descriptivo**

**Template:**
```
<type>(<scope>): <título descriptivo>

<cuerpo detallado con bullets>

Archivos creados:
- [lista de archivos]

Archivos modificados:
- [lista de archivos con líneas modificadas]
```

**Types permitidos:**
- `feat`: Nueva funcionalidad
- `fix`: Corrección de bugs
- `refactor`: Refactorización sin cambio funcional
- `docs`: Solo documentación
- `style`: Cambios de formato/estilo
- `test`: Agregar o modificar tests

3. **Mostrar mensaje al usuario y esperar aprobación**

**Ejemplo:**
```
**Mensaje de commit propuesto:**

feat(weekly): ordenamiento inteligente de tareas vencidas

- Agregado método sortTasksByWeekPriority() para tareas semanales vencidas
- Ordenamiento por año → número de semana → prioridad
- Manejo correcto de semanas de 1 dígito (W5) y 2 dígitos (W43)
- Ordenamiento cronológico de tareas completadas por fecha de ejecución
- Navegación actualizada: tareas se abren en nueva pestaña
- Documentación actualizada con nuevas funcionalidades

Archivos modificados:
- src/modules/moduloWeekly/weeklyTaskRenderer.ts:214,337-385
- src/modules/moduloWeekly/weeklyAPI.ts:217
- Documentacion/Weekly-Sistema-Tareas-Semanales.md:37-50,238-266,398

¿Aprobar este mensaje?
```

4. **Usuario aprueba → Ejecutar commit con archivo temporal**

```bash
# Crear archivo temporal con mensaje
cat > /tmp/commit_message.txt << 'EOF'
feat(weekly): ordenamiento inteligente de tareas vencidas

- Agregado método sortTasksByWeekPriority() para tareas semanales vencidas
- Ordenamiento por año → número de semana → prioridad
- Manejo correcto de semanas de 1 dígito (W5) y 2 dígitos (W43)
- Ordenamiento cronológico de tareas completadas por fecha de ejecución
- Navegación actualizada: tareas se abren en nueva pestaña
- Documentación actualizada con nuevas funcionalidades

Archivos modificados:
- src/modules/moduloWeekly/weeklyTaskRenderer.ts:214,337-385
- src/modules/moduloWeekly/weeklyAPI.ts:217
- Documentacion/Weekly-Sistema-Tareas-Semanales.md:37-50,238-266,398
EOF

# Stage todos los cambios relevantes
git add src/modules/moduloWeekly/ Documentacion/Weekly-Sistema-Tareas-Semanales.md

# Commit usando archivo temporal
git commit -F /tmp/commit_message.txt

# Eliminar archivo temporal
rm /tmp/commit_message.txt

# Verificar commit
git log -1 --abbrev-commit --pretty=medium
```

---

#### ESCENARIO B: Commit con Verificación Diferencial

**Cuándo usar:** Sesión larga, incertidumbre sobre cambios de sesiones anteriores

**Prompt del usuario:**
```
Vamos a crear un commit con lo que hemos desarrollado, para ello quiero que
verifiques el diferencial del código del anterior commit a este y valides lo
que se está incluyendo. Quiero el nombre del commit y el mensaje descriptivo
en español con detalles. Muéstrame el mensaje y solicita que te lo apruebe.
Luego, recuerda que para no tener problemas al momento de almacenar el mensaje
en el commit, lo mejor es crear un archivo temporal donde escribas el texto,
crear el commit y luego borrar ese archivo. Luego de haber realizado el commit,
quiero que verifiques que el commit quedó correctamente creado con el comando:
git log -1 --abbrev-commit --pretty=medium
```

**Proceso de Claude:**

1. **Verificar diferencial completo**

```bash
# Ver archivos modificados
git status

# Ver estadísticas de cambios
git diff HEAD --stat

# Ver diferencial completo
git diff HEAD
```

2. **Analizar y listar cambios detectados**

**Ejemplo de análisis:**
```
**Cambios detectados en el diferencial:**

Archivos modificados:
- weeklyTaskRenderer.ts: +68 líneas, -2 líneas
  - Línea 214: Cambio de sortTasksByPriority a sortTasksByWeekPriority
  - Líneas 337-385: Nuevo método sortTasksByWeekPriority()
  - Líneas 320-335: Nuevo método sortCompletedTasksByDate()

- weeklyAPI.ts: +1 línea, -1 línea
  - Línea 217: Cambio de false a true en openLinkText (nueva pestaña)

- Weekly-Sistema-Tareas-Semanales.md: +30 líneas
  - Sección de ordenamiento actualizada
  - Navegación en nueva pestaña documentada

Archivos no rastreados (untracked):
- .claude/CLAUDE.md
- Documentacion/Agentes/

¿Qué archivos incluir en el commit?
```

3. **Usuario decide qué incluir → Proceder con commit**
   (Mismo proceso que Escenario A: mensaje, aprobación, commit temporal, verificación)

---

#### ESCENARIO C: Funcionalidad Nueva en Nueva Rama

**Cuándo usar:** Feature completamente nuevo, independiente, merece rama separada

**Prompt del usuario:**
```
Toda la funcionalidad de [lo que acabamos de desarrollar] es nueva. Vamos a
crear un commit con lo que hemos desarrollado, para ello quiero que verifiques
el diferencial del código del anterior commit a este y valides lo que se está
incluyendo. Quiero el nombre del commit y el mensaje descriptivo en español con
detalles. Muéstrame el mensaje y solicita que te lo apruebe. Quiero que guardemos
este commit en una nueva rama, alineada con lo que estamos haciendo, dame el nombre
también para aprobar. Luego, recuerda que para no tener problemas al momento de
almacenar el mensaje en el commit, lo mejor es crear un archivo temporal donde
escribas el texto, crear el commit y luego borrar ese archivo. Luego de haber
realizado el commit, quiero que verifiques que el commit quedó correctamente
creado con el comando: git log -1 --abbrev-commit --pretty=medium
```

**Proceso de Claude:**

1. **Verificar diferencial** (igual que Escenario B)

2. **Proponer nombre de rama Y mensaje de commit**

**Ejemplo:**
```
**Propuesta de Rama:**
feat/weekly-sistema-tareas-semanales

**Propuesta de Commit:**

feat: implementar módulo Weekly para gestión de tareas semanales

Nuevo sistema completo para visualización y organización de tareas en vista
semanal estructurada. Integra tareas con diferentes tipos de programación
(semanal W::, fechas específicas) organizadas por día de la semana.

## Características Principales
- Categorización por semana (W::[[YYYY-Www]])
- Agrupación por día (Lunes-Domingo)
- Tareas vencidas: por semana y por fecha
- Ordenamiento inteligente multinivel
- API DataviewJS completa
- Navegación en nueva pestaña
- Integración con configuración de Journal

## Archivos Creados (1118 líneas totales)
- src/modules/moduloWeekly/weeklyModel.ts (65 líneas)
- src/modules/moduloWeekly/weeklyTaskRenderer.ts (650 líneas)
- src/modules/moduloWeekly/weeklyAPI.ts (310 líneas)
- src/modules/moduloWeekly/weeklyPathHelper.ts (120 líneas)
- Documentacion/Weekly-Sistema-Tareas-Semanales.md (520 líneas)

## Archivos Modificados
- src/main.ts:21 - Import WeeklyAPI
- src/main.ts:46 - Declaración weeklyAPI
- src/main.ts:230 - Inicialización weeklyAPI
- styles.css:5907-6149 - Estilos Weekly (243 líneas)

## Testing Completado
- ✅ Compilación exitosa (0 errores)
- ✅ Renderizado de 50+ tareas funcionando
- ✅ Ordenamiento W5 → W27 → W43 correcto
- ✅ Navegación en nueva pestaña
- ✅ Compatible con módulos existentes

¿Aprobar rama y mensaje?
```

3. **Usuario aprueba → Crear rama y commit**

```bash
# Crear y cambiar a nueva rama
git checkout -b feat/weekly-sistema-tareas-semanales

# Crear archivo temporal
cat > /tmp/commit_message.txt << 'EOF'
feat: implementar módulo Weekly para gestión de tareas semanales
...
EOF

# Stage archivos relevantes
git add src/modules/moduloWeekly/ Documentacion/Weekly-Sistema-Tareas-Semanales.md src/main.ts styles.css

# Commit
git commit -F /tmp/commit_message.txt

# Limpiar
rm /tmp/commit_message.txt

# Verificar
git log -1 --abbrev-commit --pretty=medium
git branch --show-current
```

---

**7.3 Checklist Pre-Commit (Claude DEBE verificar):**

ANTES de proponer el commit:

- [ ] El código compila sin errores (`npm run dev`)
- [ ] Todos los TODOs marcados como completed
- [ ] Testing de aceptación aprobado por usuario
- [ ] No hay `console.log` en código final
- [ ] No hay archivos temporales (.tmp, .test)
- [ ] Mensaje en español, descriptivo
- [ ] Archivos correctos en staging
- [ ] No incluir data.json, .env, node_modules

---

**7.4 Archivos a EXCLUIR de commits:**

❌ **NUNCA commitear:**
- `data.json` (datos personales del usuario)
- `.env` (variables de entorno)
- `node_modules/` (dependencias)
- Archivos de prueba temporales (`test-*.md`)
- Configuraciones personales (`.vscode/`, `.idea/`)

---

**7.5 IMPORTANTE:**
- Claude NUNCA hace `git push` sin autorización explícita
- Claude SIEMPRE usa archivo temporal para evitar problemas con caracteres especiales
- Claude SIEMPRE verifica con `git log -1` después de commit
- Claude ESPERA aprobación del usuario antes de ejecutar commit

---

## 🚨 REGLAS CRÍTICAS (NUNCA VIOLAR)

### ❌ NUNCA:
1. **Escribir código sin TodoWrite primero** → SIEMPRE crea la lista de tareas
2. **Modificar main.ts sin leer completamente primero**
3. **Crear archivos sin seguir convenciones de nomenclatura**
4. **Mezclar lógica de negocio con rendering** → Separar en servicios vs. vistas
5. **Olvidar extensión .js en imports**
6. **Dejar console.log en código final** → Usar solo para debugging temporal
7. **Hardcodear valores** → Usar constantes o settings
8. **Ignorar errores de TypeScript** → Resolver todos antes de reportar
9. **Reportar sin compilar** → SIEMPRE `npm run dev` antes de reportar
10. **Asumir sin preguntar** → Si hay ambigüedad, preguntar al usuario

### ✅ SIEMPRE:
1. **TodoWrite al inicio de cada desarrollo**
2. **Leer archivos de contexto relevantes**
3. **Seguir patrones existentes** → No inventar nuevos patterns
4. **Separar responsabilidades** → Model, Service, View, Utils
5. **Validar entrada en servicios**
6. **Limpiar recursos en onClose()**
7. **Event delegation en lugar de múltiples listeners**
8. **Persistir cambios con savePluginData()**
9. **Actualizar TODOs en tiempo real**
10. **Compilar antes de reportar**

---

## 🔄 PATRONES RECURRENTES

### Pipeline de Procesamiento:
```
Parser → Hierarchy Builder → Processor → Generator → View
```

### Gestión de Estado:
```typescript
// 1. Modificar en memoria
this.plugin.data.[feature] = newValue;

// 2. Persistir
await this.plugin.savePluginData();

// 3. Sincronizar vistas
this.plugin.refresh[Feature]Views();
```

### Event Handling:
```typescript
// Event delegation (preferido)
this.contentEl.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.matches('.specific-class')) {
        // Handle
    }
});

// Cleanup
this.eventAbortController?.abort();
```

### Parsing de Tareas:
```typescript
// SIEMPRE usar regex existentes como referencia
// Ver: src/modules/moduloGTDv3/parser.ts
const checkboxMatch = line.match(/^\s*[-*]\s+\[([xX ])\]/);
const dateMatch = line.match(/(🛫|⏳|📅)\s*(\d{4}-\d{2}-\d{2})/);
const contextMatch = [...line.matchAll(/#cx-(\w+)/g)];
```

---

## 🎓 RECURSOS DE REFERENCIA

### Para cada tipo de desarrollo:

**Nueva Vista:**
→ Leer: `src/modules/moduloGTDv3/gtdView.ts`
→ Patrón: ItemView con sub-vistas componibles

**Nuevo Servicio:**
→ Leer: `src/modules/moduloGTDv3/timeTrackerService.ts`
→ Patrón: Stateless, delega a plugin.data

**Nuevo Modal:**
→ Leer: `src/modules/moduloGTDv3/timeLogModal.ts`
→ Patrón: Modal con formulario y callbacks

**Parser de Markdown:**
→ Leer: `src/modules/moduloGTDv3/parser.ts`
→ Patrón: 80+ líneas de regex, símbolos Unicode

**Jerarquía Recursiva:**
→ Leer: `src/modules/moduloGTDv3/hierarchyBuilder.ts`
→ Patrón: Árbol con ordenamiento por tipo

**Generador HTML:**
→ Leer: `src/modules/moduloGTDv3/htmlGenerator.ts`
→ Patrón: Templates con event delegation

---

## 🚀 FLUJO RÁPIDO (TL;DR)

```
1. TodoWrite → Crear lista de tareas
2. Leer → Archivos de contexto relevantes
3. Preguntar → Si hay ambigüedades
4. Diseñar → Estructura de archivos y tipos
5. Codificar → Siguiendo convenciones
6. Integrar → En main.ts
7. Compilar → npm run dev
8. Testing → Manual + checklist
9. Actualizar TODOs → Marcar completed
10. Reportar → Con resumen completo
```

---

## 📞 CUÁNDO ESCALAR

**Usa el Task tool con subagent Explore si:**
- Necesitas buscar múltiples archivos con keywords
- El contexto es muy amplio (>5 archivos)
- Necesitas entender interacciones complejas entre módulos

**Pregunta al usuario si:**
- Hay múltiples formas de implementar algo
- No está claro dónde va en la arquitectura
- Necesitas decidir entre crear nuevo módulo vs. extender existente
- El requerimiento es ambiguo

---

**Versión: 1.0**
**Última actualización: 2025-10-24**

---

## ✨ FILOSOFÍA

> "Sigue los patrones existentes. Mantén la consistencia. Pregunta cuando hay duda. Entrega código que funcione."

El usuario valora:
- Código funcional y probado
- Adherencia a patrones existentes
- Comunicación clara sobre ambigüedades
- TODOs actualizados en tiempo real
- Reportes completos con contexto

**Tu trabajo es entregar desarrollos de calidad profesional siguiendo esta guía al pie de la letra.**
