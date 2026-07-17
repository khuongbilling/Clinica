/**
 * Explanation Layer system — Clinica: Kingdom of Healing
 *
 * Maps player's profile ID (from quiz or legacy onboarding) to one of 5
 * language-depth layers. The layer drives mission briefings, action feedback,
 * skill descriptions, Codex voice, and victory summaries.
 *
 * Independent of Difficulty — profile controls WHAT language is used;
 * difficulty controls HOW MUCH information is revealed.
 */

export type ExplanationLayer =
  | 'fantasy'        // curious / rpg / cozy / teen
  | 'simpleMedical'  // medical_learner / preNursing
  | 'nursing'        // nursing_student / nursingStudent
  | 'nclex'          // nclex / nclexPrep
  | 'professional';  // professional / healthcareProfessional

export function getExplanationLayer(profileId: string | null | undefined): ExplanationLayer {
  switch (profileId) {
    // New quiz IDs
    case 'curious':         return 'fantasy';
    case 'medical_learner': return 'simpleMedical';
    case 'nursing_student': return 'nursing';
    case 'nclex':           return 'nclex';
    case 'professional':    return 'professional';
    // Legacy onboarding IDs
    case 'rpg':
    case 'cozy':
    case 'teen':
    case 'nonmedical':      return 'fantasy';
    case 'preNursing':      return 'simpleMedical';
    case 'nursingStudent':  return 'nursing';
    case 'nclexPrep':       return 'nclex';
    case 'healthcareProfessional': return 'professional';
    default:                return 'simpleMedical';
  }
}

// ── Codex voice openers ──────────────────────────────────────────────────────

export const CODEX_VOICE: Record<ExplanationLayer, string> = {
  fantasy:       'The Codex whispers:',
  simpleMedical: 'The Codex explains:',
  nursing:       'Clinical note:',
  nclex:         'NCLEX lens:',
  professional:  'Clinically:',
};

// ── Per-action feedback by layer ─────────────────────────────────────────────

export const SCOUT_FEEDBACK: Record<ExplanationLayer, string> = {
  fantasy:       'You found a hidden clue. Clues help you avoid guessing.',
  simpleMedical: 'A new clue revealed. This finding helps narrow the problem.',
  nursing:       'Cue recognized. Use it to guide your next intervention.',
  nclex:         'Cue recognized. Analyze findings, prioritize hypothesis, and act based on data.',
  professional:  'Cue confirmed. Integrate with existing findings to determine priority system.',
};

export const STABILIZE_FEEDBACK: Record<ExplanationLayer, string> = {
  fantasy:       'Stability improved. The patient has more time.',
  simpleMedical: 'Patient Stability improved. A more stable patient gives time to treat the cause.',
  nursing:       'Stabilization supports patient safety while you prepare targeted care.',
  nclex:         'Stabilization maintains safety and supports priority interventions. Address the underlying cause next.',
  professional:  'Stability improved. Continue targeted intervention and reassessment.',
};

export const COUNTER_FEEDBACK: Record<ExplanationLayer, string> = {
  fantasy:       'Disease Corruption dropped. The illness is losing control.',
  simpleMedical: 'Corruption dropped because the action matched the problem.',
  nursing:       'Targeted intervention reduced the disease process — a strong system match.',
  nclex:         'Appropriate action based on cues. Priority addressed. Reassess to evaluate effectiveness.',
  professional:  'System match confirmed. Corruption reduced. Reassess clinical response.',
};

export const REASSESS_FEEDBACK: Record<ExplanationLayer, string> = {
  fantasy:       'The healer checks whether the corruption is truly fading.',
  simpleMedical: 'After helping the patient, you check whether the action worked.',
  nursing:       'Reassessment confirms response to intervention and detects worsening or rebound.',
  nclex:         'Reassessment evaluates intervention effectiveness and determines the next priority action.',
  professional:  'Evaluate response, trend stability, and determine next step.',
};

