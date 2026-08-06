---
name: Hub mockup icon sourcing
description: Where painterly UI icons live and merge-revert pitfall for mockup sandbox files
---
The unified painterly JRPG icon set lives in `frontend/assets/ui-icons/` (tab-home pagoda, tab-heroes, tab-realm torii, tab-shop potion, icon_stamina gold-teal bolt, etc., 1024×1024 transparent PNGs). Copy these into `artifacts/mockup-sandbox/public/images/` instead of hand-drawing SVG placeholders — geometric SVGs clash with the painterly style.

**Why:** SVG tab icons were repeatedly flagged as mismatched vs. the reference art; existing assets already match.

**How to apply:** For any missing icon, generate with `generateImage` + `removeBackground:true` in the same painterly gold/teal prompt style.

Also: task-agent merges touching the same mockup file can silently revert sections (e.g. Enter Ward button style) even when your later edits still apply — after any merge to a file you rewrote, diff the merge commit against your intended design before screenshotting confusion.
