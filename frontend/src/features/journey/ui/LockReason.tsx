/**
 * LockReason — deliberately dumb display component.
 *
 * Receives reasons from the gate evaluator and renders them.
 * Contains zero gate logic — no `if (chapterNumber === 6)` conditions.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { GateRequirement } from './gateEvaluation';

interface LockReasonProps {
  reasons: GateRequirement[];
}

export function LockReason({ reasons }: LockReasonProps) {
  if (reasons.length === 0) return null;

  return (
    <View style={styles.wrap} testID="lock-reason">
      {reasons.map((reason) => (
        <Text key={reason.code} style={styles.text}>
          {reason.message}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingVertical:   8,
    gap:               4,
  },
  text: {
    fontSize:   13,
    lineHeight: 18,
    color:      '#a09ab8',
  },
});