export const GENERIC_SCOUT_FEEDBACK: Record<ExplanationLayer, string> = {
  fantasy:       'You gathered information. Clues help you avoid guessing.',
  simpleMedical: 'You gathered new data. Information drives better decisions.',
  nursing:       'Assessment data collected. Use it to recognize cues and guide intervention.',
  nclex:         'Assessment data collected. Recognize cues, analyze, prioritize.',
  professional:  'Data acquired. Integrate and prioritize.',
};

// ── Mission briefings ─────────────────────────────────────────────────────────

export interface MissionBriefing {
  story: string;
  clinicalFocus?: string;
}

export const MISSION_BRIEFINGS: Record<string, Record<ExplanationLayer, MissionBriefing>> = {
  air_sprite: {
    fantasy:       { story: 'The Air Temple is collapsing. A patient is breathing fast, sitting upright, and losing oxygen glow. Something is blocking the flow of air.' },
    simpleMedical: { story: 'This patient shows signs of breathing difficulty. Look for clues such as wheezing, low oxygen glow, and increased work of breathing.', clinicalFocus: 'Airway · Breathing · Oxygenation · Bronchospasm' },
    nursing:       { story: 'The patient shows signs of respiratory distress. Prioritize airway and breathing, recognize cues, stabilize the patient, use an appropriate respiratory intervention, and reassess.' },
    nclex:         { story: 'Recognize cues of respiratory distress, analyze findings, prioritize airway and breathing, take appropriate action as ordered or per protocol, and reassess effectiveness.', clinicalFocus: 'Impaired gas exchange · Bronchospasm · Oxygenation · Airway/Breathing priority' },
    professional:  { story: 'Cues suggest respiratory distress with likely bronchospasm or impaired ventilation. Prioritize airway/breathing, stabilize as needed, intervene appropriately, and reassess response.' },
  },
  river_sludge: {
    fantasy:       { story: 'The River Gate is running dry. Blood pressure is falling. Restore circulation before the patient fades.' },
    simpleMedical: { story: 'The patient has low blood pressure and poor circulation. Look for signs of dehydration or blood loss.', clinicalFocus: 'Circulation · Perfusion · Blood pressure · Hypovolemia' },
    nursing:       { story: 'Recognize signs of poor perfusion — thready pulse, pallor, orthostasis. Stabilize and address the circulatory deficit.' },
    nclex:         { story: 'Recognize cues of impaired perfusion. Prioritize circulation, take ordered action, and reassess hemodynamic response.', clinicalFocus: 'Hypovolemia · Perfusion · Hemodynamics · Shock risk' },
    professional:  { story: 'Hemodynamic compromise with likely hypovolemia. Prioritize circulation, targeted fluid support, and reassess response.' },
  },
  energy_lock: {
    fantasy:       { story: 'The Energy Shrine flickers. A patient is shaking, sweating, and confused. Their fuel is running out.' },
    simpleMedical: { story: 'The patient has very low blood sugar. Shakiness, sweating, and confusion are classic signs.', clinicalFocus: 'Glucose · Metabolism · Hypoglycemia · Brain fuel' },
    nursing:       { story: 'Recognize hypoglycemic cues — diaphoresis, tremor, altered mentation. Prioritize glucose correction and reassess.' },
    nclex:         { story: 'Recognize cues of hypoglycemia. Prioritize glucose restoration as ordered, monitor neurological status, and reassess.', clinicalFocus: 'Hypoglycemia · Glucose · Neuro status · Endocrine' },
    professional:  { story: 'Symptomatic hypoglycemia. Correct glucose, monitor neuro status, and identify precipitating cause.' },
  },
  fire_imp: {
    fantasy:       { story: 'A fire spirit fans the flames of infection. The patient burns with fever, chills, and spreading redness.' },
    simpleMedical: { story: 'The patient has signs of a localized infection — fever, chills, and redness at a specific site.', clinicalFocus: 'Infection · Inflammation · Fever · WBC' },
    nursing:       { story: 'Recognize infection cues — fever, chills, localized erythema, leukocytosis. Prioritize source identification and infection control.' },
    nclex:         { story: 'Recognize infection cues. Prioritize source control, ordered antimicrobials, and infection prevention measures. Reassess for systemic spread.', clinicalFocus: 'Infection · Source control · Fever · Leukocytosis' },
    professional:  { story: 'Localized infection with fever and leukocytosis. Identify source, initiate ordered therapy, monitor for progression to SIRS.' },
  },
  septara_seed: {
    fantasy:       { story: 'A dark seed of systemic corruption spreads through Fire and River. The patient burns with fever, races with tachycardia, and fades into confusion.' },
    simpleMedical: { story: 'The patient has signs of a spreading infection affecting both the infection system and circulation.', clinicalFocus: 'Sepsis · Fever · Tachycardia · Low blood pressure' },
    nursing:       { story: 'Sepsis cues: SIRS criteria met. Prioritize fluid resuscitation, early antibiotics, and hemodynamic monitoring. Reassess frequently.' },
    nclex:         { story: 'Recognize cues meeting SIRS/sepsis criteria. Prioritize airway, circulation, source control, and ordered sepsis bundle. Reassess lactate and perfusion.', clinicalFocus: 'Sepsis · SIRS · Hemodynamics · Lactate · Antibiotics' },
    professional:  { story: 'Sepsis bundle indicated. Assess lactate, culture, initiate antibiotics, fluid resuscitate, and reassess hemodynamic response.' },
  },
};

