import { describe, expect, test } from 'vitest';
import { colorDistance } from '../shared/color.ts';
import {
  DIFFUSION_SIZE,
  createField,
  diffuse,
  fieldMean,
  fieldSpread,
  pourCell,
  renderField,
  stampPigment,
  type RGB,
} from '../shared/diffusion.ts';

const BASE: RGB = { r: 232, g: 226, b: 214 };
const VERMILION: RGB = { r: 217, g: 58, b: 42 };
const ULTRAMARINE: RGB = { r: 36, g: 58, b: 184 };

function cellIndex(x: number, y: number): number {
  return (Math.round(y) * DIFFUSION_SIZE + Math.round(x)) * 3;
}

function pixelAt(pixels: Uint8ClampedArray, x: number, y: number): RGB {
  const index = (Math.round(y) * DIFFUSION_SIZE + Math.round(x)) * 4;
  return { r: pixels[index] ?? 0, g: pixels[index + 1] ?? 0, b: pixels[index + 2] ?? 0 };
}

describe('diffusion field', () => {
  test('starts as a uniform pool of the base color', () => {
    const field = createField(BASE);
    expect(field).toHaveLength(DIFFUSION_SIZE * DIFFUSION_SIZE * 3);
    expect(fieldMean(field)).toEqual(BASE);
    expect(fieldSpread(field)).toBe(0);
  });

  test('a pour keeps the mixed average and plants a concentrated bloom', () => {
    const field = createField(BASE);
    const point = pourCell(0);
    stampPigment(field, VERMILION, 1, point);

    expect(fieldMean(field).r).toBeCloseTo((BASE.r + VERMILION.r) / 2, 2);
    expect(fieldMean(field).g).toBeCloseTo((BASE.g + VERMILION.g) / 2, 2);
    expect(fieldMean(field).b).toBeCloseTo((BASE.b + VERMILION.b) / 2, 2);

    const bloom = cellIndex(point.x, point.y);
    const corner = 0;
    expect(field[bloom + 1] ?? 0).toBeLessThan((field[corner + 1] ?? 0) - 40);
    expect(fieldSpread(field)).toBeGreaterThan(100);

    const pixels = new Uint8ClampedArray(DIFFUSION_SIZE * DIFFUSION_SIZE * 4);
    renderField(field, pixels);
    const ink = pixelAt(pixels, point.x, point.y);
    const rim = pixelAt(pixels, 1, 1);
    expect(ink.r).toBeGreaterThan(ink.g + 40);
    expect(ink.r).toBeGreaterThan(ink.b + 40);
    expect(rim.r).toBeGreaterThan(200);
    expect(rim.g).toBeGreaterThan(180);
  });

  test('diffusion spreads pigment without drifting the average or moving the surface', () => {
    const field = createField(BASE);
    const scratch = createField({ r: 0, g: 0, b: 0 });
    stampPigment(field, VERMILION, 1, pourCell(0));
    const mean = fieldMean(field);
    const spread = fieldSpread(field);

    const delta = diffuse(field, scratch, 0.2, 80);

    expect(delta).toBeGreaterThan(0);
    expect(fieldMean(field).r).toBeCloseTo(mean.r, 2);
    expect(fieldMean(field).g).toBeCloseTo(mean.g, 2);
    expect(fieldMean(field).b).toBeCloseTo(mean.b, 2);
    expect(fieldSpread(field)).toBeLessThan(spread * 0.8);
    expect(field).toHaveLength(scratch.length);
  });

  test('a uniform well stays uniform', () => {
    const field = createField({ r: 10, g: 20, b: 30 });
    const scratch = createField({ r: 0, g: 0, b: 0 });
    expect(diffuse(field, scratch, 0.2, 30)).toBe(0);
    expect(field[0]).toBe(10);
    expect(field[field.length - 1]).toBe(30);
    expect(fieldSpread(field)).toBe(0);
  });

  test('two pours stay visibly apart, then blend toward one color', () => {
    const field = createField(BASE);
    const scratch = createField({ r: 0, g: 0, b: 0 });
    const first = pourCell(0);
    const second = pourCell(1);
    stampPigment(field, VERMILION, 1, first);
    stampPigment(field, ULTRAMARINE, 2, second);

    const expected = {
      r: (BASE.r + VERMILION.r + ULTRAMARINE.r) / 3,
      g: (BASE.g + VERMILION.g + ULTRAMARINE.g) / 3,
      b: (BASE.b + VERMILION.b + ULTRAMARINE.b) / 3,
    };
    expect(fieldMean(field).r).toBeCloseTo(expected.r, 2);
    expect(fieldMean(field).g).toBeCloseTo(expected.g, 2);
    expect(fieldMean(field).b).toBeCloseTo(expected.b, 2);

    const pixels = new Uint8ClampedArray(DIFFUSION_SIZE * DIFFUSION_SIZE * 4);
    renderField(field, pixels);
    const red = pixelAt(pixels, first.x, first.y);
    const blue = pixelAt(pixels, second.x, second.y);
    expect(red.r).toBeGreaterThan(red.b + 30);
    expect(blue.b).toBeGreaterThan(blue.r + 30);
    const apart = colorDistance(red, blue);
    expect(apart).toBeGreaterThan(120);

    diffuse(field, scratch, 0.2, 2200);
    renderField(field, pixels);
    const blended = colorDistance(pixelAt(pixels, first.x, first.y), pixelAt(pixels, second.x, second.y));
    expect(blended).toBeLessThan(apart * 0.45);
    expect(fieldMean(field).r).toBeCloseTo(expected.r, 1);
    expect(fieldMean(field).g).toBeCloseTo(expected.g, 1);
    expect(fieldMean(field).b).toBeCloseTo(expected.b, 1);
  });

  test('the display keeps a pour in gamut and successive landings sit apart inside the well', () => {
    const field = createField(BASE);
    const pixels = new Uint8ClampedArray(DIFFUSION_SIZE * DIFFUSION_SIZE * 4);
    renderField(field, pixels);
    expect(pixels[0]).toBe(BASE.r);
    expect(pixels[1]).toBe(BASE.g);
    expect(pixels[2]).toBe(BASE.b);
    expect(pixels[3]).toBe(255);

    field[0] = -40;
    field[1] = 400;
    field[2] = 128;
    renderField(field, pixels);
    expect(pixels[0]).toBe(0);
    expect(pixels[1]).toBe(255);
    expect(pixels[2]).toBe(97);
    expect(pixels[3]).toBe(255);

    const seen = new Set<string>();
    for (let index = 0; index < 6; index += 1) {
      const point = pourCell(index);
      expect(point.x).toBeGreaterThan(6);
      expect(point.y).toBeGreaterThan(6);
      expect(point.x).toBeLessThan(DIFFUSION_SIZE - 7);
      expect(point.y).toBeLessThan(DIFFUSION_SIZE - 7);
      seen.add(`${Math.round(point.x)}:${Math.round(point.y)}`);
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });
});
