import { expect, test } from 'vitest';
import { assertPigmentChordCoverage, chordsForPigment, pickChord, PIGMENT_CHORDS } from '../src/audio/pigment-chords.ts';
import { CATALOG } from '../../shared/round.ts';

test('every catalog pigment has chord voicings', () => {
  expect(() => assertPigmentChordCoverage()).not.toThrow();
  for (const pigment of CATALOG) {
    expect(PIGMENT_CHORDS[pigment.id]?.length).toBeGreaterThanOrEqual(2);
    expect(chordsForPigment(pigment.id)[0]!.length).toBeGreaterThanOrEqual(3);
  }
});

test('pickChord chooses from the pigment list', () => {
  const chord = pickChord('vermilion', () => 0);
  expect(chord).toEqual(PIGMENT_CHORDS.vermilion?.[0]);
});
