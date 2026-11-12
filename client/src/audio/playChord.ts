import { closeness, colorDistance, type RGB } from '../../../shared/color.ts';
import { blendChords, chordFromColor } from './color-chords.ts';
import { GAME_TONIC_MIDI, normalizeVoicing } from './key.ts';
import type { Chord } from './pigment-chords.ts';
import { pickChord } from './pigment-chords.ts';

export type PourSoundContext = {
  targetColor: RGB;
  currentColor: RGB;
};

let context: AudioContext | null = null;
let masterBus: GainNode | null = null;
const MASTER_GAIN = 0.72;
let audioMuted = false;
let replayTimers: number[] = [];

export function setAudioMuted(muted: boolean): void {
  audioMuted = muted;
  if (masterBus) masterBus.gain.value = muted ? 0 : MASTER_GAIN;
}

export function isAudioMuted(): boolean {
  return audioMuted;
}

export function cancelChordReplay(): void {
  for (const id of replayTimers) window.clearTimeout(id);
  replayTimers = [];
}

/** Stop scheduled replay, release the audio context, and return to unmuted defaults. */
export function resetSoundSession(): void {
  cancelChordReplay();
  audioMuted = false;
  if (context) {
    void context.close().catch(() => undefined);
    context = null;
    masterBus = null;
  }
}

/** Harmonic weights roughly similar to a struck piano string spectrum. */
const PIANO_PARTIALS: readonly { ratio: number; gain: number }[] = [
  { ratio: 1, gain: 1 },
  { ratio: 2, gain: 0.58 },
  { ratio: 3, gain: 0.32 },
  { ratio: 4, gain: 0.19 },
  { ratio: 5, gain: 0.12 },
  { ratio: 6, gain: 0.08 },
  { ratio: 7, gain: 0.05 },
];

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!context) {
    const Ctx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    context = new Ctx();
    masterBus = context.createGain();
    masterBus.gain.value = audioMuted ? 0 : MASTER_GAIN;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -22;
    compressor.knee.value = 18;
    compressor.ratio.value = 2.8;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.22;
    masterBus.connect(compressor);
    compressor.connect(context.destination);
  }
  return context;
}

/** Resume Safari/iOS audio after a user gesture (click/touch). */
function withRunningContext(onReady: (ctx: AudioContext) => void): void {
  if (audioMuted) return;
  const ctx = getContext();
  if (!ctx) return;
  const run = () => {
    if (masterBus) masterBus.gain.value = MASTER_GAIN;
    onReady(ctx);
  };
  if (ctx.state === 'suspended') {
    void ctx.resume().then(run).catch(() => undefined);
    return;
  }
  void ctx.resume();
  run();
}

function playIosUnlockBlip(ctx: AudioContext): void {
  const buffer = ctx.createBuffer(1, 1, 22050);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(master(ctx));
  source.start(0);
  source.stop(ctx.currentTime + 0.02);
}

export function unlockAudio(): void {
  withRunningContext(playIosUnlockBlip);
}

function master(ctx: AudioContext): GainNode {
  if (!masterBus) {
    masterBus = ctx.createGain();
    masterBus.gain.value = audioMuted ? 0 : MASTER_GAIN;
    masterBus.connect(ctx.destination);
  }
  return masterBus;
}

function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Slight stretch so upper partials feel less “organ”, more hammered string. */
function partialHz(fundamental: number, partial: number): number {
  const stretch = 1 + 0.00012 * partial * partial;
  return fundamental * partial * stretch;
}

