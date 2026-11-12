export type RGB = {
  r: number;
  g: number;
  b: number;
};

/** How far a mix can sit from the swatch and still count as a match. */
export const MATCH_DISTANCE = 48;

const CLOSE_SCALE = 320;

function channel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(255, Math.max(0, value)));
}

export function mixColors(base: RGB, drops: readonly RGB[]): RGB {
  const parts = [base, ...drops];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const part of parts) {
    r += part.r;
    g += part.g;
    b += part.b;
  }
  const scale = parts.length;
  return {
    r: channel(r / scale),
    g: channel(g / scale),
    b: channel(b / scale),
  };
}

/** Redmean distance. Symmetric, and a bit closer to perception than raw RGB. */
export function colorDistance(a: RGB, b: RGB): number {
  const mean = (a.r + b.r) / 2;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt((2 + mean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - mean) / 256) * db * db);
}

export function closeness(distance: number): number {
  if (!Number.isFinite(distance) || distance <= 0) return 1;
  if (distance >= CLOSE_SCALE) return 0;
  return 1 - distance / CLOSE_SCALE;
}

export function isMatch(distance: number): boolean {
  return Number.isFinite(distance) && distance >= 0 && distance <= MATCH_DISTANCE;
}

export function rgbCss(color: RGB): string {
  return `rgb(${color.r} ${color.g} ${color.b})`;
}
