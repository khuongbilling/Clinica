import type { LearningProfile } from './clinical';

// =====================================================================
// TUTORIAL CONTENT
// Three difficulty tiers — each section explains a core mechanic at the
// player's chosen level of depth.
// =====================================================================

export type TutorialTier = 'novice' | 'practiced' | 'expert';

export const TUTORIAL_TIERS: { id: TutorialTier; label: string; sub: string }[] = [
  { id: 'novice', label: 'Novice', sub: 'Plain & friendly' },
  { id: 'practiced', label: 'Practiced', sub: 'Strategy & cues' },
  { id: 'expert', label: 'Expert', sub: 'NCLEX-level depth' },
];

export function getTutorialTier(profile: LearningProfile | undefined): TutorialTier {
  switch (profile) {
    case 'nonmedical':
    case 'preNursing':
      return 'novice';
    case 'nursingStudent':
    case 'nclexPrep':
      return 'practiced';
    case 'healthcareProfessional':
      return 'expert';
    default:
      return 'practiced';
  }
}

export interface TutorialSection {
  id: string;
  title: string;
  /** Ionicon name */
  icon: string;
  /** Short one-liner shown on the section header card */
  kicker: string;
  /** Content per difficulty tier */
  content: Record<TutorialTier, string>;
  /** Optional bullet take-aways (always shown, language-neutral) */
  takeaways?: string[];
}

const w = (s: string) => s.trim();

