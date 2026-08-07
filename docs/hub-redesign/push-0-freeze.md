# Push 0 — Hub Freeze / Rollback Point

> Status: **COMPLETE**  
> Commit SHA: `8d5b000` — *"Refactor the enter ward button component logic"*  
> Screenshot saved: `screenshots/hub-push0-baseline.jpg`

---

## Rollback instructions

```bash
# To return to this exact hub state:
git checkout 8d5b000 -- frontend/app/(tabs)/index.tsx \
  frontend/src/components/PlayerHeader.tsx \
  frontend/src/components/sanctuary/ \
  frontend/src/components/ui/EnterWardButton.tsx \
  frontend/app/(tabs)/_layout.tsx
```

---

## File ownership map

| Hub element | File(s) | Key symbols |
|---|---|---|
| **Player header** (name, level, stamina bar, wallet, XP bar) | `frontend/src/components/PlayerHeader.tsx` | `PlayerHeader` (lines 49–171+) |
| **Location title / subtitle** | `frontend/src/components/sanctuary/LocationHeader.tsx` | `LocationHeader` (lines 20–37) |
| **System / narrator + Daily Objective card** | `frontend/src/components/sanctuary/SystemObjectiveCard.tsx` | `SystemObjectiveCard` (line 79) |
| **Center hero portrait** | `frontend/app/(tabs)/index.tsx` (lines 555–591) + `frontend/src/components/HeroSprites/index.ts` | `getHeroSprite`, Expo Image render |
| **Center hero background** | `frontend/app/(tabs)/index.tsx` (lines 772–814) | `SceneBg` (local component), asset: `frontend/assets/images/home_hub_bg.png` |
| **Shortcut cards** (Rounds, Recruit, Ward Defense, Supplies, Goals) | `frontend/src/components/sanctuary/SanctuaryShortcutCard.tsx` | `SanctuaryShortcutCard`; emblem PNGs: `frontend/assets/ui-icons/emblems/` |
| **Enter the Ward CTA** | `frontend/src/components/ui/EnterWardButton.tsx` | `EnterWardButton`; mounted `index.tsx:687–693` |
| **Ward locked-state fallback** | `frontend/app/(tabs)/index.tsx` (lines 694–714, styles 1120–1165) | hub-local `wardLockedCard*` styles |
| **Sanctuary bottom-nav selected state** | `frontend/app/(tabs)/_layout.tsx` (lines 129–139) | `mkTabIcon`, `StrokeLabel`; asset: `frontend/assets/ui-icons/tab-realm.png` |

---

## Emblem asset paths
```
frontend/assets/ui-icons/emblems/
  daily-rounds.png
  goals.png
  recruit.png
  defense.png
  supplies.png
```

---

## Baseline notes

- Hero portrait renders inside hub-local inline JSX (not a dedicated component file).
- `SceneBg` (also hub-local) is responsible for the background image, tint, vignette, and ground effects — it is NOT a shared component.
- `NarratorGuide` is imported in `index.tsx` but the active objective card call site is `SystemObjectiveCard`, not `NarratorGuide`.
- No visual changes were made in this push.
