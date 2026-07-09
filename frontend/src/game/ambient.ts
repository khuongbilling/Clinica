import { Platform } from "react-native";

import { isSoundEnabled } from "./cues";

// ─────────────────────────────────────────────────────────────
// Gentle ambient loops for story scenes — dependency-free Web
// Audio synthesis, same philosophy as cues.ts (no bundled audio
// assets, no audio package, silent no-op wherever Web Audio is
// unavailable, e.g. native). Three moods:
//   • "rain"   — soft filtered-noise rain patter (Chapter II storm)
//   • "chimes" — warm pad + occasional pentatonic wind chimes
//                (Lotus Keeper / petal scenes)
//   • "ward"   — a quiet, low ward hum (default quiet interiors)
//
// One ambience plays at a time. start/stop fade gently so scene
// entry/exit never clicks. Respects the sound mute setting via
// isSoundEnabled() (settingsStore pushes changes into cues.ts);
// the playing screen should also stop/start on live toggles.
// ─────────────────────────────────────────────────────────────

export type AmbienceMood = "rain" | "chimes" | "ward";

const MASTER_GAIN: Record<AmbienceMood, number> = {
  rain: 0.055,
  chimes: 0.05,
  ward: 0.04,
};

type Active = {
  ctx: any;
  master: any;
  stops: Array<() => void>;
  timer: ReturnType<typeof setInterval> | null;
  mood: AmbienceMood;
};

let active: Active | null = null;

function getCtx(): any | null {
  if (Platform.OS !== "web") return null;
  try {
    if (typeof window === "undefined") return null;
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    const w = window as any;
    if (!w.__clinicaAmbientCtx) w.__clinicaAmbientCtx = new Ctor();
    return w.__clinicaAmbientCtx;
  } catch {
    return null;
  }
}

// Looping pink-ish noise buffer (2s) — basis for rain and hum texture.
function makeNoiseSource(ctx: any) {
  const len = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.997 * b0 + 0.029591 * white;
    b1 = 0.985 * b1 + 0.032534 * white;
    b2 = 0.95 * b2 + 0.048056 * white;
    data[i] = (b0 + b1 + b2 + white * 0.05) * 0.25;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

// Slow LFO wobbling a gain node so loops breathe instead of droning.
function addBreath(ctx: any, target: any, rate: number, depth: number, stops: Array<() => void>) {
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = rate;
  lfoGain.gain.value = depth;
  lfo.connect(lfoGain);
  lfoGain.connect(target.gain);
  lfo.start();
  stops.push(() => { try { lfo.stop(); } catch {} });
}

function buildRain(ctx: any, master: any, stops: Array<() => void>) {
  const noise = makeNoiseSource(ctx);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1400;
  lp.Q.value = 0.4;
  const g = ctx.createGain();
  g.gain.value = 1;
  noise.connect(lp);
  lp.connect(g);
  g.connect(master);
  noise.start();
  stops.push(() => { try { noise.stop(); } catch {} });
  addBreath(ctx, g, 0.13, 0.18, stops);
}

function buildWard(ctx: any, master: any, stops: Array<() => void>) {
  // Low detuned hum — the quiet electrical breath of a sleeping ward.
  for (const [freq, level] of [[58, 0.5], [58.7, 0.35], [116, 0.12]] as const) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.value = level;
    osc.connect(g);
    g.connect(master);
    osc.start();
    stops.push(() => { try { osc.stop(); } catch {} });
  }
  // Faint air movement under the hum.
  const noise = makeNoiseSource(ctx);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 420;
  const g = ctx.createGain();
  g.gain.value = 0.35;
  noise.connect(lp);
  lp.connect(g);
  g.connect(master);
  noise.start();
  stops.push(() => { try { noise.stop(); } catch {} });
  addBreath(ctx, g, 0.08, 0.12, stops);
}

function buildChimes(ctx: any, master: any, stops: Array<() => void>): ReturnType<typeof setInterval> {
  // Warm slow pad (two detuned low sines through a gentle lowpass).
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  lp.connect(master);
  for (const [freq, level] of [[130.81, 0.4], [196.0, 0.28]] as const) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.value = level;
    osc.connect(g);
    g.connect(lp);
    osc.start();
    stops.push(() => { try { osc.stop(); } catch {} });
    addBreath(ctx, g, 0.06 + Math.random() * 0.04, level * 0.35, stops);
  }
  // Occasional soft pentatonic chime, like distant wind bells.
  const notes = [523.25, 587.33, 659.25, 783.99, 880.0];
  const ring = () => {
    try {
      if (!active || active.timer !== timer) return;
      const now = ctx.currentTime;
      const f = notes[Math.floor(Math.random() * notes.length)];
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.9, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + 2.3);
    } catch {}
  };
  const timer = setInterval(() => {
    if (Math.random() < 0.55) ring();
  }, 3200);
  return timer;
}

/**
 * Start (or switch to) an ambient loop. Safe to call repeatedly with the
 * same mood — it's a no-op if that mood is already playing. No-ops when
 * sound is muted or Web Audio is unavailable.
 */
export function startAmbience(mood: AmbienceMood) {
  if (!isSoundEnabled()) return;
  if (active?.mood === mood) return;
  stopAmbience();
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(MASTER_GAIN[mood], ctx.currentTime + 1.6);
    master.connect(ctx.destination);
    const stops: Array<() => void> = [];
    let timer: ReturnType<typeof setInterval> | null = null;
    if (mood === "rain") buildRain(ctx, master, stops);
    else if (mood === "ward") buildWard(ctx, master, stops);
    active = { ctx, master, stops, timer, mood };
    if (mood === "chimes") active.timer = buildChimes(ctx, master, stops);
  } catch {
    active = null;
  }
}

/** Fade out and tear down the current ambience (safe if none playing). */
export function stopAmbience() {
  const a = active;
  active = null;
  if (!a) return;
  try {
    if (a.timer) clearInterval(a.timer);
    const now = a.ctx.currentTime;
    a.master.gain.cancelScheduledValues(now);
    a.master.gain.setValueAtTime(Math.max(a.master.gain.value, 0.0001), now);
    a.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    setTimeout(() => {
      for (const stop of a.stops) stop();
      try { a.master.disconnect(); } catch {}
    }, 700);
  } catch {
    try { for (const stop of a.stops) stop(); } catch {}
  }
}

/**
 * Nudge a suspended AudioContext awake from inside a user gesture —
 * browsers may block audio started outside one (autoplay policy).
 */
export function pokeAmbience() {
  try {
    const ctx = getCtx();
    if (ctx && ctx.state === "suspended") ctx.resume();
  } catch {}
}
