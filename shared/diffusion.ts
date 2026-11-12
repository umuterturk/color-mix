import type { RGB } from './color.ts';

export type { RGB };

/**
 * Pigment diffusion on a small grid.
 *
 * A pour adds the exact mass the scoring mix expects, packed into a tight
 * bloom. Channel values may leave 0..255 so the bloom stays saturated; the
 * display clamps. Reflecting edges keep the average put, and each step only
 * spreads color. There is no velocity and no surface.
 */
export const DIFFUSION_SIZE = 64;

/** Explicit 4-neighbor rate. Stable at or below 1/4. */
export const DIFFUSION_RATE = 0.2;

const BLOB_SIGMA = DIFFUSION_SIZE * 0.09;
const CELL_COUNT = DIFFUSION_SIZE * DIFFUSION_SIZE;

export type Field = Float64Array;

/** Successive pours, alternating across the well so two colors stay apart. */
const POUR_PLACEMENTS = [
  { angle: 0.4, radius: 0.27 },
  { angle: Math.PI + 0.4, radius: 0.27 },
  { angle: Math.PI / 2 + 0.15, radius: 0.2 },
  { angle: (3 * Math.PI) / 2 + 0.15, radius: 0.2 },
  { angle: Math.PI / 4 + 0.1, radius: 0.1 },
  { angle: (5 * Math.PI) / 4 + 0.1, radius: 0.1 },
] as const;

export function createField(color: RGB): Field {
  const field = new Float64Array(CELL_COUNT * 3);
  fillField(field, color);
  return field;
}

export function fillField(field: Field, color: RGB): void {
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const offset = index * 3;
    field[offset] = color.r;
    field[offset + 1] = color.g;
    field[offset + 2] = color.b;
  }
}

export function fieldMean(field: Field): RGB {
  let r = 0;
  let g = 0;
  let b = 0;
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const offset = index * 3;
    r += field[offset] ?? 0;
    g += field[offset + 1] ?? 0;
    b += field[offset + 2] ?? 0;
  }
  return { r: r / CELL_COUNT, g: g / CELL_COUNT, b: b / CELL_COUNT };
}

export function fieldSpread(field: Field): number {
  const mean = fieldMean(field);
  let acc = 0;
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const offset = index * 3;
    const dr = (field[offset] ?? 0) - mean.r;
    const dg = (field[offset + 1] ?? 0) - mean.g;
    const db = (field[offset + 2] ?? 0) - mean.b;
    acc += dr * dr + dg * dg + db * db;
  }
  return acc / CELL_COUNT;
}

/** Where the next drop lands, in grid pixels. Successive pours sit apart. */
export function pourCell(dropIndex: number): { x: number; y: number } {
  const turn = ((dropIndex % POUR_PLACEMENTS.length) + POUR_PLACEMENTS.length) % POUR_PLACEMENTS.length;
  const placement = POUR_PLACEMENTS[turn] ?? POUR_PLACEMENTS[0];
  const center = (DIFFUSION_SIZE - 1) / 2;
  const radius = DIFFUSION_SIZE * placement.radius;
  return {
    x: center + Math.cos(placement.angle) * radius,
    y: center + Math.sin(placement.angle) * radius,
  };
}

/** Same landing, as fractions of the well, for the pour that flies in. */
export function pourLanding(dropIndex: number): { x: number; y: number } {
  const cell = pourCell(dropIndex);
  return {
    x: (cell.x + 0.5) / DIFFUSION_SIZE,
    y: (cell.y + 0.5) / DIFFUSION_SIZE,
  };
}

/**
 * Fold one pigment into the well.
 * `partsBefore` is how many equal parts are already there (the base counts as one).
 */
