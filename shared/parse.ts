import type { RGB } from './color.ts';
import type { Pigment, PublicRound } from './types.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isChannel(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255;
}

function parseRgb(value: unknown): RGB | null {
  if (!isRecord(value)) return null;
  const { r, g, b } = value;
  if (!isChannel(r) || !isChannel(g) || !isChannel(b)) return null;
  return { r, g, b };
}

function parsePigment(value: unknown): Pigment | null {
  if (!isRecord(value)) return null;
  const { id, name, rgb } = value;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof name !== 'string' || name.length === 0) return null;
  const color = parseRgb(rgb);
  if (!color) return null;
  return { id, name, rgb: color };
}

export function parseRound(input: unknown): PublicRound | null {
  if (!isRecord(input)) return null;
  const { id, base, target, pigments, maxDrops } = input;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof maxDrops !== 'number' || !Number.isInteger(maxDrops) || maxDrops < 1 || maxDrops > 12) {
    return null;
  }
  const parsedBase = parseRgb(base);
  const parsedTarget = parseRgb(target);
  if (!parsedBase || !parsedTarget || !Array.isArray(pigments) || pigments.length !== 3) return null;

  const parsedPigments: Pigment[] = [];
  for (const pigment of pigments) {
    const parsed = parsePigment(pigment);
    if (!parsed) return null;
    parsedPigments.push(parsed);
  }
  if (new Set(parsedPigments.map((pigment) => pigment.id)).size !== 3) return null;

  return {
    id,
    base: parsedBase,
    target: parsedTarget,
    pigments: parsedPigments,
    maxDrops,
  };
}
