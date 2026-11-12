import { mixColors, type RGB } from './color.ts';
import type { Pigment, PlannedRound, PublicRound } from './types.ts';

export const ROUND_BASE: RGB = { r: 232, g: 226, b: 214 };

export const CATALOG: readonly Pigment[] = [
  { id: 'vermilion', name: 'vermilion', rgb: { r: 217, g: 58, b: 42 } },
  { id: 'ultramarine', name: 'ultramarine', rgb: { r: 36, g: 58, b: 184 } },
  { id: 'chrome', name: 'chrome', rgb: { r: 242, g: 186, b: 22 } },
  { id: 'viridian', name: 'viridian', rgb: { r: 22, g: 122, b: 96 } },
  { id: 'rose', name: 'rose', rgb: { r: 214, g: 62, b: 130 } },
  { id: 'ochre', name: 'ochre', rgb: { r: 196, g: 122, b: 42 } },
  { id: 'bone', name: 'bone', rgb: { r: 236, g: 230, b: 218 } },
  { id: 'lamp', name: 'lamp', rgb: { r: 32, g: 30, b: 28 } },
];

function randomIndex(rng: () => number, length: number): number {
  if (length <= 1) return 0;
  return Math.min(length - 1, Math.floor(rng() * length));
}

function pickPigments(rng: () => number): Pigment[] {
  const pool = [...CATALOG];
  const picked: Pigment[] = [];
  while (picked.length < 3 && pool.length > 0) {
    const index = randomIndex(rng, pool.length);
    const [pigment] = pool.splice(index, 1);
    if (pigment) picked.push(pigment);
  }
  return picked;
}

function planCounts(rng: () => number, pigmentCount: number): number[] {
  const counts = Array.from({ length: pigmentCount }, () => 0);
  const total = 2 + Math.min(2, Math.floor(rng() * 3));
  for (let drop = 0; drop < total; drop += 1) {
    const index = randomIndex(rng, pigmentCount);
    counts[index] = (counts[index] ?? 0) + 1;
  }

  const used = counts.reduce((sum, count) => sum + (count > 0 ? 1 : 0), 0);
  if (used < 2 && pigmentCount >= 2) {
    let primary = counts.findIndex((count) => count > 0);
    if (primary < 0) primary = 0;
    if ((counts[primary] ?? 0) < 2) counts[primary] = 2;
    const other = primary === 0 ? 1 : 0;
    counts[primary] = (counts[primary] ?? 1) - 1;
    counts[other] = (counts[other] ?? 0) + 1;
  }

  return counts;
}

export function expandCounts(pigments: readonly Pigment[], counts: readonly number[]): RGB[] {
  const drops: RGB[] = [];
  counts.forEach((count, index) => {
    const rgb = pigments[index]?.rgb;
    if (!rgb || count <= 0) return;
    for (let i = 0; i < count; i += 1) drops.push(rgb);
  });
  return drops;
}

export function planRound(rng: () => number = Math.random): PlannedRound {
  const pigments = pickPigments(rng);
  const counts = planCounts(rng, pigments.length);
  const drops = expandCounts(pigments, counts);
  const publicRound: PublicRound = {
    id: crypto.randomUUID(),
    base: ROUND_BASE,
    target: mixColors(ROUND_BASE, drops),
    pigments,
    maxDrops: drops.length + 2,
  };
  return { publicRound, counts };
}
