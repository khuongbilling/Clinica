/**
 * Crisis Drill — server-authoritative emergency simulation mode.
 *
 * This file contains only the public projection returned to clients.
 * Answer keys, hidden scoring weights, branch logic, and reward decisions
 * remain on the server and are never sent to the client.
 */

export type CrisisDrillDifficulty = 'training' | 'crisis';
export type CrisisDrillStatus = 'active' | 'paused' | 'completed' | 'abandoned';
export type CrisisDrillOutcome = 'exemplary' | 'competent' | 'needs_review' | 'unsafe';
export type CrisisDrillSafety = 'safe' | 'needs_review' | 'unsafe';
export type CrisisDrillUrgency = 'routine' | 'urgent' | 'emergent' | 'critical';

/** Gate controlling access to the Crisis Drill board. */
export interface CrisisDrillGate {
  eligible: boolean;
  reason?: string | null;
  requiredLevel: number;
}

/** Summary card shown on the board before starting a drill. */
export interface CrisisDrillCaseCard {
  id: string;
  version: number;
  variantFamilyId: string;
  title: string;
  subtitle: string;
  scenario: string;
  /** Both 'training' and 'crisis' modes are available for every approved case. */
  availableModes: CrisisDrillDifficulty[];
  approved: boolean;
  available: boolean;
  lockedReason?: string | null;
  personalBest?: number | null;
  completedCount?: number;
  estimatedMinutes: number;
}

/** A single selectable action during an active drill. 3–5 options per step. */
export interface CrisisDrillOption {
  id: string;
  label: string;
  /** Public clinical rationale label — explains what the action does, not why it scores. */
  rationale: string;
}

/** The current step the player must respond to. */
export interface CrisisDrillStep {
  id: string;
  label: string;
  prompt: string;
  /** Urgency label — text-only, no color semantics on the client. */
  urgency: CrisisDrillUrgency;
  options: CrisisDrillOption[];
}

/** Public patient projection — values come from the server on every response. */
export interface CrisisDrillPatient {
  stability: number;
  oxygenation: number;
  perfusion: number;
  concern: string;
  urgency: CrisisDrillUrgency;
}

/** A known clinical finding revealed by a prior action. */
export interface CrisisDrillKnownItem {
  id: string;
  label: string;
  value: string;
}

/** One entry in the drill's authoritative clinical timeline. */
export interface CrisisDrillTimelineEntry {
  responseId: string;
  stepId: string;
  announcement: string;
  stateDelta: string;
  knownIds: string[];
  /** Server-assigned display clock label for this timeline event (e.g. "T+2 min"). */
  timingLabel: string;
}

/** Server-authoritative attempt state — no scores, weights, or branches exposed. */
export interface CrisisDrillAttempt {
  attemptId: string;
  caseId: string;
  version: number;
  mode: CrisisDrillDifficulty;
  status: CrisisDrillStatus;
  step: CrisisDrillStep | null;
  patient: CrisisDrillPatient;
  known: CrisisDrillKnownItem[];
  timeline: CrisisDrillTimelineEntry[];
  safety: CrisisDrillSafety;
  complicationActive: boolean;
  /** Server-assigned elapsed time label — purely display, never used for scoring. */
  elapsedLabel: string;
}

/**
 * Debrief returned after a completed drill.
 * Contains only public-projection learning feedback; no answer keys or
 * private scoring weights are included. Score is already clamped 0–100
 * by the server before being sent here.
 */
export interface CrisisDrillDebrief {
  outcome: CrisisDrillOutcome;
  safety: CrisisDrillSafety;
  /** Public score 0–100 computed and rounded server-side. */
  score: number;
  /** Separate, prestige-only timing result for an uninterrupted Crisis attempt. */
  crisisEfficiency?: {
    eligible: boolean;
    score: number | null;
    note: string;
  };
  urgencyHandling: 'appropriate' | 'delayed' | 'missed';
  strongestDecision: string;
  missedOpportunity: string;
  clinicalPrinciple: string;
  patientSummary: string;
  relatedPractice: string[];
  timeline: CrisisDrillTimelineEntry[];
  firstClear: boolean;
  personalBest: boolean;
  reward: { xp: number; universityCredits: number; message: string };
}
