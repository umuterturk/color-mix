import { parseRound } from '../../shared/parse.ts';
import type { PublicRound } from '../../shared/types.ts';

export async function fetchRound(signal: AbortSignal): Promise<PublicRound> {
  const response = await fetch('/api/round', { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('bad status');
  const next = parseRound(await response.json());
  if (!next) throw new Error('bad round');
  return next;
}
