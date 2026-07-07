// ────────────────────────────────────────────────────────────
// FACTION EMBASSY FOUNDATION (Push 9)
// ────────────────────────────────────────────────────────────
// This module is DATA + DOCUMENTATION only. It introduces the Faction Embassy
// concept — a cooperative hub where healers band together to donate supplies,
// complete faction orders, contribute to research, earn Faction Marks, and
// build group progress toward future world events.
//
// Nothing here wires up live faction creation, live joining, guild chat,
// territory conquest, faction wars, live multiplayer, billing, trading,
// competitive leaderboards, or PvP of any kind.
//
// All sections below are informational / preview. Any UI built on this file
// must clearly mark inactive features as Preview, Planned, or Coming Soon —
// never as a working action flow.
// ────────────────────────────────────────────────────────────

export type EmbassyBadge = "Preview" | "Planned" | "Coming Soon";

export const EMBASSY_STATUS: EmbassyBadge = "Coming Soon";

// ── Welcome ──────────────────────────────────────────────────
export const EMBASSY_WELCOME = {
  title: "The Faction Embassy",
  kicker: "COOPERATIVE HUB · COMING SOON",
  body:
    "Healers are strongest when they stand together. The Faction Embassy is where allied " +
    "healer groups will coordinate, prepare for world events, pool their supplies, and grow " +
    "their collective power. Factions are purely cooperative — no raids, no territory wars, " +
    "no attacking other players. You and your allies prepare together; the world itself is " +
    "what challenges you.",
};

// ── Purpose ───────────────────────────────────────────────────
export const EMBASSY_PURPOSE = {
  title: "What Is a Faction?",
  body:
    "A Faction is a voluntary group of healers who want to tackle bigger challenges together. " +
    "Members contribute supplies, share research progress, complete group orders, and build " +
    "toward rare faction-exclusive rewards. There are no mandatory login windows, no " +
    "kick-or-be-kicked rush timers, and no competitive damage rankings between members. " +
    "Faction life is cooperative and at your own pace.",
  pillars: [
    { icon: "people-outline", label: "Cooperative group play" },
    { icon: "leaf-outline", label: "Contribute at your own pace" },
    { icon: "planet-outline", label: "Prepare for world events" },
    { icon: "ribbon-outline", label: "Earn faction-exclusive rewards" },
  ],
};

// ── Joining a Faction ─────────────────────────────────────────
export interface EmbassyRuleRow {
  icon: string;
  label: string;
  value: string;
}

export const FACTION_JOIN_REQUIREMENTS: EmbassyRuleRow[] = [
  { icon: "school-outline", label: "Player Level", value: "Minimum Player Level 5 to join a faction" },
  { icon: "flag-outline", label: "Invitation or Open Search", value: "Join via faction invite code or browse the open faction directory" },
  { icon: "shield-outline", label: "Faction cap", value: "Each faction supports up to 30 healers in its first tier" },
  { icon: "hourglass-outline", label: "Cooldown", value: "Leaving a faction triggers a 48-hour cooldown before joining another" },
];

export const FACTION_JOIN_INFO = {
  title: "Joining a Faction",
  icon: "person-add-outline",
  accentColor: "#34D399",
  intro:
    "When factions go live, you'll be able to search for open factions that match your " +
    "playstyle, or join a specific one if a friend shares their invite code. Faction membership " +
    "is always voluntary — you can leave at any time, with no penalty to your personal progress " +
    "or item collection.",
};

// ── Creating a Faction ────────────────────────────────────────
export const FACTION_CREATE_INFO = {
  title: "Creating a Faction",
  icon: "add-circle-outline",
  accentColor: "#A78BFA",
  intro:
    "Founding a faction gives you control over its name, crest, motto, and open/invite-only " +
    "status. Founders and Officers can invite healers, shape the group's focus, and launch " +
    "faction-wide missions. Creating a faction will require reaching Healer Rank 3 and " +
    "contributing a small amount of Ward Coins as the founding charter fee (exact values TBD).",
  requirements: [
    { icon: "person-outline", label: "Founder rank", value: "Healer Rank 3 or above" },
    { icon: "diamond-outline", label: "Charter fee", value: "A small Ward Coin fee (amount TBD) — cosmetic and non-recurring" },
    { icon: "people-outline", label: "Starter roster", value: "A new faction starts with just the Founder; grow by inviting others" },
  ],
};

