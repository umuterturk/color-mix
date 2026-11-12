import { expect, test } from 'vitest';
import { fetchRound } from '../src/fetch-round.ts';
import { dealRound, loadRound } from '../src/studio.ts';
import { parseRound } from '../../shared/parse.ts';
import { CATALOG } from '../../shared/round.ts';

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('dealRound returns a catalog round and does not call fetch', () => {
  let called = false;
  const original = globalThis.fetch;
  globalThis.fetch = (() => {
    called = true;
    throw new Error('network');
  }) as typeof fetch;
  try {
    const round = dealRound(mulberry32(7));
    const ids = new Set(CATALOG.map((pigment) => pigment.id));

    expect(parseRound(round)).toEqual(round);
    expect(round).not.toHaveProperty('counts');
    expect(round.pigments).toHaveLength(3);
    expect(round.maxDrops).toBeGreaterThanOrEqual(4);
    expect(round.maxDrops).toBeLessThanOrEqual(6);
    for (const pigment of round.pigments) expect(ids.has(pigment.id)).toBe(true);
    expect(called).toBe(false);
  } finally {
    globalThis.fetch = original;
  }
});

test('fetchRound reads /api/round and rejects a bad payload', async () => {
  const sample = dealRound(() => 0.2);
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    if (calls.length === 1) {
      return new Response(JSON.stringify(sample), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('nope', { status: 500 });
  }) as typeof fetch;
  try {
    const round = await fetchRound(new AbortController().signal);
    expect(round).toEqual(sample);
    expect(calls).toEqual(['/api/round']);
    await expect(fetchRound(new AbortController().signal)).rejects.toThrow('bad status');
  } finally {
    globalThis.fetch = original;
  }
});

test('loadRound uses the API outside the static production build', async () => {
  const sample = dealRound(() => 0.4);
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify(sample), { status: 200 });
  }) as typeof fetch;
  try {
    expect(import.meta.env.PROD).toBe(false);
    const round = await loadRound(new AbortController().signal);
    expect(round).toEqual(sample);
    expect(calls).toEqual(['/api/round']);
  } finally {
    globalThis.fetch = original;
  }
});
