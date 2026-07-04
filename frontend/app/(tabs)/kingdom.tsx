import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { PlayerHeader } from "@/src/components/PlayerHeader";
import { useTestSession } from "@/src/game/testSession";
import { useTutorial } from "@/src/game/tutorialStore";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import {
  ATRIUM_UNLOCKS, REALM_BUILDINGS, REALM_DISTRICTS, REALM_PLOTS, DECORATIONS,
  REALM_BAZAAR_NOTE, REALM_CUSTOMIZATION_NOTE, REALM_HERO_ASSIGNMENT_NOTE,
  getAtriumLevel, isBuildingUnlocked, RealmBuilding, RealmPlot, RealmDecoration,
  RealmUnlockContext, buildDefaultRealmLayout, isPlotUnlocked, plotUnlockLabel,
  getOccupantBuildingId, getBuildingById, getDecorationById, compatiblePlotsForBuilding,
  isDecorationAllowedOnPlot, PlotSize,
} from "@/src/game/realm";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const MAP_IMAGE = require("@/assets/images/realm_kingdom_map.png");
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const MAP_ASPECT = 896 / 1280;
const MAP_SCALE = 1.6;
const MAP_W = SCREEN_W * MAP_SCALE;
const MAP_H = MAP_W / MAP_ASPECT;

const DISTRICT_COLOR: Record<string, string> = {
  brand: COLORS.brand, mind: COLORS.mind, protection: COLORS.protection,
  energy: COLORS.energy, growth: COLORS.growth, fire: COLORS.fire, storm: COLORS.storm,
};

const PLOT_DIAMETER: Record<PlotSize, number> = { small: 40, medium: 56, large: 72 };
const PLOT_ICON_SIZE: Record<PlotSize, number> = { small: 16, medium: 22, large: 28 };

type Mode = "view" | "build" | "move";

