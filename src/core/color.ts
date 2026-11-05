/** Color determinista por texto (paleta curada de v1, `colorUtils.generateColorFromString`). */

const PALETTE: ReadonlyArray<readonly [number, number]> = [
  [210, 80], [160, 65], [30, 90], [340, 85], [260, 75],
  [50, 80], [190, 70], [0, 75], [130, 60], [300, 70],
];

export function colorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const idx = Math.abs(hash) % PALETTE.length;
  const [h, s] = PALETTE[idx] ?? [210, 80];
  const l = 85 + (Math.abs(hash >> 10) % 8);
  return `hsl(${h}, ${s}%, ${l}%)`;
}