// ── Faction Identity Overview ─────────────────────────────────
export const FACTION_IDENTITY = {
  title: "Faction Identity",
  icon: "color-palette-outline",
  accentColor: "#F59E0B",
  intro:
    "Every faction will have its own visual identity displayed across the game. Founders can " +
    "choose a faction name, pick a crest icon from the Clinica symbol library, set a color " +
    "accent, and write a short group motto. Identity options are cosmetic and changeable by " +
    "Officers — they never affect gameplay, stats, or rewards.",
  elements: [
    { icon: "text-outline", label: "Faction Name", desc: "Up to 24 characters — profanity-filtered, unique across all factions." },
    { icon: "shield-half-outline", label: "Faction Crest", desc: "A crest icon chosen from the Clinica symbol library." },
    { icon: "color-filter-outline", label: "Color Accent", desc: "A themed color that tints the faction banner in the hub." },
    { icon: "chatbubble-ellipses-outline", label: "Motto", desc: "A short phrase (up to 60 chars) displayed on your public faction profile." },
    { icon: "eye-outline", label: "Visibility", desc: "Open (searchable directory) or Invite-Only (invite code required)." },
  ],
};

// ── Faction Roles ─────────────────────────────────────────────
export interface FactionRole {
  id: string;
  title: string;
  icon: string;
  accentColor: string;
  badge: "Unique" | "Up to 5" | "Unlimited";
  description: string;
  responsibilities: string[];
}

export const FACTION_ROLES: FactionRole[] = [
  {
    id: "founder",
    title: "Founder",
    icon: "crown-outline",
    accentColor: "#F59E0B",
    badge: "Unique",
    description:
      "The healer who established the faction. Holds full authority over membership, settings, and Officer appointments. There is exactly one Founder per faction.",
    responsibilities: [
      "Appoint and remove Officers",
      "Change faction name, crest, and motto",
      "Set open / invite-only visibility",
      "Disband the faction (requires all members to vacate first)",
    ],
  },
  {
    id: "officer",
    title: "Officer",
    icon: "star-outline",
    accentColor: "#A78BFA",
    badge: "Up to 5",
    description:
      "Trusted veterans appointed by the Founder to help manage the faction's day-to-day activity. Officers keep things running when the Founder is offline.",
    responsibilities: [
      "Invite new members via invite code",
      "Kick inactive members (with Founder approval)",
      "Launch faction orders and group missions",
      "Post faction notices in the bulletin board",
    ],
  },
  {
    id: "healer",
    title: "Healer",
    icon: "heart-outline",
    accentColor: "#F472B6",
    badge: "Unlimited",
    description:
      "The backbone of every faction — regular members who contribute to missions, donate supplies, and earn Faction Marks through daily play.",
    responsibilities: [
      "Participate in faction orders and missions",
      "Donate supplies to the faction stockpile",
      "Earn personal Faction Marks",
      "Vote on faction research priorities (future feature)",
    ],
  },
  {
    id: "researcher",
    title: "Researcher",
    icon: "flask-outline",
    accentColor: "#22D3EE",
    badge: "Unlimited",
    description:
      "Healers who focus their contribution on research queues. Researchers accelerate faction-wide research unlocks by channeling Insight Crystals and Codex Shards into the research pool.",
    responsibilities: [
      "Donate Insight Crystals to active research projects",
      "Track research queue progress in the Embassy panel",
      "Unlock research bonuses that benefit all faction members",
      "Earn bonus Faction Marks for research milestones",
    ],
  },
  {
    id: "quartermaster",
    title: "Quartermaster",
    icon: "cube-outline",
    accentColor: "#34D399",
    badge: "Unlimited",
    description:
      "Supply-focused healers who keep the faction stockpile stocked and prioritize donation activities. Quartermasters earn bonus Faction Marks for hitting supply thresholds.",
    responsibilities: [
      "Donate materials and Ward Coins to the faction stockpile",
      "Track low-supply alerts in the Embassy panel",
      "Earn bonus Faction Marks for supply milestones",
      "Coordinate supply drives with Officers",
    ],
  },
  {
    id: "scout",
    title: "Scout",
    icon: "compass-outline",
    accentColor: "#F97316",
    badge: "Unlimited",
    description:
      "Healers who specialize in scouting and reporting world events to the faction. Scouts earn bonus Faction Marks for early world-event participation and anomaly reports.",
    responsibilities: [
      "Identify upcoming world events and report them to Officers",
      "Participate in time-limited outbreak responses",
      "Earn bonus Faction Marks for world-event contributions",
      "Track event countdowns in the Embassy bulletin board",
    ],
  },
];

