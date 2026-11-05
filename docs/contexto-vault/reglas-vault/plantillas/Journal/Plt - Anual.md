<%*
/**
 * Plantilla Anual (solo Templater)
 * Requisitos:
 * - El archivo debe llamarse YYYY (ej. 2025)
 * - Usa moment con locale 'es'
 */
moment.locale('es');

// ---------- Validación ----------
const fileTitle = tp.file.title?.trim(); // "YYYY"
const mYear = fileTitle?.match(/^(\d{4})$/);
if (!mYear) {
  tR += "Error: esta plantilla requiere que el archivo se llame YYYY, por ejemplo 2025.\n";
  return;
}
const yearNum = parseInt(mYear[1], 10);

// ---------- Prev/Next ----------
const prevYear = yearNum - 1;
const nextYear = yearNum + 1;

// ---------- Trimestres ----------
const trimestresOut = ['Q1','Q2','Q3','Q4'].map(q => `- [[${yearNum}-${q}]]`).join('\n');

// ---------- Meses del Año ----------
const mesesNombres = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];
const mesesOut = mesesNombres.map((nm, i) => `- ${nm}: [[${yearNum}-${String(i+1).padStart(2,'0')}]]`).join('\n');

// ---------- Planeación por trimestres ----------
const planeacionTrimestresOut = [1,2,3,4]
  .map(q => `### [[${yearNum}-Q${q}#Objetivos trimestrales|Objetivos para el trimestre ${q} del ${yearNum}]]`)
  .join('\n\n');

// ---------- Resumen de Trimestres (embeds) ----------
const embedsTrimestresOut = [1,2,3,4]
  .map(q => `### [[${yearNum}-Q${q}]]\n![[${yearNum}-Q${q}#Resumen del trimestre]]`)
  .join('\n\n');
-%>
---
type: Yly
estado: 🟢
journal: Anual
---
# Visión Anual <% yearNum %>

## Links
[[<% prevYear %>]] / [[<% nextYear %>]]

## Trimestres del Año
<% trimestresOut %>

## Meses del Año
<% mesesOut %>

# Revisión Anual <% yearNum %>

## 1. Revisión General

### Éxitos y logros principales
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

## Planeación por trimestres
<% planeacionTrimestresOut %>

## Resumen de Trimestres
<% embedsTrimestresOut %>

## 2. Revisión por Áreas de Vida


## 3. Revisión de Proyectos

### Proyectos completados
- 
- 
- 

### Proyectos en progreso
- 
- 
- 

### Proyectos abandonados o pospuestos
- 
- 
- 

## 4. Resumen Financiero
- Ingresos:
- Gastos: 
- Ahorros:
- Inversiones:
- Deudas:

## 5. Hábitos y rutinas
- Hábitos que funcionaron:
- Hábitos a mejorar:
- Nuevos hábitos a incorporar:

## 6. Metas para el próximo año
- 
- 
- 

## 7. Palabra o tema para el próximo año
-

# Fin
