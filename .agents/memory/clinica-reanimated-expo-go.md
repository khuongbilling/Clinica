---
name: Reanimated Expo Go constraint
description: Why reanimated must stay on ~3.16.7 and what to clean up if v4 ever gets installed
---

## The rule
`react-native-reanimated` MUST stay pinned to **~3.16.7** in `frontend/package.json`.

**Why:** Reanimated v4 requires `react-native-worklets`, which is NOT bundled with Expo Go. The app crashes silently on native startup with no obvious user-facing error.

## What to fix if v4 gets installed again
Two files must both be reverted — missing either one leaves the error:

1. **`frontend/package.json`** — set `"react-native-reanimated": "~3.16.7"` and delete the `"react-native-worklets"` entry entirely.
2. **`frontend/babel.config.js`** — remove `'react-native-worklets/plugin'` from the `plugins` array (leave the array empty or with other valid plugins only).

Then run `npm install --legacy-peer-deps` and restart the *Start application* workflow.

**How to apply:** Any time a task agent touches animation or gesture packages, grep both files for "worklets" before restarting the workflow.
