<%*
moment.locale('es');

const nombreNota = tp.file.title; // Ej.: "2024-W23"
const match = nombreNota.match(/^(\d{4})-W(\d{1,2})$/);
const tipo = "Wly";
let titulo = "Nombre de nota inválido";
let trimestre, fechaInicioTrimestre, semanaInicioTrimestre, numeroSemanaTrimestre, fechaDeLaSemana;

// NUEVOS: para frontmatter
let mesId = null;        // "[[YYYY-MM]]" (se completa más abajo)
let trimestreId = null;  // "[[YYYY-Qn]]" (se completa más abajo)

if (!match) {
  tR += "El nombre de la nota no tiene el formato correcto (yyyy-Www).";
} else {
  const año = parseInt(match[1], 10);      // Este es el ISO YEAR del nombre
  const semanaAnio = parseInt(match[2], 10);

  // Deducción de trimestre solo para construir tu título (sin cambiar tu lógica)
  let mesInicioTrimestre = 0;
  if (semanaAnio >= 1 && semanaAnio <= 13) {
    trimestre = 1; mesInicioTrimestre = 0;
  } else if (semanaAnio >= 14 && semanaAnio <= 26) {
    trimestre = 2; mesInicioTrimestre = 3;
  } else if (semanaAnio >= 27 && semanaAnio <= 39) {
    trimestre = 3; mesInicioTrimestre = 6;
  } else {
    trimestre = 4; mesInicioTrimestre = 9;
  }

  fechaInicioTrimestre = moment([año, mesInicioTrimestre, 1]);
  semanaInicioTrimestre = fechaInicioTrimestre.isoWeek();

  numeroSemanaTrimestre = semanaAnio - semanaInicioTrimestre + 1;
  if (numeroSemanaTrimestre < 1) numeroSemanaTrimestre = 1;

  // ✅ Lunes de la semana usando ISO YEAR (robusto en semanas de borde)
  fechaDeLaSemana = moment().isoWeekYear(año).isoWeek(semanaAnio).startOf('isoWeek');

  // 🔹 El JUEVES decide el mes y el trimestre al que pertenece la semana
  const juevesSemana = fechaDeLaSemana.clone().add(3, 'days');

  // 🔹 IDs de frontmatter según el JUEVES
  mesId = juevesSemana.format('YYYY-MM');                         // p.ej. "2025-08"
  const qNum = Math.ceil((juevesSemana.month() + 1) / 3);         // 1..4
  trimestreId = `${juevesSemana.year()}-Q${qNum}`;                // p.ej. "2025-Q3"

  // Tu título original (lo dejo intacto, usa el mes del lunes)
  const nombreMes = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
  ][fechaDeLaSemana.month()];
  titulo = `W${numeroSemanaTrimestre} Q${trimestre} - ${nombreMes} ${año}`;
}
-%>
---
type: <% tipo %>
estado: 🟢
mes: "[[<% mesId %>]]"
trimestre: "[[<% trimestreId %>]]"
destacado:
tags:
---
# <% titulo %>

## Links
<%*
// Generate Prev/Next links based on the final note name (v.semana)
const currentWeekName = nombreNota; // e.g., "2025-W15"
if (currentWeekName) {
    const currentWeekMoment = moment(currentWeekName, "YYYY-[W]WW"); // Use correct format including 'W'
    if (currentWeekMoment.isValid()) {
        const prevWeek = currentWeekMoment.subtract(1, "weeks").format("YYYY-[W]WW");
        const nextWeek = currentWeekMoment.add(2, "weeks").format("YYYY-[W]WW"); // Corrected: Only add 1 week
        tR += `[[${prevWeek}]] / [[${nextWeek}]]`;
    } else {
        tR += "Error al parsear nombre de semana para navegación.";
    }
} else {
    tR += "Nombre de semana no disponible para navegación.";
}
%>
<%*
// Utiliza `fechaDeLaSemana` ya definida en el bloque inicial como inicio de la semana
// Asegúrate que este bloque se usa en la misma plantilla después del bloque inicial

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}
let fechaInicio;
if (typeof fechaDeLaSemana === "undefined") {
    tR += "Error: No se ha definido 'fechaDeLaSemana'. Asegúrate de ejecutar primero el bloque inicial.";
} else {
     fechaInicio = new Date(fechaDeLaSemana.format("YYYY-MM-DD")); // Convertir moment a Date
    let diaSemana = [" L ", " ﹒M ", " ﹒Mc ", " ﹒J ", " ﹒V ", " ﹒S ", "﹒D "];

    for (let i = 0; i < 7; i++) {
        let fechaActual = addDays(fechaInicio, i+1);
        let yyyy = fechaActual.getFullYear();
        let mm = String(fechaActual.getMonth() + 1).padStart(2, '0');
        let dd = String(fechaActual.getDate()).padStart(2, '0');
        let dayName = fechaActual.toLocaleDateString('es-ES', { weekday: 'long' });

        let link = `[[${yyyy}-${mm}-${dd} ${dayName}|${dd}]]`;
        tR += diaSemana[i] + link + " ";
    }
}
%>
## Objetivos semanales planteados en la revisión mensual
<%*

