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
import { ROUTES, type AppRoute } from "@/src/game/routes";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getHeroSprite } from "@/src/components/HeroSprites";
import {
  drainHeroPick,
  drainItemBagSelection,
  loadPersistedLoadoutForType,
  persistLoadoutForType,
  syncCurrentLoadout,
} from "@/src/game/loadoutStore";
import { HEROES } from "@/src/game/content";
import { SKILL_CLINICAL } from "@/src/game/clinical";
import { rarityColor } from "@/src/game/gacha";
import { ITEMS } from "@/src/game/items";
import { CARD_POOL, CHAIN_TYPE_CONFIG } from "@/src/game/cards";
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

// ── Hero loadout slot ──────────────────────────────────────────────────────────

function HeroSlot({
  heroId,
  slotNum,
  locked = false,
  loanerLabel,
  onAdd,
  onRemove,
}: {
  heroId?:      string;
  slotNum:      number;
  locked?:      boolean;
  loanerLabel?: string;
  onAdd?:       () => void;
  onRemove?:    () => void;
}) {
  const hero   = heroId ? HEROES.find((h) => h.id === heroId) : null;
  const sprite = heroId ? getHeroSprite(heroId) : undefined;
  const rc     = hero ? (ROLE_COLOR[hero.role] ?? UI.teal) : UI.teal;
  const ri     = hero ? (ROLE_ICON[hero.role]  ?? "star") : "star";
  const color  = hero ? rc : "rgba(255,255,255,0.14)";
  const isLegendaryLoaner = loanerLabel && loanerLabel.includes("LEGENDARY");

  return (
    <Pressable
      style={[
        hs.wrap,
        hero
          ? { borderColor: color + "80", backgroundColor: color + "10" }
          : { borderColor: "rgba(255,255,255,0.10)" },
        locked && { borderColor: UI.gold + "60", backgroundColor: UI.gold + "08" },
        isLegendaryLoaner && { borderColor: UI.gold + "90", backgroundColor: UI.gold + "12" },
      ]}
      onPress={locked ? undefined : hero ? onRemove : onAdd}
      hitSlop={4}
    >
      <View style={[hs.tl, { borderColor: locked ? UI.gold + "70" : hero ? color + "90" : "rgba(255,255,255,0.16)" }]} />
      <View style={[hs.br, { borderColor: locked ? UI.gold + "70" : hero ? color + "90" : "rgba(255,255,255,0.16)" }]} />

      {loanerLabel && (
        <View style={[hs.loanerBadge, isLegendaryLoaner && hs.loanerBadgeLegendary]}>
          <Text style={[hs.loanerBadgeTxt, isLegendaryLoaner && hs.loanerBadgeTxtLegendary]}>{loanerLabel}</Text>
        </View>
      )}

      {hero ? (
        <>
          <View style={[hs.portrait, { borderColor: locked ? UI.gold + "80" : color + "AA" }]}>
            {sprite ? (
              <Image source={sprite} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <View style={[hs.fallback, { backgroundColor: rc + "1E" }]}>
                <Ionicons name={ri as any} size={20} color={rc} />
              </View>
            )}
            {locked && !loanerLabel && (
              <View style={hs.lockOverlay}>
                <Ionicons name="lock-closed" size={14} color={UI.gold} />
              </View>
            )}
            {isLegendaryLoaner && (
              <View style={hs.loanerLegendaryOverlay}>
                <Ionicons name="star" size={12} color={UI.gold} />
              </View>
            )}
          </View>
          <Text style={[hs.name, { color: locked ? UI.gold + "CC" : color }]} numberOfLines={2}>{hero.name}</Text>
          {!locked && <Ionicons name="close-circle" size={10} color={color + "70"} />}
        </>
      ) : (
        <>
          <Ionicons name="add" size={22} color="rgba(255,255,255,0.28)" />
          <Text style={hs.empty}>EMPTY</Text>
        </>
      )}
    </Pressable>
  );
}
const hs = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    minHeight: 100,
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
  portrait: {
    width: 52, height: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    overflow: "hidden",
    backgroundColor: UI.bgDeep,
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.52)",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 14,
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
  loanerBadge: {
    borderRadius: 3,
    borderWidth: 1,
    borderColor: UI.teal + "70",
    backgroundColor: UI.teal + "18",
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginBottom: 2,
  },
  loanerBadgeLegendary: {
    borderColor: UI.gold + "80",
    backgroundColor: UI.gold + "1A",
  },
  loanerBadgeTxt: {
    color: UI.teal,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  loanerBadgeTxtLegendary: {
    color: UI.gold,
  },
  loanerLegendaryOverlay: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 8,
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
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
  const { player, loading, setEquippedCards, saveActiveTeam } = usePlayer();

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

  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [equippedCards, setLocalEquippedCards] = useState<string[]>(
    () => player?.equipped_cards ?? []
  );
  const [cardPickerOpen, setCardPickerOpen] = useState(false);
  const [teamSlots, setTeamSlots] = useState<(string | null)[]>([null, null, null]);
  const [deployError, setDeployError] = useState<string | null>(null);
  // Sync teamSlots from player.active_team once when player data first arrives,
  // and again on each focus (in case active_team changed externally). Local
  // edits made after focus will not be overwritten until the next focus.
  const teamSyncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!player) return;
    const team = player.active_team ?? [];
    const key = team.join(',');
    if (teamSyncedRef.current === key) return;
    // Guard: if we previously had heroes and the new data is empty, treat it as a
    // transient reload artifact (token refresh / reconnect) and hold the current
    // slots until real data arrives with a non-empty or confirmed-empty team.
    if (team.length === 0 && teamSyncedRef.current !== null && teamSyncedRef.current !== '') return;
    teamSyncedRef.current = key;
    setTeamSlots([team[0] ?? null, team[1] ?? null, team[2] ?? null]);
  }, [player]);

  useFocusEffect(useCallback(() => {
    // Consume hero-picker result first (drain-once pattern).
    const heroPick = drainHeroPick();
    if (heroPick !== null) {
      setTeamSlots((prev) => {
        const next = [...prev];
        // Dedup: if this hero is already in another slot, clear that slot first.
        for (let i = 0; i < next.length; i++) {
          if (i !== heroPick.slot && next[i] === heroPick.heroId) next[i] = null;
        }
        next[heroPick.slot] = heroPick.heroId;
        return next;
      });
      setDeployError(null);
    }

    const missionType = String(partType);
    const bagPick = drainItemBagSelection();
    if (bagPick !== null) {
      // Just returned from /item-bag — use the player's exact pick, persist it
      // for this mission type, and sync back so item-bag pre-populates on re-open.
      setSelectedItems(bagPick);
      syncCurrentLoadout(bagPick);
      persistLoadoutForType(missionType, bagPick);
    } else {
      // Fresh entry, app restart, or cross-mission-type navigation — restore the
      // last-saved loadout for this specific type (boss ≠ battle ≠ ward_defense).
      loadPersistedLoadoutForType(missionType).then((persisted) => {
        setSelectedItems(persisted);
        syncCurrentLoadout(persisted);
      });
    }
    setLocalEquippedCards(player?.equipped_cards ?? []);
    // Re-sync team slots to server state on each focus visit only when there is
    // no pending hero pick (otherwise the pick would be overwritten by server data).
    if (player && heroPick === null) {
      const team = player.active_team ?? [];
      const key = team.join(',');
      const hadHeroes = teamSyncedRef.current !== null && teamSyncedRef.current !== '';
      if (team.length === 0 && hadHeroes) return;
      teamSyncedRef.current = key;
      setTeamSlots([team[0] ?? null, team[1] ?? null, team[2] ?? null]);
    }
  }, [player?.equipped_cards, player?.active_team, partType]));

  // Persist item loadout for this mission type whenever the player removes an
  // item inline (tap slot to deselect), keeping the persisted store up-to-date.
  useEffect(() => {
    if (selectedItems.length === 0) return; // avoid writing empty on initial mount
    persistLoadoutForType(String(partType), selectedItems);
  }, [selectedItems, partType]);

  function toggleCard(cardId: string) {
    setLocalEquippedCards((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, cardId];
    });
  }

  async function saveCardDeck() {
    await setEquippedCards(equippedCards);
    setCardPickerOpen(false);
  }

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

  const owned = new Set(player.heroes_owned);

  const hasHero = isTutorial || teamSlots.some((id) => id !== null);

  const handleStart = async () => {
    if (!isTutorial && !hasHero) {
      setDeployError("Select at least one healer to deploy.");
      return;
    }
    setDeployError(null);
    if (!isTutorial) {
      await saveActiveTeam(teamSlots.filter((id): id is string => id !== null));
    }
    if (isTutorial) {
      // Tutorial mode — always replace into battle with prologue+training flags so
      // the guided Ward Shift scripted sequence runs correctly.
      router.replace({ pathname: "/battle", params: { enemyId: String(enemyId || "dehydration_wisp"), training: "1", prologue: "tutorial" } });
    } else if (enemyId) {
      // Battle node with a specific enemy — push with typed params to avoid
      // URL-encoding issues when enemyId was separated from the route string.
      router.push({ pathname: "/battle", params: { enemyId: String(enemyId) } });
    } else if (missionRoute) {
      router.push(missionRoute as AppRoute);
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
                Three legendary healers lend you their power for your first shift. Recruit your own team after the tutorial.
              </Text>
              <View style={s.heroSlotRow}>
                <HeroSlot heroId="prologue_nightingale" slotNum={1} locked loanerLabel="LEGENDARY LOANER" />
                <HeroSlot heroId="prologue_fleming"     slotNum={2} locked loanerLabel="LEGENDARY LOANER" />
                <HeroSlot heroId="prologue_former_self" slotNum={3} locked loanerLabel="LEGENDARY LOANER" />
              </View>
              <View style={[s.tutorialNotice, { borderColor: UI.gold + "30", backgroundColor: UI.gold + "0A", marginTop: 8 }]}>
                <Ionicons name="star" size={14} color={UI.gold} />
                <Text style={[s.tutorialNoticeTxt, { color: UI.gold + "CC" }]}>
                  Three legendary healers lend their power for your first shift. Complete the tutorial to begin recruiting your own team.
                </Text>
              </View>
            </>
          ) : owned.size === 0 ? (
            <Pressable
              style={[s.navCard, s.emptyNavCard]}
              onPress={() => router.push(ROUTES.SUMMON)}
            >
              <Ionicons name="people-outline" size={20} color={UI.textDim} />
              <Text style={s.emptyNavTxt}>No heroes recruited — Go to Summoning Hall</Text>
              <Ionicons name="chevron-forward" size={13} color={UI.textDim} />
            </Pressable>
          ) : (
            <>
              <Text style={s.sectionDesc}>
                Tap an empty slot to add a hero. Tap a filled slot to remove them.
              </Text>
              <View style={s.heroSlotRow}>
                {[0, 1, 2].map((i) => (
                  <HeroSlot
                    key={i}
                    heroId={teamSlots[i] ?? undefined}
                    slotNum={i + 1}
                    onAdd={() => {
                      const ownedIds   = encodeURIComponent(JSON.stringify([...owned]));
                      const takenSlots = encodeURIComponent(JSON.stringify(teamSlots));
                      router.push(
                        `/hero-picker?slot=${i}&ownedIds=${ownedIds}&takenSlots=${takenSlots}` as AppRoute
                      );
                    }}
                    onRemove={() => {
                      setTeamSlots((prev) => {
                        const next = [...prev];
                        next[i] = null;
                        return next;
                      });
                      setDeployError(null);
                    }}
                  />
                ))}
              </View>
            </>
          )}
        </View>

        {/* Hero picker is now a full-page route — /hero-picker — no modal here */}

        <SectionDivider accent={accent} />

        {/* ── Card Deck ─────────────────────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={[s.pip, { backgroundColor: "#BBA7EA" }]} />
            <Text style={s.sectionTitle}>Card Deck</Text>
            <View style={[s.countPill, { borderColor: "#BBA7EA50" }]}>
              <Text style={[s.countTxt, { color: "#BBA7EA" }]}>
                {equippedCards.length}/3
              </Text>
            </View>
          </View>

          {isTutorial ? (
            <View style={[s.tutorialNotice, { borderColor: UI.gold + "30", backgroundColor: UI.gold + "0A" }]}>
              <Ionicons name="lock-closed" size={14} color={UI.gold} />
              <Text style={[s.tutorialNoticeTxt, { color: UI.gold + "CC" }]}>
                Cards are not available in Training Mode. You'll unlock your card deck after completing your first battle.
              </Text>
            </View>
          ) : (
            <>
              <Text style={s.sectionDesc}>
                Load up to 3 cards for this battle. Each card can only be played once per run — choose wisely.
              </Text>

              {/* Currently selected cards summary */}
              <View style={s.navCard}>
                <View style={s.navCardInfo}>
                  {equippedCards.length === 0 ? (
                    <Text style={s.emptyNavTxt}>No cards loaded — random pool will be used</Text>
                  ) : (
                    equippedCards.map((id) => {
                      const card = CARD_POOL.find(c => c.id === id);
                      if (!card) return null;
                      const chainCfg = CHAIN_TYPE_CONFIG[card.cardChainType];
                      return (
                        <View key={id} style={s.heroChip}>
                          <Ionicons name={chainCfg.icon as any} size={11} color={chainCfg.color} />
                          <Text style={[s.heroChipTxt, { color: chainCfg.color }]} numberOfLines={1}>
                            {card.name}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </View>
                <Pressable
                  style={[s.navBtn, { borderColor: "#BBA7EA60" }]}
                  onPress={() => setCardPickerOpen(true)}
                >
                  <Text style={[s.navBtnTxt, { color: "#BBA7EA" }]}>Edit Deck</Text>
                  <Ionicons name="chevron-forward" size={13} color="#BBA7EA" />
                </Pressable>
              </View>
            </>
          )}
        </View>

        {/* Card picker modal */}
        <Modal visible={cardPickerOpen} transparent animationType="slide" onRequestClose={() => setCardPickerOpen(false)}>
          <View style={s.cardModalOverlay}>
            <View style={s.cardModalSheet}>
              <View style={s.cardModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardModalTitle}>Select Card Deck</Text>
                  <Text style={s.cardModalSub}>Choose up to 3 cards · {equippedCards.length}/3 selected</Text>
                </View>
                <Pressable onPress={() => setCardPickerOpen(false)} hitSlop={10}>
                  <Ionicons name="close" size={20} color={UI.textSoft} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                <View style={s.cardPickerGrid}>
                  {CARD_POOL.map((card) => {
                    const chainCfg = CHAIN_TYPE_CONFIG[card.cardChainType];
                    const selected = equippedCards.includes(card.id);
                    const maxed = !selected && equippedCards.length >= 3;
                    return (
                      <Pressable
                        key={card.id}
                        style={[
                          s.cardPickerCard,
                          selected
                            ? { borderColor: chainCfg.color + "AA", backgroundColor: chainCfg.color + "12" }
                            : { borderColor: "rgba(255,255,255,0.08)" },
                          maxed && s.cardPickerCardDisabled,
                        ]}
                        onPress={() => !maxed && toggleCard(card.id)}
                      >
                        {/* Chain type badge */}
                        <View style={[s.cardChainBadge, { backgroundColor: chainCfg.color + "1A", borderColor: chainCfg.color + "55" }]}>
                          <Ionicons name={chainCfg.icon as any} size={10} color={chainCfg.color} />
                          <Text style={[s.cardChainLbl, { color: chainCfg.color }]}>
                            {card.cardChainType.toUpperCase()}
                          </Text>
                        </View>

                        <Text style={s.cardPickerName} numberOfLines={2}>{card.name}</Text>
                        <Text style={s.cardPickerEffect} numberOfLines={2}>{card.shortEffect}</Text>

                        <View style={s.cardPickerFooter}>
                          <Text style={[s.cardPickerSource, { color: UI.textDim }]}>{card.source}</Text>
                          <View style={[s.cardPickerAP, { backgroundColor: chainCfg.color + "22" }]}>
                            <Text style={[s.cardPickerAPTxt, { color: chainCfg.color }]}>{card.costAP} AP</Text>
                          </View>
                        </View>

                        {selected && (
                          <View style={[s.cardPickerCheck, { backgroundColor: chainCfg.color }]}>
                            <Ionicons name="checkmark" size={11} color="#000" />
                          </View>
                        )}
                        {!chainCfg.advancesChain && (
                          <View style={s.cardSupportTag}>
                            <Text style={s.cardSupportTagTxt}>SUPPORT</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              <View style={s.cardModalFooter}>
                <Pressable style={s.cardModalClearBtn} onPress={() => setLocalEquippedCards([])}>
                  <Text style={s.cardModalClearTxt}>Clear</Text>
                </Pressable>
                <Pressable style={[s.cardModalSaveBtn, { backgroundColor: "#BBA7EA" }]} onPress={saveCardDeck}>
                  <Ionicons name="checkmark-circle" size={16} color="#0B1020" />
                  <Text style={s.cardModalSaveTxt}>Save Deck</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

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
                  onPress={() => router.push(ROUTES.ITEM_BAG)}
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
            Items are consumed when used in battle. Cards are single-use per battle. Your selections here determine what's available as in-battle actions.
          </Text>
        </View>

      </ScrollView>

      {/* ── Footer CTA ───────────────────────────────────────────────────────── */}
      <View style={s.footer}>
        <Pressable style={s.backFooter} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={16} color={UI.textSoft} />
          <Text style={s.backFooterTxt}>Back</Text>
        </Pressable>
        <View style={{ flex: 1, gap: 6 }}>
          {deployError ? (
            <View style={s.deployError}>
              <Ionicons name="warning-outline" size={13} color="#F97316" />
              <Text style={s.deployErrorTxt}>{deployError}</Text>
            </View>
          ) : null}
          <Pressable
            style={[
              s.startBtn,
              {
                backgroundColor: isTutorial
                  ? UI.gold
                  : hasHero
                    ? accent
                    : "rgba(255,255,255,0.08)",
              },
            ]}
            onPress={handleStart}
          >
            <Ionicons
              name={isTutorial ? "school-outline" : "shield-checkmark"}
              size={18}
              color={hasHero || isTutorial ? "#0B1020" : UI.textDim}
            />
            <Text style={[s.startBtnTxt, { color: hasHero || isTutorial ? "#0B1020" : UI.textDim }]}>
              {isTutorial ? "Begin Training" : "Deploy to Ward"}
            </Text>
          </Pressable>
        </View>
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

  // Hero slot row
  heroSlotRow: {
    flexDirection: "row",
    gap: 8,
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

  // Hero picker modal rows
  heroPickerList: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  heroPickerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
    backgroundColor: UI.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
  },
  heroPickerPortrait: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 1.5,
    overflow: "hidden",
    backgroundColor: UI.bgDeep,
    flexShrink: 0,
  },
  heroPickerFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroPickerName: {
    fontSize: 14,
    fontWeight: "700",
  },
  heroPickerTitle: {
    color: UI.textDim,
    fontSize: 11,
  },
  heroPickerBadges: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  heroPickerPill: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  heroPickerPillTxt: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  heroPickerSkillRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
  },
  heroPickerSkillTxt: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    fontStyle: "italic",
  },
  heroPickerChainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  heroPickerChainPills: {
    flexDirection: "row",
    gap: 4,
    flexWrap: "wrap",
  },
  heroPickerChainPill: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  heroPickerChainTxt: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 0.3,
  },
  heroPickerEmpty: {
    alignItems: "center",
    gap: 10,
    paddingVertical: SPACING.xl,
  },
  heroPickerEmptyTxt: {
    color: UI.textDim,
    fontSize: 13,
    textAlign: "center",
  },

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

  // Card picker modal
  cardModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  cardModalSheet: {
    backgroundColor: UI.bgDeep,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: "rgba(187,167,234,0.25)",
    maxHeight: "85%",
    paddingBottom: SPACING.lg,
  },
  cardModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    gap: SPACING.sm,
  },
  cardModalTitle: {
    color: UI.text,
    fontSize: 16,
    fontWeight: "700",
  },
  cardModalSub: {
    color: "#BBA7EA",
    fontSize: 12,
    marginTop: 2,
  },
  cardPickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    padding: SPACING.md,
    justifyContent: "space-between",
  },
  cardPickerCard: {
    width: "47%",
    backgroundColor: UI.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    padding: 11,
    gap: 5,
    position: "relative",
    overflow: "hidden",
  },
  cardPickerCardDisabled: {
    opacity: 0.45,
  },
  cardChainBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cardChainLbl: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cardPickerName: {
    color: UI.text,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  cardPickerEffect: {
    color: UI.textDim,
    fontSize: 11,
    lineHeight: 16,
  },
  cardPickerFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  cardPickerSource: {
    fontSize: 10,
    fontStyle: "italic",
    flex: 1,
  },
  cardPickerAP: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cardPickerAPTxt: {
    fontSize: 10,
    fontWeight: "700",
  },
  cardPickerCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  cardSupportTag: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(232,200,104,0.18)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  cardSupportTagTxt: {
    color: "#E8C868",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  cardModalFooter: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  cardModalClearBtn: {
    borderRadius: RADIUS.pill,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
  },
  cardModalClearTxt: {
    color: UI.textSoft,
    fontSize: 13,
    fontWeight: "600",
  },
  cardModalSaveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: RADIUS.pill,
    paddingVertical: 12,
  },
  cardModalSaveTxt: {
    color: "#0B1020",
    fontSize: 13,
    fontWeight: "700",
  },

  // Deploy error label
  deployError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(249,115,22,0.10)",
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.30)",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  deployErrorTxt: {
    color: "#F97316",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
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
