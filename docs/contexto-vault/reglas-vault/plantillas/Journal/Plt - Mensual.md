<%*
/**
 * Plantilla Mensual (solo Templater)
 * Requisitos:
 * - El archivo debe llamarse YYYY-MM (ej. 2025-05)
 * - Usa moment con locale 'es'
 */
moment.locale('es');

// --------- Validación nombre de archivo ----------
const fileTitle = tp.file.title?.trim(); // "YYYY-MM"
if (!/^\d{4}-\d{2}$/.test(fileTitle)) {
  tR += "Error: esta plantilla requiere que el archivo se llame YYYY-MM, por ejemplo 2025-05.\n";
  return;
}

// --------- Fechas base ----------
const m = moment(fileTitle, "YYYY-MM");        // primer día del mes
const añoNum = m.year();
const mesNum = m.month() + 1;                  // 1..12
const inicioMes = m.clone().startOf('month');  // YYYY-MM-01
const finMes = m.clone().endOf('month');       // último día del mes

// Título "Mayo del 2025"
const nombreMesCap = m.format("MMMM").replace(/^./, c => c.toUpperCase());
const titulo = `${nombreMesCap} del ${añoNum}`;

// Wikilinks a año y trimestre
const trimestreNum = Math.ceil(mesNum / 3);    // 1..4
const trimestreWiki = `[[${añoNum}-Q${trimestreNum}]]`;
const añoWiki = `[[${añoNum}]]`;

// Campo 'mes' (YYYY-MM)
const mesCampo = m.format("YYYY-MM");

// Prev/Next
const prevM = m.clone().subtract(1, "month");
const nextM = m.clone().add(1, "month");
const prevFile = prevM.format("YYYY-MM");
const nextFile = nextM.format("YYYY-MM");
const prevAlias = prevM.format("MMMM [del] YYYY").replace(/^./, c => c.toUpperCase());
const nextAlias = nextM.format("MMMM [del] YYYY").replace(/^./, c => c.toUpperCase());

// --------- Semanas del mes & semana en trimestre ----------
// Primer mes del trimestre: 1, 4, 7, 10
const mesInicioTrimestre = (trimestreNum - 1) * 3 + 1;
const inicioTrimestre = moment(`${añoNum}-${String(mesInicioTrimestre).padStart(2,'0')}-01`, "YYYY-MM-DD");
// Lunes (inicio semana ISO) que contiene el primer día del trimestre
const lunesInicioTrim = inicioTrimestre.clone().startOf('isoWeek');

// Recorremos semanas que tocan el mes actual
const lunesPrimeraSemanaDelMes = inicioMes.clone().startOf('isoWeek');
let cursor = lunesPrimeraSemanaDelMes.clone();

const linesSemanas = [];
const linesPlaneacion = [];
const embedsSemanas = [];

while (cursor.isSameOrBefore(finMes, 'day')) {
  // ¿La semana toca este mes?
  const finSemanaCursor = cursor.clone().endOf('isoWeek');
  const tocaMes = finSemanaCursor.isSame(inicioMes, 'month')
               || cursor.isSame(inicioMes, 'month')
               || finSemanaCursor.isSame(finMes, 'month')
               || (cursor.isBefore(finMes) && finSemanaCursor.isAfter(inicioMes));

  if (tocaMes) {
    const isoYear = cursor.isoWeekYear();
    const isoWeek = cursor.isoWeek(); // 1..53
    const linkSemana = `${isoYear}-W${String(isoWeek).padStart(2,'0')}`;

    // Semana dentro del trimestre (1..13 aprox.)
    const semanaEnTrimestre = cursor.diff(lunesInicioTrim, 'weeks') + 1;
    const etiquetaSemTrim = String(semanaEnTrimestre).padStart(2,'0');

    // Rango "DD MMM - DD MMM"
    const ini = cursor.clone();
    const fin = finSemanaCursor;
    const iniStr = ini.format('DD MMM');
    const finStr = fin.format('DD MMM');

    // Para "Semanas del Mes"
    linesSemanas.push(`Semana ${etiquetaSemTrim}: [[${linkSemana}]]`);

    // Para "Planeación por semanas"
    linesPlaneacion.push(`##### [[${linkSemana}#Propósitos principales|Objetivos para W${semanaEnTrimestre} - semana ${String(isoWeek)} (${iniStr} - ${finStr})]]`);

    // Para "Anotaciones Semanales de este Mes"
    embedsSemanas.push(`#### [[${linkSemana}]]\n![[${linkSemana}#Resumen de la semana]]`);
  }

  cursor.add(1, 'week');
}

// Quitar posibles duplicados
const uniq = (arr) => [...new Set(arr)];
const semanasMesOut = uniq(linesSemanas).join('\n');
const planeacionOut = uniq(linesPlaneacion).join('\n\n');
const embedsOut = uniq(embedsSemanas).join('\n\n');

// Ancla de objetivos dentro de la nota trimestral
const nombreMesMinus = m.format('MMMM'); // minúsculas según locale
const anclaObjetivos = `${mesCampo} Objetivos mensuales Objetivos para ${nombreMesMinus} del ${añoNum}`;
-%>
---
type: Mly
mes: <% mesCampo %>
estado: 🟢
trimestre: "<% trimestreWiki %>"
año: "<% añoWiki %>"
destacado:
journal: Mensual
---
# <% titulo %>
## Links
[[<% prevFile %>|<% prevAlias %>]] / [[<% nextFile %>|<% nextAlias %>]]

## Semanas del Mes
<% semanasMesOut %>

## Objetivos del mes planteados en la revisión trimestral

![[<% `${añoNum}-Q${trimestreNum}` %>#<% anclaObjetivos %>]]

## Iniciando Mes
### ¿Cuál es mi plan para este mes?


### ¿Cuál es mi inspiración para este mes?


## Planeación por semanas
<% planeacionOut %>

---
## Finalizando Mes
### ¿Cuáles son mis conclusiones de este mes?
- 
### Resumen del mes
- 

## Veredicto de herramientas
Herramientas que cumplieron su ciclo de 4 semanas (ver [[03 - Gestion Personal/AV - Gerente de Vida/AI - Sistema de Visión y Ejecución/RR - Herramientas de interiorización/RR - Herramientas de interiorización|RR - Herramientas de interiorización]]):
- Herramienta:
  - Métrica y resultado observado:
  - Veredicto (mantener / ajustar / retirar):
  - Decisión para el siguiente ciclo:

## Contenido semanal de este mes
### Destacados de las semanas de este mes

```base
filters:
  and:
    - type == "Wly"
    - destacado
    - mes == this

views:
  - type: table
    name: Destacados de las semanas
    order:
      - file.name
      - destacado
```

### Anotaciones Semanales de este Mes

<% embedsOut %>

## Destacados diarios del mes

```base
filters:
  and:
    - type == "Dly"
    - destacado
    - mes == this
views:
  - type: table
    name: Destacados diarios del mes
    order:
      - file.name
      - destacado

```


---

# **Fin**

- [ ] Crear la planeación del mes <% mesCampo %> #cx-PlanMensual
- [ ] Escribir las conclusiones y hacer el cierre del mes <% mesCampo %> #cx-CierreMensual