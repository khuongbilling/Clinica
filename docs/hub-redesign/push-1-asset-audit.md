# Push 1 — Asset Audit: Code-Rendered vs Painted Artwork

> Status: **COMPLETE**  
> Governing rule: **If it looks illustrated in the reference, do not recreate it in CSS/SVG. Use a generated/imported PNG or WebP.**

---

## Classification key

| Symbol | Meaning |
|---|---|
| 🖥️ **CODE** | HTML/CSS/RN layout — text, bars, spacing, translucent panels, interaction |
| 🎨 **ART** | Must be a raster asset (PNG/WebP) — generated or painted, never CSS |

---

## Player Header

| Element | Class | Rationale |
|---|---|---|
| Player name text | 🖥️ CODE | Pure text |
| Level badge number | 🖥️ CODE | Text + rounded pill in code |
| Stamina bar track & fill | 🖥️ CODE | Progress bar; CSS gradient fill |
| Stamina ⚡ icon | 🎨 ART | Small illustrated token — looks painted in reference |
| Crown 👑 currency token | 🎨 ART | Illustrated coin; must be a PNG |
| Scroll 📜 currency token | 🎨 ART | Illustrated scroll; must be a PNG |
| Star ⭐ currency token | 🎨 ART | Illustrated gem/star; must be a PNG |
| Shard 💠 currency token | 🎨 ART | Illustrated crystal shard; must be a PNG |
| Currency quantity numbers | 🖥️ CODE | Plain text |
| Player XP bar | 🖥️ CODE | Progress bar in code |

---

## Location Header

| Element | Class | Rationale |
|---|---|---|
| Location name text ("Ward 3 — River District" etc.) | 🖥️ CODE | Text |
| Subtitle / chapter label | 🖥️ CODE | Text |
| Decorative location ornament / divider | 🎨 ART | Ink brush stroke or illustrated accent in reference |

---

## System / Narrator Card

| Element | Class | Rationale |
|---|---|---|
| Card panel background (translucent dark) | 🖥️ CODE | CSS background + opacity |
| Card border / jade glow edge | 🖥️ CODE | CSS border + box-shadow |
| System medallion / circular avatar emblem | 🎨 ART | Illustrated circular portrait — painted look |
| "THE SYSTEM" label text | 🖥️ CODE | Text |
| Narrator body text | 🖥️ CODE | Text |
| Collapse/expand chevron | 🖥️ CODE | Ionicons or simple SVG |

---

## Daily Objective

| Element | Class | Rationale |
|---|---|---|
| Objective flag / scroll ornament | 🎨 ART | Illustrated wax-seal or ornament in reference |
| Objective text | 🖥️ CODE | Text |
| Progress fraction ("2/3") | 🖥️ CODE | Text |
| Progress bar fill | 🖥️ CODE | CSS bar |
| Claim reward button | 🖥️ CODE | Styled button in code |

---

## Center Hero Display

| Element | Class | Rationale |
|---|---|---|
| Hub background image | 🎨 ART | `home_hub_bg.png` — painted scene, already a PNG |
| Background vignette / tint overlay | 🖥️ CODE | CSS gradient overlay on top of bg PNG |
| Ground mist / fog effect | 🖥️ CODE | CSS radial gradient or animated overlay |
| Hero full-body sprite | 🎨 ART | `*_battle_sprite.png` — donghua cel-shaded art, already a PNG |
| Hero name text (if shown on hub) | 🖥️ CODE | Text |

---

## Shortcut Cards (Rounds / Goals / Recruit / Defense / Supplies)

| Element | Class | Rationale |
|---|---|---|
| Card panel background + border | 🖥️ CODE | CSS panel; tinted translucent glass |
| Card label text | 🖥️ CODE | Text |
| Notification / count badge | 🖥️ CODE | Code-rendered pill |
| Lock overlay (when locked) | 🖥️ CODE | CSS opacity layer |
| **Daily Rounds emblem** | 🎨 ART | Illustrated hourglass/calendar — `daily-rounds.png` |
| **Goals emblem** | 🎨 ART | Illustrated target/banner — `goals.png` |
| **Recruit emblem** | 🎨 ART | Illustrated crystal orb/summon — `recruit.png` |
| **Ward Defense emblem** | 🎨 ART | Illustrated shield/castle — `defense.png` |
| **Supplies emblem** | 🎨 ART | Illustrated satchel/vials — `supplies.png` |

---

## Acute Step Warden / Ward Summary Card

| Element | Class | Rationale |
|---|---|---|
| Card panel + border | 🖥️ CODE | CSS |
| Section label text | 🖥️ CODE | Text |
| Warden/ward status text | 🖥️ CODE | Text |
| Step indicator dots / bar | 🖥️ CODE | CSS progress |
| Any ornamental ward badge | 🎨 ART | Illustrated badge if present in reference |

---

## Enter the Ward CTA Button

| Element | Class | Rationale |
|---|---|---|
| Jade pill body (gradient + glow) | 🖥️ CODE | LinearGradient + boxShadow in code |
| Gold border frame | 🖥️ CODE | CSS border |
| ✦ sparkle corner glyphs | 🖥️ CODE | Text/unicode glyph |
| ◆ midpoint diamond ornaments | 🖥️ CODE | Text/unicode glyph |
| Shimmer sweep animation | 🖥️ CODE | Animated translateX in code |
| **Medic emblem** (circular jade medallion left of label) | 🎨 ART | Should be a painted PNG medallion, not a plain Ionicons icon |
| **Decorative illustrated border frame** (if reference shows one) | 🎨 ART | Any carved/inked outer frame beyond the CSS pill must be raster |
| "ENTER THE WARD" label text | 🖥️ CODE | Text |
| Arrow glyph | 🖥️ CODE | Ionicons / unicode |

---

## Sanctuary Bottom Navigation

| Element | Class | Rationale |
|---|---|---|
| Tab bar background panel | 🖥️ CODE | CSS |
| Tab labels (Journey, Heroes, etc.) | 🖥️ CODE | Text |
| Focused label gold colour | 🖥️ CODE | CSS colour switch |
| Inactive label grey opacity | 🖥️ CODE | CSS opacity |
| **Tab icon PNGs** (tab-realm.png etc.) | 🎨 ART | Already raster — keep as PNGs, do not replace with SVG |
| Focused tab underline / pip | 🖥️ CODE | CSS border/view |

---

## Art assets to generate / source (summary)

The following are the **new or upgraded raster assets** required for the redesign. None of these may be approximated with CSS or inline SVG.

| Asset | Notes |
|---|---|
| Stamina lightning icon | Small illustrated token (~40×40 PNG) |
| Crown currency token | Illustrated coin with Ink & Mist palette |
| Scroll currency token | Illustrated scroll |
| Star/gem currency token | Illustrated crystal star |
| Shard currency token | Illustrated crystal shard |
| Location ornament / divider | Ink brush accent separating title from content |
| System medallion (narrator avatar) | Circular illustrated emblem, ~64×64 PNG |
| Objective flag / ornament | Wax-seal or scroll header ornament |
| Enter the Ward — medic emblem | Circular jade medallion with medical motif, ~40×40 PNG |
| Enter the Ward — decorative outer frame | If reference shows carved/inked frame beyond CSS pill |
| Any ward badge on Warden card | Per reference |

All existing emblem PNGs (`daily-rounds.png`, `goals.png`, `recruit.png`, `defense.png`, `supplies.png`) and the hub background (`home_hub_bg.png`) are **already raster and stay as-is** unless a redesign requires replacement art.
