# Environment & Mode migration — the plan

> Decision doc + ordered, safety-first migration. Execute phase by phase; keep
> every checkpoint green (`pnpm type-check`, `pnpm build`, `pnpm --filter
> @nombaone/api test` + `@nombaone/sara test`, and `pnpm --filter @nombaone/docs
> build`). Never `db:push` — `db:generate` → hand-verify the SQL → `db:migrate`.
> Commits authored solely by the user's git config (no AI/co-author trailers).

## The decision

Two **orthogonal** axes, never conflated again:

| Axis | Name | Values | Mechanism | Merchant-facing? |
|---|---|---|---|---|
| **Deployment environment** | `INFRA_ENVIRONMENT` | `development` · `production` | boot env var; picks DB, secrets, log level | no |
| **Account mode** | `mode` (DB) / key prefix | `sandbox` · `live` | **per-request**, from the API-key prefix → `ctx.mode` | yes (console toggle) |

- `development` is **local-only** (not deployed — cost). We run it locally with dev
  config + a dev database; it serves both modes locally.
- `production` is the only hosted deployment. **One** production app serves **both**
  `sandbox` and `live`. `sandbox.api.nombaone.xyz` is a Cloudflare **CNAME** to
  `api.nombaone.xyz` — a sandbox-only alias to the same system + same DB, not a
  separate deployment or database.
- The account/auth (`organizations`, `org_users`) is **mode-agnostic** (already
  true). One login sees both modes; the console cookie (`console_env`) toggles the
  active mode, re-pinned server-side. Data is partitioned by the `mode` column.
- Security of the partition is enforced by **Postgres Row-Level Security** (DB-level,
  unbypassable) — NOT by duplicating tables. Optionally reinforced by LIST
  partitioning on the hot tables. (Table-per-mode was rejected: it shatters FKs,
  loses cross-mode uniqueness, doubles migrations, and only moves the footgun.)

### Naming (get this exactly right, everywhere)

- DB enum `environment` (`test|live`) → enum **`mode`** (`sandbox|live`); column
  `environment` → **`mode`** on every tenant-scoped table.
- Key prefix `nbo_test_` → **`nbo_sandbox_`**; `nbo_live_` unchanged.
- Routes `/v1/test/*` → **`/v1/sandbox/*`**.
- `DomainContext.environment` → **`DomainContext.mode`**; `ctx.environment` →
  `ctx.mode`; `Environment` type → **`Mode`** (`'sandbox' | 'live'`).
- `INFRA_ENVIRONMENT` values change from `test|live` to **`development|production`**
  and it now means the **deployment ring only** (never the mode).
- Docs: `INFRA_DEMO_SANDBOX_KEY` name is already correct; content swaps
  `nbo_test_`→`nbo_sandbox_`, "test mode"→"sandbox mode", `/v1/test/*`→`/v1/sandbox/*`.

---

## Phase 1 — Rename  ✅ DONE (type-check 10/10, migration 0015 applied data-preserving, sara 142/142): `environment`→`mode`, `test`→`sandbox` (foundation)

Mechanical but wide. Land it first; everything references the mode.

- **Schema (`packages/core-db/src/schema/`)**: `shared.ts` — rename
  `environmentEnum = pgEnum('environment',['test','live'])` → `modeEnum =
  pgEnum('mode',['sandbox','live'])`. Rename the column `environment('environment')`
  → `mode('mode')` on every tenant table (api-keys, customers, ledger-accounts,
  ledger-transactions, domain-events, webhook-endpoints, plans, prices,
  payment-methods, nomba-webhook-events, org-nomba-accounts, subscriptions,
  subscription-items/periods/schedules, invoices, invoice-line-items, coupons,
  discounts, credit-grants, org-billing-settings, dunning-attempts, settlements,
  refunds, payouts, examples). Update every unique/keyset index that names
  `environment` (e.g. `customers_org_env_email_unique`, `plans_org_env_name_unique`,
  `org_billing_settings_org_env_unique`, `*_keyset_idx`). `org_sessions.environment`
  → `mode` (default `'sandbox'`). Leave `ledger_entries` / `webhook_deliveries`
  (they inherit via FK). `operator_preferences.default_environment` → `default_mode`
  (text, default `'live'`).
