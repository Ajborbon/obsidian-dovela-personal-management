<%*
/**
 * Plantilla Trimestral (solo Templater)
 * Requisitos:
 * - El archivo debe llamarse YYYY-Qn (ej. 2025-Q2)
 * - Usa moment con locale 'es'
 */
moment.locale('es');

// ---------- Validación del título ----------
const fileTitle = tp.file.title?.trim(); // "YYYY-Qn"
const mQuarter = fileTitle?.match(/^(\d{4})-Q([1-4])$/i);
if (!mQuarter) {
  tR += "Error: esta plantilla requiere que el archivo se llame YYYY-Qn, por ejemplo 2025-Q2.\n";
  return;
}
const yearNum = parseInt(mQuarter[1], 10);
const qNum = parseInt(mQuarter[2], 10);

// ---------- Fechas base del trimestre ----------
const startMonthOfQuarter = (qNum - 1) * 3 + 1; // 1,4,7,10
const startOfQuarter = moment(`${yearNum}-${String(startMonthOfQuarter).padStart(2,'0')}-01`, "YYYY-MM-DD").startOf('month');
const endOfQuarter = startOfQuarter.clone().add(3, 'months').subtract(1, 'day'); // fin del tercer mes

// ---------- Título y vínculos ----------
const quarterId = `${yearNum}-Q${qNum}`;
const titulo = `Revisión Trimestral ${quarterId}`;
const añoWiki = `[[${yearNum}]]`;

// Prev / Next quarters (ajustando año)
let prevYear = yearNum, nextYear = yearNum;
let prevQ = qNum - 1, nextQ = qNum + 1;
if (prevQ < 1) { prevQ = 4; prevYear = yearNum - 1; }
if (nextQ > 4) { nextQ = 1; nextYear = yearNum + 1; }
const prevQuarterId = `${prevYear}-Q${prevQ}`;
const nextQuarterId = `${nextYear}-Q${nextQ}`;

// ---------- Meses del trimestre ----------
const months = [];
for (let i = 0; i < 3; i++) {
  const m = startOfQuarter.clone().add(i, 'months');
  const monthNameCap = m.format('MMMM').replace(/^./, c => c.toUpperCase());
  const monthId = m.format('YYYY-MM');
  months.push({ name: monthNameCap, id: monthId, m });
}
const mesesListOut = months.map(x => `- ${x.name}: [[${x.id}]]`).join('\n');

// ---------- Semanas del trimestre (1..13) ----------
/**
 * Regla: cada trimestre tiene 13 semanas para numeración interna.
 * Partimos del LUNES ISO que contiene el primer día del trimestre y
 * generamos 13 semanas consecutivas.
 * Para agrupar por mes, usamos el JUEVES de cada semana (ISO-heurística).
 */
const mondayStart = startOfQuarter.clone().startOf('isoWeek');
const weeksByMonth = {};

// inicializa contenedores por los 3 meses del trimestre (para mantener orden)
months.forEach(x => { weeksByMonth[x.name] = []; });

for (let i = 0; i < 13; i++) {
  const weekStart = mondayStart.clone().add(i, 'weeks'); // lunes de la semana i
  const thursday = weekStart.clone().add(3, 'days');     // jueves de esa semana

  // Link a nota semanal usando ISO year/week
  const isoYear = thursday.isoWeekYear();
  const isoWeek = thursday.isoWeek();
  const weekLink = `${isoYear}-W${String(isoWeek).padStart(2,'0')}`;

  // Semana dentro del trimestre (1..13)
  const weekInQuarter = i + 1;
  const labelW = String(weekInQuarter).padStart(2, '0');

  // Mes al que asignamos la semana (por jueves)
  const monthKey = thursday.format('MMMM').replace(/^./, c => c.toUpperCase());

  // Solo contamos semanas cuyo jueves cae dentro del rango real del trimestre
  if (thursday.isSameOrAfter(startOfQuarter, 'day') && thursday.isSameOrBefore(endOfQuarter, 'day')) {
    if (!weeksByMonth[monthKey]) weeksByMonth[monthKey] = [];
    weeksByMonth[monthKey].push({ i, weekInQuarter, weekLink, isoWeek });
  }
}