// ── Objective strips per enemy × layer ───────────────────────────────────────

export const OBJECTIVE_BY_LAYER: Record<string, Partial<Record<ExplanationLayer, string>>> = {
  air_sprite: {
    fantasy:       'Reveal clue → Stabilize → Use Air skill → Reassess',
    simpleMedical: 'Identify breathing clues → Stabilize → Treat airway problem → Reassess',
    nursing:       'Recognize respiratory cues → Stabilize → Intervene → Reassess',
    nclex:         'Recognize Cues → Prioritize Airway/Breathing → Take Action → Evaluate Outcomes',
    professional:  'Prioritize Airway/Breathing. Intervene based on cues, then reassess.',
  },
};

export function getObjectiveStrip(enemyId: string, layer: ExplanationLayer, difficultyObjective: string): string {
  return OBJECTIVE_BY_LAYER[enemyId]?.[layer] ?? difficultyObjective;
}

// ── Victory summaries ─────────────────────────────────────────────────────────

export interface VictorySummary {
  headline: string;
  summary: string;
  terms?: string[];
  nclexSteps?: string[];
}

export const VICTORY_SUMMARIES: Record<string, Record<ExplanationLayer, VictorySummary>> = {
  air_sprite: {
    fantasy: {
      headline: 'Air Temple Restored',
      summary: 'You found the hidden clue, kept the patient stable, used an Air skill, and checked the response. The windways opened and the Air corruption weakened.',
    },
    simpleMedical: {
      headline: 'Air Temple Restored',
      summary: 'You recognized breathing difficulty, revealed a key clue, improved Stability, used an Air intervention, and reassessed.',
      terms: ['Wheezing', 'Oxygenation', 'Bronchospasm', 'Respiratory distress'],
    },
    nursing: {
      headline: 'Air Temple Restored',
      summary: 'You recognized respiratory cues, supported patient stability, applied a targeted intervention, and reassessed response.',
      terms: ['Airway', 'Breathing', 'Oxygenation', 'Respiratory distress', 'Reassessment'],
    },
    nclex: {
      headline: 'Air Temple Restored',
      summary: 'Clinical judgment applied successfully.',
      nclexSteps: [
        'Recognized cues of respiratory distress.',
        'Prioritized airway and breathing.',
        'Took appropriate action based on cues.',
        'Evaluated response through reassessment.',
      ],
      terms: ['Impaired ventilation', 'Bronchospasm', 'Oxygenation', 'Airway/Breathing priority'],
    },
    professional: {
      headline: 'Air Temple Restored',
      summary: 'Respiratory cues identified, stabilization supported, Air-targeted intervention applied, response reassessed.',
      terms: ['Bronchospasm', 'Oxygenation', 'Respiratory effort', 'Intervention response'],
    },
  },
};