// ── Faction Contribution ──────────────────────────────────────
export interface ContributionActivity {
  icon: string;
  title: string;
  desc: string;
  earns: string;
  status: EmbassyBadge;
}

export const FACTION_CONTRIBUTION_ACTIVITIES: ContributionActivity[] = [
  {
    icon: "cube-outline",
    title: "Donate Supplies",
    desc: "Send Ward Coins, crafting materials, and specialty resources from your personal stockpile to the shared faction supply vault.",
    earns: "Faction Marks + Quartermaster bonus marks",
    status: "Planned",
  },
  {
    icon: "list-outline",
    title: "Faction Orders",
    desc: "Time-limited group objectives that ask members to complete specific battles, treat specific patient types, or collect certain materials together.",
    earns: "Faction Marks + supply crate rewards",
    status: "Planned",
  },
  {
    icon: "flask-outline",
    title: "Research Contribution",
    desc: "Pool Insight Crystals into the faction research queue to unlock passive bonuses that benefit every member simultaneously.",
    earns: "Faction Marks + research milestone rewards",
    status: "Planned",
  },
  {
    icon: "planet-outline",
    title: "World Event Response",
    desc: "When a global outbreak or world boss is active, faction members can coordinate their contributions for amplified group rewards.",
    earns: "Bonus Faction Marks + exclusive event cosmetics",
    status: "Coming Soon",
  },
];

// ── Faction Shop ──────────────────────────────────────────────
export const FACTION_SHOP_PREVIEW = {
  title: "Faction Supply Exchange",
  icon: "storefront-outline",
  accentColor: "#5B9BD5",
  intro:
    "Faction Marks will be spent at the Supply Exchange — a faction-exclusive vendor stocked " +
    "with items unavailable anywhere else in Clinica. The Exchange rotates monthly and never " +
    "sells power items, hero stats, or competitive advantages.",
  previewCategories: [
    { icon: "ribbon-outline", label: "Faction Banners", desc: "Decorative banners for your Realm featuring your faction's crest and colors." },
    { icon: "home-outline", label: "Realm Decorations", desc: "Unique Sanctuary ornaments and structures exclusive to faction members." },
    { icon: "text-outline", label: "Profile Titles", desc: "Special faction-rank titles displayed on your healer profile." },
    { icon: "gift-outline", label: "Supply Crates", desc: "Consumable crates containing materials, Ward Coins, and crafting resources." },
    { icon: "flask-outline", label: "Research Boosters", desc: "Items that accelerate faction research queues for 24–72 hours." },
  ],
  status: "Coming Soon" as EmbassyBadge,
};

// ── Faction Missions ──────────────────────────────────────────
export interface FactionMission {
  icon: string;
  title: string;
  type: string;
  desc: string;
  reward: string;
  status: EmbassyBadge;
}

