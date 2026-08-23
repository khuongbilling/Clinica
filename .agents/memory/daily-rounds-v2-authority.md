---
name: Daily Rounds V2 authority
description: Daily Rounds boards are registry-derived client state; stamina recovery is gated by server-owned activity receipts, not board snapshots.
---

Daily Rounds V2 uses registry-derived client board state for presentation, while its Stamina recovery is constrained by server-verified activity receipts and period-limited economy mutations.

**Why:** A client-persisted board cannot establish that an activity really occurred. The recovery mutation therefore derives eligibility from the receipt collection rather than trusting objective progress or claim markers from the player snapshot.

**How to apply:** Keep V2 opportunity discovery restricted to activities with receipt support unless new activities add equivalent server verification. If rewards become material or competitive, move board creation and transitions into the same server-owned compare-and-set flow; do not harden it by checking client objective state.