/**
 * /mission-loadout — Pre-mission team and item preparation screen
 *
 * Reached from MissionPopupModal "Prepare Team" for battle/mini_boss nodes.
 * Shows:
 *   · Active hero team (visual cards, read-only deploy selection)
 *   · Item loadout grid (max 3 disposable items from owned inventory)
 *   · Start Mission + Back buttons
 */
import { Ionicons } from "@expo/vector-icons";
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

import { HEROES } from "@/src/game/content";
import { ITEMS } from "@/src/game/items";
import { usePlayer } from "@/src/game/store";
import { RADIUS, SPACING } from "@/src/theme/colors";
import { UI } from "@/src/theme/ui";
import { getHeroSprite } from "@/src/components/HeroSprites";
import { Image } from "expo-image";

// ── Hero role icon + colour ────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  Stabilizer:   "#4FD8C4",
  Assessor:     "#BBA7EA",
  Analyst:      "#A6D8F6",
  Coordinator:  "#E8C868",
  Educator:     "#F4A9C4",
  Striker:      "#F97316",
  Defender:     "#6EE7B7",
};

const ROLE_ICON: Record<string, string> = {
  Stabilizer:   "heart",
  Assessor:     "eye",
  Analyst:      "analytics",
  Coordinator:  "people",
  Educator:     "school",
  Striker:      "flash",
  Defender:     "shield-checkmark",
};

// ── Item type colour ──────────────────────────────────────────────────────────

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

// ── Hero card ─────────────────────────────────────────────────────────────────

