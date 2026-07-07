import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { goBack } from "@/src/utils/navigation";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ─── Career path data ──────────────────────────────────────────────────────
interface CareerPath {
  id: string;
  title: string;
  icon: string;
  accentColor: string;
  tagline: string;
  roles: string[];
  fantasyLinks: string[];
  clinicaSkills: string[];
  futureBranch: string;
}

const CAREER_PATHS: CareerPath[] = [
  {
    id: "nursing",
    title: "Nursing",
    icon: "heart",
    accentColor: "#34D399",
    tagline: "The backbone of every ward — where healing happens in every moment.",
    roles: ["Bedside RN", "Public Health Nurse", "School Nurse", "Psychiatric Nurse", "Nurse Educator", "Nurse Practitioner", "Nurse Administrator", "Wound Care Nurse", "Correctional Nurse"],
    fantasyLinks: ["Caretaker", "Guardian", "Triage Commander"],
    clinicaSkills: ["Triage & patient prioritization", "Vital sign interpretation", "Care coordination", "Patient assessment"],
    futureBranch: "Specialize in Clinical Care, Community Health, or Leadership as your path unfolds.",
  },
  {
    id: "medicine",
    title: "Medicine & Advanced Practice",
    icon: "flask",
    accentColor: "#5B9BD5",
    tagline: "Diagnose. Treat. Lead from knowledge.",
    roles: ["Physician", "Nurse Practitioner (NP)", "Physician Assistant (PA)", "Specialist Physician"],
    fantasyLinks: ["Guardian", "Seer", "Scholar"],
    clinicaSkills: ["Clinical reasoning", "Differential diagnosis", "Systems-based thinking", "Evidence-based treatment"],
    futureBranch: "Branch into specialty care — emergency medicine, internal medicine, psychiatry, and more.",
  },
  {
    id: "public_health",
    title: "Public Health",
    icon: "earth",
    accentColor: "#22D3EE",
    tagline: "Health is not just one person. It is a whole community.",
    roles: ["Public Health Nurse", "Epidemiologist", "Infection Prevention Specialist", "Disaster Response Coordinator", "Global Health Worker"],
    fantasyLinks: ["Epidemic Warden", "Scholar", "Scout"],
    clinicaSkills: ["Infection control", "Outbreak investigation", "Population-level thinking", "Prevention strategies"],
    futureBranch: "Join the World Event branch — global health crises and pandemic response simulations.",
  },
  {
    id: "mental_health",
    title: "Mental Health Care",
    icon: "sparkles",
    accentColor: "#A78BFA",
    tagline: "Healing minds is healing whole people.",
    roles: ["Psychiatric Nurse", "Counselor", "Psychologist", "Social Worker", "Crisis Care Specialist", "Addiction Counselor"],
    fantasyLinks: ["Mindweaver", "Caretaker", "Seer"],
    clinicaSkills: ["Mental status assessment", "De-escalation", "Therapeutic communication", "Trauma-informed care"],
    futureBranch: "Unlock the Mindweaver specialization and psychiatric nursing simulation cases.",
  },
  {
    id: "pharmacy",
    title: "Pharmacy & Treatment Science",
    icon: "beaker",
    accentColor: "#F97316",
    tagline: "Every treatment starts with knowing what goes inside.",
    roles: ["Pharmacist", "Pharmacologist", "Medication Safety Officer", "Lab Scientist", "Pharmacy Technician"],
    fantasyLinks: ["Alchemist", "Lotus Pharmacist"],
    clinicaSkills: ["Medication safety reasoning", "Drug interactions", "Dosing principles", "Lab value interpretation"],
    futureBranch: "Branch into the Apothecary Market and unlock the Alchemist class tree.",
  },
  {
    id: "education",
    title: "Education & Research",
    icon: "school",
    accentColor: "#F59E0B",
    tagline: "Pass on knowledge. Shape the next generation of healers.",
    roles: ["Nurse Educator", "Simulation Educator", "Researcher", "Professor", "Clinical Instructor"],
    fantasyLinks: ["Scholar", "Grand Archivist"],
    clinicaSkills: ["Teaching clinical reasoning", "Designing learning cases", "Evidence synthesis", "Simulation facilitation"],
    futureBranch: "Unlock the Grand Archivist path and help design new Lotus Lessons for future healers.",
  },
  {
    id: "leadership",
    title: "Leadership & Administration",
    icon: "briefcase",
    accentColor: "#6B7280",
    tagline: "Systems do not run themselves. Someone has to lead.",
    roles: ["Charge Nurse", "Nurse Manager", "Healthcare Administrator", "Quality Improvement Specialist", "Policy Advisor"],
    fantasyLinks: ["Triage Commander", "Ward Strategist"],
    clinicaSkills: ["Resource allocation", "Team coordination", "Quality metrics", "Ward-level decision making"],
    futureBranch: "Advance your Ward Defense command rank and unlock the Triage Commander specialization.",
  },
  {
    id: "innovation",
    title: "Health Innovation & Design",
    icon: "bulb",
    accentColor: "#FBBF24",
    tagline: "The future of healthcare is built by people who care.",
    roles: ["Medical Device Designer", "Health Tech Specialist", "Clinical AI Researcher", "Adaptive Clothing Designer", "Wearable Health Monitor Designer", "Patient Safety Product Designer"],
    fantasyLinks: ["Innovation Alchemist", "Ward Artisan"],
    clinicaSkills: ["Patient safety thinking", "Human-centered design", "Prototyping care tools", "Technology integration"],
    futureBranch: "Unlock the Ward Artisan path — design equipment upgrades and adaptive tools for your Sanctuary.",
  },
];

