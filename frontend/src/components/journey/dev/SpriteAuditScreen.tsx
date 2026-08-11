/**
 * DEV-ONLY — Map Sprite Alpha Audit Screen
 *
 * Renders every raster asset used by (or formerly used by) the fog-map
 * renderer over three contrasting backgrounds:
 *
 *   ■ White       — exposes dark fringing and near-opaque halos
 *   ■ Black       — exposes light fringing and white rectangular canvases
 *   ☐ Checker     — exposes any non-transparent region unambiguously
 *
 * Acceptance: no rectangular backing, no opaque halo, no colour matte.
 *
 * Status badges:
 *   PASS   — clean transparency, production-ready
 *   FLAG   — transparent bg but has a known minor issue worth tracking
 *   LEGACY — asset exists but is no longer rendered in production code
 *   REJECT — failed audit; must not be used in production
 *
 * This component is NEVER rendered in production builds.
 * The parent route (/journey/sprite-audit) redirects when !__DEV__.
 */
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

// ── Audit catalogue ───────────────────────────────────────────────────────────

type AuditStatus = 'pass' | 'flag' | 'legacy' | 'reject';

interface AuditEntry {
  key:    string;
  label:  string;
  src:    number;
  status: AuditStatus;
  note?:  string;
}

// Push 19: explorer sprite — default chibi shown when player has no class yet
const PLAYER_TOKEN: AuditEntry[] = [
  {
    key:    'sprite-explorer',
    label:  'Explorer Sprite (no-class default)',
    src:    require('@/assets/map-sprites/map_sprite_explorer.png') as number,
    status: 'pass',
    note:   'Donghua chibi: teal-jade longcoat, black hair, baked contact shadow at feet. '
          + 'Rendered in Layer 4b via MAP_SPRITE_EXPLORER when player.class_tree_id is null. '
          + 'Replaces jade medallion token (Push 19). Jade glow (Layer 4a) fires for this sprite.',
  },
  {
    key:    'player-token',
    label:  'Player Token — jade medallion (LEGACY)',
    src:    require('@/assets/ui/journey/map/player-map-token.webp') as number,
    status: 'legacy',
    note:   'Replaced in Layer 4b by the Explorer Sprite (Push 19). '
          + 'Still bundled; remove once the new sprite is confirmed in production.',
  },
];

// Player map sprites — one per class tree
const PLAYER_SPRITES: AuditEntry[] = [
  {
    key:    'sprite-medic',
    label:  'Sprite — Medic',
    src:    require('@/assets/map-sprites/map_sprite_medic.png') as number,
    status: 'pass',
  },
  {
    key:    'sprite-guardian',
    label:  'Sprite — Guardian',
    src:    require('@/assets/map-sprites/map_sprite_guardian.png') as number,
    status: 'flag',
    note:   'Baked-in gray contact-shadow ellipse at feet (intentional art). '
          + 'Layer 4a also draws an SVG dark-navy shadow → double shadow visible at runtime. '
          + 'Background is fully transparent; no rectangular backing. '
          + 'Consider removing the baked shadow from the source art.',
  },
  {
    key:    'sprite-alchemist',
    label:  'Sprite — Alchemist',
    src:    require('@/assets/map-sprites/map_sprite_alchemist.png') as number,
    status: 'pass',
  },
  {
    key:    'sprite-seer',
    label:  'Sprite — Seer',
    src:    require('@/assets/map-sprites/map_sprite_seer.png') as number,
    status: 'pass',
  },
  {
    key:    'sprite-scholar',
    label:  'Sprite — Scholar',
    src:    require('@/assets/map-sprites/map_sprite_scholar.png') as number,
    status: 'flag',
    note:   'Baked-in gray contact-shadow ellipse at feet — same double-shadow concern as Guardian. '
          + 'Background transparent; no rectangular backing.',
  },
  {
    key:    'sprite-caretaker',
    label:  'Sprite — Caretaker',
    src:    require('@/assets/map-sprites/map_sprite_caretaker.png') as number,
    status: 'pass',
    note:   'Lantern glow creates soft luminous halo of semi-transparent warm-yellow pixels. '
          + 'Intentional art — not a rectangular matte.',
  },
];

