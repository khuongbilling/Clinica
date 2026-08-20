---
name: Journey run geometry identity
description: How canonical Journey maps detect and recover persisted runs whose tile JSON does not match their claimed identity.
---

For blueprint-pipeline chapters, a persisted run is valid only when its claimed
layout version and blueprint hash **and** its actual coordinate set, start
anchor, and gate anchor match the current canonical artifact.

**Why:** A partial migration can attach current identity markers to an older
coordinate footprint. Equal tile counts and matching hashes then conceal missing
or extra cells, causing Stage 2 diagnostics and Stage 3 presentation to disagree
with the run the player is actually traversing.

**How to apply:** On active-run load, compare persisted tile coordinates and
anchors to the canonical artifact. If any differ, preserve the old run as
abandoned history and create the normal rechallenge/recovery attempt with
eligible inherited chapter progress; never edit coordinates in place. Stage 3
must also require this same exact-geometry proof in addition to canonical Stage
2 validation.