- **Migration**: `pnpm --filter @nombaone/core-db db:generate`, then **hand-verify**
  the SQL uses metadata-only ops that preserve data:
  `ALTER TYPE environment RENAME TO mode;`
  `ALTER TYPE mode RENAME VALUE 'test' TO 'sandbox';`
  `ALTER TABLE <t> RENAME COLUMN environment TO mode;` (per table).
  Drizzle-kit may try to drop/recreate the enum — replace that with the RENAME
  statements so existing rows survive. Then `db:migrate` on the dev DB.
- **sara (`packages/sara/src/`)**: `context.ts` — `Environment`→`Mode`
  (`'sandbox'|'live'`), `DomainContext.environment`→`mode`. `api-keys/keys.ts` —
  `ENV_PREFIX = { sandbox:'nbo_sandbox_', live:'nbo_live_' }`, `environmentFromKey`→
  `modeFromKey`, `generateSecret(mode)`, all `ctx.environment`→`ctx.mode`, insert
  `mode` column. Sweep every sara module that reads `ctx.environment`/`environment`.
- **api (`apps/api/src/`)**: every controller `ctx: DomainContext = { organizationId,
  mode: req.apiKey.mode }`; `express.d.ts` `req.apiKey.mode`; correlation fields.
  Router `/v1/test` → `/v1/sandbox` (`testRouter`→`sandboxRouter`, module folder
  `modules/test`→`modules/sandbox` if present).
- **contracts/errors**: `core-contracts` env types → mode; error code
  `API_KEY_ENVIRONMENT_MISMATCH` may be renamed `API_KEY_MODE_MISMATCH` (keep an
  alias if any docUrl depends on it — check `/errors`).
- **tests/seeds/scripts**: `apps/api/test/helpers/harness.ts` and every `scripts/*`
  (`seed-dev`, `provision-docs-key`, `verify-docs-key`, rail/probe scripts) — swap
  `environment`→`mode`, `test`→`sandbox`, `nbo_test_`→`nbo_sandbox_`.
- **Acceptance**: `pnpm type-check` 10/10; `db:generate` yields a review-clean
  metadata-only rename migration; `pnpm --filter @nombaone/api test` +
  `@nombaone/sara test` green.

## Phase 2 — Nomba credentials become **mode-selected** (SAFETY-CRITICAL)  ✅ DONE (type-check 10/10, build 6/6, sara 142/142, api 104✓/0✗, env boots)

Do this **before** Phase 3. Once one deployment serves both modes, the payment rail
MUST be chosen by the request's mode, or a sandbox charge could hit live Nomba.

**Landed:** `env.ts` split into `NOMBA_SANDBOX_*` + `NOMBA_LIVE_*` (+ per-mode
webhook-sig keys), `INFRA_ENVIRONMENT` → `z.enum(['development','production'])`
default `development`. `nomba.ts` → `getNombaClient(mode)` with `credsFor(mode)`,
per-mode `Map` cache, live-on-production guard, `availableNombaModes()` (override-
aware) for sweeps; `__setNombaClient` → `setBillingNombaClientFactory`. Sara rails
+ `actionLink` + both inbound processors (`processInboundInvoiceEvent`,
`processInboundDunningEvent`) now take a `NombaClientFactory` and resolve the client
from the *row's* mode. All controller/worker/script/e2e callers pass a mode. `.env`,
`.env.production`, `.env.example` remapped to both cred sets.

