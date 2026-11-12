import { colorDistance, isMatch, mixColors, type RGB } from './color.ts';
import { createPourSeed, pourSpeed, type SpeedVector } from './diffusion.ts';
import type { PublicRound } from './types.ts';

export type MixState = {
  drops: RGB[];
  /** Per-pour layout seed so brush position and splatter vary each time. */
  pourSeeds: number[];
  base: RGB;
  target: RGB;
  maxDrops: number;
  /** Velocity carried by the last pour, localized on the pigment blob. */
  speed: SpeedVector;
};

export function emptyMix(round: PublicRound): MixState {
  return {
    drops: [],
    pourSeeds: [],
    base: round.base,
    target: round.target,
    maxDrops: round.maxDrops,
    speed: { x: 0, y: 0 },
  };
}

export function addDrop(state: MixState, pigment: RGB, pourSeed: number = createPourSeed()): MixState {
  if (state.drops.length >= state.maxDrops) return state;
  return {
    ...state,
    drops: [...state.drops, pigment],
    pourSeeds: [...state.pourSeeds, pourSeed],
    speed: pourSpeed(pourSeed),
  };
}

export function clearDrops(state: MixState): MixState {
  if (state.drops.length === 0) return state;
  return { ...state, drops: [], pourSeeds: [], speed: { x: 0, y: 0 } };
}

export function currentMix(state: MixState): RGB {
  return mixColors(state.base, state.drops);
}

export function matched(state: MixState): boolean {
  return isMatch(colorDistance(currentMix(state), state.target));
}
