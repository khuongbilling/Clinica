import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EventTrackCard } from "@/src/components/events/EventTrackCard";
import { MonetizationCard } from "@/src/components/events/MonetizationCard";
import { StaminaPill } from "@/src/components/StaminaPill";
import { MessageDialog } from "@/src/components/WebAlert";
import { EVENT_TRACKS, EventTrackDef, MONETIZATION_CARDS, MonetizationCardDef } from "@/src/game/eventsHub";
import { usePlayer } from "@/src/game/store";
import { goBack } from "@/src/utils/navigation";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ────────────────────────────────────────────────────────────
// Push 7 — Event Tracks + Monetization UI Foundation.
// This screen is a polished, NON-FUNCTIONAL preview. No purchases, billing,
// platform integrations, or gameplay advantages are wired here — every card
// is clearly labeled Preview / Planned / Coming Soon / Not Active and simply
// opens an info sheet on tap. Layout is responsive: side-by-side columns on
// wide screens (tablet/web), stacked sections on narrow mobile widths.
// ────────────────────────────────────────────────────────────

export default function EventsPage() {
  const router = useRouter();
  const { player } = usePlayer();
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const [tab, setTab] = useState<"events" | "offers">("events");

  const worldEventBanner = (
    <Pressable
      style={styles.worldEventBanner}
      onPress={() => router.push("/world-event" as any)}
      testID="events-world-event-banner"
    >
      <View style={styles.worldEventLeft}>
        <Ionicons name="earth" size={28} color="#34D399" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}>
          <Text style={styles.worldEventKicker}>WORLD EVENT · PUSH 10 PROTOTYPE</Text>
          <View style={styles.worldEventBadge}>
            <Text style={styles.worldEventBadgeTxt}>PREVIEW</Text>
          </View>
        </View>
        <Text style={styles.worldEventTitle}>Miasma Bloom</Text>
        <Text style={styles.worldEventSub}>
          A Realm-Wide Epidemic Event — see how every system connects to fight the outbreak.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={"#34D399"} />
    </Pressable>
  );
  const [info, setInfo] = useState<{ title: string; message: string } | null>(null);

  if (!player) {
    return (
      <SafeAreaView style={[styles.root, styles.loading]} edges={["top", "bottom"]}>
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }

  const openMonetizationInfo = (card: MonetizationCardDef) => {
    setInfo({
      title: `${card.title} — ${card.badge}`,
      message: `${card.detail}\n\nNo purchases, billing, or platform store integrations are active. This is a design preview only.`,
    });
  };

  const openEventInfo = (event: EventTrackDef) => {
    setInfo({
      title: `${event.title} — ${event.badge}`,
      message: `${event.subtitle}\n\nFree Track: ${event.rewards.freeTrack}\nPremium Track (placeholder): ${event.rewards.premiumTrack}\n\nThis is a design preview — no rewards, timers, or gameplay changes are live yet. Premium content is always cosmetic, lore, or material — never exclusive power.`,
    });
  };

  const offersSection = (
    <View style={styles.column}>
      <View style={styles.colHeader}>
        <Ionicons name="storefront-outline" size={16} color={COLORS.brand} />
        <Text style={styles.colTitle}>Support the Sanctuary</Text>
      </View>
      <Text style={styles.colSub}>
        Future ways to support Clinica's development. Nothing here is active — no billing is
        connected and nothing can be purchased today.
      </Text>
      <View style={styles.cardStack}>
        {MONETIZATION_CARDS.map((card) => (
          <MonetizationCard key={card.id} card={card} onPress={openMonetizationInfo} testID={`monetization-${card.id}`} />
        ))}
      </View>
    </View>
  );

  const eventsSection = (
    <View style={styles.column}>
      <View style={styles.colHeader}>
        <Ionicons name="calendar-outline" size={16} color={COLORS.brand} />
        <Text style={styles.colTitle}>Events</Text>
      </View>
      <Text style={styles.colSub}>
        Upcoming gameplay event tracks. Every event will offer a Free reward track plus a
        cosmetic-only Premium track — never exclusive power.
      </Text>
      <View style={styles.cardStack}>
        {EVENT_TRACKS.map((event) => (
          <EventTrackCard key={event.id} event={event} onPress={openEventInfo} testID={`event-${event.id}`} />
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/shift")} hitSlop={10} testID="events-back">
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>WARD OPERATIONS</Text>
          <Text style={styles.title}>Event Hub</Text>
        </View>
        <StaminaPill player={player} />
      </View>

      <View style={styles.notice}>
        <Ionicons name="information-circle-outline" size={14} color={COLORS.onSurfaceTertiary} />
        <Text style={styles.noticeTxt}>
          Everything below is a preview. No purchases, billing, or platform store integrations are
          active, and nothing here grants a gameplay advantage.
        </Text>
      </View>

      {!isWide && (
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabBtn, tab === "events" && styles.tabBtnActive]}
            onPress={() => setTab("events")}
            testID="events-tab-events"
          >
            <Text style={[styles.tabTxt, tab === "events" && styles.tabTxtActive]}>Events</Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, tab === "offers" && styles.tabBtnActive]}
            onPress={() => setTab("offers")}
            testID="events-tab-offers"
          >
            <Text style={[styles.tabTxt, tab === "offers" && styles.tabTxtActive]}>Offers</Text>
          </Pressable>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {worldEventBanner}
        {isWide ? (
          <View style={styles.wideRow}>
            {offersSection}
            {eventsSection}
          </View>
        ) : tab === "events" ? (
          eventsSection
        ) : (
          offersSection
        )}
      </ScrollView>

      <MessageDialog
        visible={!!info}
        title={info?.title ?? ""}
        message={info?.message ?? ""}
        confirmLabel="Got it"
        onConfirm={() => setInfo(null)}
        testID="events-info-dialog"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  loading: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.lg, paddingBottom: SPACING.sm },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  kicker: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  title: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300", marginTop: 2 },
  notice: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm,
    marginHorizontal: SPACING.lg, marginBottom: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md,
  },
  noticeTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 17, flex: 1, fontStyle: "italic" },
  tabRow: {
    flexDirection: "row", gap: SPACING.sm, marginHorizontal: SPACING.lg, marginBottom: SPACING.sm,
  },
  tabBtn: {
    flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border,
  },
  tabBtnActive: { borderColor: COLORS.brand, backgroundColor: COLORS.brand + "18" },
  tabTxt: { color: COLORS.onSurfaceTertiary, fontSize: 13, fontWeight: "700" },
  tabTxtActive: { color: COLORS.brand },
  scroll: { padding: SPACING.lg, paddingTop: 0, paddingBottom: SPACING.xxxl },
  wideRow: { flexDirection: "row", gap: SPACING.lg, alignItems: "flex-start" },
  column: { flex: 1, gap: SPACING.sm, minWidth: 0 },
  colHeader: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  colTitle: { color: COLORS.onSurface, fontSize: 16, fontWeight: "700" },
  colSub: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17 },
  cardStack: { gap: SPACING.md, marginTop: 4 },
  worldEventBanner: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: "#065F4644", borderRadius: RADIUS.lg,
    borderWidth: 2, borderColor: "#34D39955",
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  worldEventLeft: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: "#34D39922",
    alignItems: "center", justifyContent: "center",
  },
  worldEventKicker: { color: "#34D399", fontSize: 8, fontWeight: "700", letterSpacing: 1.5 },
  worldEventBadge: {
    backgroundColor: "#5B9BD522", borderWidth: 1, borderColor: "#5B9BD555",
    borderRadius: RADIUS.pill, paddingHorizontal: 5, paddingVertical: 1,
  },
  worldEventBadgeTxt: { color: "#5B9BD5", fontSize: 8, fontWeight: "800", letterSpacing: 1 },
  worldEventTitle: { color: "#34D399", fontSize: 17, fontWeight: "300" },
  worldEventSub:   { color: COLORS.onSurfaceSecondary, fontSize: 11, lineHeight: 15 },
});
