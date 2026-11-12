import { expect, test } from 'vitest';
import { blendChords, chordFromColor } from '../src/audio/color-chords.ts';
import { normalizeVoicing } from '../src/audio/key.ts';

test('chordFromColor is stable for the same swatch', () => {
  const color = { r: 120, g: 90, b: 60 };
  expect(chordFromColor(color)).toEqual(chordFromColor(color));
  expect(chordFromColor(color).length).toBeGreaterThanOrEqual(3);
});

test('chordFromColor keeps notes in the shared campaign register', () => {
  const chord = chordFromColor({ r: 36, g: 58, b: 184 });
  for (const midi of chord) {
    expect(midi).toBeGreaterThanOrEqual(48);
    expect(midi).toBeLessThanOrEqual(72);
  }
});

test('blendChords normalizes into the game key', () => {
  const pigment = normalizeVoicing([57, 60, 64]);
  const target = chordFromColor({ r: 200, g: 140, b: 80 });
  const blended = blendChords(pigment, target, 0.5);
  for (const midi of blended) {
    expect(midi).toBeGreaterThanOrEqual(48);
    expect(midi).toBeLessThanOrEqual(72);
  }
  expect(blendChords(pigment, target, 0)).toEqual(pigment);
  expect(blendChords(pigment, target, 1)).toEqual(target);
});
