import { expect, test } from 'vitest';
import { mixColors } from '../shared/color.ts';
import {
  createField,
  FAST_DIFFUSION,
  fieldError,
  pigmentCentroid,
  pourSpeed,
  rotateClockwise,
  stampPour,
  stepField,
  SWIRL_DIRECTION,
  SWIRL_OMEGA,
  velocityAt,
  type DiffusionRates,
} from '../shared/diffusion.ts';

const MILK = { r: 232, g: 226, b: 214 };
const COFFEE = { r: 92, g: 52, b: 32 };

test('the pour speed is a fast clockwise vector pointing right', () => {
  const speed = pourSpeed();
  expect(SWIRL_DIRECTION).toBe('clockwise');
  expect(speed).toEqual({ x: SWIRL_OMEGA, y: 0 });
  expect(SWIRL_OMEGA).toBeGreaterThan(12);
  expect(FAST_DIFFUSION.finishSettle).toBeGreaterThan(FAST_DIFFUSION.settle * 8);
});

test('velocity turns clockwise and a rightward vector rotates downward', () => {
  const top = velocityAt(0, -0.25, pourSpeed(), 0);
  const right = velocityAt(0.25, 0, pourSpeed(), 0);
  const bottom = velocityAt(0, 0.25, pourSpeed(), 0);
  const left = velocityAt(-0.25, 0, pourSpeed(), 0);

  expect(top.x).toBeGreaterThan(0);
  expect(top.y).toBeCloseTo(0);
  expect(right.y).toBeGreaterThan(0);
  expect(right.x).toBeCloseTo(0);
  expect(bottom.x).toBeLessThan(0);
  expect(left.y).toBeLessThan(0);

  const turned = rotateClockwise({ x: 4, y: 0 }, Math.PI / 2);
  expect(turned.x).toBeCloseTo(0);
  expect(turned.y).toBeCloseTo(4);
});

test('a drop swirls clockwise, then the fast finish lands on the mixed color', () => {
  const toward = mixColors(MILK, [COFFEE]);
  const field = createField(48, MILK);
  stampPour(field, COFFEE);
  const start = pigmentCentroid(field, MILK);

  const swirl: DiffusionRates = {
    ...FAST_DIFFUSION,
    blur: 0.4,
    settle: 0,
    decay: 0,
    finishBlur: 0.4,
    finishSettle: 0,
    finishDecay: 0,
  };
  let speed = pourSpeed();
  for (let i = 0; i < 8; i += 1) speed = stepField(field, speed, 1 / 60, toward, swirl);
  const moved = pigmentCentroid(field, MILK);

  expect(moved.x).toBeGreaterThan(start.x + 0.015);
  expect(speed.y).toBeGreaterThan(0);

  const fast = createField(48, MILK);
  stampPour(fast, COFFEE);
  let fastSpeed = pourSpeed();
  for (let i = 0; i < 45; i += 1) fastSpeed = stepField(fast, fastSpeed, 1 / 60, toward);

  const slowRates: DiffusionRates = {
    ...FAST_DIFFUSION,
    blur: 0.35,
    settle: 0.35,
    decay: 0.35,
    finishBlur: 0.35,
    finishSettle: 0.35,
    finishDecay: 0.35,
    finishBelow: 0,
  };
  const slow = createField(48, MILK);
  stampPour(slow, COFFEE);
  let slowSpeed = pourSpeed();
  for (let i = 0; i < 30; i += 1) slowSpeed = stepField(slow, slowSpeed, 1 / 60, toward, slowRates);

  expect(fieldError(fast, toward)).toBeLessThan(8);
  expect(fastSpeed).toEqual({ x: 0, y: 0 });
  expect(fieldError(fast, toward)).toBeLessThan(fieldError(slow, toward) / 4);
});
