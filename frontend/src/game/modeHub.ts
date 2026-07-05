// ────────────────────────────────────────────────────────────
// MODE HUB — shared data for the Ward Operations (Shift) hub, University
// future-learning previews, and Faction future-systems previews.
// (Organization + placeholder push.) This module is intentionally data-only:
// it does NOT add any new gameplay, currencies, or routes beyond the
// existing active modes. "Coming Soon" / "Preview" entries have no route —
// they only carry copy + an art brief for a future illustrated banner.
//
// Illustrated banner style direction (Step 11/12): sharp anime/donghua/
// cartoon, same visual family as hero portraits — bright, polished,
// fantasy-medical RPG, clean linework, painterly shading, vivid colors,
// jade/gold/lotus accents. NOT generic dark gradients long-term. Each
// `artBrief` below is the commissioning brief for that future banner.
// ────────────────────────────────────────────────────────────

export type ModeStatus = "active" | "locked" | "coming_soon" | "preview";
export type ModeCardSize = "large" | "medium" | "small";

export interface ModeCardDef {
  id: string;
  title: string;
  subtitle: string;
  icon: string; // Ionicons glyph
  accentColor: string;
  status: ModeStatus;
  size: ModeCardSize;
  route?: string; // gameplay destination — where the intro's "Begin" button leads
  rewardPreview?: string;
  unlockRequirement?: string;
  artBrief: string;
  // ── Mode → Intro → Gameplay pattern (Step 13) ──
  // The hub routes every active mode to its intro at `/mode/<id>`. The intro
  // shows `lore` + `howItWorks` (deliberately NO in-depth units/enemies) then a
  // CTA that leads to `route`. `imageKey` selects the illustrated donghua banner
  // (see BANNER_IMAGES in components/ModeBanners). Coming-soon modes omit these
  // and are surfaced as alerts from the hub instead.
  imageKey?: string;
  lore?: string;
  howItWorks?: string[];
  entryLabel?: string;
}

// ---------- Continue ----------
export const WARD_SHIFT_MODE: ModeCardDef = {
  id: "ward-shift",
  title: "Ward Shift",
  subtitle: "Main clinical story battles. Scout, stabilize, treat, and reassess.",
  icon: "medkit",
  accentColor: "#D4AF37",
  status: "active",
  size: "large",
  route: "/shift-cases",
  rewardPreview: "Crowns, Hero EXP, Codex Shards",
  imageKey: "ward-shift",
  entryLabel: "Report for Shift",
  lore:
    "The wards of Clinica never sleep. Each shift, patients arrive carrying the shadows of disease, and only a healer who can read the body's clues can turn the tide. You lead the team — steady the failing, treat the cause, and reassess until the ward is calm again.",
  howItWorks: [
    "Pick a case from today's shift and step into a turn-based clinical battle.",
    "Scout for clues, stabilize the patient, treat the cause, then reassess.",
    "Each regular case costs 1 Shift Challenge; you earn Crowns, Hero EXP, and Codex Shards.",
  ],
  artBrief:
    "A determined healer leading a team through a glowing fantasy hospital ward, with clinical sigils and disease shadows ahead.",
};

