import { expect, test } from 'vitest';
import { fetchRound } from '../src/fetch-round.ts';
import { dealRound, loadRound } from '../src/studio.ts';
import { parseRound } from '../../shared/parse.ts';
import { CATALOG } from '../../shared/round.ts';

test('dealRound returns a catalog round and does not call fetch', () => {
  let called = false;
  const original = globalThis.fetch;
  globalThis.fetch = (() => {
    called = true;
    throw new Error('network');
  }) as typeof fetch;
  try {
    const round = dealRound(7);
    const ids = new Set(CATALOG.map((pigment) => pigment.id));

    expect(parseRound(round)).toEqual(round);
    expect(round).not.toHaveProperty('counts');
    expect(round.id).toBe('level-07');
    expect(round.pigments).toHaveLength(3);
    expect(round.maxDrops).toBeGreaterThanOrEqual(2);
    expect(round.maxDrops).toBeLessThanOrEqual(9);
    for (const pigment of round.pigments) expect(ids.has(pigment.id)).toBe(true);
    expect(called).toBe(false);
  } finally {
    globalThis.fetch = original;
  }
});

test('fetchRound reads /api/round and rejects a bad payload', async () => {
  const sample = dealRound(3);
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
    const round = await fetchRound(new AbortController().signal, 3);
    expect(round).toEqual(sample);
    expect(calls).toEqual(['/api/round?level=3']);
    await expect(fetchRound(new AbortController().signal)).rejects.toThrow('bad status');
  } finally {
    globalThis.fetch = original;
  }
});

test('loadRound uses the API outside the static production build', async () => {
  const sample = dealRound(1);
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify(sample), { status: 200 });
  }) as typeof fetch;
  try {
    expect(import.meta.env.PROD).toBe(false);
    const round = await loadRound(new AbortController().signal, 1);
    expect(round).toEqual(dealRound(1));
    expect(calls).toEqual(['/api/round?level=1']);
  } finally {
    globalThis.fetch = original;
  }
});