// Encounter nodes — 2.5D world objects on the fog map
const ENCOUNTER_NODES: AuditEntry[] = [
  {
    key:    'enc-battle',
    label:  'Battle Pedestal',
    src:    require('@/assets/map-nodes/encounter_battle.png') as number,
    status: 'pass',
  },
  {
    key:    'enc-merchant',
    label:  'Merchant Cart',
    src:    require('@/assets/map-nodes/encounter_merchant.png') as number,
    status: 'pass',
  },
  {
    key:    'enc-boss',
    label:  'Area Boss',
    src:    require('@/assets/map-nodes/encounter_area_boss.png') as number,
    status: 'pass',
    note:   'Teal flame tendrils use feathered alpha at their tips — intentional. No rectangular backing.',
  },
  {
    key:    'enc-bronze',
    label:  'Chest — Bronze',
    src:    require('@/assets/map-nodes/encounter_chest_bronze.png') as number,
    status: 'pass',
  },
  {
    key:    'enc-silver',
    label:  'Chest — Silver',
    src:    require('@/assets/map-nodes/encounter_chest_silver.png') as number,
    status: 'pass',
  },
  {
    key:    'enc-gold',
    label:  'Chest — Gold (Push 9)',
    src:    require('@/assets/map-nodes/encounter_chest_gold.png') as number,
    status: 'pass',
    note:   'Generated Push 9. Replaces node_reward_medical_chest.png which had a baked white background '
          + 'and a non-isometric (front-facing) perspective inconsistent with bronze/silver.',
  },
];

// Push 20: Ward event world-object props — one per WardEventSubtype group
const WARD_EVENT_NODES: AuditEntry[] = [
  {
    key:    'ward-npc',
    label:  'Ward NPC — Ally Beacon (support_ally)',
    src:    require('@/assets/map-nodes/encounter_ward_npc.png') as number,
    status: 'pass',
    note:   'Jade-lit lantern post on caduceus plinth. Teal shadow pool (rgba 0,180,150,0.28). '
          + 'Baked contact shadow at plinth base.',
  },
  {
    key:    'ward-patient',
    label:  'Ward Patient Bed (patient_family_team / handoff / surveillance)',
    src:    require('@/assets/map-nodes/encounter_ward_patient.png') as number,
    status: 'pass',
    note:   'Clinical fantasy bed with teal privacy curtain. Shared across all three patient subtypes. '
          + 'Shift distinction surfaced in UI modal, not on map.',
  },
  {
    key:    'ward-shrine',
    label:  'Ward Blessing Shrine (ward_blessing)',
    src:    require('@/assets/map-nodes/encounter_ward_shrine.png') as number,
    status: 'pass',
    note:   'Tiered jade altar with floating lotus orb. Teal-jade luminous shadow pool (rgba 0,200,160,0.35). '
          + 'Feathered teal mist at base is intentional; not a rectangular matte.',
  },
  {
    key:    'ward-protocol',
    label:  'Ward Protocol Card Lectern (protocol_card)',
    src:    require('@/assets/map-nodes/encounter_ward_protocol.png') as number,
    status: 'pass',
    note:   'Clinical document lectern with caduceus parchment and wax seal on chain.',
  },
  {
    key:    'ward-supply',
    label:  'Ward Supply Station (resource_service)',
    src:    require('@/assets/map-nodes/encounter_ward_supply.png') as number,
    status: 'pass',
    note:   'Two-tier medical trolley with IV bag, bandages, surgical tools, supply crate.',
  },
  {
    key:    'ward-hazard',
    label:  'Ward Hazard Marker (ward_hazard)',
    src:    require('@/assets/map-nodes/encounter_ward_hazard.png') as number,
    status: 'pass',
    note:   'Overturned biohazard container, lava-like spill, warning cones on cobblestone base. '
          + 'Red-orange shadow pool (rgba 220,50,0,0.38). Circular base is part of the art — not a matte.',
  },
];

// Rejected assets — DO NOT use in production
const REJECTED: AuditEntry[] = [
  {
    key:    'rej-gold-old',
    label:  'node_reward_medical_chest.png  [REJECTED]',
    src:    require('@/assets/map-nodes/node_reward_medical_chest.png') as number,
    status: 'reject',
    note:   'White background baked in. Front-facing perspective (not isometric). '
          + 'Replaced by encounter_chest_gold.png in Push 9.',
  },
];