// ---------- Clinical Challenges ----------
export const CLINICAL_CHALLENGE_MODES: ModeCardDef[] = [
  {
    id: "ward-defense",
    title: "Ward Defense: Code Rush",
    subtitle: "Protect the Vital Lantern through waves of disease pressure.",
    icon: "shield-half",
    accentColor: "#5B9BD5",
    status: "active",
    size: "medium",
    route: "/ward-defense",
    rewardPreview: "Ward Coins, Unit Shards",
    imageKey: "ward-defense",
    entryLabel: "Hold the Line",
    lore:
      "When disease surges faster than any single healer can answer, the ward raises the Vital Lantern — a beacon that must not go dark. Deploy your guardian units along the corridor and hold back wave after wave of disease spirits before they reach the light.",
    howItWorks: [
      "Place healer units along the ward path to intercept incoming disease spirits.",
      "Answer clinical prompts between waves to earn extra action power.",
      "Survive all waves to protect the Vital Lantern and claim Ward Coins.",
    ],
    artBrief:
      "Healer units defending a luminous Vital Lantern as disease spirits approach along a ward pathway.",
  },
  {
    id: "boss-ward",
    title: "Boss Ward",
    subtitle: "Face major pathology encounters with higher stakes.",
    icon: "flame",
    accentColor: "#EF4444",
    status: "active",
    size: "medium",
    route: "/boss",
    rewardPreview: "Rare materials, Codex lore",
    imageKey: "boss-ward",
    entryLabel: "Confront the Threat",
    unlockRequirement: "Complete at least one shift to unlock.",
    lore:
      "Some pathologies grow too vast for an ordinary case — a convergence of failing systems that threatens the whole kingdom. These are the Boss Wards: rare, dangerous, and unforgettable. Only a prepared team should answer the call.",
    howItWorks: [
      "A single high-stakes encounter against a powerful pathology boss.",
      "Costs 5 Shift Challenges to enter — come rested and ready.",
      "Victory yields rare materials and new Codex lore.",
    ],
    artBrief:
      "A hero healer facing a massive corrupted pathology spirit inside a dramatic clinical arena.",
  },
  {
    id: "grand-rounds",
    title: "Grand Rounds",
    subtitle: "Solve layered clinical cases through cues, decisions, and reassessment.",
    icon: "document-text",
    accentColor: "#F59E0B",
    status: "coming_soon",
    size: "small",
    artBrief:
      "A scholar-healer reviewing floating case scrolls beside a patient bed under soft jade-and-gold light.",
  },
  {
    id: "code-blue",
    title: "Code Blue / Crisis Drill",
    subtitle: "Practice fast emergency decisions under rising pressure.",
    icon: "alert-circle",
    accentColor: "#EF4444",
    status: "coming_soon",
    size: "small",
    artBrief:
      "A fast emergency scene with bright alert sigils, a healer rushing forward, and urgent clinical energy.",
  },
];

// ---------- Knowledge Challenges ----------
export const KNOWLEDGE_CHALLENGE_MODES: ModeCardDef[] = [
  {
    id: "scholars-arena",
    title: "Scholar's Arena",
    subtitle: "Compete in reasoning-based challenge duels and leaderboard trials.",
    icon: "school",
    accentColor: "#A78BFA",
    status: "coming_soon",
    size: "small",
    artBrief:
      "Two scholar-healers facing off across a glowing knowledge arena with answer glyphs and medical runes.",
  },
  {
    id: "knowledge-bowl",
    title: "Knowledge Bowl / HOSA Bowl",
    subtitle: "Test health science knowledge in quiz-bowl style rounds.",
    icon: "trophy",
    accentColor: "#F59E0B",
    status: "coming_soon",
    size: "small",
    artBrief:
      "An academy competition hall with podiums, category seals, and students in fantasy-medical uniforms.",
  },
];

// ---------- Wellness / Off-Shift ----------
export const WELLNESS_MODES: ModeCardDef[] = [
  {
    id: "lotus-journal",
    title: "Lotus Plate Journal",
    subtitle: "Reflect on meals, hydration, and wellness for safe rewards.",
    icon: "leaf",
    accentColor: "#34D399",
    status: "active",
    size: "medium",
    route: "/lotus-journal",
    rewardPreview: "Lotus Petals, Wellness Tokens",
    imageKey: "lotus-journal",
    entryLabel: "Open the Journal",
    lore:
      "Even healers must rest. Off the ward, the Lotus Plate Journal is your quiet garden — a place to log real meals, hydration, and small acts of self-care. Tend it gently and your Nutrition Garden blooms.",
    howItWorks: [
      "Log meals, hydration, and wellness reflections — no combat, no pressure.",
      "There is no Shift Challenge cost; this is a calm off-shift space.",
      "Earn cosmetic Lotus Petals and grow your personal Nutrition Garden.",
    ],
    artBrief:
      "A warm lotus kitchen garden with fresh food, hydration symbols, and a calm healer preparing a balanced plate.",
  },
];

