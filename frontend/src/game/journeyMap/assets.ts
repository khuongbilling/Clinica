/**
 * journeyMap/assets.ts
 *
 * Single typed index for every asset used by the fog-map renderer.
 * All 28 WebP files under frontend/public/assets/ui/journey/ are
 * declared here so paths are never duplicated across components and
 * never break silently when assets are renamed.
 *
 * Verification:
 *   node frontend/scripts/check-journey-assets.js
 *
 * Nothing in this file imports from React, Expo, or any UI layer.
 *
 * IMPORTANT: every require() argument must be a static string literal.
 * Metro (and the check script) cannot resolve dynamic template literals.
 */

export const JOURNEY_ASSETS = {
  /** Hex tile states rendered on the fog map. */
  tiles: {
    /** Tile the player is currently standing on. */
    current:  require('../../../public/assets/ui/journey/tiles/hex-current.webp'),
    /** Tile visible but not yet visited (frontier). */
    frontier: require('../../../public/assets/ui/journey/tiles/hex-frontier.webp'),
    /** Tile still covered by fog (unknown). */
    hidden:   require('../../../public/assets/ui/journey/tiles/hex-hidden.webp'),
    /** Tile that has been visited and revealed. */
    revealed: require('../../../public/assets/ui/journey/tiles/hex-revealed.webp'),
    /** Tile highlighted when the player taps to select it. */
    selected: require('../../../public/assets/ui/journey/tiles/hex-selected.webp'),
  },

  /** Encounter icons shown on revealed tiles. */
  encounters: {
    /** Mini-boss / area-boss encounter. */
    areaBoss:       require('../../../public/assets/ui/journey/encounters/area-boss.webp'),
    /** Standard combat encounter. */
    battle:         require('../../../public/assets/ui/journey/encounters/battle.webp'),
    /** Travelling merchant encounter. */
    merchant:       require('../../../public/assets/ui/journey/encounters/merchant.webp'),
    /** Common-tier treasure chest. */
    treasureBronze: require('../../../public/assets/ui/journey/encounters/treasure-bronze.webp'),
    /** Rare-tier treasure chest. */
    treasureGold:   require('../../../public/assets/ui/journey/encounters/treasure-gold.webp'),
    /** Uncommon-tier treasure chest. */
    treasureSilver: require('../../../public/assets/ui/journey/encounters/treasure-silver.webp'),
  },

  /** Chapter-boss gate assets. */
  gate: {
    /** Boss gate in the locked (not yet unlocked) state. */
    locked:      require('../../../public/assets/ui/journey/gate/chapter-boss-gate-locked.webp'),
    /** Boss gate in the unlocked (ready to enter) state. */
    unlocked:    require('../../../public/assets/ui/journey/gate/chapter-boss-gate-unlocked.webp'),
    /** Lock icon overlaid on a locked gate. */
    lock:        require('../../../public/assets/ui/journey/gate/chapter-boss-lock.webp'),
    /** Key fragment collectible shown near the gate. */
    keyFragment: require('../../../public/assets/ui/journey/gate/key-fragment.webp'),
  },

  /** Map legend / key icons (smaller versions of encounter icons). */
  legend: {
    areaBoss: require('../../../public/assets/ui/journey/legend/area-boss.webp'),
    battle:   require('../../../public/assets/ui/journey/legend/battle.webp'),
    merchant: require('../../../public/assets/ui/journey/legend/merchant.webp'),
    treasure: require('../../../public/assets/ui/journey/legend/treasure.webp'),
  },

  /** Overall map chrome assets. */
  map: {
    /** Decorative platform/background behind the hex grid. */
    platformBackground: require('../../../public/assets/ui/journey/map/map-platform-background.webp'),
    /** Token representing the player's current position on the map. */
    playerToken:        require('../../../public/assets/ui/journey/map/player-map-token.webp'),
  },

  /** Chapter header / reward UI assets. */
  chapter: {
    /** Placeholder artwork shown in the chapter banner. */
    artPlaceholder: require('../../../public/assets/ui/journey/chapter/chapter-art-placeholder.webp'),
    /** Decorative frame around chapter completion rewards. */
    rewardFrame:    require('../../../public/assets/ui/journey/chapter/chapter-reward-frame.webp'),
  },

  /**
   * Fog system runtime assets — Pushes 4 & 5.
   * These are loaded via require() so Metro bundles them; the resolved URI
   * is obtained at runtime via Image.resolveAssetSource() in fogBase/fogMid.
   * Do NOT reference these via raw '/assets/...' URI strings — Metro's dev
   * server does not serve public/ as a static file tree.
   */
  fog: {
    /** Layer 2 — Base Fog primary dense coverage (PASS). */
    baseDay:  require('../../../public/assets/journey/fog/day/fog_base_day_01.png'),
    /** Layer 3 — Mid Fog atmospheric texture (PASS). */
    midDay:   require('../../../public/assets/journey/fog/day/fog_mid_day_01.png'),
    /** Layer 4 — Edge fog (future push). */
    edgeDay:  require('../../../public/assets/journey/fog/day/fog_edge_day_01.png'),
    /** Layer 5 — Foreground wisps (future push). */
    wispDay:  require('../../../public/assets/journey/fog/day/fog_wisp_day_01.png'),
  },
} as const;

/** Convenience type — the resolved shape of JOURNEY_ASSETS. */
export type JourneyAssets = typeof JOURNEY_ASSETS;
