import { CATALOG } from '../../../shared/round.ts';

/** MIDI note numbers for each voicing. */
export type Chord = readonly number[];

/** Several voicings per pigment; one is chosen at random each pour. */
export const PIGMENT_CHORDS: Record<string, readonly Chord[]> = {
  vermilion: [
    [57, 60, 64],
    [59, 62, 67],
    [55, 59, 62],
  ],
  ultramarine: [
    [50, 53, 57, 60],
    [48, 52, 55],
    [45, 48, 52, 55],
  ],
  chrome: [
    [60, 64, 67],
    [62, 65, 69],
    [59, 62, 67],
  ],
  viridian: [
    [52, 55, 59],
    [50, 53, 57],
    [55, 59, 62],
  ],
  rose: [
    [53, 57, 60, 64],
    [50, 53, 57],
    [57, 60, 64, 67],
  ],
  ochre: [
    [55, 59, 62],
    [57, 60, 64],
    [52, 55, 59, 62],
  ],
  bone: [
    [60, 64, 67, 71],
    [57, 60, 64],
    [62, 65, 69],
  ],
  lamp: [
    [43, 46, 50],
    [45, 48, 52],
    [41, 44, 48, 51],
  ],
};

export function chordsForPigment(pigmentId: string): readonly Chord[] {
  return PIGMENT_CHORDS[pigmentId] ?? [[60, 64, 67]];
}

export function pickChord(pigmentId: string, rng: () => number = Math.random): Chord {
  const options = chordsForPigment(pigmentId);
  const index = Math.min(options.length - 1, Math.floor(rng() * options.length));
  return options[index] ?? [60, 64, 67];
}

/** Ensures every catalog pigment has at least one chord voicing. */
export function assertPigmentChordCoverage(): void {
  for (const pigment of CATALOG) {
    const chords = PIGMENT_CHORDS[pigment.id];
    if (!chords?.length) throw new Error(`missing chords for ${pigment.id}`);
  }
}
