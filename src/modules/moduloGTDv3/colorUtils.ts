
// src/modules/moduloGTDv3/colorUtils.ts

/**
 * Genera un color HSL consistente y legible a partir de un string (como una ruta de carpeta).
 * Utiliza un algoritmo de hashing simple para crear un matiz (hue) único.
 * Mantiene la saturación y la luminosidad en rangos que aseguran colores pastel suaves y buena legibilidad.
 *
 * @param str El string de entrada para generar el color.
 * @returns Un string de color HSL, por ejemplo, "hsl(120, 75%, 85%)".
 */
export function stringToHslColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = hash % 360;
    const saturation = 75; // Saturación fija para colores consistentes
    const lightness = 85;  // Luminosidad alta para fondos pastel claros

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
