import { Image as RNImage } from "react-native";
import { Image as ExpoImage } from "expo-image";

// Prefetch (download + cache) a list of image modules. Resolves each require()
// module to a URI, then warms the expo-image cache. Best-effort — a failure must
// never block or crash the caller. (expo-asset is not installed; expo-image's
// prefetch is the cross-platform way to warm the cache here.)
export async function prefetchModules(modules: number[]): Promise<void> {
  const uris = modules
    .map((m) => {
      try {
        return RNImage.resolveAssetSource(m)?.uri ?? null;
      } catch {
        return null;
      }
    })
    .filter((u): u is string => !!u);
  try {
    await ExpoImage.prefetch(uris);
  } catch {
    // Ignore — the images will still load lazily when rendered.
  }
}

// Every image the Realm/Sanctuary screen renders. Kept in one place so it can be
// warmed ahead of time instead of the map fetching + decoding ~21MB of PNGs on
// mount (which is what made the Realm feel slow to open on the first visit).
export const REALM_IMAGE_MODULES: number[] = [
  // Terrain textures (SVG pattern fills in IsoTerrain)
  require("../../assets/realm/terrain/grass.png"),
  require("../../assets/realm/terrain/meadow.png"),
  require("../../assets/realm/terrain/path.png"),
  require("../../assets/realm/terrain/water.png"),
  require("../../assets/realm/terrain/forest.png"),
  require("../../assets/realm/terrain/mountain.png"),
  require("../../assets/realm/terrain/stone.png"),
  // Building sprites
  require("../../assets/realm/buildings/grand_ward_atrium.png"),
  require("../../assets/realm/buildings/clinica_university.png"),
  require("../../assets/realm/buildings/research_library.png"),
  require("../../assets/realm/buildings/hospital_ward.png"),
  require("../../assets/realm/buildings/hall_of_heroes.png"),
  require("../../assets/realm/buildings/apothecary.png"),
  require("../../assets/realm/buildings/sanctuary_bank.png"),
  require("../../assets/realm/buildings/sanctuary_bazaar.png"),
  require("../../assets/realm/buildings/nutrition_garden.png"),
  require("../../assets/realm/buildings/ward_defense_tower.png"),
  require("../../assets/realm/buildings/faction_embassy.png"),
];

let preloadPromise: Promise<void> | null = null;

// Warm just the Realm's images. Idempotent (single shared promise). Used by the
// Realm loading screen so it can reveal the map once the textures are ready.
export function preloadRealmAssets(): Promise<void> {
  if (!preloadPromise) preloadPromise = prefetchModules(REALM_IMAGE_MODULES);
  return preloadPromise;
}
