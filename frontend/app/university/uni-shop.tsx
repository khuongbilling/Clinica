import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { goBack } from "@/src/utils/navigation";
import { usePlayer } from "@/src/game/store";
import { UNI_SHOP_ITEMS, UniShopItem } from "@/src/game/uniPractice";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const RARITY_COLOR: Record<string, string> = {
  scroll: '#2DD4BF',
  manual: '#A78BFA',
  pass: '#F97316',
  supply: '#F59E0B',
};

export default function UniShopScreen() {
  const router = useRouter();
  const { player } = usePlayer();
  const credits = player?.university_credits ?? 0;

  const scrolls  = UNI_SHOP_ITEMS.filter((i) => i.category === 'scroll');
  const manuals  = UNI_SHOP_ITEMS.filter((i) => i.category === 'manual');
  const passes   = UNI_SHOP_ITEMS.filter((i) => i.category === 'pass');
  const supplies = UNI_SHOP_ITEMS.filter((i) => i.category === 'supply');

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.hero}>
        <LinearGradient colors={[COLORS.brandTertiary, COLORS.surface]} style={StyleSheet.absoluteFillObject} />
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university")} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <View style={styles.heroInner}>
          <Ionicons name="storefront-outline" size={28} color="#2DD4BF" />
          <Text style={styles.kicker}>CLINICA UNIVERSITY</Text>
          <Text style={styles.title}>University Shop</Text>
          <Text style={styles.sub}>Spend University Credits on learning materials and practice supplies.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Balance */}
        <View style={styles.balanceCard}>
          <Ionicons name="school-outline" size={18} color="#2DD4BF" />
          <View style={styles.balanceText}>
            <Text style={styles.balanceLabel}>YOUR BALANCE</Text>
            <Text style={styles.balanceValue}>{credits.toLocaleString()} University Credits</Text>
          </View>
          <View style={styles.previewPill}>
            <Text style={styles.previewTxt}>COMING SOON</Text>
          </View>
        </View>

        {/* Notice */}
        <View style={styles.noticeBox}>
          <Ionicons name="hourglass-outline" size={14} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.noticeTxt}>
            The University Shop is in preview. Credits are being collected now — purchasing will unlock in a future update. All materials shown below can already be earned through practice activities.
          </Text>
        </View>

        <Section label="LEARNING SCROLLS" items={scrolls} credits={credits} />
        <Section label="REFERENCE MANUALS" items={manuals} credits={credits} />
        <Section label="PASSES & ACCESS" items={passes} credits={credits} />
        <Section label="CLINICAL SUPPLIES" items={supplies} credits={credits} />

        <View style={styles.footer}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.footerTxt}>
            University Credits are earned through practice activities, lessons, and milestones. They will never be sold for real money — they are a free-to-earn currency.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ label, items, credits }: { label: string; items: UniShopItem[]; credits: number }) {
  if (!items.length) return null;
  return (
    <View style={secS.wrap}>
      <Text style={secS.label}>{label}</Text>
      {items.map((item) => <ShopItem key={item.id} item={item} credits={credits} />)}
    </View>
  );
}
const secS = StyleSheet.create({
  wrap: { gap: SPACING.xs },
  label: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
});

function ShopItem({ item, credits }: { item: UniShopItem; credits: number }) {
  const color = RARITY_COLOR[item.category] ?? '#2DD4BF';
  const canAfford = credits >= item.creditCost;
  return (
    <View style={[shopS.card, { borderColor: color + '30' }]}>
      <View style={[shopS.iconWrap, { backgroundColor: color + '15' }]}>
        <Ionicons name={item.icon as any} size={20} color={color} />
      </View>
      <View style={shopS.info}>
        <Text style={shopS.name}>{item.name}</Text>
        <Text style={shopS.desc}>{item.description}</Text>
        <View style={shopS.costRow}>
          <Ionicons name="school-outline" size={11} color="#2DD4BF" />
          <Text style={shopS.cost}>{item.creditCost} UC</Text>
          {canAfford && <View style={shopS.canAffordDot} />}
        </View>
      </View>
      <View style={shopS.buyWrap}>
        <View style={[shopS.buyBtn, { opacity: 0.45 }]}>
          <Text style={shopS.buyTxt}>SOON</Text>
        </View>
      </View>
    </View>
  );
}
const shopS = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, padding: SPACING.sm },
  iconWrap: { width: 44, height: 44, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1, gap: 2 },
  name: { color: COLORS.onSurface, fontSize: 13, fontWeight: '700' },
  desc: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 15 },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  cost: { color: '#2DD4BF', fontSize: 11, fontWeight: '700' },
  canAffordDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#34D399' },
  buyWrap: { flexShrink: 0 },
  buyBtn: { backgroundColor: COLORS.brand, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 6 },
  buyTxt: { color: '#071018', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  hero: { padding: SPACING.lg, paddingTop: SPACING.xl, overflow: 'hidden' },
  heroInner: { alignItems: 'center', gap: 4 },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: '700', marginTop: 6 },
  title: { color: COLORS.onSurface, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  sub: { color: COLORS.onSurfaceSecondary, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  scroll: { padding: SPACING.lg, gap: SPACING.lg, paddingBottom: 60 },
  balanceCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#2DD4BF40', padding: SPACING.md },
  balanceText: { flex: 1, gap: 1 },
  balanceLabel: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  balanceValue: { color: '#2DD4BF', fontSize: 16, fontWeight: '800' },
  previewPill: { backgroundColor: '#F59E0B20', borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  previewTxt: { color: '#F59E0B', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  noticeBox: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start', backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.sm, padding: SPACING.sm },
  noticeTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, flex: 1, lineHeight: 16 },
  footer: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start', paddingTop: SPACING.sm },
  footerTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, flex: 1, lineHeight: 16 },
});
