import { describe, expect, test } from 'vitest';
import { closeness, colorDistance, isMatch, MATCH_DISTANCE, mixColors, rgbCss } from '../shared/color.ts';

describe('mixColors', () => {
  test('returns the base when nothing has been poured', () => {
    expect(mixColors({ r: 10, g: 20, b: 30 }, [])).toEqual({ r: 10, g: 20, b: 30 });
  });

  test('averages the base and every drop, then rounds into 0..255', () => {
    expect(
      mixColors({ r: 0, g: 0, b: 0 }, [
        { r: 100, g: 0, b: 0 },
        { r: 0, g: 50, b: 0 },
      ]),
    ).toEqual({ r: 33, g: 17, b: 0 });

    expect(mixColors({ r: 250, g: 250, b: 250 }, [{ r: 255, g: 255, b: 255 }])).toEqual({
      r: 253,
      g: 253,
      b: 253,
    });

    expect(mixColors({ r: -20, g: 0, b: 300 }, [])).toEqual({ r: 0, g: 0, b: 255 });
  });
});

describe('colorDistance', () => {
  test('is zero for the same color and symmetric', () => {
    const a = { r: 10, g: 20, b: 30 };
    const b = { r: 200, g: 80, b: 10 };
    expect(colorDistance(a, a)).toBe(0);
    expect(colorDistance(a, b)).toBe(colorDistance(b, a));
    expect(colorDistance(a, b)).toBeGreaterThan(0);
  });
});

describe('closeness', () => {
  test('stays inside 0..1 and falls as distance grows', () => {
    expect(closeness(0)).toBe(1);
    expect(closeness(-5)).toBe(1);
    expect(closeness(160)).toBeCloseTo(0.5);
    expect(closeness(320)).toBe(0);
    expect(closeness(10000)).toBe(0);
  });
});

describe('isMatch', () => {
  test('accepts distances within the match window', () => {
    expect(MATCH_DISTANCE).toBe(48);
    expect(isMatch(0)).toBe(true);
    expect(isMatch(MATCH_DISTANCE)).toBe(true);
    expect(isMatch(MATCH_DISTANCE + 1)).toBe(false);
  });
});

describe('rgbCss', () => {
  test('formats a modern rgb() value', () => {
    expect(rgbCss({ r: 1, g: 2, b: 3 })).toBe('rgb(1 2 3)');
  });
});
