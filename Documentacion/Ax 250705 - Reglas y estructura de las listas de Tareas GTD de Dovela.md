---
type: Ax
estado: 🟢
tags:
---
## Estructura General del Sistema de Gestión de Tareas GTD

### Clasificación de tareas en listas GTD

El sistema que vamos a crear para gestión de tareas GTD se compone de nueve listas principales que representan diferentes etapas del flujo de trabajo:

### 1. Bandeja de Entrada (Inbox)

**Propósito:** Captura rápida de tareas e ideas que requieren procesamiento posterior.

**Criterios de inclusión:**

- Tareas con el tag `#inbox` explícito
- Tareas sin tags ni metadatos específicos
- Tareas que no clasifican claramente en otras listas
- Tareas parcialmente procesadas pero que necesitan refinamiento

**Casos específicos:**

- Tareas con fecha (🛫/⏳/📅) pero sin contexto ni asignación
- Tareas con formatos incorrectos o conflictivos
- Tareas con semana pasada [w::] pero sin contexto ni asignación
- Tareas cuyos campos de horas [hI::] y [hF::] o [duración] presentan conflictos (ej. hora final anterior a hora inicial)

**Ejemplos:**

```
- [-] Revisar documento del proyecto 🆔 7oZdse
- [-] Pensar ideas para reunión #inbox 🆔 pxTBIa
- [-] Llamar a cliente 📅 2025-03-25 (sin contexto, requiere procesamiento) 🆔 HFUS7o
```

### 2. Próximas Acciones (Next Actions)

**Propósito:** Tareas listas para ser ejecutadas inmediatamente.

**Criterios de inclusión:**

