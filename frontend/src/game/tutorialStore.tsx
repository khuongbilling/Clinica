import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { TutorialId, TutorialStep, TUTORIALS } from "./tutorials";
import { Animated } from "react-native";
import type { ViewStyle } from "react-native";

const STORAGE_KEY = "clinica.tutorials.v1";
/**
 * Separate key for tutorials the player started but left before the final step.
 * Dismissed tutorials are NOT shown as "completed" in the Tutorial Replay Center
 * (so they appear available for replay) but are NOT auto-started on the next
 * visit (so the overlay doesn't re-intrude unprompted every time the screen loads).
 * Replay via Tutorial Replay Center clears both dismissed and completed flags.
 */
const DISMISSED_KEY = "clinica.tutorials.dismissed.v1";
/**
 * Persists the tutorial that is currently in-progress so we can detect a
 * force-quit.  Written when startTutorial fires, cleared on every normal exit
 * (completion, skip, clearActiveTutorial, replayTutorial start).
 * On boot: if the stored ID is a battle-screen tutorial it is auto-dismissed
 * so it cannot block hub UI.
 */
const ACTIVE_KEY = "clinica.tutorials.active.v1";

/** Tutorial IDs that only make sense inside the battle screen.
 *  A stale persisted active-ID from one of these means the app was force-quit
 *  mid-battle; we dismiss it at boot so hub screens are never blocked. */
const BATTLE_TUTORIAL_IDS: ReadonlySet<TutorialId> = new Set([
  "prologueBattle",
  "firstBattle",
  "clinicalCueIntro",
] as TutorialId[]);

export type TutorialProgress = Partial<Record<TutorialId, boolean>>;

interface TutorialCtx {
  completed: TutorialProgress;
  activeTutorialId: TutorialId | null;
  stepIndex: number;
  currentStep: TutorialStep | null;
  totalSteps: number;
  startTutorial: (id: TutorialId) => void;
  advanceStep: () => void;
  skipTutorial: () => void;
  markDone: (id: TutorialId) => Promise<void>;
  replayTutorial: (id: TutorialId) => Promise<void>;
  resetTutorials: () => Promise<void>;
  /**
   * Abandon the in-progress tutorial WITHOUT marking it complete — used when
   * the player leaves a tutorial screen mid-flow so the overlay / highlight /
   * blocking scrim never leaks onto the next screen.
   *
   * The tutorial is recorded as "dismissed" (prevents noisy auto-restart on
   * every future visit) but NOT as "completed" (so it remains available in
   * Profile → Tutorial Replay Center / Tutorial Encyclopedia). Replay clears
   * the dismissed flag and restarts from step 1.
   */
  clearActiveTutorial: () => void;
  isCompleted: (id: TutorialId) => boolean;
  onRequiredAction: (actionType: string, skillId?: string) => void;
  /**
   * For University mini-game tutorials: call this with the tapped element's ID.
   * Advances the tutorial only if currentStep.requiredTargetId matches.
   * Mini-game screens should use useHighlightTarget(id) instead of calling
   * this directly — it handles both the highlight style and the press binding.
   */
  onTargetTap: (targetId: string) => void;
  /** The requiredTargetId of the current step, or null when not applicable. */
  requiredTargetId: string | null;
  /** Vertical space (px) a bottom-placed guided box currently needs, measured
   *  live by TutorialOverlay so screens can reserve exactly enough room and
   *  never let the box cover the control it points to. 0 when not applicable. */
  guidedReserve: number;
  setGuidedReserve: (h: number) => void;
}

const Ctx = createContext<TutorialCtx | null>(null);

async function saveProgress(progress: TutorialProgress) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {}
}

async function saveDismissed(dismissed: TutorialProgress) {
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
  } catch {}
}

