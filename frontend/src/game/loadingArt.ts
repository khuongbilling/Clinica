// Comedic donghua / manhwa / anime splash illustrations of the healer heroes
// facing the disease-blob monsters, shown on the preloader / loading screen.
// Each scene features one or more heroes together with one or more enemies and
// leans into a light comedic gag. One is picked at random each time the loading
// screen shows, so the art rotates between appearances.
// ART STYLE: donghua / manhwa / anime (see replit.md User preferences) — keep
// all future art in this style. Add new art here to include it in both the
// rotation and the launch preload.
export const LOADING_ART: number[] = [
  require("../../assets/loading/anime_01_charge.png"),
  require("../../assets/loading/anime_02_lantern_bonk.png"),
  require("../../assets/loading/anime_03_fire_flex.png"),
  require("../../assets/loading/anime_04_water_surf.png"),
  require("../../assets/loading/anime_05_tea_confuse.png"),
  require("../../assets/loading/anime_06_back_to_back.png"),
];

export function randomLoadingArt(): number {
  return LOADING_ART[Math.floor(Math.random() * LOADING_ART.length)];
}
