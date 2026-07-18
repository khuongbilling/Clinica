/**
 * HeroMapToken — V6 lead-hero chibi sprite token for the Journey Map.
 *
 * Renders the player's lead hero as a small class-matched chibi sprite
 * sitting ON the active/next map node. Designed to be:
 *   • Small (38 × 50 px sprite) — the map remains the star
 *   • Grounded — a circular pawn-base sits at the sprite's feet
 *   • Alive — gentle idle float animation (no hop logic needed per push)
 *   • Upgradeable — swap sprite source without changing positioning logic
 *
 * Positioning: sprite feet rest ~10 px below the top of the node circle,
 * giving a clear "standing on the node" feel while keeping the node art
 * visible below and around the token.
 *
 * Used by Ch1–Ch5 VisualMaps and GenericChapterVisualMap.
 * Sprite source is resolved by journey.tsx via getMapSprite(class_tree_id).
 */
import React, { useEffect, useRef } from "react";
import { Image } from "expo-image";
import type { ImageSourcePropType } from "react-native";
import { Animated, View } from "react-native";

// ── Token geometry ────────────────────────────────────────────────────────────

/** Chibi sprite display size (portrait: taller than wide). */
const TOKEN_W  = 38;
const TOKEN_H  = 50;

/** Circular pawn base beneath the sprite's feet. */
const BASE_D   = 22;

// ── Component ─────────────────────────────────────────────────────────────────

export interface HeroMapTokenProps {
  /** MAP_SPRITE chibi image (number from require(), or ImageSourcePropType). */
  sprite: ImageSourcePropType | number;
  /** Node centre X in canvas pixels (nd.layout.xf * W). */
  x: number;
  /** Node centre Y in canvas pixels (nd.layout.y). */
  y: number;
  /** Node radius in pixels (nd.layout.r). */
  r: number;
}

export function HeroMapToken({ sprite, x, y, r }: HeroMapTokenProps) {
  // ── Idle float animation ─────────────────────────────────────────────────────
  const floatY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue:         -4,
          duration:        1100,
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue:         0,
          duration:        1100,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [floatY]);

  // ── Layout maths ─────────────────────────────────────────────────────────────
  // Sprite: feet sit ~10 px into the top of the node, body rises above.
  const spriteLeft = x - TOKEN_W / 2;
  const spriteTop  = y - r - TOKEN_H + 10;

  // Base circle: centred 4 px above the sprite's bottom edge (at the feet).
  const baseLeft   = x - BASE_D / 2;
  const baseTop    = spriteTop + TOKEN_H - BASE_D * 0.65;

  return (
    <>
      {/* ── Glow halo behind base ── */}
      <View
        style={{
          position:        "absolute",
          left:            baseLeft - 5,
          top:             baseTop - 5,
          width:           BASE_D + 10,
          height:          BASE_D + 10,
          borderRadius:    (BASE_D + 10) / 2,
          backgroundColor: "#E8C86830",
          shadowColor:     "#E8C868",
          shadowOpacity:   0.7,
          shadowRadius:    7,
          elevation:       7,
          pointerEvents:   "none",
        } as any}
      />

      {/* ── Pawn base circle (gold ring, dark fill) ── */}
      <View
        style={{
          position:        "absolute",
          left:            baseLeft,
          top:             baseTop,
          width:           BASE_D,
          height:          BASE_D,
          borderRadius:    BASE_D / 2,
          backgroundColor: "#0B1825DD",
          borderWidth:     1.5,
          borderColor:     "#E8C868BB",
          pointerEvents:   "none",
        } as any}
      />

      {/* ── Animated chibi sprite ── */}
      <Animated.View
        style={{
          position:      "absolute",
          left:          spriteLeft,
          top:           spriteTop,
          width:         TOKEN_W,
          height:        TOKEN_H,
          zIndex:        30,
          transform:     [{ translateY: floatY }],
          pointerEvents: "none",
        } as any}
      >
        <Image
          source={sprite as ImageSourcePropType}
          style={{ width: TOKEN_W, height: TOKEN_H }}
          contentFit="contain"
        />
      </Animated.View>
    </>
  );
}
