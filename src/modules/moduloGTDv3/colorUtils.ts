/**
 * A curated palette of modern, harmonious base colors (Hue, Saturation).
 * These colors are chosen to be visually pleasing and work well together.
 * They are inspired by palettes from popular productivity and design tools.
 */
const CURATED_COLOR_PALETTE: [number, number][] = [
    [210, 80], // Serene Blue
    [160, 65], // Mint Green
    [30, 90],  // Soft Orange
    [340, 85], // Gentle Rose
    [260, 75], // Lavender
    [50, 80],  // Pale Yellow
    [190, 70], // Teal
    [0, 75],   // Coral Red
    [130, 60], // Lime Green
    [300, 70], // Orchid Purple
];

/**
 * Generates a consistent and aesthetically pleasing color from a string using a curated palette
 * and subtle lightness variations. This is a hybrid approach that ensures visual harmony
 * while providing a good number of distinct, but related, colors.
 *
 * @param str The input string (e.g., a folder path or project name).
 * @returns A CSS HSL color string (e.g., 'hsl(210, 80%, 88%)').
 */
export function generateColorFromString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
        hash |= 0; // Ensure 32-bit integer
    }

    // Step 1: Select a base color from our curated palette.
    // This ensures the main hue is always from a harmonious set.
    const selectedColor = CURATED_COLOR_PALETTE[Math.abs(hash) % CURATED_COLOR_PALETTE.length];
    if (!selectedColor) {
        throw new Error('No color found in palette');
    }
    const [hue, saturation] = selectedColor;

    // Step 2: Introduce a subtle, deterministic variation in lightness.
    // This creates unique shades for different strings that map to the same base color.
    // We'll vary lightness within a pleasant, pastel range (e.g., 85% to 92%).
    const lightnessVariation = Math.abs(hash >> 10) % 8; // Produces a value from 0 to 7
    const lightness = 85 + lightnessVariation;

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