export default function KingdomScreen() {
  const router = useRouter();
  const { player, setRealmLayout } = usePlayer();
  const { logEvent } = useTestSession();
  const { isCompleted, startTutorial } = useTutorial();

  const [selectedBuilding, setSelectedBuilding] = useState<RealmBuilding | null>(null);
  const [selectedEmptyPlot, setSelectedEmptyPlot] = useState<RealmPlot | null>(null);
  const [selectedLockedPlot, setSelectedLockedPlot] = useState<RealmPlot | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [showDistrictInfo, setShowDistrictInfo] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("view");
  const [buildTargetPlot, setBuildTargetPlot] = useState<RealmPlot | null>(null);
  const [moveBuildingId, setMoveBuildingId] = useState<string | null>(null);
  const [moveTargetPlot, setMoveTargetPlot] = useState<RealmPlot | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    logEvent('kingdom_screen_returned', 'kingdom');
    if (!isCompleted("firstKingdom")) {
      const t = setTimeout(() => startTutorial("firstKingdom"), 600);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 2400);
    return () => clearTimeout(t);
  }, [banner]);

  const atriumLevel = useMemo(
    () => (player ? getAtriumLevel(player.kingdom_levels || {}) : 0),
    [player]
  );

  if (!player) return null;

  const kingdomLevels = player.kingdom_levels || {};
  const layout = player.realm_layout || buildDefaultRealmLayout();
  const decor = player.realm_decor || {};
  const ctx: RealmUnlockContext = {
    atriumLevel,
    playerLevel: player.player_level || 1,
    chapterProgress: player.chapter_progress || 1,
    kingdomLevels,
  };

  const moveBuilding = moveBuildingId ? getBuildingById(moveBuildingId) : null;
  const compatiblePlots = moveBuilding
    ? compatiblePlotsForBuilding(moveBuilding, REALM_PLOTS, layout, ctx)
    : [];
  const compatiblePlotIds = new Set(compatiblePlots.map((p) => p.id));

  function exitModes() {
    setMode("view");
    setMoveBuildingId(null);
    setMoveTargetPlot(null);
    setBuildTargetPlot(null);
  }

  function toggleBuildMode() {
    if (mode === "build") {
      exitModes();
    } else {
      setMode("build");
      setMoveBuildingId(null);
      setBanner("Build Mode: tap a glowing plot to place a decoration.");
    }
  }

  function startMove(building: RealmBuilding) {
    setSelectedBuilding(null);
    setMode("move");
    setMoveBuildingId(building.id);
    setBanner(`Move Mode: choose a highlighted plot for ${building.name}.`);
  }

  async function confirmMove() {
    if (!moveBuildingId || !moveTargetPlot) return;
    await setRealmLayout({ [moveBuildingId]: moveTargetPlot.id });
    setBanner("Building moved.");
    exitModes();
  }

  function handlePlotPress(plot: RealmPlot) {
    const unlocked = isPlotUnlocked(plot, ctx);
    const occupantBuildingId = getOccupantBuildingId(plot.id, layout);
    const occupantBuilding = occupantBuildingId ? getBuildingById(occupantBuildingId) : undefined;
    const occupantDecorationId = decor[plot.id];

    if (mode === "move") {
      if (compatiblePlotIds.has(plot.id)) {
        setMoveTargetPlot(plot);
      } else {
        setBanner("That plot can't hold this building. Move canceled.");
        exitModes();
      }
      return;
    }

    if (mode === "build") {
      if (!unlocked) {
        setBanner(`Locked — ${plotUnlockLabel(plot)}.`);
        return;
      }
      if (occupantBuilding || occupantDecorationId) {
        setBanner("This plot is already occupied.");
        return;
      }
      if (plot.allowedDecorationIds.length === 0) {
        setBanner("This plot doesn't accept decorations.");
        return;
      }
      setBuildTargetPlot(plot);
      return;
    }

    // view mode
    if (!unlocked) { setSelectedLockedPlot(plot); return; }
    if (occupantBuilding) { setSelectedBuilding(occupantBuilding); return; }
    setSelectedEmptyPlot(plot);
  }

  async function placeDecoration(decoration: RealmDecoration) {
    if (!buildTargetPlot) return;
    await setRealmLayout({}, { [buildTargetPlot.id]: decoration.id });
    setBanner(`${decoration.name} placed.`);
    setBuildTargetPlot(null);
    exitModes();
  }

  async function removeDecoration(plotId: string) {
    await setRealmLayout({}, { [plotId]: null });
    setBanner("Decoration removed.");
    setSelectedEmptyPlot(null);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <PlayerHeader player={player} />
      <View style={styles.topBar}>
        <View>
          <Text style={styles.kicker}>REALM OF CLINICA</Text>
          <Text style={styles.title}>Grand Ward Atrium · Lv.{atriumLevel}</Text>
        </View>
        <View style={styles.topBarActions}>
          <Pressable
            style={[styles.modeBtn, mode === "build" && styles.modeBtnActive]}
            onPress={toggleBuildMode}
            testID="realm-build-mode-button"
            hitSlop={6}
          >
            <Ionicons name="hammer-outline" size={16} color={mode === "build" ? COLORS.onBrand : COLORS.brand} />
            <Text style={[styles.modeBtnTxt, mode === "build" && styles.modeBtnTxtActive]}>Build</Text>
          </Pressable>
          {mode !== "view" && (
            <Pressable style={styles.cancelBtn} onPress={exitModes} testID="realm-mode-cancel">
              <Text style={styles.cancelBtnTxt}>Cancel</Text>
            </Pressable>
          )}
          <Pressable style={styles.legendBtn} onPress={() => setShowLegend(true)} testID="realm-legend-button" hitSlop={8}>
            <Ionicons name="information-circle-outline" size={22} color={COLORS.brand} />
          </Pressable>
        </View>
      </View>

      {banner && (
        <View style={styles.bannerBox}>
          <Ionicons name="information-circle" size={14} color={COLORS.brand} />
          <Text style={styles.bannerTxt}>{banner}</Text>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ width: MAP_W }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.xxxl }}>
          <View style={[styles.mapWrap, { width: MAP_W, height: MAP_H }]} testID="kingdom-map">
            <ExpoImage source={MAP_IMAGE} style={StyleSheet.absoluteFillObject} contentFit="cover" />

            {REALM_PLOTS.map((plot) => {
              const unlocked = isPlotUnlocked(plot, ctx);
              const occupantBuildingId = getOccupantBuildingId(plot.id, layout);
              const occupantBuilding = occupantBuildingId ? getBuildingById(occupantBuildingId) : undefined;
              const occupantDecorationId = decor[plot.id];
              const occupantDecoration = occupantDecorationId ? getDecorationById(occupantDecorationId) : undefined;
              const district = REALM_DISTRICTS.find((d) => d.id === plot.district);
              const color = DISTRICT_COLOR[district?.colorToken || "brand"];
              const diameter = PLOT_DIAMETER[plot.size];

              const isMoveSource = mode === "move" && occupantBuildingId === moveBuildingId;
              const isMoveTarget = mode === "move" && compatiblePlotIds.has(plot.id);
              const isMoveDimmed = mode === "move" && !isMoveTarget && !isMoveSource;
              const isBuildTarget = mode === "build" && unlocked && !occupantBuilding && !occupantDecorationId && plot.allowedDecorationIds.length > 0;
              const isBuildDimmed = mode === "build" && !isBuildTarget;

              return (
                <Pressable
                  key={plot.id}
                  onPress={() => handlePlotPress(plot)}
                  style={[
                    styles.plotWrap,
                    {
                      left: `${plot.x}%`, top: `${plot.y}%`,
                      width: diameter, height: diameter,
                      marginLeft: -diameter / 2, marginTop: -diameter / 2,
                    },
                  ]}
                  testID={`realm-plot-${plot.id}`}
                  hitSlop={4}
                >
                  <LinearGradient
                    colors={
                      !unlocked
                        ? ["rgba(20,20,26,0.85)", "rgba(8,8,12,0.85)"]
                        : isMoveTarget || isBuildTarget
                        ? [color + "55", color + "22"]
                        : [color + "30", color + "12"]
                    }
                    style={[
                      styles.plotPad,
                      { width: diameter, height: diameter, borderRadius: diameter / 2 },
                      { borderColor: unlocked ? color : COLORS.borderStrong },
                      (isMoveTarget || isBuildTarget) && styles.plotPadPulse,
                      (isMoveDimmed || isBuildDimmed) && styles.plotPadDimmed,
                      isMoveSource && styles.plotPadSource,
                    ]}
                  >
                    <Ionicons
                      name={(!unlocked ? "lock-closed" : occupantBuilding ? occupantBuilding.icon : occupantDecoration ? occupantDecoration.icon : "add-circle-outline") as any}
                      size={PLOT_ICON_SIZE[plot.size]}
                      color={unlocked ? color : COLORS.onSurfaceTertiary}
                    />
                    {unlocked && occupantBuilding && (kingdomLevels[occupantBuilding.kingdomLevelsKey] || 0) > 0 && (
                      <View style={[styles.plotLvl, { backgroundColor: color }]}>
                        <Text style={styles.plotLvlTxt}>{kingdomLevels[occupantBuilding.kingdomLevelsKey] || 0}</Text>
                      </View>
                    )}
                  </LinearGradient>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>

      <View style={styles.hintRow}>
        <Ionicons name="hand-left-outline" size={13} color={COLORS.onSurfaceTertiary} />
        <Text style={styles.hintTxt}>
          {mode === "build"
            ? "Tap a glowing plot to place a decoration."
            : mode === "move"
            ? "Tap a highlighted plot to relocate the building."
            : "Pan the map and tap any plot to see details. Use Build Mode to decorate."}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: SPACING.xxxl }}>
        <View style={styles.districtRow}>
          {REALM_DISTRICTS.map((d) => (
            <Pressable
              key={d.id}
              style={styles.districtChip}
              onPress={() => setShowDistrictInfo(d.id)}
              testID={`realm-district-${d.id}`}
            >
              <View style={[styles.districtDot, { backgroundColor: DISTRICT_COLOR[d.colorToken] }]} />
              <Text style={styles.districtChipTxt}>{d.name}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.customizeRow} onPress={() => setShowCustomize(true)} testID="realm-customize-button">
          <Ionicons name="color-palette-outline" size={16} color={COLORS.brand} />
          <Text style={styles.customizeTxt}>Customize Realm (cosmetic — coming soon)</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.onSurfaceTertiary} />
        </Pressable>
      </ScrollView>

      {mode === "move" && moveTargetPlot && moveBuilding && (
        <View style={styles.confirmBar}>
          <Text style={styles.confirmBarTxt}>Move {moveBuilding.name} to {moveTargetPlot.name}?</Text>
          <View style={{ flexDirection: "row", gap: SPACING.sm }}>
            <Pressable style={styles.confirmBarCancel} onPress={() => setMoveTargetPlot(null)}>
              <Text style={styles.confirmBarCancelTxt}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.confirmBarConfirm} onPress={confirmMove} testID="realm-confirm-move">
              <Text style={styles.confirmBarConfirmTxt}>Confirm</Text>
            </Pressable>
          </View>
        </View>
      )}

      <BuildingDetailModal
        building={selectedBuilding}
        atriumLevel={atriumLevel}
        kingdomLevels={kingdomLevels}
        onClose={() => setSelectedBuilding(null)}
        onMove={startMove}
        router={router}
      />

      <EmptyPlotPanel
        plot={selectedEmptyPlot}
        decor={decor}
        onClose={() => setSelectedEmptyPlot(null)}
        onBuild={(plot) => { setSelectedEmptyPlot(null); setMode("build"); setBuildTargetPlot(plot); }}
        onRemoveDecoration={removeDecoration}
      />

      <LockedPlotPanel plot={selectedLockedPlot} onClose={() => setSelectedLockedPlot(null)} />

      <DecorationPickerModal
        plot={buildTargetPlot}
        onClose={() => { setBuildTargetPlot(null); }}
        onPick={placeDecoration}
      />

      <LegendModal visible={showLegend} onClose={() => setShowLegend(false)} />
      <CustomizeModal visible={showCustomize} onClose={() => setShowCustomize(false)} />
      <DistrictInfoModal districtId={showDistrictInfo} onClose={() => setShowDistrictInfo(null)} />

      <TutorialOverlay />
    </SafeAreaView>
  );
}

