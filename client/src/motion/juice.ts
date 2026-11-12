import { gsap } from 'gsap';

const live = new Set<HTMLElement>();

function spawn(className: string): HTMLElement {
  const el = document.createElement('div');
  el.className = className;
  document.body.appendChild(el);
  live.add(el);
  return el;
}

function drop(el: HTMLElement): void {
  el.remove();
  live.delete(el);
}

export function clearJuice(): void {
  for (const el of [...live]) {
    gsap.killTweensOf(el);
    drop(el);
  }
}

/** Transform and opacity only. The caller reads layout once per tap. */
export function flyPigment(from: DOMRect, to: DOMRect, color: string, reduce: boolean): Promise<void> {
  if (reduce) return Promise.resolve();
  const el = spawn('flyer');
  el.style.background = color;
  const size = 28;
  return new Promise((resolve) => {
    gsap.fromTo(
      el,
      {
        x: from.left + from.width / 2 - size / 2,
        y: from.top + from.height / 2 - size / 2,
        scale: 1,
        opacity: 1,
      },
      {
        x: to.left + to.width / 2 - size / 2,
        y: to.top + to.height / 2 - size / 2,
        scale: 0.35,
        opacity: 0.9,
        duration: 0.38,
        ease: 'power2.in',
        overwrite: 'auto',
        onComplete: () => {
          drop(el);
          resolve();
        },
        onInterrupt: () => {
          drop(el);
          resolve();
        },
      },
    );
  });
}

export function burst(origin: DOMRect, color: string, reduce: boolean): void {
  if (reduce) return;
  const count = 8;
  const cx = origin.left + origin.width / 2 - 5;
  const cy = origin.top + origin.height / 2 - 5;
  for (let i = 0; i < count; i += 1) {
    const el = spawn('spark');
    el.style.background = color;
    const angle = (i / count) * Math.PI * 2;
    gsap.fromTo(
      el,
      { x: cx, y: cy, scale: 0.7, opacity: 1 },
      {
        x: cx + Math.cos(angle) * 92,
        y: cy + Math.sin(angle) * 92,
        scale: 0.2,
        opacity: 0,
        duration: 0.55,
        ease: 'power2.out',
        overwrite: 'auto',
        onComplete: () => drop(el),
        onInterrupt: () => drop(el),
      },
    );
  }
}

export function punch(el: Element | null, reduce: boolean): void {
  if (!el || reduce) return;
  gsap.fromTo(el, { scale: 0.94 }, { scale: 1, duration: 0.42, ease: 'back.out(1.7)', overwrite: 'auto' });
}