- Tareas con al menos un tag de contexto (#cx-)
- Pueden tener asignación (#px-) simultáneamente
- Tareas con fecha de inicio (🛫) que sea hoy o pasada, con contexto definido
- Tareas con fecha deseada (⏳/📅) que sea hoy o pasada, con contexto definido
- Tareas que tenían dependencias (⛔) y ya se cumplieron, con contexto definido
- Tareas asociadas a una semana [w::] que ya comenzó o es pasada, con contexto definido

**Matices importantes:**

- Las tareas con ambos tags (#cx- y #px-) indican que TÚ debes realizarlas en el contexto indicado
- Aunque la persona (#px-) esté presente, si hay contexto (#cx-), se sitúa aquí y no en Asignadas
- Las tareas de semanas pasadas con contexto se sitúan aquí automáticamente

**Ejemplos:**

```
- [-] #cx-Teléfono llamar a cliente 🆔 7kSPFK
- [-] #cx-Email a #px-Carlos_Martinez sobre proyecto 🆔 BW44iY
- [-] #cx-Casa organizar documentos 🛫 2025-03-20 (fecha pasada) 🆔 uaU8hx
```

### 3. Calendario (Calendar)

**Propósito:** Eventos y compromisos con fecha y hora específica.

**Criterios de inclusión:**

- Tareas con símbolo de fecha (📅) Y campo de hora de inicio [hI::] definido
- Opcional: campo de hora final [hF::] o duración [Xmin]/[Xh]

**Características:**

- REQUISITO OBLIGATORIO: Deben incluir AMBOS elementos:
    
    1. Símbolo 📅 seguido de la fecha (YYYY-MM-DD)
    2. Campo de hora de inicio [hI:: hora]
- **Importante:** Una tarea con 📅 pero sin [hI::] NO pertenece a esta lista, sino a "Ojalá Hoy"
    

**Reglas específicas:**

- Si no se especifica la duración, se asume 30 minutos por defecto
- Si se especifican ambos (hora final y duración) y hay discrepancia, la tarea debe ir a Inbox para revisión
- La hora puede definirse en formato AM/PM o 24h.
- Se puede especificar duración en minutos [60min] o en horas [1h]

**Ejemplos:**

```
- [-] Reunión proyecto web 📅 2025-03-25 [hI:: 10am] [hF:: 11:30am] 🆔 kWmdw9
- [-] Llamada con equipo 📅 2025-03-26 [hI:: 15:00] [1.5h] 🆔 W68XFT
- [-] Recordatorio médico 📅 2025-03-27 [hI:: 9am] (asume 30min) 🆔 GyN5FK
```

### 4. Ojalá Hoy

**Propósito:** Tareas que se desean completar hoy, sin ser obligatorias.

**Criterios de inclusión:**

- Tareas con símbolo ⏳ o 📅 para la fecha actual, sin campo de hora de inicio [hI::]
- Pueden incluir estimación de duración [Xmin]/[Xh]
- Pueden incluir o no contexto. Se deberían agrupar por contexto
- Pueden incluir o no asignación. Se deberían agrupar por persona asignada
- Pueden incluir o no contexto y asignación. Se deberían agrupar por contexto y asignación

**Características:**

- Se indican con CUALQUIERA de estos formatos:
    - Símbolo ⏳ seguido de la fecha (YYYY-MM-DD)
    - Símbolo 📅 seguido de la fecha (YYYY-MM-DD) SIN campo de hora de inicio [hI::]

**Reglas específicas:**

- Las tareas con 📅 tienen mayor prioridad que las que usan ⏳, pero se respetan también las prioridades (⏫ alta, 🔼 media, 🔽 baja, ⏬ la más baja)
- Las tareas de fechas futuras van a "En Pausa"
- Las tareas de fechas pasadas con contexto ó asignación se muestran en una sección de tareas vencidas, organizadas por fecha de vencimiento
- Las tareas de fechas de actual ó pasadas sin contexto ó asignación se muestran en este listado según corresponda, pero también se muestran en Inbox

**Ejemplos:**

```
- [-] Actualizar documentación 📅 2025-03-25 (para hoy, alta prioridad) 🆔 2yTmKN
- [-] Revisar correos pendientes ⏳ 2025-03-25 (para hoy, baja prioridad) 🆔 op1mUs
- [-] Leer artículo nuevo ⏳ 2025-03-25 [45min] (para hoy, con estimación de tiempo) 🆔 N13Fwf
```

### 5. Asignadas o Delegadas

**Propósito:** Tareas que se han delegado a otras personas.

**Criterios de inclusión:**

- Tareas con tag de asignación (#px-) pero SIN tag de contexto (#cx-)
- El tag de asignación puede ser simple (#px-Nombre) o compuesto (#px-Nombre_Empresa)
- Las tareas asignadas pueden tener una fecha límite, que se indica con 📅 seguido de la fecha en formato YYYY-MM-DD

**Reglas específicas:**

- Si la tarea tiene AMBOS (contexto y asignación), va a Next Actions (tú las haces)
- Cuando termina el plazo de la tarea y esta tiene dependientes, el sistema debe alertar para decidir manualmente qué hacer

**Ejemplos:**

```
- [-] #px-Laura_Marketing enviar diseños para revisión 🆔 Nfjb2p
- [-] #px-Carlos seguimiento reunión anterior 🆔 mOSe1I
- [-] #px-Esteban_Contabilidad revisar informe fiscal 📅 2025-03-30 🆔 hPNKPa
```

### 6. Proyectos

**Propósito:** Multi-tareas que requieren planificación y seguimiento.

**Criterios de inclusión:**

- Tareas con contexto #cx-ProyectoGTD o #cx-Entregable
- Representan resultados complejos, no acciones individuales

**Reglas específicas:**

- Al revisar esta lista, se debe definir la siguiente acción concreta
- La siguiente acción debe crearse como tarea independiente

**Ejemplos:**

```
- [-] Desarrollar nueva web #cx-ProyectoGTD 🆔 UVjygT
- [-] Presentación para conferencia #cx-Entregable 🆔 06dsNa
```

### 7. Algún Día / Tal Vez (Someday/Maybe)

**Propósito:** Ideas y deseos sin compromiso inmediato de ejecución.

**Criterios de inclusión:**

- Tareas con el tag #GTD-AlgunDia
- Típicamente sin fechas ni urgencia

**Ejemplos:**

```
- [-] Aprender a programar en Rust #GTD-AlgunDia 🆔 pNBOKS
- [-] Planificar viaje a Japón #GTD-AlgunDia 🆔 0RCOKz
```

### 8. Esta Semana No

**Propósito:** Tareas que se posponen deliberadamente para después de la semana actual.

**Criterios de inclusión:**

- Tareas con el tag #GTD-EstaSemanaNo
- Pueden tener contexto o asignación adicionales

**Ejemplos:**

```
- [-] Revisar nuevo sistema #cx-Computador #GTD-EstaSemanaNo 🆔 N9zvEZ
- [-] #px-Juan_IT actualizar permisos de acceso #GTD-EstaSemanaNo 🆔 a8keuM
```

### 9. En Pausa

**Propósito:** Tareas que no pueden ejecutarse aún debido a condiciones externas.

**Criterios de inclusión:**

1. **Por fecha futura:**
    - Tareas con 🛫 seguido de una fecha futura
    - Una vez llegada la fecha, se mueven a Next Actions o Asignadas
2. **Por dependencia:**
    - Tareas con ⛔ seguido del ID de otra tarea
    - Se mantienen en pausa hasta que la tarea precedente se complete
3. **Por semana futura:**
    - Tareas con [w:: [[YYYY-WXX]]] para semanas aún no iniciadas
    - Al iniciar la semana, pasan a Next Actions o Asignadas según corresponda

**Ejemplos:**

```
- [-] Actualizar documentación 🛫 2025-04-01 #cx-Computador 🆔 8lhHhN
- [-] Finalizar tarea 2 ⛔ Ds06he 🆔 STU234
- [-] Revisar propuesta [w:: [[2025-W12]]] #cx-Oficina 🆔 mYSwfx
```

### Sintaxis y Elementos Clave de Tareas

#### Estructura Básica

```
- [-] Texto de la tarea [metadatos opcionales] [tags opcionales] 🆔 Código
```

#### Elementos de Clasificación

|Elemento|Formato|Descripción|
|---|---|---|
|**Contexto**|`#cx-Contexto`|Define el entorno donde se ejecuta la tarea|
|**Asignación**|`#px-Nombre` o `#px-Nombre_Empresa`|Define quién debe realizar la tarea|
|**Fecha de inicio**|`🛫 YYYY-MM-DD`|Fecha desde la que se puede trabajar en la tarea|
|**Fecha deseada**|`⏳ YYYY-MM-DD` o `📅 YYYY-MM-DD`|Fecha en que se desea realizar la tarea|
|**Hora inicio**|`[hI:: hora]`|Especifica la hora de inicio|
|**Hora final**|`[hF:: hora]`|Especifica la hora de finalización|
|**Duración**|`[Xmin]` o `[Xh]`|Tiempo estimado para completar la tarea|
|**Semana**|`[w:: [[YYYY-WXX]]]`|Semana planificada para la tarea|
|**Dependencia**|`⛔ ID`|Indica que depende de otra tarea|
|**Identificador**|`🆔 Código`|Identificador único de la tarea|

### Casos Especiales y Reglas de Transición

#### Transiciones Automáticas

|De|A|Cuando|Condición adicional|
|---|---|---|---|
|En Pausa|Next Actions|La fecha 🛫 llega|Tarea tiene contexto (#cx-)|
|En Pausa|Asignadas|La fecha 🛫 llega|Tarea tiene asignación (#px-) sin contexto|
|En Pausa|Inbox|La fecha 🛫 llega|Tarea sin contexto ni asignación|
|En Pausa|Next Actions|Tarea predecesora (⛔) completa|Tarea tiene contexto (#cx-)|
|En Pausa|Asignadas|Tarea predecesora (⛔) completa|Tarea tiene asignación (#px-) sin contexto|
|En Pausa|Inbox|Tarea predecesora (⛔) completa|Tarea sin contexto ni asignación|
|En Pausa|Next Actions/Asignadas|Semana [w::] inicia|Según tenga contexto o asignación|
|Ojalá Hoy|Next Actions|Fecha (⏳/📅) pasada|Tarea tiene contexto (#cx-)|
|Ojalá Hoy|Inbox|Fecha (⏳/📅) pasada|Tarea sin contexto ni asignación|

#### Resolución de Conflictos

Las siguientes situaciones generan conflictos y deberían dirigir las tareas a Inbox para revisión:

1. **Inconsistencias temporales:**
    - Hora final anterior a hora inicial
    - Duración que no coincide con el intervalo entre hora inicial y final
2. **Tareas mal formadas:**
    - Tareas con fecha presente o pasada sin contexto ni asignación
3. **Dependencias circulares:**
    - Tarea A depende de B, y B depende de A
4. **Formato incorrecto:**
    - Horas en formato no reconocido
    - Fechas en formato incorrecto