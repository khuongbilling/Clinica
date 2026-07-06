import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState, useEffect } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { PlayerHeader } from "@/src/components/PlayerHeader";
import { FeatureLockedView, useFeatureGate } from "@/src/components/FeatureGate";
import { useTestSession } from "@/src/game/testSession";
import { useTutorial } from "@/src/game/tutorialStore";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { IsoTile } from "@/src/components/realm/IsoTile";
import { IsoBuildingSprite } from "@/src/components/realm/IsoBuildingSprite";
import { IsoTerrain } from "@/src/components/realm/IsoTerrain";
import {
  ATRIUM_UNLOCKS, REALM_BUILDINGS, REALM_DISTRICTS, DECORATIONS,
  REALM_BAZAAR_NOTE, REALM_CUSTOMIZATION_NOTE, REALM_HERO_ASSIGNMENT_NOTE, REALM_LOOP_NOTE,
  REALM_HARMONY_NOTE, CARE_PATHWAYS_NOTE, DISTRICT_IDENTITY_NOTE,
  HERO_RESIDENCY_NOTE, SANCTUARY_REQUESTS_NOTE, REALM_SKIN_EXAMPLES,
  BUILDING_CATEGORIES, BuildingCategory, getHarmonyBonus,
  getAtriumLevel, isBuildingUnlocked, RealmBuilding, RealmDecoration,
  buildDefaultRealmLayout, getBuildingById, getDecorationById, PlotType,
} from "@/src/game/realm";
import {
  GRID_ROWS, GRID_COLS, CELL_PX, GRID_CELLS, PlotCell, getCell, getCellById,
  isCellUnlocked, getFootprint, getFootprintCells, getOccupiedCellMap,
  canPlaceBuilding, canPlaceDecoration, computeRoads, cellId, parseCellId,
  getCellLabel, findAllValidOrigins, generatePlayerTerrain, cellsWithTerrain,
} from "@/src/game/realmGrid";
import {
  ISO_TILE_W, ISO_TILE_H, computeIsoCanvas, cellCenterIso, footprintIso,
  cellDepth, footprintDepth,
} from "@/src/game/realmIso";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const ISO_CANVAS = computeIsoCanvas(GRID_ROWS, GRID_COLS);
const GRID_W = ISO_CANVAS.width;
const GRID_H = ISO_CANVAS.height;

// Painter's-algorithm depth comparator — every terrain cell is drawn
// back-to-front once. The cell array itself is now built per-player from the
// player's realm_seed (see sortedCells in the component) so each Realm gets a
// unique terrain texture distribution.
const byDepth = (a: PlotCell, b: PlotCell) => cellDepth(a.row, a.col) - cellDepth(b.row, b.col);

const BUILDING_SPRITES: Record<string, any> = {
  grand_ward_atrium: require("../../assets/realm/buildings/grand_ward_atrium.png"),
  clinica_university: require("../../assets/realm/buildings/clinica_university.png"),
  research_library: require("../../assets/realm/buildings/research_library.png"),
  hospital_ward: require("../../assets/realm/buildings/hospital_ward.png"),
  hall_of_heroes: require("../../assets/realm/buildings/hall_of_heroes.png"),
  apothecary: require("../../assets/realm/buildings/apothecary.png"),
  sanctuary_bank: require("../../assets/realm/buildings/sanctuary_bank.png"),
  sanctuary_bazaar: require("../../assets/realm/buildings/sanctuary_bazaar.png"),
  nutrition_garden: require("../../assets/realm/buildings/nutrition_garden.png"),
  ward_defense_tower: require("../../assets/realm/buildings/ward_defense_tower.png"),
  faction_embassy: require("../../assets/realm/buildings/faction_embassy.png"),
};

const DISTRICT_COLOR: Record<string, string> = {
  brand: COLORS.brand, mind: COLORS.mind, protection: COLORS.protection,
  energy: COLORS.energy, growth: COLORS.growth, fire: COLORS.fire, storm: COLORS.storm,
};

const PLOT_TYPE_COLOR: Record<PlotType, string> = {
  buildable: COLORS.brand, decoration: "#c9a06a", blocked: "#3a3f47",
};

const CATEGORY_COLOR: Record<BuildingCategory, string> = {
  core: COLORS.brand, learning: COLORS.mind, care: COLORS.protection,
  supplies: COLORS.energy, wellness: COLORS.growth, economy: COLORS.energy,
  defense: COLORS.fire, faction: COLORS.storm,
};


