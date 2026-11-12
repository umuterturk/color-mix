import type { RGB } from './color.ts';

/** Default pour enters from above, drifting slightly right as it sinks. */
export const SWIRL_DIRECTION = 'clockwise' as const;

export type SpeedVector = {
  /** Well-widths per second in the poured fluid blob. */
  x: number;
  y: number;
};

/** Default impulse magnitude when a pigment lands. */
export const SWIRL_OMEGA = 14;

/** Target time for the well to look visually uniform after a pour. */
export const DIFFUSION_BLEND_SECONDS = 5;

/** Jacobi iterations per frame for implicit diffusion (grid units, h = 1 cell). */
const IMPLICIT_DIFFUSION_ITERATIONS = 18;

/**
 * 2D miscible dye: semi-Lagrangian advection + backward-Euler diffusion (Jacobi).
 * Velocity comes only from the pour and decays; scoring color is not copied into the field.
 */
export const MARBLE_DIFFUSION = {
  /** Peak diffusivity D in (grid cells)²/s at full blend. */
  dyeDiffuse: 32,
  /** How fast the poured momentum dies out (1/s). */
  velocityDecay: 1.05,
  /** Smooths velocity to stretch filaments (1/s). */
  velocityViscosity: 1.8,
  /** Outward drift as a fraction of tangential speed. */
  spread: 0.12,
} as const;

export type DiffusionRates = {
  dyeDiffuse: number;
  velocityDecay: number;
  velocityViscosity: number;
  spread: number;
};

export const FIELD_SIZE = 64;

export type Field = {
  size: number;
  px: Float32Array;
  alt: Float32Array;
  u: Float32Array;
  v: Float32Array;
  uAlt: Float32Array;
  vAlt: Float32Array;
};

type PourLayout = {
  tipU: number;
  tipV: number;
  dirX: number;
  dirY: number;
  perpX: number;
  perpY: number;
};

function layoutForPour(speed: SpeedVector, pourSeed: number): PourLayout {
  const rand = pourRng(pourSeed ^ 0x9e37_79b9);
  const mag = Math.hypot(speed.x, speed.y) || 1;
  const baseDirX = speed.x / mag;
  const baseDirY = speed.y / mag;
  const jitter = (rand() - 0.5) * 1.35;
  const cos = Math.cos(jitter);
  const sin = Math.sin(jitter);
  const dirX = baseDirX * cos - baseDirY * sin;
  const dirY = baseDirX * sin + baseDirY * cos;

  const radius = Math.sqrt(rand()) * 0.34;
  const theta = rand() * Math.PI * 2;
  const tipU = 0.5 + Math.cos(theta) * radius;
  const tipV = 0.5 + Math.sin(theta) * radius;

  return {
    tipU,
    tipV,
    dirX,
    dirY,
    perpX: -dirY,
    perpY: dirX,
  };
}

