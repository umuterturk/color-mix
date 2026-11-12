import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { closeness, colorDistance, rgbCss } from '../../../shared/color.ts';
import { addDrop, clearDrops, currentMix, emptyMix, matched, type MixState } from '../../../shared/mix-state.ts';
import type { Pigment, PublicRound } from '../../../shared/types.ts';
import { useMotionPause } from '../hooks/useMotionPause.ts';
import { burst, clearJuice, flyPigment, punch } from '../motion/juice.ts';
import { loadRound } from '../studio.ts';
import { WellCanvas } from './WellCanvas.tsx';

type PlaySceneProps = {
  paused: boolean;
  held: boolean;
  reducedMotion: boolean;
  onExit: () => void;
  onToggleHold: () => void;
};

export default function PlayScene({ paused, held, reducedMotion, onExit, onToggleHold }: PlaySceneProps) {
  const [round, setRound] = useState<PublicRound | null>(null);
  const [mix, setMix] = useState<MixState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roundNo, setRoundNo] = useState(1);
  const wellRef = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const timer = useRef<number | null>(null);
  const inflight = useRef<AbortController | null>(null);
  const pendingAdvance = useRef(false);
  const roundNoRef = useRef(1);

  useMotionPause(paused);

  const load = useCallback(async () => {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    try {
      const next = await loadRound(controller.signal);
      if (controller.signal.aborted) return;
      setRound(next);
      setMix(emptyMix(next));
      setError(null);
      if (pendingAdvance.current) {
        pendingAdvance.current = false;
        roundNoRef.current += 1;
        setRoundNo(roundNoRef.current);
      }
    } catch {
      if (controller.signal.aborted) return;
      setError('The studio did not answer.');
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      inflight.current?.abort();
      if (timer.current !== null) window.clearTimeout(timer.current);
      clearJuice();
    };
  }, [load]);

  async function pour(pigment: Pigment, event: MouseEvent<HTMLButtonElement>) {
    if (!mix || paused || lock.current || matched(mix) || mix.drops.length >= mix.maxDrops) return;
    lock.current = true;
    try {
      let origin: DOMRect | null = null;
      if (!reducedMotion && wellRef.current) {
        const from = event.currentTarget.getBoundingClientRect();
        origin = wellRef.current.getBoundingClientRect();
        await flyPigment(from, origin, rgbCss(pigment.rgb), false);
      }
      let next: MixState | null = null;
      setMix((current) => {
        if (!current) return current;
        next = addDrop(current, pigment.rgb);
        return next;
      });
      punch(wellRef.current, reducedMotion);
      if (!next || !matched(next)) return;
      if (origin) burst(origin, rgbCss(currentMix(next)), false);
      pendingAdvance.current = true;
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        void load();
      }, reducedMotion ? 420 : 980);
    } finally {
      lock.current = false;
    }
  }

  function emptyWell() {
    if (!mix || paused || lock.current || matched(mix)) return;
    setMix(clearDrops(mix));
    punch(wellRef.current, reducedMotion);
  }

  if (error) {
    return (
      <div className="boot">
        <p>{error}</p>
        <button type="button" className="cta" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  }

  if (!round || !mix) {
    return <p className="boot">Preparing a swatch…</p>;
  }

  const color = currentMix(mix);
  const won = matched(mix);
  const percent = Math.round(closeness(colorDistance(color, mix.target)) * 100);
  const full = mix.drops.length >= mix.maxDrops;
  const wellStyle = { '--mix': rgbCss(color) } as CSSProperties;

  return (
    <section className="play">
      <header className="bar">
        <button type="button" className="text-btn" onClick={onExit}>
          Back
        </button>
        <h1 className="bar-title">color mix</h1>
        <button
          type="button"
          className="icon-btn"
          aria-pressed={held}
          aria-label={held ? 'Resume' : 'Pause'}
          onClick={onToggleHold}
        >
          <span className="pause-icon" />
        </button>
      </header>
      <p className="meta">Round {String(roundNo).padStart(2, '0')}</p>
      <div className="stage">
        <figure className="target">
          <div className="target-chip" style={{ background: rgbCss(round.target) }} />
          <figcaption>Swatch</figcaption>
        </figure>
        <div className="well-block">
          <div ref={wellRef} className={won ? 'well matched' : 'well'} style={wellStyle}>
            <WellCanvas
              color={color}
              base={mix.base}
              pours={mix.drops.length}
              pigment={mix.drops.at(-1) ?? null}
              speed={mix.speed}
              paused={paused}
              reducedMotion={reducedMotion}
            />
          </div>
          <p className={won ? 'readout won' : 'readout'} aria-live="polite">
            {won ? (
              'Matched'
            ) : (
              <>
                {percent}
                <span className="unit">%</span>
              </>
            )}
          </p>
          <div className="pips" aria-hidden="true">
            {Array.from({ length: mix.maxDrops }, (_, index) => (
              <span key={index} className={index < mix.drops.length ? 'pip on' : 'pip'} />
            ))}
          </div>
        </div>
      </div>
      <div className="dock">
        <div className="pigments">
          {round.pigments.map((pigment) => (
            <button
              key={pigment.id}
              type="button"
              className="pigment"
              aria-label={`Pour ${pigment.name}`}
              disabled={paused || won || full}
              onClick={(event) => void pour(pigment, event)}
            >
              <span className="dot" style={{ background: rgbCss(pigment.rgb) }} />
              <span className="name">{pigment.name}</span>
            </button>
          ))}
        </div>
        <button type="button" className="ghost" onClick={emptyWell} disabled={paused || won || mix.drops.length === 0}>
          Empty well
        </button>
      </div>
      {held ? (
        <div className="veil">
          <p>Paused</p>
          <button type="button" className="cta" onClick={onToggleHold}>
            Resume
          </button>
        </div>
      ) : null}
    </section>
  );
}
