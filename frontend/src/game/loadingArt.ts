// Comedic, action-packed splash illustrations of the healer heroine battling
// disease-monsters. One is picked at random each time the loading screen shows.
// Add new art here to include it in both the rotation and the launch preload.
export const LOADING_ART: number[] = [
  require("../../assets/loading/scene_01_lantern_rocket.png"),
  require("../../assets/loading/scene_02_thermometer_bat.png"),
  require("../../assets/loading/scene_03_water_surf.png"),
  require("../../assets/loading/scene_04_swarm_panic.png"),
  require("../../assets/loading/scene_05_drake_flex.png"),
  require("../../assets/loading/scene_06_syringe_sneak.png"),
  require("../../assets/loading/scene_07_back_to_back.png"),
  require("../../assets/loading/scene_08_banana_slip.png"),
];

export function randomLoadingArt(): number {
  return LOADING_ART[Math.floor(Math.random() * LOADING_ART.length)];
}