// Hex tile overlays — transparent ✅ but no longer rendered per-tile since Push 2.
// Terrain images were removed; the chapter background painting is the environment.
// These assets are kept in the repo for reference / possible future re-use.
const TILE_OVERLAYS_LEGACY: AuditEntry[] = [
  {
    key:    'hex-current-night',
    label:  'Hex — Current (night)',
    src:    require('@/assets/ui/journey/tiles/hex-current.webp') as number,
    status: 'legacy',
    note:   'Not rendered since Push 2. Current-tile state uses SVG jade ring (Layer 1a).',
  },
  {
    key:    'hex-frontier-night',
    label:  'Hex — Frontier (night)',
    src:    require('@/assets/ui/journey/tiles/hex-frontier.webp') as number,
    status: 'legacy',
    note:   'Not rendered since Push 2. visibleNow state uses SVG jade rim (Layer 2a).',
  },
  {
    key:    'hex-revealed-night',
    label:  'Hex — Revealed/Explored (night)',
    src:    require('@/assets/ui/journey/tiles/hex-revealed.webp') as number,
    status: 'legacy',
    note:   'Not rendered since Push 2. exploredButOutOfVision uses SVG hairline (Layer 2b).',
  },
  {
    key:    'hex-selected',
    label:  'Hex — Selected',
    src:    require('@/assets/ui/journey/tiles/hex-selected.webp') as number,
    status: 'legacy',
    note:   'No selected-state in TileVisibility type. Asset was never wired to the renderer.',
  },
  {
    key:    'hex-hidden',
    label:  'Hex — Hidden / Fog',
    src:    require('@/assets/ui/journey/tiles/hex-hidden.webp') as number,
    status: 'legacy',
    note:   'Not rendered since Push 4. Fog is a continuous JourneyFogLayer (canvas/SVG), not per-tile.',
  },
];

const ALL_SECTIONS: Array<{ title: string; entries: AuditEntry[] }> = [
  { title: 'Player Token',                        entries: PLAYER_TOKEN },
  { title: 'Player Map Sprites',                  entries: PLAYER_SPRITES },
  { title: 'Encounter Nodes — Active Production',         entries: ENCOUNTER_NODES },
  { title: 'Ward Event Props — Push 20 (future-gated)',   entries: WARD_EVENT_NODES },
  { title: 'Rejected Assets',                             entries: REJECTED },
  { title: 'Hex Tile Overlays (LEGACY — unused)', entries: TILE_OVERLAYS_LEGACY },
];

// ── Status badge colours ──────────────────────────────────────────────────────

const STATUS_COLOR: Record<AuditStatus, string> = {
  pass:   '#4ade80',   // green
  flag:   '#fbbf24',   // amber
  legacy: '#60a5fa',   // blue
  reject: '#f87171',   // red
};
const STATUS_LABEL: Record<AuditStatus, string> = {
  pass:   'PASS',
  flag:   'FLAG',
  legacy: 'LEGACY',
  reject: 'REJECT',
};

// ── Checkerboard background ───────────────────────────────────────────────────
// Web:    CSS repeating-conic-gradient — no SVG ID collision in the DOM.
// Native: SVG Pattern with a stable useRef ID per component instance.

const SWATCH = 140;

function CheckerboardBg({ sz }: { sz: number }) {
  const patId = React.useRef(`cb-${Math.random().toString(36).slice(2, 8)}`).current;

  if (Platform.OS === 'web') {
    // CSS trick — works in every modern browser, zero SVG ID concerns.
    return (
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { background: 'repeating-conic-gradient(#bbb 0% 25%,#fff 0% 50%) 0 0/20px 20px' } as any,
        ]}
      />
    );
  }

  const cell = 10;
  return (
    <Svg width={sz} height={sz} style={StyleSheet.absoluteFillObject}>
      <Defs>
        <Pattern
          id={patId}
          x="0" y="0"
          width={cell * 2} height={cell * 2}
          patternUnits="userSpaceOnUse"
        >
          <Rect x="0"    y="0"    width={cell} height={cell} fill="#bbb" />
          <Rect x={cell} y={cell} width={cell} height={cell} fill="#bbb" />
          <Rect x={cell} y="0"    width={cell} height={cell} fill="#fff" />
          <Rect x="0"    y={cell} width={cell} height={cell} fill="#fff" />
        </Pattern>
      </Defs>
      <Rect width={sz} height={sz} fill={`url(#${patId})`} />
    </Svg>
  );
}

