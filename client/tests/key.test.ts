import { expect, test } from 'vitest';
import { GAME_VOICING_CENTER, normalizeVoicing } from '../src/audio/key.ts';

test('normalizeVoicing lands near the shared center', () => {
  const low = normalizeVoicing([43, 46, 50]);
  const high = normalizeVoicing([72, 76, 79]);
  const mean = (chord: readonly number[]) => chord.reduce((a, b) => a + b, 0) / chord.length;
  expect(Math.abs(mean(low) - GAME_VOICING_CENTER)).toBeLessThan(4);
  expect(Math.abs(mean(high) - GAME_VOICING_CENTER)).toBeLessThan(4);
});
