import type { RGB } from './color.ts';

export type Pigment = {
  id: string;
  name: string;
  rgb: RGB;
};

export type PublicRound = {
  id: string;
  base: RGB;
  target: RGB;
  pigments: Pigment[];
  maxDrops: number;
};

export type PlannedRound = {
  publicRound: PublicRound;
  counts: number[];
};
