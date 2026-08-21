---
name: Future map obstacle presentation
description: The required dual representation for blocking scenery when authoring Journey maps after the Chapter 1–5 migration set.
---

For Chapters 6 onward, a blocking scenery zone must satisfy three linked rules before its finished map background can ship:

1. Its cells are outside the fixed playable hex footprint.
2. The approved raster has been reviewed to show the obstacle.
3. It has asset-backed, raised runtime scenery art.

**Why:** Painted-only objects can imply blocked routes without real depth or collision authority; runtime-only objects can float over a background that does not explain the blocked space. The fixed geometry, raster, and runtime layer must agree.

**How to apply:** When adding a new Stage 3 map, keep obstacle zones out of the walkable safety mask, add real art for each zone’s primary prop (the first mapped prop, not only a secondary decoration), and mark the raster obstacle review in the authoring registry. The manifest dry-runs the same collision-safe placement used by the renderer; an unplaceable primary blocker rejects the map rather than being forced over a hex. Without both representations, the manifest remains unapproved and the finished raster is not revealed.