function districtColorFor(id: string | null | undefined): string {
  if (!id) return COLORS.onSurfaceTertiary;
  const d = REALM_DISTRICTS.find((x) => x.id === id);
  return DISTRICT_COLOR[d?.colorToken || "brand"];
}

type Placement = { kind: "building" | "decoration"; id: string; isMove: boolean; origin: { row: number; col: number } | null };

export default function KingdomScreen() {
  const router = useRouter();
  const { player, setRealmLayout } = usePlayer();
  const realmGate = useFeatureGate("realm");
  const { logEvent } = useTestSession();
  const { isCompleted, startTutorial } = useTutorial();

  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [showInventory, setShowInventory] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [showDistrictInfo, setShowDistrictInfo] = useState<string | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
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
    const t = setTimeout(() => setBanner(null), 2600);
    return () => clearTimeout(t);
  }, [banner]);

  const atriumLevel = useMemo(
    () => (player ? getAtriumLevel(player.kingdom_levels || {}) : 0),
    [player]
  );

  const layout = player?.realm_layout || buildDefaultRealmLayout();
  const decor = player?.realm_decor || {};

  // Per-player terrain — a unique but deterministic texture map generated from
  // this player's realm_seed. Only cosmetic `terrain` is overridden; plotType,
  // locks, districts, and placement rules are identical for every player.
  const sortedCells = useMemo(() => {
    const terrain = generatePlayerTerrain(player?.realm_seed || 1);
    return cellsWithTerrain(terrain).sort(byDepth);
  }, [player?.realm_seed]);

  const occupiedCellMap = useMemo(() => getOccupiedCellMap(layout), [layout]);
  const roadSet = useMemo(() => computeRoads(layout), [layout]);

  const placedBuildings = useMemo(() => {
    return Object.entries(layout)
      .map(([buildingId, originId]) => {
        const building = getBuildingById(buildingId);
        const origin = parseCellId(originId);
        if (!building || !origin) return null;
        return { building, origin, footprint: getFootprint(buildingId) };
      })
      .filter((x): x is { building: RealmBuilding; origin: { row: number; col: number }; footprint: { w: number; h: number } } => !!x);
  }, [layout]);

  const unplacedUnlocked = useMemo(
    () => REALM_BUILDINGS.filter((b) => isBuildingUnlocked(b, atriumLevel) && !layout[b.id]),
    [atriumLevel, layout]
  );
  const lockedBuildings = useMemo(
    () => REALM_BUILDINGS.filter((b) => !isBuildingUnlocked(b, atriumLevel)),
    [atriumLevel]
  );

  const placementCheck = useMemo(() => {
    if (!placement || !placement.origin) return null;
    if (placement.kind === "building") {
      const building = getBuildingById(placement.id);
      if (!building) return null;
      return canPlaceBuilding({
        footprint: getFootprint(building.id),
        origin: placement.origin,
        occupiedCellMap,
        atriumLevel,
        unlocked: isBuildingUnlocked(building, atriumLevel),
        ignoreBuildingId: placement.isMove ? building.id : undefined,
      });
    }
    const decorOccupied = new Set(Object.keys(decor));
    return canPlaceDecoration({ origin: placement.origin, occupiedCellMap, decorOccupied });
  }, [placement, occupiedCellMap, atriumLevel, decor]);

  // All legal origin cells for the building currently being placed — drives
  // the "highlight every valid cell" placement preview (not just the target).
  const validOrigins = useMemo(() => {
    if (!placement || placement.kind !== "building") return [];
    const building = getBuildingById(placement.id);
    if (!building) return [];
    return findAllValidOrigins({
      footprint: getFootprint(building.id),
      occupiedCellMap,
      atriumLevel,
      unlocked: isBuildingUnlocked(building, atriumLevel),
      ignoreBuildingId: placement.isMove ? building.id : undefined,
    });
  }, [placement, occupiedCellMap, atriumLevel]);

  const validOriginCells = useMemo(() => {
    if (!placement || placement.kind !== "building" || !validOrigins.length) return [];
    const building = getBuildingById(placement.id);
    if (!building) return [];
    const footprint = getFootprint(building.id);
    const set = new Set<string>();
    for (const o of validOrigins) {
      for (const c of getFootprintCells(o, footprint)) set.add(cellId(c.row, c.col));
    }
    return Array.from(set);
  }, [placement, validOrigins]);

  if (!player) return null;
  // Block direct navigation into a still-locked Realm (tab hidden, route alive).
  if (!realmGate.unlocked) return <FeatureLockedView title="The Realm" reason={realmGate.reason} />;

  const kingdomLevels = player.kingdom_levels || {};
  const selectedBuilding = selectedBuildingId ? getBuildingById(selectedBuildingId) : null;
  const selectedOriginId = selectedBuildingId ? layout[selectedBuildingId] : undefined;

  function exitPlacement() {
    setPlacement(null);
  }

  function beginPlaceBuilding(building: RealmBuilding, isMove: boolean) {
    setShowInventory(false);
    setSelectedBuildingId(null);
    const currentOriginId = layout[building.id];
    const currentOrigin = currentOriginId ? parseCellId(currentOriginId) : null;
    setPlacement({ kind: "building", id: building.id, isMove, origin: isMove ? currentOrigin : null });
    setBanner(`${isMove ? "Move" : "Place"} ${building.name} (${getFootprint(building.id).w}x${getFootprint(building.id).h}) — tap a cell on the grid.`);
  }

  function beginPlaceDecoration(decoration: RealmDecoration) {
    setShowInventory(false);
    setPlacement({ kind: "decoration", id: decoration.id, isMove: false, origin: null });
    setBanner(`Place ${decoration.name} — tap an empty Decoration Plot.`);
  }

  async function storeBuilding(building: RealmBuilding) {
    await setRealmLayout({ [building.id]: null });
    setBanner(`${building.name} stored — find it again in Sanctuary Inventory.`);
    setSelectedBuildingId(null);
  }

  function handleCellPress(cell: PlotCell) {
    if (placement) {
      setPlacement({ ...placement, origin: { row: cell.row, col: cell.col } });
      return;
    }
    const occupantId = occupiedCellMap.get(cell.id);
    if (occupantId) {
      setSelectedBuildingId(occupantId);
      return;
    }
    if (decor[cell.id]) {
      const deco = getDecorationById(decor[cell.id]);
      setBanner(deco ? `${deco.name} — ${deco.flavor}` : "Decorated plot.");
      return;
    }
    if (roadSet.has(cell.id)) {
      setBanner("Realm Road — auto-generated, connects every building to the Grand Ward Atrium.");
      return;
    }
    if (cell.plotType === "blocked") {
      setBanner("Untamed wilds — outside the Realm's buildable grounds.");
      return;
    }
    if (cell.isExpansion && !isCellUnlocked(cell, atriumLevel)) {
      setBanner(`Locked Expansion Plot — unlocks at Grand Ward Atrium Lv.${cell.expansionAtriumLevel}.`);
      return;
    }
    const meta = getCellLabel(cell);
    setBanner(`${meta} — empty. Use Sanctuary Inventory to build or decorate here.`);
  }

  async function confirmPlacement() {
    if (!placement || !placement.origin || !placementCheck?.ok) return;
    const targetCellId = cellId(placement.origin.row, placement.origin.col);
    if (placement.kind === "building") {
      const building = getBuildingById(placement.id);
      await setRealmLayout({ [placement.id]: targetCellId });
      setBanner(`${building?.name || "Building"} ${placement.isMove ? "moved" : "constructed"}.`);
    } else {
      const decoration = getDecorationById(placement.id);
      await setRealmLayout({}, { [targetCellId]: placement.id });
      setBanner(`${decoration?.name || "Decoration"} placed.`);
    }
    exitPlacement();
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <PlayerHeader player={player} />
      <View style={styles.topBar}>
        <View>
          <Text style={styles.kicker}>REALM OF CLINICA · GRAND WARD SANCTUARY</Text>
          <Text style={styles.title}>Grand Ward Atrium · Lv.{atriumLevel}</Text>
        </View>
        <View style={styles.topBarActions}>
          <Pressable
            style={styles.modeBtn}
            onPress={() => setShowInventory(true)}
            testID="realm-build-mode-button"
            hitSlop={6}
          >
            <Ionicons name="hammer-outline" size={16} color={COLORS.brand} />
            <Text style={styles.modeBtnTxt}>Sanctuary Inventory</Text>
          </Pressable>
          {placement && (
            <Pressable style={styles.cancelBtn} onPress={exitPlacement} testID="realm-mode-cancel">
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
        contentContainerStyle={{ width: GRID_W }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.xxxl }}>
          <View style={[styles.gridWrap, { width: GRID_W, height: GRID_H }]} testID="kingdom-map">
            <IsoTerrain
              cells={sortedCells}
              canvas={ISO_CANVAS}
              roadSet={roadSet}
              unlocked={(cell) => isCellUnlocked(cell, atriumLevel)}
              buildMode={!!placement}
            />

            {sortedCells.map((cell) => {
              if (cell.plotType === "blocked") return null;
              const locked = cell.isExpansion && !isCellUnlocked(cell, atriumLevel);
              const { x, y } = cellCenterIso(cell.row, cell.col, ISO_CANVAS);
              const deco = decor[cell.id] ? getDecorationById(decor[cell.id]) : null;
              return (
                <View key={cell.id} style={{ position: "absolute", left: 0, top: 0 }}>
                  <Pressable
                    onPress={() => handleCellPress(cell)}
                    style={{
                      position: "absolute",
                      left: x - (ISO_TILE_W * 0.42), top: y - (ISO_TILE_H * 0.42),
                      width: ISO_TILE_W * 0.84, height: ISO_TILE_H * 0.84,
                    }}
                    testID={`realm-cell-${cell.id}`}
                  >
                    {locked && (
                      <View style={styles.lockBadge}>
                        <Ionicons name="lock-closed" size={9} color={COLORS.onSurfaceTertiary} />
                      </View>
                    )}
                  </Pressable>
                  {deco && (
                    <View pointerEvents="none" style={{ position: "absolute", left: x - 9, top: y - ISO_TILE_H * 0.75, width: 18, height: 18, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={deco.icon as any} size={14} color={PLOT_TYPE_COLOR.decoration} />
                    </View>
                  )}
                </View>
              );
            })}

            {placedBuildings.map(({ building, origin, footprint }) => {
              const color = districtColorFor(building.district);
              const lvl = kingdomLevels[building.kingdomLevelsKey] || 0;
              const isMoveSource = placement?.kind === "building" && placement.isMove && placement.id === building.id;
              const iso = footprintIso(origin, footprint, ISO_CANVAS);
              const width = iso.width * 1.06;
              const sprite = BUILDING_SPRITES[building.id];
              return (
                <View key={building.id} style={{ position: "absolute", left: 0, top: 0 }}>
                  {sprite ? (
                    <IsoBuildingSprite
                      source={sprite}
                      centerX={iso.center.x}
                      bottomY={iso.bottom.y}
                      width={width}
                      opacity={isMoveSource ? 0.35 : 1}
                      onPress={() => handleCellPress(getCell(origin.row, origin.col)!)}
                      testID={`realm-building-tile-${building.id}`}
                    >
                      {lvl > 0 && (
                        <View style={[styles.plotLvl, { backgroundColor: color }]}>
                          <Text style={styles.plotLvlTxt}>{lvl}</Text>
                        </View>
                      )}
                    </IsoBuildingSprite>
                  ) : (
                    <Pressable
                      onPress={() => handleCellPress(getCell(origin.row, origin.col)!)}
                      style={[
                        styles.buildingTileFallback,
                        {
                          left: iso.center.x - width / 2, top: iso.bottom.y - width,
                          width, height: width,
                          borderColor: color, backgroundColor: color + "2a",
                          opacity: isMoveSource ? 0.35 : 1,
                        },
                      ]}
                      testID={`realm-building-tile-${building.id}`}
                    >
                      <Ionicons name={building.icon as any} size={Math.min(26, width * 0.3)} color={color} />
                      {lvl > 0 && (
                        <View style={[styles.plotLvl, { backgroundColor: color }]}>
                          <Text style={styles.plotLvlTxt}>{lvl}</Text>
                        </View>
                      )}
                    </Pressable>
                  )}
                </View>
              );
            })}

            {placement && validOriginCells.length > 0 && (
              <>
                {validOriginCells.map((id) => {
                  const c = parseCellId(id);
                  if (!c) return null;
                  const { x, y } = cellCenterIso(c.row, c.col, ISO_CANVAS);
                  return (
                    <IsoTile
                      key={`valid-${id}`}
                      x={x} y={y} w={ISO_TILE_W * 0.88} h={ISO_TILE_H * 0.88}
                      fill={COLORS.success + "22"} borderColor={COLORS.success + "66"} borderWidth={1}
                    />
                  );
                })}
              </>
            )}

            {placement?.origin && (() => {
              const footprint = placement.kind === "building" ? getFootprint(placement.id) : { w: 1, h: 1 };
              const cells = getFootprintCells(placement.origin, footprint);
              const ok = !!placementCheck?.ok;
              const tint = ok ? COLORS.success : COLORS.error;
              return (
                <>
                  {cells.map((c) => {
                    const { x, y } = cellCenterIso(c.row, c.col, ISO_CANVAS);
                    return (
                      <IsoTile
                        key={`${c.row}_${c.col}`}
                        x={x} y={y} w={ISO_TILE_W * 0.94} h={ISO_TILE_H * 0.94}
                        fill={tint + "55"} borderColor={tint} borderWidth={1.5}
                      />
                    );
                  })}
                </>
              );
            })()}
          </View>
        </ScrollView>
      </ScrollView>

      <View style={styles.hintRow}>
        <Ionicons name="hand-left-outline" size={13} color={COLORS.onSurfaceTertiary} />
        <Text style={styles.hintTxt}>
          {placement
            ? placementCheck?.ok
              ? "Looks good — Confirm below, or tap another cell to reposition."
              : placementCheck?.reason || "Tap a compatible, unlocked, unoccupied cell."
            : "Pan the grid and tap any cell or building. Open Sanctuary Inventory to build, move, or store."}
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

      {placement?.origin && (
        <View style={styles.confirmBar}>
          <Text style={styles.confirmBarTxt} numberOfLines={2}>
            {placementCheck?.ok ? "Confirm placement?" : placementCheck?.reason || "Invalid placement."}
          </Text>
          <View style={{ flexDirection: "row", gap: SPACING.sm }}>
            <Pressable style={styles.confirmBarCancel} onPress={exitPlacement} testID="realm-cancel-place">
              <Text style={styles.confirmBarCancelTxt}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBarConfirm, !placementCheck?.ok && styles.confirmBarConfirmDisabled]}
              onPress={confirmPlacement}
              disabled={!placementCheck?.ok}
              testID="realm-confirm-place"
            >
              <Text style={styles.confirmBarConfirmTxt}>Confirm</Text>
            </Pressable>
          </View>
        </View>
      )}

      <BuildingActionSheet
        building={selectedBuilding}
        originId={selectedOriginId}
        atriumLevel={atriumLevel}
        kingdomLevels={kingdomLevels}
        onClose={() => setSelectedBuildingId(null)}
        onMove={(b) => beginPlaceBuilding(b, true)}
        onStore={storeBuilding}
        router={router}
      />

      <InventoryDrawer
        visible={showInventory}
        onClose={() => setShowInventory(false)}
        unplaced={unplacedUnlocked}
        locked={lockedBuildings}
        placed={placedBuildings.map((p) => p.building)}
        atriumLevel={atriumLevel}
        kingdomLevels={kingdomLevels}
        onPickBuilding={(b) => beginPlaceBuilding(b, false)}
        onPickDecoration={beginPlaceDecoration}
        onMoveBuilding={(b) => beginPlaceBuilding(b, true)}
        onStoreBuilding={storeBuilding}
      />

      <LegendModal visible={showLegend} onClose={() => setShowLegend(false)} />
      <CustomizeModal visible={showCustomize} onClose={() => setShowCustomize(false)} />
      <DistrictInfoModal districtId={showDistrictInfo} onClose={() => setShowDistrictInfo(null)} layout={layout} />

      <TutorialOverlay />
    </SafeAreaView>
  );
}

