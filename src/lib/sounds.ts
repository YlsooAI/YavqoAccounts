// Tiny WebAudio synth for UI feedback — no audio assets needed.
// Every sound is triggered by a user gesture, so autoplay policies are fine.

let ctx: AudioContext | null = null;
let muted = false;

export function setSoundsMuted(value: boolean) {
  muted = value;
}

export function areSoundsMuted() {
  return muted;
}

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  {
    at = 0,
    duration = 0.14,
    type = "sine",
    gain = 0.05,
  }: { at?: number; duration?: number; type?: OscillatorType; gain?: number } = {}
) {
  if (muted) return;
  const ac = ensureCtx();
  if (!ac) return;
  const t0 = ac.currentTime + at;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export const sounds = {
  /** Soft tick for small interactions (option picks, toggles). */
  tap() {
    tone(620, { duration: 0.07, type: "triangle", gain: 0.035 });
  },
  /** Rising two-note blip when moving forward a step. */
  next() {
    tone(440, { duration: 0.1, type: "sine", gain: 0.045 });
    tone(660, { at: 0.09, duration: 0.12, type: "sine", gain: 0.045 });
  },
  /** Falling blip when going back a step. */
  back() {
    tone(660, { duration: 0.1, type: "sine", gain: 0.04 });
    tone(440, { at: 0.09, duration: 0.12, type: "sine", gain: 0.04 });
  },
  /** Low buzz for validation errors. */
  error() {
    tone(196, { duration: 0.16, type: "square", gain: 0.03 });
    tone(147, { at: 0.12, duration: 0.18, type: "square", gain: 0.03 });
  },
  /** Small three-note chime on successful creation. */
  success() {
    tone(523.25, { duration: 0.14, gain: 0.05 });
    tone(659.25, { at: 0.11, duration: 0.14, gain: 0.05 });
    tone(783.99, { at: 0.22, duration: 0.22, gain: 0.055 });
  },
};
