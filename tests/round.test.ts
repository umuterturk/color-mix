import { expect, test } from 'vitest';
import { mixColors } from '../shared/color.ts';
import { addDrop, clearDrops, emptyMix, matched } from '../shared/mix-state.ts';
import { parseRound } from '../shared/parse.ts';
import { expandCounts, planRound } from '../shared/round.ts';
import type { PlannedRound } from '../shared/types.ts';

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pourRecipe(planned: PlannedRound) {
  let state = emptyMix(planned.publicRound);
  for (const drop of expandCounts(planned.publicRound.pigments, planned.counts)) {
    state = addDrop(state, drop);
  }
  return state;
}

test('planned rounds are solvable mixes of their own pigments', () => {
  for (let seed = 1; seed <= 24; seed += 1) {
    const planned = planRound(mulberry32(seed));
    const drops = expandCounts(planned.publicRound.pigments, planned.counts);
    const total = planned.counts.reduce((sum, count) => sum + count, 0);

    expect(planned.publicRound.pigments).toHaveLength(3);
    expect(new Set(planned.publicRound.pigments.map((pigment) => pigment.id)).size).toBe(3);
    expect(planned.counts).toHaveLength(3);
    expect(planned.counts.filter((count) => count > 0).length).toBeGreaterThanOrEqual(2);
    expect(drops).toHaveLength(total);
    expect(total).toBeGreaterThanOrEqual(2);
    expect(total).toBeLessThanOrEqual(4);
    expect(planned.publicRound.maxDrops).toBe(total + 2);
    expect(planned.publicRound.id.length).toBeGreaterThan(0);
    expect(mixColors(planned.publicRound.base, drops)).toEqual(planned.publicRound.target);
    expect(matched(pourRecipe(planned))).toBe(true);
    expect(parseRound(JSON.parse(JSON.stringify(planned.publicRound)))).toEqual(planned.publicRound);
  }
});

test('a degenerate rng still deals a two-pigment recipe', () => {
  const planned = planRound(() => 0);
  expect(planned.counts.filter((count) => count > 0).length).toBeGreaterThanOrEqual(2);
  const drops = expandCounts(planned.publicRound.pigments, planned.counts);
  expect(mixColors(planned.publicRound.base, drops)).toEqual(planned.publicRound.target);
});

test('addDrop stops at maxDrops and clearDrops empties the well', () => {
  const planned = planRound(() => 0.2);
  let state = emptyMix(planned.publicRound);
  const pigment = planned.publicRound.pigments[0]?.rgb;
  if (!pigment) throw new Error('missing pigment');

  for (let i = 0; i < planned.publicRound.maxDrops + 3; i += 1) {
    state = addDrop(state, pigment);
  }
  expect(state.drops).toHaveLength(planned.publicRound.maxDrops);
  expect(state.speed.x).toBeGreaterThan(10);
  expect(state.speed.y).toBeCloseTo(0);

  const held = addDrop({ ...state, speed: { x: 1, y: 2 } }, pigment);
  expect(held.drops).toHaveLength(planned.publicRound.maxDrops);
  expect(held.speed).toEqual({ x: 1, y: 2 });

  const cleared = clearDrops(state);
  expect(cleared.drops).toEqual([]);
  expect(cleared.speed).toEqual({ x: 0, y: 0 });
  expect(cleared.target).toEqual(state.target);
  expect(state.drops).toHaveLength(planned.publicRound.maxDrops);
});

test('parseRound rejects a public round that cannot be played', () => {
  const planned = planRound(mulberry32(4));
  const round = planned.publicRound;

  expect(parseRound(null)).toBeNull();
  expect(parseRound({ ...round, pigments: [] })).toBeNull();
  expect(parseRound({ ...round, target: { r: 999, g: 0, b: 0 } })).toBeNull();
  expect(parseRound({ ...round, maxDrops: 0 })).toBeNull();
  expect(parseRound({ ...round, id: '' })).toBeNull();
  expect(parseRound({ ...round, counts: [1, 0, 1] })).toEqual(round);
});
