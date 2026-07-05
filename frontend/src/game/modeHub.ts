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
  route?: string; // present only for active/locked modes with a real screen
  rewardPreview?: string;
  unlockRequirement?: string;
  artBrief: string;
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
  route: "/battle",
  rewardPreview: "Crowns, Hero EXP, Codex Shards",
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