export const FACTION_MISSIONS_PREVIEW: FactionMission[] = [
  {
    icon: "list-outline",
    title: "Daily Group Orders",
    type: "Daily",
    desc: "Small daily tasks any member can complete that contribute to the faction's weekly progress bar.",
    reward: "5–15 Faction Marks per member, per day",
    status: "Planned",
  },
  {
    icon: "pulse-outline",
    title: "Epidemic Response",
    type: "Weekly",
    desc: "A faction-wide challenge to treat a certain volume of patients with specific condition types across all members' Ward Shifts.",
    reward: "50–200 Faction Marks + supply crate",
    status: "Planned",
  },
  {
    icon: "flask-outline",
    title: "Research Sprint",
    type: "Weekly",
    desc: "An accelerated research window where pooling Insight Crystals earns double progress for 48 hours.",
    reward: "Research progress + Researcher role bonus marks",
    status: "Coming Soon",
  },
  {
    icon: "planet-outline",
    title: "World Boss Response",
    type: "Event",
    desc: "When a colossal corruption event appears, factions rally to coordinate their battle contributions for shared global rewards.",
    reward: "Exclusive event cosmetics + large Faction Mark payout",
    status: "Coming Soon",
  },
  {
    icon: "medkit-outline",
    title: "Relief Campaign",
    type: "Event",
    desc: "Kingdom-wide supply drives where factions compete with themselves — not each other — to hit collective donation milestones.",
    reward: "Realm decorations + faction banner variants",
    status: "Coming Soon",
  },
];

// ── Reward Preview ────────────────────────────────────────────
export interface FactionRewardCategory {
  icon: string;
  title: string;
  desc: string;
  earnedVia: string;
  accentColor: string;
}

export const FACTION_REWARD_CATEGORIES: FactionRewardCategory[] = [
  {
    icon: "medal-outline",
    title: "Faction Marks",
    desc: "The primary faction currency earned by every contribution activity. Spent at the Faction Supply Exchange.",
    earnedVia: "All contribution activities — donating, orders, research, world events.",
    accentColor: "#F59E0B",
  },
  {
    icon: "ribbon-outline",
    title: "Faction Banners",
    desc: "Decorative banners featuring your faction's crest and accent color — displayed in your Realm's Diplomacy District.",
    earnedVia: "Faction Supply Exchange (Faction Marks) + faction milestone rewards.",
    accentColor: "#A78BFA",
  },
  {
    icon: "home-outline",
    title: "Realm Decorations",
    desc: "Exclusive Sanctuary ornaments and diplomatic display pieces unavailable in any other shop.",
    earnedVia: "Faction Supply Exchange + collective milestone crates.",
    accentColor: "#34D399",
  },
  {
    icon: "text-outline",
    title: "Profile Titles",
    desc: "Rare faction role titles (e.g. \"[Faction Name] Quartermaster\") displayed on your public healer profile.",
    earnedVia: "Role-specific contribution milestones.",
    accentColor: "#22D3EE",
  },
  {
    icon: "gift-outline",
    title: "Supply Crates",
    desc: "Consumable crates containing Ward Coins, crafting materials, and specialty resources for personal use.",
    earnedVia: "Faction orders, relief campaigns, and Supply Exchange purchases.",
    accentColor: "#F97316",
  },
  {
    icon: "flask-outline",
    title: "Research Progress",
    desc: "Shared faction research unlocks passive bonuses for every member simultaneously — not exclusive to any one player.",
    earnedVia: "Collective Insight Crystal donations into the faction research queue.",
    accentColor: "#5B9BD5",
  },
];

// ── Safety & Scope Rules ──────────────────────────────────────
export const EMBASSY_SCOPE_RULES: EmbassyRuleRow[] = [
  { icon: "shield-checkmark-outline", label: "No territory conquest", value: "Factions never attack, raid, or seize territory from other factions or players" },
  { icon: "people-circle-outline", label: "No competitive PvP", value: "All faction activities are cooperative — no head-to-head faction vs. faction combat" },
  { icon: "chatbubbles-outline", label: "No guild chat (this push)", value: "In-app faction chat is a future feature, not included in this preview" },
  { icon: "diamond-outline", label: "No pay-to-win", value: "Faction rewards are cosmetic and progression-paced — never exclusive power" },
  { icon: "person-outline", label: "Solo-friendly", value: "All content is completable without a faction — joining is always optional" },
];
