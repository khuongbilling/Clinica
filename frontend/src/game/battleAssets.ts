// Battle-scene image modules, gathered here so the launch preloader can warm
// them BEFORE the first fight. On native devices a large, un-decoded background
// PNG can paint as a white frame the moment a battle mounts (notably the
// scripted prologue boss) — pre-decoding every stage background and enemy
// portrait up front prevents that blank flash.
import { ENEMY_SPRITE_MODULES } from "@/src/components/EnemySprites";

// The default ward stage plus one background per body-system (see SYSTEM_BG in
// BattlefieldScene). Keep this list in sync with the battle_bg assets folder.
export const BATTLE_BG_MODULES: number[] = [
  require("../../assets/images/ward_battle_bg.png"),
  require("../../assets/images/battle_bg/air.png"),
  require("../../assets/images/battle_bg/river.png"),
  require("../../assets/images/battle_bg/fire.png"),
  require("../../assets/images/battle_bg/energy.png"),
  require("../../assets/images/battle_bg/storm.png"),
  require("../../assets/images/battle_bg/mind.png"),
  require("../../assets/images/battle_bg/filter.png"),
  require("../../assets/images/battle_bg/forge.png"),
  require("../../assets/images/battle_bg/protection.png"),
  require("../../assets/images/battle_bg/growth.png"),
];

export const BATTLE_IMAGE_MODULES: number[] = [
  ...BATTLE_BG_MODULES,
  ...(ENEMY_SPRITE_MODULES as unknown as number[]),
];
