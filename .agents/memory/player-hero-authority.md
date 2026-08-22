---
name: Player Hero authority rails
description: Durable rules for one-time Player Hero creation and Journey development opportunity resolution.
---

Player Hero creation must atomically accept only a missing or `null` Player Hero record, then persist both the generated hero and its receipt in the same conditional write. A missing field and a persisted `null` have different MongoDB semantics.

**Why:** New player documents explicitly serialize the unset record as `null`; testing only for field absence silently makes every otherwise eligible new account fail the one-time creation condition.

**How to apply:** For any immutable Player Hero grant, use the persisted Player Hero record (not client state) as the creation lock and make retries return the already-created record without rerolling.

Journey development opportunities must key their deterministic server roll to the completed run and calculate exploration only from server-validated visited tiles. A retry for an already-cleared run must reconcile an opportunity that was missed after its clear write.

**Why:** Client-supplied explored counters can inflate valuable-outcome odds, and an interruption between separate writes can otherwise permanently skip the run's one allowed resolution.

**How to apply:** Keep the no-award result as a persisted resolution too; never reroll from a tile reload, a retry, or a client-provided aggregate.