import { expect, test } from 'vitest';
import { mixColors } from '../shared/color.ts';
import {
  createField,
  DIFFUSION_BLEND_SECONDS,
  fieldMean,
  fieldSpread,
  injectPourFlow,
  MARBLE_DIFFUSION,
  pigmentCentroid,
  pourBrushTip,
  pourSpeed,
  rotateClockwise,
  stampPour,
  stepField,
  SWIRL_DIRECTION,
  velocityAt,
  type Field,
} from '../shared/diffusion.ts';

const MILK = { r: 232, g: 226, b: 214 };
const COFFEE = { r: 92, g: 52, b: 32 };
const POUR_SEED_A = 0x6d2b_79f5;
const POUR_SEED_B = 0x1656_67b1;

function sampleFlow(field: Field, u: number, v: number): { x: number; y: number } {
  const { size } = field;
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
  const w00 = (1 - tx) * (1 - ty);
  const w10 = tx * (1 - ty);
  const w01 = (1 - tx) * ty;
  const w11 = tx * ty;
  return {
    x:
      field.u[i00]! * w00 +
      field.u[i10]! * w10 +
      field.u[i01]! * w01 +
      field.u[i11]! * w11,
    y:
      field.v[i00]! * w00 +
      field.v[i10]! * w10 +
      field.v[i01]! * w01 +
      field.v[i11]! * w11,
  };
}

test('a pour carries its own speed vector, not a well-center spin', () => {
  const speed = pourSpeed(POUR_SEED_A);
  expect(SWIRL_DIRECTION).toBe('clockwise');
  expect(Math.hypot(speed.x, speed.y)).toBeGreaterThan(5.5);
  expect(DIFFUSION_BLEND_SECONDS).toBe(5);

  const field = createField(48, MILK);
  injectPourFlow(field, speed, POUR_SEED_A);
  const tip = pourBrushTip(speed, POUR_SEED_A);
  const atPour = sampleFlow(field, tip.x, tip.y);
  const atCenter = sampleFlow(field, 0.5, 0.5);
  expect(Math.hypot(atPour.x, atPour.y)).toBeGreaterThan(0.65);
  expect(Math.hypot(atCenter.x, atCenter.y)).toBeLessThan(Math.hypot(atPour.x, atPour.y) * 0.55);
});

test('each pour seed picks a different brush position', () => {
  const speed = pourSpeed(POUR_SEED_A);
  const a = pourBrushTip(speed, POUR_SEED_A);
  const b = pourBrushTip(speed, POUR_SEED_B);
  const apart = Math.hypot(a.x - b.x, a.y - b.y);
  expect(apart).toBeGreaterThan(0.08);
});

test('velocityAt is tied to the pour site, not the well center', () => {
  const speed = pourSpeed(POUR_SEED_A);
  const atLanding = velocityAt(0, 0, speed);
  const offBlob = velocityAt(0.28, 0, speed);

  expect(Math.hypot(atLanding.x, atLanding.y)).toBeGreaterThan(Math.hypot(speed.x, speed.y) * 0.75);
  expect(Math.hypot(offBlob.x, offBlob.y)).toBeLessThan(0.2);

  const turned = rotateClockwise({ x: 4, y: 0 }, Math.PI / 2);
  expect(turned.x).toBeCloseTo(0);
  expect(turned.y).toBeCloseTo(4);
});

test('pigment enters as a widening brush line with drops, not one lump', () => {
  const speed = pourSpeed(POUR_SEED_A);
  const field = createField(48, MILK);
  stampPour(field, COFFEE, 1, speed, POUR_SEED_A);
  const tip = pourBrushTip(speed, POUR_SEED_A);
  const centroid = pigmentCentroid(field, MILK);
  const mag = Math.hypot(speed.x, speed.y);
  const along = (centroid.x - tip.x) * (speed.x / mag) + (centroid.y - tip.y) * (speed.y / mag);
  expect(along).toBeGreaterThan(0.02);
  expect(fieldSpread(field)).toBeGreaterThan(800);
});

test('poured pigment drifts with its momentum then homogenizes in about five seconds', () => {
  const toward = mixColors(MILK, [COFFEE]);
  const speed = pourSpeed(POUR_SEED_A);
  const field = createField(48, MILK);
  stampPour(field, COFFEE, 1, speed, POUR_SEED_A);
  injectPourFlow(field, speed, POUR_SEED_A);
  const start = pigmentCentroid(field, MILK);

  for (let i = 0; i < 120; i += 1) stepField(field, 1 / 60, { ...MARBLE_DIFFUSION, dyeDiffuse: 0 }, toward, i / 60);
  const moved = pigmentCentroid(field, MILK);

  const drift = Math.hypot(moved.x - start.x, moved.y - start.y);
  expect(drift).toBeGreaterThan(0.003);

  const blend = createField(48, MILK);
  stampPour(blend, COFFEE, 1, speed, POUR_SEED_A);
  injectPourFlow(blend, speed, POUR_SEED_A);
  const steps = Math.round(DIFFUSION_BLEND_SECONDS * 60);
  const midStep = Math.round(steps * 0.45);
  for (let i = 0; i < midStep; i += 1) stepField(blend, 1 / 60, MARBLE_DIFFUSION, toward, i / 60);
  const midSpread = fieldSpread(blend);
  for (let i = midStep; i < steps; i += 1) stepField(blend, 1 / 60, MARBLE_DIFFUSION, toward, i / 60);

  const lateSpread = fieldSpread(blend);
  expect(midSpread).toBeGreaterThan(lateSpread * 1.25);
  expect(lateSpread).toBeLessThan(55);
  const mean = fieldMean(blend);
  expect(Math.abs(mean.r - toward.r)).toBeLessThan(6);
  expect(Math.abs(mean.g - toward.g)).toBeLessThan(6);
  expect(Math.abs(mean.b - toward.b)).toBeLessThan(6);
});