export function stampPigment(field: Field, pigment: RGB, partsBefore: number, point: { x: number; y: number }): void {
  const parts = partsBefore >= 1 ? partsBefore : 1;
  const mean = fieldMean(field);
  const denom = parts + 1;
  const addR = (CELL_COUNT * (pigment.r - mean.r)) / denom;
  const addG = (CELL_COUNT * (pigment.g - mean.g)) / denom;
  const addB = (CELL_COUNT * (pigment.b - mean.b)) / denom;
  const inv = 1 / (2 * BLOB_SIGMA * BLOB_SIGMA);
  const weights = new Float64Array(CELL_COUNT);
  let sumW = 0;

  for (let y = 0; y < DIFFUSION_SIZE; y += 1) {
    const dy = y - point.y;
    const row = y * DIFFUSION_SIZE;
    for (let x = 0; x < DIFFUSION_SIZE; x += 1) {
      const dx = x - point.x;
      const weight = Math.exp(-(dx * dx + dy * dy) * inv);
      weights[row + x] = weight;
      sumW += weight;
    }
  }

  const scaleR = addR / sumW;
  const scaleG = addG / sumW;
  const scaleB = addB / sumW;
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const weight = weights[index] ?? 0;
    const offset = index * 3;
    field[offset] = (field[offset] ?? 0) + scaleR * weight;
    field[offset + 1] = (field[offset + 1] ?? 0) + scaleG * weight;
    field[offset + 2] = (field[offset + 2] ?? 0) + scaleB * weight;
  }
}

/**
 * Spread color in place. `scratch` is workspace of the same length.
 * Returns the largest channel change on the last step.
 */
export function diffuse(field: Field, scratch: Field, rate: number, steps: number): number {
  const stride = DIFFUSION_SIZE * 3;
  let src = field;
  let dst = scratch;
  let maxDelta = 0;
  const total = steps < 1 ? 0 : Math.floor(steps);

  for (let step = 0; step < total; step += 1) {
    maxDelta = 0;
    for (let y = 0; y < DIFFUSION_SIZE; y += 1) {
      const row = y * stride;
      const up = y > 0 ? row - stride : row;
      const down = y + 1 < DIFFUSION_SIZE ? row + stride : row;
      for (let x = 0; x < DIFFUSION_SIZE; x += 1) {
        const index = row + x * 3;
        const left = x > 0 ? index - 3 : index;
        const right = x + 1 < DIFFUSION_SIZE ? index + 3 : index;
        const north = up + x * 3;
        const south = down + x * 3;
        for (let channel = 0; channel < 3; channel += 1) {
          const value = src[index + channel] ?? 0;
          const next =
            value +
            rate *
              ((src[left + channel] ?? 0) +
                (src[right + channel] ?? 0) +
                (src[north + channel] ?? 0) +
                (src[south + channel] ?? 0) -
                4 * value);
          const delta = Math.abs(next - value);
          if (delta > maxDelta) maxDelta = delta;
          dst[index + channel] = next;
        }
      }
    }
    const swap = src;
    src = dst;
    dst = swap;
  }

  if (src !== field) field.set(src);
  return maxDelta;
}

/**
 * Bring one cell into 0..255 without turning a saturated pour black.
 * Channels below zero are lifted together, then a too-bright color is scaled down.
 */
function toBytes(r: number, g: number, b: number): [number, number, number] {
  let rr = r;
  let gg = g;
  let bb = b;
  const min = Math.min(rr, gg, bb);
  if (min < 0) {
    rr -= min;
    gg -= min;
    bb -= min;
  }
  const max = Math.max(rr, gg, bb);
  if (max > 255) {
    const scale = 255 / max;
    rr *= scale;
    gg *= scale;
    bb *= scale;
  }
  return [Math.round(rr), Math.round(gg), Math.round(bb)];
}

/** Map the field into RGBA bytes. */
export function renderField(field: Field, pixels: Uint8ClampedArray): void {
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const source = index * 3;
    const target = index * 4;
    const [r, g, b] = toBytes(field[source] ?? 0, field[source + 1] ?? 0, field[source + 2] ?? 0);
    pixels[target] = r;
    pixels[target + 1] = g;
    pixels[target + 2] = b;
    pixels[target + 3] = 255;
  }
}