// Extraer año y número de semana
let semanalID = currentWeekName; // Formato YYYY-Www
let [año, semanaCompleta] = semanalID.split('-');
let numSemana = parseInt(semanaCompleta.substring(1));

// Obtener fecha de inicio de la semana (lunes ISO)
let inicioSemana = moment().year(año).isoWeek(numSemana).startOf('isoWeek');
// Calcular el mes al que pertenece mayoritariamente esta semana (jueves)
let diaMedio = moment(inicioSemana).add(3, 'days');
let mesPrincipal = diaMedio.format('YYYY-MM');

// Calcular trimestre
let mesMedio = parseInt(diaMedio.format('MM'));
let trimNum = Math.ceil(mesMedio / 3);

// Calcular la primera semana del trimestre
let primerMesTrim = (trimNum - 1) * 3 + 1;
let primerDiaTrim = moment(`${año}-${String(primerMesTrim).padStart(2, '0')}-01`);
let primerSemanaTrim = moment(primerDiaTrim).isoWeek();

// Posición de la semana en el trimestre (W1..W13), manejando cambio de año
let semanaEnTrimestre = numSemana - primerSemanaTrim + 1;
if (semanaEnTrimestre < 1) semanaEnTrimestre += 52;

// Rango de fechas SIEMPRE con mes abreviado en ambos extremos (match con mensual)
let finSemana = moment(inicioSemana).add(6, 'days');
let rangoFechas = `${inicioSemana.format('DD MMM')} - ${finSemana.format('DD MMM')}`;
%>
![[<% mesPrincipal %>#<% semanalID %> Propósitos principales Objetivos para W<% semanaEnTrimestre %> - semana <% numSemana %> (<% rangoFechas %>)]]
## Iniciando semana
### ¿Cuál es mi plan para esta semana?

#### Propósitos principales.

#### ¿Cuál es mi inspiración de esta semana?

#### Semanario
#### Tareas para adelantar, reubicar o acumular

Lista de apoyo para rediseñar la semana: tomar una acción si un bloque termina antes y registrar lo que falta si queda pendiente. Referenciar la tarea/proyecto fuente sin duplicar sus casillas; mantener allí el estado real. Importancia estimada: 1 (menor) a 10 (mayor). Cambiar «No» por «Sí» al completar la acción.

| Acción / resultado pendiente | Proyecto o fuente | Situación al planear | Próximo ajuste | Importancia estimada (1–10) | Ejecutada (Sí/No) |
|---|---|---|---|---|---|
| Por definir | | | | | No |

<!-- En tablas, escapar el separador de los alias de wikilinks: [[Nota\|Nombre visible]]. -->

**Registro de ajustes durante la semana:**
- Fecha / tarea / qué falta / proyecto fuente / nueva ubicación: por completar durante la ejecución.

#### Bloques por día
<%* /* --- Weekly Planner Section --- */ -%>
<%*
let semanarioContent = "";
if (fechaInicio && !isNaN(fechaInicio)) {
    for (let i = 0; i < 7; i++) {
        let fechaActual = addDays(fechaInicio, i+1);
        let yyyy = fechaActual.getFullYear();
        let mm = String(fechaActual.getMonth() + 1).padStart(2, '0');
        let dd = String(fechaActual.getDate()).padStart(2, '0');
        let dayName = fechaActual.toLocaleDateString('es-ES', { weekday: 'long' });
        let formato = `##### [[${yyyy}-${mm}-${dd} ${dayName}#Plan y registro actividades|Bloques definidos para el ${yyyy}-${mm}-${dd} ${dayName}]]`;
        semanarioContent += formato + "\n\n";
    }
    tR += semanarioContent;
} else {
    tR += "Error al generar semanario.";
}
%>


### Tareas
```datacorejsx
return function View() {
    const plugin = dc.app.plugins.plugins["obsidian-dovela-personal-management"];
    const currentFile = dc.useCurrentFile();

    const weekCode = dc.useMemo(() => {
        const fileName = currentFile?.$name ?? currentFile?.name ?? "";
        return fileName.match(/\d{4}-W\d{1,2}/)?.[0] || plugin?.weeklyAPI?.getCurrentWeekCode?.() || null;
    }, [currentFile, plugin]);

    const options = dc.useMemo(() => ({
        showOverdueLimit: 10,
        showCompletedCollapsed: true,
        highlightToday: true
    }), []);

    const [weeklyElement, setWeeklyElement] = dc.useState(null);
    const [error, setError] = dc.useState(null);
    const containerRef = dc.useRef(null);

    dc.useEffect(() => {
        let cancelled = false;

        async function loadWeeklyView() {
            try {
                setError(null);
                setWeeklyElement(null);

                if (!plugin?.weeklyAPI?.renderTasksForWeek) {
                    throw new Error("Plugin o weeklyAPI no disponible");
                }

                if (!weekCode) {
                    throw new Error("No se pudo determinar el código de semana");
                }

                const element = await plugin.weeklyAPI.renderTasksForWeek(weekCode, options);

                if (!cancelled) {
                    setWeeklyElement(element);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err);
                }
            }
        }

        loadWeeklyView();

        return () => {
            cancelled = true;
        };
    }, [plugin, weekCode, options]);

    dc.useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.innerHTML = "";

        if (weeklyElement instanceof Node) {
            container.appendChild(weeklyElement);
        }
    }, [weeklyElement]);

    if (error) {
        return <p>Error: {error.message}</p>;
    }

    if (!weeklyElement) {
        return <p>Cargando tareas semanales...</p>;
    }

    return <div ref={containerRef} />;
}
```


---
## Finalizando semana

### Resumen de la semana
#### Resumen narrativo

#### Resumen por temas

### Conclusion de la semana?

## Alineación de rituales

### 1. Cuerpo y energía
- Entrené:
- Alimentación base: Baja / Media / Alta
- Energía semanal (1-5):
- Observación:

### 2. Orden financiero
- ¿Hice revisión financiera semanal?: Sí / No
- ¿Registré gastos y pagos relevantes?: Sí / No
- ¿Hubo gasto impulsivo o desorden?: Sí / No
- Observación:

### 3. Construcción de abundancia
- ¿Avancé esta semana en el vehículo escalable?: Sí / No
- Frente trabajado: Autolavado / Trading / Otro / Ninguno
- Avance concreto:
- Observación:

### 4. Balance de vida
- Salud: Muy presente / Bien / Descuidada
- Trabajo: Muy presente / Bien / Descuidada
- Dinero: Muy presente / Bien / Descuidada
- Amor / pareja: Muy presente / Bien / Descuidada
- Familia / amigos: Muy presente / Bien / Descuidada
- Aprendizaje: Muy presente / Bien / Descuidada
- Descanso / disfrute: Muy presente / Bien / Descuidada
- ¿En qué área me quedé pegado esta semana?:

### 5. Presencia y conexión
- Presencia interior (0-7):
- Reflexión consciente (0-7):
- Conexión genuina con alguien (0-7):
- Observación:

### Ajuste para la próxima semana
- Lo que debo sostener:
- Lo que debo corregir:
- Lo que debo soltar:

## Anotaciones diarias de esta semana
<%* /* --- Daily Notes Embed Section --- */ -%>
<%*
let dailyEmbeds = "";
if (fechaInicio && !isNaN(fechaInicio)) {

    dailyEmbeds += "### Destacados de la semana\n\n";
    dailyEmbeds += "```base\n";
    dailyEmbeds += "filters:\n";
    dailyEmbeds += "  and:\n";
    dailyEmbeds += "    - type == \"Dly\"\n";
    dailyEmbeds += "    - destacado\n";
    dailyEmbeds += "    - semana == this\n\n";
    dailyEmbeds += "formulas:\n";
    dailyEmbeds += "  Dia: fecha.format(\"dddd\")\n\n";
    dailyEmbeds += "views:\n";
    dailyEmbeds += "  - type: table\n";
    dailyEmbeds += "    name: Destacados de la semana\n";
    dailyEmbeds += "    order:\n";
    dailyEmbeds += "      - formula.Dia\n";
    dailyEmbeds += "      - fecha\n";
    dailyEmbeds += "      - destacado\n";
    dailyEmbeds += "```\n\n";

    for (let i = 0; i < 7; i++) {
        let fechaActual = addDays(fechaInicio, i + 1);
        let yyyy = fechaActual.getFullYear();
        let mm = String(fechaActual.getMonth() + 1).padStart(2, '0');
        let dd = String(fechaActual.getDate()).padStart(2, '0');
        let dayName = fechaActual.toLocaleDateString('es-ES', { weekday: 'long' });
        let dayNameU = dayName.charAt(0).toUpperCase() + dayName.slice(1);
        let formato = `### ${dayNameU}\n![[${yyyy}-${mm}-${dd} ${dayName}# Bitácora del día]]`;
        dailyEmbeds += formato + "\n";
    }
    tR += dailyEmbeds;
} else {
     tR += "Error al generar embeds diarios.";
}
%>

## Notas apuntando a esta semana

```base
filters:
  and:
    - file.hasLink(this.file)
    - file.path != this.file.path
views:
  - type: table
    name: Notas apuntando a esta semana
    groupBy:
      property: file.folder
      direction: ASC
    order:
      - fecha
      - file.name
      - estado
      - type
    properties:
      file.link:
        displayName: File
      type:
        displayName: Tipo
      estado:
        displayName: Estado
      file.folder:
        displayName: Ruta

```
