import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Dimensions, Platform } from 'react-native';

const STORAGE_KEY = 'clinica.testSession.v1';

export interface TestEvent {
  timestamp: string;
  screen: string;
  eventName: string;
  playerAction?: string;
  gameState?: {
    stability?: number;
    corruption?: number;
    ap?: number;
    enemy?: string;
    turn?: number;
  };
  feedbackShown?: string;
  wasTutorialGuided?: boolean;
  actionQuality?: 'correct' | 'weak' | 'unsafe' | 'neutral';
  objective?: string;
  meta?: Record<string, any>;
}

export interface BattleSummary {
  enemy: string;
  result: string;
  turns: number;
  stars: number;
  careAttemptsUsed: number;
  wrongActionsUsed: number;
  careChainCompleted: boolean;
}

export interface TestSession {
  testSessionId: string;
  playerProfile: string;
  device: { width: number; height: number; userAgent: string };
  screensVisited: string[];
  events: TestEvent[];
  battleSummary: BattleSummary;
  questionsForChatGPT: string[];
}

function makeDevice() {
  const { width, height } = Dimensions.get('window');
  let ua = `${Platform.OS} ${Platform.Version}`;
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') ua = navigator.userAgent;
  return { width, height, userAgent: ua };
}

function freshSession(): TestSession {
  return {
    testSessionId: new Date().toISOString(),
    playerProfile: 'unknown',
    device: makeDevice(),
    screensVisited: [],
    events: [],
    battleSummary: {
      enemy: '', result: '', turns: 0, stars: 0,
      careAttemptsUsed: 0, wrongActionsUsed: 0, careChainCompleted: false,
    },
    questionsForChatGPT: [
      'Would a nonmedical player understand the goal?',
      'Was the first battle clear?',
      'Was the feedback useful?',
      'Would the player want to continue?',
      'What should be improved?',
    ],
  };
}

type Ctx = {
  session: TestSession;
  logEvent: (eventName: string, screen: string, details?: Partial<Omit<TestEvent, 'timestamp' | 'eventName' | 'screen'>>) => void;
  updateProfile: (profile: string) => void;
  updateBattleSummary: (delta: Partial<BattleSummary>) => void;
  resetSession: () => void;
  exportJSON: () => string;
};

const TestSessionContext = createContext<Ctx | null>(null);

async function persist(s: TestSession) {
  try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

export function TestSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<TestSession>(() => freshSession());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) { try { setSession(JSON.parse(raw)); } catch {} }
    });
  }, []);

  const logEvent = useCallback((
    eventName: string,
    screen: string,
    details: Partial<Omit<TestEvent, 'timestamp' | 'eventName' | 'screen'>> = {}
  ) => {
    setSession((prev) => {
      const event: TestEvent = { timestamp: new Date().toISOString(), screen, eventName, ...details };
      const screens = prev.screensVisited.includes(screen)
        ? prev.screensVisited
        : [...prev.screensVisited, screen];
      const next = { ...prev, events: [...prev.events, event], screensVisited: screens };
      persist(next);
      return next;
    });
  }, []);

  const updateProfile = useCallback((profile: string) => {
    setSession((prev) => {
      const next = { ...prev, playerProfile: profile };
      persist(next);
      return next;
    });
  }, []);

  const updateBattleSummary = useCallback((delta: Partial<BattleSummary>) => {
    setSession((prev) => {
      const next = { ...prev, battleSummary: { ...prev.battleSummary, ...delta } };
      persist(next);
      return next;
    });
  }, []);

  const resetSession = useCallback(() => {
    const s = freshSession();
    setSession(s);
    persist(s);
  }, []);

  const exportJSON = useCallback(() => {
    return JSON.stringify(session, null, 2);
  }, [session]);

  return (
    <TestSessionContext.Provider value={{ session, logEvent, updateProfile, updateBattleSummary, resetSession, exportJSON }}>
      {children}
    </TestSessionContext.Provider>
  );
}

export function useTestSession(): Ctx {
  const ctx = useContext(TestSessionContext);
  if (!ctx) throw new Error('useTestSession must be inside TestSessionProvider');
  return ctx;
}