function pourRng(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addGaussianWeight(
  weights: Float32Array,
  size: number,
  u: number,
  v: number,
  radius: number,
  amount: number,
): void {
  const sigma2 = 2 * radius * radius;
  const reach = radius * 3.2;
  for (let j = 0; j < size; j += 1) {
    const pv = (j + 0.5) / size;
    if (Math.abs(pv - v) > reach) continue;
    for (let i = 0; i < size; i += 1) {
      const pu = (i + 0.5) / size;
      const du = pu - u;
      const dv = pv - v;
      const d2 = du * du + dv * dv;
      if (d2 > reach * reach) continue;
      const influence = Math.exp(-d2 / sigma2) * amount;
      if (influence < 0.003) continue;
      const idx = j * size + i;
      weights[idx] = (weights[idx] ?? 0) + influence;
    }
  }
}

/** Acrylic brush stroke: thin at contact, widening tail, plus flecks and drops. */
function buildPourWeights(weights: Float32Array, size: number, speed: SpeedVector, pourSeed: number): number {
  const layout = layoutForPour(speed, pourSeed);
  const rand = pourRng(pourSeed);
  const strokeLen = 0.18 + rand() * 0.2;
  const segments = 26 + Math.floor(rand() * 14);
  const widthScale = 0.85 + rand() * 0.45;
  for (let s = 0; s <= segments; s += 1) {
    const t = s / segments;
    const along = t * strokeLen;
    const halfW = (0.004 + t * t * 0.058) * widthScale;
    const cu = layout.tipU + layout.dirX * along;
    const cv = layout.tipV + layout.dirY * along;
    const ink = 0.35 + (1 - t) * (0.45 + rand() * 0.35);
    addGaussianWeight(weights, size, cu, cv, halfW, ink);
  }

  const drops = 4 + Math.floor(rand() * 9);
  for (let d = 0; d < drops; d += 1) {
    const t = rand() * 1.02;
    const along = t * strokeLen;
    const perp = (rand() - 0.5) * (0.12 + rand() * 0.14);
    const u = layout.tipU + layout.dirX * along + layout.perpX * perp + (rand() - 0.5) * 0.028;
    const v = layout.tipV + layout.dirY * along + layout.perpY * perp + (rand() - 0.5) * 0.028;
    addGaussianWeight(weights, size, u, v, 0.006 + rand() * 0.026, 0.12 + rand() * 0.55);
  }

  const flecks = 3 + Math.floor(rand() * 8);
  for (let f = 0; f < flecks; f += 1) {
    const along = rand() * strokeLen * (0.95 + rand() * 0.25);
    const side = rand() > 0.5 ? 1 : -1;
    const perp = side * (0.08 + rand() * 0.16);
    const u = layout.tipU + layout.dirX * along + layout.perpX * perp + (rand() - 0.5) * 0.04;
    const v = layout.tipV + layout.dirY * along + layout.perpY * perp + (rand() - 0.5) * 0.04;
    addGaussianWeight(weights, size, u, v, 0.004 + rand() * 0.015, 0.06 + rand() * 0.28);
  }

  let sumW = 0;
  for (let idx = 0; idx < weights.length; idx += 1) sumW += weights[idx] ?? 0;
  return sumW;
}

/** Unique seed for one pour (UI + simulation). */
export function createPourSeed(): number {
  return (Math.floor(Math.random() * 0x7fffffff) | 1);
}

/** Brush contact point in the well (for the fly-in animation). */
export function pourBrushTip(speed: SpeedVector, pourSeed: number): { x: number; y: number } {
  const layout = layoutForPour(speed, pourSeed);
  return { x: layout.tipU, y: layout.tipV };
}

export function pourSpeed(pourSeed?: number): SpeedVector {
  if (pourSeed === undefined) {
    return { x: SWIRL_OMEGA * 0.48, y: SWIRL_OMEGA * 0.72 };
  }
  const rand = pourRng(pourSeed ^ 0x51f15e01);
  const angle = rand() * Math.PI * 2;
  const mag = SWIRL_OMEGA * (0.55 + rand() * 0.7);
  return { x: Math.cos(angle) * mag, y: Math.sin(angle) * mag };
}

export function rotateClockwise(speed: SpeedVector, radians: number): SpeedVector {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: speed.x * cos - speed.y * sin,
    y: speed.x * sin + speed.y * cos,
  };
}

/** Velocity sampled at offset `dx`/`dy` from a pour landing (normalized coords). */
export function velocityAt(
  dx: number,
  dy: number,
  speed: SpeedVector,
  pourRadius: number = 0.09,
): SpeedVector {
  const r2 = dx * dx + dy * dy;
  const sigma2 = pourRadius * pourRadius;
  const envelope = Math.exp(-r2 / (2 * sigma2));
  if (envelope < 0.004) return { x: 0, y: 0 };
  return { x: speed.x * envelope, y: speed.y * envelope };
}

export function createField(size: number, color: RGB): Field {
  const cells = size * size;
  const field: Field = {
    size,
    px: new Float32Array(cells * 3),
    alt: new Float32Array(cells * 3),
    u: new Float32Array(cells),
    v: new Float32Array(cells),
    uAlt: new Float32Array(cells),
    vAlt: new Float32Array(cells),
  };
  fillField(field, color);
  return field;
}

