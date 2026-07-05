import { Image as RNImage, Platform } from "react-native";
import { Image as ExpoImage } from "expo-image";

// Fully decode a URL through a real HTMLImageElement so the browser's own image
// cache is populated AND the bitmap is decoded. Resolves (never rejects) so one
// bad asset can't block the batch.
function decodeInBrowser(uri: string): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      const img = new window.Image();
      const done = () => resolve();
      img.onload = () => {
        // decode() guarantees the bitmap is ready to paint; fall back to onload.
        if (typeof img.decode === "function") img.decode().then(done, done);
        else done();
      };
      img.onerror = () => resolve();
      img.src = uri;
    } catch {
      resolve();
    }
  });
}

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

  // On web the Realm paints terrain through react-native-svg <image> and
  // buildings through RN <Image> — both read the browser's NATIVE image cache,
  // which expo-image's prefetch does not populate. So decode straight through
  // real HTMLImageElements (the exact cache those elements use) instead of
  // double-downloading via expo-image too. A ceiling keeps a slow/huge asset
  // from ever hanging the loading screen — anything still in flight keeps
  // warming in the background and paints moments later.
  if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.Image === "function") {
    const decodeAll = Promise.all(uris.map(decodeInBrowser)).then(() => undefined);
    const ceiling = new Promise<void>((resolve) => setTimeout(resolve, 12000));
    await Promise.race([decodeAll, ceiling]);
    return;
  }

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
