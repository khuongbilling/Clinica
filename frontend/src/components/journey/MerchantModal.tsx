/**
 * MerchantModal — PUSH 12
 *
 * Traveling merchant encounter overlay shown when the player lands on a
 * merchant tile.
 *
 * Inventory design remains a future feature (per spec).  The modal shows a
 * seeded stub — the merchant's name is derived deterministically from the run
 * seed + tile id so it never changes between visits, satisfying "do not
 * generate a new merchant each time the tile is revisited."
 *
 * The parent calls `onLeave()` when the player dismisses.
 */

import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SERIF, UI } from '@/src/theme/ui';
import { usePlayer } from '@/src/game/store';
import { generateMerchantInventory, type MerchantStock } from '@/src/game/journeyMap/merchant';

// ── Asset ─────────────────────────────────────────────────────────────────────

const MERCHANT_ART =
  require('@/assets/ui/journey/encounters/merchant.webp') as number;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MerchantModalProps {
  visible:   boolean;
  runSeed:   string;
  runId:     string;
  tileId:    string;
  chapterId: number;
  inventory?: MerchantStock[];
  onLeave:   () => void;
}

// ── Deterministic merchant name ───────────────────────────────────────────────

const MERCHANT_NAMES = [
  'Master Bai',
  'The Wandering Alchemist',
  'Sister Wren',
  'Old Shou',
  'The Pale Herbalist',
  'Marisol, Apothecary',
  'Brother Fen',
  'The Cartographer',
] as const;

function deriveMerchantName(runSeed: string, tileId: string): string {
  // Simple FNV-1a hash for stable, seeded name selection.
  let h = 0x811c9dc5;
  const s = `${runSeed}:merchant:${tileId}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return MERCHANT_NAMES[h % MERCHANT_NAMES.length];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MerchantModal({
  visible,
  runSeed,
  runId,
  tileId,
  chapterId,
  inventory,
  onLeave,
}: MerchantModalProps) {
  const { purchaseJourneyMerchant } = usePlayer();
  const merchantName = deriveMerchantName(runSeed, tileId);
  const wares = inventory ?? generateMerchantInventory(runSeed, tileId, chapterId);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      testID="merchant-modal"
    >
      <View style={s.overlay}>
        <View style={s.card}>

          {/* Header */}
          <Text style={s.title}>{merchantName}</Text>
          <Text style={s.subtitle}>Traveling Merchant</Text>

          {/* Merchant art */}
          <Image
            source={MERCHANT_ART}
            style={s.art}
            contentFit="contain"
            testID="merchant-art"
          />

          {/* Stable six-slot inventory. The run owns the generated stock. */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>WARES</Text>
            <Text style={s.comingSoon}>Prices are paid in Crowns.</Text>
            {wares.map((ware) => (
              <View key={ware.id} style={s.wareRow}>
                <Text style={s.wareTxt}>· {ware.name} ×{ware.quantity}</Text>
                <Pressable
                  onPress={() => purchaseJourneyMerchant(runId, tileId, ware.id)}
                  testID={`merchant-buy-${ware.id}`}
                >
                  <Text style={[s.wareLocked, ware.rarity === 'ultra' && { color: UI.gold }]}>
                    {ware.price} ◎
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>

          {/* Leave button */}
          <Pressable style={s.leaveBtn} onPress={onLeave} testID="merchant-leave">
            <Text style={s.leaveTxt}>LEAVE</Text>
          </Pressable>

          <Pressable style={s.closeBtn} onPress={onLeave} testID="merchant-close">
            <Text style={s.closeTxt}>✕</Text>
          </Pressable>

        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const JADE = UI.jade;
const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000CC',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         24,
  },
  card: {
    backgroundColor: UI.sanctuaryPanel,
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     UI.sanctuaryBorder,
    padding:         24,
    alignItems:      'center',
    gap:             10,
    width:           '100%',
    maxWidth:        360,
    position:        'relative',
  },
  title: {
    color:        JADE,
    fontSize:     20,
    fontWeight:   '800',
    fontFamily:   SERIF,
    letterSpacing: 0.8,
    textAlign:    'center',
  },
  subtitle: {
    color:     UI.textDim,
    fontSize:  11,
    textAlign: 'center',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: SERIF,
  },
  art: {
    width:  160,
    height: 160,
  },
  section: {
    width:   '100%',
    gap:     4,
  },
  sectionLabel: {
    color:        JADE,
    fontSize:     9.5,
    fontWeight:   '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontFamily:   SERIF,
    marginBottom:  2,
  },
  comingSoon: {
    color:    UI.textDim,
    fontSize: 11,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  wareRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingVertical: 3,
  },
  wareTxt: {
    color:    UI.textSoft,
    fontSize: 12,
    fontFamily: SERIF,
  },
  wareLocked: {
    color:    UI.textDim,
    fontSize: 10,
    fontStyle: 'italic',
  },
  leaveBtn: {
    borderWidth:      1,
    borderColor:      UI.sanctuaryBorder,
    borderRadius:     12,
    paddingVertical:  10,
    paddingHorizontal: 32,
    backgroundColor:  UI.sanctuaryBg,
    alignItems:       'center',
    marginTop:        4,
    width:            '100%',
  },
  leaveTxt: {
    color:        UI.textSoft,
    fontSize:     13,
    fontWeight:   '700',
    fontFamily:   SERIF,
    letterSpacing: 1,
  },
  closeBtn: {
    position: 'absolute',
    top:      12,
    right:    14,
    padding:  6,
  },
  closeTxt: {
    color:    UI.textDim,
    fontSize: 16,
  },
});