// Render de “Semanas del Trimestre” manteniendo orden Abril/Mayo/Junio (o el trío que corresponda)
let semanasTrimestreOut = "";
months.forEach(x => {
  const arr = weeksByMonth[x.name] || [];
  if (arr.length > 0) {
    // ordenar por índice i (cronológico)
    arr.sort((a,b)=>a.i - b.i);
    const lines = arr.map(w => `\t- Semana ${String(w.weekInQuarter).padStart(2,'0')}: [[${w.weekLink}]]`).join('\n');
    semanasTrimestreOut += `- ${x.name}:\n${lines}\n`;
  } else {
    // Si no hubo semanas (raro, pero por completitud)
    semanasTrimestreOut += `- ${x.name}:\n`;
  }
});
semanasTrimestreOut = semanasTrimestreOut.trim();

// ---------- Objetivos del trimestre (ancla en la nota anual) ----------
const objetivosEmbed = `${yearNum}#${quarterId} Objetivos trimestrales Objetivos para el trimestre ${qNum} del ${yearNum}`;

// ---------- Planeación por meses (enlaces a “Objetivos mensuales”) ----------
const planeacionMesesOut = months.map(x => {
  const nombreMesLower = x.m.format('MMMM'); // para el texto “Objetivos para <mes> del <año>”
  const nombreMesVis = nombreMesLower; // lo dejamos en minúscula por estilo; si prefieres capitalizar, cambia aquí
  return `### [[${x.id}#Objetivos mensuales|Objetivos para ${nombreMesVis} del ${yearNum}]]`;
}).join('\n\n');

// ---------- Embeds de “Anotaciones Mensuales de este Trimestre” ----------
const embedsMensualesOut = months.map(x => `### [[${x.id}]]\n![[${x.id}#Resumen del mes]]`).join('\n\n');
-%>
---
type: Qly
año: "<% añoWiki %>"
estado: 🟢
destacado:
journal: Trimestral
---
# Revisión Trimestral <% quarterId %>

## Links
[[<% prevQuarterId %>]] / [[<% nextQuarterId %>]]

## Meses del Trimestre
<% mesesListOut %>

## Semanas del Trimestre
<% semanasTrimestreOut %>

## Objetivos del trimestre planteados en la revisión anual

![[<% objetivosEmbed %>]]

## 1. Revisión General

### Logros y éxitos del trimestre
- 
- 
- 

### Desafíos y obstáculos
- 
- 
- 

### Lecciones aprendidas
- 
- 
- 

## 2. Revisión por Áreas de Vida

### Áreas de Vida
- **Área 1**: 
- **Área 2**: 
- **Área 3**:

## 3. Veredicto de herramientas
Revisión de las herramientas de [[03 - Gestion Personal/AV - Gerente de Vida/AI - Sistema de Visión y Ejecución/RR - Herramientas de interiorización/RR - Herramientas de interiorización|RR - Herramientas de interiorización]]:
- Herramienta:
  - Resultado del trimestre:
  - Veredicto (mantener / ajustar / retirar):
  - Herramienta nueva que la reemplaza o complementa:

## Planeación por meses
<% planeacionMesesOut %>

## 3. Estado de Proyectos

### Proyectos completados este trimestre
- 
- 
- 

### Proyectos en progreso
- 
- 
- 

### Nuevos proyectos iniciados
- 
- 
- 

## 4. Objetivos del Trimestre

### Objetivos cumplidos
- 
- 

### Objetivos en progreso
- 
- 

### Objetivos no alcanzados
- 
- 

## 5. Análisis de Tiempo y Productividad

### ¿Dónde invertí más tiempo?
- 

### ¿Fue efectivo el uso de mi tiempo?
- 

### Ajustes para el próximo trimestre
- 

## 6. Metas para el próximo trimestre
- 
- 
- 

## 7. Reflexión personal
- 

## Resumen del trimestre

## Anotaciones Mensuales de este Trimestre
<% embedsMensualesOut %>

# Fin
