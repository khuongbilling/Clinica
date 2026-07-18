/**
 * /item-bag — Clinical Supplies selection screen
 *
 * Reached from /mission-loadout "Browse Supplies" button.
 * Player picks up to 3 items from their inventory.
 * Selection is persisted via loadoutStore (ephemeral, per-session).
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ITEMS } from "@/src/game/items";
import { getLoadoutItems, setLoadoutItems } from "@/src/game/loadoutStore";
import { usePlayer } from "@/src/game/store";
import { RADIUS, SPACING } from "@/src/theme/colors";
import { UI } from "@/src/theme/ui";

const MAX_ITEMS = 3;

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

export default function ItemBagScreen() {
  const router  = useRouter();
  const { player, loading } = usePlayer();

  const [selected, setSelected] = useState<string[]>(() => getLoadoutItems());

  if (loading || !player) {
    return (
      <SafeAreaView style={s.root} edges={["top", "bottom"]}>
        <View style={s.center}>
          <Ionicons name="hourglass-outline" size={32} color={UI.teal} />
          <Text style={s.loadingTxt}>Loading supplies...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const inventory  = player.inventory ?? {};
  const ownedItems = ITEMS.filter((it) => (inventory[it.name] ?? 0) > 0);

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_ITEMS) return prev;
      return [...prev, id];
    });
  };

  const confirm = () => {
    setLoadoutItems(selected);
    router.back();
  };

  return (
    <SafeAreaView style={s.root} edges={["top", "bottom"]}>

      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={UI.textSoft} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Item Bag</Text>
          <Text style={s.subtitle}>Select up to {MAX_ITEMS} clinical supplies for this mission</Text>
        </View>
        <View style={s.countPill}>
          <Text style={s.countTxt}>{selected.length}/{MAX_ITEMS}</Text>
        </View>
      </View>

      {/* Selected slot preview */}
      <View style={s.slots}>
        {[0, 1, 2].map((i) => {
          const id   = selected[i];
          const item = id ? ITEMS.find((it) => it.id === id) : null;
          const tc   = item ? (ITEM_TYPE_COLOR[item.itemType] ?? UI.teal) : "rgba(255,255,255,0.10)";
          const ti   = item ? (ITEM_TYPE_ICON[item.itemType]  ?? "medical") : null;
          return (
            <Pressable
              key={i}
              style={[s.slot, item && { borderColor: tc + "80", backgroundColor: tc + "10" }]}
              onPress={item ? () => toggle(id!) : undefined}
            >
              {item ? (
                <>
                  <Ionicons name={ti as any} size={18} color={tc} />
                  <Text style={[s.slotName, { color: tc }]} numberOfLines={2}>{item.displayName}</Text>
                  <Ionicons name="close-circle" size={12} color={tc + "70"} />
                </>
              ) : (
                <>
                  <Text style={s.slotNum}>{i + 1}</Text>
                  <Text style={s.slotEmpty}>EMPTY</Text>
                </>
              )}
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {ownedItems.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="medkit-outline" size={40} color={UI.textDim} />
            <Text style={s.emptyTitle}>No Supplies Available</Text>
            <Text style={s.emptyDesc}>
              Win battles or visit the Apothecary Market to stock clinical supplies.
            </Text>
          </View>
        ) : (
          <View style={s.grid}>
            {ownedItems.map((item) => {
              const qty    = inventory[item.name] ?? 0;
              const isSel  = selected.includes(item.id);
              const atMax  = selected.length >= MAX_ITEMS && !isSel;
              const tc     = ITEM_TYPE_COLOR[item.itemType] ?? UI.teal;
              const ti     = ITEM_TYPE_ICON[item.itemType]  ?? "medical";
              const sc     = SYSTEM_COLOR[item.systemType]   ?? UI.gold;
              return (
                <Pressable
                  key={item.id}
                  style={[
                    s.card,
                    isSel  && { borderColor: tc + "90", backgroundColor: tc + "0A" },
                    atMax  && !isSel && { opacity: 0.35 },
                  ]}
                  onPress={!atMax || isSel ? () => toggle(item.id) : undefined}
                >
                  {/* Corner marks */}
                  <View style={[s.cTL, { borderColor: isSel ? tc + "80" : "rgba(255,255,255,0.08)" }]} />
                  <View style={[s.cBR, { borderColor: isSel ? tc + "80" : "rgba(255,255,255,0.08)" }]} />

                  <View style={s.cardTop}>
                    <View style={[s.iconWrap, { backgroundColor: tc + "18", borderColor: tc + "35" }]}>
                      <Ionicons name={ti as any} size={18} color={tc} />
                    </View>
                    {isSel && (
                      <View style={[s.check, { backgroundColor: tc }]}>
                        <Ionicons name="checkmark" size={9} color="#000" />
                      </View>
                    )}
                  </View>

                  <Text style={s.cardName} numberOfLines={2}>{item.displayName}</Text>
                  <Text style={[s.cardSub, { color: sc + "C0" }]} numberOfLines={1}>{item.rpgSubtitle}</Text>
                  <Text style={s.cardEffect} numberOfLines={2}>{item.shortEffect}</Text>

                  <View style={s.cardFooter}>
                    <View style={[s.sysBadge, { backgroundColor: sc + "18", borderColor: sc + "40" }]}>
                      <Text style={[s.sysTxt, { color: sc }]}>{item.systemType}</Text>
                    </View>
                    <Text style={[s.qty, { color: tc }]}>×{qty}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Tip */}
        <View style={s.tip}>
          <Ionicons name="information-circle-outline" size={14} color={UI.textDim} />
          <Text style={s.tipTxt}>
            Items are consumed on use in battle. Your selections determine what's available as in-battle actions — you still choose when to use them.
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        <Pressable style={s.cancelBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={16} color={UI.textSoft} />
          <Text style={s.cancelTxt}>Cancel</Text>
        </Pressable>
        <Pressable style={s.confirmBtn} onPress={confirm}>
          <Ionicons name="checkmark-circle" size={18} color="#0B1020" />
          <Text style={s.confirmTxt}>Confirm Selection</Text>
        </Pressable>
      </View>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: UI.bgDeep },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingTxt:  { color: UI.textDim, fontSize: 14 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  backBtn: {
    width: 34, height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  title:    { color: UI.text,    fontSize: 17, fontWeight: "800" },
  subtitle: { color: UI.textDim, fontSize: 12, marginTop: 1 },
  countPill: {
    backgroundColor: UI.teal + "18",
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: UI.teal + "50",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countTxt: { color: UI.teal, fontSize: 13, fontWeight: "800" },

  slots: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  slot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingVertical: 10,
    paddingHorizontal: 4,
    minHeight: 72,
  },
  slotNum:   { color: "rgba(255,255,255,0.22)", fontSize: 18, fontWeight: "200" },
  slotEmpty: { color: "rgba(255,255,255,0.18)", fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  slotName:  { fontSize: 11, fontWeight: "700", textAlign: "center", lineHeight: 15 },

  scroll: { padding: SPACING.md, gap: SPACING.md },

  emptyState: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: { color: UI.text, fontSize: 16, fontWeight: "700", textAlign: "center" },
  emptyDesc:  { color: UI.textDim, fontSize: 13, lineHeight: 20, textAlign: "center" },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

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
  cTL: {
    position: "absolute", top: 5, left: 5,
    width: 8, height: 8,
    borderTopWidth: 1.5, borderLeftWidth: 1.5,
    borderTopLeftRadius: 2,
  },
  cBR: {
    position: "absolute", bottom: 5, right: 5,
    width: 8, height: 8,
    borderBottomWidth: 1.5, borderRightWidth: 1.5,
    borderBottomRightRadius: 2,
  },
  cardTop: {
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
  cardName:   { color: UI.text, fontSize: 12, fontWeight: "700", lineHeight: 16 },
  cardSub:    { fontSize: 12, fontWeight: "600", letterSpacing: 0.2 },
  cardEffect: { color: UI.textDim, fontSize: 12, lineHeight: 18 },
  cardFooter: {
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
  sysTxt: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
  qty:    { fontSize: 11, fontWeight: "800" },

  tip: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    padding: 12,
    alignItems: "flex-start",
  },
  tipTxt: { color: UI.textDim, fontSize: 12, lineHeight: 18, flex: 1 },

  footer: {
    flexDirection: "row",
    gap: 10,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  cancelTxt: { color: UI.textSoft, fontSize: 14, fontWeight: "600" },
  confirmBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: UI.teal,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
  },
  confirmTxt: { color: "#0B1020", fontSize: 15, fontWeight: "800" },
});