const CATEGORY_LABEL: Record<BuildingCategory, string> = {
  core: "Core", learning: "Learning", care: "Care", supplies: "Supplies",
  wellness: "Wellness", economy: "Economy", defense: "Defense Support", faction: "Faction",
};

function BuildingActionSheet({
  building, originId, atriumLevel, kingdomLevels, onClose, onMove, onStore, router,
}: {
  building: RealmBuilding | null | undefined;
  originId: string | undefined;
  atriumLevel: number;
  kingdomLevels: Record<string, number>;
  onClose: () => void;
  onMove: (building: RealmBuilding) => void;
  onStore: (building: RealmBuilding) => void;
  router: ReturnType<typeof useRouter>;
}) {
  if (!building) return null;
  const unlocked = isBuildingUnlocked(building, atriumLevel);
  const lvl = kingdomLevels[building.kingdomLevelsKey] || 0;
  const req = building.requirementsForLevel(lvl);
  const district = REALM_DISTRICTS.find((d) => d.id === building.district);
  const color = DISTRICT_COLOR[district?.colorToken || "brand"];
  const footprint = getFootprint(building.id);
  const originCell = originId ? getCellById(originId) : null;

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

            <Text style={styles.sheetLabel}>ASSIGNMENTS</Text>
            {building.heroSlots.length ? (
              building.heroSlots.map((slot) => (
                <View key={slot.role} style={styles.slotRow}>
                  <Ionicons
                    name={(slot.slotType === "trainee" ? "school-outline" : slot.slotType === "mentor" ? "ribbon-outline" : "person-add-outline") as any}
                    size={14}
                    color={COLORS.brand}
                  />
                  <Text style={styles.slotTxt}>
                    <Text style={{ fontWeight: "700" }}>{slot.role}</Text>
                    {slot.slotType ? ` (${slot.slotType})` : ""} — {slot.flavor}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.sheetBody}>Assignments Coming Soon.</Text>
            )}
            <Text style={styles.sheetFootnote}>{"\n" + REALM_HERO_ASSIGNMENT_NOTE}</Text>

            <Text style={styles.sheetLabel}>FOOTPRINT</Text>
            <View style={styles.slotRow}>
              <Ionicons name="square-outline" size={14} color={COLORS.brand} />
              <Text style={styles.slotTxt}>
                {footprint.w}x{footprint.h} cells on any open buildable ground
                {originCell ? ` · currently on ${getCellLabel(originCell)} (${originId})` : ""}
              </Text>
            </View>
            <View style={styles.slotRow}>
              <Ionicons name="leaf-outline" size={14} color={COLORS.growth} />
              <Text style={styles.slotTxt}>{REALM_HARMONY_NOTE}</Text>
            </View>

            <Text style={styles.sheetLabel}>PLOT</Text>
            {building.movable ? (
              <View style={styles.slotRow}>
                <Ionicons name="move-outline" size={14} color={COLORS.brand} />
                <Text style={styles.slotTxt}>This building can be moved or stored via Sanctuary Inventory.</Text>
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

            <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg, flexWrap: "wrap" }}>
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
                  style={[styles.moveBtn, { flex: 1, marginTop: 0 }]}
                  onPress={() => onMove(building)}
                  testID={`realm-move-${building.id}`}
                >
                  <Ionicons name="move-outline" size={16} color={COLORS.onSurfaceSecondary} />
                  <Text style={styles.moveBtnTxt}>Move</Text>
                </Pressable>
              )}
              {unlocked && building.movable && (
                <Pressable
                  style={[styles.moveBtn, { flex: 1, marginTop: 0 }]}
                  onPress={() => onStore(building)}
                  testID={`realm-store-${building.id}`}
                >
                  <Ionicons name="archive-outline" size={16} color={COLORS.onSurfaceSecondary} />
                  <Text style={styles.moveBtnTxt}>Store</Text>
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

const CATEGORY_ICON: Record<BuildingCategory, string> = {
  core: "sparkles", learning: "school", care: "medkit", supplies: "leaf",
  wellness: "flower", economy: "business", defense: "shield-checkmark", faction: "flag",
};

function InventoryDrawer({
  visible, onClose, unplaced, locked, placed, atriumLevel, kingdomLevels,
  onPickBuilding, onPickDecoration, onMoveBuilding, onStoreBuilding,
}: {
  visible: boolean;
  onClose: () => void;
  unplaced: RealmBuilding[];
  locked: RealmBuilding[];
  placed: RealmBuilding[];
  atriumLevel: number;
  kingdomLevels: Record<string, number>;
  onPickBuilding: (b: RealmBuilding) => void;
  onPickDecoration: (d: RealmDecoration) => void;
  onMoveBuilding: (b: RealmBuilding) => void;
  onStoreBuilding: (b: RealmBuilding) => void;
}) {
  const [category, setCategory] = useState<BuildingCategory | "all">("all");
  const unplacedFiltered = category === "all" ? unplaced : unplaced.filter((b) => b.category === category);
  const lockedFiltered = category === "all" ? locked : locked.filter((b) => b.category === category);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()} testID="realm-inventory-sheet">
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetName}>Sanctuary Inventory</Text>
              <Text style={styles.sheetDistrict}>Build, move, and store your Realm's buildings</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.onSurfaceTertiary} />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: SPACING.xs, paddingVertical: SPACING.xs }}
            style={{ flexGrow: 0, marginBottom: SPACING.xs }}
          >
            <Pressable
              style={[styles.categoryChip, category === "all" && styles.categoryChipActive]}
              onPress={() => setCategory("all")}
              testID="realm-tray-category-all"
            >
              <Text style={[styles.categoryChipTxt, category === "all" && styles.categoryChipTxtActive]}>All</Text>
            </Pressable>
            {BUILDING_CATEGORIES.map((cat) => (
              <Pressable
                key={cat.id}
                style={[styles.categoryChip, category === cat.id && styles.categoryChipActive]}
                onPress={() => setCategory(cat.id)}
                testID={`realm-tray-category-${cat.id}`}
              >
                <Ionicons name={(CATEGORY_ICON[cat.id] || "cube-outline") as any} size={12} color={category === cat.id ? COLORS.onBrand : COLORS.onSurfaceSecondary} />
                <Text style={[styles.categoryChipTxt, category === cat.id && styles.categoryChipTxtActive]}>{CATEGORY_LABEL[cat.id]}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            {placed.length > 0 && (
              <>
                <Text style={styles.sheetLabel}>ON THE MAP</Text>
                {placed.map((b) => {
                  const color = CATEGORY_COLOR[b.category] || districtColorFor(b.district);
                  const footprint = getFootprint(b.id);
                  return (
                    <View key={b.id} style={styles.slotRow}>
                      <Ionicons name={b.icon as any} size={16} color={color} />
                      <Text style={[styles.slotTxt, { fontWeight: "700" }]}>{b.name}</Text>
                      <Text style={styles.sheetFootnote}>{footprint.w}x{footprint.h}</Text>
                      {b.movable && (
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          <Pressable onPress={() => onMoveBuilding(b)} hitSlop={6} testID={`realm-inventory-move-${b.id}`}>
                            <Ionicons name="move-outline" size={16} color={COLORS.onSurfaceSecondary} />
                          </Pressable>
                          <Pressable onPress={() => onStoreBuilding(b)} hitSlop={6} testID={`realm-inventory-store-${b.id}`}>
                            <Ionicons name="archive-outline" size={16} color={COLORS.onSurfaceSecondary} />
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}

            <Text style={styles.sheetLabel}>AVAILABLE TO BUILD</Text>
            {unplacedFiltered.length === 0 ? (
              <Text style={styles.sheetBody}>
                {unplaced.length === 0 ? "Every unlocked building is already on the map." : "No buildings in this category yet."}
              </Text>
            ) : (
              unplacedFiltered.map((b) => {
                const footprint = getFootprint(b.id);
                const color = CATEGORY_COLOR[b.category] || districtColorFor(b.district);
                return (
                  <Pressable key={b.id} style={styles.slotRow} onPress={() => onPickBuilding(b)} testID={`realm-inventory-build-${b.id}`}>
                    <Ionicons name={b.icon as any} size={18} color={color} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.slotTxt, { fontWeight: "700" }]}>{b.name}</Text>
                      <Text style={styles.sheetFootnote}>
                        {footprint.w}x{footprint.h} · {CATEGORY_LABEL[b.category] || "Building"} · {b.purpose}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.onSurfaceTertiary} />
                  </Pressable>
                );
              })
            )}

            <Text style={styles.sheetLabel}>LOCKED</Text>
            {lockedFiltered.map((b) => (
              <View key={b.id} style={styles.slotRow}>
                <Ionicons name="lock-closed-outline" size={16} color={COLORS.onSurfaceTertiary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.slotTxt}>{b.name}</Text>
                  <Text style={styles.sheetFootnote}>Requires Grand Ward Atrium Lv.{b.atriumLevelRequired} (currently Lv.{atriumLevel}).</Text>
                </View>
              </View>
            ))}

            <Text style={styles.sheetLabel}>DECORATIONS</Text>
            {DECORATIONS.map((d) => (
              <Pressable key={d.id} style={styles.decorRow} onPress={() => onPickDecoration(d)} testID={`realm-inventory-decor-${d.id}`}>
                <Ionicons name={d.icon as any} size={20} color={PLOT_TYPE_COLOR.decoration} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.decorName}>{d.name}</Text>
                  <Text style={styles.decorFlavor}>{d.flavor}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.onSurfaceTertiary} />
              </Pressable>
            ))}

            <Text style={styles.sheetLabel}>ROADS & PATHS</Text>
            <View style={styles.comingSoonBox}>
              <Ionicons name="trail-sign-outline" size={14} color={COLORS.onSurfaceTertiary} />
              <Text style={styles.comingSoonTxt}>
                Roads connect automatically — every building you place gets a path back to the Grand Ward Atrium.
                There's nothing to place manually.
              </Text>
            </View>

            <Text style={styles.sheetLabel}>FUTURE BUILDING SKINS</Text>
            {REALM_SKIN_EXAMPLES.map((skin) => (
              <View key={skin.name} style={styles.slotRow}>
                <Ionicons name="color-wand-outline" size={14} color={COLORS.brand} />
                <Text style={styles.slotTxt}><Text style={{ fontWeight: "700" }}>{skin.name}</Text> — applies to {skin.appliesTo}</Text>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DistrictInfoModal({ districtId, onClose, layout }: { districtId: string | null; onClose: () => void; layout: Record<string, string> }) {
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
            <Text style={styles.sheetLabel}>DISTRICT BUILDINGS</Text>
            {buildings.map((b) => (
              <View key={b.id} style={styles.slotRow}>
                <Ionicons name={b.icon as any} size={14} color={color} />
                <Text style={styles.slotTxt}>{b.name}{layout[b.id] ? "" : " (in Sanctuary Inventory)"}</Text>
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
              The Grand Ward Sanctuary is your healing realm — a place to build, heal, research,
              and grow, not to raid or defend against other players. The Grand Ward Atrium is the
              town hall — its level unlocks every other building. Open Sanctuary Inventory to place
              buildings and decorations on compatible plots, and tap any placed building on the grid
              to Open, Move, or Store it. Roads connect automatically — there's nothing to build there.
            </Text>
            <Text style={styles.sheetLabel}>THE SANCTUARY LOOP</Text>
            <Text style={styles.sheetBody}>{REALM_LOOP_NOTE}</Text>
            <Text style={styles.sheetLabel}>ATRIUM PROGRESSION</Text>
            {ATRIUM_UNLOCKS.map((u) => (
              <Text key={u.level} style={styles.sheetBody}>Lv.{u.level}: {u.note}</Text>
            ))}
            <Text style={styles.sheetLabel}>REALM SYSTEMS</Text>
            <View style={styles.slotRow}>
              <Ionicons name="git-network-outline" size={14} color={COLORS.brand} />
              <Text style={styles.slotTxt}><Text style={{ fontWeight: "700" }}>District Identity</Text> — {DISTRICT_IDENTITY_NOTE}</Text>
            </View>
            <View style={styles.slotRow}>
              <Ionicons name="home-outline" size={14} color={COLORS.brand} />
              <Text style={styles.slotTxt}><Text style={{ fontWeight: "700" }}>Hero Residency</Text> — {HERO_RESIDENCY_NOTE}</Text>
            </View>
            <View style={styles.slotRow}>
              <Ionicons name="medkit-outline" size={14} color={COLORS.brand} />
              <Text style={styles.slotTxt}><Text style={{ fontWeight: "700" }}>Care Pathways</Text> — {CARE_PATHWAYS_NOTE}</Text>
            </View>
            <View style={styles.slotRow}>
              <Ionicons name="chatbubbles-outline" size={14} color={COLORS.brand} />
              <Text style={styles.slotTxt}><Text style={{ fontWeight: "700" }}>Sanctuary Requests</Text> — {SANCTUARY_REQUESTS_NOTE}</Text>
            </View>
            <View style={styles.slotRow}>
              <Ionicons name="sparkles-outline" size={14} color={COLORS.brand} />
              <Text style={styles.slotTxt}><Text style={{ fontWeight: "700" }}>Realm Harmony</Text> — {REALM_HARMONY_NOTE}</Text>
            </View>
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
    { icon: "trail-sign-outline", label: "Roads & Paths", note: "Decorative styles for the auto-generated road network." },
    { icon: "flame-outline", label: "Lanterns & Banners", note: "Small decorations already placeable via Sanctuary Inventory." },
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
            <Text style={styles.sheetLabel}>SAMPLE REALM SKINS</Text>
            {REALM_SKIN_EXAMPLES.map((skin) => (
              <View key={skin.name} style={styles.slotRow}>
                <Ionicons name="color-wand-outline" size={14} color={COLORS.brand} />
                <Text style={styles.slotTxt}><Text style={{ fontWeight: "700" }}>{skin.name}</Text> — applies to {skin.appliesTo}</Text>
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
  modeBtnTxt: { color: COLORS.brand, fontSize: 12, fontWeight: "700" },
  cancelBtn: { paddingHorizontal: SPACING.sm, paddingVertical: 8 },
  cancelBtnTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },

  bannerBox: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xs,
    backgroundColor: COLORS.brand + "18",
  },
  bannerTxt: { color: COLORS.brand, fontSize: 11, flex: 1, fontWeight: "600" },

  gridWrap: { position: "relative", backgroundColor: COLORS.surface },
  lockBadge: {
    position: "absolute", top: "50%", left: "50%", marginLeft: -8, marginTop: -8,
    width: 16, height: 16, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  buildingTileFallback: {
    position: "absolute", borderWidth: 2, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
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
  confirmBarConfirmDisabled: { backgroundColor: COLORS.border },
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
  categoryChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.border },
  categoryChipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  categoryChipTxt: { color: COLORS.onSurfaceSecondary, fontSize: 11, fontWeight: "700" },
  categoryChipTxtActive: { color: COLORS.onBrand },
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
