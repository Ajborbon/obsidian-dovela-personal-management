# Documentación del Refactor de la Vista Jerárquica

**Fecha:** 06 de Julio de 2025

## 1. Objetivo del Proyecto

El objetivo es realizar un rediseño completo de la "Vista Jerárquica" del Dashboard GTD para mejorar significativamente la experiencia de usuario (UX). Esta mejora se centra en dos áreas clave:

1.  **Lógica de Fusión de Notas de Carpeta:** Solucionar la redundancia visual donde una carpeta y su nota principal aparecían como dos elementos separados y anidados.
2.  **Diseño Visual Premium:** Reemplazar la lista de texto simple por una interfaz moderna, intuitiva y estéticamente agradable, utilizando un modelo de "tarjetas anidadas".

## 2. Trabajo Realizado (Fases 1 y 2)

Hasta la fecha, se han completado las dos primeras fases del plan, que corresponden a la modificación de la lógica subyacente y la estructura HTML.

### Fase 1: Implementación del "Modelo de Fusión"

- **Archivo Modificado:** `src/modules/moduloGTDv3/hierarchyBuilder.ts`
- **Descripción:** Se ha reescrito por completo el algoritmo que construye la jerarquía de datos. El nuevo sistema ahora implementa un "Modelo de Fusión":
    - Detecta automáticamente si una nota tiene el mismo nombre que su carpeta contenedora (ej: `ProyectoA/ProyectoA.md`).
    - Si es así, "fusiona" la carpeta y la nota en una única entidad en la jerarquía. La nota se convierte en el nodo padre, y los demás archivos/carpetas dentro de `ProyectoA/` se convierten en sus hijos.
- **Impacto:**
    - **Eliminada la redundancia:** Ya no aparecen elementos duplicados.
    - **Uso correcto de `[FALTA]`:** El tag `[FALTA]` ahora solo aparece cuando una carpeta *realmente* no tiene una nota principal asociada, que es su propósito original.
    - La estructura de datos que se pasa a la fase de renderizado es ahora limpia, intuitiva y precisa.

### Fase 2: Creación de la Estructura HTML para "Tarjetas Anidadas"

- **Archivo Modificado:** `src/modules/moduloGTDv3/htmlGenerator.ts`
- **Descripción:** Se ha modificado la función que genera el HTML (`renderHierarchyViewRecursive`) para abandonar la lista simple y crear un "esqueleto" preparado para el nuevo diseño visual.
    - **Estructura de Tarjetas:** Cada elemento con hijos se renderiza como un `<details>` que contiene un `<summary>` (la cabecera de la tarjeta) y un `<div>` para los hijos.
    - **Preparado para Iconos:** Se ha eliminado el texto `[Tipo]` (ej: `[PQ]`, `[Ax]`) y se ha reemplazado por un `<span>` con un atributo `data-type="..."`. Esto permite asignar iconos específicos a cada tipo de elemento usando solo CSS.
    - **Controles Globales:** Se han añadido los botones "Expandir Todo" y "Colapsar Todo" al HTML de la vista.
    - **Colapso por Defecto:** Para evitar la sobrecarga de información, solo los dos primeros niveles de la jerarquía se renderizan expandidos (`open`).
- **Impacto:** Tenemos una estructura HTML semántica y robusta, lista para ser transformada visualmente en la siguiente fase.

## 3. Estado Actual y Próximos Pasos

Nos encontramos justo al inicio de la **Fase 3**.

- **Paso Actual Pendiente (Fase 3): Aplicar el Estilo Visual Premium (CSS).**
    - **Archivo a modificar:** `styles.css`.
    - **Tarea:** Escribir las reglas de CSS necesarias para dar vida a la nueva estructura HTML. Esto incluye definir los estilos para las tarjetas, las líneas de guía jerárquicas, los iconos, la tipografía, los contadores y los estados.

- **Paso Final (Fase 4): Implementar la Lógica de Interacción (JavaScript).**
    - **Archivo a modificar:** `src/modules/moduloGTDv3/view.ts`.
    - **Tarea:** Añadir los `event listeners` para que los nuevos botones "Expandir Todo" y "Colapsar Todo" sean funcionales.
