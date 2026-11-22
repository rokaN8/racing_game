// A Track's neon palette (docs/game-spec.md → Palettes): three authored colours, the darks derived from them.
import { Color } from 'three';

export interface Palette {
  primary: number;   // Track edges; first Menu colour (swatch, band, outline)
  secondary: number; // Checkpoint lines, FINISH arch and text; second Menu colour
  sky: number;       // solid, very dark background
}

// Mixed byte-wise in sRGB, as the hex is authored: mixing in linear space makes the darks far brighter, and they bloom.
const mix = (a: number, b: number, k: number) =>
  [16, 8, 0].reduce((out, sh) => {
    const ca = (a >> sh) & 255, cb = (b >> sh) & 255;
    return out | (Math.round(ca + (cb - ca) * k) << sh);
  }, 0);

// Every colour a Track's scene uses. The darks stay below the bloom threshold, so only the neon glows.
export function derive(p: Palette) {
  return {
    edge: p.primary, accent: p.secondary, sky: p.sky,
    fill: mix(p.sky, p.primary, 0.06), rungs: mix(0, p.primary, 0.3),
    gridMajor: mix(0, p.primary, 0.22), gridMinor: mix(0, p.primary, 0.1),
  };
}

export const css = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;
export const color = (hex: number) => new Color(hex);
