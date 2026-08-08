/**
 * TreasureModal — PUSH 12
 *
 * Full-screen overlay shown when the player lands on a treasure tile.
 *
 * States:
 *   • Closed (visible=false)
 *   • Sealed chest — "OPEN CHEST" button; tier artwork shown
 *   • Opened chest — reward chips + "CONTINUE" button; prevents second claim
 *
 * The parent is responsible for calling `repo.saveRun` and `applyRewards` when
 * `onClaim` fires — this component is pure UI.
 */

import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ChestTier } from '@/src/game/journeyMap/types';
import { TREASURE_REWARDS, type TreasureReward } from '@/src/game/journeyMap/encounterResolution';
import { SERIF, UI } from '@/src/theme/ui';

// ── Assets ────────────────────────────────────────────────────────────────────

const CHEST_ART: Record<ChestTier, number> = {
  bronze: require('@/assets/ui/journey/encounters/treasure-bronze.webp') as number,
  silver: require('@/assets/ui/journey/encounters/treasure-silver.webp') as number,
  gold:   require('@/assets/ui/journey/encounters/treasure-gold.webp')   as number,
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TreasureModalProps {
  visible:       boolean;
  tier:          ChestTier | undefined;
  alreadyClaimed: boolean;
  onClaim:       (rewards: TreasureReward) => void;
  onClose:       () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIER_LABEL: Record<ChestTier, string> = {
  bronze: 'Bronze Chest',
  silver: 'Silver Chest',
  gold:   'Gold Chest',
};

const TIER_COLOR: Record<ChestTier, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold:   '#E8C050',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function TreasureModal({
  visible,
  tier = 'bronze',
  alreadyClaimed,
  onClaim,
  onClose,
}: TreasureModalProps) {
  const rewards  = TREASURE_REWARDS[tier];
  const tint     = TIER_COLOR[tier];
  const label    = TIER_LABEL[tier];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      testID="treasure-modal"
    >
      <View style={s.overlay}>
        <View style={s.card}>

          {/* Header */}
          <Text style={[s.title, { color: tint }]}>{label}</Text>
          <Text style={s.subtitle}>
            {alreadyClaimed ? 'Already looted.' : 'A reward awaits inside.'}
          </Text>

          {/* Chest artwork */}
          <Image
            source={CHEST_ART[tier]}
            style={s.art}
            contentFit="contain"
            testID={`chest-art-${tier}`}
          />

          {/* Reward preview */}
          <View style={s.rewardRow}>
            {rewards.xp > 0 && (
              <View style={s.chip}>
                <Text style={s.chipTxt}>+{rewards.xp} XP</Text>
              </View>
            )}
            {rewards.crowns > 0 && (
              <View style={s.chip}>
                <Text style={s.chipTxt}>+{rewards.crowns} ◎</Text>
              </View>
            )}
            {rewards.shards > 0 && (
              <View style={[s.chip, { borderColor: UI.jade + '80' }]}>
                <Text style={[s.chipTxt, { color: UI.jade }]}>+{rewards.shards} Shards</Text>
              </View>
            )}
          </View>

          {/* Actions */}
          {alreadyClaimed ? (
            <Pressable style={s.btnSecondary} onPress={onClose} testID="treasure-continue">
              <Text style={s.btnSecondaryTxt}>CONTINUE</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[s.btnPrimary, { borderColor: tint + '88', backgroundColor: tint + '1A' }]}
              onPress={() => onClaim(rewards)}
              testID="treasure-open"
            >
              <Text style={[s.btnPrimaryTxt, { color: tint }]}>OPEN CHEST</Text>
            </Pressable>
          )}

          <Pressable style={s.closeBtn} onPress={onClose} testID="treasure-close">
            <Text style={s.closeTxt}>✕</Text>
          </Pressable>

        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const PANEL_BG     = UI.sanctuaryPanel;
const PANEL_BORDER = UI.sanctuaryBorder;

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000CC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor:  PANEL_BG,
    borderRadius:     20,
    borderWidth:      1,
    borderColor:      PANEL_BORDER,
    padding:          24,
    alignItems:       'center',
    gap:              12,
    width:            '100%',
    maxWidth:         360,
    position:         'relative',
  },
  title: {
    fontSize:     22,
    fontWeight:   '800',
    fontFamily:   SERIF,
    letterSpacing: 1,
    textAlign:    'center',
  },
  subtitle: {
    color:      UI.textDim,
    fontSize:   13,
    textAlign:  'center',
  },
  art: {
    width:  200,
    height: 200,
  },
  rewardRow: {
    flexDirection:  'row',
    gap:            8,
    flexWrap:       'wrap',
    justifyContent: 'center',
  },
  chip: {
    borderWidth:     1,
    borderColor:     UI.gold + '60',
    borderRadius:    20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: UI.gold + '12',
  },
  chipTxt: {
    color:      UI.gold,
    fontSize:   13,
    fontWeight: '700',
    fontFamily: SERIF,
  },
  btnPrimary: {
    borderWidth:      1,
    borderRadius:     12,
    paddingVertical:  12,
    paddingHorizontal: 32,
    alignItems:       'center',
    marginTop:        4,
  },
  btnPrimaryTxt: {
    fontSize:     14,
    fontWeight:   '800',
    fontFamily:   SERIF,
    letterSpacing: 1.2,
  },
  btnSecondary: {
    borderWidth:      1,
    borderColor:      UI.sanctuaryBorder,
    borderRadius:     12,
    paddingVertical:  10,
    paddingHorizontal: 28,
    backgroundColor:  UI.sanctuaryPanel,
    alignItems:       'center',
    marginTop:        4,
  },
  btnSecondaryTxt: {
    color:        UI.textSoft,
    fontSize:     13,
    fontWeight:   '700',
    fontFamily:   SERIF,
    letterSpacing: 0.8,
  },
  closeBtn: {
    position:  'absolute',
    top:       12,
    right:     14,
    padding:   6,
  },
  closeTxt: {
    color:    UI.textDim,
    fontSize: 16,
  },
});