async function loadProgress(): Promise<TutorialProgress> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function loadDismissed(): Promise<TutorialProgress> {
  try {
    const raw = await AsyncStorage.getItem(DISMISSED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function persistActiveId(id: TutorialId | null) {
  try {
    if (id === null) {
      await AsyncStorage.removeItem(ACTIVE_KEY);
    } else {
      await AsyncStorage.setItem(ACTIVE_KEY, id);
    }
  } catch {}
}

async function loadActiveId(): Promise<TutorialId | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_KEY);
    return (raw as TutorialId | null) ?? null;
  } catch {
    return null;
  }
}

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [completed, setCompleted] = useState<TutorialProgress>({});
  const [dismissed, setDismissed] = useState<TutorialProgress>({});
  const [activeTutorialId, setActiveTutorialId] = useState<TutorialId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [guidedReserve, setGuidedReserve] = useState(0);

  // Ref mirrors so startTutorial can guard synchronously (two screens mounting
  // in the same frame must not preempt each other's tutorial).
  const activeRef = useRef<TutorialId | null>(null);
  // Rapid-tap dedupe: records the stepIndex most recently passed to doAdvance.
  // A second call with the same index (rapid double-tap before rerender) is
  // ignored, preventing steps from being skipped.
  const lastAdvancedIdxRef = useRef(-1);
  const completedRef = useRef<TutorialProgress>({});
  const dismissedRef = useRef<TutorialProgress>({});
  useEffect(() => { activeRef.current = activeTutorialId; }, [activeTutorialId]);
  useEffect(() => { completedRef.current = completed; }, [completed]);
  useEffect(() => { dismissedRef.current = dismissed; }, [dismissed]);

  // Hydration guard: until the persisted completion flags have loaded,
  // startTutorial must not trust the (still empty) completedRef — otherwise a
  // screen's auto-start timer firing before hydration replays a tutorial the
  // player already finished. Pre-hydration starts are queued and resolved
  // against the real data once it lands.
  const hydratedRef = useRef(false);
  const pendingStartRef = useRef<TutorialId | null>(null);

  useEffect(() => {
    Promise.all([loadProgress(), loadDismissed(), loadActiveId()]).then(([p, d, storedActiveId]) => {
      // Force-quit recovery: if the app was killed while a battle-screen tutorial
      // was in progress, storedActiveId will still name it.  Dismiss it so it
      // cannot auto-start on non-battle screens (hub, realm, etc.) after relaunch.
      // Only fires when the ID is a known battle tutorial AND was not already
      // completed/dismissed — a normal-exit completion/skip clears ACTIVE_KEY
      // first, so storedActiveId is null for those cases.
      let dPatched = d;
      if (
        storedActiveId &&
        BATTLE_TUTORIAL_IDS.has(storedActiveId) &&
        !p[storedActiveId] &&
        !d[storedActiveId]
      ) {
        dPatched = { ...d, [storedActiveId]: true };
        saveDismissed(dPatched);
        // Clear the stale active marker so it doesn't trigger again next boot.
        persistActiveId(null);
      } else if (storedActiveId && (p[storedActiveId] || d[storedActiveId])) {
        // Active marker is present but tutorial is already completed/dismissed —
        // orphaned marker from an older code path; just clean it up.
        persistActiveId(null);
      }

      completedRef.current = p;
      dismissedRef.current = dPatched;
      setCompleted(p);
      setDismissed(dPatched);
      hydratedRef.current = true;
      const pending = pendingStartRef.current;
      pendingStartRef.current = null;
      if (pending && !activeRef.current && !p[pending] && !dPatched[pending]) {
        activeRef.current = pending;
        setActiveTutorialId(pending);
        setStepIndex(0);
        persistActiveId(pending);
      }
    });
  }, []);

  const markDone = useCallback(async (id: TutorialId) => {
    // Clear the active-session marker so a subsequent boot cannot misread this
    // tutorial as force-quit-stale.
    persistActiveId(null);
    setCompleted(prev => {
      const next = { ...prev, [id]: true };
      saveProgress(next);
      return next;
    });
    // If it was previously dismissed, clear that flag — it's now fully complete.
    setDismissed(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev, [id]: false };
      saveDismissed(next);
      return next;
    });
  }, []);

  const startTutorial = useCallback((id: TutorialId) => {
    // ONE tutorial loop at a time: never preempt an in-progress tutorial, and
    // never auto-restart one that's already running, already completed, or
    // dismissed mid-flow (player left early — they can replay via Tutorial
    // Replay Center when ready, but the overlay should not re-intrude
    // automatically on every subsequent visit).
    if (!hydratedRef.current) {
      if (!pendingStartRef.current) pendingStartRef.current = id;
      return;
    }
    if (activeRef.current) return;
    if (completedRef.current[id]) return;
    if (dismissedRef.current[id]) return;
    lastAdvancedIdxRef.current = -1;
    activeRef.current = id;
    setActiveTutorialId(id);
    setStepIndex(0);
    persistActiveId(id);
  }, []);

  const doAdvance = useCallback((tutId: TutorialId, idx: number) => {
    // Dedupe guard: if this exact step was already advanced (rapid double-tap
    // before rerender), ignore the duplicate call.
    if (idx === lastAdvancedIdxRef.current) return;
    lastAdvancedIdxRef.current = idx;
    const steps = TUTORIALS[tutId];
    const nextIdx = idx + 1;
    if (nextIdx >= steps.length) {
      lastAdvancedIdxRef.current = -1;
      markDone(tutId);
      activeRef.current = null;
      completedRef.current = { ...completedRef.current, [tutId]: true };
      setActiveTutorialId(null);
      setStepIndex(0);
    } else {
      setStepIndex(nextIdx);
    }
  }, [markDone]);

  const advanceStep = useCallback(() => {
    if (!activeTutorialId) return;
    doAdvance(activeTutorialId, stepIndex);
  }, [activeTutorialId, stepIndex, doAdvance]);

  const skipTutorial = useCallback(() => {
    if (!activeTutorialId) return;
    markDone(activeTutorialId); // markDone already calls persistActiveId(null)
    activeRef.current = null;
    completedRef.current = { ...completedRef.current, [activeTutorialId]: true };
    setActiveTutorialId(null);
    setStepIndex(0);
  }, [activeTutorialId, markDone]);

  const replayTutorial = useCallback(async (id: TutorialId) => {
    // Clear completed flag so the tutorial can auto-start again.
    setCompleted(prev => {
      const next = { ...prev, [id]: false };
      saveProgress(next);
      return next;
    });
    completedRef.current = { ...completedRef.current, [id]: false };
    // Also clear dismissed flag — replay is intentional, the block is lifted.
    setDismissed(prev => {
      const next = { ...prev, [id]: false };
      saveDismissed(next);
      return next;
    });
    dismissedRef.current = { ...dismissedRef.current, [id]: false };
    lastAdvancedIdxRef.current = -1;
    activeRef.current = id;
    setActiveTutorialId(id);
    setStepIndex(0);
    persistActiveId(id);
  }, []);

  const clearActiveTutorial = useCallback(() => {
    // Drop any queued pre-hydration start too — the player has left the screen
    // that requested it, so resolving it later would surface a stale overlay.
    pendingStartRef.current = null;
    if (!activeRef.current) return;
    // Mark dismissed (NOT completed) so:
    //   • The overlay does not auto-restart on the player's next visit.
    //   • The tutorial is still shown as available in Tutorial Replay Center.
    //   • replayTutorial() clears this flag so the player can re-experience it.
    const id = activeRef.current;
    const nextDismissed = { ...dismissedRef.current, [id]: true };
    dismissedRef.current = nextDismissed;
    setDismissed(nextDismissed);
    saveDismissed(nextDismissed);
    persistActiveId(null);
    activeRef.current = null;
    setActiveTutorialId(null);
    setStepIndex(0);
  }, []);

  const resetTutorials = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.removeItem(DISMISSED_KEY);
      await AsyncStorage.removeItem(ACTIVE_KEY);
    } catch {}
    completedRef.current = {};
    dismissedRef.current = {};
    activeRef.current = null;
    setCompleted({});
    setDismissed({});
    setActiveTutorialId(null);
    setStepIndex(0);
  }, []);

  const isCompleted = useCallback((id: TutorialId) => {
    return !!completed[id];
  }, [completed]);

  const onRequiredAction = useCallback((actionType: string, skillId?: string) => {
    if (!activeTutorialId) return;
    const steps = TUTORIALS[activeTutorialId];
    const step = steps[stepIndex];
    if (!step?.requireAction) return;
    // A step pinned to a specific skill is only satisfied by that exact skill.
    if (step.requiredSkillId) {
      if (step.requiredSkillId !== skillId) return;
    } else if (step.requiredActionType && step.requiredActionType !== actionType) {
      return;
    }
    doAdvance(activeTutorialId, stepIndex);
  }, [activeTutorialId, stepIndex, doAdvance]);

  const onTargetTap = useCallback((targetId: string) => {
    if (!activeTutorialId) return;
    const steps = TUTORIALS[activeTutorialId];
    const step = steps[stepIndex];
    if (!step?.requireAction || !step.requiredTargetId) return;
    if (step.requiredTargetId !== targetId) return;
    doAdvance(activeTutorialId, stepIndex);
  }, [activeTutorialId, stepIndex, doAdvance]);

  const currentStep = useMemo<TutorialStep | null>(() => {
    if (!activeTutorialId) return null;
    return TUTORIALS[activeTutorialId][stepIndex] ?? null;
  }, [activeTutorialId, stepIndex]);

  const totalSteps = useMemo(() => {
    if (!activeTutorialId) return 0;
    return TUTORIALS[activeTutorialId].length;
  }, [activeTutorialId]);

  const requiredTargetId = useMemo<string | null>(
    () => currentStep?.requiredTargetId ?? null,
    [currentStep],
  );

  const value = useMemo<TutorialCtx>(() => ({
    completed,
    activeTutorialId,
    stepIndex,
    currentStep,
    totalSteps,
    startTutorial,
    advanceStep,
    skipTutorial,
    clearActiveTutorial,
    markDone,
    replayTutorial,
    resetTutorials,
    isCompleted,
    onRequiredAction,
    onTargetTap,
    requiredTargetId,
    guidedReserve,
    setGuidedReserve,
  }), [completed, activeTutorialId, stepIndex, currentStep, totalSteps,
    startTutorial, advanceStep, skipTutorial, markDone, replayTutorial, resetTutorials,
    clearActiveTutorial, isCompleted,
    onRequiredAction, onTargetTap, requiredTargetId,
    guidedReserve]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTutorial() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTutorial must be used within TutorialProvider");
  return ctx;
}