// ─── Screen ───────────────────────────────────────────────────────────────
export default function CareerExplorerScreen() {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (id: string) => setExpanded((prev) => (prev === id ? null : id));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.hero}>
        <LinearGradient colors={[COLORS.brandTertiary, COLORS.surface]} style={StyleSheet.absoluteFillObject} />
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university")} hitSlop={10} testID="career-explorer-back">
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.kicker}>KNOW YOUR PATH</Text>
        <Text style={styles.title}>Career Explorer</Text>
        <Text style={styles.sub}>
          Healthcare is not one road. It is a field of many callings.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          You were summoned to the ward because you have the potential to heal — but there are many ways a healer can serve the world. Explore the paths below and discover which calling speaks to you.
        </Text>

        {CAREER_PATHS.map((path) => {
          const isOpen = expanded === path.id;
          return (
            <Pressable
              key={path.id}
              style={[styles.card, { borderLeftColor: path.accentColor }, isOpen && styles.cardOpen]}
              onPress={() => toggle(path.id)}
              testID={`career-card-${path.id}`}
            >
              {/* Card header — always visible */}
              <View style={styles.cardHeader}>
                <View style={[styles.iconWrap, { backgroundColor: path.accentColor + "22" }]}>
                  <Ionicons name={path.icon as any} size={20} color={path.accentColor} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.cardTitle}>{path.title}</Text>
                  <Text style={styles.cardTagline}>{path.tagline}</Text>
                </View>
                <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={COLORS.onSurfaceTertiary} />
              </View>

              {/* Expanded detail */}
              {isOpen && (
                <View style={styles.cardBody}>
                  {/* Real-world roles */}
                  <View style={styles.section}>
                    <Text style={styles.sectionLbl}>REAL-WORLD PATHS</Text>
                    <View style={styles.chipRow}>
                      {path.roles.map((role) => (
                        <View key={role} style={styles.chip}>
                          <Text style={styles.chipTxt}>{role}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Fantasy class link */}
                  <View style={styles.section}>
                    <Text style={styles.sectionLbl}>FANTASY CLASS CONNECTION</Text>
                    <View style={styles.chipRow}>
                      {path.fantasyLinks.map((fc) => (
                        <View key={fc} style={[styles.chip, { backgroundColor: path.accentColor + "22", borderColor: path.accentColor + "55" }]}>
                          <Text style={[styles.chipTxt, { color: path.accentColor }]}>{fc}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Clinica skills */}
                  <View style={styles.section}>
                    <Text style={styles.sectionLbl}>SKILLS YOU PRACTICE IN CLINICA</Text>
                    {path.clinicaSkills.map((skill) => (
                      <View key={skill} style={styles.skillRow}>
                        <Ionicons name="checkmark-circle" size={13} color={path.accentColor} />
                        <Text style={styles.skillTxt}>{skill}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Future branch hint */}
                  <View style={[styles.branchHint, { borderColor: path.accentColor + "55" }]}>
                    <Ionicons name="git-branch-outline" size={14} color={path.accentColor} />
                    <Text style={styles.branchTxt}>{path.futureBranch}</Text>
                  </View>
                </View>
              )}
            </Pressable>
          );
        })}

        {/* Footer disclaimer */}
        <View style={styles.footNote}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.footNoteTxt}>
            Career Explorer is an inspiration and exploration tool. It is not career advice, counseling, or academic guidance. Real healthcare careers have their own education paths, licensing requirements, and entry conditions — please speak with a counselor or professional for specific guidance.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  hero: { padding: SPACING.lg, paddingTop: SPACING.xl, gap: 4 },
  backBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)", marginBottom: SPACING.sm,
  },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 26, fontWeight: "300" },
  sub: { color: COLORS.onSurfaceSecondary, fontSize: 13, marginTop: 2, lineHeight: 19 },
  scroll: { padding: SPACING.lg, gap: SPACING.sm, paddingBottom: SPACING.xxxl },
  lead: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 20, marginBottom: SPACING.xs ?? 4 },
  card: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 3,
    overflow: "hidden",
  },
  cardOpen: { borderColor: COLORS.brand + "44" },
  cardHeader: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    padding: SPACING.md,
  },
  iconWrap: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  cardTitle: { color: COLORS.onSurface, fontSize: 15, fontWeight: "700" },
  cardTagline: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 17 },
  cardBody: {
    borderTopWidth: 1, borderTopColor: COLORS.border,
    padding: SPACING.md, gap: SPACING.md,
  },
  section: { gap: 6 },
  sectionLbl: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  chipTxt: { color: COLORS.onSurface, fontSize: 12 },
  skillRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  skillTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, flex: 1 },
  branchHint: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.md,
    borderWidth: 1, padding: SPACING.sm,
  },
  branchTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 18, flex: 1 },
  footNote: { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start", marginTop: SPACING.sm },
  footNoteTxt: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 16 },
});
