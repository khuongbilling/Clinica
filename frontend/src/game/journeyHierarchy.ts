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
        // ── Age of The Outer Wards ─────────────────────────────────────────
        // Four Books covering the Emergency Floor, Critical Care, Specialist
        // Rotations, and the Ward That Never Sleeps (Chapters 41–80).
        // Book V is active (skeleton chapters 41–43 defined in chapterJourney.ts).
        // Books VI–VIII are coming_soon until narrative content is written.
        title: "Age II — The Outer Wards",
        subtitle: "The stakes grow higher beyond the training grounds",
        theme: "The Outer Wards",
        accentColor: "#E07B54",
        unlockCondition: {
          playerLevel: 30,
          label: "Reach Level 30 to enter the Outer Wards",
        },
        status: "active",
        imageKey: "banner-age-2",
        books: [
          {
            id: "book-5",
            title: "Book V: The Emergency Floor",
            subtitle: "Chapters 41–50 · Unfiltered urgency, mass casualty, and the night team",
            theme: "The Emergency Floor",
            accentColor: "#FF6B6B",
            chapterRange: [41, 50],
            unlockCondition: {
              playerLevel: 30,
              label: "Reach Level 30 to enter the Emergency Floor",
            },
            status: "active",
            imageKey: "banner-book-2", // placeholder art until Book V art is generated
          },
          {
            id: "book-6",
            title: "Book VI: Critical Care",
            subtitle: "Chapters 51–60 · ICU rotations, ventilator management, and organ support",
            theme: "Critical Care",
            accentColor: "#4CC9F0",
            chapterRange: [51, 60],
            unlockCondition: {
              playerLevel: 40,
              label: "Reach Level 40 to enter Critical Care",
            },
            status: "coming_soon",
            imageKey: "banner-book-2", // placeholder art until Book VI art is generated
          },
          {
            id: "book-7",
            title: "Book VII: Specialist Rotations",
            subtitle: "Chapters 61–70 · Cardiology, oncology, paediatrics, and specialist interdisciplinary care",
            theme: "Specialist Rotations",
            accentColor: "#CDB4DB",
            chapterRange: [61, 70],
            unlockCondition: {
              playerLevel: 50,
              label: "Reach Level 50 to begin Specialist Rotations",
            },
            status: "coming_soon",
            imageKey: "banner-book-1", // placeholder art until Book VII art is generated
          },
          {
            id: "book-8",
            title: "Book VIII: The Ward That Never Sleeps",
            subtitle: "Chapters 71–80 · Night shifts, lone practitioner decisions, and the Age II finale",
            theme: "The Ward That Never Sleeps",
            accentColor: "#2B2D42",
            chapterRange: [71, 80],
            unlockCondition: {
              playerLevel: 60,
              label: "Reach Level 60 to face the Ward That Never Sleeps",
            },
            status: "coming_soon",
            imageKey: "banner-book-1", // placeholder art until Book VIII art is generated
          },
        ],
      },
    ],
  },
  {
    id: "saga-2",
    // ── Saga II — The Outer Reaches ────────────────────────────────────────────
    // A new narrative arc beginning at Chapter 81 — two Ages of four Books each,
    // covering global health emergencies, leadership, and research frontiers.
    // All Ages and Books are coming_soon until narrative content is written;
    // the structural scaffold is here so UI layers have a home for new chapters.
    title: "Saga II — The Outer Reaches",
    subtitle: "Coming soon · A new arc begins beyond the ward",
    theme: "The Outer Reaches",
    accentColor: "#9B72CF",
    unlockCondition: {
      playerLevel: 70,
      label: "Reach Level 70 to unlock The Outer Reaches",
    },
    status: "coming_soon",
    imageKey: "banner-saga-2",
    ages: [
      {
        id: "saga2-age-1",
        // ── Age of Reckoning ───────────────────────────────────────────────
        // Chapters 81–120 · The Outer Reaches begin here — global health crises,
        // inter-system leadership, and encounters that span wards and nations.
        title: "Age I — The Reckoning",
        subtitle: "Coming soon · Global emergencies and the limits of the ward",
        theme: "The Reckoning",
        accentColor: "#6A0572",
        unlockCondition: {
          playerLevel: 70,
          label: "Reach Level 70 to enter The Reckoning",
        },
        status: "coming_soon",
        imageKey: "banner-age-2", // placeholder until Saga II art is generated
        books: [
          {
            id: "saga2-book-1",
            title: "Book I: Into the Dark",
            subtitle: "Chapters 81–90 · The first encounters beyond the known ward",
            theme: "Into the Dark",
            accentColor: "#6A0572",
            chapterRange: [81, 90],
            unlockCondition: {
              playerLevel: 70,
              label: "Reach Level 70 to open Into the Dark",
            },
            status: "coming_soon",
            imageKey: "banner-book-2", // placeholder art
          },
          {
            id: "saga2-book-2",
            title: "Book II: The Outbreak Arc",
            subtitle: "Chapters 91–100 · Epidemic response, containment, and global coordination",
            theme: "The Outbreak Arc",
            accentColor: "#9B72CF",
            chapterRange: [91, 100],
            unlockCondition: {
              playerLevel: 80,
              label: "Reach Level 80 to enter The Outbreak Arc",
            },
            status: "coming_soon",
            imageKey: "banner-book-2", // placeholder art
          },
          {
            id: "saga2-book-3",
            title: "Book III: The Research Frontier",
            subtitle: "Chapters 101–110 · Clinical trials, evidence hierarchies, and contested knowledge",
            theme: "The Research Frontier",
            accentColor: "#7209B7",
            chapterRange: [101, 110],
            unlockCondition: {
              playerLevel: 90,
              label: "Reach Level 90 to reach The Research Frontier",
            },
            status: "coming_soon",
            imageKey: "banner-book-1", // placeholder art
          },
          {
            id: "saga2-book-4",
            title: "Book IV: Reckoning's End",
            subtitle: "Chapters 111–120 · The Age of Reckoning concludes — a convergence of every arc",
            theme: "Reckoning's End",
            accentColor: "#5C2A9D",
            chapterRange: [111, 120],
            unlockCondition: {
              playerLevel: 100,
              label: "Reach Level 100 to face Reckoning's End",
            },
            status: "coming_soon",
            imageKey: "banner-book-1", // placeholder art
          },
        ],
      },
      {
        id: "saga2-age-2",
        // ── Age of Ascension ───────────────────────────────────────────────
        // Chapters 121–160 · The endgame era — leadership, legacy, and the
        // highest-acuity challenges the Outer Reaches can present.
        title: "Age II — The Ascension",
        subtitle: "Coming soon · Leadership, legacy, and the highest calling",
        theme: "The Ascension",
        accentColor: "#3730A3",
        unlockCondition: {
          playerLevel: 110,
          label: "Reach Level 110 to begin The Ascension",
        },
        status: "coming_soon",
        imageKey: "banner-age-2", // placeholder until Age of Ascension art is generated
        books: [
          {
            id: "saga2-age2-book-1",
            title: "Book V: The Leadership Ward",
            subtitle: "Chapters 121–130 · Charge nurse authority, systemic advocacy, and team formation",
            theme: "The Leadership Ward",
            accentColor: "#4338CA",
            chapterRange: [121, 130],
            unlockCondition: {
              playerLevel: 110,
              label: "Reach Level 110 to open The Leadership Ward",
            },
            status: "coming_soon",
            imageKey: "banner-book-2", // placeholder art
          },
          {
            id: "saga2-age2-book-2",
            title: "Book VI: The Legacy Chapters",
            subtitle: "Chapters 131–140 · Mentorship, knowledge transfer, and the shape of the next generation",
            theme: "The Legacy Chapters",
            accentColor: "#6D28D9",
            chapterRange: [131, 140],
            unlockCondition: {
              playerLevel: 120,
              label: "Reach Level 120 to write The Legacy Chapters",
            },
            status: "coming_soon",
            imageKey: "banner-book-1", // placeholder art
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
