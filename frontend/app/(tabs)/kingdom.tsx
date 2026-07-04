import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { useTestSession } from "@/src/game/testSession";
import { useTutorial } from "@/src/game/tutorialStore";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import {
  ATRIUM_ID, ATRIUM_UNLOCKS, REALM_BUILDINGS, REALM_DISTRICTS,
  REALM_BAZAAR_NOTE, REALM_CUSTOMIZATION_NOTE, REALM_HERO_ASSIGNMENT_NOTE,
  getAtriumLevel, isBuildingUnlocked, RealmBuilding,
} from "@/src/game/realm";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const MAP_IMAGE = require("@/assets/images/realm_kingdom_map.png");
const { width: SCREEN_W } = Dimensions.get("window");
const MAP_ASPECT = 896 / 1280;
const MAP_HEIGHT = SCREEN_W / MAP_ASPECT;

const DISTRICT_COLOR: Record<string, string> = {
  brand: COLORS.brand, mind: COLORS.mind, protection: COLORS.protection,
  energy: COLORS.energy, growth: COLORS.growth, fire: COLORS.fire, storm: COLORS.storm,
};

export default function KingdomScreen() {
  const router = useRouter();
  const { player } = usePlayer();
  const { logEvent } = useTestSession();
  const { isCompleted, startTutorial } = useTutorial();
  const [selected, setSelected] = useState<RealmBuilding | null>(null);
  const [showLegend, setShowLegend] = useState(false);

  useEffect(() => {
    logEvent('kingdom_screen_returned', 'kingdom');
    if (!isCompleted("firstKingdom")) {
      const t = setTimeout(() => startTutorial("firstKingdom"), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const atriumLevel = useMemo(
    () => (player ? getAtriumLevel(player.kingdom_levels || {}) : 0),
    [player]
  );

  if (!player) return null;

  const kingdomLevels = player.kingdom_levels || {};

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.kicker}>REALM OF CLINICA</Text>
          <Text style={styles.title}>Grand Ward Atrium · Lv.{atriumLevel}</Text>
        </View>
        <Pressable style={styles.legendBtn} onPress={() => setShowLegend(true)} testID="realm-legend-button" hitSlop={8}>
          <Ionicons name="information-circle-outline" size={22} color={COLORS.brand} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.xxxl }}>
        <View style={[styles.mapWrap, { height: MAP_HEIGHT }]} testID="kingdom-map">
          <Image source={MAP_IMAGE} style={StyleSheet.absoluteFillObject} resizeMode="cover" />

          {REALM_BUILDINGS.map((b) => {
            const unlocked = isBuildingUnlocked(b, atriumLevel);
            const lvl = kingdomLevels[b.kingdomLevelsKey] || 0;
            const color = DISTRICT_COLOR[REALM_DISTRICTS.find((d) => d.id === b.district)?.colorToken || "brand"];
            return (
              <Pressable
                key={b.id}
                onPress={() => setSelected(b)}
                style={[
                  styles.plot,
                  {
                    left: `${b.x}%`, top: `${b.y}%`,
                    borderColor: unlocked ? color : COLORS.borderStrong,
                    backgroundColor: unlocked ? color + "26" : "rgba(12,14,18,0.65)",
                  },
                  b.isAtrium && styles.plotAtrium,
                ]}
                testID={`realm-plot-${b.id}`}
                hitSlop={6}
              >
                <Ionicons
                  name={(unlocked ? b.icon : "lock-closed") as any}
                  size={b.isAtrium ? 26 : 20}
                  color={unlocked ? color : COLORS.onSurfaceTertiary}
                />
                {unlocked && lvl > 0 && (
                  <View style={[styles.plotLvl, { backgroundColor: color }]}>
                    <Text style={styles.plotLvlTxt}>{lvl}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.hintRow}>
          <Ionicons name="hand-left-outline" size={13} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.hintTxt}>Tap a building on the map to see details, requirements, and links.</Text>
        </View>

        <View style={styles.districtRow}>
          {REALM_DISTRICTS.map((d) => (
            <View key={d.id} style={styles.districtChip} testID={`realm-district-${d.id}`}>
              <View style={[styles.districtDot, { backgroundColor: DISTRICT_COLOR[d.colorToken] }]} />
              <Text style={styles.districtChipTxt}>{d.name}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <BuildingDetailModal
        building={selected}
        atriumLevel={atriumLevel}
        kingdomLevels={kingdomLevels}
        onClose={() => setSelected(null)}
        router={router}
      />

      <LegendModal visible={showLegend} onClose={() => setShowLegend(false)} />

      <TutorialOverlay />
    </SafeAreaView>
  );
}

function BuildingDetailModal({
  building, atriumLevel, kingdomLevels, onClose, router,
}: {
  building: RealmBuilding | null;
  atriumLevel: number;
  kingdomLevels: Record<string, number>;
  onClose: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  if (!building) return null;
  const unlocked = isBuildingUnlocked(building, atriumLevel);
  const lvl = kingdomLevels[building.kingdomLevelsKey] || 0;
  const req = building.requirementsForLevel(lvl);
  const district = REALM_DISTRICTS.find((d) => d.id === building.district);
  const color = DISTRICT_COLOR[district?.colorToken || "brand"];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()} testID="realm-building-sheet">
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={[styles.sheetIcon, { borderColor: color, backgroundColor: color + "1f" }]}>
              <Ionicons name={(unlocked ? building.icon : "lock-closed") as any} size={26} color={unlocked ? color : COLORS.onSurfaceTertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetName}>{building.name}</Text>
              <Text style={styles.sheetDistrict}>{district?.name}{unlocked ? ` · Lv.${lvl}` : " · Locked"}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} testID="realm-sheet-close">
              <Ionicons name="close" size={22} color={COLORS.onSurfaceTertiary} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.sheetPurpose}>{building.purpose}</Text>

            {!unlocked ? (
              <View style={styles.lockBox}>
                <Ionicons name="lock-closed" size={14} color={COLORS.warning} />
                <Text style={styles.lockTxt}>
                  Requires Grand Ward Atrium Lv.{building.atriumLevelRequired} (currently Lv.{atriumLevel}).
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.sheetLabel}>CURRENT BENEFIT</Text>
                <Text style={styles.sheetBody}>{building.benefitForLevel(lvl)}</Text>

                {lvl < building.maxLevel && (
                  <>
                    <Text style={styles.sheetLabel}>NEXT UPGRADE</Text>
                    <Text style={styles.sheetBody}>{building.nextUpgradeForLevel(lvl)}</Text>
                    <Text style={styles.sheetLabel}>REQUIREMENTS</Text>
                    <Text style={styles.sheetBody}>
                      Atrium Lv.{req.atriumLevel}+{req.materials.length ? " · " + req.materials.join(", ") : ""}
                    </Text>
                  </>
                )}
              </>
            )}

            <Text style={styles.sheetLabel}>HERO ASSIGNMENT</Text>
            {building.heroSlots.length ? (
              building.heroSlots.map((slot) => (
                <View key={slot.role} style={styles.slotRow}>
                  <Ionicons name="person-add-outline" size={14} color={COLORS.brand} />
                  <Text style={styles.slotTxt}><Text style={{ fontWeight: "700" }}>{slot.role}</Text> — {slot.flavor}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.sheetBody}>Hero Assignment Coming Soon.</Text>
            )}
            <Text style={styles.sheetFootnote}>{"\n" + REALM_HERO_ASSIGNMENT_NOTE}</Text>

            {building.skinPlaceholder && (
              <>
                <Text style={styles.sheetLabel}>CUSTOMIZATION</Text>
                <View style={styles.slotRow}>
                  <Ionicons name="color-palette-outline" size={14} color={COLORS.brand} />
                  <Text style={styles.slotTxt}>Skin & theme slot — Coming Soon (cosmetic only).</Text>
                </View>
              </>
            )}

            {building.comingSoon && (
              <View style={styles.comingSoonBox}>
                <Ionicons name="time-outline" size={14} color={COLORS.onSurfaceTertiary} />
                <Text style={styles.comingSoonTxt}>{REALM_BAZAAR_NOTE}</Text>
              </View>
            )}

            {unlocked && building.linkKind === "route" && building.linkRoute && (
              <Pressable
                style={[styles.linkBtn, { borderColor: color }]}
                onPress={() => { onClose(); router.push(building.linkRoute as any); }}
                testID={`realm-link-${building.id}`}
              >
                <Text style={[styles.linkBtnTxt, { color }]}>{building.linkLabel}</Text>
                <Ionicons name="arrow-forward" size={16} color={color} />
              </Pressable>
            )}
            {building.linkKind === "placeholder" && !building.comingSoon && (
              <Text style={styles.sheetFootnote}>{building.linkLabel}</Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function LegendModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()} testID="realm-legend-sheet">
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetName}>About the Realm</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.onSurfaceTertiary} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.sheetBody}>
              The Realm is your healing kingdom. The Grand Ward Atrium is the town hall — its
              level unlocks every other district, building by building.
            </Text>
            <Text style={styles.sheetLabel}>ATRIUM PROGRESSION</Text>
            {ATRIUM_UNLOCKS.map((u) => (
              <Text key={u.level} style={styles.sheetBody}>Lv.{u.level}: {u.note}</Text>
            ))}
            <Text style={styles.sheetLabel}>CUSTOMIZATION</Text>
            <Text style={styles.sheetBody}>{REALM_CUSTOMIZATION_NOTE}</Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 17, fontWeight: "600", marginTop: 2 },
  legendBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border,
  },

  mapWrap: { width: "100%", overflow: "hidden", backgroundColor: COLORS.surface },
  plot: {
    position: "absolute", width: 46, height: 46, borderRadius: 23, borderWidth: 2,
    alignItems: "center", justifyContent: "center", marginLeft: -23, marginTop: -23,
  },
  plotAtrium: { width: 58, height: 58, borderRadius: 29, marginLeft: -29, marginTop: -29, borderWidth: 3 },
  plotLvl: {
    position: "absolute", bottom: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: COLORS.surface,
  },
  plotLvlTxt: { color: COLORS.onBrand, fontSize: 10, fontWeight: "800" },

  hintRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },
  hintTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, flex: 1 },

  districtRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, padding: SPACING.lg },
  districtChip: {
    flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: SPACING.sm, paddingVertical: 5,
    borderRadius: RADIUS.pill, backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border,
  },
  districtDot: { width: 8, height: 8, borderRadius: 4 },
  districtChipTxt: { color: COLORS.onSurfaceSecondary, fontSize: 10, fontWeight: "600" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: COLORS.surfaceSecondary, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg,
    padding: SPACING.lg, borderTopWidth: 1, borderColor: COLORS.border, maxHeight: "80%",
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: SPACING.md },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginBottom: SPACING.md },
  sheetIcon: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: "center", justifyContent: "center",
  },
  sheetName: { color: COLORS.onSurface, fontSize: 18, fontWeight: "700" },
  sheetDistrict: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  sheetPurpose: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 18, marginBottom: SPACING.sm },
  sheetLabel: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginTop: SPACING.md },
  sheetBody: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 18, marginTop: 4 },
  sheetFootnote: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 15, marginTop: SPACING.sm, fontStyle: "italic" },
  lockBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: COLORS.warning + "18",
    borderRadius: RADIUS.md, padding: SPACING.sm, marginTop: SPACING.xs,
  },
  lockTxt: { color: COLORS.warning, fontSize: 12, flex: 1 },
  slotRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 6 },
  slotTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, flex: 1, lineHeight: 16 },
  comingSoonBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: COLORS.surfaceTertiary,
    borderRadius: RADIUS.md, padding: SPACING.sm, marginTop: SPACING.md,
  },
  comingSoonTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, flex: 1, lineHeight: 15 },
  linkBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1.5, borderRadius: RADIUS.pill, paddingVertical: SPACING.sm, marginTop: SPACING.lg,
  },
  linkBtnTxt: { fontSize: 14, fontWeight: "700" },
});
