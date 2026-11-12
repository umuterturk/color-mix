import { colorDistance, isMatch, mixColors, type RGB } from './color.ts';
import type { PublicRound } from './types.ts';

export type MixState = {
  drops: RGB[];
  base: RGB;
  target: RGB;
  maxDrops: number;
};

export function emptyMix(round: PublicRound): MixState {
  return {
    drops: [],
    base: round.base,
    target: round.target,
    maxDrops: round.maxDrops,
  };
}

export function addDrop(state: MixState, pigment: RGB): MixState {
  if (state.drops.length >= state.maxDrops) return state;
  return { ...state, drops: [...state.drops, pigment] };
}

export function clearDrops(state: MixState): MixState {
  if (state.drops.length === 0) return state;
  return { ...state, drops: [] };
}

export function currentMix(state: MixState): RGB {
  return mixColors(state.base, state.drops);
}

export function matched(state: MixState): boolean {
  return isMatch(colorDistance(currentMix(state), state.target));
}
