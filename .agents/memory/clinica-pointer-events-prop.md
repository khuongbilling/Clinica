---
name: pointerEvents box-none must be a View prop
description: On Expo web, pointerEvents in a style object causes CSS pointer-events:none to inherit to children; only the View prop form works correctly for box-none.
---

## The Rule
Always pass `pointerEvents="box-none"` as a **prop** on `<View>`, never as `{ pointerEvents: "box-none" }` inside the `style` array.

**Why:** On Expo web (react-native-web), `pointerEvents` in a style object translates directly to a CSS `pointer-events` property. CSS `pointer-events: none` **inherits** to all children — so any `Pressable` or interactive element inside the container silently becomes unclickable, with no error or warning. React Native Web only applies the correct "container transparent, children tappable" isolation when `pointerEvents` is the View **prop**, which react-native-web handles via a special JavaScript event-routing path rather than CSS inheritance.

**How to apply:**
- Correct: `<View pointerEvents="box-none" style={[styles.labelBase, posStyle]}>`
- Wrong: `<View style={[styles.labelBase, posStyle, { pointerEvents: "box-none" }]}>`

This bit all 6 chapter visual maps (Ch1–Ch5 + GenericChapterVisualMap): the NodeClaimBtn Pressable was inside a label View with `pointerEvents` in style, making every CLAIM button unclickable on web.

The same rule applies to `"none"` and `"box-only"` — always use the prop form on web.
