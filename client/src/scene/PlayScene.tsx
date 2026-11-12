import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { closeness, colorDistance, rgbCss } from '../../../shared/color.ts';
import { createPourSeed, pourBrushTip, pourSpeed } from '../../../shared/diffusion.ts';
import { addDrop, clearDrops, currentMix, emptyMix, matched, type MixState } from '../../../shared/mix-state.ts';
import type { Pigment, PublicRound } from '../../../shared/types.ts';
import { useMotionPause } from '../hooks/useMotionPause.ts';
import { celebrateCampaign, celebrateLevelWin, clearJuice, flyPigment, punch } from '../motion/juice.ts';
import { LEVEL_COUNT } from '../../../shared/levels.ts';
import { loadRound } from '../studio.ts';
import {
  cancelChordReplay,
  playChordSequence,
  playPigmentChord,
  resetSoundSession,
  setAudioMuted,
  unlockAudio,
} from '../audio/playChord.ts';
import type { Chord } from '../audio/pigment-chords.ts';
import { mulberry32 } from '../audio/rng.ts';
import { ReplayChordsIcon, SoundOffIcon, SoundOnIcon } from '../icons/BarIcons.tsx';
import { WellCanvas } from './WellCanvas.tsx';

const INTRO_SESSION_KEY = 'color-mix-intro-v2';
const PIGMENT_HINT_LEVELS = 3;

function introPending(): boolean {
  try {
    return sessionStorage.getItem(INTRO_SESSION_KEY) !== '1';
  } catch {
    return true;
  }
}

type PlaySceneProps = {
  paused: boolean;
  held: boolean;
  reducedMotion: boolean;
  onToggleHold: () => void;
};

