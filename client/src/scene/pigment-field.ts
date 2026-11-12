import { gsap } from 'gsap';
import type { RGB } from '../../../shared/color.ts';
import {
  DIFFUSION_RATE,
  DIFFUSION_SIZE,
  createField,
  diffuse,
  fillField,
  pourCell,
  renderField,
  stampPigment,
  type Field,
} from '../../../shared/diffusion.ts';

const VIEW = 256;
const SUBSTEPS = 4;
const SETTLE = 0.03;
const STEP_CAP = 4800;

/**
 * Draws the diffusion grid into the well.
 * The simulation stays on a small buffer; the visible canvas only scales it.
 */
export class PigmentField {
  private readonly field: Field;
  private readonly scratch: Field;
  private readonly pixels: Uint8ClampedArray;
  private readonly image: ImageData;
  private readonly grid: HTMLCanvasElement;
  private readonly gridCtx: CanvasRenderingContext2D;
  private readonly ctx: CanvasRenderingContext2D;
  private paused = false;
  private mixing = false;
  private listening = false;
  private steps = 0;

  private readonly onTick = (_time: number, deltaMs: number): void => {
    const frames = Math.min(2, Math.max(1, Math.round((deltaMs || 16.7) / 16.7)));
    const count = frames * SUBSTEPS;
    const delta = diffuse(this.field, this.scratch, DIFFUSION_RATE, count);
    this.steps += count;
    this.draw();
    if (delta < SETTLE || this.steps >= STEP_CAP) {
      this.mixing = false;
      this.stop();
    }
  };

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = VIEW;
    canvas.height = VIEW;
    const ctx = canvas.getContext('2d', { alpha: false });
    const grid = document.createElement('canvas');
    grid.width = DIFFUSION_SIZE;
    grid.height = DIFFUSION_SIZE;
    const gridCtx = grid.getContext('2d', { alpha: false });
    if (!ctx || !gridCtx) throw new Error('canvas unavailable');
    ctx.imageSmoothingEnabled = true;
    this.ctx = ctx;
    this.grid = grid;
    this.gridCtx = gridCtx;
    this.field = createField({ r: 232, g: 226, b: 214 });
    this.scratch = createField({ r: 0, g: 0, b: 0 });
    this.image = gridCtx.createImageData(DIFFUSION_SIZE, DIFFUSION_SIZE);
    this.pixels = this.image.data;
  }

  destroy(): void {
    this.mixing = false;
    this.stop();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) this.stop();
    else this.start();
  }

  reset(color: RGB): void {
    fillField(this.field, color);
    this.mixing = false;
    this.steps = 0;
    this.stop();
    this.draw();
  }

  showUniform(color: RGB): void {
    this.reset(color);
  }

  pour(pigment: RGB, dropIndex: number): void {
    stampPigment(this.field, pigment, 1 + dropIndex, pourCell(dropIndex));
    this.mixing = true;
    this.steps = 0;
    this.draw();
    this.start();
  }

  private start(): void {
    if (this.paused || !this.mixing || this.listening) return;
    this.listening = true;
    gsap.ticker.add(this.onTick);
  }

  private stop(): void {
    if (!this.listening) return;
    this.listening = false;
    gsap.ticker.remove(this.onTick);
  }

  private draw(): void {
    renderField(this.field, this.pixels);
    this.gridCtx.putImageData(this.image, 0, 0);
    this.ctx.drawImage(this.grid, 0, 0, VIEW, VIEW);
  }
}
