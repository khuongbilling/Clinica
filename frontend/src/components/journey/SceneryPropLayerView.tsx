/**
 * SceneryPropLayerView — renders placed scenery props in world space
 *
 * Sits INSIDE the world Animated.View (same camera transform as terrain and
 * player sprite).  Each prop is absolutely positioned at its world-pixel
 * top-left and depth-sorted by the shared axial map depth within the
 * WORLD_CONTENT z-range.
 *
 * When a prop's `def.asset` is non-null, the actual PNG asset is rendered.
 * While assets are pending, a labelled placeholder box is shown in DEV mode.
 * In production, props with null assets are silently skipped.
 *
 * Depth sort formula (mirrors HexObjectLayer):
 *   zIndex = min(WORLD_CONTENT_MAX, WORLD_CONTENT_BASE + (r + q / 2) × 10)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import type { PlacedSceneryProp } from '../../game/journeyMap/sceneryPropTypes';
import { worldContentZForAxialDepth } from './journeyZ';

function propZ(axialDepth: number): number {
  return worldContentZForAxialDepth(axialDepth);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SceneryPropLayerViewProps {
  props:    PlacedSceneryProp[];
  /** Used only for DEV placeholder label font scaling. */
  sz:       number;
  /** DEV-only: show collision overlay shapes instead of (or alongside) art. */
  showCollisionDev?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SceneryPropLayerView({
  props: placedProps,
  sz,
  showCollisionDev = false,
}: SceneryPropLayerViewProps): React.ReactElement | null {
  if (placedProps.length === 0) return null;

  return (
    <>
      {placedProps.map(prop => {
        const z = propZ(prop.axialDepth);
        const hasAsset = prop.def.asset !== null;

        // In production, skip props without art.
        if (!hasAsset && !__DEV__) return null;

        return (
          <View
            key={prop.id}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left:     prop.worldLeft,
              top:      prop.worldTop,
              width:    prop.pixelWidth,
              height:   prop.pixelHeight,
              zIndex:   z,
            }}
          >
            {/* Real PNG asset (when available) */}
            {hasAsset && (
              <Image
                source={prop.def.asset as number}
                style={StyleSheet.absoluteFillObject}
                contentFit="contain"
                testID={`scenery-prop-${prop.type}`}
              />
            )}

            {/* DEV placeholder box */}
            {!hasAsset && __DEV__ && (
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    backgroundColor: prop.def.devPlaceholderColor + '88',
                    borderWidth: 1,
                    borderColor: prop.def.devPlaceholderColor,
                    borderRadius: 3,
                    justifyContent: 'center',
                    alignItems: 'center',
                  },
                ]}
              >
                <Text
                  style={{
                    color:      '#fff',
                    fontSize:   Math.max(7, Math.round(sz * 0.1)),
                    fontWeight: '700',
                    textAlign:  'center',
                  }}
                  numberOfLines={2}
                >
                  {prop.def.label.replace(' ', '\n')}
                </Text>
              </View>
            )}

            {/* DEV collision radius indicator */}
            {showCollisionDev && __DEV__ && (
              <View
                style={{
                  position:    'absolute',
                  left:        '50%',
                  top:         '100%',  // ground anchor
                  width:       Math.round(prop.def.collisionRadiusTiles * sz * 2),
                  height:      Math.round(prop.def.collisionRadiusTiles * sz * 2),
                  marginLeft:  -Math.round(prop.def.collisionRadiusTiles * sz),
                  marginTop:   -Math.round(prop.def.collisionRadiusTiles * sz),
                  borderRadius: Math.round(prop.def.collisionRadiusTiles * sz),
                  borderWidth:  1,
                  borderColor:  'rgba(255,60,60,0.8)',
                  backgroundColor: 'rgba(255,0,0,0.12)',
                }}
              />
            )}
          </View>
        );
      })}
    </>
  );
}
