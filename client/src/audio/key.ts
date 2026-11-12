import type { Chord } from './pigment-chords.ts';

/** Fixed key for the whole campaign (A minor, middle register). */
export const GAME_TONIC_MIDI = 57;

const SCALE_DEGREES = [0, 2, 3, 5, 7, 8, 10] as const;

/** Center of the playing range — same on every level. */
export const GAME_VOICING_CENTER = 58;

function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

function scalePitchClasses(): number[] {
  const tonicPc = pitchClass(GAME_TONIC_MIDI);
  return SCALE_DEGREES.map((degree) => (tonicPc + degree) % 12);
}

export function snapMidiToGameKey(midi: number): number {
  const pcs = scalePitchClasses();
  const octave = Math.floor(midi / 12);
  let best = midi;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let o = octave - 2; o <= octave + 2; o += 1) {
    for (const pc of pcs) {
      const candidate = o * 12 + pc;
      const distance = Math.abs(candidate - midi);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
  }
  return Math.min(72, Math.max(48, best));
}

export function normalizeVoicing(chord: Chord, center = GAME_VOICING_CENTER): Chord {
  const snapped = chord.map((midi) => snapMidiToGameKey(midi));
  const mean = snapped.reduce((sum, midi) => sum + midi, 0) / snapped.length;
  const shift = Math.round(center - mean);
  const shifted = snapped.map((midi) => snapMidiToGameKey(midi + shift));
  return [...shifted].sort((a, b) => a - b);
}

export function scaleDegreeToMidi(degree: number, octave: number): number {
  const index = ((degree % 7) + 7) % 7;
  const semitone = SCALE_DEGREES[index] ?? 0;
  const tonicPc = pitchClass(GAME_TONIC_MIDI);
  const pc = (tonicPc + semitone) % 12;
  return octave * 12 + pc;
}
