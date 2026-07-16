---
name: Chapter visual maps pattern
description: How per-chapter visual node maps work; getChapterStatus "complete" gate; expandedId init discipline.
---

## Rule
Each chapter with a visual node map gets its own `ChapterNVisualMap.tsx` component wired via `chapter.number === N` branch in `ChapterJourneyMap.tsx`. The `expandedId` useState initializer **must** use `getChapterStatus(chapter, playerLevel, claimedNodes)` — not `playerLevel >= chapter.levelGate` — or completion-gated chapters auto-expand in a locked state.

## getChapterStatus "complete" gate
`getChapterStatus` must check BOTH:
1. Previous chapter's `requiredCompletionNodes` (gate for "active" access)
2. **This** chapter's own `requiredCompletionNodes` before returning "complete"

Without check #2, a chapter shows "complete" visually even though the player hasn't cleared its own required nodes (e.g., mini-boss), which unlocks the next chapter incorrectly.

**Why:** Chapter 2's mini-boss (c2p7) is a required node. Without the own-chapter check, reaching Ch3's levelGate would make Ch2 show "complete" even if c2p7 was never attempted.

**How to apply:** Whenever adding `requiredCompletionNodes` to any chapter, ensure the "complete" gate in `getChapterStatus` covers that chapter's own nodes (already in the codebase after Push 8 fix).

## Sequential locking in visual maps
Ch2 uses strict sequential locking: node N is "locked" until node N-1 is claimed. Ch1 does not enforce sequential locking. New chapters can choose either pattern in their `buildNodeData` function — use the `prevId/prevDone` pattern from Chapter2VisualMap for sequential, or omit it for open access.

## Multi-day anticipation pattern
- Locked boss node: show `skull-outline` instead of generic `lock-closed` icon (shadowy silhouette)
- Post-node teasers: show inline text in the label area (e.g., "Memory Fragment Ahead") conditional on the prior node being `complete`
- Misted next-chapter gate: rendered below the CANVAS as a View with dashed border + lock icon, not inside the SVG canvas
