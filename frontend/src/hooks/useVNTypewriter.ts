/**
 * useVNTypewriter
 *
 * Shared typewriter hook for prologue VN scenes.
 * Manages character-reveal animation state for a single dialogue line.
 *
 * API:
 *   startTypewriter(line)  — begin character-by-character reveal
 *   skipTypewriter(line)   — jump to fully-revealed (tap-to-skip)
 *   stopTypewriter()       — halt reveal without changing displayed text
 *   instantShow(line)      — show instantly without typewriter (SI monologue etc.)
 */

import { useCallback, useRef, useState } from "react";

const DEFAULT_CHARS_PER_SEC = 32;

export function useVNTypewriter(charsPerSec = DEFAULT_CHARS_PER_SEC) {
  const [displayed,      setDisplayed]      = useState("");
  const [typewriterDone, setTypewriterDone] = useState(false);

  const twTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTypewriter = useCallback(() => {
    if (twTimer.current) { clearInterval(twTimer.current); twTimer.current = null; }
  }, []);

  const startTypewriter = useCallback((line: string) => {
    stopTypewriter();
    setDisplayed("");
    setTypewriterDone(false);
    let pos = 0;
    const interval = Math.round(1000 / charsPerSec);
    twTimer.current = setInterval(() => {
      pos += 1;
      setDisplayed(line.slice(0, pos));
      if (pos >= line.length) {
        stopTypewriter();
        setTypewriterDone(true);
      }
    }, interval);
  }, [charsPerSec, stopTypewriter]);

  const skipTypewriter = useCallback((line: string) => {
    stopTypewriter();
    setDisplayed(line);
    setTypewriterDone(true);
  }, [stopTypewriter]);

  /** Show the full line instantly with no typewriter (e.g. auto-advanced SI monologue). */
  const instantShow = useCallback((line: string) => {
    stopTypewriter();
    setDisplayed(line);
    setTypewriterDone(true);
  }, [stopTypewriter]);

  return {
    displayed,
    typewriterDone,
    startTypewriter,
    skipTypewriter,
    stopTypewriter,
    instantShow,
  };
}
