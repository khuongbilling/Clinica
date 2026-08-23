/**
 * Faculty-only Grand Rounds authoring contract.
 *
 * Unlike game/grandRounds.ts, this module intentionally includes the private
 * clinical decision contract. It is imported only by the protected faculty
 * workspace and is never used by learner gameplay screens.
 */
export type FacultyGrandRoundsRole = 'author' | 'reviewer' | 'approver';
export type FacultyCredentialStatus = 'active' | 'revoked';
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

export interface FacultyCredentialAuditEvent {
  at: string;
  actorId: string;
  event: 'credential_issued' | 'credential_rotated' | 'credential_revoked';
  credentialId: string;
  facultyId?: string;
  role?: FacultyGrandRoundsRole;
  previousRole?: FacultyGrandRoundsRole;
  nextRole?: FacultyGrandRoundsRole;
  reason?: string;
}

export interface FacultyCredential {
  credentialId: string;
  facultyId: string;
  role: FacultyGrandRoundsRole;
  status: FacultyCredentialStatus;
  issuedAt: string;
  issuedBy: string;
  updatedAt: string;
  revokedAt?: string;
  revokedBy?: string;
  audit: FacultyCredentialAuditEvent[];
}

export interface FacultyCredentialBoard {
  administrator: { id: string };
  credentials: FacultyCredential[];
}