export default function PlayScene({ paused, held, reducedMotion, onToggleHold }: PlaySceneProps) {
  const [round, setRound] = useState<PublicRound | null>(null);
  const [mix, setMix] = useState<MixState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [levelNo, setLevelNo] = useState(1);
  const [campaignComplete, setCampaignComplete] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [showIntro, setShowIntro] = useState(() => introPending());
  const [muted, setMuted] = useState(false);
  const gameChordsRef = useRef<Chord[]>([]);
  const [pourChordCount, setPourChordCount] = useState(0);
  const wellRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const inflight = useRef<AbortController | null>(null);
  const levelNoRef = useRef(1);
  const mixRef = useRef<MixState | null>(null);
  const campaignCompleteRef = useRef(false);
  const [landedPours, setLandedPours] = useState(0);
  const landedReadyRef = useRef<Set<number>>(new Set());
  const landedNextRef = useRef(0);

  useMotionPause(paused);
  mixRef.current = mix;
  campaignCompleteRef.current = campaignComplete;

  useEffect(() => {
    setAudioMuted(muted);
  }, [muted]);

  const resetPourSound = useCallback(() => {
    resetSoundSession();
    gameChordsRef.current = [];
    setPourChordCount(0);
    setMuted(false);
  }, []);

  useEffect(() => {
    resetPourSound();
    const onPageHide = () => cancelChordReplay();
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) resetPourSound();
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      cancelChordReplay();
    };
  }, [resetPourSound]);

  const resetLandedVisuals = useCallback(() => {
    landedReadyRef.current.clear();
    landedNextRef.current = 0;
    setLandedPours(0);
  }, []);

  const registerPourLanded = useCallback(
    (dropIndex: number) => {
      landedReadyRef.current.add(dropIndex);
      while (landedReadyRef.current.has(landedNextRef.current)) {
        landedReadyRef.current.delete(landedNextRef.current);
        landedNextRef.current += 1;
      }
      setLandedPours(landedNextRef.current);
      punch(wellRef.current, reducedMotion);
    },
    [reducedMotion],
  );

  const loadLevel = useCallback(async (level: number) => {
    if (campaignCompleteRef.current) return;
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    try {
      const next = await loadRound(controller.signal, level);
      if (controller.signal.aborted) return;
      levelNoRef.current = level;
      setLevelNo(level);
      setRound(next);
      setMix(emptyMix(next));
      resetLandedVisuals();
      setCelebrating(false);
      setError(null);
    } catch {
      if (controller.signal.aborted) return;
      setError('The studio did not answer.');
    }
  }, [resetLandedVisuals]);

  const scheduleLevelAfterWin = useCallback(
    (wellRect: DOMRect | null, mixState: MixState) => {
      setCelebrating(true);
      const mixCss = rgbCss(currentMix(mixState));
      if (wellRect) celebrateLevelWin(wellRef.current, wellRect, mixCss, reducedMotion);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const nextLevel = levelNoRef.current + 1;
        if (nextLevel > LEVEL_COUNT) {
          if (wellRect) celebrateCampaign(wellRect, reducedMotion);
          campaignCompleteRef.current = true;
          setCampaignComplete(true);
          setCelebrating(false);
          return;
        }
        setCelebrating(false);
        void loadLevel(nextLevel);
      }, reducedMotion ? 480 : 1180);
    },
    [loadLevel, reducedMotion],
  );

  useEffect(() => {
    void loadLevel(1);
    return () => {
      inflight.current?.abort();
      if (timer.current !== null) window.clearTimeout(timer.current);
      clearJuice();
    };
  }, [loadLevel]);

  function pour(pigment: Pigment, event: MouseEvent<HTMLButtonElement>) {
    const current = mixRef.current;
    if (!current || paused || matched(current) || current.drops.length >= current.maxDrops) return;

    unlockAudio();
    const pourSeed = createPourSeed();
    const next = addDrop(current, pigment.rgb, pourSeed);
    const voiced = playPigmentChord(
      pigment.id,
      {
        targetColor: current.target,
        currentColor: currentMix(next),
      },
      mulberry32(pourSeed),
    );
    gameChordsRef.current.push(voiced);
    setPourChordCount(gameChordsRef.current.length);
    const dropIndex = next.drops.length - 1;
    mixRef.current = next;
    setMix(next);

    const wellRect = wellRef.current?.getBoundingClientRect() ?? null;
    const land = () => registerPourLanded(dropIndex);

    if (reducedMotion || !wellRect) {
      land();
    } else {
      const from = event.currentTarget.getBoundingClientRect();
      const speed = pourSpeed(pourSeed);
      const landing = pourBrushTip(speed, pourSeed);
      void flyPigment(from, wellRect, rgbCss(pigment.rgb), false, landing).then(land);
    }

    if (matched(next)) scheduleLevelAfterWin(wellRect, next);
  }

  function emptyWell() {
    const current = mixRef.current;
    if (!current || paused || matched(current)) return;
    const cleared = clearDrops(current);
    const removed = current.drops.length;
    if (removed > 0) {
      gameChordsRef.current = gameChordsRef.current.slice(0, -removed);
      setPourChordCount(gameChordsRef.current.length);
    }
    mixRef.current = cleared;
    setMix(cleared);
    resetLandedVisuals();
    punch(wellRef.current, reducedMotion);
  }

  function dismissIntro(): void {
    unlockAudio();
    try {
      sessionStorage.setItem(INTRO_SESSION_KEY, '1');
    } catch {
      /* ignore */
    }
    setShowIntro(false);
  }

  const introOverlay = showIntro ? (
    <div className="intro-veil" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <div className="intro-card">
        <p className="intro-kicker">How to play</p>
        <h2 id="intro-title" className="intro-title">
          Match the swatch
        </h2>
        <p className="intro-copy">Pour pigments into the well. Blend until your mix matches the target color above.</p>
        <button type="button" className="cta intro-cta" onClick={dismissIntro}>
          Start pouring
        </button>
      </div>
    </div>
  ) : null;

  if (error) {
    return (
      <section className="play play-loading">
        {introOverlay}
        <div className="boot">
          <p>{error}</p>
          <button type="button" className="cta" onClick={() => void loadLevel(levelNoRef.current)}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  if (!round || !mix) {
    return (
      <section className="play play-loading">
        {introOverlay}
        <p className="boot">Preparing a swatch…</p>
      </section>
    );
  }

  const color = currentMix(mix);
  const landedIndex = Math.max(0, landedPours - 1);
  const wellColor =
    landedPours === 0 ? mix.base : currentMix({ ...mix, drops: mix.drops.slice(0, landedPours) });
  const landedSeed = mix.pourSeeds[landedIndex] ?? 1;
  const won = matched(mix);
  const percent = Math.round(closeness(colorDistance(color, mix.target)) * 100);
  const full = mix.drops.length >= mix.maxDrops;
  const wellStyle = { '--mix': rgbCss(mix.base) } as CSSProperties;
  const hintPigments = !showIntro && levelNo <= PIGMENT_HINT_LEVELS && !won && !campaignComplete;

  return (
    <section className="play">
      <header className="bar">
        <span className="bar-spacer" aria-hidden="true" />
        <h1 className="bar-title">color mix</h1>
        <div className="bar-tools">
          <button
            type="button"
            className="icon-btn"
            aria-pressed={muted}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            onClick={() => setMuted((value) => !value)}
          >
            {muted ? <SoundOffIcon /> : <SoundOnIcon />}
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Play pour chords"
            disabled={pourChordCount === 0 || muted}
            onClick={() => {
              unlockAudio();
              playChordSequence(gameChordsRef.current);
            }}
          >
            <ReplayChordsIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-pressed={held}
            aria-label={held ? 'Resume' : 'Pause'}
            onClick={onToggleHold}
          >
            <span className="pause-icon" />
          </button>
        </div>
      </header>
      <p className="meta">
        {campaignComplete ? (
          'All 20 swatches matched'
        ) : (
          <>
            Level {String(levelNo).padStart(2, '0')}
            <span className="level-total"> / {String(LEVEL_COUNT).padStart(2, '0')}</span>
          </>
        )}
      </p>
      <div className="stage">
        <figure className="target">
          <div className="target-chip color-orb" style={{ background: rgbCss(round.target) }} />
          <figcaption>Swatch</figcaption>
        </figure>
        <div className="well-block">
          {celebrating ? (
            <div className="level-celebration" role="status" aria-live="assertive">
              <p className="level-celebration-kicker">Level {String(levelNo).padStart(2, '0')} clear</p>
              <p className="level-celebration-title">Perfect mix!</p>
            </div>
          ) : null}
          <div ref={wellRef} className={won ? 'well matched' : 'well'} style={wellStyle}>
            <WellCanvas
              color={wellColor}
              base={mix.base}
              pours={landedPours}
              pigment={landedPours > 0 ? (mix.drops[landedIndex] ?? null) : null}
              speed={pourSpeed(landedSeed)}
              pourSeed={landedSeed}
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
        <div className={hintPigments ? 'pigments pigments-hint' : 'pigments'}>
          {round.pigments.map((pigment) => (
            <button
              key={pigment.id}
              type="button"
              className="pigment"
              aria-label={`Pour ${pigment.name}`}
              disabled={paused || won || full || campaignComplete || showIntro}
              onClick={(event) => void pour(pigment, event)}
            >
              <span className="dot color-orb" style={{ background: rgbCss(pigment.rgb) }} />
              <span className="name">{pigment.name}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ghost"
          onClick={emptyWell}
          disabled={paused || won || campaignComplete || mix.drops.length === 0}
        >
          Empty well
        </button>
      </div>
      {introOverlay}
      {campaignComplete ? (
        <div className="campaign-celebration" role="status" aria-live="assertive">
          <div className="campaign-celebration-card">
            <p className="campaign-celebration-kicker">All {LEVEL_COUNT} swatches</p>
            <p className="campaign-celebration-title">Palette mastered</p>
          </div>
        </div>
      ) : null}
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