// ── Single swatch cell ────────────────────────────────────────────────────────

type BgVariant = 'white' | 'black' | 'checker';

function Swatch({ src, bg }: { src: number; bg: BgVariant }) {
  return (
    <View
      style={{
        width: SWATCH, height: SWATCH, borderRadius: 6, overflow: 'hidden',
        backgroundColor: bg === 'white' ? '#ffffff' : bg === 'black' ? '#000000' : undefined,
      }}
    >
      {bg === 'checker' && <CheckerboardBg sz={SWATCH} />}
      <Image
        source={src}
        style={{ position: 'absolute', top: 0, left: 0, width: SWATCH, height: SWATCH }}
        contentFit="contain"
      />
    </View>
  );
}

// ── Per-entry row ─────────────────────────────────────────────────────────────

function EntryRow({ entry }: { entry: AuditEntry }) {
  const badgeColor = STATUS_COLOR[entry.status];
  return (
    <View style={styles.row}>
      {/* Label + badge */}
      <View style={styles.rowHeader}>
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{STATUS_LABEL[entry.status]}</Text>
        </View>
        <Text style={styles.rowLabel} numberOfLines={1}>{entry.label}</Text>
      </View>

      {/* Three background swatches */}
      <View style={styles.swatchRow}>
        {(['white', 'black', 'checker'] as BgVariant[]).map(bg => (
          <View key={bg} style={styles.swatchCol}>
            <Swatch src={entry.src} bg={bg} />
            <Text style={styles.swatchLabel}>{bg.charAt(0).toUpperCase() + bg.slice(1)}</Text>
          </View>
        ))}
      </View>

      {/* Note */}
      {entry.note != null && (
        <Text style={styles.note}>↳ {entry.note}</Text>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SpriteAuditScreen() {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚠ DEV ONLY — Map Sprite Alpha Audit</Text>
        <Text style={styles.headerSub}>
          Each asset rendered over White / Black / Checkerboard.{'\n'}
          Rectangular backing, fringing, or opaque halos are immediately obvious.{'\n'}
          Route: /journey/sprite-audit — production builds redirect to /.
        </Text>
        {/* Legend */}
        <View style={styles.legend}>
          {(Object.keys(STATUS_COLOR) as AuditStatus[]).map(s => (
            <View key={s} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: STATUS_COLOR[s] }]} />
              <Text style={styles.legendText}>{STATUS_LABEL[s]}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Sections ── */}
      {ALL_SECTIONS.map(section => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.entries.map(entry => (
            <EntryRow key={entry.key} entry={entry} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: '#111827' },
  content:      { padding: 20, paddingBottom: 80 },

  header:       { marginBottom: 28 },
  headerTitle:  { color: '#ef4444', fontWeight: '800', fontSize: 18, letterSpacing: 0.4 },
  headerSub:    { color: '#6b7280', fontSize: 12, marginTop: 8, lineHeight: 18 },

  legend:       { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:    { width: 8, height: 8, borderRadius: 2 },
  legendText:   { color: '#9ca3af', fontSize: 11 },

  section:      { marginBottom: 36 },
  sectionTitle: {
    color: '#d1d5db', fontWeight: '700', fontSize: 14, marginBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#374151', paddingBottom: 8,
  },

  row:          { marginBottom: 24 },
  rowHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  badge:        { borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText:    { color: '#000', fontWeight: '700', fontSize: 10 },
  rowLabel:     { color: '#e5e7eb', fontSize: 12, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, flex: 1 },

  swatchRow:    { flexDirection: 'row', gap: 10 },
  swatchCol:    { alignItems: 'center', gap: 4 },
  swatchLabel:  { color: '#6b7280', fontSize: 9 },

  note:         { color: '#9ca3af', fontSize: 10, marginTop: 6, lineHeight: 15, maxWidth: 500 },
});