export function fillField(field: Field, color: RGB): void {
  const { px, u, v } = field;
  for (let i = 0; i < px.length; i += 3) {
    px[i] = color.r;
    px[i + 1] = color.g;
    px[i + 2] = color.b;
  }
  u.fill(0);
  v.fill(0);
}

export function fieldMean(field: Field): RGB {
  const { size, px } = field;
  const count = size * size;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < px.length; i += 3) {
    r += px[i]!;
    g += px[i + 1]!;
    b += px[i + 2]!;
  }
  return { r: r / count, g: g / count, b: b / count };
}

/** Mean squared channel deviation from the field average. */
export function fieldSpread(field: Field): number {
  const mean = fieldMean(field);
  const { px } = field;
  let acc = 0;
  const n = px.length / 3;
  for (let i = 0; i < px.length; i += 3) {
    const dr = px[i]! - mean.r;
    const dg = px[i + 1]! - mean.g;
    const db = px[i + 2]! - mean.b;
    acc += dr * dr + dg * dg + db * db;
  }
  return acc / n;
}

function velocityEnergy(field: Field): number {
  const { u, v } = field;
  let acc = 0;
  for (let i = 0; i < u.length; i += 1) {
    acc += u[i]! * u[i]! + v[i]! * v[i]!;
  }
  return acc / u.length;
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

/**
 * Mass-conserving pour: mean moves to the new mix while pigment lays in as
 * a widening brush line with scattered drops.
 */
export function stampPour(
  field: Field,
  color: RGB,
  partsBefore: number = 1,
  speed: SpeedVector = pourSpeed(),
  pourSeed: number = 1,
): void {
  const { size, px } = field;
  const count = size * size;
  const parts = partsBefore >= 1 ? partsBefore : 1;
  const mean = fieldMean(field);
  const denom = parts + 1;
  const addR = (count * (color.r - mean.r)) / denom;
  const addG = (count * (color.g - mean.g)) / denom;
  const addB = (count * (color.b - mean.b)) / denom;

  const weights = new Float32Array(count);
  const sumW = buildPourWeights(weights, size, speed, pourSeed);
  if (sumW < 1e-6) return;

  const scaleR = addR / sumW;
  const scaleG = addG / sumW;
  const scaleB = addB / sumW;
  for (let idx = 0; idx < count; idx += 1) {
    const weight = weights[idx] ?? 0;
    if (weight === 0) continue;
    const offset = idx * 3;
    px[offset] = px[offset]! + scaleR * weight;
    px[offset + 1] = px[offset + 1]! + scaleG * weight;
    px[offset + 2] = px[offset + 2]! + scaleB * weight;
  }
}

/** Impart the poured fluid's velocity along the same brush stroke and drops. */
export function injectPourFlow(field: Field, speed: SpeedVector, pourSeed: number = 1): void {
  const mag = Math.hypot(speed.x, speed.y);
  if (mag < 1e-4) return;
  const { size, u, v } = field;
  const count = size * size;
  const weights = new Float32Array(count);
  buildPourWeights(weights, size, speed, pourSeed);
  let maxW = 0;
  for (let idx = 0; idx < count; idx += 1) {
    const w = weights[idx] ?? 0;
    if (w > maxW) maxW = w;
  }
  if (maxW < 1e-6) return;

  const layout = layoutForPour(speed, pourSeed);
  const outward = mag * MARBLE_DIFFUSION.spread;
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) {
      const idx = j * size + i;
      const weight = weights[idx] ?? 0;
      if (weight < 0.003) continue;
      const envelope = weight / maxW;
      const cu = (i + 0.5) / size;
      const cv = (j + 0.5) / size;
      const du = cu - layout.tipU;
      const dv = cv - layout.tipV;
      const r = Math.max(Math.hypot(du, dv), 0.02);
      const roll = mag * 0.22 * envelope;
      u[idx] = u[idx]! + speed.x * envelope + (du / r) * outward * envelope - (dv / r) * roll;
      v[idx] = v[idx]! + speed.y * envelope + (dv / r) * outward * envelope + (du / r) * roll;
    }
  }
  blurVelocity(field, 0.5);
}

