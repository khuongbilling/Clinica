import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { setHapticsEnabled, setSoundEnabled } from "./cues";

// ─────────────────────────────────────────────────────────────
// Device-level game settings (sound + haptics on/off). These are a
// per-device preference, not account data, so they live in local
// AsyncStorage (mirroring tutorialStore) rather than in PlayerState /
// the backend. On change we push the values straight into the cue
// helper (cues.ts) so playback respects them everywhere.
//
// Uses the shared `clinica.` key prefix so Reset Account clears it too
// (defaults back to on, which is the desired post-reset state).
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "clinica.settings.v1";

type Settings = {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
};

const DEFAULTS: Settings = { soundEnabled: true, hapticsEnabled: true };

interface SettingsCtx extends Settings {
  setSound: (next: boolean) => void;
  setHaptics: (next: boolean) => void;
}

const Ctx = createContext<SettingsCtx | null>(null);

async function saveSettings(s: Settings) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      soundEnabled: parsed.soundEnabled !== false,
      hapticsEnabled: parsed.hapticsEnabled !== false,
    };
  } catch {
    return DEFAULTS;
  }
}

// Keep the cue helper in sync with the current settings.
function applyToCues(s: Settings) {
  setSoundEnabled(s.soundEnabled);
  setHapticsEnabled(s.hapticsEnabled);
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      applyToCues(s);
    });
  }, []);

  const setSound = useCallback((next: boolean) => {
    setSettings((prev) => {
      const updated = { ...prev, soundEnabled: next };
      applyToCues(updated);
      saveSettings(updated);
      return updated;
    });
  }, []);

  const setHaptics = useCallback((next: boolean) => {
    setSettings((prev) => {
      const updated = { ...prev, hapticsEnabled: next };
      applyToCues(updated);
      saveSettings(updated);
      return updated;
    });
  }, []);

  const value = useMemo<SettingsCtx>(() => ({
    ...settings,
    setSound,
    setHaptics,
  }), [settings, setSound, setHaptics]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
