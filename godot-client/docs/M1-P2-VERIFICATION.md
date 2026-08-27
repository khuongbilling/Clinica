# M1-P2 Verification Report — Portable Schemas + Migrations

This records exactly what was checked for the M1-P2 push, in the same
environment used for M1-P1 (Godot 4.4.1.stable via this workspace's Nix
environment), and what remains a known, tracked limitation.

## 1. What M1-P2 adds

A real, executable, engine-independent migrator
(`scripts/core/migration/player_save_migration.gd`,
`player_save_transfer.gd`) that carries a legacy/partial `clinica.player`
save forward to the canonical v3 envelope, per
`docs/save-schema-migration-ledger.md` and
`docs/canonical-save-schema-contract.md`. See `docs/MIGRATION.md` §9 for the
full design write-up.

## 2. Environment

- Godot 4.4.1.stable, invoked headlessly, same binary/setup as M1-P1
  (see `docs/M1-P1-VERIFICATION.md` §2 for how it was provisioned).
- No changes were made to `replit.nix`, application dependencies, or
  lockfiles for this push.

## 3. Checks run and results

### 3.1 Real-engine import/parse

```sh
godot --headless --path godot-client --import
```

Result: **PASS** — all new `.gd` files
(`migration_outcome.gd`, `player_save_migration.gd`,
`player_save_transfer.gd`, `player_save_migration_validator_adapter.gd`,
`run_migration_validation.gd`) plus the two edited files
(`i_save_cache_store.gd`, `local_save_cache_adapter.gd`) parse and import
without error under a real Godot engine. No GDScript syntax/type errors.

### 3.2 Headless boot smoke test (regression)

```sh
godot --headless --path godot-client --quit-after 2 res://scenes/boot/boot.tscn
```

Result: **PASS** (unchanged from M1-P1) — boot scene still parses and runs;
`LocalSaveCacheAdapter`'s new methods did not break composition-root wiring
(they are not autoload-constructed args; `composition_root.gd` is
unmodified).

### 3.3 Existing fixture/hash validator (regression, all 10 fixtures)

```sh
godot --headless --path godot-client --script res://scripts/tools/run_fixture_validation.gd
```

Result: **PASS** — unchanged from M1-P1; all `payload_sha256_parity:*`
checks across all 10 golden fixtures still pass. This file was not modified
by M1-P2 (the new migration validator is a separate adapter/tool, per the
design decision to avoid overloading the existing one).

### 3.4 New migration validator — fixture-driven cases

```sh
godot --headless --path godot-client --script res://scripts/tools/run_migration_validation.gd
```

Ran the real migrator against every case in
`fixtures/clinica-golden/v1/saves/player-migration-vectors.json`:

| Fixture case | Result |
| --- | --- |
| `canonical-v3-roundtrip` (already v3 → `accept`, unchanged) | **PASS** |
| `legacy-alias-and-dedup` (unversioned → `migrate`, learning-profile alias, Chapter-1 node alias, `realm_seed` derivation `"fixture-player-0002"` → `"realm-fixture-0002"`, set-like dedup) | **PASS** |
| `unknown-future-quarantine` (`save_version` above supported → `quarantine`, input preserved, never downgraded) | **PASS** |
| `malformed-valuable-field-fails-closed` (bad type/negative valuable field → `quarantine`, fails closed) | **PASS** |

