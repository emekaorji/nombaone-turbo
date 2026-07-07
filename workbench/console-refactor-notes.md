# Refactor notes for the console agent — `sara` is no longer the domain

A large refactor moved code between packages/apps. **The console is directly affected in one important way: the merchant auth *workflows* now live inside `apps/console`, not in `@nombaone/sara`.** Everything else you import from sara still works. This doc is what you need to know.

## TL;DR

- `@nombaone/sara` used to hold the entire product domain. It's now **reusable infrastructure only**.
- The **money engine** (billing, subscriptions, invoices, dunning, settlement, plans, prices, coupons, …) moved into **`apps/api`** (`apps/api/src/shared/services/`). The console never imported these, so nothing to change there.
- **Merchant auth workflows** (signup, login, sessions, users, password-reset) **moved OUT of sara and INTO the console** at `apps/console/src/lib/auth/`. **This is the change that touches you.**
- `@nombaone/sara/auth` is now **primitives only**.
- New hard rule: **a package may never import from an app.** Enforced by `pnpm check:boundaries` (CI gate).

Commits: `ee4b5b0` (domain out of sara), `35540c5` (auth → apps), `5bf0760` (layout + boundary gate).

---

## The one thing that changed for the console: AUTH

### Auth workflows are now yours — `apps/console/src/lib/auth/`

These files were moved from `packages/sara/src/auth/` into the console:

```
apps/console/src/lib/auth/
  index.ts            # barrel — export * from the below
  signup.ts           # signupOrganization
  login.ts            # loginOrgUser
  session.ts          # createSession, validateSession, revokeSession
  users.ts            # createOrgUser, findUserById, findUserByEmail, updateUserPassword, ...
  password-reset.ts   # requestPasswordReset, resetPassword
```

They are **built on** sara's auth primitives (they `import { hashPassword, verifyTotp, … } from '@nombaone/sara/auth'`). You own these workflows now — the console is the owner of merchant/org identity.

**Import them from the local barrel, not sara:**

```ts
// ✅ NOW — workflows come from the local console lib
import { signupOrganization, loginOrgUser, validateSession, findUserById } from '@/lib/auth';
//   (or a relative path: '../lib/auth', './auth', etc. depending on the file)

// ❌ BEFORE (do not do this anymore — these are no longer exported by sara)
import { signupOrganization } from '@nombaone/sara/auth';
```

### `@nombaone/sara/auth` is now PRIMITIVES ONLY

Still import these from sara (unchanged) — they are product-agnostic and shared:

| Symbol | What |
|---|---|
| `hashPassword`, `verifyPassword` | bcrypt |
| `generateTotpSecret`, `verifyTotp`, `buildTotpUri` | TOTP crypto |
| `can` | RBAC predicate |
| `Capability`, `OrgUserRole` | RBAC types |

```ts
// ✅ primitives stay on sara
import { can } from '@nombaone/sara/auth';
import type { Capability, OrgUserRole } from '@nombaone/sara/auth';
```

**Rule of thumb:** if it *hashes/verifies/decides* (a pure helper) → `@nombaone/sara/auth`. If it *reads/writes `org_users`/`org_sessions`* (a workflow) → `@/lib/auth` (console-local).

---

## What the console still imports from `sara` (unchanged)

These are reusable infra / cross-app services and stay in sara. Your existing imports keep working:

| Import path | Used for |
|---|---|
| `@nombaone/sara/context` | `DomainContext {organizationId, mode}`, `Mode`, `InfraDb`, `InfraTxDb` — the tenant-scope + DB-handle types |
| `@nombaone/sara/api-keys` | `createApiKey`, `listApiKeys`, `revokeApiKey`, `requireScope` — merchant API-key management |
| `@nombaone/sara/webhooks` | `createWebhookEndpoint`, `listWebhookEndpoints`, `disableWebhookEndpoint`, `signWebhookPayload`, … |
| `@nombaone/sara/example` | `createExample`, `getExampleByReference`, `listExamples` — the demo money-path |
| `@nombaone/sara/org` | `getOrganization`, `listMembers` |
| `@nombaone/sara/reference` | `mintReference` |
| `@nombaone/sara/crypto` | PII encrypt/decrypt |
| `@nombaone/sara/money`, `/pagination`, `/idempotency`, `/ledger`, `/events`, `/rails` | money helpers, cursor pagination, reusable financial infra |

The console reaches the DB directly (`@nombaone/core-db/pool`, server-side) — that has **not** changed.

---

## What LEFT sara (you never imported these, listed for completeness)

The subscription-billing **money engine** now lives in `apps/api/src/shared/services/`: `billing`, `subscriptions`, `subscription-schedules`, `invoices`, `dunning`, `settlement`, `plans`, `prices`, `coupons`, `discounts`, `credits`, `payment-methods`, `proration`, `tenant-config`, `customers`, `reconciliation`, `scheduling`, `metrics`. **These are api-owned.** If the console ever needs subscription/invoice data, read it from the DB directly or call the api — do **not** try to import these from sara (they're not there, and a package importing an app is forbidden).

Also: `recordAudit` moved to `apps/admin/src/lib/audit` (operator-only) — not console-relevant.

---

## The architecture rule going forward

1. **`@nombaone/sara` = reusable infrastructure + primitives + cross-app services.** No product money engine.
2. **Each app owns its own auth:** console = merchant/org login; admin = operator login; api = API-key verification.
3. **A package can never import from an app.** `pnpm check:boundaries` fails the build if it does. So the console's auth workflows must live in the console (they can't go back into sara).
4. **Console auth workflows are built on sara auth primitives** (`hashPassword`, `verifyTotp`, `can`, …).

---

## Migration checklist for the console

- [ ] Any `import … from '@nombaone/sara/auth'` that pulls a **workflow** (`signupOrganization`, `loginOrgUser`, `validateSession`, `revokeSession`, `createSession`, `findUserById`, `findUserByEmail`, `createOrgUser`, `requestPasswordReset`, `resetPassword`) → change to `@/lib/auth`.
- [ ] Keep **primitive** imports (`can`, `Capability`, `OrgUserRole`) on `@nombaone/sara/auth`.
- [ ] New auth workflow logic → add it to `apps/console/src/lib/auth/`, not to sara.
- [ ] Run `pnpm --filter @nombaone/console type-check` — it should be green.

(The console codebase in this repo has already been updated to this pattern — `apps/console/src/lib/session.ts`, `lib/auth-actions.ts`, `lib/auth-context.ts`, `lib/rbac.ts`, and `scripts/seed-local.ts` are working references.)
