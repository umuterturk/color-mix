import { colorDistance, isMatch, mixColors, type RGB } from './color.ts';
import { pourSpeed, type SpeedVector } from './diffusion.ts';
import type { PublicRound } from './types.ts';

export type MixState = {
  drops: RGB[];
  base: RGB;
  target: RGB;
  maxDrops: number;
  /** Velocity of the mix at the top of the well. Clockwise pours start pointing right. */
  speed: SpeedVector;
};

export function emptyMix(round: PublicRound): MixState {
  return {
    drops: [],
    base: round.base,
    target: round.target,
    maxDrops: round.maxDrops,
    speed: { x: 0, y: 0 },
  };
}

export function addDrop(state: MixState, pigment: RGB): MixState {
  if (state.drops.length >= state.maxDrops) return state;
  return { ...state, drops: [...state.drops, pigment], speed: pourSpeed() };
}

export function clearDrops(state: MixState): MixState {
  if (state.drops.length === 0) return state;
  return { ...state, drops: [], speed: { x: 0, y: 0 } };
}

export function currentMix(state: MixState): RGB {
  return mixColors(state.base, state.drops);
}

export function matched(state: MixState): boolean {
  return isMatch(colorDistance(currentMix(state), state.target));
}
