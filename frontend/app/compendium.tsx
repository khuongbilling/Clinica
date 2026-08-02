/**
 * /compendium — Clinical Compendium
 *
 * Two sections:
 *   · Pathophysiology Bestiary — disease spirits encountered in Ward Defense
 *     (discovery-gated: enemies appear after being defeated)
 *   · Clinical Supplies — items with real-world mechanism of action
 *
 * Discovery state stored in AsyncStorage under "clinica.wd_compendium_v1".
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getDefeatedEnemies } from "@/src/game/compendiumStore";
import { ENEMIES } from "@/src/game/content";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

type EnemyEntry = {
  id: string;
  name: string;
  icon: string;
  color: string;
  fantasyName: string;
  clinicalName: string;
  pathophysiology: string;
  cues: string[];
  interventions: string[];
  realWorldNote: string;
};

const ENEMY_COMPENDIUM: EnemyEntry[] = [
  {
    id: "breathless_wisp",
    name: "Breathless Wisp",
    icon: "💨",
    color: "#A6D8F6",
    fantasyName: "Breathless Wisp",
    clinicalName: "Acute Dyspnea / Respiratory Distress",
    pathophysiology:
      "Dyspnea arises when ventilatory demand exceeds capacity. Causes span mechanical obstruction (airway, lung parenchyma), pump failure, or chemical signals (hypoxia, hypercapnia). The brain's respiratory centres detect imbalance and escalate the drive to breathe, producing the perceived sensation of breathlessness.",
    cues: ["Increased RR", "Nasal flaring", "Accessory muscle use", "Low SpO₂", "Anxiety"],
    interventions: ["Supplemental O₂", "Position (head of bed ↑)", "Assess cause first", "Bronchodilators if indicated"],
    realWorldNote:
      "The ABCDE framework always starts with Airway then Breathing — dyspnea sits at the top of clinical priority because oxygenation is the first irreversible failure point.",
  },
  {
    id: "wheeze_sprite",
    name: "Wheeze Sprite",
    icon: "🌀",
    color: "#B0DEFF",
    fantasyName: "Wheeze Sprite",
    clinicalName: "Bronchospasm / Airway Narrowing",
    pathophysiology:
      "Bronchospasm is smooth-muscle contraction of bronchi triggered by allergens, irritants, cold air, or autonomic imbalance. The narrowed lumen creates turbulent airflow, producing the characteristic high-pitched wheeze on expiration. Mast-cell degranulation releases histamine and leukotrienes, amplifying mucosal oedema.",
    cues: ["Audible wheeze", "Prolonged expiration", "Reduced peak flow", "Cough", "Chest tightness"],
    interventions: ["Short-acting β2-agonist (SABA)", "Ipratropium", "Corticosteroids for refractory cases", "Remove trigger"],
    realWorldNote:
      "Salbutamol (albuterol) acts on β2 receptors in bronchial smooth muscle, causing relaxation and rapid bronchodilation — the primary first-line intervention for acute bronchospasm.",
  },
  {
    id: "mucus_slime",
    name: "Mucus Slime",
    icon: "🟢",
    color: "#86EFAC",
    fantasyName: "Mucus Slime",
    clinicalName: "Secretion Retention / Impaired Airway Clearance",
    pathophysiology:
      "Excess mucus from goblet-cell hyperplasia and submucoid gland hypertrophy (chronic) or acute mucosal irritation (infection) can overwhelm the mucociliary escalator. Retained secretions increase infection risk, plug small airways, and worsen ventilation-perfusion mismatch.",
    cues: ["Productive cough", "Coarse crackles", "Reduced breath sounds in affected lobe", "Fever if infected"],
    interventions: ["Airway suctioning", "Chest physiotherapy", "Hydration", "Mucolytics", "Positioning"],
    realWorldNote:
      "Hydration thins secretions by maintaining mucus viscosity. Chest PT and huffing coughs mobilise mucus using the mechanics of forced expiration — non-pharmacological but highly effective.",
  },
  {
    id: "hypoxia_wraith",
    name: "Hypoxia Wraith",
    icon: "🌑",
    color: "#7DD3FC",
    fantasyName: "Hypoxia Wraith",
    clinicalName: "Hypoxaemia / Tissue Hypoxia",
    pathophysiology:
      "Hypoxaemia (low PaO₂ or SpO₂) impairs cellular aerobic metabolism. Cells shift to anaerobic glycolysis, producing lactate. Prolonged hypoxia causes mitochondrial dysfunction, cell death, and multi-organ failure. The brain is most sensitive — seconds to minutes without oxygen cause irreversible neuronal loss.",
    cues: ["SpO₂ < 94%", "Cyanosis (late)", "Confusion", "Tachycardia", "Laboured breathing"],
    interventions: ["Supplemental O₂ titrated to SpO₂ 94–98%", "Treat underlying cause", "Non-rebreather mask for severe cases", "Consider intubation"],
    realWorldNote:
      "Target SpO₂ varies by condition — 94–98% generally; 88–92% in COPD (hypoxic drive). Over-oxygenation in COPD can suppress respiratory drive.",
  },
  {
    id: "panic_imp",
    name: "Panic Imp",
    icon: "⚡",
    color: "#FDE68A",
    fantasyName: "Panic Imp",
    clinicalName: "Acute Anxiety / Panic Response",
    pathophysiology:
      "The autonomic stress response releases catecholamines (adrenaline, noradrenaline), raising HR, RR, and BP. Hyperventilation lowers PaCO₂ (hypocapnia), causing respiratory alkalosis — tingling, carpopedal spasm, and worsening anxiety in a positive-feedback loop.",
    cues: ["Tachycardia", "Hyperventilation", "Tingling extremities", "Reported chest tightness", "SpO₂ normal"],
    interventions: ["Calm reassurance", "Controlled breathing coaching (4-7-8 technique)", "Exclude organic cause first", "Anxiolytics if severe"],
    realWorldNote:
      "Panic attacks mimic cardiac and respiratory emergencies — always exclude MI, PE, and hypoxia before attributing symptoms to anxiety. 'Rule out first' is the clinical priority.",
  },
  {
    id: "fever_imp",
    name: "Fever Imp",
    icon: "🔥",
    color: "#F97316",
    fantasyName: "Fever Imp",
    clinicalName: "Pyrexia / Systemic Inflammatory Response",
    pathophysiology:
      "Fever is a regulated thermoregulatory shift mediated by prostaglandin E2 (PGE2) acting on the hypothalamic set point. Triggered by pyrogens (LPS, cytokines — IL-1, IL-6, TNF-α). Serves an immune function (slows pathogen replication, enhances neutrophil activity) but incurs metabolic cost: ~10% ↑O₂ demand per 1°C rise.",
    cues: ["Temperature > 38°C", "Tachycardia", "Diaphoresis", "Rigors (if spiking)", "Hot dry or moist skin"],
    interventions: ["Identify and treat source", "Antipyretics (paracetamol, ibuprofen)", "Cooling", "IV fluids if dehydrated"],
    realWorldNote:
      "Paracetamol inhibits COX enzymes in the CNS to reduce PGE2 synthesis. Ibuprofen (NSAID) inhibits COX-1/COX-2 peripherally and centrally. Neither kills the infection — they manage the thermoregulatory cost.",
  },
  {
    id: "shock_shade",
    name: "Shock Shade",
    icon: "💀",
    color: "#F87171",
    fantasyName: "Shock Shade",
    clinicalName: "Circulatory Shock / Haemodynamic Instability",
    pathophysiology:
      "Shock is inadequate tissue perfusion relative to metabolic demand. Distributive (sepsis, anaphylaxis), hypovolaemic (haemorrhage, dehydration), cardiogenic (pump failure), and obstructive (PE, tamponade) mechanisms all converge on low MAP → organ ischaemia. Compensated shock preserves BP via vasoconstriction and tachycardia; decompensated shock means these fail.",
    cues: ["BP < 90/60 or MAP < 65", "Tachycardia", "Cold clammy skin (hypovolaemic/cardiogenic)", "Reduced urine output", "Altered consciousness"],
    interventions: ["IV access + fluid challenge", "Vasopressors (noradrenaline) if fluid-refractory", "Treat cause", "Continuous monitoring"],
    realWorldNote:
      "The Shock Index (HR ÷ SBP) > 1 flags haemodynamic compromise. A value of 1 means HR equals SBP — a simple bedside alarm. Early recognition is the key determinant of outcome.",
  },
  {
    id: "stun_toad",
    name: "Stun Toad",
    icon: "🐸",
    color: "#A78BFA",
    fantasyName: "Stun Toad",
    clinicalName: "Acute Neurological Impairment / Syncope",
    pathophysiology:
      "Transient or sustained cerebral hypoperfusion impairs synaptic transmission. Causes: arrhythmia, vasovagal response, orthostatic hypotension, hypoglycaemia, or structural. Sudden loss of postural tone (syncope) or confusion reflects the brain's sensitivity to even brief drops in glucose or O₂ delivery.",
    cues: ["Sudden confusion", "LOC (brief or sustained)", "Fall or collapse", "GCS change", "Bradycardia or pause"],
    interventions: ["Lay flat (Trendelenburg if vasovagal)", "Check glucose", "12-lead ECG", "IV access", "Treat underlying cause"],
    realWorldNote:
      "Vasovagal syncope is the most common cause (70% of all syncope). The Bezold-Jarisch reflex triggers profound bradycardia and vasodilatation in response to pain, fear, or standing. Lying flat increases cerebral perfusion rapidly.",
  },
  {
    id: "corruption_leech",
    name: "Corruption Leech",
    icon: "🩸",
    color: "#E879F9",
    fantasyName: "Corruption Leech",
    clinicalName: "Sepsis / Systemic Infection",
    pathophysiology:
      "Sepsis is life-threatening organ dysfunction caused by a dysregulated host response to infection. Pathogen products activate Toll-like receptors → cytokine storm → endothelial damage → microvascular thrombosis and leak → multi-organ failure. qSOFA (RR ≥ 22, altered mentation, SBP ≤ 100) is the bedside screen.",
    cues: ["Fever OR hypothermia", "Tachycardia + tachypnoea", "Hypotension (late)", "New confusion", "High lactate"],
    interventions: ["Blood cultures before antibiotics", "Broad-spectrum antibiotics within 1 h", "IV fluid resuscitation", "Vasopressors if needed", "Source control"],
    realWorldNote:
      "The Sepsis-3 Surviving Sepsis Campaign Bundle: blood cultures, IV antibiotics, fluids, lactate measurement — all within the first hour. Every hour of antibiotic delay increases mortality by ~7%.",
  },
  {
    id: "bronchospasm_drake",
    name: "Bronchospasm Drake",
    icon: "🐉",
    color: "#60A5FA",
    fantasyName: "Bronchospasm Drake",
    clinicalName: "Severe Acute Asthma / Status Asthmaticus",
    pathophysiology:
      "Status asthmaticus is a prolonged, severe bronchospasm unresponsive to first-line bronchodilators. Progressive air-trapping (dynamic hyperinflation) increases intrinsic PEEP, worsens dead space, and can cause respiratory muscle fatigue. PaCO₂ rising to normal in a severe asthmatic is an ominous sign — it indicates respiratory muscle exhaustion.",
    cues: ["Unable to speak in full sentences", "PEFR < 33% predicted", "Rising PaCO₂", "Silent chest (minimal wheeze)", "Cyanosis"],
    interventions: ["Back-to-back SABA nebulisations", "IV/oral corticosteroids", "IV magnesium sulphate", "Consider heliox/NIV/intubation"],
    realWorldNote:
      "Magnesium sulphate causes smooth-muscle relaxation by antagonising calcium — used as a second-line bronchodilator in severe asthma. A 'silent chest' in a known asthmatic is a pre-arrest pattern.",
  },
];

type ItemEntry = {
  id:          string;
  displayName: string;
  systemType:  string;
  itemType:    string;
  shortEffect: string;
  realName:    string;
  realClass:   string;
  moa:         string;
  clinicalUse: string;
  caution:     string;
};

const ITEM_COMPENDIUM: ItemEntry[] = [
  {
    id: "I001", displayName: "Bronchodilator Mist", systemType: "Air", itemType: "Pharmacy",
    shortEffect: "Requires Wheezing • -30 Corruption",
    realName: "Salbutamol (Albuterol)", realClass: "Short-Acting β2-Agonist (SABA)",
    moa: "Selectively binds β2-adrenergic receptors in bronchial smooth muscle → activates adenylyl cyclase → ↑cAMP → bronchial smooth muscle relaxation within 5 minutes.",
    clinicalUse: "Acute bronchospasm (asthma, COPD exacerbation). Delivered via MDI or nebuliser for direct airway deposition.",
    caution: "Tachycardia and hypokalaemia with frequent use. Not a controller — does not address underlying airway inflammation.",
  },
  {
    id: "I002", displayName: "Glucose Spark Gel", systemType: "Energy", itemType: "Pharmacy",
    shortEffect: "Requires Low Glucose • -22 Corruption",
    realName: "Oral Glucose Gel / IV Dextrose", realClass: "Glucose Supplement",
    moa: "Directly raises blood glucose → restores substrate for neuronal ATP synthesis. Oral gel: buccal absorption in conscious patients. IV 50% dextrose: rapid correction of severe hypoglycaemia.",
    clinicalUse: "Hypoglycaemia (BGL < 4 mmol/L with symptoms). Give carbohydrate first, then a complex carbohydrate meal.",
    caution: "Confirm hypoglycaemia before administration. Glucose in a stroke mimicking hypoglycaemia worsens ischaemia.",
  },
  {
    id: "I003", displayName: "River Bolus", systemType: "River", itemType: "Intervention",
    shortEffect: "Requires Low BP • +25 Stability",
    realName: "IV Fluid Bolus (Normal Saline / Hartmann's)", realClass: "Crystalloid Resuscitation",
    moa: "Expands intravascular volume → increases venous return (preload) → ↑stroke volume (Frank-Starling) → ↑cardiac output → ↑MAP and tissue perfusion.",
    clinicalUse: "Hypovolaemic shock, sepsis initial resuscitation. Typical bolus 250–500 mL over 15–30 min, reassessed each time.",
    caution: "Excess fluids cause pulmonary oedema (especially in heart failure or renal failure). 'Fluid responsiveness' should guide ongoing therapy.",
  },
  {
    id: "I004", displayName: "Isolation Kit", systemType: "Protection", itemType: "Safety",
    shortEffect: "Blocks Spread",
    realName: "Standard / Contact / Droplet Precautions", realClass: "Infection Control Bundle",
    moa: "Breaks the chain of infection at the transmission link. Physical barriers (gloves, gown, mask, eye protection) prevent direct and indirect contact transmission. Spatial isolation limits droplet range (>1 m).",
    clinicalUse: "MRSA, VRE, C. diff (contact); influenza (droplet); TB, measles (airborne + negative pressure room).",
    caution: "Adherence is the critical variable — precautions only work if consistently applied for every patient contact, every time.",
  },
  {
    id: "I005", displayName: "Lab Token", systemType: "Universal", itemType: "Scout",
    shortEffect: "Reveal Hidden Clue",
    realName: "Targeted Laboratory Investigation", realClass: "Diagnostic Test",
    moa: "Laboratory tests confirm or exclude clinical hypotheses by detecting biomarkers (enzymes, electrolytes, organisms) that are not directly observable at the bedside.",
    clinicalUse: "FBC, U&E, LFTs, lactate, blood cultures, troponin, ABG — chosen based on the leading clinical differential, not ordered reflexively.",
    caution: "Tests have pre-test probability effects on interpretation — a D-dimer is only useful in low-to-moderate PE probability. Over-testing wastes resources and can cause incidental finding cascades.",
  },
  {
    id: "I006", displayName: "Fever-Break Draught", systemType: "Fire", itemType: "Pharmacy",
    shortEffect: "Best vs Fire • -24 Corruption",
    realName: "Paracetamol / Ibuprofen (Antipyretic)", realClass: "Analgesic-Antipyretic / NSAID",
    moa: "Paracetamol: inhibits COX-3 (central) reducing PGE2 synthesis at the hypothalamus → lowers thermoregulatory set point. Ibuprofen: non-selective COX-1/2 inhibitor, reduces PGE2 peripherally and centrally.",
    clinicalUse: "Symptomatic relief of fever and pain. Does not treat the underlying cause — identify and treat the source.",
    caution: "Paracetamol: hepatotoxic in overdose. NSAIDs: GI bleeding, renal impairment, contraindicated in third trimester. Never confuse symptom control with curative treatment.",
  },
  {
    id: "I007", displayName: "Oxygen Sigil", systemType: "Air", itemType: "Intervention",
    shortEffect: "Best vs Air • +22 Stability",
    realName: "Supplemental Oxygen Therapy", realClass: "Respiratory Support",
    moa: "Increases FiO₂ → raises alveolar PO₂ (PAO₂) → increases dissolved and haemoglobin-bound oxygen in arterial blood → corrects hypoxaemia via the alveolar gas equation.",
    clinicalUse: "SpO₂ < 94% (target 94–98%; 88–92% in COPD risk). Devices: nasal cannula (1–6 L/min), simple mask, non-rebreather mask (10–15 L/min), Venturi mask (precise FiO₂).",
    caution: "Hyperoxia causes vasoconstriction and free-radical injury. COPD: some patients have hypoxic respiratory drive — target lower SpO₂ 88–92%. Titrate, don't saturate.",
  },
  {
    id: "I008", displayName: "Calming Elixir", systemType: "Mind", itemType: "Intervention",
    shortEffect: "Best vs Mind • +20 Stability",
    realName: "De-escalation / Anxiolytic Support", realClass: "Psychological Intervention / Benzodiazepine",
    moa: "Non-pharmacological: activates parasympathetic system via slow controlled breathing (↑HRV, ↓cortisol). Pharmacological (e.g. lorazepam): potentiates GABA-A receptors → CNS inhibition → reduced anxiety and muscle tension.",
    clinicalUse: "Panic attacks, acute agitation, procedural anxiety, alcohol withdrawal (pharmacological). Non-pharmacological first-line for most anxious patients.",
    caution: "Benzodiazepines: respiratory depression risk, addiction potential, cognitive impairment in elderly. Always exclude organic cause (hypoxia, MI, hypoglycaemia) before labelling as anxiety.",
  },
  {
    id: "I009", displayName: "Analgesic Balm", systemType: "Mind", itemType: "Pharmacy",
    shortEffect: "Best vs Mind • +16 Stability",
    realName: "Analgesics (Paracetamol / Opioids)", realClass: "Pain Management",
    moa: "Paracetamol: central COX inhibition, modulates descending pain pathways. Opioids (morphine, fentanyl): bind μ-opioid receptors in dorsal horn and brain → inhibit pain signal transmission and alter pain perception.",
    clinicalUse: "WHO analgesic ladder: paracetamol + NSAIDs → weak opioids → strong opioids. Pain impairs breathing, increases cortisol, and delays recovery — treat it proactively.",
    caution: "Opioids: respiratory depression, constipation, addiction. Always pair with a bowel regimen. Monitor RR and sedation score. Naloxone is the reversal agent.",
  },
  {
    id: "I010", displayName: "Rhythm Elixir", systemType: "Storm", itemType: "Intervention",
    shortEffect: "Best vs Storm • +20 Stability",
    realName: "Antiarrhythmics / Cardioversion", realClass: "Cardiac Rate/Rhythm Control",
    moa: "Adenosine: transiently blocks AV node conduction → terminates re-entrant SVT. Amiodarone: class III — prolongs action potential duration by blocking potassium channels. DC cardioversion: synchronised shock resets aberrant electrical circuits.",
    clinicalUse: "SVT, AF with fast ventricular rate, VT. Requires continuous monitoring. 12-lead ECG essential before and after.",
    caution: "All antiarrhythmics can be proarrhythmic. Identify and correct reversible causes (hypokalaemia, hypomagnesaemia, ischaemia, hyperthyroidism) before escalating drugs.",
  },
  {
    id: "I011", displayName: "Antiemetic Charm", systemType: "Filter", itemType: "Pharmacy",
    shortEffect: "Best vs Filter • -18 Corruption",
    realName: "Antiemetics (Ondansetron / Metoclopramide)", realClass: "Nausea & Vomiting Control",
    moa: "Ondansetron: 5-HT3 receptor antagonist in the chemoreceptor trigger zone and vagal afferents — blocks serotonin-mediated emetic signals. Metoclopramide: dopamine D2 antagonist — reduces CTZ stimulation and increases GI motility.",
    clinicalUse: "Post-operative nausea, chemotherapy-induced emesis, gastroenteritis, vertigo-associated nausea. Prevents dehydration and aspiration risk.",
    caution: "Ondansetron: QT prolongation (ECG check if pre-existing cardiac risk). Metoclopramide: extrapyramidal side effects (akathisia, dystonia) especially with prolonged use.",
  },
];

const ITEM_TYPE_COLOR: Record<string, string> = {
  Pharmacy: "#4FD8C4", Intervention: "#BBA7EA", Safety: "#E8C868", Scout: "#A6D8F6",
};
const SYSTEM_COLOR: Record<string, string> = {
  Air: "#A6D8F6", Energy: "#E8C868", River: "#4FD8C4", Fire: "#F97316",
  Protection: "#BBA7EA", Earth: "#86EFAC", Mind: "#C4B5FD", Universal: "#D4AF37", Storm: "#60A5FA", Filter: "#F472B6",
};

type Tab = "bestiary" | "medicines";

export default function CompendiumScreen() {
  const router = useRouter();
  const [tab,       setTab]       = useState<Tab>("bestiary");
  const [defeated,  setDefeated]  = useState<string[]>([]);
  const [expanded,  setExpanded]  = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    getDefeatedEnemies().then(setDefeated);
  }, []));

  const discoveredEnemies = ENEMY_COMPENDIUM.filter((e) => defeated.includes(e.id));
  const undiscovered      = ENEMY_COMPENDIUM.length - discoveredEnemies.length;

  return (
    <SafeAreaView style={s.root} edges={["top", "bottom"]}>

      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="#94a3b8" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Clinical Compendium</Text>
          <Text style={s.subtitle}>Pathophysiology · Pharmacology · Clinical Reasoning</Text>
        </View>
        <View style={s.emblem}>
          <Text style={{ fontSize: 22 }}>📖</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(["bestiary", "medicines"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
          >
            <Ionicons
              name={t === "bestiary" ? "skull-outline" : "medical-outline"}
              size={14}
              color={tab === t ? "#f0f9ff" : "#64748b"}
            />
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
              {t === "bestiary" ? "Bestiary" : "Medicines"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {tab === "bestiary" && (
          <>
            {/* Discovery banner */}
            <View style={s.discoveryBanner}>
              <Ionicons name="lock-open-outline" size={16} color="#60a5fa" />
              <Text style={s.discoveryTxt}>
                {discoveredEnemies.length === 0
                  ? "Defeat disease spirits in Ward Defense to unlock their entries."
                  : `${discoveredEnemies.length} of ${ENEMY_COMPENDIUM.length} spirits documented.${undiscovered > 0 ? ` ${undiscovered} still undiscovered.` : " Bestiary complete!"}`}
              </Text>
            </View>

            {discoveredEnemies.length === 0 && (
              <View style={s.emptyState}>
                <Text style={{ fontSize: 48 }}>🔒</Text>
                <Text style={s.emptyTitle}>No Entries Yet</Text>
                <Text style={s.emptyDesc}>
                  Play Ward Defense and defeat disease spirits to unlock their pathophysiology entries here.
                </Text>
              </View>
            )}

            {discoveredEnemies.map((e) => {
              const open = expanded === e.id;
              return (
                <Pressable
                  key={e.id}
                  style={[s.card, { borderColor: e.color + "33" }]}
                  onPress={() => setExpanded(open ? null : e.id)}
                >
                  {/* Header row */}
                  <View style={s.cardHeader}>
                    <View style={[s.iconCircle, { backgroundColor: e.color + "20", borderColor: e.color + "40" }]}>
                      <Text style={{ fontSize: 20 }}>{e.icon}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[s.cardTitle, { color: e.color }]}>{e.fantasyName}</Text>
                      <Text style={s.cardClinical}>{e.clinicalName}</Text>
                    </View>
                    <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color="#64748b" />
                  </View>

                  {/* Cue chips */}
                  {!open && (
                    <View style={s.cueRow}>
                      {e.cues.slice(0, 3).map((c, i) => (
                        <View key={i} style={[s.cuePill, { backgroundColor: e.color + "18", borderColor: e.color + "35" }]}>
                          <Text style={[s.cueTxt, { color: e.color }]}>{c}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {open && (
                    <View style={s.expanded}>
                      {/* Push 2: Section 1 — Corruption */}
                      {(() => {
                        const gameEnemy = ENEMIES.find(ge => ge.id === e.id);
                        const aspect = gameEnemy?.corruptionAspect;
                        return (
                          <View style={[s.section, { borderLeftColor: "#a78bfa" }]}>
                            <Text style={[s.sectionLabel, { color: "#a78bfa" }]}>CORRUPTION</Text>
                            {aspect ? (
                              <View style={s.aspectRow}>
                                <Text style={s.aspectBadge}>{aspect}</Text>
                              </View>
                            ) : null}
                            <Text style={s.sectionBody}>{e.pathophysiology}</Text>
                          </View>
                        );
                      })()}

                      {/* Push 2: Section 2 — Clinical Domain */}
                      {(() => {
                        const gameEnemy = ENEMIES.find(ge => ge.id === e.id);
                        const primary = gameEnemy?.primaryAffinity;
                        const secondaries = gameEnemy?.secondaryAffinities ?? [];
                        return (
                          <View style={[s.section, { borderLeftColor: e.color }]}>
                            <Text style={[s.sectionLabel, { color: e.color }]}>CLINICAL DOMAIN</Text>
                            {primary ? (
                              <View style={s.domainRow}>
                                <View style={[s.domainPill, { borderColor: e.color + "60", backgroundColor: e.color + "12" }]}>
                                  <Text style={[s.domainTxt, { color: e.color }]}>{primary}</Text>
                                </View>
                                {secondaries.map((sd, i) => (
                                  <View key={i} style={[s.domainPill, { borderColor: e.color + "40", backgroundColor: e.color + "0a" }]}>
                                    <Text style={[s.domainTxt, { color: e.color + "cc" }]}>{sd}</Text>
                                  </View>
                                ))}
                              </View>
                            ) : null}
                            {/* Clinical cues */}
                            <Text style={[s.expandedLabel, { marginTop: 6 }]}>RECOGNIZE CUES</Text>
                            <View style={s.cueRow}>
                              {e.cues.map((c, i) => (
                                <View key={i} style={[s.cuePill, { backgroundColor: e.color + "18", borderColor: e.color + "35" }]}>
                                  <Text style={[s.cueTxt, { color: e.color }]}>{c}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        );
                      })()}

                      {/* Push 2: Section 3 — Elemental Counter */}
                      {(() => {
                        const gameEnemy = ENEMIES.find(ge => ge.id === e.id);
                        const weak = gameEnemy?.weakElement;
                        return (
                          <View style={[s.section, { borderLeftColor: "#7c3aed", backgroundColor: "#0d0a1a" }]}>
                            <Text style={[s.sectionLabel, { color: "#a78bfa" }]}>ELEMENTAL COUNTER</Text>
                            {weak ? (
                              <View style={s.elemRow}>
                                <View style={s.elemPill}>
                                  <Text style={s.elemTxt}>⚡ {weak}</Text>
                                </View>
                                <Text style={s.sectionBody}>
                                  {weak} techniques disrupt this spirit's corruption. Strike damage +30%.
                                </Text>
                              </View>
                            ) : (
                              <Text style={s.sectionBody}>No elemental weakness — this spirit resists all elemental approaches equally.</Text>
                            )}
                            <Text style={[s.sectionBody, s.fantasyNote]}>
                              ✦ This is a fantasy game mechanic, not a medical claim. Clinical skill and assessment always determine real-world care.
                            </Text>
                          </View>
                        );
                      })()}

                      {/* Interventions */}
                      <View style={[s.section, { borderLeftColor: "#34d399" }]}>
                        <Text style={[s.sectionLabel, { color: "#34d399" }]}>CLINICAL INTERVENTIONS</Text>
                        {e.interventions.map((inv, i) => (
                          <View key={i} style={{ flexDirection: "row", gap: 6, marginBottom: 3 }}>
                            <Text style={{ color: "#34d399", fontSize: 12 }}>✦</Text>
                            <Text style={s.sectionBody}>{inv}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Real-world note */}
                      <View style={[s.section, { borderLeftColor: "#f59e0b", backgroundColor: "#1a1100" }]}>
                        <Text style={[s.sectionLabel, { color: "#f59e0b" }]}>CLINICAL PEARL</Text>
                        <Text style={s.sectionBody}>{e.realWorldNote}</Text>
                      </View>
                    </View>
                  )}
                </Pressable>
              );
            })}

            {/* Undiscovered placeholder rows */}
            {undiscovered > 0 && discoveredEnemies.length > 0 && (
              <View style={s.unknownBlock}>
                <Ionicons name="help-circle-outline" size={18} color="#334155" />
                <Text style={s.unknownTxt}>
                  {undiscovered} spirit{undiscovered !== 1 ? "s" : ""} not yet encountered in Ward Defense.
                </Text>
              </View>
            )}
          </>
        )}

        {tab === "medicines" && (
          <>
            <View style={s.discoveryBanner}>
              <Ionicons name="flask-outline" size={16} color="#a78bfa" />
              <Text style={[s.discoveryTxt, { color: "#a78bfa" }]}>
                Pharmacological reference for all clinical supplies. Collect items from battles and the Apothecary.
              </Text>
            </View>

            {ITEM_COMPENDIUM.map((item) => {
              const open = expanded === item.id;
              const tc   = ITEM_TYPE_COLOR[item.itemType] ?? "#4FD8C4";
              const sc   = SYSTEM_COLOR[item.systemType]   ?? "#D4AF37";
              return (
                <Pressable
                  key={item.id}
                  style={[s.card, { borderColor: tc + "33" }]}
                  onPress={() => setExpanded(open ? null : item.id)}
                >
                  <View style={s.cardHeader}>
                    <View style={[s.iconCircle, { backgroundColor: tc + "20", borderColor: tc + "40" }]}>
                      <Ionicons name="medical" size={18} color={tc} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[s.cardTitle, { color: tc }]}>{item.displayName}</Text>
                      <Text style={s.cardClinical}>{item.realName}</Text>
                    </View>
                    <View style={[s.typePill, { backgroundColor: sc + "18", borderColor: sc + "40" }]}>
                      <Text style={[s.typePillTxt, { color: sc }]}>{item.systemType}</Text>
                    </View>
                    <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color="#64748b" />
                  </View>

                  {!open && (
                    <Text style={s.previewTxt} numberOfLines={1}>{item.realClass}</Text>
                  )}

                  {open && (
                    <View style={s.expanded}>
                      {/* Drug class */}
                      <View style={[s.section, { borderLeftColor: tc }]}>
                        <Text style={[s.sectionLabel, { color: tc }]}>DRUG CLASS</Text>
                        <Text style={s.sectionBody}>{item.realClass}</Text>
                      </View>

                      {/* MOA */}
                      <View style={[s.section, { borderLeftColor: "#a78bfa" }]}>
                        <Text style={[s.sectionLabel, { color: "#a78bfa" }]}>MECHANISM OF ACTION</Text>
                        <Text style={s.sectionBody}>{item.moa}</Text>
                      </View>

                      {/* Clinical use */}
                      <View style={[s.section, { borderLeftColor: "#34d399" }]}>
                        <Text style={[s.sectionLabel, { color: "#34d399" }]}>CLINICAL USE</Text>
                        <Text style={s.sectionBody}>{item.clinicalUse}</Text>
                      </View>

                      {/* Caution */}
                      <View style={[s.section, { borderLeftColor: "#f97316", backgroundColor: "#1a0e0a" }]}>
                        <Text style={[s.sectionLabel, { color: "#f97316" }]}>CAUTIONS</Text>
                        <Text style={s.sectionBody}>{item.caution}</Text>
                      </View>

                      {/* Game connection */}
                      <View style={[s.section, { borderLeftColor: "#60a5fa", backgroundColor: "#050e1a" }]}>
                        <Text style={[s.sectionLabel, { color: "#60a5fa" }]}>IN CLINICA</Text>
                        <Text style={s.sectionBody}>{item.shortEffect}</Text>
                      </View>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: "#060c18" },
  scroll: { padding: 16, gap: 10 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#0f1f38",
  },
  backBtn: {
    width: 34, height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1,
    borderColor: "#1e3a5f",
    alignItems: "center",
    justifyContent: "center",
  },
  title:    { color: "#f0f9ff", fontSize: 17, fontWeight: "800" },
  subtitle: { color: "#64748b", fontSize: 11, marginTop: 1 },
  emblem: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: "#0f1f38",
    borderWidth: 1,
    borderColor: "#1e3a5f",
    alignItems: "center",
    justifyContent: "center",
  },

  tabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#0f1f38",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#0a1628",
    borderWidth: 1,
    borderColor: "#1e3a5f",
  },
  tabActive: {
    backgroundColor: "#0e2a4a",
    borderColor: "#3b82f6",
  },
  tabTxt:       { color: "#64748b", fontSize: 13, fontWeight: "700" },
  tabTxtActive: { color: "#f0f9ff" },

  discoveryBanner: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: "#0a1628",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1e3a5f",
  },
  discoveryTxt: { color: "#60a5fa", fontSize: 12, lineHeight: 18, flex: 1 },

  emptyState: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 48,
  },
  emptyTitle: { color: "#94a3b8", fontSize: 16, fontWeight: "700" },
  emptyDesc:  { color: "#475569", fontSize: 13, lineHeight: 20, textAlign: "center" },

  card: {
    backgroundColor: "#0a1628",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 42, height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle:   { color: "#f0f9ff", fontSize: 14, fontWeight: "800" },
  cardClinical:{ color: "#94a3b8", fontSize: 11 },

  cueRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  cuePill: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  cueTxt: { fontSize: 11, fontWeight: "600" },

  expanded: { gap: 10 },
  expandedLabel: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.9,
  },

  section: {
    backgroundColor: "#070f1e",
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 2.5,
    gap: 4,
  },
  sectionLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.9 },
  sectionBody:  { color: "#94a3b8", fontSize: 12, lineHeight: 18 },

  typePill: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  typePillTxt: { fontSize: 10, fontWeight: "700" },
  previewTxt:  { color: "#64748b", fontSize: 11, paddingLeft: 2 },

  unknownBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#070f1e",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1e3a5f",
  },
  unknownTxt: { color: "#334155", fontSize: 12 },

  // Push 2 — Corruption Aspect badge
  aspectRow: { marginBottom: 4 },
  aspectBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#1a1030",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#7c3aed",
    paddingHorizontal: 8,
    paddingVertical: 2,
    color: "#a78bfa",
    fontSize: 11,
    fontWeight: "700",
  },

  // Push 2 — Clinical Domain pills
  domainRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 4 },
  domainPill: { borderRadius: 5, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  domainTxt: { fontSize: 11, fontWeight: "600" },

  // Push 2 — Elemental Counter row
  elemRow: { gap: 6, marginBottom: 4 },
  elemPill: {
    alignSelf: "flex-start",
    backgroundColor: "#1a1030",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#7c3aed",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  elemTxt: { color: "#a78bfa", fontSize: 11, fontWeight: "700" },
  fantasyNote: { fontStyle: "italic", color: "#64748b", fontSize: 11, marginTop: 4 },
});
