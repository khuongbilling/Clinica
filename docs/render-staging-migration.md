# Render Staging Backend Migration

This is a staging-only deployment blueprint for the existing Clinica backend.
It creates exactly one isolated Render web service:
`clinica-backend-staging`.

The blueprint is intentionally limited to the backend. It does not configure
the frontend, Godot, a custom domain, client endpoint variables, Atlas data,
production routing, or any gameplay/save/reward/economy/authentication/schema
behavior.

## Blueprint configuration

`render.yaml` builds the existing `backend/Dockerfile` with the repository root
as the Docker build context. It uses Render's free compute plan, disables
automatic deploys, and initially checks:

```text
/healthz
```

The non-secret values are explicit:

- `CLINICA_ENV=production`
- `DB_NAME=clinica`

Render prompts for these user-supplied secret environment values through
`sync: false`:

- `MONGO_URL`
- `SESSION_SECRET`

No secret value belongs in `render.yaml`, this repository, Docker build
arguments, image layers, or issue/log output. The staging service must point to
the existing Atlas database; this migration does not modify Atlas.

## Ordered first-boot procedure

The initial `/healthz` check is temporary and exists only for the first staging
boot. It lets the user bring the container up far enough to obtain the Render
outbound IP ranges for the service and region.

1. Create the Render Blueprint from this branch.
2. Supply `MONGO_URL` and `SESSION_SECRET` in Render's secret environment
   configuration. Do not paste either value into Git or this document.
3. Keep the initial Render health check at `/healthz`.
4. Obtain the Render outbound IP ranges for the staging service/region.
5. Add those ranges to the Atlas network access allowlist. This is a
   user-controlled Atlas operation and is not performed by this migration.
6. After Atlas access is configured, validate the staging service at:

   ```text
   /readyz
   ```

   `/readyz` performs the production configuration check and a non-mutating
   MongoDB ping.
7. Only after `/readyz` succeeds, change `healthCheckPath` in `render.yaml`
   from `/healthz` to `/readyz` and deploy that blueprint change.
8. Do not perform any client endpoint change or cutover until the Render health
   check is `/readyz` and readiness remains healthy.

`/healthz` does not prove Atlas connectivity. Leaving it as the permanent
health check would allow a staging process to appear healthy while the
database is unreachable.

## Session and faculty credential continuity

Copy the existing Replit `SESSION_SECRET` **byte-for-byte** into Render's
secret configuration. Do not generate a replacement for staging.

The backend uses this secret to verify already-issued signed guest sessions.
Changing even one byte invalidates those sessions. It also keys the stored
faculty credential hashes, so changing it can invalidate existing stored
faculty credentials.

The blueprint does not silently copy faculty or curriculum-admin bootstrap
tokens. If those optional bootstrap paths are needed in staging, configure
their secrets separately in Render's secret manager without committing their
values.

## Rollback and cutover boundary

This branch only establishes an isolated staging service. It does not change
the Replit workflows, frontend configuration, Godot configuration, Atlas
allowlist, production routing, or any client traffic. Keep automatic deploys
off until the staging readiness gate above is complete.