function playPianoNote(ctx: AudioContext, midi: number, when: number, velocity: number): void {
  const fundamental = midiToHz(midi);
  const decay = 0.55 + (midi / 88) * 0.75;

  const noteFilter = ctx.createBiquadFilter();
  noteFilter.type = 'lowpass';
  noteFilter.Q.value = 0.65;
  const brightness = Math.min(10_000, fundamental * 14);
  noteFilter.frequency.setValueAtTime(brightness, when);
  noteFilter.frequency.exponentialRampToValueAtTime(Math.max(280, fundamental * 2.4), when + 0.025);
  noteFilter.frequency.exponentialRampToValueAtTime(Math.max(140, fundamental * 0.95), when + decay);

  const noteOut = ctx.createGain();
  noteOut.gain.value = 1;
  noteFilter.connect(noteOut);
  noteOut.connect(master(ctx));

  for (const { ratio, gain: partialGain } of PIANO_PARTIALS) {
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const partialAmp = ctx.createGain();
    const hz = partialHz(fundamental, ratio);

    oscA.type = 'sine';
    oscB.type = 'sine';
    oscA.frequency.value = hz;
    oscB.frequency.value = hz * 1.0018;

    partialAmp.gain.setValueAtTime(0, when);
    partialAmp.gain.linearRampToValueAtTime(velocity * partialGain, when + 0.0015);
    partialAmp.gain.exponentialRampToValueAtTime(0.0001, when + decay);

    oscA.connect(partialAmp);
    oscB.connect(partialAmp);
    partialAmp.connect(noteFilter);

    oscA.start(when);
    oscB.start(when);
    oscA.stop(when + decay + 0.15);
    oscB.stop(when + decay + 0.15);
  }
}

export function composePourChord(
  pigmentId: string,
  blend?: PourSoundContext,
  rng?: () => number,
): Chord {
  const pigmentChord = normalizeVoicing(pickChord(pigmentId, rng));
  if (!blend) return pigmentChord;
  const targetChord = chordFromColor(blend.targetColor);
  const match = closeness(colorDistance(blend.currentColor, blend.targetColor));
  const towardTarget = match ** 0.82;
  return blendChords(pigmentChord, targetChord, towardTarget);
}

export function playChord(notes: Chord, velocityScale = 1, when?: number): void {
  withRunningContext((ctx) => {
    const start = when ?? ctx.currentTime;
    const velocity = (0.2 / Math.max(1, Math.sqrt(notes.length))) * velocityScale;
    const roll = 0.014;

    notes.forEach((midi, index) => {
      playPianoNote(ctx, midi, start + index * roll, velocity);
    });
  });
}

/** Background pulse during pour-chord replay. */
export const REPLAY_BPM = 132;

/** Time between pour chords in replay (independent of the pulse). */
const REPLAY_CHORD_STEP_SEC = 0.2;

function playBeatPulse(when?: number): void {
  withRunningContext((ctx) => {
    const t = when ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = midiToHz(GAME_TONIC_MIDI - 12);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(gain);
    gain.connect(master(ctx));
    osc.start(t);
    osc.stop(t + 0.12);
  });
}

export function playChordSequence(chords: readonly Chord[]): void {
  cancelChordReplay();
  if (audioMuted || chords.length === 0) return;
  withRunningContext((ctx) => {
    const beat = 60 / REPLAY_BPM;
    const leadIn = 0.05;
    const t0 = ctx.currentTime + leadIn;
    const scheduleAt = (when: number, fn: () => void) => {
      const delayMs = Math.max(0, (when - ctx.currentTime) * 1000);
      replayTimers.push(window.setTimeout(fn, delayMs));
    };

    const chordSpan =
      chords.length <= 1 ? 0 : (chords.length - 1) * REPLAY_CHORD_STEP_SEC;
    const pulseThrough = t0 + chordSpan + beat * 1.5;
    const pulseBeats = Math.ceil((pulseThrough - t0) / beat);

    for (let beatIndex = 0; beatIndex < pulseBeats; beatIndex += 1) {
      const when = t0 + beatIndex * beat;
      scheduleAt(when, () => {
        const hit = Math.max(when, ctx.currentTime);
        playBeatPulse(hit);
      });
    }

    chords.forEach((chord, index) => {
      const when = t0 + index * REPLAY_CHORD_STEP_SEC;
      scheduleAt(when, () => {
        const hit = Math.max(when, ctx.currentTime);
        playChord(chord, 1, hit);
      });
    });
  });
}

export function playPigmentChord(
  pigmentId: string,
  blend?: PourSoundContext,
  rng?: () => number,
): Chord {
  const voiced = composePourChord(pigmentId, blend, rng);
  playChord(voiced);
  return voiced;
}
