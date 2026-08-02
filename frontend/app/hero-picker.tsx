/**
 * /hero-picker — Full-page hero selection for mission loadout.
 *
 * Navigation flow:
 *   mission-loadout taps empty slot →
 *   router.push("/hero-picker", { slot, ownedIds })  →
 *   player browses/previews hero →
 *   "ASSIGN TO SLOT" → setPendingHeroPick({ slot, heroId }) → router.back()  →
 *   mission-loadout useFocusEffect drains pick and updates teamSlots.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getHeroSprite } from "@/src/components/HeroSprites";
import { HEROES } from "@/src/game/content";
import { rarityColor } from "@/src/game/gacha";
import { heroRoleLabel } from "@/src/game/university";
import type { Hero } from "@/src/game/types";
import { setPendingHeroPick } from "@/src/game/loadoutStore";
import { usePlayer } from "@/src/game/store";
import { RADIUS, SPACING } from "@/src/theme/colors";
import { UI } from "@/src/theme/ui";

// ── Role / element color helpers ──────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  Stabilizer:  "#4FD8C4",
  Assessor:    "#BBA7EA",
  Analyst:     "#A6D8F6",
  Coordinator: "#E8C868",
  Educator:    "#F4A9C4",
  Striker:     "#F97316",
  Defender:    "#6EE7B7",
};

const SYSTEM_COLOR: Record<string, string> = {
  Air:        "#A6D8F6",
  Energy:     "#E8C868",
  River:      "#4FD8C4",
  Fire:       "#F97316",
  Protection: "#BBA7EA",
  Earth:      "#86EFAC",
  Mind:       "#C4B5FD",
  Universal:  "#D4AF37",
  Storm:      "#F97316",
  Growth:     "#86EFAC",
};

const RARITY_LABEL: Record<number, string> = {
  3: "COMMON", 4: "RARE", 5: "LEGENDARY", 6: "MYTHIC", 7: "TRANSCENDENT",
};

function rarityStars(r: number): string {
  return "★".repeat(Math.min(r, 6));
}

// Base HP scales with rarity (higher rarity = sturdier healer archetype).
// These are display-only stat values for the picker preview panel.
const RARITY_BASE_HP: Record<number, number> = {
  3: 80, 4: 95, 5: 120, 6: 140, 7: 160,
};

/** Total AP cost to use all of a hero's skills — proxy for "AP" stat. */
function totalSkillAP(hero: Hero): number {
  return (hero.skills ?? []).reduce((sum, sk) => sum + (sk.cost ?? 0), 0);
}

