import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useMotionPause } from '../hooks/useMotionPause.ts';

type TitleSceneProps = {
  paused: boolean;
  reducedMotion: boolean;
  onPlay: () => void;
};

export function TitleScene({ paused, reducedMotion, onPlay }: TitleSceneProps) {
  const rootRef = useRef<HTMLElement>(null);
  useMotionPause(paused);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion) return;
    const context = gsap.context(() => {
      gsap.from('.mark span', {
        y: 28,
        autoAlpha: 0,
        stagger: 0.08,
        duration: 0.7,
        ease: 'power3.out',
      });
      gsap.from('.title-copy, .cta', {
        y: 14,
        autoAlpha: 0,
        duration: 0.55,
        delay: 0.18,
        stagger: 0.06,
        ease: 'power2.out',
      });
      gsap.to('.orb', {
        y: (index: number) => (index % 2 === 0 ? 18 : -16),
        x: (index: number) => (index % 2 === 0 ? -10 : 12),
        duration: 3.6,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        stagger: 0.25,
      });
    }, root);
    return () => context.revert();
  }, [reducedMotion]);

  return (
    <section className="title" ref={rootRef}>
      <div className="orb orb-a" aria-hidden="true" />
      <div className="orb orb-b" aria-hidden="true" />
      <div className="orb orb-c" aria-hidden="true" />
      <p className="eyebrow">A portrait study</p>
      <h1 className="mark">
        <span>color</span>
        <span>mix</span>
      </h1>
      <p className="title-copy">Pour three pigments until the well matches the swatch.</p>
      <button type="button" className="cta" onClick={onPlay}>
        Start mixing
      </button>
    </section>
  );
}
