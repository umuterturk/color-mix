import { mixColors } from './color.ts';
import { CATALOG, expandCounts, ROUND_BASE } from './round.ts';
import type { Pigment, PlannedRound, PublicRound } from './types.ts';

export const LEVEL_COUNT = 20;

/** Wavelength of the easier/harder “breathing” on top of the upward trend (in levels). */
const DIFFICULTY_WAVE_PERIOD = 6.5;

export type LevelSpec = {
  level: number;
  pigments: Pigment[];
  counts: [number, number, number];
  maxDrops: number;
  /** Blended trend + sine, roughly 0 (easiest) → 1 (hardest). */
  difficulty: number;
};

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickPigmentsForLevel(level: number, rng: () => number): Pigment[] {
  const pool = [...CATALOG];
  const start = ((level - 1) * 3) % pool.length;
  const rotated = [...pool.slice(start), ...pool.slice(0, start)];
  const picked: Pigment[] = [];
  const working = [...rotated];
  while (picked.length < 3 && working.length > 0) {
    const index = Math.min(working.length - 1, Math.floor(rng() * working.length));
    const [pigment] = working.splice(index, 1);
    if (pigment) picked.push(pigment);
  }
  return picked;
}

function activePigments(counts: readonly number[]): number {
  return counts.filter((count) => count > 0).length;
}

function recipeCounts(rng: () => number, recipeDrops: number, minPigments: number): [number, number, number] {
  const counts: [number, number, number] = [0, 0, 0];
  const pigments = Math.min(3, Math.max(2, minPigments));
  for (let index = 0; index < pigments; index += 1) counts[index] = 1;
  let remaining = recipeDrops - pigments;
  while (remaining > 0) {
    const index = Math.floor(rng() * pigments);
    counts[index] = (counts[index] ?? 0) + 1;
    remaining -= 1;
  }
  if (activePigments(counts) < 2) {
    counts[0] = Math.max(counts[0] ?? 0, 1);
    counts[1] = Math.max(counts[1] ?? 0, 1);
  }
  return counts;
}

function levelDifficulty(level: number): number {
  const index = level - 1;
  const trend = index / (LEVEL_COUNT - 1);
  const wave = Math.sin((index * Math.PI * 2) / DIFFICULTY_WAVE_PERIOD);
  return Math.min(1, Math.max(0, trend + 0.16 * wave));
}

function recipeDropsForDifficulty(d: number, wave: number): number {
  return clampInt(2 + d * 3.6 + Math.max(0, wave) * 0.7, 2, 6);
}

function dropMarginForDifficulty(d: number, wave: number): number {
  return clampInt(2.5 - d * 2 + wave * 0.55, 0, 3);
}

function minPigmentsForDifficulty(d: number, recipeDrops: number, wave: number): number {
  if (recipeDrops <= 3) return 2;
  if (wave < -0.25) return 2;
  if (d > 0.42) return 3;
  return 2;
}

function buildLevel(level: number): LevelSpec {
  const d = levelDifficulty(level);
  const wave = Math.sin(((level - 1) * Math.PI * 2) / DIFFICULTY_WAVE_PERIOD);
  const rng = mulberry32(level * 0x85eb_ca6b);
  const pigments = pickPigmentsForLevel(level, rng);
  const recipeDrops = recipeDropsForDifficulty(d, wave);
  const minPigments = minPigmentsForDifficulty(d, recipeDrops, wave);
  const counts = recipeCounts(rng, recipeDrops, minPigments);
  const margin = dropMarginForDifficulty(d, wave);
  const total = counts.reduce((sum, count) => sum + count, 0);
  return {
    level,
    pigments,
    counts,
    maxDrops: total + margin,
    difficulty: d,
  };
}

export const LEVELS: readonly LevelSpec[] = Array.from({ length: LEVEL_COUNT }, (_, index) => buildLevel(index + 1));

export function normalizeLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.min(LEVEL_COUNT, Math.max(1, Math.floor(level)));
}

export function getLevel(level: number): LevelSpec {
  return LEVELS[normalizeLevel(level) - 1]!;
}

export function planLevel(level: number): PlannedRound {
  const spec = getLevel(level);
  const drops = expandCounts(spec.pigments, spec.counts);
  const publicRound: PublicRound = {
    id: `level-${String(spec.level).padStart(2, '0')}`,
    base: ROUND_BASE,
    target: mixColors(ROUND_BASE, drops),
    pigments: spec.pigments,
    maxDrops: spec.maxDrops,
  };
  return { publicRound, counts: [...spec.counts] };
}
