import { Image as RNImage } from "react-native";
import { Image as ExpoImage } from "expo-image";

// Every image the Realm/Sanctuary screen renders. Kept in one place so the
// loading screen can warm the browser/native cache ahead of time instead of the
// map fetching + decoding ~21MB of PNGs on mount (which is what made the Realm
// feel slow to open on the first visit).
const REALM_IMAGE_MODULES: number[] = [
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
  // Loading screen art
  require("../../assets/realm/ui/parchment_scroll.png"),
];

let preloadPromise: Promise<void> | null = null;

// Prefetch (download + cache) all realm images. Idempotent: the work runs once
// per session and subsequent callers await the same promise. Best-effort — a
// prefetch failure must never block the Realm from opening.
export function preloadRealmAssets(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    const uris = REALM_IMAGE_MODULES
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
  })();
  return preloadPromise;
}