function BuildingDetailModal({
  building, atriumLevel, kingdomLevels, onClose, onMove, router,
}: {
  building: RealmBuilding | null;
  atriumLevel: number;
  kingdomLevels: Record<string, number>;
  onClose: () => void;
  onMove: (building: RealmBuilding) => void;
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

            <Text style={styles.sheetLabel}>PLOT</Text>
            {building.movable ? (
              <View style={styles.slotRow}>
                <Ionicons name="move-outline" size={14} color={COLORS.brand} />
                <Text style={styles.slotTxt}>This building can be relocated to any compatible plot.</Text>
              </View>
            ) : (
              <View style={styles.slotRow}>
                <Ionicons name="pin-outline" size={14} color={COLORS.onSurfaceTertiary} />
                <Text style={styles.slotTxt}>{building.fixedReason || "This building is fixed and anchors the Realm."}</Text>
              </View>
            )}

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

            <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg }}>
              {unlocked && building.linkKind === "route" && building.linkRoute && (
                <Pressable
                  style={[styles.linkBtn, { borderColor: color, flex: 1 }]}
                  onPress={() => { onClose(); router.push(building.linkRoute as any); }}
                  testID={`realm-link-${building.id}`}
                >
                  <Text style={[styles.linkBtnTxt, { color }]}>{building.linkLabel}</Text>
                  <Ionicons name="arrow-forward" size={16} color={color} />
                </Pressable>
              )}
              {unlocked && building.movable && (
                <Pressable
                  style={[styles.moveBtn, { flex: building.linkKind === "route" ? undefined : 1 }]}
                  onPress={() => onMove(building)}
                  testID={`realm-move-${building.id}`}
                >
                  <Ionicons name="move-outline" size={16} color={COLORS.onSurfaceSecondary} />
                  <Text style={styles.moveBtnTxt}>Move</Text>
                </Pressable>
              )}
            </View>
            {building.linkKind === "placeholder" && !building.comingSoon && (
              <Text style={styles.sheetFootnote}>{building.linkLabel}</Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function EmptyPlotPanel({
  plot, decor, onClose, onBuild, onRemoveDecoration,
}: {
  plot: RealmPlot | null;
  decor: Record<string, string>;
  onClose: () => void;
  onBuild: (plot: RealmPlot) => void;
  onRemoveDecoration: (plotId: string) => void;
}) {
  if (!plot) return null;
  const district = REALM_DISTRICTS.find((d) => d.id === plot.district);
  const color = DISTRICT_COLOR[district?.colorToken || "brand"];
  const decorationId = decor[plot.id];
  const decoration = decorationId ? getDecorationById(decorationId) : undefined;
  const canDecorate = plot.allowedDecorationIds.length > 0;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()} testID="realm-empty-plot-sheet">
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={[styles.sheetIcon, { borderColor: color, backgroundColor: color + "1f" }]}>
              <Ionicons name={(decoration ? decoration.icon : "square-outline") as any} size={26} color={color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetName}>{plot.name}</Text>
              <Text style={styles.sheetDistrict}>{district?.name} · {plot.size} plot</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.onSurfaceTertiary} />
            </Pressable>
          </View>

          {decoration ? (
            <>
              <Text style={styles.sheetBody}>Decorated with a {decoration.name}. {decoration.flavor}</Text>
              <Pressable style={styles.moveBtn} onPress={() => onRemoveDecoration(plot.id)} testID="realm-remove-decoration">
                <Ionicons name="trash-outline" size={16} color={COLORS.onSurfaceSecondary} />
                <Text style={styles.moveBtnTxt}>Remove Decoration</Text>
              </Pressable>
            </>
          ) : canDecorate ? (
            <>
              <Text style={styles.sheetBody}>This plot is empty and ready to decorate. Decorations are purely cosmetic.</Text>
              <Pressable style={[styles.linkBtn, { borderColor: color, marginTop: SPACING.md }]} onPress={() => onBuild(plot)} testID="realm-build-here">
                <Text style={[styles.linkBtnTxt, { color }]}>Build Here</Text>
                <Ionicons name="hammer-outline" size={16} color={color} />
              </Pressable>
            </>
          ) : (
            <Text style={styles.sheetBody}>This plot is reserved for a future building and can't be decorated yet.</Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function LockedPlotPanel({ plot, onClose }: { plot: RealmPlot | null; onClose: () => void }) {
  if (!plot) return null;
  const district = REALM_DISTRICTS.find((d) => d.id === plot.district);
  const color = DISTRICT_COLOR[district?.colorToken || "brand"];
  const futureBuilding = plot.allowedBuildingIds.length
    ? getBuildingById(plot.allowedBuildingIds[0])
    : undefined;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()} testID="realm-locked-plot-sheet">
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={[styles.sheetIcon, { borderColor: COLORS.borderStrong, backgroundColor: "rgba(12,14,18,0.4)" }]}>
              <Ionicons name="lock-closed" size={26} color={COLORS.onSurfaceTertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetName}>{plot.name}</Text>
              <Text style={styles.sheetDistrict}>{district?.name} · Locked</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.onSurfaceTertiary} />
            </Pressable>
          </View>

          <View style={styles.lockBox}>
            <Ionicons name="lock-closed" size={14} color={COLORS.warning} />
            <Text style={styles.lockTxt}>Unlocks with: {plotUnlockLabel(plot)}</Text>
          </View>

          <Text style={styles.sheetLabel}>WHAT COULD GO HERE</Text>
          <Text style={styles.sheetBody}>
            {futureBuilding
              ? `A future ${futureBuilding.name} plot, or a relocated compatible building.`
              : "A future decoration plot for Realm customization."}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DecorationPickerModal({
  plot, onClose, onPick,
}: {
  plot: RealmPlot | null;
  onClose: () => void;
  onPick: (decoration: RealmDecoration) => void;
}) {
  if (!plot) return null;
  const options = DECORATIONS.filter((d) => isDecorationAllowedOnPlot(d, plot));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()} testID="realm-decoration-picker">
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetName}>Decorate {plot.name}</Text>
              <Text style={styles.sheetDistrict}>Cosmetic only — no gameplay effect</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.onSurfaceTertiary} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {options.map((d) => (
              <Pressable key={d.id} style={styles.decorRow} onPress={() => onPick(d)} testID={`realm-decoration-${d.id}`}>
                <Ionicons name={d.icon as any} size={20} color={COLORS.brand} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.decorName}>{d.name}</Text>
                  <Text style={styles.decorFlavor}>{d.flavor}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.onSurfaceTertiary} />
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DistrictInfoModal({ districtId, onClose }: { districtId: string | null; onClose: () => void }) {
  const district = REALM_DISTRICTS.find((d) => d.id === districtId);
  if (!district) return null;
  const color = DISTRICT_COLOR[district.colorToken];
  const buildings = REALM_BUILDINGS.filter((b) => b.district === district.id);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()} testID="realm-district-info-sheet">
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={[styles.sheetIcon, { borderColor: color, backgroundColor: color + "1f" }]}>
              <View style={[styles.districtDot, { backgroundColor: color, width: 16, height: 16, borderRadius: 8 }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetName}>{district.name}</Text>
              <Text style={styles.sheetDistrict}>{district.tagline}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.onSurfaceTertiary} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.sheetLabel}>CURRENT BUILDINGS</Text>
            {buildings.map((b) => (
              <View key={b.id} style={styles.slotRow}>
                <Ionicons name={b.icon as any} size={14} color={color} />
                <Text style={styles.slotTxt}>{b.name}</Text>
              </View>
            ))}
            <Text style={styles.sheetLabel}>FUTURE DISTRICT BONUS</Text>
            <Text style={styles.sheetBody}>
              District-wide bonuses (e.g. small passive boosts for buildings sharing a district) are a
              future direction and are not active yet.
            </Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function LegendModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
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
              level unlocks every other district, building by building. Pan the map to explore, use
              Build Mode to place decorations on empty plots, and use Move on a building's detail
              panel to relocate it to a compatible plot.
            </Text>
            <Text style={styles.sheetLabel}>ATRIUM PROGRESSION</Text>
            {ATRIUM_UNLOCKS.map((u) => (
              <Text key={u.level} style={styles.sheetBody}>Lv.{u.level}: {u.note}</Text>
            ))}
            <Text style={styles.sheetLabel}>CUSTOMIZATION</Text>
            <Text style={styles.sheetBody}>{REALM_CUSTOMIZATION_NOTE}</Text>
          </ScrollView>
          <Pressable
            style={styles.resourceGuideBtn}
            onPress={() => { onClose(); router.push("/materials"); }}
            testID="realm-resource-guide-button"
          >
            <Ionicons name="cube-outline" size={16} color={COLORS.brand} />
            <Text style={styles.resourceGuideTxt}>Realm Resource Guide</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.onSurfaceTertiary} />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CustomizeModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const categories = [
    { icon: "color-palette-outline", label: "Building Skins", note: "Alternate looks for each building — cosmetic only." },
    { icon: "map-outline", label: "District Themes", note: "Seasonal or stylistic palettes per district." },
    { icon: "trail-sign-outline", label: "Roads & Paths", note: "Connect plots with decorative pathways." },
    { icon: "flame-outline", label: "Lanterns & Banners", note: "Small decorations already placeable via Build Mode." },
    { icon: "body-outline", label: "Statues & Gardens", note: "Landmark decorations for showcase plots." },
    { icon: "snow-outline", label: "Seasonal Realm Themes", note: "Realm-wide visual events tied to future updates." },
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()} testID="realm-customize-sheet">
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetName}>Customize Realm</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.onSurfaceTertiary} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.sheetBody}>{REALM_CUSTOMIZATION_NOTE}</Text>
            <Text style={styles.sheetLabel}>PLANNED CATEGORIES</Text>
            {categories.map((c) => (
              <View key={c.label} style={styles.slotRow}>
                <Ionicons name={c.icon as any} size={14} color={COLORS.brand} />
                <Text style={styles.slotTxt}><Text style={{ fontWeight: "700" }}>{c.label}</Text> — {c.note}</Text>
              </View>
            ))}
            <View style={styles.comingSoonBox}>
              <Ionicons name="lock-closed-outline" size={14} color={COLORS.onSurfaceTertiary} />
              <Text style={styles.comingSoonTxt}>No purchases are wired up yet — this is a preview of the future customization system.</Text>
            </View>
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
  topBarActions: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 17, fontWeight: "600", marginTop: 2 },
  legendBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border,
  },
  modeBtn: {
    flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: SPACING.md, paddingVertical: 8,
    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.brand, backgroundColor: "transparent",
  },
  modeBtnActive: { backgroundColor: COLORS.brand },
  modeBtnTxt: { color: COLORS.brand, fontSize: 12, fontWeight: "700" },
  modeBtnTxtActive: { color: COLORS.onBrand },
  cancelBtn: { paddingHorizontal: SPACING.sm, paddingVertical: 8 },
  cancelBtnTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },

  bannerBox: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xs,
    backgroundColor: COLORS.brand + "18",
  },
  bannerTxt: { color: COLORS.brand, fontSize: 11, flex: 1, fontWeight: "600" },

  mapWrap: { overflow: "hidden", backgroundColor: COLORS.surface },
  plotWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
  plotPad: {
    alignItems: "center", justifyContent: "center", borderWidth: 2,
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  plotPadPulse: { borderWidth: 3 },
  plotPadDimmed: { opacity: 0.3 },
  plotPadSource: { opacity: 0.55 },
  plotLvl: {
    position: "absolute", bottom: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: COLORS.surface,
  },
  plotLvlTxt: { color: COLORS.onBrand, fontSize: 10, fontWeight: "800" },

  hintRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },
  hintTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, flex: 1 },

  districtRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, padding: SPACING.lg, paddingBottom: SPACING.sm },
  districtChip: {
    flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: SPACING.sm, paddingVertical: 5,
    borderRadius: RADIUS.pill, backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border,
  },
  districtDot: { width: 8, height: 8, borderRadius: 4 },
  districtChipTxt: { color: COLORS.onSurfaceSecondary, fontSize: 10, fontWeight: "600" },

  customizeRow: {
    flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: SPACING.lg, marginTop: SPACING.xs,
    padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1, borderColor: COLORS.border,
  },
  customizeTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "600", flex: 1 },

  confirmBar: {
    position: "absolute", left: SPACING.lg, right: SPACING.lg, bottom: SPACING.xl,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.sm,
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  confirmBarTxt: { color: COLORS.onSurface, fontSize: 12, fontWeight: "600", flex: 1 },
  confirmBarCancel: { paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border },
  confirmBarCancelTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "600" },
  confirmBarConfirm: { paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLORS.brand },
  confirmBarConfirmTxt: { color: COLORS.onBrand, fontSize: 12, fontWeight: "700" },

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
  resourceGuideBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.md,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.border,
  },
  resourceGuideTxt: { color: COLORS.onSurface, fontSize: 13, fontWeight: "700", flex: 1 },
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
    borderWidth: 1.5, borderRadius: RADIUS.pill, paddingVertical: SPACING.sm,
  },
  linkBtnTxt: { fontSize: 14, fontWeight: "700" },
  moveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.pill, paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md, marginTop: SPACING.md,
  },
  moveBtnTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
  decorRow: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  decorName: { color: COLORS.onSurface, fontSize: 13, fontWeight: "700" },
  decorFlavor: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
});
