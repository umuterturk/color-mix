import { parseRound } from '../../shared/parse.ts';
import type { PublicRound } from '../../shared/types.ts';

export async function fetchRound(signal: AbortSignal, level: number = 1): Promise<PublicRound> {
  const query = new URLSearchParams({ level: String(level) });
  const response = await fetch(`/api/round?${query}`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('bad status');
  const next = parseRound(await response.json());
  if (!next) throw new Error('bad round');
  return next;
}
