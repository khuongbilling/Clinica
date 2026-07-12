import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { TutorialId, TutorialStep, TUTORIALS } from "./tutorials";
import type { ViewStyle } from "react-native";

const STORAGE_KEY = "clinica.tutorials.v1";

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
   * blocking scrim never leaks onto the next screen. Because completion is not
   * recorded, the tutorial auto-restarts the next time its screen mounts.
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

async function loadProgress(): Promise<TutorialProgress> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [completed, setCompleted] = useState<TutorialProgress>({});
  const [activeTutorialId, setActiveTutorialId] = useState<TutorialId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [guidedReserve, setGuidedReserve] = useState(0);

  // Ref mirrors so startTutorial can guard synchronously (two screens mounting
  // in the same frame must not preempt each other's tutorial).
  const activeRef = useRef<TutorialId | null>(null);
  const completedRef = useRef<TutorialProgress>({});
  useEffect(() => { activeRef.current = activeTutorialId; }, [activeTutorialId]);
  useEffect(() => { completedRef.current = completed; }, [completed]);

  // Hydration guard: until the persisted completion flags have loaded,
  // startTutorial must not trust the (still empty) completedRef — otherwise a
  // screen's auto-start timer firing before hydration replays a tutorial the
  // player already finished. Pre-hydration starts are queued and resolved
  // against the real data once it lands.
  const hydratedRef = useRef(false);
  const pendingStartRef = useRef<TutorialId | null>(null);

  useEffect(() => {
    loadProgress().then((p) => {
      completedRef.current = p;
      setCompleted(p);
      hydratedRef.current = true;
      const pending = pendingStartRef.current;
      pendingStartRef.current = null;
      if (pending && !activeRef.current && !p[pending]) {
        activeRef.current = pending;
        setActiveTutorialId(pending);
        setStepIndex(0);
      }
    });
  }, []);

  const markDone = useCallback(async (id: TutorialId) => {
    setCompleted(prev => {
      const next = { ...prev, [id]: true };
      saveProgress(next);
      return next;
    });
  }, []);

  const startTutorial = useCallback((id: TutorialId) => {
    // ONE tutorial loop at a time: never preempt an in-progress tutorial, and
    // never auto-restart one that's already running or already completed.
    // (Deliberate replays go through replayTutorial, which un-completes first.)
    if (!hydratedRef.current) {
      if (!pendingStartRef.current) pendingStartRef.current = id;
      return;
    }
    if (activeRef.current) return;
    if (completedRef.current[id]) return;
    activeRef.current = id;
    setActiveTutorialId(id);
    setStepIndex(0);
  }, []);

  const doAdvance = useCallback((tutId: TutorialId, idx: number) => {
    const steps = TUTORIALS[tutId];
    const nextIdx = idx + 1;
    if (nextIdx >= steps.length) {
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
    markDone(activeTutorialId);
    activeRef.current = null;
    completedRef.current = { ...completedRef.current, [activeTutorialId]: true };
    setActiveTutorialId(null);
    setStepIndex(0);
  }, [activeTutorialId, markDone]);

  const replayTutorial = useCallback(async (id: TutorialId) => {
    setCompleted(prev => {
      const next = { ...prev, [id]: false };
      saveProgress(next);
      return next;
    });
    completedRef.current = { ...completedRef.current, [id]: false };
    activeRef.current = id;
    setActiveTutorialId(id);
    setStepIndex(0);
  }, []);

  const clearActiveTutorial = useCallback(() => {
    // Drop any queued pre-hydration start too — the player has left the screen
    // that requested it, so resolving it later would surface a stale overlay.
    pendingStartRef.current = null;
    if (!activeRef.current) return;
    activeRef.current = null;
    setActiveTutorialId(null);
    setStepIndex(0);
  }, []);

  const resetTutorials = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {}
    completedRef.current = {};
    activeRef.current = null;
    setCompleted({});
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
  return { isHighlighted, isTutorialBlocked, onTargetPress, highlightStyle };
}

