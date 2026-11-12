import type { RGB } from './color.ts';

/**
 * Screen-space swirl. The caller did not pick a direction, so pours
 * turn clockwise: at the top of the well the speed vector points right.
 */
export const SWIRL_DIRECTION = 'clockwise' as const;

export type SpeedVector = {
  /** Well-widths per second, positive to the right. */
  x: number;
  /** Well-widths per second, positive downward. */
  y: number;
};

/** Radians per second. High so a pour finishes a clockwise sweep as it milks out. */
export const SWIRL_OMEGA = 22;

/**
 * Rates for the visible mix. The swirl stays readable briefly, then the
 * finish rates pull the well onto the true color. Tuned to settle in
 * well under a second — much faster than a real cup of milk.
 */
export const FAST_DIFFUSION = {
  blur: 4.2,
  settle: 1.1,
  decay: 3.2,
  finishBlur: 18,
  finishSettle: 20,
  finishDecay: 16,
  finishBelow: 0.4,
  /** Outward speed as a fraction of the angular rate. */
  spread: 0.16,
} as const;

export type DiffusionRates = {
  blur: number;
  settle: number;
  decay: number;
  finishBlur: number;
  finishSettle: number;
  finishDecay: number;
  finishBelow: number;
  spread: number;
};

export const FIELD_SIZE = 64;

export type Field = {
  size: number;
  px: Float32Array;
  alt: Float32Array;
};

const POUR_MARKS = [
  { u: 0.5, v: 0.34, radius: 0.12, amount: 1 },
  { u: 0.42, v: 0.43, radius: 0.085, amount: 0.78 },
  { u: 0.4, v: 0.52, radius: 0.06, amount: 0.48 },
] as const;

export function pourSpeed(): SpeedVector {
  return { x: SWIRL_OMEGA, y: 0 };
}

export function rotateClockwise(speed: SpeedVector, radians: number): SpeedVector {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: speed.x * cos - speed.y * sin,
    y: speed.x * sin + speed.y * cos,
  };
}

/** Clockwise tangential velocity plus a little outward spread. `dx`/`dy` are from the well center. */
export function velocityAt(dx: number, dy: number, speed: SpeedVector, spread: number = FAST_DIFFUSION.spread): SpeedVector {
  const omega = Math.hypot(speed.x, speed.y);
  const radial = omega * spread;
  return {
    x: -omega * dy + dx * radial,
    y: omega * dx + dy * radial,
  };
}

export function createField(size: number, color: RGB): Field {
  const field: Field = {
    size,
    px: new Float32Array(size * size * 3),
    alt: new Float32Array(size * size * 3),
  };
  fillField(field, color);
  return field;
}

export function fillField(field: Field, color: RGB): void {
  const px = field.px;
  for (let i = 0; i < px.length; i += 3) {
    px[i] = color.r;
    px[i + 1] = color.g;
    px[i + 2] = color.b;
  }
}

export function stamp(field: Field, color: RGB, u: number, v: number, radius: number, amount: number): void {
  const { size, px } = field;
  const sigma2 = 2 * radius * radius;
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) {
      const du = (i + 0.5) / size - u;
      const dv = (j + 0.5) / size - v;
      const influence = Math.exp(-(du * du + dv * dv) / sigma2) * amount;
      if (influence < 0.004) continue;
      const blend = influence > 1 ? 1 : influence;
      const offset = (j * size + i) * 3;
      px[offset] = px[offset]! * (1 - blend) + color.r * blend;
      px[offset + 1] = px[offset + 1]! * (1 - blend) + color.g * blend;
      px[offset + 2] = px[offset + 2]! * (1 - blend) + color.b * blend;
    }
  }
}

/** A drop of pigment, offset high in the well so the clockwise current can carry it. */
export function stampPour(field: Field, color: RGB): void {
  for (const mark of POUR_MARKS) {
    stamp(field, color, mark.u, mark.v, mark.radius, mark.amount);
  }
}

