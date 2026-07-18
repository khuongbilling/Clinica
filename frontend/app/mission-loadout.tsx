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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
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
import { ITEMS } from "@/src/game/items";
import { usePlayer } from "@/src/game/store";
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

// ── Node type illustrated emblem ──────────────────────────────────────────────

const NODE_EMBLEM: Partial<Record<string, ReturnType<typeof require>>> = {
  battle:          require("@/assets/map-nodes/node_ward_shift_gate.png"),
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
    fontSize: 8,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 11,
  },
  num: {
    color: "rgba(255,255,255,0.22)",
    fontSize: 20,
    fontWeight: "200",
    lineHeight: 24,
  },
  empty: {
    color: "rgba(255,255,255,0.18)",
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 1,
  },
});

// ── Hero deployment card ───────────────────────────────────────────────────────

function HeroCard({
  heroId,
  selected,
  onSelect,
}: {
  heroId:   string;
  selected: boolean;
  onSelect: () => void;
}) {
  const hero   = HEROES.find((h) => h.id === heroId);
  const sprite = getHeroSprite(heroId);
  if (!hero) return null;

  const rc = ROLE_COLOR[hero.role] ?? UI.teal;
  const ri = ROLE_ICON[hero.role]  ?? "star";

  return (
    <Pressable
      style={[
        hc.card,
        selected && { borderColor: rc + "90", backgroundColor: rc + "0D" },
      ]}
      onPress={onSelect}
    >
      <View style={[hc.tl, { borderColor: selected ? rc + "80" : "rgba(255,255,255,0.10)" }]} />
      <View style={[hc.br, { borderColor: selected ? rc + "80" : "rgba(255,255,255,0.10)" }]} />

      <View style={[hc.portrait, { borderColor: selected ? rc + "AA" : "rgba(255,255,255,0.14)" }]}>
        {sprite ? (
          <Image source={sprite} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        ) : (
          <View style={[hc.fallback, { backgroundColor: rc + "1E" }]}>
            <Ionicons name={ri as any} size={26} color={rc} />
          </View>
        )}
        {selected && (
          <View style={[hc.badge, { backgroundColor: rc }]}>
            <Ionicons name="checkmark" size={9} color="#000" />
          </View>
        )}
      </View>

      <Text style={hc.name} numberOfLines={1}>{hero.name}</Text>

      <View style={[hc.role, { backgroundColor: rc + "18", borderColor: rc + "40" }]}>
        <Ionicons name={ri as any} size={8} color={rc} />
        <Text style={[hc.roleTxt, { color: rc }]}>{hero.role}</Text>
      </View>
    </Pressable>
  );
}
const hc = StyleSheet.create({
  card: {
    alignItems: "center",
    gap: 6,
    backgroundColor: UI.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.07)",
    paddingVertical: 14,
    paddingHorizontal: 10,
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
    width: 60, height: 60,
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
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.5,
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
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  effect: {
    color: UI.textDim,
    fontSize: 10,
    lineHeight: 14,
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
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.4,
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
    partType      = "battle",
    chapterAccent = UI.gold,
    chapterNumber = "1",
  } = useLocalSearchParams<{
    partId:        string;
    title:         string;
    missionRoute:  string;
    partType:      string;
    chapterAccent: string;
    chapterNumber: string;
  }>();

  const accent  = String(chapterAccent);
  const chNum   = Number(chapterNumber) || 1;
  const typeLbl = TYPE_LABEL[String(partType)] ?? String(partType).replace(/_/g, " ").toUpperCase();
  const nodeImg = NODE_EMBLEM[String(partType)] ?? NODE_EMBLEM["battle"]!;
  const bgImg   = CHAPTER_BG[chNum] ?? CHAPTER_BG_FALLBACK;

  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [deployedTeam,  setDeployedTeam]  = useState<string[]>(() =>
    player?.active_team?.slice(0, 3) ?? []
  );

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

  const toggleItem = (id: string) => {
    setSelectedItems((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= 3)  return prev;
      return [...prev, id];
    });
  };

  const toggleHero = (id: string) => {
    setDeployedTeam((prev) =>
      prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]
    );
  };

  const handleStart = () => {
    if (missionRoute) router.push(missionRoute as any);
    else router.back();
  };

  const slotItems = [0, 1, 2].map((i) => {
    const id = selectedItems[i];
    return id ? (ITEMS.find((it) => it.id === id) ?? null) : null;
  });

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
            {slotItems.map((item, i) => (
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
            ))}
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
            <Text style={s.sectionSub}>tap to toggle</Text>
          </View>

          {activeTeam.length > 0 ? (
            <View style={s.heroRow}>
              {activeTeam.map((heroId) => (
                <HeroCard
                  key={heroId}
                  heroId={heroId}
                  selected={deployedTeam.includes(heroId)}
                  onSelect={() => toggleHero(heroId)}
                />
              ))}
            </View>
          ) : (
            <View style={s.empty}>
              <Ionicons name="people-outline" size={28} color={UI.textDim} />
              <Text style={s.emptyTxt}>Recruit heroes in Summoning Hall first</Text>
            </View>
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
          <Text style={s.sectionDesc}>
            Select up to 3 disposable items — tap a slot above to remove
          </Text>

          {ownedItems.length > 0 ? (
            <View style={s.itemGrid}>
              {ownedItems.map((item) => {
                const qty   = inventory[item.name] ?? 0;
                const isSel = selectedItems.includes(item.id);
                const atMax = selectedItems.length >= 3 && !isSel;
                return (
                  <ItemCard
                    key={item.id}
                    item={item}
                    qty={qty}
                    selected={isSel}
                    disabled={atMax}
                    onToggle={() => toggleItem(item.id)}
                  />
                );
              })}
            </View>
          ) : (
            <View style={s.empty}>
              <Ionicons name="medkit-outline" size={28} color={UI.textDim} />
              <Text style={s.emptyTxt}>
                No items in inventory.{"\n"}Win battles or visit the Apothecary to stock up.
              </Text>
            </View>
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
          style={[s.startBtn, { backgroundColor: accent }]}
          onPress={handleStart}
        >
          <Ionicons name="shield-checkmark" size={18} color="#0B1020" />
          <Text style={[s.startBtnTxt, { color: "#0B1020" }]}>Deploy to Ward</Text>
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
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
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
  rackLabel:    { fontSize: 8, fontWeight: "800", letterSpacing: 1.4 },
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
