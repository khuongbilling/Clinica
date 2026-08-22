---
name: Clinica legacy session policy
description: Safety policy for saves created before signed guest sessions.
---

Pre-session saves that have no stored session credential remain local-only; they must not be auto-linked to a backend player record from a client-provided ID.

**Why:** A player ID and local JSON can be forged, so issuing a session from either would permit account takeover. The product decision is to preserve the local save while requiring a new protected account for server-authoritative economy and Journey features.

**How to apply:** Do not add an ID-only migration or bootstrap endpoint. Frontend startup and persistence must skip protected remote requests when no session token exists.