// ---------- Future Events ----------
export const FUTURE_EVENT_MODES: ModeCardDef[] = [
  {
    id: "expedition",
    title: "Expedition / Field Clinic",
    subtitle: "Take your healer team into villages, outbreaks, and relief missions.",
    icon: "compass",
    accentColor: "#22D3EE",
    status: "coming_soon",
    size: "small",
    artBrief:
      "A traveling healer party approaching a village under mist with medical packs, lanterns, and relief banners.",
  },
  {
    id: "epidemic-response",
    title: "Epidemic Response",
    subtitle: "Join large-scale seasonal events against spreading disease threats.",
    icon: "pulse",
    accentColor: "#7C3AED",
    status: "coming_soon",
    size: "small",
    artBrief:
      "Faction healers rallying under banners as disease fog spreads across a distant city.",
  },
];

// ---------- University future learning placeholders (Step 7) ----------
export const UNIVERSITY_FUTURE_MODES: ModeCardDef[] = [
  {
    id: "knowledge-bowl-practice",
    title: "Knowledge Bowl Practice",
    subtitle: "Study health science categories before entering competitive rounds.",
    icon: "trophy-outline",
    accentColor: "#F59E0B",
    status: "coming_soon",
    size: "small",
    artBrief:
      "An academy study hall with category seals glowing softly above open textbooks.",
  },
  {
    id: "grand-rounds-library",
    title: "Grand Rounds Library",
    subtitle: "Review case-based lessons and clinical reasoning examples.",
    icon: "library-outline",
    accentColor: "#5B9BD5",
    status: "coming_soon",
    size: "small",
    artBrief:
      "A scholar-healer paging through a floating archive of case scrolls in a jade-lit library.",
  },
  {
    id: "case-study-archive",
    title: "Case Study Archive",
    subtitle: "Unlock stories, cues, and patient scenarios from completed content.",
    icon: "archive-outline",
    accentColor: "#A78BFA",
    status: "coming_soon",
    size: "small",
    artBrief:
      "Shelves of glowing patient-story scrolls, each sealed with a completed-chapter sigil.",
  },
  {
    id: "clinical-simulation-lab",
    title: "Clinical Simulation Lab",
    subtitle: "Practice decision chains without stamina pressure.",
    icon: "flask-outline",
    accentColor: "#34D399",
    status: "coming_soon",
    size: "small",
    artBrief:
      "A calm training bay with holographic patient models and a healer rehearsing a decision tree.",
  },
];

export const MODE_STATUS_LABEL: Record<ModeStatus, string> = {
  active: "Active",
  locked: "Locked",
  coming_soon: "Coming Soon",
  preview: "Preview",
};

// ---------- Hub ordering + lookup ----------
// The Ward Operations hub renders its clinical banners in this order. Ward Shift
// is the hero banner; Ward Defense and Boss Ward are the other active clinical
// challenges. Off-shift + coming-soon modes render in their own sections.
export const HUB_CLINICAL_MODES: ModeCardDef[] = [
  WARD_SHIFT_MODE,
  ...CLINICAL_CHALLENGE_MODES.filter((m) => m.status === "active"),
];

export const ALL_MODES: ModeCardDef[] = [
  WARD_SHIFT_MODE,
  ...CLINICAL_CHALLENGE_MODES,
  ...KNOWLEDGE_CHALLENGE_MODES,
  ...WELLNESS_MODES,
  ...FUTURE_EVENT_MODES,
  ...UNIVERSITY_FUTURE_MODES,
];

/** Resolve a mode definition by id (used by the shared intro page `/mode/[id]`). */
export function findMode(id: string | undefined | null): ModeCardDef | undefined {
  if (!id) return undefined;
  return ALL_MODES.find((m) => m.id === id);
}
