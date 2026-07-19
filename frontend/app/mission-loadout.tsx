/**
 * /mission-loadout — Pre-mission team & item preparation screen
 *
 * V11 visual redesign: donghua / anime fantasy-medical RPG aesthetic.
 *   · Illustrated chapter BG watermark behind the header banner
 *   · Node-type PNG emblem with RPG corner-bracket frame
 *   · Three always-visible item loadout slots (tap to deselect)
 *   · Hero portrait cards with role-color glow + deployment badge
 *   · Item cards with element-system badge + RPG corner marks
 *   · Luminous "Deploy to Ward" CTA with chapter accent
 *
 * Reached from MissionPopupModal "Prepare Team" for battle/mini_boss/ward_defense nodes.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getHeroSprite } from "@/src/components/HeroSprites";
import { getLoadoutItems } from "@/src/game/loadoutStore";
import { HEROES } from "@/src/game/content";
import { SKILL_CLINICAL } from "@/src/game/clinical";
import { rarityColor } from "@/src/game/gacha";
import { ITEMS } from "@/src/game/items";
import { usePlayer } from "@/src/game/store";
import type { Hero } from "@/src/game/types";
import { RADIUS, SPACING } from "@/src/theme/colors";
import { UI } from "@/src/theme/ui";

// ── Chapter background thumbnails ─────────────────────────────────────────────

const CHAPTER_BG: Record<number, ReturnType<typeof require>> = {
  1: require("@/assets/map-bg/ch1_lotus_sanctuary.png"),
  2: require("@/assets/map-bg/ch2_amber_ward.png"),
  3: require("@/assets/map-bg/ch3_sky_citadel.png"),
  4: require("@/assets/map-bg/ch4_crimson_rush.png"),
  5: require("@/assets/map-bg/ch5_emerald_forest.png"),
};
const CHAPTER_BG_FALLBACK = require("@/assets/map-bg/ch_generic.png");

// ── Rarity label + chain-role helper ─────────────────────────────────────────

const RARITY_LABEL: Record<number, string> = {
  3: "COMMON", 4: "RARE", 5: "LEGENDARY", 6: "MYTHIC", 7: "TRANSCENDENT",
};

function getHeroChainRoles(hero: Hero): string[] {
  const roles = new Set<string>();
  (hero.skills ?? []).forEach((sk) => {
    const clin = SKILL_CLINICAL[sk.id];
    if (clin?.chainRoles) (clin.chainRoles as string[]).forEach((r) => roles.add(r));
  });
  return [...roles].slice(0, 3);
}

// ── Node type illustrated emblem ──────────────────────────────────────────────

const NODE_EMBLEM: Partial<Record<string, ReturnType<typeof require>>> = {
  battle:          require("@/assets/map-nodes/node_ward_shift_gate.png"),
  boss:            require("@/assets/map-nodes/node_trial_corrupted_gate.png"),
  mini_boss:       require("@/assets/map-nodes/node_trial_corrupted_gate.png"),
  ward_defense:    require("@/assets/map-nodes/node_ward_defense.png"),
  challenge:       require("@/assets/map-nodes/node_rapid_triage_assessment_desk.png"),
  chain:           require("@/assets/map-nodes/node_rapid_triage_assessment_desk.png"),
  minigame:        require("@/assets/map-nodes/node_rapid_triage_assessment_desk.png"),
  story:           require("@/assets/map-nodes/node_memory_lotus_shard.png"),
  memory_fragment: require("@/assets/map-nodes/node_memory_lotus_shard.png"),
  lesson:          require("@/assets/map-nodes/node_reflection_lotus_journal.png"),
  reflection:      require("@/assets/map-nodes/node_reflection_lotus_journal.png"),
  reward:          require("@/assets/map-nodes/node_reward_medical_chest.png"),
};

// ── Mission type labels ───────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  battle:          "Ward Shift",
  boss:            "Boss Encounter",
  mini_boss:       "Chapter Trial",
  ward_defense:    "Ward Defense",
  challenge:       "Clinical Challenge",
  story:           "Story Scene",
  memory_fragment: "Memory Fragment",
  lesson:          "Lotus Lesson",
  reflection:      "Reflection",
  reward:          "Reward Node",
  chain:           "Clinical Chain",
  minigame:        "Practice Lab",
  community:       "Community Mission",
  arena:           "Arena Bout",
  realm:           "Sanctuary Task",
  mode_preview:    "Mode Unlock",
};

// ── Role colour + icon maps ───────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  Stabilizer:  "#4FD8C4",
  Assessor:    "#BBA7EA",
  Analyst:     "#A6D8F6",
  Coordinator: "#E8C868",
  Educator:    "#F4A9C4",
  Striker:     "#F97316",
  Defender:    "#6EE7B7",
};
const ROLE_ICON: Record<string, string> = {
  Stabilizer:  "heart",
  Assessor:    "eye",
  Analyst:     "analytics",
  Coordinator: "people",
  Educator:    "school",
  Striker:     "flash",
  Defender:    "shield-checkmark",
};

// ── Element system colour map ─────────────────────────────────────────────────

const SYSTEM_COLOR: Record<string, string> = {
  Air:        "#A6D8F6",
  Energy:     "#E8C868",
  River:      "#4FD8C4",
  Fire:       "#F97316",
  Protection: "#BBA7EA",
  Earth:      "#86EFAC",
  Mind:       "#C4B5FD",
  Universal:  "#D4AF37",
};

// ── Item type colour + icon maps ──────────────────────────────────────────────

const ITEM_TYPE_COLOR: Record<string, string> = {
  Pharmacy:     "#4FD8C4",
  Intervention: "#BBA7EA",
  Safety:       "#E8C868",
  Scout:        "#A6D8F6",
};
const ITEM_TYPE_ICON: Record<string, string> = {
  Pharmacy:     "medical",
  Intervention: "bandage",
  Safety:       "shield-checkmark",
  Scout:        "eye",
};

// ── Decorative section divider ────────────────────────────────────────────────

function SectionDivider({ accent }: { accent: string }) {
  return (
    <View style={div.row}>
      <View style={[div.line, { backgroundColor: accent + "28" }]} />
      <Text style={[div.glyph, { color: accent + "55" }]}>✦</Text>
      <View style={[div.line, { backgroundColor: accent + "28" }]} />
    </View>
  );
}
const div = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", gap: 8 },
  line:  { flex: 1, height: 1 },
  glyph: { fontSize: 10 },
});

// ── Item loadout slot ─────────────────────────────────────────────────────────

function ItemSlot({
  item,
  slotNum,
  accent,
  onRemove,
}: {
  item:      (typeof ITEMS)[0] | null;
  slotNum:   number;
  accent:    string;
  onRemove?: () => void;
}) {
  const color = item ? (ITEM_TYPE_COLOR[item.itemType] ?? UI.teal) : "rgba(255,255,255,0.14)";
  const icon  = item ? (ITEM_TYPE_ICON[item.itemType]  ?? "medical") : null;

  return (
    <Pressable
      style={[
        sl.wrap,
        item
          ? { borderColor: color + "80", backgroundColor: color + "10" }
          : { borderColor: "rgba(255,255,255,0.10)" },
      ]}
      onPress={item ? onRemove : undefined}
      hitSlop={4}
    >
      <View style={[sl.tl, { borderColor: item ? color + "90" : "rgba(255,255,255,0.16)" }]} />
      <View style={[sl.br, { borderColor: item ? color + "90" : "rgba(255,255,255,0.16)" }]} />

      {item ? (
        <>
          <View style={[sl.iconWrap, { backgroundColor: color + "20" }]}>
            <Ionicons name={icon as any} size={15} color={color} />
          </View>
          <Text style={[sl.name, { color }]} numberOfLines={2}>{item.displayName}</Text>
          <Ionicons name="close-circle" size={10} color={color + "70"} />
        </>
      ) : (
        <>
          <Text style={sl.num}>{slotNum}</Text>
          <Text style={sl.empty}>EMPTY</Text>
        </>
      )}
    </Pressable>
  );
}
const sl = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    minHeight: 76,
    position: "relative",
  },
  tl: {
    position: "absolute", top: 4, left: 4,
    width: 7, height: 7,
    borderTopWidth: 1.5, borderLeftWidth: 1.5,
    borderTopLeftRadius: 2,
  },
  br: {
    position: "absolute", bottom: 4, right: 4,
    width: 7, height: 7,
    borderBottomWidth: 1.5, borderRightWidth: 1.5,
    borderBottomRightRadius: 2,
  },
  iconWrap: {
    width: 28, height: 28,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 16,
  },
  num: {
    color: "rgba(255,255,255,0.22)",
    fontSize: 20,
    fontWeight: "200",
    lineHeight: 24,
  },
  empty: {
    color: "rgba(255,255,255,0.18)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});

// ── Hero deployment card ───────────────────────────────────────────────────────

function HeroCard({
  heroId,
  selected,
  onSelect,
  locked = false,
}: {
  heroId:    string;
  selected:  boolean;
  onSelect?: () => void;
  locked?:   boolean;
}) {
  const hero       = HEROES.find((h) => h.id === heroId);
  const sprite     = getHeroSprite(heroId);
  if (!hero) return null;

  const rc         = ROLE_COLOR[hero.role] ?? UI.teal;
  const ri         = ROLE_ICON[hero.role]  ?? "star";
  const rColor     = rarityColor(hero.rarity);
  const rLabel     = RARITY_LABEL[hero.rarity] ?? "COMMON";
  const sysCo      = SYSTEM_COLOR[hero.element] ?? UI.gold;
  const chainRoles = getHeroChainRoles(hero);

  return (
    <Pressable
      style={[
        hc.card,
        selected && !locked && { borderColor: rc + "90", backgroundColor: rc + "0D" },
        locked && { borderColor: UI.gold + "40", backgroundColor: UI.gold + "06" },
      ]}
      onPress={!locked ? onSelect : undefined}
    >
      <View style={[hc.tl, { borderColor: locked ? UI.gold + "50" : selected ? rc + "80" : "rgba(255,255,255,0.10)" }]} />
      <View style={[hc.br, { borderColor: locked ? UI.gold + "50" : selected ? rc + "80" : "rgba(255,255,255,0.10)" }]} />

      {/* Portrait */}
      <View style={[hc.portrait, { borderColor: locked ? UI.gold + "70" : selected ? rc + "AA" : rColor + "50" }]}>
        {sprite ? (
          <Image source={sprite} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        ) : (
          <View style={[hc.fallback, { backgroundColor: rc + "1E" }]}>
            <Ionicons name={ri as any} size={26} color={rc} />
          </View>
        )}
        {locked ? (
          <View style={[hc.badge, { backgroundColor: UI.gold }]}>
            <Ionicons name="lock-closed" size={8} color="#0B1020" />
          </View>
        ) : selected ? (
          <View style={[hc.badge, { backgroundColor: rc }]}>
            <Ionicons name="checkmark" size={9} color="#000" />
          </View>
        ) : null}
      </View>

      {/* Rarity stars */}
      <Text style={[hc.rarity, { color: rColor }]} numberOfLines={1}>
        {"★".repeat(Math.max(1, hero.rarity - 2))}
        {"  "}
        <Text style={[hc.rarityLabel, { color: rColor + "CC" }]}>{rLabel}</Text>
      </Text>

      {/* Name */}
      <Text style={hc.name} numberOfLines={1}>{hero.name}</Text>

      {/* Role badge */}
      <View style={[hc.role, { backgroundColor: rc + "18", borderColor: rc + "40" }]}>
        <Ionicons name={ri as any} size={8} color={rc} />
        <Text style={[hc.roleTxt, { color: rc }]}>{hero.role}</Text>
      </View>

      {/* Element badge */}
      <View style={[hc.elemBadge, { backgroundColor: sysCo + "14", borderColor: sysCo + "32" }]}>
        <Text style={[hc.elemTxt, { color: sysCo }]}>{hero.element}</Text>
      </View>

      {/* Chain roles */}
      {chainRoles.length > 0 && (
        <View style={hc.chainRow}>
          {chainRoles.map((cr) => (
            <View key={cr} style={hc.chainChip}>
              <Text style={hc.chainTxt}>{cr}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}
const hc = StyleSheet.create({
  card: {
    alignItems: "center",
    gap: 5,
    backgroundColor: UI.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.07)",
    paddingVertical: 12,
    paddingHorizontal: 8,
    flex: 1,
    minWidth: "28%",
    position: "relative",
  },
  tl: {
    position: "absolute", top: 5, left: 5,
    width: 8, height: 8,
    borderTopWidth: 1.5, borderLeftWidth: 1.5,
    borderTopLeftRadius: 3,
  },
  br: {
    position: "absolute", bottom: 5, right: 5,
    width: 8, height: 8,
    borderBottomWidth: 1.5, borderRightWidth: 1.5,
    borderBottomRightRadius: 3,
  },
  portrait: {
    width: 64, height: 64,
    borderRadius: 12,
    borderWidth: 2,
    overflow: "hidden",
    backgroundColor: UI.bgDeep,
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    bottom: -3, right: -3,
    width: 14, height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  rarity: {
    fontSize: 10,
    letterSpacing: 1.5,
    textAlign: "center",
    marginTop: -1,
  },
  rarityLabel: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  name: {
    color: UI.text,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  role: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  roleTxt: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  elemBadge: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  elemTxt: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  chainRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
    justifyContent: "center",
  },
  chainChip: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  chainTxt: {
    color: UI.textDim,
    fontSize: 9,
    fontWeight: "600",
  },
});

// ── Item card ──────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  qty,
  selected,
  disabled,
  onToggle,
}: {
  item:     (typeof ITEMS)[0];
  qty:      number;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const tc = ITEM_TYPE_COLOR[item.itemType] ?? UI.teal;
  const ti = ITEM_TYPE_ICON[item.itemType]  ?? "medical";
  const sc = SYSTEM_COLOR[item.systemType]  ?? UI.gold;

  return (
    <Pressable
      style={[
        ic.card,
        selected && { borderColor: tc + "90", backgroundColor: tc + "0A" },
        disabled && !selected && { opacity: 0.35 },
      ]}
      onPress={!disabled || selected ? onToggle : undefined}
    >
      <View style={[ic.tl, { borderColor: selected ? tc + "80" : "rgba(255,255,255,0.08)" }]} />
      <View style={[ic.br, { borderColor: selected ? tc + "80" : "rgba(255,255,255,0.08)" }]} />

      <View style={ic.topRow}>
        <View style={[ic.iconWrap, { backgroundColor: tc + "18", borderColor: tc + "35" }]}>
          <Ionicons name={ti as any} size={18} color={tc} />
        </View>
        {selected && (
          <View style={[ic.check, { backgroundColor: tc }]}>
            <Ionicons name="checkmark" size={9} color="#000" />
          </View>
        )}
      </View>

      <Text style={ic.name} numberOfLines={2}>{item.displayName}</Text>

      <Text style={[ic.subtitle, { color: sc + "C0" }]} numberOfLines={1}>
        {item.rpgSubtitle}
      </Text>

      <Text style={ic.effect} numberOfLines={2}>{item.shortEffect}</Text>

      <View style={ic.footer}>
        <View style={[ic.sysBadge, { backgroundColor: sc + "18", borderColor: sc + "40" }]}>
          <Text style={[ic.sysTxt, { color: sc }]}>{item.systemType}</Text>
        </View>
        <Text style={[ic.qty, { color: tc }]}>×{qty}</Text>
      </View>
    </Pressable>
  );
}
const ic = StyleSheet.create({
  card: {
    width: "47%",
    backgroundColor: UI.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 11,
    gap: 5,
    position: "relative",
  },
  tl: {
    position: "absolute", top: 5, left: 5,
    width: 8, height: 8,
    borderTopWidth: 1.5, borderLeftWidth: 1.5,
    borderTopLeftRadius: 2,
  },
  br: {
    position: "absolute", bottom: 5, right: 5,
    width: 8, height: 8,
    borderBottomWidth: 1.5, borderRightWidth: 1.5,
    borderBottomRightRadius: 2,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 2,
  },
  iconWrap: {
    width: 36, height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  check: {
    width: 18, height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    color: UI.text,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  effect: {
    color: UI.textDim,
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  sysBadge: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  sysTxt: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  qty: {
    fontSize: 11,
    fontWeight: "800",
  },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function MissionLoadoutScreen() {
  const router = useRouter();
  const { player, loading } = usePlayer();

  const {
    title         = "Mission",
    missionRoute  = "",
    enemyId       = "",
    partType      = "battle",
    chapterAccent = UI.gold,
    chapterNumber = "1",
    tutorial      = "",
  } = useLocalSearchParams<{
    partId:        string;
    title:         string;
    missionRoute:  string;
    enemyId:       string;
    partType:      string;
    chapterAccent: string;
    chapterNumber: string;
    tutorial:      string;
  }>();

  const isTutorial = tutorial === "1";

  const accent  = String(chapterAccent);
  const chNum   = Number(chapterNumber) || 1;
  const typeLbl = TYPE_LABEL[String(partType)] ?? String(partType).replace(/_/g, " ").toUpperCase();
  const nodeImg = NODE_EMBLEM[String(partType)] ?? NODE_EMBLEM["battle"]!;
  const bgImg   = CHAPTER_BG[chNum] ?? CHAPTER_BG_FALLBACK;

  const [selectedItems, setSelectedItems] = useState<string[]>(() => getLoadoutItems());

  useFocusEffect(useCallback(() => {
    setSelectedItems(getLoadoutItems());
  }, []));

  if (loading || !player) {
    return (
      <SafeAreaView style={s.root} edges={["top", "bottom"]}>
        <View style={s.center}>
          <Ionicons name="hourglass-outline" size={32} color={accent} />
          <Text style={s.loadingTxt}>Assembling your team...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const inventory  = player.inventory ?? {};
  const ownedItems = ITEMS.filter((it) => (inventory[it.name] ?? 0) > 0);
  const activeTeam = player.active_team ?? [];

  const handleStart = () => {
    if (isTutorial) {
      // Tutorial mode — always replace into battle with prologue+training flags so
      // the guided Ward Shift scripted sequence runs correctly.
      router.replace({ pathname: "/battle" as any, params: { enemyId: String(enemyId || "dehydration_wisp"), training: "1", prologue: "tutorial" } });
    } else if (enemyId) {
      // Battle node with a specific enemy — push with typed params to avoid
      // URL-encoding issues when enemyId was separated from the route string.
      router.push({ pathname: "/battle" as any, params: { enemyId: String(enemyId) } });
    } else if (missionRoute) {
      router.push(missionRoute as any);
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView style={s.root} edges={["top", "bottom"]}>

      {/* ── Illustrated header banner ────────────────────────────────────────── */}
      <View style={s.banner}>
        {/* Chapter BG watermark */}
        <Image source={bgImg} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        {/* Dark readability gradient */}
        <LinearGradient
          colors={["rgba(8,6,18,0.52)", "rgba(8,6,18,0.90)"]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          pointerEvents="none"
        />
        {/* Chapter accent colour wash */}
        <View
          style={[StyleSheet.absoluteFillObject, { backgroundColor: accent + "12" }]}
          pointerEvents="none"
        />

        {/* Back button */}
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.65)" />
        </Pressable>

        {/* Mission identity row */}
        <View style={s.missionRow}>
          {/* Node-type illustrated emblem with RPG bracket frame */}
          <View style={[s.emblem, { borderColor: accent + "65" }]}>
            <View style={[s.emblemTL, { borderColor: accent + "90" }]} />
            <View style={[s.emblemBR, { borderColor: accent + "90" }]} />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: accent + "16", borderRadius: 13 }]} />
            <Image source={nodeImg} style={{ width: 54, height: 54 }} contentFit="contain" />
          </View>

          {/* Title stack */}
          <View style={{ flex: 1, gap: 5 }}>
            <View style={[s.typeBadge, { backgroundColor: accent + "1C", borderColor: accent + "55" }]}>
              <Text style={[s.typeTxt, { color: accent }]}>
                {typeLbl.toUpperCase()}
              </Text>
            </View>
            <Text style={s.missionTitle} numberOfLines={2}>{title}</Text>
            <Text style={s.chapterLabel}>Chapter {chNum} · Mission Briefing</Text>
          </View>
        </View>

        {/* Item loadout slot rack — always visible at top */}
        <View style={s.rack}>
          <View style={s.rackTitleRow}>
            <View style={[s.rackRule, { backgroundColor: accent + "40" }]} />
            <Text style={[s.rackLabel, { color: accent + "A0" }]}>ITEM LOADOUT</Text>
            <View style={[s.rackRule, { backgroundColor: accent + "40" }]} />
          </View>
          <View style={s.slotRow}>
            {[0, 1, 2].map((i) => {
              const item = selectedItems[i]
                ? (ITEMS.find((it) => it.id === selectedItems[i]) ?? null)
                : null;
              return (
                <ItemSlot
                  key={i}
                  item={item}
                  slotNum={i + 1}
                  accent={accent}
                  onRemove={() => {
                    const id = selectedItems[i];
                    if (id) setSelectedItems((prev) => prev.filter((x) => x !== id));
                  }}
                />
              );
            })}
          </View>
        </View>
      </View>

      {/* ── Scroll body ──────────────────────────────────────────────────────── */}
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Healer Formation ─────────────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={[s.pip, { backgroundColor: UI.teal }]} />
            <Text style={s.sectionTitle}>Healer Formation</Text>
            {isTutorial && (
              <View style={[s.lockChip, { borderColor: UI.gold + "60", backgroundColor: UI.gold + "14" }]}>
                <Ionicons name="lock-closed" size={9} color={UI.gold} />
                <Text style={[s.lockChipTxt, { color: UI.gold }]}>TRAINING</Text>
              </View>
            )}
          </View>

          {isTutorial ? (
            <>
              <Text style={s.sectionDesc}>
                These loaner healers guide you through your first shift. Recruit your own team after the tutorial.
              </Text>
              <View style={s.heroRow}>
                {["novice_guardian", "village_caretaker"].map((id) => (
                  <HeroCard key={id} heroId={id} selected locked />
                ))}
                <View style={{ flex: 1 }} />
              </View>
            </>
          ) : activeTeam.length > 0 ? (
            <>
              <View style={s.heroRow}>
                {activeTeam.slice(0, 3).map((heroId) => (
                  <HeroCard key={heroId} heroId={heroId} selected onSelect={() => {}} />
                ))}
              </View>
              <Pressable
                style={[s.editBtn, { borderColor: UI.teal + "50" }]}
                onPress={() => router.push("/hero-select" as any)}
              >
                <Ionicons name="create-outline" size={13} color={UI.teal} />
                <Text style={[s.editBtnTxt, { color: UI.teal }]}>Edit Formation</Text>
                <Ionicons name="chevron-forward" size={13} color={UI.teal} />
              </Pressable>
            </>
          ) : (
            <Pressable
              style={[s.navCard, s.emptyNavCard]}
              onPress={() => router.push("/summon" as any)}
            >
              <Ionicons name="people-outline" size={20} color={UI.textDim} />
              <Text style={s.emptyNavTxt}>No heroes recruited — Go to Summoning Hall</Text>
              <Ionicons name="chevron-forward" size={13} color={UI.textDim} />
            </Pressable>
          )}
        </View>

        <SectionDivider accent={accent} />

        {/* ── Clinical Supplies ─────────────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={[s.pip, { backgroundColor: accent }]} />
            <Text style={s.sectionTitle}>Clinical Supplies</Text>
            <View style={[s.countPill, { borderColor: accent + "50" }]}>
              <Text style={[s.countTxt, { color: accent }]}>
                {selectedItems.length}/3
              </Text>
            </View>
          </View>
          {isTutorial ? (
            <View style={[s.tutorialNotice, { borderColor: UI.gold + "30", backgroundColor: UI.gold + "0A" }]}>
              <Ionicons name="lock-closed" size={14} color={UI.gold} />
              <Text style={[s.tutorialNoticeTxt, { color: UI.gold + "CC" }]}>
                Items are not available in Training Mode. You'll unlock your clinical bag after recruiting your first hero.
              </Text>
            </View>
          ) : (
            <>
          <Text style={s.sectionDesc}>
            Select up to 3 disposable items. Tap the slots above to remove.
          </Text>

          <View style={s.navCard}>
            <View style={s.navCardInfo}>
              {selectedItems.length === 0 ? (
                <Text style={s.emptyNavTxt}>No items selected</Text>
              ) : (
                selectedItems.map((id) => {
                  const item = ITEMS.find((it) => it.id === id);
                  if (!item) return null;
                  return (
                    <View key={id} style={s.heroChip}>
                      <Ionicons name="medical" size={11} color={accent} />
                      <Text style={[s.heroChipTxt, { color: accent }]} numberOfLines={1}>
                        {item.displayName}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
            <Pressable
              style={[s.navBtn, { borderColor: accent + "60" }]}
              onPress={() => router.push("/item-bag" as any)}
            >
              <Text style={[s.navBtnTxt, { color: accent }]}>Browse Bag</Text>
              <Ionicons name="chevron-forward" size={13} color={accent} />
            </Pressable>
          </View>

          {ownedItems.length === 0 && (
            <View style={s.empty}>
              <Ionicons name="medkit-outline" size={24} color={UI.textDim} />
              <Text style={s.emptyTxt}>
                No items in inventory — win battles or visit the Apothecary.
              </Text>
            </View>
          )}
            </>
          )}
        </View>

        {/* ── Tip ─────────────────────────────────────────────────────────── */}
        <View style={s.tip}>
          <Ionicons name="information-circle-outline" size={14} color={UI.textDim} />
          <Text style={s.tipTxt}>
            Items are consumed when used in battle. Your selections here determine what's available as in-battle actions — you still choose when to use them.
          </Text>
        </View>

      </ScrollView>

      {/* ── Footer CTA ───────────────────────────────────────────────────────── */}
      <View style={s.footer}>
        <Pressable style={s.backFooter} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={16} color={UI.textSoft} />
          <Text style={s.backFooterTxt}>Back</Text>
        </Pressable>
        <Pressable
          style={[s.startBtn, { backgroundColor: isTutorial ? UI.gold : accent }]}
          onPress={handleStart}
        >
          <Ionicons name={isTutorial ? "school-outline" : "shield-checkmark"} size={18} color="#0B1020" />
          <Text style={[s.startBtnTxt, { color: "#0B1020" }]}>{isTutorial ? "Begin Training" : "Deploy to Ward"}</Text>
        </Pressable>
      </View>

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: UI.bgDeep },
  center:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingTxt: { color: UI.textDim, fontSize: 14 },

  // Banner
  banner: {
    overflow: "hidden",
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  backBtn: {
    width: 34, height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },

  // Mission row
  missionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  emblem: {
    width: 76, height: 76,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    flexShrink: 0,
    position: "relative",
    overflow: "hidden",
  },
  emblemTL: {
    position: "absolute", top: 4, left: 4,
    width: 10, height: 10,
    borderTopWidth: 2, borderLeftWidth: 2,
    borderTopLeftRadius: 4,
  },
  emblemBR: {
    position: "absolute", bottom: 4, right: 4,
    width: 10, height: 10,
    borderBottomWidth: 2, borderRightWidth: 2,
    borderBottomRightRadius: 4,
  },
  typeBadge: {
    alignSelf: "flex-start",
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeTxt: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  missionTitle: {
    color: UI.text,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
  },
  chapterLabel: {
    color: UI.textDim,
    fontSize: 11,
  },

  // Slot rack
  rack:         { gap: 8, marginTop: SPACING.xs },
  rackTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rackRule:     { flex: 1, height: 1 },
  rackLabel:    { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  slotRow:      { flexDirection: "row", gap: 8 },

  // Scroll
  scroll: {
    padding: SPACING.md,
    gap: SPACING.lg,
    paddingBottom: 100,
  },

  // Sections
  section:     { gap: SPACING.sm },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  pip:         { width: 4, height: 16, borderRadius: 2 },
  sectionTitle: {
    flex: 1,
    color: UI.text,
    fontSize: 15,
    fontWeight: "700",
  },
  sectionSub: {
    color: UI.textDim,
    fontSize: 11,
  },
  sectionDesc: {
    color: UI.textDim,
    fontSize: 12,
    lineHeight: 17,
    marginTop: -2,
  },
  countPill: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  countTxt: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // Hero row
  heroRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },

  // Item grid
  itemGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    justifyContent: "space-between",
  },

  // Empty state
  empty: {
    alignItems: "center",
    gap: 8,
    paddingVertical: SPACING.lg,
    backgroundColor: UI.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: SPACING.md,
  },
  emptyTxt: {
    color: UI.textDim,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },

  // Nav cards — hero formation + item bag
  navCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: SPACING.sm,
    flexWrap: "wrap",
  },
  navCardInfo: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  navBtnTxt: { fontSize: 12, fontWeight: "700" },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(79,216,196,0.12)",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  heroChipTxt: { color: "#4FD8C4", fontSize: 11, fontWeight: "600", maxWidth: 80 },
  moreTxt:     { color: UI.textDim, fontSize: 11 },
  emptyNavCard: {
    gap: 8,
    justifyContent: "center",
  },
  emptyNavTxt: { color: UI.textDim, fontSize: 12, flex: 1 },

  // Tutorial mode
  lockChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  lockChipTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 4,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editBtnTxt: { fontSize: 12, fontWeight: "700" },
  tutorialNotice: {
    flexDirection: "row",
    gap: SPACING.sm,
    alignItems: "flex-start",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
  },
  tutorialNoticeTxt: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },

  // Tip
  tip: {
    flexDirection: "row",
    gap: SPACING.sm,
    alignItems: "flex-start",
    backgroundColor: UI.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: SPACING.sm,
  },
  tipTxt: {
    flex: 1,
    color: UI.textDim,
    fontSize: 11,
    lineHeight: 16,
  },

  // Footer
  footer: {
    flexDirection: "row",
    gap: SPACING.sm,
    alignItems: "center",
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    backgroundColor: UI.bgDeep,
  },
  backFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: SPACING.sm,
  },
  backFooterTxt: {
    color: UI.textSoft,
    fontSize: 14,
    fontWeight: "600",
  },
  startBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
  },
  startBtnTxt: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
