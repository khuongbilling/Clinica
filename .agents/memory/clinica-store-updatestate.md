---
name: updateState Ctx exposure
description: updateState was not in Ctx type nor in the useMemo value object — guards like `if (player && updateState)` were always false.
---

# updateState must be in Ctx AND in the useMemo value

`updateState` is defined as a `useCallback` inside the store provider but was
never added to the `Ctx` type or the `useMemo` context value object.

Any consumer that destructures `const { updateState } = usePlayer()` gets
`undefined`, so guards like `if (player && updateState) { ... }` silently
skip the entire block — no error, no XP, no credits.

**Why:** TypeScript only catches this if `updateState` is in `Ctx`; without
that, the destructure just gives `undefined` with no complaint.

**How to apply:** Whenever adding a new method to the store, add it in THREE
places:
1. The `Ctx` type declaration (~line 277 of store.tsx)
2. The `useMemo<Ctx>(() => ({ ... }), [...])` value object
3. The `useMemo` deps array

Missing any one of the three causes silent undefined at call sites.
