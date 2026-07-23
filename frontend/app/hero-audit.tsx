/**
 * Dev-Only Hero Visual Audit Screen
 *
 * Lists every hero with portrait + battle-sprite previews, status badges,
 * and filter controls. Only accessible by navigating directly to /hero-audit.
 * Production builds show a simple "not available" screen (never 404s).
 *
 * Access via ROUTES.heroAudit ("/hero-audit").
 */

import { Image as ExpoImage } from "expo-image";
import { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { HEROES } from "@/src/game/content";
import { LAUNCH_ROSTER, FAMILY_COLORS, RARITY_LABELS } from "@/src/game/heroRoster";
import { COLORS } from "@/src/theme/colors";
import { getHeroSprite, hasHeroSprite } from "@/src/components/HeroSprites";
import { getHeroBattleSprite } from "@/src/components/HeroBattleSprites";

// ── Static data ──────────────────────────────────────────────────────────────

const ORIGINAL_10_IDS = new Set([
  "novice_guardian", "night_watcher", "apprentice_seer", "junior_warden",
  "data_acolyte", "village_caretaker", "storm_runner", "infection_warden",
  "wound_sage", "mindkeeper",
]);

const PROLOGUE_IDS = new Set([
  "prologue_nightingale", "prologue_fleming", "former_self",
]);

// Build the unified audit list from all known hero sources.
function buildAuditList() {
  const entries: AuditEntry[] = [];
  const seen = new Set<string>();

  // 1. Prologue special heroes (former_self, prologue_nightingale, prologue_fleming)
  const prologueSpecial = [
    { id: "former_self", name: "The Prodigy", family: null, rarity: "—", role: "Scripted", status: "prologue" as const },
    { id: "prologue_nightingale", name: "Florence Nightingale", family: null, rarity: "Legendary", role: "Stabilizer", status: "prologue" as const },
    { id: "prologue_fleming", name: "Alexander Fleming", family: null, rarity: "Legendary", role: "Educator", status: "prologue" as const },
  ];
  for (const p of prologueSpecial) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    entries.push(p);
  }

  // 2. HEROES (original 10 from content.ts — includes prologue loaners already added above)
  for (const h of HEROES) {
    if (seen.has(h.id)) continue;
    seen.add(h.id);
    entries.push({
      id: h.id,
      name: h.name,
      family: null,
      rarity: h.rarity === 5 ? "Legendary" : h.rarity === 4 ? "Epic" : h.rarity === 3 ? "Rare" : "Common",
      role: h.role ?? "Unknown",
      status: ORIGINAL_10_IDS.has(h.id) ? "original10" as const : "permanent" as const,
    });
  }

  // 3. Full gacha LAUNCH_ROSTER
  for (const r of LAUNCH_ROSTER) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    entries.push({
      id: r.id,
      name: r.name,
      family: r.family,
      rarity: RARITY_LABELS[r.rarityTier] ?? r.rarityTier,
      role: r.role,
      status: "permanent" as const,
    });
  }

  // 4. florence_nightingale (locked legendary permanent)
  if (!seen.has("florence_nightingale")) {
    entries.push({
      id: "florence_nightingale",
      name: "Florence Nightingale",
      family: null,
      rarity: "Legendary",
      role: "Stabilizer",
      status: "locked" as const,
    });
  }

  return entries;
}

type AuditStatus = "original10" | "prologue" | "locked" | "permanent";

interface AuditEntry {
  id: string;
  name: string;
  family: string | null;
  rarity: string;
  role: string;
  status: AuditStatus;
}

type Filter = "all" | "missing_sprite" | "missing_portrait" | "original10" | "prologue" | "fallback_active";

const STATUS_COLORS: Record<AuditStatus, string> = {
  original10: "#F5C542",
  prologue:   "#C792EA",
  locked:     "#FF5252",
  permanent:  "#37D399",
};

