# Admin / ops surface

Things operators and infrastructure need that are **not** part of the public developer API.
The public API (`/v1/*`) is for the tenant's developers; anything here is for **us** running
the platform and belongs to the admin app (`apps/admin`, to be built) or an internal ops port
— never mixed into the developer surface.

## Readiness probe (moved out of the public API)

Previously `GET /v1/ready`. Removed from the public API — a tenant developer never needs a
readiness probe, and exposing internal dependency health on the developer surface is noise (and a
mild information leak). It belongs to admin/ops.

**Contract (rebuild in `apps/admin` or an internal ops listener):**

- **Path:** `GET /ready` on the admin/ops surface (internal — behind the ops network / admin auth,
  or an unauthenticated internal port that a k8s readiness probe / load balancer can hit cheaply).
- **Behaviour:** deep-checks the real dependencies in parallel and returns a per-dependency map.
  - `db` — `SELECT 1`
  - `redis` — `PING`
  - `nomba` — `getToken()` (cheap: reads the cached OAuth token, only refreshes near expiry).
    Reported `skipped` (non-blocking) when Nomba isn't configured for the deployment.
- **Response:** `200` with `{ ready: true, dependencies: { db, redis, nomba } }` only when every
  non-skipped dependency is `ok`; otherwise `503` with the same map so the failing dep is obvious.

Liveness stays on the public side as `GET /v1/health` (returns `{ status: "ok" }`) — cheap, no
auth, safe for a load balancer, and it shares the platform's one response envelope.

The reference implementation was in `apps/api/.../modules/health/routes.ts` (git history) — lift the
`/ready` handler verbatim into the admin app when it's built.

## Other ops concerns that live here (not the public API)

- Operator inspection of any tenant's subscriptions/invoices/ledger for support.
- Cross-tenant reconciliation dashboards + the settlement/escrow drift view.
- Feature flags, kill-switch, and per-tenant limit/quota overrides.
- Metrics scrape (`/metrics` Prometheus), scheduler-lag + charge-failure gauges.