function samplePx(px: Float32Array, size: number, u: number, v: number): [number, number, number] {
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

function sampleScalar(values: Float32Array, size: number, u: number, v: number): number {
  const x = Math.min(size - 1, Math.max(0, u * size - 0.5));
  const y = Math.min(size - 1, Math.max(0, v * size - 0.5));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(size - 1, x0 + 1);
  const y1 = Math.min(size - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const i00 = y0 * size + x0;
  const i10 = y0 * size + x1;
  const i01 = y1 * size + x0;
  const i11 = y1 * size + x1;
  return (
    values[i00]! * (1 - tx) * (1 - ty) +
    values[i10]! * tx * (1 - ty) +
    values[i01]! * (1 - tx) * ty +
    values[i11]! * tx * ty
  );
}

function reflectIndex(index: number, size: number): number {
  if (index < 0) return -index;
  if (index >= size) return 2 * size - index - 2;
  return index;
}

function smoothstep01(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Diffusivity ramps over the blend window (low while streaks advect, then rises).
 * ∂C/∂t + u·∇C = D(t)∇²C
 */
export function blendDiffusivity(elapsedSeconds: number, peakD: number): number {
  const u = Math.min(1, Math.max(0, elapsedSeconds / DIFFUSION_BLEND_SECONDS));
  const ramp = smoothstep01(u);
  const slowStart = ramp * ramp;
  const dMin = peakD * 0.04;
  return dMin + (peakD - dMin) * slowStart;
}

/** 0 at pour, 1 at DIFFUSION_BLEND_SECONDS (same timeline as diffusivity ramp). */
export function blendEase(elapsedSeconds: number): number {
  const u = Math.min(1, Math.max(0, elapsedSeconds / DIFFUSION_BLEND_SECONDS));
  return smoothstep01(u);
}

/** One implicit diffusion step: (I - dt·D·∇²) C⁺ = Cⁿ with reflected boundaries (GS). */
function implicitDiffuseDye(field: Field, diffusivity: number, dt: number, iterations = IMPLICIT_DIFFUSION_ITERATIONS): void {
  if (diffusivity <= 0 || dt <= 0) return;
  const alpha = diffusivity * dt;
  const denom = 1 + 4 * alpha;
  const { size, px, alt } = field;
  alt.set(px);

  for (let iter = 0; iter < iterations; iter += 1) {
    for (let j = 0; j < size; j += 1) {
      const jN = reflectIndex(j - 1, size);
      const jS = reflectIndex(j + 1, size);
      for (let i = 0; i < size; i += 1) {
        const iW = reflectIndex(i - 1, size);
        const iE = reflectIndex(i + 1, size);
        const c = (j * size + i) * 3;
        const l = (j * size + iW) * 3;
        const r = (j * size + iE) * 3;
        const u = (jN * size + i) * 3;
        const d = (jS * size + i) * 3;
        px[c] = (alt[c]! + alpha * (px[l]! + px[r]! + px[u]! + px[d]!)) / denom;
        px[c + 1] = (alt[c + 1]! + alpha * (px[l + 1]! + px[r + 1]! + px[u + 1]! + px[d + 1]!)) / denom;
        px[c + 2] = (alt[c + 2]! + alpha * (px[l + 2]! + px[r + 2]! + px[u + 2]! + px[d + 2]!)) / denom;
      }
    }
  }
}

function blurVelocity(field: Field, amount: number): void {
  if (amount <= 0) return;
  const { size, u, v, uAlt, vAlt } = field;
  const keep = 1 - amount;
  for (let j = 0; j < size; j += 1) {
    const j0 = j > 0 ? j - 1 : j;
    const j1 = j + 1 < size ? j + 1 : j;
    for (let i = 0; i < size; i += 1) {
      const i0 = i > 0 ? i - 1 : i;
      const i1 = i + 1 < size ? i + 1 : i;
      const c = j * size + i;
      const l = j * size + i0;
      const r = j * size + i1;
      const up = j0 * size + i;
      const d = j1 * size + i;
      uAlt[c] = u[c]! * keep + (u[l]! + u[r]! + u[up]! + u[d]!) * 0.25 * amount;
      vAlt[c] = v[c]! * keep + (v[l]! + v[r]! + v[up]! + v[d]!) * 0.25 * amount;
    }
  }
  field.u = uAlt;
  field.uAlt = u;
  field.v = vAlt;
  field.vAlt = v;
}

function advectDye(field: Field, dt: number): void {
  const { size, px, alt, u, v } = field;
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) {
      const posU = (i + 0.5) / size;
      const posV = (j + 0.5) / size;
      const velU = sampleScalar(u, size, posU, posV) * 0.82;
      const velV = sampleScalar(v, size, posU, posV) * 0.82;
      const backU = Math.min(1 - 1e-4, Math.max(1e-4, posU - velU * dt));
      const backV = Math.min(1 - 1e-4, Math.max(1e-4, posV - velV * dt));
      const [r, g, b] = samplePx(px, size, backU, backV);
      const offset = (j * size + i) * 3;
      alt[offset] = r;
      alt[offset + 1] = g;
      alt[offset + 2] = b;
    }
  }
  field.px = alt;
  field.alt = px;
}

function decayVelocity(field: Field, dt: number, decay: number): void {
  const factor = decay <= 0 ? 1 : Math.exp(-decay * dt);
  const { u, v } = field;
  for (let i = 0; i < u.length; i += 1) {
    u[i] = u[i]! * factor;
    v[i] = v[i]! * factor;
  }
}

function preserveMean(field: Field, target: RGB): void {
  const mean = fieldMean(field);
  const dr = target.r - mean.r;
  const dg = target.g - mean.g;
  const db = target.b - mean.b;
  if (Math.abs(dr) + Math.abs(dg) + Math.abs(db) < 0.02) return;
  const { px } = field;
  for (let i = 0; i < px.length; i += 3) {
    px[i] = px[i]! + dr;
    px[i + 1] = px[i + 1]! + dg;
    px[i + 2] = px[i + 2]! + db;
  }
}

export function stepField(
  field: Field,
  dt: number,
  rates: DiffusionRates = MARBLE_DIFFUSION,
  _goal?: RGB,
  blendElapsed = 0,
): void {
  const mean0 = fieldMean(field);

  if (velocityEnergy(field) > 0.004) advectDye(field, dt);
  preserveMean(field, mean0);

  let diffusivity = blendDiffusivity(blendElapsed, rates.dyeDiffuse);
  if (blendElapsed >= DIFFUSION_BLEND_SECONDS) diffusivity = rates.dyeDiffuse * 1.25;

  implicitDiffuseDye(field, diffusivity, dt);

  const visc = rates.velocityViscosity <= 0 ? 0 : 1 - Math.exp(-rates.velocityViscosity * dt);
  blurVelocity(field, visc * 0.35);
  decayVelocity(field, dt, rates.velocityDecay);
}

export function meanError(field: Field, target: RGB): number {
  const mean = fieldMean(field);
  return Math.max(Math.abs(mean.r - target.r), Math.abs(mean.g - target.g), Math.abs(mean.b - target.b));
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

export function isSettled(field: Field, target: RGB, blendElapsed = 0): boolean {
  const spread = fieldSpread(field);
  const calm = velocityEnergy(field) < 0.003;
  const meanOk = meanError(field, target) < 6;
  const uniform = spread < 42;
  if (blendElapsed >= DIFFUSION_BLEND_SECONDS) {
    return calm && meanOk && spread < 58;
  }
  return uniform && calm && meanOk && blendElapsed >= DIFFUSION_BLEND_SECONDS * 0.85;
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
