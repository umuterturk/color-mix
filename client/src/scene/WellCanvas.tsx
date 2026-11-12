import { useEffect, useRef } from 'react';
import type { RGB } from '../../../shared/color.ts';
import {
  createField,
  FIELD_SIZE,
  fillField,
  injectPourFlow,
  isSettled,
  MARBLE_DIFFUSION,
  stampPour,
  stepField,
  type Field,
  type SpeedVector,
} from '../../../shared/diffusion.ts';

function resetBlendClock(blendStart: { current: number }, blendElapsed: { current: number }): void {
  blendStart.current = performance.now();
  blendElapsed.current = 0;
}

type WellCanvasProps = {
  color: RGB;
  base: RGB;
  pours: number;
  pigment: RGB | null;
  speed: SpeedVector;
  pourSeed: number;
  paused: boolean;
  reducedMotion: boolean;
};

function paint(canvas: HTMLCanvasElement, blot: HTMLCanvasElement, field: Field): void {
  const ctx = canvas.getContext('2d');
  const blotCtx = blot.getContext('2d');
  if (!ctx || !blotCtx) return;

  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (width < 2 || height < 2) return;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const { size, px } = field;
  if (blot.width !== size || blot.height !== size) {
    blot.width = size;
    blot.height = size;
  }
  const image = blotCtx.createImageData(size, size);
  const data = image.data;
  for (let i = 0, p = 0; i < px.length; i += 3, p += 4) {
    data[p] = Math.max(0, Math.min(255, Math.round(px[i] ?? 0)));
    data[p + 1] = Math.max(0, Math.min(255, Math.round(px[i + 1] ?? 0)));
    data[p + 2] = Math.max(0, Math.min(255, Math.round(px[i + 2] ?? 0)));
    data[p + 3] = 255;
  }
  blotCtx.putImageData(image, 0, 0);

  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(blot, 0, 0, width, height);
}

export function WellCanvas({ color, base, pours, pigment, speed, pourSeed, paused, reducedMotion }: WellCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blotRef = useRef<HTMLCanvasElement | null>(null);
  const fieldRef = useRef<Field | null>(null);
  const colorRef = useRef(color);
  const pausedRef = useRef(paused);
  const seen = useRef<{ pours: number; base: string } | null>(null);
  const blendStart = useRef(performance.now());
  const blendElapsed = useRef(0);
  colorRef.current = color;
  pausedRef.current = paused;

  const baseKey = `${base.r}:${base.g}:${base.b}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!blotRef.current) blotRef.current = document.createElement('canvas');
    const blot = blotRef.current;
    const previous = seen.current;
    const field = fieldRef.current ?? createField(FIELD_SIZE, base);
    fieldRef.current = field;
    const newRound = !previous || previous.base !== baseKey;

    if (newRound || pours === 0) {
      fillField(field, base);
      resetBlendClock(blendStart, blendElapsed);
    }

    if (pours > 0 && pigment && (newRound || !previous || previous.pours < pours)) {
      if (newRound) fillField(field, base);
      stampPour(field, pigment, pours, speed, pourSeed);
      injectPourFlow(field, speed, pourSeed);
      resetBlendClock(blendStart, blendElapsed);
    }

    if (reducedMotion) {
      fillField(field, color);
    }

    seen.current = { pours, base: baseKey };
    paint(canvas, blot, field);
  }, [base.b, base.g, base.r, baseKey, color.b, color.g, color.r, pigment, pours, pourSeed, reducedMotion, speed.x, speed.y]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reducedMotion) return;
    if (!blotRef.current) blotRef.current = document.createElement('canvas');
    const blot = blotRef.current;
    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const field = fieldRef.current;
      if (!field) return;
      if (canvas.getBoundingClientRect().width < 2) {
        frame = window.requestAnimationFrame(tick);
        return;
      }

      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const target = colorRef.current;
      if (!pausedRef.current) blendElapsed.current += dt;
      const elapsed = blendElapsed.current;
      const active = !isSettled(field, target, elapsed);
      if (!pausedRef.current && active) {
        stepField(field, dt, MARBLE_DIFFUSION, target, elapsed);
        paint(canvas, blot, field);
      } else if (!pausedRef.current) {
        paint(canvas, blot, field);
      }

      if (pausedRef.current || active) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [baseKey, pours, reducedMotion]);

  return <canvas ref={canvasRef} className="well-canvas" aria-hidden="true" />;
}