export function getVictorySummary(enemyId: string, layer: ExplanationLayer): VictorySummary | null {
  return VICTORY_SUMMARIES[enemyId]?.[layer] ?? null;
}

// ── Skill layer descriptions ──────────────────────────────────────────────────

export const SKILL_LAYER_DESCRIPTIONS: Record<string, Partial<Record<ExplanationLayer, string>>> = {
  breath_of_dawn: {
    fantasy:       'A healing breath steadies the patient and gives your team more time.',
    simpleMedical: 'This improves Patient Stability, giving more time to treat the main breathing problem.',
    nursing:       'This represents stabilization before or during targeted intervention.',
    nclex:         'Stabilization supports patient safety and preserves time for priority interventions. Address the underlying cause next and reassess.',
    professional:  'Stabilization support. Does not replace targeted treatment of the underlying priority.',
  },
  lantern_of_clues: {
    fantasy:       'A lantern of insight reveals what the corruption tried to hide.',
    simpleMedical: 'Reveal an important clue to sharpen your next decision.',
    nursing:       'Assessment data helps recognize cues before choosing interventions.',
    nclex:         'Collecting assessment data is the first step of clinical judgment. Recognize the cue, then analyze and prioritize.',
    professional:  'Data acquisition. Use findings to determine system priority.',
  },
  rapid_response: {
    fantasy:       'The healer surges in with practiced calm — the patient pulls back from the edge.',
    simpleMedical: 'A big push of support when the patient is in serious trouble.',
    nursing:       'Emergency stabilization. Recognize deterioration and escalate care.',
    nclex:         'Recognize deterioration and escalate. Rapid intervention can stabilize an acutely unstable patient.',
    professional:  'Acute stabilization. Assess, escalate, and reassess response.',
  },
  reassess: {
    fantasy:       'A patient eye returns to the bedside and asks one more question.',
    simpleMedical: 'Take another look — sometimes a missed clue changes everything.',
    nursing:       'Reassessment is essential after every intervention to evaluate response and detect change.',
    nclex:         'Evaluation of outcomes. Did the intervention address the priority? What is the next action?',
    professional:  'Evaluate response, trend, and next priority.',
  },
  guardians_touch: {
    fantasy:       'A steadying pulse of healing energy restores balance.',
    simpleMedical: 'Basic care helps the patient feel better and slowly fights the problem.',
    nursing:       'Fundamental nursing care reduces disease burden over time.',
    nclex:         'Fundamental nursing care — repositioning, comfort, basic monitoring — has real therapeutic effect.',
    professional:  'Core nursing support. Consistently therapeutic across all presentations.',
  },
};

export function getSkillLayerDescription(skillId: string, layer: ExplanationLayer): string | null {
  return SKILL_LAYER_DESCRIPTIONS[skillId]?.[layer] ?? null;
}

// ── Hero descriptions by layer ────────────────────────────────────────────────

