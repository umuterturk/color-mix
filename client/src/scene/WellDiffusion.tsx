import { useLayoutEffect, useRef } from 'react';
import { mixColors, type RGB } from '../../../shared/color.ts';
import { PigmentField } from './pigment-field.ts';

type WellDiffusionProps = {
  roundId: string;
  base: RGB;
  drops: readonly RGB[];
  paused: boolean;
  reducedMotion: boolean;
};

export function WellDiffusion({ roundId, base, drops, paused, reducedMotion }: WellDiffusionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<PigmentField | null>(null);
  const seenRef = useRef<{ roundId: string; count: number } | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const field = new PigmentField(canvas);
    fieldRef.current = field;
    seenRef.current = null;
    return () => {
      field.destroy();
      fieldRef.current = null;
      seenRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.setPaused(paused);

    if (reducedMotion) {
      field.showUniform(mixColors(base, drops));
      seenRef.current = { roundId, count: drops.length };
      return;
    }

    const seen = seenRef.current;
    if (!seen || seen.roundId !== roundId || drops.length < seen.count) {
      field.reset(base);
      for (let index = 0; index < drops.length; index += 1) {
        const pigment = drops[index];
        if (!pigment) continue;
        field.pour(pigment, index);
      }
      seenRef.current = { roundId, count: drops.length };
      return;
    }

    if (drops.length > seen.count) {
      for (let index = seen.count; index < drops.length; index += 1) {
        const pigment = drops[index];
        if (!pigment) continue;
        field.pour(pigment, index);
      }
      seenRef.current = { roundId, count: drops.length };
    }
  }, [roundId, base, drops, paused, reducedMotion]);

  return <canvas ref={canvasRef} className="mix-field" aria-hidden="true" />;
}
