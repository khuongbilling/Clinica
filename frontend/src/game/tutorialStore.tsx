import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { TutorialId, TutorialStep, TUTORIALS } from "./tutorials";

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
  isCompleted: (id: TutorialId) => boolean;
  onRequiredAction: (actionType: string, skillId?: string) => void;
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

  const currentStep = useMemo<TutorialStep | null>(() => {
    if (!activeTutorialId) return null;
    return TUTORIALS[activeTutorialId][stepIndex] ?? null;
  }, [activeTutorialId, stepIndex]);

  const totalSteps = useMemo(() => {
    if (!activeTutorialId) return 0;
    return TUTORIALS[activeTutorialId].length;
  }, [activeTutorialId]);

  const value = useMemo<TutorialCtx>(() => ({
    completed,
    activeTutorialId,
    stepIndex,
    currentStep,
    totalSteps,
    startTutorial,
    advanceStep,
    skipTutorial,
    markDone,
    replayTutorial,
    resetTutorials,
    isCompleted,
    onRequiredAction,
    guidedReserve,
    setGuidedReserve,
  }), [completed, activeTutorialId, stepIndex, currentStep, totalSteps,
    startTutorial, advanceStep, skipTutorial, markDone, replayTutorial, resetTutorials, isCompleted, onRequiredAction,
    guidedReserve]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTutorial() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTutorial must be used within TutorialProvider");
  return ctx;
}
