/**
 * Faculty-only Grand Rounds authoring contract.
 *
 * Unlike game/grandRounds.ts, this module intentionally includes the private
 * clinical decision contract. It is imported only by the protected faculty
 * workspace and is never used by learner gameplay screens.
 */
export type FacultyGrandRoundsRole = 'author' | 'reviewer' | 'approver';
export type FacultyGrandRoundsDraftStatus =
  | 'draft'
  | 'in_review'
  | 'changes_requested'
  | 'approved_for_publish'
  | 'published';

export interface FacultyGrandRoundsAuditEvent {
  at: string;
  actorId: string;
  event: string;
  revision: number;
}

export interface FacultyGrandRoundsReview {
  reviewerId: string;
  decision: 'approve_for_publish' | 'changes_requested';
  notes: string;
  reviewedAt: string;
}

export interface FacultyGrandRoundsDraft {
  draftId: string;
  caseId: string;
  version: number;
  status: FacultyGrandRoundsDraftStatus;
  revision: number;
  manifest: Record<string, unknown>;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  review?: FacultyGrandRoundsReview;
  approval?: { approverId: string; approvedAt: string };
  audit: FacultyGrandRoundsAuditEvent[];
}

export interface FacultyGrandRoundsBoard {
  faculty: { id: string; role: FacultyGrandRoundsRole };
  drafts: FacultyGrandRoundsDraft[];
  catalog: Array<{ caseId: string; currentVersion: number; status: 'active' | 'retired'; updatedAt: string }>;
}