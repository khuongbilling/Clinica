/**
 * Grand Rounds is a server-authoritative, faculty-framed case mode.
 *
 * This file intentionally contains only the public projection returned to
 * clients. Approved answers, hidden findings, scoring weights, branches, and
 * reward decisions remain on the server.
 */

export type GrandRoundsDifficulty = 'introductory' | 'standard' | 'advanced' | 'expert';
export type GrandRoundsInputKind = 'single_choice' | 'priority' | 'sequence';
export type GrandRoundsSafety = 'safe' | 'needs_review' | 'unsafe';
export type GrandRoundsStatus = 'active' | 'paused' | 'completed' | 'abandoned';
export type GrandRoundsOutcome = 'excellent' | 'competent' | 'needs_review' | 'unsafe';
export type PatientOutcome = 'stabilized' | 'guarded' | 'deteriorated';

export interface GrandRoundsGate {
  eligible: boolean;
  reason?: string | null;
  requiredPractice: { lessons: number; cueLab: number; triage: number; stack: number };
}

export interface GrandRoundsCaseCard {
  id: string;
  version: number;
  variantFamilyId: string;
  title: string;
  subtitle: string;
  domain: string;
  difficulty: GrandRoundsDifficulty;
  estimatedMinutes: number;
  reviewed: boolean;
  available: boolean;
  lockedReason?: string | null;
  personalBest?: number | null;
  completedCount?: number;
}

export interface GrandRoundsOption {
  id: string;
  label: string;
  rationale: string;
}

export interface GrandRoundsStation {
  id: string;
  label: string;
  inputKind: GrandRoundsInputKind;
  prompt: string;
  options: GrandRoundsOption[];
}

export interface GrandRoundsPatient {
  stability: number;
  oxygenation: number;
  perfusion: number;
  concern: string;
  acuity: 'low' | 'moderate' | 'high' | 'critical';
}

export interface GrandRoundsKnownItem {
  id: string;
  label: string;
  value: string;
}

export interface GrandRoundsTimelineEntry {
  responseId: string;
  stageId: string;
  announcement: string;
  stateDelta: string;
  knownIds: string[];
}

export interface GrandRoundsAttempt {
  attemptId: string;
  caseId: string;
  version: number;
  branchId: string;
  difficulty: GrandRoundsDifficulty;
  status: GrandRoundsStatus;
  stage: GrandRoundsStation | null;
  patient: GrandRoundsPatient;
  known: GrandRoundsKnownItem[];
  timeline: GrandRoundsTimelineEntry[];
  safety: GrandRoundsSafety;
  notes: string;
  complicationActive: boolean;
}

export interface GrandRoundsDebrief {
  outcome: GrandRoundsOutcome;
  patientOutcome: PatientOutcome;
  score: number;
  rawScore: number;
  safety: GrandRoundsSafety;
  domainBreakdown: Record<string, number>;
  strongestDecision: string;
  missedOpportunity: string;
  patientEvolution: string;
  clinicalPrinciple: string;
  relatedPractice: string[];
  timeline: GrandRoundsTimelineEntry[];
  firstClear: boolean;
  personalBest: boolean;
  reward: { xp: number; universityCredits: number; mastery: number; message: string };
}