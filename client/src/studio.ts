import { parseRound } from '../../shared/parse.ts';
import { planLevel } from '../../shared/levels.ts';
import type { PublicRound } from '../../shared/types.ts';

/** Deal a campaign level in the browser. The static Pages build uses this and never calls the API. */
export function dealRound(level: number = 1): PublicRound {
  const parsed = parseRound(planLevel(level).publicRound);
  if (!parsed) throw new Error('unplayable round');
  return parsed;
}

export async function loadRound(signal: AbortSignal, level: number = 1): Promise<PublicRound> {
  if (import.meta.env.PROD) return dealRound(level);
  const { fetchRound } = await import('./fetch-round.ts');
  return fetchRound(signal, level);
}
