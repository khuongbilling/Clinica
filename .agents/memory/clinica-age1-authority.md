---
name: Clinica Age 1 reward authority
description: Hybrid server authority model for Age 1 progression rewards and guest sessions
---

# Age 1 reward authority

Use a hybrid authority boundary: high-value Journey/chapter/ward/world boss claims
must be committed by a server-validated, one-time progression record; ordinary
practice and replay rewards use a server-issued one-use attempt plus the shared
daily reward taper.

**Why:** This protects chapter readiness and major first-clear value without
turning every local tactical action into a network round-trip. One-use attempts
keep repeat play bounded even after its rewards taper.

**How to apply:** Guest devices authenticate mutations with the signed session,
not a generic player snapshot. Server routes own reward amounts, taper units,
claim idempotency, and stamina limits. A client may present its local battle
outcome, but it must never choose a high-value reward, bypass an existing
gate/key record, or turn a repeat completion into a first clear.