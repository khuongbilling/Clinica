---
name: Prologue animation native driver
description: useNativeDriver:false breaks opacity/transform animations on Expo SDK 54 native (Fabric arch), leaving images at opacity:0.
---

## Rule
All opacity and transform `Animated.timing` calls in prologue scenes MUST use `useNativeDriver: true`.

**Why:** Expo SDK 54 uses React Native 0.81 with the new Fabric/JSI architecture in Expo Go. In Fabric, `useNativeDriver: false` JS-thread animations for opacity/transform can stall at their initial value — images start hidden at opacity:0 and never animate to visible. On web this is invisible because react-native-web ignores the driver flag entirely.

**How to apply:** Any new prologue (or battle) animated scene that starts with `Animated.Value(0)` on opacity/transform must use `useNativeDriver: true`. The ONLY exceptions are animations that drive non-compositable properties (backgroundColor color values, layout dimensions, etc.) — those still need `false`.

## Related fix: CSS filter on ExpoImage
`{ filter: "blur(22px)" }` in a StyleSheet is web-only CSS. On native RN 0.79+ the `filter` style expects `FilterFunction[]`. Use the `blurRadius` prop on expo-image instead:
```jsx
// WRONG (web only):
<ExpoImage style={[StyleSheet.absoluteFill, { filter: "blur(22px)" } as any]} />
// CORRECT (cross-platform):
<ExpoImage style={StyleSheet.absoluteFill} blurRadius={22} />
```

## Preloader scope
`PROLOGUE_IMAGE_MODULES` in `prologueCharacters.ts` must include ALL images rendered in any prologue scene — not just character portraits. Scene backgrounds (`ward_corridor_battle.png`, `tactical_battlefield.png`, `silent_infarction_nobg.png`, `prodigy_vn_canonical.png`) and opening cinematic panels (`opening_prodigy_*.png`) must be listed there so the preloader warms them before the scenes play.