Additional per-case checks that ran on top of the four cases above:
- `purity_input_unmutated` — `migrate()` never mutates its argument.
- `action_matches` / `quarantine_reason_matches` / `quarantine_preserves_input` / `quarantine_never_downgrades`.
- `save_version_is_3`, `learning_profile_alias`, `realm_seed_derived`, `set_like_dedup`.
- `computed_grant_delta_is_zero` — the **independently computed** delta
  (not the fixture's declared value) between pre- and post-migration
  valuable fields is zero for every accept/migrate case.
- `idempotent_second_pass` — re-running `migrate()` on the migrated output
  is an `accept` producing a byte-identical envelope.
- `json_round_trip` — the envelope survives `JSON.stringify` →
  `JSON.parse_string` → `PlayerEnvelope.from_dict` unchanged.

All: **PASS**.

### 3.5 New migration validator — supplementary native vectors

These cover ledger-required scenarios the current golden fixture pack does
not yet exercise on its own:

| Native check | What it proves | Result |
| --- | --- | --- |
| `stable_id_preserved_heroes_owned` | Roster hero IDs pass through unchanged, unreordered, undeduplicated-away | **PASS** |
| `repeated_migration_deterministic` | Same input twice → byte-identical output (no clock/random dependency) | **PASS** |
| `chapter1_alias_adds_new_id` | The one documented alias-rename adds the new ID alongside the old | **PASS** |
| `chapter1_alias_not_a_mint` | That rename is excluded from the independently computed grant delta | **PASS** |
| `player_hero_not_manufactured` | Migration never fabricates a Player Hero from roster heroes | **PASS** |
| `v3_accept_baseline` / `no_destructive_downgrade_path` | A `save_version` forced below an already-v3 shape does not silently discard existing authoritative values | **PASS** |
| `non_dictionary_input_quarantines` | A non-Dictionary raw input quarantines instead of crashing | **PASS** |
| `export_redacts_credential_keys` / `export_is_plain_dictionary` | The transfer export boundary redacts credential-shaped keys and stays a plain Dictionary, never a Godot `Resource` | **PASS** |

All: **PASS**. Full JSON report available by running
`run_migration_validation.gd` directly; it prints one line per check with
pass/fail and an optional detail message.

### 3.6 `validate_skeleton.sh` (regression + new step)

```sh
bash godot-client/tools/validate_skeleton.sh
```

Result: **PASS** — now runs 3 headless steps (fixture validator, boot
smoke test, migration validator) plus the updated structural file-presence
list (includes the 3 new files under `scripts/core/`).

## 4. Self-audit findings

- **Duplicate schemas / parallel authorities:** none introduced. The
  canonical hash logic in `fixture_validator_adapter.gd` was not touched or
  duplicated; the new migration validator reuses `PlayerEnvelope` and calls
  the one real migrator, and does not invent a second canonicalization or
  hashing scheme.
- **Stable-ID drift:** none found — `_dedup_preserve_order` only removes
  exact duplicates; alias tables only add a new ID when the old one is
  present, never rename/remove.
- **Local-authority leakage:** none — `LOCAL_FIELDS` / `local.extensions`
  are never read by `AUTHORITATIVE_FIELDS` classification, and
  `write_quarantine`/`read_quarantine` use a storage path fully separate
  from the normal local cache file, so a quarantined record cannot silently
  become the active cache.
- **Accidental reward creation:** none — `compute_grant_delta()` is
  independently computed (not trusted from the fixture) and is zero on
  every accept/migrate fixture case; the one intentional exception (Chapter
  1 alias rename) is explicitly excluded and covered by
  `chapter1_alias_not_a_mint`.
- **Frontend/backend/runtime behavior:** untouched. No files under
  `frontend/`, `backend/`, or the repository root package manifests were
  modified by this push; only `godot-client/` and its docs changed.
- **ENGINE LOCK-IN:** stays **LOW** — `scripts/core/migration/` and
  `scripts/core/contracts/migration_outcome.gd` reference no Godot node
  type (`RefCounted`-only, plain `Dictionary`/`Array`/`String`), matching
  the pattern already established for the rest of `scripts/core/` in
  M1-P1.

No BLOCKER or HIGH issues were found during this audit.

## 5. Explicitly out of scope (see `docs/MIGRATION.md` §10)

Journey/battle/Realm/inventory/shop/recruitment/economy/Player-Hero-creation
gameplay, network authority implementation, and the backend authority gaps
already tracked in the canonical contract/ledger documents (§8 of each) are
unchanged and were not silently patched by this push.
