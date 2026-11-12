import type { RGB } from '../../../shared/color.ts';
import type { Chord } from './pigment-chords.ts';
import { normalizeVoicing, scaleDegreeToMidi } from './key.ts';

type Hsl = { h: number; s: number; l: number };

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d > 1e-6) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
        break;
      case gn:
        h = ((bn - rn) / d + 2) * 60;
        break;
      default:
        h = ((rn - gn) / d + 4) * 60;
        break;
    }
  }
  return { h, s, l };
}

/** Swatch → chord in the fixed game key (hue picks scale degree, not absolute pitch). */
export function chordFromColor(color: RGB): Chord {
  const { h, s, l } = rgbToHsl(color.r, color.g, color.b);
  const rootDegree = Math.min(6, Math.floor((h / 360) * 7));
  const octave = l < 0.34 ? 3 : l > 0.68 ? 5 : 4;
  const thirdStep = s < 0.18 ? 1 : s > 0.42 ? 3 : 2;
  const fifthStep = 4;
  const notes = [
    scaleDegreeToMidi(rootDegree, octave),
    scaleDegreeToMidi(rootDegree + thirdStep, octave),
    scaleDegreeToMidi(rootDegree + fifthStep, octave),
  ];
  if (s > 0.28 && l > 0.3) notes.push(scaleDegreeToMidi(rootDegree + 6, octave));
  return normalizeVoicing(notes);
}

export function blendChords(pigment: Chord, target: Chord, amount: number): Chord {
  const t = Math.min(1, Math.max(0, amount));
  if (t <= 0) return normalizeVoicing(pigment);
  if (t >= 1) return normalizeVoicing(target);
  const length = Math.max(pigment.length, target.length);
  const blended = Array.from({ length }, (_, index) => {
    const from = pigment[index % pigment.length]!;
    const to = target[index % target.length]!;
    return Math.round(from + (to - from) * t);
  });
  return normalizeVoicing(blended);
}
