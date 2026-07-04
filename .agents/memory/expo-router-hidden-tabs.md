---
name: Expo Router hidden tabs pattern
description: How to remove a screen from the visible tab bar without breaking its old route or duplicating its logic
---

To move a screen (e.g. Profile, Codex) out of the visible bottom tab bar while keeping its old route (`/(tabs)/profile`) working and reachable via `router.push`, keep the file in the `(tabs)` directory and declare it with `<Tabs.Screen name="x" options={{ href: null }} />` in `_layout.tsx`. Do not move the file out of the tabs group and do not delete/duplicate the screen.

To promote a top-level screen (e.g. `app/shop.tsx`) into becoming a tab root without duplicating its logic, create `app/(tabs)/shop.tsx` as a one-line re-export: `export { default } from "../shop";`. Both the old top-level route and the new tab route render the exact same component.

**Why:** Product specs often require "move X out of the tab bar but don't break the old link" and "make Y a tab without duplicating logic" simultaneously. File relocation breaks old deep links; full duplication creates drift between two copies of the same screen.

**How to apply:** Any time a nav restructure needs to hide/show tabs or promote a screen to tab status without touching its underlying implementation.