export const TUTORIAL_SECTIONS: TutorialSection[] = [
  {
    id: 'welcome',
    title: 'Welcome to Clinica',
    icon: 'sparkles',
    kicker: 'A clinical RPG where disease is the enemy.',
    content: {
      novice: w(`
You play a healer in the Kingdom of Clinica. The Great Codex shattered, and Disease Corruptions are spreading through patients.
Each battle is one patient. You bring up to three heroes, study the clues, and pick safe, helpful actions.
There is no wrong way to learn — the game is designed to teach you, not punish you.`),
      practiced: w(`
Every encounter is a clinical scenario disguised as a battle. Disease Corruption = severity. Patient Stability = how the patient is holding up.
Your job: lower corruption to zero before stability runs out, using actions that match the clues.`),
      expert: w(`
Encounters mirror Next-Gen NCLEX item layers: recognize cues → analyze cues → prioritize hypotheses → generate solutions → take action → evaluate outcomes.
Each turn is a chance to apply the clinical judgment model under time and resource pressure.`),
    },
  },
  {
    id: 'win-lose',
    title: 'How to Win — and How to Lose',
    icon: 'trophy',
    kicker: 'Corruption to 0 = win. Stability to 0 = patient lost.',
    content: {
      novice: w(`
Two bars matter most:
• Disease Corruption (red): how bad the illness is.
• Patient Stability (green): how the patient is doing.
You WIN when Corruption hits 0. You LOSE if Stability hits 0 at the end of any turn.`),
      practiced: w(`
Corruption is the disease severity meter. Reduce it via correctly-targeted strikes, system actions, and care chains.
Stability is the patient compensation reserve. It drops each turn based on instability and rises when you stabilize (oxygenation, perfusion, glucose, calm, etc.).
A care chain (Assess → Stabilize → Treat → Coordinate) does not auto-win, but it multiplies your output and unlocks the third star.`),
      expert: w(`
Disease Corruption: treat as cumulative pathophysiologic burden. It falls only with correctly-matched system interventions.
Stability: composite of ABCs, perfusion, and homeostasis. Net change/turn = (stabilize effects) − (instability tick) ± risks.
End-of-turn check: if Stability ≤ 0 → patient lost (clinical death equivalent). If Corruption ≤ 0 at any time → encounter purified.
Stars are independent of the win itself: you can win sloppy and still earn one star.`),
    },
    takeaways: [
      'Win: Disease Corruption → 0',
      'Lose: Stability → 0 at turn end',
      'Care chain is a multiplier, not a win condition',
    ],
  },
  {
    id: 'ap',
    title: 'Action Points (AP)',
    icon: 'flash',
    kicker: 'Your budget each turn — scales with patient condition.',
    content: {
      novice: w(`
Every turn you have a small number of Action Points. Each skill costs AP.
When the patient is in worse shape, you sometimes get an extra AP — the game knows you have more to do.
When you run out of AP, end the turn.`),
      practiced: w(`
Base AP is 3. The system grants bonus AP when stability is low or corruption is critically high — modeling extra hands during deterioration.
Spend AP on the highest-yield action first. Cheaper scout/assess actions are often a better opener than burning 2 AP on a generic stabilize.`),
      expert: w(`
Dynamic AP is the resource layer that forces prioritization under deterioration. It rewards correct triage: more AP only matters if it is spent on the right system.
Watch for hidden "shadow costs": calling consults bypasses hero actions but pulls your efficiency star if overused.`),
    },
  },
  {
    id: 'heroes',
    title: 'Heroes & Hero Actions',
    icon: 'people',
    kicker: 'One action per hero per turn. Choose who, then what.',
    content: {
      novice: w(`
You bring 3 heroes into battle. Tap a hero's portrait to select them, then tap a skill.
Each hero can only act once per turn — so think about who fits the situation best, then end the turn together.`),
      practiced: w(`
Heroes are role-typed (Stabilizer, Assessor, Coordinator, Analyst, Warden, Sage, Weaver, Educator). Each has 2–3 skills mapped to specific systems.
Match the hero's role to the enemy's primary system. A Stabilizer on an Air enemy outperforms a generic strike.`),
      expert: w(`
Hero turns enforce role specialization. Misuse (using a Stabilizer to "strike" with a generic action) yields "weak" status and underperforms.
At higher chapters, dual-system enemies require role rotation across the team — Coordinator first to reveal, then Stabilizer, then strike.`),
    },
  },
  {
    id: 'clues',
    title: 'The Clue Board (3 + 1)',
    icon: 'eye',
    kicker: 'Three visible clues, one hidden. Scout to reveal.',
    content: {
      novice: w(`
At the start of every battle you'll see three obvious things about the patient — like "breathing fast" or "pale skin".
There's always one more clue hidden. Use a Scout or Assess skill to reveal it. The hidden clue often unlocks the safest move.`),
      practiced: w(`
Visible clues are surface assessment data (vitals, posture, mental status). The hidden clue is usually the diagnostic anchor (lab value, EKG finding, BP measurement).
Reveal it before committing AP to high-cost interventions — you'll match interventions to the actual pathology, not the surface picture.`),
      expert: w(`
The 3+1 structure mirrors recognize-cues → analyze-cues. Visible clues are pattern fragments; the hidden clue is the disambiguator.
Acting before disambiguating is the most common cause of poor-fit penalties at intermediate difficulty.`),
    },
    takeaways: [
      'Reveal hidden clues before high-cost moves',
      'Hidden clues usually contain the lab/diagnostic anchor',
    ],
  },
  {
    id: 'systems',
    title: 'Body Systems',
    icon: 'pulse',
    kicker: 'Air, River, Energy, Fire, Storm, Mind, Protection.',
    content: {
      novice: w(`
Diseases attack different "systems" — think of them as parts of the body:
• Air = breathing  • River = circulation  • Energy = glucose/insulin
• Fire = infection  • Storm = electrolytes/rhythm  • Mind = mental status
• Protection = safety & skin
Use a skill that matches the disease's system for the best effect.`),
      practiced: w(`
System matching is a hard multiplier on damage and stabilize. An "Air" skill on an Air enemy doubles its effect.
Some enemies have a secondary system — the second clue layer hints at which support actions matter (e.g., heart failure: River primary, Air secondary).`),
      expert: w(`
System tagging is a proxy for physiologic specificity. System mismatch fires the "poor fit" pathway and yields a ¼ effect with a star penalty.
Multisystem enemies require correctly-sequenced multisystem actions — single-system spam will lose at higher difficulties.`),
    },
  },
  {
    id: 'care-chain',
    title: 'The Clinical Care Chain',
    icon: 'git-network',
    kicker: 'Assess → Stabilize → Treat → Coordinate.',
    content: {
      novice: w(`
The game rewards a real-life nursing order:
1) Assess (look first), 2) Stabilize (support breathing/circulation), 3) Treat (target the cause), 4) Coordinate (escalate / call).
Following this order unlocks the third star and gives bonus shards.`),
      practiced: w(`
Each clinical skill has a chainRole tag. When you complete the chain (any 4 chain-role roles in order without breaking it), your Treat phase deals a Care Chain Bonus.
Care Attempt and items don't count toward the chain; consults can substitute Coordinate when used appropriately.`),
      expert: w(`
The chain is a directed sequence: A→S→T→C with a tolerance window for swaps. Breaking order (e.g., Treat before Assess) does not penalize directly but forfeits the chain bonus, which scales with chapter (×1.0 → ×1.5).
For bosses, the chain may need to be re-completed across phases.`),
    },
    takeaways: [
      'Order matters: Assess → Stabilize → Treat → Coordinate',
      'Care chain = damage multiplier + Codex Shard bonus + 3rd star',
    ],
  },
  {
    id: 'stars',
    title: 'Star Rating (1–3 stars)',
    icon: 'star',
    kicker: 'Win, chain, and efficiency — earn all three.',
    content: {
      novice: w(`
After a battle you earn up to 3 stars:
⭐ 1: You stabilized the patient (you won).
⭐ 2: You completed the care chain.
⭐ 3: You were safe and efficient — few unsafe moves, few consults, low Care Attempt use.`),
      practiced: w(`
Stars gate Codex Shard bonuses (★+5 each) and your rank progression speed.
The 3rd star is the strict one: 0 unsafe actions, ≤1 poor-fit, ≤1 consult, no rapid response, no inappropriate consults, ≤2 Care Attempts, within the turn limit.`),
      expert: w(`
Star 3 is the optimization layer. It tracks safety (unsafe acts), fit (poor-fit acts), efficiency (turns, consults), and graceful escalation (no emergency calls).
Use this as a self-grading rubric — every star withheld points to a specific judgment gap.`),
    },
  },
  {
    id: 'consults',
    title: 'Consults & Rapid Response',
    icon: 'call',
    kicker: 'Team support — powerful, but not free.',
    content: {
      novice: w(`
Consults are like asking a teammate for help. They don't use a hero's turn, but each one slightly affects your efficiency star.
Save Rapid Response for true emergencies — using it when the patient is okay is penalized.`),
      practiced: w(`
Consults are tagged by specialty (Pharmacy, Respiratory, Infection, Rapid Response). Each has a clinicalCondition that determines whether it's appropriate.
1 appropriate consult = no penalty. 2+ consults or any inappropriate use = star reduction.`),
      expert: w(`
Consults model team-based escalation. They bypass hero AP but consume the efficiency budget.
The Rapid Response trigger encodes deteriorating-patient criteria — using it on a stable patient simulates a false rapid call, hence the strong penalty.`),
    },
    takeaways: [
      '1 consult = OK. 2+ = efficiency star reduced.',
      'Rapid Response only when truly deteriorating.',
    ],
  },
  {
    id: 'items',
    title: 'Items & Pharmacy',
    icon: 'flask',
    kicker: 'One-shot helpers from your bag.',
    content: {
      novice: w(`
Items are pre-made treatments — bandages, oxygen masks, antibiotics — that you collected from earlier battles.
They don't use a hero's turn and are great for emergencies.`),
      practiced: w(`
Items are limited consumables matched to specific clinical situations. They cost 0–1 AP and do not consume a hero action.
Stocking the right inventory before a known encounter (e.g., D50 for hypoglycemia) is part of pre-shift preparation.`),
      expert: w(`
Items map to pharmacology/protocol shortcuts. Some carry contraindications (e.g., fluid bolus in CHF). Misuse triggers risk damage.
Treat the bag as your code cart: build it intentionally per shift.`),
    },
  },
  {
    id: 'care-attempt',
    title: 'Care Attempt (Universal Fallback)',
    icon: 'hand-left',
    kicker: 'A basic 1-AP option — but use sparingly.',
    content: {
      novice: w(`
If you don't know what to do, Care Attempt is a basic action any hero can use. It costs 1 AP and lowers Corruption a small amount.
Don't lean on it — using it more than twice in one battle blocks your 3rd star.`),
      practiced: w(`
Care Attempt is a safety net for moments when no skill fits. It doesn't advance the care chain and scales down with chapter (5 → 4 → 3 corruption; only 2 vs bosses).
The 3rd star requires ≤2 uses — this nudges you toward targeted clinical thinking instead of spamming a generic move.`),
      expert: w(`
Care Attempt models nonspecific supportive care. The diminishing-returns curve and efficiency-star gate enforces specificity bias: the player must justify each action.
Useful primarily when AP is stranded (1 AP left, no system match available).`),
    },
  },
  {
    id: 'mentor',
    title: "The System's Aid (When You Lose)",
    icon: 'school',
    kicker: 'The game softens when you struggle — by design.',
    content: {
      novice: w(`
If you lose the same battle a few times, the game offers a "Training" mode — easier numbers, the same lessons.
It also shows hints based on what you missed. Learning > winning.`),
      practiced: w(`
Failure counters track per-enemy losses. At 2 losses you receive tactical hints (revealing the priority cue). At 3 losses a Training variant unlocks with reduced corruption and softer instability.
The System's Aid does not penalize your stars — it's there to lower the cliff.`),
      expert: w(`
Failure-recovery models spiral curriculum: repeated failure surfaces remediation content (chain logic, system mismatch, missed escalation), then offers a deliberate-practice mode with relaxed parameters.
Mastery is earned by re-attempting at normal difficulty after Training.`),
    },
  },
];
