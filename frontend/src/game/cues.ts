import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

// ─────────────────────────────────────────────────────────────
// Lightweight, dependency-free feedback cues for moments worth
// noticing (Daily Ward Rounds progress, battle victory, reward
// claims, gacha pulls, hero promotions…). Two channels:
//   • Sound  — a soft synthesized chime via the Web Audio API on
//              web. No bundled asset, no audio package. Silently
//              no-ops anywhere Web Audio is unavailable (e.g. native).
//   • Haptic — a light tap on native via expo-haptics. Silently
//              no-ops on web where haptics don't exist.
//
// Both channels are independently mutable via `setSoundEnabled` /
// `setHapticsEnabled`, driven by the player's settings (see
// settingsStore). Everything is wrapped in try/catch so a missing
// or restricted audio/haptic API can never break a render.
// ─────────────────────────────────────────────────────────────

let soundEnabled = true;
let hapticsEnabled = true;

/** Toggle the audio channel (persisted via settingsStore). */
export function setSoundEnabled(next: boolean) {
  soundEnabled = next;
}

/** Toggle the haptic channel (persisted via settingsStore). */
export function setHapticsEnabled(next: boolean) {
  hapticsEnabled = next;
}

let audioCtx: any = null;

function getAudioCtx(): any | null {
  if (Platform.OS !== "web") return null;
  try {
    if (typeof window === "undefined") return null;
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    if (!audioCtx) audioCtx = new Ctor();
    return audioCtx;
  } catch {
    return null;
  }
}

// One gentle sine "ping" with a fast attack and soft exponential tail.
function playTone(ctx: any, freq: number, startAt: number, duration: number, peak: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.03);
}

function playChime(celebrate: boolean) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    if (celebrate) {
      // Warm ascending arpeggio (C5–E5–G5–C6) for a celebratory moment.
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => playTone(ctx, f, now + i * 0.09, 0.3, 0.11));
    } else {
      // Soft two-note lift for ordinary progress.
      playTone(ctx, 659.25, now, 0.16, 0.08);
      playTone(ctx, 880.0, now + 0.075, 0.22, 0.08);
    }
  } catch {
    // Audio blocked (autoplay policy, etc.) — degrade silently.
  }
}

function playHaptic(celebrate: boolean) {
  if (Platform.OS === "web") return;
  try {
    if (celebrate) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // Haptics unavailable on this device — degrade silently.
  }
}

/**
 * Fire a "you earned something" feedback cue. `celebrate` selects the
 * richer flavour (fuller chime + success haptic) for bigger moments —
 * a battle victory, all daily duties complete, a reward claimed — over
 * an ordinary advance. Each channel respects its own mute setting.
 */
export function playRewardCue(celebrate = false) {
  if (soundEnabled) playChime(celebrate);
  if (hapticsEnabled) playHaptic(celebrate);
}
