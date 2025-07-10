/**
 * Generates a consistent, visually pleasing color from a string.
 * Uses HSL color space to ensure colors are harmonious.
 * @param str The input string (e.g., a folder path).
 * @returns A CSS HSL color string (e.g., 'hsl(120, 65%, 80%)').
 */
export function generateColorFromString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = hash % 360;
    const saturation = 65; // Keep saturation constant for a consistent look
    const lightness = 85;  // Use a light color for backgrounds

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}