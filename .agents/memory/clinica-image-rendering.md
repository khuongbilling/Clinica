---
name: Clinica image rendering
description: Which Image component to use for local asset backgrounds on Expo web, and where each works reliably.
---

# Scene background image rendering on Expo 54 web

## Rule
Use `expo-image`'s `Image` (with `contentFit="cover"`) for ALL illustrated scene backgrounds in this project, NOT React Native's `Image` component.

**Why:** RN Image fails silently (renders transparent/black) inside a `flex: 1, overflow: hidden` View on Expo web — the ward battle arena is exactly this. The lobby (SafeAreaView direct child) happened to work with RN Image, but the battle arena (nested flex child) did not. expo-image works reliably in both contexts.

## How to apply
- Import with alias to avoid name clash: `import { Image as ExpoImage } from "expo-image";`
- Use `contentFit="cover"` instead of `resizeMode="cover"`
- `style={StyleSheet.absoluteFillObject}` works correctly with ExpoImage on web

## Asset paths
- Ward Defense battle: `../assets/images/ward_battle_bg.png` (16:9, fantasy medical ward corridor)
- Ward Defense lobby: `../assets/images/ward_lobby_bg.png` (9:16, Chinese apothecary sanctuary)
- Home hub SceneBg: `../../assets/images/home_hub_bg.png` (9:16, Chinese palace courtyard)

## Image generation prompts style
Proven prompt elements for donghua/anime mobile game quality scenes:
- "2D donghua anime mobile game background art"
- "painterly cel-shaded illustration style, Genshin Impact background quality"
- "no characters, no text, no UI elements"
- negativePrompt: "3D render, photorealistic, CG, blurry, watermark"