function HeroCard({ heroId, selected, onSelect }: {
  heroId: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const hero   = HEROES.find((h) => h.id === heroId);
  const sprite = getHeroSprite(heroId);
  if (!hero) return null;

  const roleColor = ROLE_COLOR[hero.role] ?? UI.teal;
  const roleIcon  = ROLE_ICON[hero.role]  ?? "star";

  return (
    <Pressable
      style={[
        hStyles.card,
        selected && { borderColor: roleColor + "80", backgroundColor: roleColor + "12" },
      ]}
      onPress={onSelect}
    >
      {/* Portrait */}
      <View style={[hStyles.portrait, { borderColor: selected ? roleColor : "rgba(255,255,255,0.10)" }]}>
        {sprite ? (
          <Image source={sprite} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        ) : (
          <View style={[hStyles.portraitFallback, { backgroundColor: roleColor + "22" }]}>
            <Ionicons name={roleIcon as any} size={22} color={roleColor} />
          </View>
        )}
        {selected && (
          <View style={[hStyles.selectedBadge, { backgroundColor: roleColor }]}>
            <Ionicons name="checkmark" size={10} color="#000" />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={hStyles.heroName} numberOfLines={1}>{hero.name}</Text>
        <View style={[hStyles.roleBadge, { backgroundColor: roleColor + "1A", borderColor: roleColor + "40" }]}>
          <Ionicons name={roleIcon as any} size={9} color={roleColor} />
          <Text style={[hStyles.roleTxt, { color: roleColor }]}>{hero.role}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const hStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: UI.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 10,
    flex: 1,
    minWidth: "45%",
  },
  portrait: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    overflow: "hidden",
    backgroundColor: UI.bgDeep,
    flexShrink: 0,
  },
  portraitFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  heroName: {
    color: UI.text,
    fontSize: 13,
    fontWeight: "700",
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  roleTxt: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
});

// ── Item card ─────────────────────────────────────────────────────────────────

function ItemCard({ item, qty, selected, disabled, onToggle }: {
  item: (typeof ITEMS)[0];
  qty: number;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const color = ITEM_TYPE_COLOR[item.itemType] ?? UI.teal;
  const icon  = ITEM_TYPE_ICON[item.itemType]  ?? "medical";

  return (
    <Pressable
      style={[
        iStyles.card,
        selected && { borderColor: color + "80", backgroundColor: color + "12" },
        disabled && !selected && { opacity: 0.4 },
      ]}
      onPress={!disabled || selected ? onToggle : undefined}
    >
      {/* Icon */}
      <View style={[iStyles.iconWrap, { backgroundColor: color + "1C", borderColor: color + "40" }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>

      {/* Info */}
      <Text style={iStyles.name} numberOfLines={2}>{item.displayName}</Text>
      <Text style={iStyles.effect} numberOfLines={2}>{item.shortEffect}</Text>

      {/* Qty + selected */}
      <View style={iStyles.footer}>
        <Text style={[iStyles.qty, { color }]}>×{qty}</Text>
        {selected && <Ionicons name="checkmark-circle" size={14} color={color} />}
      </View>
    </Pressable>
  );
}

const iStyles = StyleSheet.create({
  card: {
    width: "47%",
    backgroundColor: UI.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 10,
    gap: 6,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    color: UI.text,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
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

  const accentColor = String(chapterAccent);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [deployedTeam, setDeployedTeam] = useState<string[]>(() =>
    player?.active_team?.slice(0, 3) ?? []
  );

  if (loading || !player) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <Ionicons name="hourglass-outline" size={28} color={accentColor} />
          <Text style={styles.loadingTxt}>Preparing ward...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Build owned item list
  const inventory = player.inventory ?? {};
  const ownedItems = ITEMS.filter((it) => (inventory[it.name] ?? 0) > 0);

  // Team from active_team
  const activeTeam = player.active_team ?? [];

  const toggleItem = (id: string) => {
    setSelectedItems((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, id];
    });
  };

  const toggleHero = (id: string) => {
    setDeployedTeam((prev) => {
      if (prev.includes(id)) return prev.filter((h) => h !== id);
      return [...prev, id];
    });
  };

  const handleStart = () => {
    if (missionRoute) router.push(missionRoute as any);
    else router.back();
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <LinearGradient
          colors={[accentColor + "28", "transparent"]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={UI.textSoft} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: accentColor }]}>
            CH.{chapterNumber} · {partType.replace(/_/g, " ").toUpperCase()}
          </Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        </View>
        {/* Item slot count */}
        <View style={[styles.slotBadge, { borderColor: accentColor + "50" }]}>
          <Ionicons name="medical" size={11} color={accentColor} />
          <Text style={[styles.slotTxt, { color: accentColor }]}>
            {selectedItems.length}/3 items
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Deploy Team ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: UI.teal + "18" }]}>
              <Ionicons name="people" size={14} color={UI.teal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Deploy Team</Text>
              <Text style={styles.sectionSub}>Your active healer squad — tap to toggle deployment</Text>
            </View>
          </View>

          <View style={styles.heroGrid}>
            {activeTeam.length > 0 ? activeTeam.map((heroId) => (
              <HeroCard
                key={heroId}
                heroId={heroId}
                selected={deployedTeam.includes(heroId)}
                onSelect={() => toggleHero(heroId)}
              />
            )) : (
              <View style={styles.emptyHint}>
                <Ionicons name="people-outline" size={24} color={UI.textDim} />
                <Text style={styles.emptyTxt}>Recruit heroes in Summoning Hall first</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Battle Items ────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: accentColor + "18" }]}>
              <Ionicons name="medkit" size={14} color={accentColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Battle Items</Text>
              <Text style={styles.sectionSub}>
                Select up to 3 disposable items to bring into the mission
              </Text>
            </View>
            {/* Max 3 indicator */}
            <View style={styles.maxPill}>
              <Text style={styles.maxTxt}>MAX 3</Text>
            </View>
          </View>

          {ownedItems.length > 0 ? (
            <View style={styles.itemGrid}>
              {ownedItems.map((item) => {
                const qty      = inventory[item.name] ?? 0;
                const isSel    = selectedItems.includes(item.id);
                const isAtMax  = selectedItems.length >= 3 && !isSel;
                return (
                  <ItemCard
                    key={item.id}
                    item={item}
                    qty={qty}
                    selected={isSel}
                    disabled={isAtMax}
                    onToggle={() => toggleItem(item.id)}
                  />
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyHint}>
              <Ionicons name="medkit-outline" size={24} color={UI.textDim} />
              <Text style={styles.emptyTxt}>
                No items in inventory. Win battles, check the Apothecary, or craft items to earn them.
              </Text>
            </View>
          )}
        </View>

        {/* ── Tip ─────────────────────────────────────────────────────────── */}
        <View style={styles.tipBox}>
          <Ionicons name="information-circle-outline" size={14} color={UI.textDim} />
          <Text style={styles.tipTxt}>
            Items are consumed when used in battle. Your selections here are available as in-battle actions — you still choose when to use them.
          </Text>
        </View>

      </ScrollView>

      {/* ── Footer buttons ─────────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <Pressable style={styles.backFooterBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={16} color={UI.textSoft} />
          <Text style={styles.backFooterTxt}>Back</Text>
        </Pressable>
        <Pressable
          style={[styles.startBtn, { backgroundColor: accentColor }]}
          onPress={handleStart}
        >
          <Ionicons name="play" size={18} color="#0B1020" />
          <Text style={[styles.startBtnTxt, { color: "#0B1020" }]}>Start Mission</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI.bgBase,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingTxt: {
    color: UI.textDim,
    fontSize: 14,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: UI.border,
    overflow: "hidden",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: UI.panel,
    borderWidth: 1,
    borderColor: UI.border,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  headerTitle: {
    color: UI.text,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  slotBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  slotTxt: {
    fontSize: 11,
    fontWeight: "800",
  },

  // Scroll
  scroll: {
    padding: SPACING.md,
    gap: SPACING.xl,
    paddingBottom: 100,
  },

  // Sections
  section: {
    gap: SPACING.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  sectionTitle: {
    color: UI.text,
    fontSize: 16,
    fontWeight: "700",
  },
  sectionSub: {
    color: UI.textDim,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  maxPill: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  maxTxt: {
    color: UI.textDim,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },

  // Grids
  heroGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  itemGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    justifyContent: "space-between",
  },

  // Empty
  emptyHint: {
    alignItems: "center",
    gap: 8,
    paddingVertical: SPACING.lg,
    backgroundColor: UI.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: UI.border,
    paddingHorizontal: SPACING.md,
  },
  emptyTxt: {
    color: UI.textDim,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },

  // Tip
  tipBox: {
    flexDirection: "row",
    gap: SPACING.sm,
    alignItems: "flex-start",
    backgroundColor: UI.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: UI.border,
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
    borderTopColor: UI.border,
    backgroundColor: UI.bgBase,
  },
  backFooterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
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
