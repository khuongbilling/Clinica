// Action-packed splash illustrations of the healer heroes battling
// disease-monsters, shown on the preloader screen. Each scene features MULTIPLE
// varied heroes (not just one) so the loading art reflects the full party.
// One is picked at random each time the loading screen shows.
// Add new art here to include it in both the rotation and the launch preload.
export const LOADING_ART: number[] = [
  require("../../assets/loading/party_01_charge.png"),
  require("../../assets/loading/party_02_backtoback.png"),
  require("../../assets/loading/party_03_summit.png"),
];

export function randomLoadingArt(): number {
  return LOADING_ART[Math.floor(Math.random() * LOADING_ART.length)];
}