export const HERO_LAYER_DESCRIPTIONS: Record<string, Partial<Record<ExplanationLayer, string>>> = {
  novice_guardian: {
    fantasy:       'A young Air Temple wardkeeper who protects the windways when breathing becomes unstable.',
    simpleMedical: 'An Air-focused healer who helps with breathing problems — wheezing, narrowed airways, and low oxygen.',
    nursing:       'A stabilizer and Air support hero focused on respiratory distress, oxygenation, and reassessment.',
    nclex:         'Best used when cues indicate airway/breathing priority or bronchospasm. Supports stabilization, targeted action, and evaluation of response.',
    professional:  'Air-focused support for bronchospasm, impaired ventilation, oxygenation concerns, and post-intervention reassessment.',
  },
  apprentice_seer: {
    fantasy:       'A Codex scholar who reads the threads between clues — revealing what the disease tried to hide.',
    simpleMedical: 'A healer who finds hidden information. Revealing clues improves your decisions.',
    nursing:       'An assessor focused on cue recognition. Pattern Sight reveals multiple clues and supports targeted action.',
    nclex:         'Supports "Recognize Cues" and "Analyze Cues" steps of clinical judgment.',
    professional:  'Assessment and analysis specialist. Reveals hidden findings to drive targeted intervention.',
  },
  junior_warden: {
    fantasy:       'A Protection Wall sentinel who shields the patient from danger before it arrives.',
    simpleMedical: 'A safety-focused healer who prevents harm — falls, infection spread, or other dangers.',
    nursing:       'A safety and protection hero. Proactive shielding and infection control.',
    nclex:         'Prioritizes patient safety — falls, infection prevention, harm reduction. Shield actions reduce injury risk.',
    professional:  'Safety and infection control specialist. Reduces harm events and source-transmission risk.',
  },
  data_acolyte: {
    fantasy:       'A Storm Observatory scholar who reads patterns in data the way poets read the sky.',
    simpleMedical: 'A data-focused healer who reveals hidden clues and predicts what may worsen next.',
    nursing:       'An analyst who recognizes trends and patterns across multiple cues.',
    nclex:         'Supports "Analyze Cues" and "Prioritize Hypotheses" steps. Reveals full data picture.',
    professional:  'Systems analyst. Reveals full data picture and identifies priority system.',
  },
  village_caretaker: {
    fantasy:       'The first healer most patients ever meet — steady, kind, always present.',
    simpleMedical: 'Basic care helps every patient. This hero does a little of everything.',
    nursing:       'Foundational nursing care: comfort, monitoring, reassessment.',
    nclex:         'Fundamental nursing care has real therapeutic value. Reassessment-capable.',
    professional:  'Core nursing support. Reliable across all system presentations.',
  },
};

export function getHeroLayerDescription(heroId: string, layer: ExplanationLayer): string | null {
  return HERO_LAYER_DESCRIPTIONS[heroId]?.[layer] ?? null;
}

// ── Contextual consequence feedback ──────────────────────────────────────────
// These replace the generic per-action strings when we have turn-level context
// (what actions already happened this turn, whether stability is critical, etc.).

export interface ActionFeedbackContext {
  scoutedThisTurn: boolean;
  treatedThisTurn: boolean;
  stabilityLow: boolean;   // stability < 50
}

export function getContextualScoutFeedback(layer: ExplanationLayer, ctx: ActionFeedbackContext): string {
  if (ctx.treatedThisTurn) {
    const msgs: Record<ExplanationLayer, string> = {
      fantasy:       'Checking clues after acting — findings now can still redirect your next step.',
      simpleMedical: 'Data gathered after treatment. Use these findings to guide what you do next.',
      nursing:       'Late assessment still valuable — use new cues to evaluate response and redirect care.',
      nclex:         'Post-intervention assessment: recognize new cues and evaluate effectiveness.',
      professional:  'Post-intervention assessment: integrate findings to determine next priority.',
    };
    return msgs[layer];
  }
  return SCOUT_FEEDBACK[layer];
}

export function getContextualStabilizeFeedback(layer: ExplanationLayer, ctx: ActionFeedbackContext): string {
  if (!ctx.stabilityLow) {
    const msgs: Record<ExplanationLayer, string> = {
      fantasy:       'The patient was already holding steady — this keeps the margin safe.',
      simpleMedical: 'Stability was comfortable, but keeping it high extends your window to treat.',
      nursing:       'Stability maintained. Weigh whether targeting the underlying cause has higher priority here.',
      nclex:         'Consider whether stabilization was the top priority at this stability level.',
      professional:  'Stability adequate — weigh stabilization vs targeted intervention priority.',
    };
    return msgs[layer];
  }
  return STABILIZE_FEEDBACK[layer];
}