// ── Prologue-loaner hero IDs to exclude from the normal picker ─────────────────
const PROLOGUE_IDS = new Set([
  "prologue_nightingale",
  "prologue_fleming",
  "prologue_former_self",
]);

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HeroPickerScreen() {
  const router = useRouter();
  const { player } = usePlayer();

  const { slot: slotParam, ownedIds: ownedIdsParam, takenSlots: takenSlotsParam } = useLocalSearchParams<{
    slot: string;
    ownedIds: string;
    takenSlots: string;
  }>();

  const slotIndex = Number(slotParam ?? 0);

  // Parse which heroes are already assigned to OTHER slots so we can badge them.
  const heroInOtherSlot: Record<string, number> = (() => {
    if (!takenSlotsParam) return {};
    try {
      const arr: (string | null)[] = JSON.parse(decodeURIComponent(takenSlotsParam));
      const map: Record<string, number> = {};
      arr.forEach((id, idx) => { if (id && idx !== slotIndex) map[id] = idx; });
      return map;
    } catch { return {}; }
  })();

  // Build owned hero list from param or fall back to player.heroes_owned.
  // ownedIdsParam arrives URL-encoded (encodeURIComponent applied in mission-loadout).
  const ownedSet = (() => {
    if (ownedIdsParam) {
      try {
        const decoded = decodeURIComponent(ownedIdsParam);
        return new Set<string>(JSON.parse(decoded));
      } catch {}
    }
    return new Set<string>(player?.heroes_owned ?? []);
  })();

  const ownedHeroes = HEROES.filter(
    (h) => ownedSet.has(h.id) && !PROLOGUE_IDS.has(h.id)
  );

  const [previewId, setPreviewId] = useState<string | null>(
    ownedHeroes[0]?.id ?? null
  );

  const rosterRef = useRef<ScrollView>(null);

  const previewHero = previewId ? HEROES.find((h) => h.id === previewId) : null;
  const previewSprite = previewId ? getHeroSprite(previewId) : undefined;

  const rc    = previewHero ? (ROLE_COLOR[previewHero.role] ?? UI.teal) : UI.teal;
  const sysCo = previewHero ? (SYSTEM_COLOR[previewHero.element] ?? UI.gold) : UI.gold;
  const rarC  = previewHero ? rarityColor(previewHero.rarity) : UI.gold;

  function handleAssign() {
    if (!previewId) return;
    setPendingHeroPick({ slot: slotIndex, heroId: previewId });
    router.back();
  }

  // If owned list changes (player data arrives late), seed the preview.
  useEffect(() => {
    if (!previewId && ownedHeroes.length > 0) {
      setPreviewId(ownedHeroes[0].id);
    }
  }, [ownedHeroes.length]);

  // ── Empty roster ────────────────────────────────────────────────────────────
  if (ownedHeroes.length === 0) {
    return (
      <SafeAreaView style={p.root} edges={["top", "bottom"]}>
        <View style={p.navBar}>
          <Pressable style={p.backBtn} onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color={UI.textSoft} />
          </Pressable>
          <Text style={p.navTitle}>Choose Healer · Slot {slotIndex + 1}</Text>
          <View style={{ width: 34 }} />
        </View>
        <View style={p.emptyRoot}>
          <Ionicons name="people-outline" size={56} color={UI.textDim} />
          <Text style={p.emptyTitle}>No Healers Recruited</Text>
          <Text style={p.emptyBody}>
            Visit the Recruitment Hall to summon your first healer.
          </Text>
          <Pressable style={p.emptyBtn} onPress={() => router.back()}>
            <Text style={p.emptyBtnTxt}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={p.root} edges={["top", "bottom"]}>

      {/* ── Nav bar ─────────────────────────────────────────────────────────── */}
      <View style={p.navBar}>
        <Pressable style={p.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={UI.textSoft} />
        </Pressable>
        <Text style={p.navTitle}>Choose Healer · Slot {slotIndex + 1}</Text>
        <View style={{ width: 34 }} />
      </View>

      {/* ── Portrait panel (top ~50%) ─────────────────────────────────────────── */}
      <View style={p.portraitPanel}>
        {/* Element gradient wash */}
        <LinearGradient
          colors={[sysCo + "22", "transparent"]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          pointerEvents="none"
        />
        {/* Rarity glow ring behind portrait */}
        <View style={[p.rarityRing, { borderColor: rarC + "70", backgroundColor: rarC + "0C" }]}>
          {previewSprite ? (
            <Image
              source={previewSprite}
              style={p.portraitImage}
              contentFit="contain"
            />
          ) : (
            <View style={[p.portraitFallback, { backgroundColor: rc + "18" }]}>
              <Ionicons name="person" size={64} color={rc} />
            </View>
          )}
        </View>

        {/* Hero identity */}
        {previewHero && (
          <View style={p.identity}>
            <Text style={[p.heroName, { color: rc }]} numberOfLines={1}>
              {previewHero.name}
            </Text>
            <Text style={p.heroTitle} numberOfLines={1}>{previewHero.title}</Text>

            {/* Badges row: role + element + rarity */}
            <View style={p.badgeRow}>
              <View style={[p.badge, { backgroundColor: rc + "18", borderColor: rc + "44" }]}>
                <Text style={[p.badgeTxt, { color: rc }]}>{heroRoleLabel(previewHero.role).toUpperCase()}</Text>
              </View>
              <View style={[p.badge, { backgroundColor: sysCo + "14", borderColor: sysCo + "38" }]}>
                <Text style={[p.badgeTxt, { color: sysCo }]}>{previewHero.element.toUpperCase()}</Text>
              </View>
              <View style={[p.badge, { backgroundColor: rarC + "14", borderColor: rarC + "38" }]}>
                <Text style={[p.rarityStars, { color: rarC }]}>
                  {rarityStars(previewHero.rarity)}
                </Text>
                <Text style={[p.badgeTxt, { color: rarC }]}>{RARITY_LABEL[previewHero.rarity] ?? "HERO"}</Text>
              </View>
            </View>

            {/* Base stat row: HP + AP */}
            <View style={p.statRow}>
              <View style={p.statBlock}>
                <Text style={[p.statValue, { color: "#F4A9C4" }]}>
                  {RARITY_BASE_HP[previewHero.rarity] ?? 80}
                </Text>
                <Text style={p.statLabel}>HP</Text>
              </View>
              <View style={p.statDivider} />
              <View style={p.statBlock}>
                <Text style={[p.statValue, { color: UI.gold }]}>
                  {totalSkillAP(previewHero)}
                </Text>
                <Text style={p.statLabel}>AP</Text>
              </View>
              <View style={p.statDivider} />
              <View style={p.statBlock}>
                <Text style={[p.statValue, { color: UI.teal }]}>
                  {previewHero.skills.length}
                </Text>
                <Text style={p.statLabel}>Skills</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* ── Skill list (scrollable, sits between portrait and roster) ─────────── */}
      {previewHero && (
        <ScrollView
          style={p.skillScroll}
          contentContainerStyle={p.skillScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {previewHero.skills.map((sk) => (
            <View key={sk.id} style={p.skillRow}>
              <View style={[p.skillCostBadge, { backgroundColor: rc + "1A" }]}>
                <Text style={[p.skillCostTxt, { color: rc }]}>{sk.cost}</Text>
                <Text style={[p.skillCostLabel, { color: rc + "99" }]}>AP</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[p.skillName, { color: rc }]} numberOfLines={1}>{sk.name}</Text>
                {sk.shortEffect ? (
                  <Text style={p.skillEffect} numberOfLines={2}>{sk.shortEffect}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Roster strip ─────────────────────────────────────────────────────── */}
      <View style={p.rosterSection}>
        <Text style={p.rosterLabel}>YOUR HEALERS</Text>
        <ScrollView
          ref={rosterRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={p.rosterRow}
        >
          {ownedHeroes.map((h) => {
            const spr      = getHeroSprite(h.id);
            const hRc      = ROLE_COLOR[h.role] ?? UI.teal;
            const hRarC    = rarityColor(h.rarity);
            const active   = h.id === previewId;
            const takenIdx = heroInOtherSlot[h.id]; // undefined if not taken
            const isTaken  = takenIdx !== undefined;
            return (
              <Pressable
                key={h.id}
                style={[
                  p.chip,
                  active
                    ? { borderColor: hRarC + "CC", backgroundColor: hRarC + "18" }
                    : isTaken
                    ? { borderColor: "rgba(255,255,255,0.22)", backgroundColor: "rgba(255,255,255,0.04)" }
                    : { borderColor: "rgba(255,255,255,0.12)" },
                ]}
                onPress={() => setPreviewId(h.id)}
                hitSlop={4}
              >
                <View style={[p.chipPortrait, { borderColor: hRc + (active ? "CC" : "44"), opacity: isTaken && !active ? 0.55 : 1 }]}>
                  {spr ? (
                    <Image source={spr} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : (
                    <View style={[p.chipFallback, { backgroundColor: hRc + "1C" }]}>
                      <Ionicons name="person" size={16} color={hRc} />
                    </View>
                  )}
                </View>
                {isTaken && !active ? (
                  <View style={p.chipTakenBadge}>
                    <Text style={p.chipTakenTxt}>S{(takenIdx) + 1}</Text>
                  </View>
                ) : (
                  <Text style={[p.chipName, { color: active ? hRarC : UI.textDim }]} numberOfLines={1}>
                    {h.name.split(" ")[0]}
                  </Text>
                )}
                {active && (
                  <View style={[p.chipActiveDot, { backgroundColor: hRarC }]} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Confirm button ───────────────────────────────────────────────────── */}
      <View style={p.footer}>
        <Pressable
          style={[p.assignBtn, { backgroundColor: previewId ? rc : "rgba(255,255,255,0.10)" }]}
          onPress={handleAssign}
          disabled={!previewId}
        >
          <Ionicons
            name="shield-checkmark"
            size={18}
            color={previewId ? "#0B1020" : UI.textDim}
          />
          <Text style={[p.assignTxt, { color: previewId ? "#0B1020" : UI.textDim }]}>
            ASSIGN TO SLOT {slotIndex + 1}
          </Text>
        </Pressable>
      </View>

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const p = StyleSheet.create({
  root: { flex: 1, backgroundColor: UI.bgDeep },

  // Nav bar
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  backBtn: {
    width: 34, height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    flex: 1,
    textAlign: "center",
    color: UI.textSoft,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Portrait panel
  portraitPanel: {
    alignItems: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    overflow: "hidden",
    minHeight: 300,
    justifyContent: "center",
  },
  rarityRing: {
    width: 180,
    height: 180,
    borderRadius: 20,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  portraitImage: {
    width: "100%",
    height: "100%",
  },
  portraitFallback: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  identity: {
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },

  // HP / AP stat row
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
    backgroundColor: UI.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statBlock: {
    alignItems: "center",
    gap: 2,
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 20,
  },
  statLabel: {
    color: UI.textDim,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  heroName: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  heroTitle: {
    color: UI.textDim,
    fontSize: 12,
    fontStyle: "italic",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 4,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeTxt: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  rarityStars: {
    fontSize: 10,
    letterSpacing: 1,
  },

  // Skill scroll
  skillScroll: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  skillScrollContent: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  skillRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    backgroundColor: UI.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: SPACING.sm,
  },
  skillCostBadge: {
    width: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    flexShrink: 0,
  },
  skillCostTxt: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 18,
  },
  skillCostLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  skillName: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17,
  },
  skillEffect: {
    color: UI.textDim,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },

  // Roster strip
  rosterSection: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: SPACING.sm,
    paddingBottom: 4,
  },
  rosterLabel: {
    color: UI.textDim,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    paddingHorizontal: SPACING.md,
    marginBottom: 6,
  },
  rosterRow: {
    paddingHorizontal: SPACING.md,
    gap: 8,
    flexDirection: "row",
  },
  chip: {
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 6,
    width: 70,
    position: "relative",
  },
  chipPortrait: {
    width: 50,
    height: 50,
    borderRadius: 10,
    borderWidth: 1.5,
    overflow: "hidden",
    backgroundColor: UI.bgDeep,
  },
  chipFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipName: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  chipActiveDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  chipTakenBadge: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  chipTakenTxt: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  // Footer
  footer: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    backgroundColor: UI.bgDeep,
  },
  assignBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
  },
  assignTxt: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // Empty state
  emptyRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
    padding: SPACING.xl,
  },
  emptyTitle: {
    color: UI.text,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyBody: {
    color: UI.textDim,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  emptyBtn: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    marginTop: SPACING.sm,
  },
  emptyBtnTxt: {
    color: UI.textSoft,
    fontSize: 14,
    fontWeight: "600",
  },
});
