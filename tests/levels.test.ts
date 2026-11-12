import { expect, test } from 'vitest';
import { mixColors } from '../shared/color.ts';
import { LEVEL_COUNT, LEVELS, planLevel } from '../shared/levels.ts';
import { addDrop, emptyMix, matched } from '../shared/mix-state.ts';
import { expandCounts } from '../shared/round.ts';

test('campaign ships twenty fixed levels', () => {
  expect(LEVEL_COUNT).toBe(20);
  expect(LEVELS).toHaveLength(20);
  expect(new Set(LEVELS.map((level) => level.level)).size).toBe(20);
});

test('every level is solvable with its palette and drop budget', () => {
  for (const spec of LEVELS) {
    const planned = planLevel(spec.level);
    const drops = expandCounts(planned.publicRound.pigments, planned.counts);
    const total = planned.counts.reduce((sum, count) => sum + count, 0);

    expect(planned.publicRound.id).toBe(`level-${String(spec.level).padStart(2, '0')}`);
    expect(planned.publicRound.pigments).toHaveLength(3);
    expect(planned.counts.filter((count) => count > 0).length).toBeGreaterThanOrEqual(2);
    expect(drops).toHaveLength(total);
    expect(planned.publicRound.maxDrops).toBeGreaterThanOrEqual(total);
    expect(mixColors(planned.publicRound.base, drops)).toEqual(planned.publicRound.target);

    let state = emptyMix(planned.publicRound);
    for (const drop of drops) state = addDrop(state, drop);
    expect(matched(state)).toBe(true);
    expect(state.drops.length).toBeLessThanOrEqual(planned.publicRound.maxDrops);
  }
});

test('difficulty trends upward with a sine wobble', () => {
  const scores = LEVELS.map((level) => level.difficulty);
  expect(scores[0]!).toBeLessThan(scores[scores.length - 1]!);

  let climbs = 0;
  for (let index = 1; index < scores.length; index += 1) {
    if (scores[index]! > scores[index - 1]!) climbs += 1;
  }
  expect(climbs).toBeGreaterThanOrEqual(10);

  let directionChanges = 0;
  for (let index = 2; index < scores.length; index += 1) {
    const prev = scores[index - 1]! - scores[index - 2]!;
    const next = scores[index]! - scores[index - 1]!;
    if (prev === 0 || next === 0) continue;
    if (Math.sign(prev) !== Math.sign(next)) directionChanges += 1;
  }
  expect(directionChanges).toBeGreaterThanOrEqual(3);
});