// Returns a Care-Chain–flagged message when reassess fires after treatment,
// or falls back to the standard reassess string otherwise.
export function getContextualReassessFeedback(layer: ExplanationLayer, ctx: ActionFeedbackContext): string {
  if (ctx.treatedThisTurn) {
    const msgs: Record<ExplanationLayer, string> = {
      fantasy:       '✦ Care Chain — treatment then reassessment. Bonus AP next turn!',
      simpleMedical: '✦ Care Chain — you treated, then checked the response. Bonus AP awarded!',
      nursing:       '✦ Care Chain — targeted intervention followed by reassessment. Clinical reasoning rewarded.',
      nclex:         '✦ Care Chain — Intervene → Evaluate Outcomes. This is clinical judgment in action.',
      professional:  '✦ Care Chain — intervention with reassessment confirms systematic clinical reasoning.',
    };
    return msgs[layer];
  }
  return REASSESS_FEEDBACK[layer];
}

// ── Result-screen Clinical Reflection ────────────────────────────────────────

export interface ClinicalReflectionResult {
  bestAction: string | null;
  missedOpportunity: string | null;
  nextTip: string;
}

export function buildClinicalReflection(params: {
  won: boolean;
  fullChainCompleted: boolean;
  reassessUsed: boolean;
  unsafeCount: number;
  poorFitCount: number;
  turnsCount: number;
  consultsUsed: number;
  inappropriateConsultsUsed: number;
  basicAidUses: number;
}): ClinicalReflectionResult {
  const { won, fullChainCompleted, reassessUsed, unsafeCount, poorFitCount, consultsUsed, inappropriateConsultsUsed } = params;

  let bestAction: string | null = null;
  if (fullChainCompleted) {
    bestAction = 'Full Care Chain — Scout, Stabilize, Treat, and Reassess in sequence.';
  } else if (reassessUsed && won) {
    bestAction = 'You reassessed after treatment — that\'s the loop the Codex rewards.';
  } else if (consultsUsed > 0 && inappropriateConsultsUsed === 0) {
    bestAction = 'Smart Support Call — right resource, right situation.';
  } else if (unsafeCount === 0 && poorFitCount === 0 && won) {
    bestAction = 'Clean approach — no unsafe or poor-fit actions used.';
  }

  let missedOpportunity: string | null = null;
  if (!reassessUsed && won) {
    missedOpportunity = 'No Reassess used — checking after treatment earns Care Chain bonus AP next turn.';
  } else if (unsafeCount > 0) {
    missedOpportunity = `${unsafeCount} unsafe action${unsafeCount > 1 ? 's' : ''} taken — these weaken progress and risk the patient.`;
  } else if (!fullChainCompleted && won && reassessUsed) {
    missedOpportunity = 'Care Chain incomplete — try Scout → Stabilize → Treat → Reassess for max bonus.';
  } else if (inappropriateConsultsUsed > 0) {
    missedOpportunity = 'A Support Call didn\'t match the situation — the Codex noted it.';
  } else if (poorFitCount > 0 && won) {
    missedOpportunity = `${poorFitCount} poor-fit action${poorFitCount > 1 ? 's' : ''} — matching the enemy system deals more corruption damage.`;
  }

  let nextTip: string;
  if (!reassessUsed) {
    nextTip = 'Next time: use Analyze after a treatment skill to close the care loop and earn bonus AP.';
  } else if (!fullChainCompleted) {
    nextTip = 'Try opening with Scout → Stabilize → Treat → Reassess for the full chain bonus.';
  } else if (unsafeCount === 0 && poorFitCount === 0) {
    nextTip = 'Perfect sequence. Push to a higher-difficulty enemy to test your clinical reasoning.';
  } else {
    nextTip = 'Revisit the Codex and match your actions to the enemy\'s primary system each turn.';
  }

  return { bestAction, missedOpportunity, nextTip };
}
