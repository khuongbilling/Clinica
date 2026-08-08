/**
 * journeyHierarchy.ts — Canonical Journey hierarchy data.
 *
 * Defines the full Saga → Age → Book → Chapter progression tree.
 * Screens at each level load from this file — no new screens are needed
 * when additional Sagas, Ages, or Books are added here.
 *
 * Structure:
 *   Saga  ─ top-level narrative arc (e.g. "The Grand Ward")
 *     Age   ─ era within a saga (e.g. "Awakening")
 *       Book  ─ volume within an age, references a slice of CHAPTERS
 *
 * Lock states are evaluated at runtime against the player's level.
 * A null unlockCondition means always unlocked.
 */

import { CHAPTERS } from "./chapterJourney";

// ── Node status ────────────────────────────────────────────────────────────────

export type HierarchyStatus = "active" | "coming_soon";

// ── Unlock condition ───────────────────────────────────────────────────────────

export interface UnlockCondition {
  /** Minimum player level required to access this node. */
  playerLevel: number;
  /** Human-readable description shown on locked cards. */
  label: string;
}

// ── Book ───────────────────────────────────────────────────────────────────────

export interface JourneyBook {
  id: string;
  title: string;
  subtitle: string;
  theme: string;
  accentColor: string;
  /** Range of chapter numbers this book covers (inclusive). */
  chapterRange: [number, number];
  unlockCondition: UnlockCondition | null;
  status: HierarchyStatus;
  imageKey?: string;
}

// ── Age ────────────────────────────────────────────────────────────────────────

export interface JourneyAge {
  id: string;
  title: string;
  subtitle: string;
  theme: string;
  accentColor: string;
  books: JourneyBook[];
  unlockCondition: UnlockCondition | null;
  status: HierarchyStatus;
  imageKey?: string;
}

// ── Saga ───────────────────────────────────────────────────────────────────────

export interface JourneySaga {
  id: string;
  title: string;
  subtitle: string;
  theme: string;
  accentColor: string;
  ages: JourneyAge[];
  unlockCondition: UnlockCondition | null;
  status: HierarchyStatus;
  imageKey?: string;
}

// ── Canonical hierarchy data ───────────────────────────────────────────────────

export const JOURNEY_SAGAS: JourneySaga[] = [
  {
    id: "saga-1",
    title: "Saga I — The Grand Ward",
    subtitle: "The foundational arc of every healer's calling",
    theme: "The Grand Ward",
    accentColor: "#4FD8C4",
    unlockCondition: null, // always unlocked
    status: "active",
    imageKey: "journey-chapters",
    ages: [
      {
        id: "age-1",
        title: "Age I — Awakening",
        subtitle: "The first steps inside the ward",
        theme: "Awakening",
        accentColor: "#D4AF37",
        unlockCondition: null,
        status: "active",
        imageKey: "journey-chapters",
        books: [
          {
            id: "book-1",
            title: "Book I — The Ward",
            subtitle: "Chapters 1–10 · Phase 1 complete arc",
            theme: "The Ward",
            accentColor: "#D4AF37",
            chapterRange: [1, 10],
            unlockCondition: null,
            status: "active",
            imageKey: "journey-chapters",
          },
        ],
      },
    ],
  },
];

// ── Query helpers ──────────────────────────────────────────────────────────────

/** Find a saga by id. Returns undefined if not found. */
export function getSaga(sagaId: string): JourneySaga | undefined {
  return JOURNEY_SAGAS.find((s) => s.id === sagaId);
}

/** Find an age by sagaId + ageId. */
export function getAge(sagaId: string, ageId: string): JourneyAge | undefined {
  return getSaga(sagaId)?.ages.find((a) => a.id === ageId);
}

/** Find a book by sagaId + ageId + bookId. */
export function getBook(
  sagaId: string,
  ageId: string,
  bookId: string,
): JourneyBook | undefined {
  return getAge(sagaId, ageId)?.books.find((b) => b.id === bookId);
}

/**
 * Return the CHAPTERS that belong to a Book, filtered by chapterRange.
 * Preserves the existing CHAPTERS array order.
 */
export function getBookChapters(book: JourneyBook) {
  const [min, max] = book.chapterRange;
  return CHAPTERS.filter((c) => c.number >= min && c.number <= max);
}

/**
 * Determine whether a hierarchy node is locked for the given player level.
 * Returns true when there is an unlock condition and the player hasn't met it.
 */
export function isNodeLocked(
  node: { unlockCondition: UnlockCondition | null; status: HierarchyStatus },
  playerLevel: number,
): boolean {
  if (node.status === "coming_soon") return true;
  if (!node.unlockCondition) return false;
  return playerLevel < node.unlockCondition.playerLevel;
}