- **env (`apps/api/src/shared/config/env.ts`)**: replace the single `NOMBA_*` set
  with two groups — `NOMBA_SANDBOX_*` (→ Nomba's sandbox/test credentials) and
  `NOMBA_LIVE_*` (→ Nomba live). `INFRA_ENVIRONMENT` becomes
  `z.enum(['development','production'])` (default `development`).
- **`apps/api/src/shared/config/nomba.ts`**: `getNombaClient(mode: Mode)` returns a
  per-mode cached client built from the matching credential set; Redis token cache
  key namespaced by `mode` (already `nomba:token:${…}`). No more process-singleton
  keyed on the deployment.
- **Callers**: every place that calls `getNombaClient()` now passes `ctx.mode`
  (collect sites in sara rails, settlement, payout, reconcile cron, mandate sweep).
- **Hard guard**: a request/worker in `mode==='live'` is **rejected unless
  `INFRA_ENVIRONMENT==='production'`** — so `development` (local) can never move real
  money even with a `nbo_live_` key. Central guard in the api-key middleware + a
  guard in the cron mode-iteration.
- **Acceptance**: unit test — `getNombaClient('sandbox')` and `('live')` return
  distinct clients with distinct creds; a `live` request on `development` is refused;
  green build/tests.

## Phase 3 — Decouple mode from deployment (one app, both modes)  ✅ DONE (same green gates as Phase 2)

**Landed:** api-key host-pin deleted (replaced by the live-on-production safety
guard, same `API_KEY_ENVIRONMENT_MISMATCH` code). `/v1/sandbox/*` now mounts
**always**; new `requireSandboxMode` middleware (after `apiKeyAuth`) 403s any
`live` key, and each handler re-checks `ctx.mode`. All four sweeps
(`billing-sweep`, `dunning-sweep`, `reconcile-nomba`, `mandate-activation-sweep`)
loop `ALL_MODES` (DB-only sweeps) or `availableNombaModes()` (Nomba-dependent),
skipping `live` off production. `gen-openapi.ts` walks `v1Router` directly (sandbox
paths always present). e2e: `api.e2e` proves a live key is refused on `development`;
`test-instruments.e2e` proves `/v1/sandbox/*` works for a sandbox key.

- **`apps/api/src/shared/middlewares/api-key.ts`**: DELETE the
  `verified.mode !== env.INFRA_ENVIRONMENT` rejection (the host pin). Mode now comes
  from the key prefix alone. Keep the live-on-non-production guard from Phase 2.
- **`apps/api/src/apps/main/server/routes.ts`**: mount `/v1/sandbox/*` **always**;
  gate each sandbox route on the **request mode** (`req.apiKey.mode==='sandbox'` →
  else `403`), not on the deployment. `gen-openapi.ts` already mounts both for the
  snapshot — confirm the snapshot includes `/v1/sandbox/*`.
- **Cron/workers** (`billing-sweep`, `dunning-sweep`, `reconcile-nomba`,
  `mandate-activation-sweep`, `webhook-maintenance`): iterate **both** modes per run
  (was `env.INFRA_ENVIRONMENT`; now loop `['sandbox','live']`, skipping `live` when
  `INFRA_ENVIRONMENT!=='production'`). Fair-keys/locks namespaced per mode.
- **Acceptance**: an e2e that mints a `sandbox` and a `live` key for one org and
  drives both against a single running app — both authenticate, `/v1/sandbox/*`
  works for the sandbox key and 403s for the live key; sweeps process both modes.

## Phase 4 — Row-Level Security (the real isolation)  ✅ DONE (migration 0016 applied; RLS e2e 4/4; api 105✓/0✗; owner-bypass keeps the app unaffected)

**Landed:** migration `0016_rls_mode_isolation` — a non-owner `nombaone_rls` role +
`ENABLE ROW LEVEL SECURITY` + a `mode_isolation` policy
(`mode = NULLIF(current_setting('app.mode',true),'')::mode`, USING **and** WITH
CHECK, fail-closed) on all **27** mode-column tables, plus a parent-join policy on
the 2 child tables (`ledger_entries`, `webhook_deliveries`). GUC choke point
`runWithModeContext(db, ctx, fn)` in `@nombaone/core-db/rls` (`SET LOCAL`
app.mode/app.org per tx). e2e `rls-mode-isolation` proves: owner bypass sees both;
`SET LOCAL ROLE nombaone_rls` + `app.mode='sandbox'` → only sandbox rows, flip →
only live, unset → none; GUCs don't leak past the tx. **Deferred (documented):** the
app still connects as the table OWNER (bypasses RLS), so RLS is armed-but-dormant
defence-in-depth beneath the query-layer filters; production hardening = switch the
DB role to `nombaone_rls` + route mode-scoped reads through `runWithModeContext`
(no domain code changes). Org-level tenant RLS left to a follow-up (query layer
already enforces org).

- **Session-var plumbing**: at the start of every request's DB transaction/connection
  scope, `SET LOCAL app.mode = ctx.mode` and `SET LOCAL app.org = ctx.organizationId`
  (a single choke point in the db/tx wrapper, `packages/sara` or `core-db`).
- **Policies**: on every mode-scoped table, `ALTER TABLE … ENABLE ROW LEVEL SECURITY`
  + `CREATE POLICY mode_isolation USING (mode = current_setting('app.mode')::mode)`
  and a tenant policy `USING (organization_id = current_setting('app.org')::uuid)`
  where the column exists. Child tables (`ledger_entries`, `webhook_deliveries`) get
  policies that join to the parent, or are covered by revoking direct access.
- **Prototype first on `invoices`**, prove a raw query without a filter returns only
  the current mode's rows, then roll out via a generated migration (add-only).
- **App role**: ensure the runtime DB role is subject to RLS (not a superuser/owner
  that bypasses it); a separate migration/admin role may bypass for ops.
- **Acceptance**: a test that opens a tx with `app.mode='sandbox'` and `SELECT * FROM
  invoices` (no WHERE) returns zero live rows; flipping the setting flips the visible
  set. Green build/tests.

## Phase 5 — (recommended) LIST partitioning of hot tables  ⏸️ DEFERRED (data volume is tiny; the plan sanctions deferral — "Optional — can defer if data volume is still small")

**Decision:** consciously deferred. Partitioning the live-money hot tables
(`invoices`, `ledger_transactions`, `ledger_entries`, `subscriptions`,
`domain_events`) is a create-new-partitioned + copy + swap + FK-re-point migration
— non-trivial risk on the double-entry ledger — for a **performance** benefit that
is worthless at the current (pre-launch) row counts. RLS (Phase 4) already delivers
the logical isolation this migration is about. Revisit when a single mode's hot
table crosses ~10M rows or `EXPLAIN` shows scan cost dominated by the other mode's
data. No code change until then.

Physical separation without a second logical table.

- Convert the high-volume mode-scoped tables — `invoices`, `ledger_transactions`,
  `ledger_entries`, `subscriptions`, `domain_events` — to
  `PARTITION BY LIST (mode)` with `sandbox` / `live` partitions. One logical table,
  planner auto-prunes. Do as a create-new-partitioned + copy + swap migration on a
  branch DB first; verify FKs/constraints survive.
- **Acceptance**: `EXPLAIN` shows partition pruning on a mode-filtered query; all FKs
  intact; green. (Optional — can defer if data volume is still small.)

## Phase 6 — Docs sweep (keep the 4 gates green)  ✅ DONE (check:frontmatter/style/links/openapi all PASS; agent-native 81 .md mirrors regenerated)

**Landed:** OpenAPI snapshot regenerated (`/v1/sandbox/*`, `mode` enum corrected to
`['sandbox','live']`); `nbo_test_`→`nbo_sandbox_` (74) and `/v1/test/*`→`/v1/sandbox/*`
(17) across content; the **Test toolkit** section renamed to **Sandbox toolkit**
(dir + files + manifest slugs + all internal links); `environments.mdx` rewritten to
the two-axis model; stale JSON/prose examples (`"environment":"test"`→`"mode":"sandbox"`,
`<ResponseField name="environment">`→`name="mode"`, per-environment→per-mode webhooks)
fixed. The `<ApiExplorer>`/MCP/playground strings and doc-comments were swept in the
Phase-9 audit pass.

- Regenerate the OpenAPI snapshot: `pnpm --filter @nombaone/api gen:openapi` (routes
  now `/v1/sandbox/*`). This is the source the docs honesty gate checks against.
- Sweep `apps/docs/content/**`: `nbo_test_`→`nbo_sandbox_`, `/v1/test/*`→
  `/v1/sandbox/*`, "test mode/environment"→"sandbox mode", the behavior enum stays
  (`success|requires_otp|decline_*`). Update the money-is-integer-kobo, environments,
  authentication, test-toolkit, verify-in-your-devtools, webhooks pages, and the
  `<Snippet>`/`<RailSwitcher>`/`ApiReference` component strings.
- Rename the Test-toolkit section → "Sandbox toolkit" (manifest + slugs, with
  redirects if slugs change), and the environments page to state the two-axis model
  (deployment vs mode) plainly.
- **Acceptance**: `pnpm --filter @nombaone/docs build` green — all 4 gates
  (`check:frontmatter/style/links/openapi`) pass with the new routes/prefixes.

## Phase 7 — Deploy workflow + DNS  ✅ DONE (workflow) · ⚠ DNS is a dashboard action (manual)

**Landed:** `.github/workflows/deploy-api.yml` — deleted the `deploy-sandbox` job;
now a single `check-affected` (git-diff) → `deploy-production` (environment
`Production`). Comment updated to state one app serves both modes and
`sandbox.api.nombaone.xyz` is a CNAME alias. The `DO_APP_NAME_API_SANDBOX` GitHub
secret is now unused (safe to delete). **Manual (dashboard, not code):** add the
`sandbox.api` CNAME → `api.nombaone.xyz` on Cloudflare + as a custom domain on the
DO app so the TLS cert covers it.

- **`.github/workflows/deploy-api.yml`**: revert to a **single** production deploy —
  delete the `deploy-sandbox` job (sandbox is a mode, not a deployment). Keep the
  cheap `check-affected` git-diff gate and `deploy-production` (environment
  `Production`, `INFRA_ENVIRONMENT=production`). Development is not deployed.
- **Cloudflare**: add `sandbox.api` as a **CNAME → api.nombaone.xyz** (proxied,
  same as `api`/`docs`), and set it as a custom domain on the DO app so the cert
  covers it. Optionally, a thin host guard: requests arriving on `sandbox.api.*`
  accept only `nbo_sandbox_` keys (nice-to-have; the key prefix already decides
  mode).
- **Production DO app env**: `INFRA_ENVIRONMENT=production`, both `NOMBA_SANDBOX_*`
  and `NOMBA_LIVE_*` credential sets, one `INFRA_DATABASE_URL` (the production DB
  holding both modes).
- **Acceptance**: YAML valid; a push to main deploys one production app.

## Phase 8 — Re-provision the docs sandbox key in the unified DB  ✅ DONE (verify:key → AUTHENTICATES, mode: sandbox, 26 scopes)

**Landed:** ran `provision:docs-key` against the migrated DB (ep-empty-waterfall —
confirmed carrying all 29 RLS policies + the `nombaone_rls` role), minting a fresh
`nbo_sandbox_…` key (the old `nbo_test_…` demo key no longer authenticates — the
verifier only accepts `nbo_sandbox_`/`nbo_live_` prefixes). Rewired
`apps/docs/.env` `INFRA_DEMO_SANDBOX_KEY`; `verify:key` prints AUTHENTICATES
mode=sandbox, 26 scopes. Also fixed stale "environment: test" labels in the
provision/verify scripts → "mode: sandbox". (Note: the deployed PROD DB
`ep-old-recipe` is separate and must have migrations 0015+0016 applied at deploy
time before it serves traffic.)

- The org/key minted earlier live in whatever DB `apps/api/.env` pointed at. In the
  final model there is ONE production DB (both modes). Run `provision:docs-key`
  (now minting a `nbo_sandbox_` key) against the production DB; `verify:key` to prove
  it authenticates; re-wire `apps/docs/.env` `INFRA_DEMO_SANDBOX_KEY`. Revoke the old
  key if it lived in a now-retired DB.
- **Acceptance**: `verify:key` prints AUTHENTICATES with `mode: sandbox`, full scopes.

## Phase 9 — Full verification  ✅ DONE — ALL GREEN

Final gate sweep (2026-07-04):
- `pnpm type-check` **10/10** · `pnpm build` **6/6** · `@nombaone/sara test` **142/142** ·
  `@nombaone/api test` **108 passed / 0 failed** (5 skipped: live-network) · docs
  `check:frontmatter|style|links|openapi` **all PASS** · `db:check` **clean**.
- Behavioural acceptance proven by tests: `api.e2e` refuses a `live` key on
  `development`; `requireSandboxMode` gates `/v1/sandbox/*` per request mode;
  `rls-mode-isolation.e2e` proves a no-filter SELECT as the RLS role returns only the
  `app.mode` slice; the rail FACTORY + always-mounted sandbox routes prove one app
  serves both modes.

**Deep audit (beyond the plan):** an exhaustive residual-leak sweep (6 surfaces ×
adversarial verify) caught **72 confirmed leaks the compiler-guided rename could not
see** — hand-authored surfaces: the OpenAPI `mode` enum was still `['test','live']`
in `responses.ts` (a real published-contract lie; runtime returns `sandbox`); the
admin/console mode-switchers/StatusPill/type-guard still wrote/accepted `'test'`; the
docs MCP tool advertised `/v1/test/payment-methods` to AI agents; plus ~40 stale
doc-comments/env-examples. All fixed (responses.ts enum + snapshot regen; a per-file
apply pass; `operators.default_environment` → `default_mode` via migration 0017). A
final grep confirms zero residual mode-value `test`/`environment` leaks outside the
one intentional "legacy APIs conflate test/live" contrast line on the environments page.

## Ordering rationale

Rename first (foundation) → **Nomba creds mode-selected + live guard (safety) BEFORE
decoupling** → decouple (one app both modes) → RLS (DB-enforced isolation) →
partitioning (optional physical) → docs → deploy/DNS → re-provision → verify. The
money-path safety (Phase 2) always precedes the change that lets one app serve both
modes (Phase 3).
