/**
 * ShiftSelector — shift tab row for the chapter journey screen.
 *
 * DESIGN RULE (from spec):
 *   ShiftSelector receives only ShiftAvailability booleans — no node details.
 *   Before a shift is unlocked, its actual nodes are NOT passed to this
 *   component at all.  Locked shifts are either hidden or shown as a teaser.
 *
 * Rendering per shift:
 *   unlocked      → selectable tab (Pressable, accessibilityRole="tab")
 *   teaserVisible → disabled teaser pill ("Revealed through the story")
 *   neither       → nothing rendered (completely absent from the DOM/tree)
 *
 * Day:     always unlocked.
 * Evening: teaser at Ch2, unlocked at Ch3.
 * Night:   teaser at Ch3 (after Evening unlocks), unlocked at Ch6.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { ShiftAvailability, ShiftSlot } from './shiftAvailability';
import type { TimeOfDay } from '../../../game/journeyMap/types';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ShiftSelectorProps {
  availability: ShiftAvailability;
  activeShift:  TimeOfDay;
  onSelect:     (shift: TimeOfDay) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SHIFT_LABELS: Record<TimeOfDay, string> = {
  day:     'Day Shift',
  evening: 'Evening Shift',
  night:   'Night Shift',
};

const SHIFT_ACCENT: Record<TimeOfDay, string> = {
  day:     '#f0c060',
  evening: '#b480ff',
  night:   '#60a8f0',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ShiftSelector({
  availability,
  activeShift,
  onSelect,
}: ShiftSelectorProps) {
  const shifts: TimeOfDay[] = ['day', 'evening', 'night'];

  return (
    <View
      style={styles.tabList}
      accessibilityRole="tablist"
      aria-label="Ward shift"
      testID="shift-selector"
    >
      {shifts.map((shift) => {
        const slot: ShiftSlot = availability[shift];

        // Hidden entirely — render nothing
        if (!slot.unlocked && !slot.teaserVisible) return null;

        // Disabled teaser — locked but visible as anticipation
        if (!slot.unlocked && slot.teaserVisible) {
          return (
            <View
              key={shift}
              style={[styles.tab, styles.teaserTab]}
              testID={`shift-tab-${shift}-teaser`}
              accessibilityElementsHidden
            >
              <Text style={styles.teaserLabel}>{SHIFT_LABELS[shift]}</Text>
              <Text style={styles.teaserHint}>Revealed through the story</Text>
            </View>
          );
        }

        // Unlocked — selectable tab
        const selected = activeShift === shift;
        const accent   = SHIFT_ACCENT[shift];
        return (
          <Pressable
            key={shift}
            style={[
              styles.tab,
              selected && { borderColor: accent, backgroundColor: accent + '20' },
            ]}
            onPress={() => onSelect(shift)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={SHIFT_LABELS[shift]}
            testID={`shift-tab-${shift}`}
          >
            <Text
              style={[styles.tabLabel, { color: selected ? accent : '#9090a8' }]}
            >
              {SHIFT_LABELS[shift]}
            </Text>
            {selected && (
              <View style={[styles.activeIndicator, { backgroundColor: accent }]} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabList: {
    flexDirection:    'row',
    gap:              8,
    paddingHorizontal: 12,
    paddingVertical:   10,
  },

  tab: {
    flex:              1,
    alignItems:        'center',
    paddingVertical:   10,
    paddingHorizontal: 8,
    borderRadius:      10,
    borderWidth:       1,
    borderColor:       '#2a2a3a',
    backgroundColor:   '#1a1a2e',
    gap:               4,
    minHeight:         52,
    justifyContent:    'center',
  },

  teaserTab: {
    opacity:         0.45,
    borderStyle:     'dashed',
    borderColor:     '#404058',
    backgroundColor: '#12121e',
  },

  tabLabel: {
    fontSize:      12,
    fontWeight:    '700',
    letterSpacing: 0.4,
    textAlign:     'center',
  },

  teaserLabel: {
    fontSize:      12,
    fontWeight:    '600',
    color:         '#60607a',
    textAlign:     'center',
  },

  teaserHint: {
    fontSize:      10,
    color:         '#505068',
    textAlign:     'center',
    lineHeight:    14,
  },

  activeIndicator: {
    width:        24,
    height:       2,
    borderRadius: 1,
  },
});