/**
 * Convenience hook for any tappable element in a University mini-game screen.
 *
 * Usage:
 *   const { isHighlighted, isTutorialBlocked, onTargetPress } = useHighlightTarget("clue_dry_lips");
 *   <Pressable onPress={onTargetPress} style={[styles.chip, isHighlighted && styles.chipHighlight]}>
 *
 * When `isHighlighted` is true the element is the current forced tutorial target.
 * When `isTutorialBlocked` is true a DIFFERENT element is required — this element
 *   should return early in its press handler so wrong taps have no game effect.
 *   This replaces the previous scrim-based blocking (which breaks inside ScrollViews
 *   on native because the ScrollView layer context prevents zIndex from propagating).
 */
export function useHighlightTarget(targetId: string): {
  isHighlighted: boolean;
  isTutorialBlocked: boolean;
  onTargetPress: () => void;
  highlightStyle: ViewStyle;
  pulseAnim: Animated.Value;
} {
  const { requiredTargetId, onTargetTap, currentStep, activeTutorialId } = useTutorial();
  const isHighlighted =
    !!activeTutorialId &&
    !!currentStep?.requireAction &&
    !!currentStep?.requiredTargetId &&
    requiredTargetId === targetId;
  // True when a tutorial step requires a DIFFERENT element — this element is
  // blocked and must not fire its game handler.
  const isTutorialBlocked =
    !!activeTutorialId &&
    !!currentStep?.requireAction &&
    !!currentStep?.requiredTargetId &&
    requiredTargetId !== targetId;
  const onTargetPress = useCallback(() => {
    if (isHighlighted) onTargetTap(targetId);
  }, [isHighlighted, onTargetTap, targetId]);

  // Blink pulse: gently scales the highlighted element to draw attention
  // without darkening any surrounding UI.
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isHighlighted) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 480, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0,  duration: 480, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isHighlighted, pulseAnim]);

  const highlightStyle: ViewStyle = isHighlighted
    ? {
        zIndex: 9500,
        borderWidth: 2,
        borderColor: "#2DD4BF",
        shadowColor: "#2DD4BF",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 12,
        elevation: 20,
      }
    : {};
  return { isHighlighted, isTutorialBlocked, onTargetPress, highlightStyle, pulseAnim };
}