function sample(px: Float32Array, size: number, u: number, v: number): [number, number, number] {
  const x = Math.min(size - 1, Math.max(0, u * size - 0.5));
  const y = Math.min(size - 1, Math.max(0, v * size - 0.5));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(size - 1, x0 + 1);
  const y1 = Math.min(size - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const w00 = (1 - tx) * (1 - ty);
  const w10 = tx * (1 - ty);
  const w01 = (1 - tx) * ty;
  const w11 = tx * ty;
  const i00 = (y0 * size + x0) * 3;
  const i10 = (y0 * size + x1) * 3;
  const i01 = (y1 * size + x0) * 3;
  const i11 = (y1 * size + x1) * 3;
  return [
    px[i00]! * w00 + px[i10]! * w10 + px[i01]! * w01 + px[i11]! * w11,
    px[i00 + 1]! * w00 + px[i10 + 1]! * w10 + px[i01 + 1]! * w01 + px[i11 + 1]! * w11,
    px[i00 + 2]! * w00 + px[i10 + 2]! * w10 + px[i01 + 2]! * w01 + px[i11 + 2]! * w11,
  ];
}

function blur(field: Field, amount: number): void {
  if (amount <= 0) return;
  const { size, px, alt } = field;
  const keep = 1 - amount;
  for (let j = 0; j < size; j += 1) {
    const j0 = j > 0 ? j - 1 : j;
    const j1 = j + 1 < size ? j + 1 : j;
    for (let i = 0; i < size; i += 1) {
      const i0 = i > 0 ? i - 1 : i;
      const i1 = i + 1 < size ? i + 1 : i;
      const c = (j * size + i) * 3;
      const l = (j * size + i0) * 3;
      const r = (j * size + i1) * 3;
      const u = (j0 * size + i) * 3;
      const d = (j1 * size + i) * 3;
      alt[c] = px[c]! * keep + (px[l]! + px[r]! + px[u]! + px[d]!) * 0.25 * amount;
      alt[c + 1] = px[c + 1]! * keep + (px[l + 1]! + px[r + 1]! + px[u + 1]! + px[d + 1]!) * 0.25 * amount;
      alt[c + 2] = px[c + 2]! * keep + (px[l + 2]! + px[r + 2]! + px[u + 2]! + px[d + 2]!) * 0.25 * amount;
    }
  }
  field.px = alt;
  field.alt = px;
}

function advect(field: Field, speed: SpeedVector, dt: number, spread: number): void {
  const omega = Math.hypot(speed.x, speed.y);
  if (omega < 1e-4 || dt <= 0) return;
  const { size, px, alt } = field;
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) {
      const u = (i + 0.5) / size;
      const v = (j + 0.5) / size;
      const vel = velocityAt(u - 0.5, v - 0.5, speed, spread);
      const [r, g, b] = sample(px, size, u - vel.x * dt, v - vel.y * dt);
      const offset = (j * size + i) * 3;
      alt[offset] = r;
      alt[offset + 1] = g;
      alt[offset + 2] = b;
    }
  }
  field.px = alt;
  field.alt = px;
}

function settle(field: Field, toward: RGB, amount: number): void {
  if (amount <= 0) return;
  const px = field.px;
  for (let i = 0; i < px.length; i += 3) {
    px[i] = px[i]! + (toward.r - px[i]!) * amount;
    px[i + 1] = px[i + 1]! + (toward.g - px[i + 1]!) * amount;
    px[i + 2] = px[i + 2]! + (toward.b - px[i + 2]!) * amount;
  }
}

function decaySpeed(speed: SpeedVector, dt: number, decay: number): SpeedVector {
  const omega = Math.hypot(speed.x, speed.y);
  if (omega < 1e-4) return { x: 0, y: 0 };
  const next = omega * Math.exp(-decay * dt);
  if (next < 0.05) return { x: 0, y: 0 };
  const turned = rotateClockwise(speed, omega * dt);
  const mag = Math.hypot(turned.x, turned.y);
  if (mag < 1e-8) return { x: 0, y: 0 };
  return { x: (turned.x / mag) * next, y: (turned.y / mag) * next };
}

export function stepField(
  field: Field,
  speed: SpeedVector,
  dt: number,
  toward: RGB,
  rates: DiffusionRates = FAST_DIFFUSION,
): SpeedVector {
  const omega = Math.hypot(speed.x, speed.y);
  const finishing = omega > 0 && omega < SWIRL_OMEGA * rates.finishBelow;
  const blurRate = finishing ? rates.finishBlur : rates.blur;
  const settleRate = finishing ? rates.finishSettle : rates.settle;
  const decay = finishing ? rates.finishDecay : rates.decay;
  advect(field, speed, dt, rates.spread);
  blur(field, blurRate <= 0 ? 0 : 1 - Math.exp(-blurRate * dt));
  settle(field, toward, settleRate <= 0 ? 0 : 1 - Math.exp(-settleRate * dt));
  return decaySpeed(speed, dt, decay);
}

export function fieldError(field: Field, target: RGB): number {
  const px = field.px;
  let worst = 0;
  for (let i = 0; i < px.length; i += 3) {
    const err = Math.max(
      Math.abs(px[i]! - target.r),
      Math.abs(px[i + 1]! - target.g),
      Math.abs(px[i + 2]! - target.b),
    );
    if (err > worst) worst = err;
  }
  return worst;
}

export function isSettled(field: Field, target: RGB, epsilon = 1.75): boolean {
  return fieldError(field, target) <= epsilon;
}

export function pigmentCentroid(field: Field, milk: RGB): { x: number; y: number } {
  const { size, px } = field;
  let weight = 0;
  let x = 0;
  let y = 0;
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) {
      const offset = (j * size + i) * 3;
      const dr = px[offset]! - milk.r;
      const dg = px[offset + 1]! - milk.g;
      const db = px[offset + 2]! - milk.b;
      const mass = dr * dr + dg * dg + db * db;
      if (mass < 1) continue;
      weight += mass;
      x += ((i + 0.5) / size) * mass;
      y += ((j + 0.5) / size) * mass;
    }
  }
  if (weight === 0) return { x: 0.5, y: 0.5 };
  return { x: x / weight, y: y / weight };
}