const STATUS_LABELS: Record<AuditStatus, string> = {
  original10: "Original 10",
  prologue:   "Prologue",
  locked:     "Locked",
  permanent:  "Permanent",
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",             label: "All" },
  { key: "missing_sprite",  label: "Missing Sprite" },
  { key: "missing_portrait",label: "Missing Portrait" },
  { key: "original10",      label: "Original 10" },
  { key: "prologue",        label: "Prologue" },
  { key: "fallback_active", label: "Fallback Active" },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function HeroAuditScreen() {
  if (!__DEV__) {
    return (
      <SafeAreaView style={styles.notAvail}>
        <Text style={styles.notAvailText}>Hero audit is only available in development builds.</Text>
      </SafeAreaView>
    );
  }

  return <HeroAuditContent />;
}

function HeroAuditContent() {
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const allEntries = useMemo(() => buildAuditList(), []);

  const filtered = useMemo(() => {
    return allEntries.filter((e) => {
      const hasPortrait = hasHeroSprite(e.id);
      const hasBattleSprite = getHeroBattleSprite(e.id) !== null;
      const fallbackActive = !hasPortrait || !hasBattleSprite;
      switch (activeFilter) {
        case "missing_sprite":   return !hasBattleSprite;
        case "missing_portrait": return !hasPortrait;
        case "original10":       return e.status === "original10";
        case "prologue":         return PROLOGUE_IDS.has(e.id);
        case "fallback_active":  return fallbackActive;
        default: return true;
      }
    });
  }, [allEntries, activeFilter]);

  const missingCount = useMemo(() => {
    let sprite = 0; let portrait = 0;
    for (const e of allEntries) {
      if (!hasHeroSprite(e.id)) portrait++;
      if (getHeroBattleSprite(e.id) === null) sprite++;
    }
    return { sprite, portrait };
  }, [allEntries]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Hero Visual Audit</Text>
        <Text style={styles.subtitle}>
          {allEntries.length} heroes · {missingCount.sprite} missing sprite · {missingCount.portrait} missing portrait
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterBarContent}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
            onPress={() => setActiveFilter(f.key)}
          >
            <Text style={[styles.filterLabel, activeFilter === f.key && styles.filterLabelActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.countLabel}>{filtered.length} shown</Text>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.grid}>
        {filtered.map((entry) => (
          <HeroAuditCard key={entry.id} entry={entry} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function HeroAuditCard({ entry }: { entry: AuditEntry }) {
  const portrait = getHeroSprite(entry.id);
  const battleSprite = getHeroBattleSprite(entry.id);
  const hasPortrait = hasHeroSprite(entry.id);
  const hasBattleSprite = battleSprite !== null;
  const fallbackActive = !hasPortrait || !hasBattleSprite;

  const familyColor = entry.family ? (FAMILY_COLORS as Record<string, string>)[entry.family] ?? COLORS.brand : COLORS.brand;
  const statusColor = STATUS_COLORS[entry.status];

  const overallBadge = !hasPortrait && !hasBattleSprite
    ? { label: "MISSING BOTH", color: "#FF2222" }
    : !hasBattleSprite
    ? { label: "MISSING SPRITE", color: "#FF7043" }
    : !hasPortrait
    ? { label: "MISSING PORTRAIT", color: "#F5C542" }
    : { label: "OK", color: "#37D399" };

  return (
    <View style={[styles.card, fallbackActive && styles.cardWarning]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardName, { color: familyColor }]} numberOfLines={1}>{entry.name}</Text>
        <View style={[styles.badge, { backgroundColor: overallBadge.color + "22", borderColor: overallBadge.color }]}>
          <Text style={[styles.badgeText, { color: overallBadge.color }]}>{overallBadge.label}</Text>
        </View>
      </View>

      <Text style={styles.cardId} numberOfLines={1}>{entry.id}</Text>

      <View style={styles.previewRow}>
        <View style={styles.previewSlot}>
          <Text style={styles.previewLabel}>Portrait</Text>
          {hasPortrait && portrait ? (
            <ExpoImage source={portrait} style={styles.portraitImg} contentFit="contain" />
          ) : (
            <View style={[styles.fallbackBox, { borderColor: familyColor }]}>
              <Text style={[styles.fallbackInitial, { color: familyColor }]}>{entry.name[0]}</Text>
              <Text style={styles.fallbackMissing}>MISSING</Text>
            </View>
          )}
        </View>

        <View style={styles.previewSlot}>
          <Text style={styles.previewLabel}>Battle Sprite</Text>
          {hasBattleSprite && battleSprite ? (
            <ExpoImage source={battleSprite} style={styles.spriteImg} contentFit="contain" />
          ) : (
            <View style={[styles.fallbackBox, { borderColor: familyColor }]}>
              <Text style={[styles.fallbackInitial, { color: familyColor }]}>{entry.name[0]}</Text>
              <Text style={styles.fallbackMissing}>MISSING</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={[styles.metaBadge, { backgroundColor: statusColor + "22", borderColor: statusColor }]}>
          <Text style={[styles.metaText, { color: statusColor }]}>{STATUS_LABELS[entry.status]}</Text>
        </View>
        {entry.family && (
          <View style={[styles.metaBadge, { backgroundColor: familyColor + "22", borderColor: familyColor }]}>
            <Text style={[styles.metaText, { color: familyColor }]}>{entry.family}</Text>
          </View>
        )}
        <View style={styles.metaBadge}>
          <Text style={styles.metaText}>{entry.rarity} · {entry.role}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  notAvail: { flex: 1, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", padding: 32 },
  notAvailText: { color: COLORS.onSurfaceSecondary, fontSize: 16, textAlign: "center" },

  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { color: COLORS.onSurface, fontSize: 20, fontWeight: "800", letterSpacing: 0.5 },
  subtitle: { color: COLORS.onSurfaceSecondary, fontSize: 13, marginTop: 2 },

  filterBar: { maxHeight: 44 },
  filterBarContent: { paddingHorizontal: 12, gap: 8, alignItems: "center", flexDirection: "row" },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.brand + "22", borderColor: COLORS.brand },
  filterLabel: { color: COLORS.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
  filterLabelActive: { color: COLORS.brand },

  countLabel: { color: COLORS.onSurfaceTertiary, fontSize: 12, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },

  scroll: { flex: 1 },
  grid: { padding: 12, gap: 12 },

  card: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: COLORS.border, gap: 8,
  },
  cardWarning: { borderColor: "#FF7043" + "66" },

  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardName: { fontSize: 15, fontWeight: "800", flex: 1, marginRight: 8 },

  badge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },

  cardId: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontFamily: "monospace" },

  previewRow: { flexDirection: "row", gap: 12 },
  previewSlot: { flex: 1, alignItems: "center", gap: 4 },
  previewLabel: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  portraitImg: { width: "100%", aspectRatio: 1, borderRadius: 8, backgroundColor: COLORS.surface },
  spriteImg: { width: "100%", aspectRatio: 1, borderRadius: 8, backgroundColor: COLORS.surface },

  fallbackBox: {
    width: "100%", aspectRatio: 1, borderRadius: 8, borderWidth: 2,
    backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", gap: 4,
  },
  fallbackInitial: { fontSize: 28, fontWeight: "900" },
  fallbackMissing: { fontSize: 10, fontWeight: "800", color: "#FF7043", letterSpacing: 0.5 },

  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  metaText: { color: COLORS.onSurfaceSecondary, fontSize: 11, fontWeight: "700" },
});
