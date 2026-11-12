import { parseRound } from '../../shared/parse.ts';
import { planRound } from '../../shared/round.ts';
import type { PublicRound } from '../../shared/types.ts';

/** Deal a round in the browser. The static Pages build uses this and never calls the API. */
export function dealRound(rng: () => number = Math.random): PublicRound {
  const parsed = parseRound(planRound(rng).publicRound);
  if (!parsed) throw new Error('unplayable round');
  return parsed;
}

export async function loadRound(signal: AbortSignal): Promise<PublicRound> {
  if (import.meta.env.PROD) return dealRound();
  const { fetchRound } = await import('./fetch-round.ts');
  return fetchRound(signal);
}
