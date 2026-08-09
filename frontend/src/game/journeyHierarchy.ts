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
    title: "The Grand Ward",
    subtitle: "The foundational arc of every healer's calling",
    theme: "The Grand Ward",
    accentColor: "#4FD8C4",
    unlockCondition: null, // always unlocked
    status: "active",
    imageKey: "banner-saga-1",
    ages: [
      {
        id: "age-1",
        // ── Age of Foundation ─────────────────────────────────────────────
        // Covers the player's university years and pre-real-world clinical
        // training: four Books of ~10 chapters each, one academic year per Book.
        title: "Age of Foundation",
        subtitle: "University and pre-clinical training · The formative years",
        theme: "Foundation",
        accentColor: "#D4AF37",
        unlockCondition: null,
        status: "active",
        imageKey: "banner-age-1",
        books: [
          {
            id: "book-1",
            title: "Book I: Kingdom of Healing",
            subtitle: "Chapters 1–10 · First-year foundations and simulated patient care",
            theme: "Kingdom of Healing",
            accentColor: "#D4AF37",
            chapterRange: [1, 10],
            unlockCondition: null,
            status: "active",
            imageKey: "banner-book-1",
          },
          {
            id: "book-2",
            title: "Book II: Anatomy of Duty",
            subtitle: "Chapters 11–20 · Advanced sciences, disease mechanisms, and team roles",
            theme: "Anatomy of Duty",
            accentColor: "#56CFE1",
            chapterRange: [11, 20],
            unlockCondition: null,
            status: "coming_soon",
            imageKey: "banner-book-2",
          },
          {
            id: "book-3",
            title: "Book III: The Living Ward",
            subtitle: "Chapters 21–30 · Clinical immersion and complex simulations",
            theme: "The Living Ward",
            accentColor: "#7EB8A0",
            chapterRange: [21, 30],
            unlockCondition: null,
            status: "coming_soon",
            imageKey: "banner-book-2", // placeholder art until Book III art is generated
          },
          {
            id: "book-4",
            title: "Book IV: Before the Oath",
            subtitle: "Chapters 31–40 · Final rotations, capstone exams, and the transition into real practice",
            theme: "Before the Oath",
            accentColor: "#C4956A",
            chapterRange: [31, 40],
            unlockCondition: null,
            status: "coming_soon",
            imageKey: "banner-book-1", // placeholder art until Book IV art is generated
          },
        ],
      },
      {
        id: "age-2",
        title: "Age II — The Outer Wards",
        subtitle: "Coming soon · The stakes grow higher beyond the training grounds",
        theme: "The Outer Wards",
        accentColor: "#E07B54",
        unlockCondition: null,
        status: "coming_soon",
        imageKey: "banner-age-2",
        books: [],
      },
    ],
  },
  {
    id: "saga-2",
    title: "Saga II — The Outer Reaches",
    subtitle: "Coming soon · A new arc begins beyond the ward",
    theme: "The Outer Reaches",
    accentColor: "#9B72CF",
    unlockCondition: null,
    status: "coming_soon",
    imageKey: "banner-saga-2",
    ages: [],
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
 * Return all Books across every Age in a Saga, flattened.
 * This is the canonical list for the Saga → Books navigation layer
 * (the Age layer is a data grouping only, not a navigation hop).
 */
export function getSagaBooks(sagaId: string): JourneyBook[] {
  const saga = getSaga(sagaId);
  if (!saga) return [];
  return saga.ages.flatMap((a) => a.books);
}

/**
 * Find a Book by sagaId + bookId, searching across all Ages in the Saga.
 * Used by screens that navigate without an ageId in the URL.
 */
export function getBookFromSaga(
  sagaId: string,
  bookId: string,
): JourneyBook | undefined {
  return getSagaBooks(sagaId).find((b) => b.id === bookId);
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
