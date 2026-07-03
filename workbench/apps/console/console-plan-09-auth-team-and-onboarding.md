# Nomba One Console · Plan · 09 · Auth, team, environments, and onboarding

> **What this is.** The grounding plan for the console's identity, access, and first-run surface: how a person signs in, proves a second factor, resets a password, invites teammates, holds a role, switches between the test and live rings, connects the tenant's Nomba account, and reaches a first working subscription. It names the one dependency the whole console rests on, the console-auth API, which is not yet built, and specifies exactly what to build over the auth verbs that already exist in `@nombaone/sara/auth`. Every screen carries its real data, its actions, its finite-state gating, and its empty, loading, and error states, with ASCII wireframes as the Phase A pencil starting point.
>
> **Depends on:** doc 00 (north star, personas, scope boundary, voice, design language), doc 01 (app shell, left nav, the mandatory test/live switch, cursor pagination), doc 04 (the Developers area, where API keys and webhooks live), and doc 08 (the errors-are-a-feature rendering contract this doc reuses for every auth failure).

---

## 1. Dependency number one: the console-auth API is unbuilt

Read this section before any other. It is the load-bearing truth of the entire console.

`apps/api` authenticates one kind of caller: a machine holding a per-org secret key (`nbo_test_…` / `nbo_live_…`). It has **no user, no session, and no OAuth layer**. A human cannot sign in to `/v1`. The database already carries every table a console session needs (`org_users`, `org_sessions`, `password_reset_tokens`, `api_keys`), and `@nombaone/sara/auth` already carries every verb that operates them correctly. What is missing is the HTTP surface that turns those verbs into routes a browser can call. Until that surface exists, login, team management, role gating, environment switching, and key minting cannot ship. So the console-auth API is dependency number one, and the plan names it plainly rather than papering over it.

### 1.1 What already exists (real, in `@nombaone/sara/auth` and `@nombaone/sara/org`)

These are verbs, not endpoints. They own the secret-handling rules and enforce the invariants by construction. Apps import them and never touch `org_users` or `org_sessions` directly.

| Verb | Module | What it does |
|---|---|---|
| `signupOrganization` | `auth/signup.ts` | One atomic transaction: creates the organization, its first `owner` user, the system ledger accounts, and an open session, all in the `test` ring. Throws `AUTH_EMAIL_TAKEN` on a duplicate. |
| `loginOrgUser` | `auth/login.ts` | Verifies the password first, then the TOTP factor. Returns a discriminated union `{ status: 'ok', token } | { status: 'totp_required' }`. Wrong credentials throw `AUTH_INVALID_CREDENTIALS`, and password and TOTP collapse into the same error so neither factor leaks. |
| `createSession`, `validateSession`, `revokeSession` | `auth/session.ts` | Opaque-token sessions. The raw token is 32 bytes of entropy handed to the client once; the server stores only its SHA-256 hash. Default lifetime 30 days. Revocation is a row delete. `validateSession` returns the pinned `{ organizationId, userId, environment }`, never trusting org or environment from the client. |
| `generateTotpSecret`, `buildTotpUri`, `verifyTotp` | `auth/totp.ts` | RFC 6238 shared-secret second factor. Mints a base32 secret, builds the `otpauth://` provisioning URI (issuer `nombaone`), verifies a 6-digit code with a one-step skew window. |
| `enrollUserTotp` | `auth/users.ts` | Stores the TOTP secret encrypted at rest in `org_users.totp_secret_encrypted` and flips `totp_enabled`. |
| `hashPassword`, `verifyPassword` | `auth/password.ts` | bcrypt, cost 12, salt embedded in the hash. Plaintext never leaves the function. |
| `requestPasswordReset`, `resetPassword` | `auth/password-reset.ts` | Enumeration-safe reset. `requestPasswordReset` returns void-shaped output for unknown emails and a raw token only as the email-delivery seam for known ones. Token TTL 1 hour, single-use, hashed at rest. `resetPassword` sets the new password and consumes the token in one transaction. |
| `can(role, capability)` | `auth/rbac.ts` | The one authorization predicate. Maps a role to its capability set. Handlers ask `can(role, capability)` and never branch on the role name. |
| `createOrgUser`, `findUserByEmail`, `findUserById`, `updateUserPassword` | `auth/users.ts` | The `org_users` repository. The only place that knows the row shape. |
| `listMembers` | `org/members.ts` | Lists the team for one `organization_id`, ordered by creation so the founding owner reads first. Returns a plain array, not a page. |
| `getOrganization` | `org/org.ts` | Reads the organization row by id (the one read keyed by `organization_id` alone). |
| `ensureOrgNombaAccount` | `org/nomba-accounts.ts` | Idempotently maps the tenant to its Nomba parent or sub-account. |
| `getOrgBillingSettings`, `upsertOrgBillingSettings`, `serializeBillingSettings` | `org/billing-settings.ts` | Reads and writes the per-org, per-environment billing policy. |

The input shapes are already frozen too, in `@nombaone/core-contracts/validations/auth.ts`: `signupBody` (`organizationName`, `name`, `email`, `password` min 8), `loginBody` (`email`, `password`, optional 6-character `totpCode`), `requestPasswordResetBody` (`email`), and `resetPasswordBody` (`token`, `password` min 8). The same zod schema validates the server request and the console form through `zodResolver`, so the input contract cannot drift between the two.

### 1.2 What must be built (the console-auth HTTP surface)

This surface is distinct from the public `/v1` tenant API and from the operator admin surface. It authenticates humans by session cookie, not by API key. The routes below are the plan of record, marked **(proposed, unbuilt)** because no path exists in the code yet. Confirm each path against the router once it lands; do not treat these as confirmed until then.

| Method + path (proposed, unbuilt) | Backing verb | Purpose |
|---|---|---|
| `POST /console/auth/signup` | `signupOrganization` | Create the tenant and its owner, open a session, land in test. |
| `POST /console/auth/login` | `loginOrgUser` | Password step, then TOTP step when required. |
| `POST /console/auth/logout` | `revokeSession` | Delete the session row; immediate server-authoritative logout. |
| `GET /console/auth/session` | `validateSession` + `findUserById` | Resolve the cookie to `SessionContext` plus `OrgUserResponseData` for the shell. |
| `POST /console/auth/password/forgot` | `requestPasswordReset` | Enumeration-safe request; emails the reset link. |
| `POST /console/auth/password/reset` | `resetPassword` | Consume the token and set the new password. |
| `POST /console/auth/totp/enroll` | `generateTotpSecret` + `buildTotpUri` | Mint a secret and return the provisioning URI for the QR. |
| `POST /console/auth/totp/activate` | `verifyTotp` + `enrollUserTotp` | Verify the first code and turn the second factor on. |
| `POST /console/session/environment` | session update | Flip `org_sessions.environment` between test and live. |
| `GET /console/team/members` | `listMembers` | The team roster. |
| `POST /console/team/invites` | invite seam (no table yet) | Invite a teammate by email and role. |
| `PATCH /console/team/members/{reference}` | role update seam | Change a member's role. |
| `DELETE /console/team/members/{reference}` | remove seam | Remove a member, guarded by the last-owner rule. |
| `POST /console/nomba/connect` | `ensureOrgNombaAccount` | Connect the tenant's Nomba account. |

Three things this surface must enforce, none of which the verbs enforce alone because they are documented seams:

1. **The invite flow has no table yet.** There is no `invitations` schema file. `createOrgUser` exists, but the pending-invite lifecycle (invite issued, email sent, invite accepted, password set) is unbuilt. Section 6 specifies it.
2. **The last-owner guard is a seam.** `listMembers` is read-only by design so the "you cannot remove or demote the last owner" rule lives next to the write that enforces it. The remove and change-role routes must raise `MEMBER_LAST_OWNER`. Section 5 specifies it.
3. **Every route must gate on `can(role, capability)`** before it mutates, and return `AUTH_FORBIDDEN_ROLE` when the check fails. The UI mirrors the same matrix so a forbidden action never renders as a live button.

### 1.3 The two-phase method for this doc's surface

Phase A designs low-fi frames in Pencil for each screen below, from the wireframes here. Phase B builds the console-auth HTTP surface over the existing verbs, wires the RBAC gating on both the server and the UI, and builds the invite and last-owner seams. Each phase has its own done criteria, listed in section 11. Once frames exist in the `.pen` source, they are the hard 1:1 gate for the build.

---

## 2. Three identities, kept apart

The console lives beside two other identity systems. Conflating them is a security bug. The plan keeps them visibly separate.

| Identity | Who it is | Backed by | Where it lives |
|---|---|---|---|
| **Console session** | A human on the team | `org_users` + `org_sessions`, opaque token in an httpOnly cookie | The console (this doc) |
| **Public API key** | A machine calling `/v1` | `api_keys`, `nbo_test_` / `nbo_live_`, SHA-256 hash only | The tenant's own servers; managed from the Developers area (doc 04) |
| **Operator** | A Nomba One staff operator | `operators` with `token_version` revocation | The admin app, never the console |

Rules the console enforces:

- A console session authenticates a **person**; an API key authenticates a **program**. The console never accepts an API key as a login, and the public API never accepts a session cookie. A person minting a key inside the console is a person creating a credential for a machine, not switching identities.
- There is **no god tenant key**. The console reaches tenant data through the session's pinned scope, not through a master key. Cross-tenant access is an operator concern and lives in the admin app.
- One console user belongs to exactly **one organization**. The `org_users.email` unique index is platform-wide and is the authority on whether an email is taken, so there is no org switcher in the shell (doc 01). A person who needs two orgs holds two accounts with two emails.

---

## 3. Login, session, and password reset

### 3.1 Login (two steps, second factor is a result not an error)

**Purpose.** Turn an email and password, plus a TOTP code when the account has one, into an open session.

**Data shown.** The email field, the password field, and, on the second step only, the 6-digit code field. Nothing about the account is revealed before authentication.

**Actions.** `POST /console/auth/login` (proposed, unbuilt) with `loginBody` (`email`, `password`, optional `totpCode`). The response is the `loginOrgUser` union:
- `{ status: 'totp_required' }` renders the code step. The email and password are correct, and the second factor is outstanding. Only a password-valid attempt is ever told this, so the prompt itself does not leak that the pair is correct to a stranger.
- `{ status: 'ok', token }` sets the session cookie and routes into the shell, in the `test` ring.

**FSM-aware gating.** The form is a two-state machine: `credentials` then `totp`. The code field appears only after a `totp_required` response, never speculatively. The submit button spins on request and disables on the pending state (the one motion the design system already ships).

**Empty state.** First render is the empty form with a link to sign up and a "Forgot password?" link.

**Loading state.** The submit button shows the inline spinner; fields lock.

**Error states.** All render through the doc 08 contract (`error.hint` verbatim, `docUrl` deep-link, `error.fields` inline):
- `AUTH_INVALID_CREDENTIALS` for a wrong email, a wrong password, or a wrong TOTP code. The message is deliberately identical across all three so the form gives no per-factor oracle. Render it under the form, not against a single field.
- `AUTH_TOTP_REQUIRED` and `AUTH_TOTP_INVALID` on the second step.
- Rate-limit responses render the retry guidance from doc 08.

```
┌───────────────────────── Sign in ─────────────────────────┐
│                                                            │
│   Nomba One                                                │
│   Sign in to your console.                                 │
│                                                            │
│   Email                                                    │
│   ┌──────────────────────────────────────────────────┐    │
│   │ you@company.com                                   │    │
│   └──────────────────────────────────────────────────┘    │
│   Password                                                 │
│   ┌──────────────────────────────────────────────────┐    │
│   │ ••••••••••••                                      │    │
│   └──────────────────────────────────────────────────┘    │
│                                          Forgot password?  │
│   [            Sign in            ]                         │
│                                                            │
│   New here?  Create an organization                        │
└────────────────────────────────────────────────────────────┘

  Step two, only after {status:'totp_required'}:
┌──────────────────── Two-factor code ──────────────────────┐
│   Enter the 6-digit code from your authenticator app.      │
│   ┌────┬────┬────┬────┬────┬────┐                          │
│   │  _ │  _ │  _ │  _ │  _ │  _ │                          │
│   └────┴────┴────┴────┴────┴────┘                          │
│   [            Verify            ]     Back to sign in      │
└────────────────────────────────────────────────────────────┘
```

### 3.2 The session model

**Opaque token, not a JWT.** `createSession` mints 32 bytes of entropy, stores only the SHA-256 hash in `org_sessions.token_hash`, and returns the raw token once. The console sets it as an httpOnly cookie. There is no signing key to rotate; revocation is a `revokeSession` row delete, so logout is immediate and server-authoritative.

**Pinned scope.** Every request resolves the cookie through `validateSession`, which returns `{ organizationId, userId, environment }` straight from the row and never reads org or environment from the client. The `environment` on the session row is the console's active ring, threaded into every `DomainContext`. The expiry is enforced in SQL (`expires_at > now()`), so a stale row never validates even before a sweep removes it.

**Lifetime.** 30 days by default. The shell reads `GET /console/auth/session` (proposed, unbuilt) on load to hydrate `SessionContext` plus `OrgUserResponseData` (`id`, `email`, `name`, `role`, `createdAt`). An invalid or expired cookie returns `AUTH_SESSION_INVALID`; the console clears the cookie and routes to sign in.

### 3.3 Password reset (enumeration-safe, two screens)

**Request screen.** `POST /console/auth/password/forgot` (proposed, unbuilt) with `requestPasswordResetBody`. The response is always the same success acknowledgement whether or not the email exists, because `requestPasswordReset` is a no-op for unknown emails and mints a token only for real accounts. The screen says "If that email is registered, a reset link is on its way," with no signal about existence.

**Reset screen.** Reached from the emailed link, which carries the raw token. `POST /console/auth/password/reset` (proposed, unbuilt) with `resetPasswordBody` (`token`, new `password` min 8). `resetPassword` validates that the token is unconsumed and unexpired (1-hour TTL), sets the password, and consumes the token in one transaction, so a replayed link is inert.

**Error states.** `AUTH_RESET_TOKEN_INVALID` covers invalid, expired, and already-used tokens with one message that reveals which condition failed to no one. Render it above the form with a link back to the request screen.

```
┌─────────────── Reset your password ───────────────┐      ┌──────────── Set a new password ────────────┐
│ Enter your email and we will send a reset link.    │      │ Choose a new password. At least 8 chars.   │
│ ┌────────────────────────────────────────────┐     │      │ New password                                │
│ │ you@company.com                             │     │      │ ┌──────────────────────────────────────┐  │
│ └────────────────────────────────────────────┘     │      │ │ ••••••••••••                          │  │
│ [        Send reset link        ]                   │      │ └──────────────────────────────────────┘  │
│                                                     │      │ Confirm password                            │
│ If that email is registered, a link is on its way.  │      │ ┌──────────────────────────────────────┐  │
│                              Back to sign in        │      │ │ ••••••••••••                          │  │
└─────────────────────────────────────────────────────┘      │ └──────────────────────────────────────┘  │
                                                              │ [        Set password        ]             │
                                                              │ Link invalid or expired? Request a new one │
                                                              └────────────────────────────────────────────┘
```

---

## 4. Two-factor enrollment and enforcement

### 4.1 Enroll (turn the second factor on)

**Purpose.** Bind an authenticator app to the account so future logins require a rolling code.

**Data shown.** A QR image rendered from the `otpauth://` URI that `buildTotpUri` returns (issuer `nombaone`, label the user's email), the same secret in text for manual entry, and a single verify field. The secret is PII: it is generated by `generateTotpSecret`, shown once during enrollment, and never re-displayed after activation.

**Actions.**
- `POST /console/auth/totp/enroll` (proposed, unbuilt) returns the provisioning URI and the secret for display. Nothing is persisted yet.
- `POST /console/auth/totp/activate` (proposed, unbuilt) sends the first 6-digit code. On a pass, `enrollUserTotp` stores the secret encrypted at rest and flips `totp_enabled`. A code that fails to verify returns `AUTH_TOTP_INVALID`, and the flag stays off.

**FSM-aware gating.** Enrollment is a three-state flow: `show-qr`, `verify-code`, `enabled`. The account is not protected until the verify step passes, so the UI never claims two-factor is on before activation commits. This closes the gap the `loginOrgUser` code guards against, where a flag is set without a stored secret; the console never lets that state exist.

**Empty and success states.** Before enrollment, the security panel shows "Two-factor authentication is off" with an "Enable" action. After activation, it shows "On since {date}" with a "Disable" action (disable is a documented seam that requires a password re-prompt; mark it unbuilt).

**Error states.** `AUTH_TOTP_INVALID` under the code field. `AUTH_TOTP_NOT_ENROLLED` if an enforcement path is reached for an account that never activated.

```
┌───────────────── Enable two-factor ─────────────────┐
│ 1  Scan this with your authenticator app.            │
│    ┌───────────────┐                                 │
│    │  ▓▓  ▓  ▓▓▓▓   │   Can't scan?                   │
│    │  ▓ ▓▓▓ ▓  ▓    │   Enter this key:               │
│    │  ▓▓  ▓  ▓ ▓▓   │   JBSW Y3DP EHPK 3PXP          │
│    └───────────────┘                                 │
│ 2  Enter the 6-digit code to confirm.                │
│    ┌────┬────┬────┬────┬────┬────┐                   │
│    │  _ │  _ │  _ │  _ │  _ │  _ │                   │
│    └────┴────┴────┴────┴────┴────┘                   │
│    [        Turn on two-factor        ]              │
└──────────────────────────────────────────────────────┘
```

### 4.2 Enforce (org-level policy)

An org can require two-factor for every member. The policy toggle lives in Settings (a proposed column, mark **(verify)** until it lands; it is not in `org_users` today). When on, a member without an activated second factor is routed to the enrollment flow before reaching any other screen, and the login second step becomes mandatory rather than conditional. The enforcement itself is already latent in `loginOrgUser`: any account with `totp_enabled` must present a code, and the policy only decides which accounts must enable it.

---

## 5. Roles and what each one can do

Roles come from `org_users.role`, an enum of `owner`, `admin`, `developer`, `viewer`, defaulting to `owner` for the founding user. Authorization is the static capability matrix in `auth/rbac.ts`. Handlers ask `can(role, capability)` and never branch on the role name, so the console mirrors the exact same matrix to decide which controls render.

| Capability | owner | admin | developer | viewer |
|---|---|---|---|---|
| `org:read` | yes | yes | yes | yes |
| `members:read` | yes | yes | yes | yes |
| `members:manage` (invite, change role, remove) | yes | yes | no | no |
| `apiKeys:read` | yes | yes | yes | yes |
| `apiKeys:manage` (mint, scope, revoke keys) | yes | yes | yes | **no** |
| `webhooks:read` | yes | yes | yes | yes |
| `webhooks:manage` | yes | yes | yes | no |
| `ledger:read` | yes | yes | yes | yes |
| everything else (billing settings writes, org deletion, danger-zone) | yes (`*`) | no | no | no |

Read this table exactly as the code reads it. `owner` holds the wildcard `*` and passes every check by construction. The one line worth stating out loud, because the mandate calls for it: **a viewer cannot mint keys.** A viewer holds `apiKeys:read` but not `apiKeys:manage`, so the "Create key" action in the Developers area is absent for a viewer, not merely disabled, and the server returns `AUTH_FORBIDDEN_ROLE` if a request reaches it anyway. Two enforcement layers, one matrix.

**What each role sees, from the user's side of the screen:**
- **Owner.** Everything, including billing policy, the Nomba connection, danger-zone actions, and org deletion.
- **Admin.** Runs the org day to day: manages members, keys, and webhooks. Cannot delete the org or write billing policy.
- **Developer.** Builds against the platform: mints and scopes keys, manages webhooks, reads members and the ledger. Cannot manage members.
- **Viewer.** Read-only. Sees the org, members, keys (metadata, never secrets), webhooks, and the ledger, and changes nothing.

**Server gating.** Every mutating console-auth and console route runs `can(role, capability)` first and returns `AUTH_FORBIDDEN_ROLE` on a miss. **UI gating.** The console hides actions the role lacks rather than showing dead buttons, and any action that slips through renders the `AUTH_FORBIDDEN_ROLE` hint from doc 08.

**The last-owner guard.** Removing or demoting the final `owner` must fail with `MEMBER_LAST_OWNER`. This is a documented seam that belongs to the remove and change-role writes, not to `listMembers`, which stays read-only. The console disables the "remove" and "change role" controls for the sole remaining owner and, if the write is attempted concurrently, surfaces `MEMBER_LAST_OWNER` plainly.

---

## 6. Team and member invites

### 6.1 Team roster

**Purpose.** Show who is on the tenant and let an owner or admin manage them.

**Data shown.** `listMembers` returns the full team as a plain array, ordered by creation so the founding owner reads first, rendered as `OrgUserResponseData` rows: `name`, `email`, `role`, `createdAt`. The roster is a bounded set (a team, not a firehose), so it is not cursor-paginated; it renders as a simple list, unlike the data tables elsewhere in the console.

**Actions (gated on `members:manage`, so owner and admin only).**
- Invite a teammate: `POST /console/team/invites` (proposed, unbuilt).
- Change a member's role: `PATCH /console/team/members/{reference}` (proposed, unbuilt).
- Remove a member: `DELETE /console/team/members/{reference}` (proposed, unbuilt), guarded by `MEMBER_LAST_OWNER`.

**FSM-aware gating.** A member's row shows role and status. When invites land, a pending invitee shows an `invited` state (see 6.2) distinct from an active member. The sole owner's "remove" and "demote" controls are disabled with a tooltip naming the last-owner rule.

**Empty state.** A single-member org (the founder alone) shows an "Invite your team" invitation, not an empty table.

**Error states.** `MEMBER_NOT_FOUND` for a stale reference, `MEMBER_LAST_OWNER` for the guarded write, `AUTH_EMAIL_TAKEN` when an invited email already holds an account (one email, one org), and `AUTH_FORBIDDEN_ROLE` for a developer or viewer who reaches a manage route.

```
┌──────────────────────────── Team ────────────────────────────┐
│ People with access to this organization.      [ Invite ▸ ]    │
│                                                               │
│ NAME              EMAIL                 ROLE       ADDED       │
│ ─────────────────────────────────────────────────────────────│
│ Amara Eze         amara@co.com          owner      Jun 2      │
│ Tunde Bello       tunde@co.com          admin      Jun 9      │
│ Ada Nwosu         ada@co.com            developer  Jun 14     │
│ Kola Aiku         kola@co.com           viewer     invited    │
│                                            ⋯ change role       │
│                                            ⋯ remove            │
│ Owner controls are disabled for the last owner.               │
└───────────────────────────────────────────────────────────────┘
```

### 6.2 Invites (a seam to build, no table yet)

There is no `invitations` schema file today, so the pending-invite lifecycle is unbuilt and the plan specifies it rather than pretending it exists. Build it as its own table and flow.

**The flow to build.**
1. An owner or admin submits an email and a role. The route validates the email is not already an account (`AUTH_EMAIL_TAKEN`) and writes a pending invite row (proposed `invitations` table: `organization_id`, `email`, `role`, hashed token, `expires_at`, `accepted_at`, mirroring the `password_reset_tokens` pattern of a hashed, expiring, single-use token).
2. The console emails an accept link carrying the raw token (the same email-delivery seam the reset flow uses).
3. The invitee opens the link, sets a name and password, and the accept route calls `createOrgUser` with the invited role, consuming the invite in the same transaction.
4. The new member lands in the org's `test` ring with the role the inviter chose.

**Invite modal wireframe.**

```
┌───────────── Invite a teammate ─────────────┐
│ Email                                        │
│ ┌────────────────────────────────────────┐  │
│ │ name@company.com                        │  │
│ └────────────────────────────────────────┘  │
│ Role                                         │
│ (•) Admin     Manage members, keys, webhooks │
│ ( ) Developer Keys and webhooks, no members  │
│ ( ) Viewer    Read-only                      │
│                                              │
│ They will get an email to set a password.    │
│ [ Cancel ]                 [ Send invite ]   │
└──────────────────────────────────────────────┘
```

Until this seam is built, the console shows the Invite action but renders an honest "Invites are coming soon; add a teammate by sharing signup" interim state rather than a broken form. Do not ship a button that throws.

---

## 7. Test and live: the environment model

The console runs in exactly one ring at a time, and the ring is a property of the session, not a client toggle the server trusts.

### 7.1 The environment switch

`org_sessions.environment` is the active ring, an enum of `test` and `live` defaulting to `test`. A new tenant always starts in `test`; live access is a deliberate later gate, never the day-zero default. The shell's test/live switch (doc 01) flips it through `POST /console/session/environment` (proposed, unbuilt), which updates the session row. `validateSession` then threads the new ring into every `DomainContext`, so a switch re-scopes the entire console at once. The console never sends the environment as a query parameter the server reads; it is read from the pinned session row.

```
┌ Nomba One ─────────────────────────────────────────────────┐
│  [ Overview ]                          ◉ Test  ○ Live   ⌄   │
│   ▲ the shell switch flips org_sessions.environment;         │
│     the whole console re-scopes to the chosen ring.          │
└─────────────────────────────────────────────────────────────┘

  Live still locked (proposed gate):
┌──────────── Switch to live ────────────┐
│ Live is locked until you:              │
│  ✓ Connect your Nomba account          │
│  ▢ Confirm business details            │
│  ▢ Enable two-factor for owners        │
│ [ Continue setup ]        [ Not yet ]  │
└─────────────────────────────────────────┘
```

### 7.2 Separate key sets per environment

Keys are per environment by construction. `api_keys` carries the ring twice: baked into the key string (`nbo_test_…` / `nbo_live_…`) and denormalized in the `environment` column, indexed with `organization_id`. The console shows the key set for the **active ring only**, so a person in the test ring sees test keys and never live secrets, and the reverse. A live key presented to a test deployment (or the reverse) authenticates to nothing and returns `API_KEY_ENVIRONMENT_MISMATCH`. Key minting lives in the Developers area (doc 04) and is gated on `apiKeys:manage`, so a viewer sees the list but no "Create key" action. Secrets are shown once at mint via the copy-once field (doc 04, doc 08); after that the console shows only `keyPrefix`, `scopes`, `lastUsedAt`, and `revokedAt`.

### 7.3 The isolation invariant

This is the load-bearing rule of multi-tenancy, and it is a schema property, not a UI check. **Every domain row carries `organization_id` and `environment`.** The console cannot show another tenant's data because the session's pinned scope filters every read, and it cannot bleed test data into live because the ring is on every row and on the session. The console's job is to never undermine the invariant: it always reads through the pinned `SessionContext`, never accepts an org or environment from the client, and treats a cross-scope result as a bug to surface, not a state to render. Test and live are the same organization living in two rings; a person moves between them by switching the session, and their keys, customers, subscriptions, invoices, settlements, and events are wholly separate on each side.

---

## 8. Connecting the Nomba account

Settlement and payout move real money, and they need a live sub-account. The console owns the connection surface.

**Data shown.** `org_nomba_accounts` rows, one per `(organization, environment, kind)`, where `kind` is `parent` or `subaccount`. Each row carries `nombaAccountId`, `accountRef`, an optional `subAccountId`, and a `status` of `pending`, `active`, or `suspended`. The connection screen shows the current status prominently, because it gates the money screens.

**Actions.** `POST /console/nomba/connect` (proposed, unbuilt) calls `ensureOrgNombaAccount`, which is idempotent on `(organization, environment, kind)`, so a repeated connect is safe. Owner only.

**FSM-aware gating.** The status drives the money surfaces:
- `pending`: the account is mapped but not yet settling. Settlements and payouts (doc 03) show a "Your Nomba account is being set up" state and disable withdrawal. A subscription can still bill in test.
- `active`: settlement and payout are available. Only an `active` sub-account can settle, per the schema note on the row.
- `suspended`: settlement and payout are blocked with a direction-giving message on how to restore the account, not a mood.

**Money note.** The escrow and payout amounts this screen leads into are integer kobo (`*InKobo`). The console renders naira by dividing by 100 for display, never with floats, and never sends an amount to a charge or payout endpoint without pinning the unit, because a known naira-versus-kobo risk makes an unpinned amount 100 times too large. Section 9 and doc 03 carry the same rule wherever money is shown or entered.

**Empty state.** Before any connection, the screen shows "Connect your Nomba account to settle and pay out" with a single connect action, and a note that billing works in test without it.

**Error states.** `ORG_NOT_FOUND` for a stale org context. A proposed `NOMBA_ACCOUNT_NOT_ACTIVE` guard (mark **(verify)** until confirmed in `packages/errors`) on any payout attempt against a non-`active` account, rendered through doc 08.

```
┌──────────────── Nomba account ────────────────┐
│ Status   ● Pending                             │
│ We are setting up your settlement account.     │
│ Account ref   nma_… (parent)                   │
│ Sub-account   not yet provisioned              │
│                                                │
│ Settlement and payout turn on when this reads  │
│ Active. Billing works in test meanwhile.       │
│ [ Refresh status ]        [ Connect account ]  │
└────────────────────────────────────────────────┘
```

---

## 9. Zero to first subscription: the onboarding quickstart

This is the rubric-L star item, still unchecked in the backend, and the console owns it. The goal is one thing: a founder or a merchant reaches a first working subscription in the test ring fast, watches it bill, and sees the success land. The path is guided, honest, and real; the skeptic can open devtools and see every call hit `/v1` (Tenet 4).

### 9.1 The path

Signup drops the new owner into the test ring with a persistent quickstart checklist on the Overview. Each step is a real API call, gated on the previous, with its own state. The two personas take two tracks through the same steps: the developer copies curl or SDK snippets from each step, and the merchant uses the no-code wizard. Both end at the same first success.

| Step | User does | Real call | Gated on |
|---|---|---|---|
| 1 | Sign up | `POST /console/auth/signup` (proposed) → `signupOrganization` | none |
| 2 | Add a customer | `POST /v1/customers` | signed in |
| 3 | Create a plan | `POST /v1/plans` | step 2 |
| 4 | Set a price | `POST /v1/plans/{id}/prices` | step 3 |
| 5 | Add a test payment method | `POST /v1/test/payment-methods` (test ring only) | step 2 |
| 6 | Start a subscription | `POST /v1/subscriptions` | steps 4 and 5 |
| 7 | Watch it bill | `POST /v1/test/subscriptions/{id}/advance-cycle` (the test clock) | step 6 |

Steps 2 through 7 are the existing public `/v1` surface, driven from the console with the tenant's own test key. The test payment methods and the advance-cycle clock are mounted only when `INFRA_ENVIRONMENT=test`, so this whole flow is honestly a test-ring capability and the console hides it on live.

### 9.2 Each step, with data, gating, and states

**Signup.** `signupBody` (`organizationName`, `name`, `email`, `password` min 8). One atomic transaction creates the org, the owner, the system ledger accounts, and an open session in `test`. Error: `AUTH_EMAIL_TAKEN`, rendered inline against the email field from `error.fields`.

**Add a customer.** `POST /v1/customers`. Show `email`, `name`, `phone`, `metadata`. Error: a duplicate `(org, env, email)` returns the customer-taken conflict, inline on the email field.

**Create a plan and set a price.** `POST /v1/plans` then `POST /v1/plans/{id}/prices`. The price is where money is entered, so this step carries the money rule in full: the merchant types naira into a ₦ field, and the console stores integer kobo in `unitAmountInKobo`. The console divides by 100 only for display, never with floats, and pins the unit before the value reaches any charge endpoint, because an unpinned amount is a 100-times overcharge waiting to happen. The step shows a live "₦2,500.00 will be stored as 250000 kobo" confirmation so the conversion is visible, not hidden. Prices are immutable; the console models a price change as a new price plus a deactivation of the old one, never an edit, and says so.

**Add a test payment method.** `POST /v1/test/payment-methods` mints a deterministic method whose behavior the developer chooses: `success`, `decline_insufficient_funds`, `decline_expired_card`, `decline_do_not_honor`, or `requires_otp`. The default for onboarding is `success` so the first run recovers, and the "break it" methods sit one click away so a person can watch a failure and a recovery on real events, the console analog of the website simulator.

**Start a subscription.** `POST /v1/subscriptions`. The subscription enters its FSM. Depending on the price's trial and the collection method, the first status is `incomplete`, `trialing`, or `active`. The console shows the real status pill and does not claim "active" before the engine does.

**Watch it bill.** `POST /v1/test/subscriptions/{id}/advance-cycle` drives the test clock. It is idempotent per period and only advances an `active` or `trialing` subscription, so the button is present only in those states and a double click bills exactly one period. Each advance produces one invoice and the matching events, streamed into the step's live event panel.

**First success.** When the first invoice pays, the checklist completes and the success lands in emerald with the live dot, the one earned peak the motion system reserves (doc 07). The step reads "Your first subscription billed and paid, in test." with a next action to invite the team, connect Nomba, or go live.

### 9.3 Wireframes

```
┌──────────────── Create your organization ────────────────┐
│ Organization name                                          │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ Acme Gyms                                             │  │
│ └──────────────────────────────────────────────────────┘  │
│ Your name                          Work email              │
│ ┌────────────────────────┐  ┌────────────────────────────┐ │
│ │ Amara Eze              │  │ amara@acme.com             │ │
│ └────────────────────────┘  └────────────────────────────┘ │
│ Password (at least 8 characters)                           │
│ ┌──────────────────────────────────────────────────────┐  │
│ │ ••••••••••••                                          │  │
│ └──────────────────────────────────────────────────────┘  │
│ [                Create and start in test                ] │
│ You start in the test ring. No real money moves.           │
└────────────────────────────────────────────────────────────┘

┌───────────────── Get to your first subscription ─────────────────┐
│ Test ring. Nothing here charges a real card.                       │
│                                                                    │
│  ✓  1  Create your organization                                    │
│  ✓  2  Add a customer                            [ curl | SDK ]     │
│  ●  3  Create a plan                             [ Open form ]      │
│  ▢  4  Set a price          ₦ 2,500.00  →  stored as 250000 kobo   │
│  ▢  5  Add a test payment method   ( success ▾ )                   │
│  ▢  6  Start the subscription                                      │
│  ▢  7  Advance a cycle and watch it bill                           │
│                                                                    │
│  ┌── events, live ─────────────────────────────────────────────┐  │
│  │ subscription.created                                         │  │
│  │ invoice.created  →  invoice.finalized                        │  │
│  │ invoice.paid     ● recovered                                 │  │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘

┌──────────── No-code: start a subscription ────────────┐
│ Customer   ( Ada Nwosu  ▾ )        [ + New customer ]  │
│ Plan       ( Monthly gym  ▾ )      ₦2,500.00 / month   │
│ Rail       (•) Test card (success)                     │
│            ( ) Test card (insufficient funds)          │
│ Start      (•) Now    ( ) After a trial                │
│ [ Cancel ]                       [ Start subscription ]│
│ We handle the payment method and collection for you.   │
└────────────────────────────────────────────────────────┘

┌────────────── First success ──────────────┐
│      ● Recovered                            │
│  Your first subscription billed and paid,   │
│  in test.                                   │
│  Invoice INV_… · ₦2,500.00 · paid           │
│  Next:                                      │
│   [ Invite your team ]                      │
│   [ Connect Nomba to settle ]               │
│   [ Read the go-live checklist ]            │
└─────────────────────────────────────────────┘
```

### 9.4 Empty, loading, and error states across onboarding

- **Empty.** Before step 2, the Overview shows the checklist itself as the empty state, an invitation to act, never fake sample data.
- **Loading.** Each step's action spins its own button; the event panel shows a "waiting for the first event" line rather than a blank box.
- **Error.** Every failure renders through the doc 08 contract: the `code`, the `hint` verbatim, the `docUrl` deep-link, and `error.fields` inline. A declined test method is a demonstration, not a dead end; the panel shows the real `failureReason` and the recovery path, honoring that a failed charge is often "not yet," not "no."

---

## 10. Auth and onboarding error catalog

Every auth failure resolves to a real, public code with a `hint` and a `docUrl`, rendered by the doc 08 contract. This is the errors-are-a-feature bar applied to the sign-in surface, where a person is most stuck.

| Code | Where it fires | How the console renders it |
|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | Wrong email, password, or TOTP code | One message under the form, no per-factor detail |
| `AUTH_TOTP_REQUIRED` | Password valid, code absent | Advance to the code step |
| `AUTH_TOTP_INVALID` | Wrong or malformed code | Inline under the code field |
| `AUTH_TOTP_NOT_ENROLLED` | Enforcement path, account never activated | Route to enrollment |
| `AUTH_SESSION_INVALID` | Expired or unknown cookie | Clear cookie, route to sign in |
| `AUTH_RESET_TOKEN_INVALID` | Invalid, expired, or used reset link | Above the reset form, link to request a new one |
| `AUTH_EMAIL_TAKEN` | Signup or invite with an existing email | Inline on the email field |
| `AUTH_PASSWORD_INCORRECT` | Password-change re-prompt (seam) | Inline on the current-password field |
| `AUTH_FORBIDDEN_ROLE` | A role lacks the capability | The action is hidden; if reached, render the hint |
| `MEMBER_NOT_FOUND` | Stale member reference | Toast, refresh the roster |
| `MEMBER_LAST_OWNER` | Removing or demoting the sole owner | Disable the control; if raced, surface the message |
| `API_KEY_ENVIRONMENT_MISMATCH` | A live key on test or the reverse | In the Developers area, name the ring mismatch |
| `API_KEY_SCOPE_FORBIDDEN` | A key lacks a scope | Name the missing scope |
| `ORG_NOT_FOUND` | Stale org context | Route to sign in |

**Honest interim states the console must render, not hide:**
- The console-auth API is unbuilt, so during development the login and team surfaces show a clear "console sign-in is not yet live" state rather than a broken form.
- The invite flow has no table yet, so the Invite action shows an honest interim state (section 6.2).
- The Nomba connection sits at `pending` until the account is provisioned, and settlement and payout stay honestly disabled until it reads `active` (section 8).

---

## 11. Phase A and Phase B done criteria

**Phase A (Pencil, low-fi frames).** Done when the `.pen` source holds frames for every screen in this doc: login (both steps), forgot password, reset password, two-factor enrollment, the team roster, the invite modal, the environment switch and the live-lock gate, the Nomba connection, signup, the onboarding checklist, the no-code start-subscription wizard, and the first-success state. Each frame uses only Tier-2 semantic tokens, reserves emerald for the primary action and the first-success peak, and reads in the platform voice. Frames are the 1:1 gate for Phase B.

**Phase B (build to spec).** Done when the console-auth HTTP surface exists over the `sara/auth` verbs, every route gates on `can(role, capability)` and returns the real error codes, the invite table and last-owner seams are built and tested, the environment switch flips `org_sessions.environment` and re-scopes the console, key sets render per ring, the Nomba connection gates the money screens on `active`, and the onboarding path reaches a first billed-and-paid subscription in test with the success landing in emerald. Money is integer kobo end to end, rendered as naira by dividing by 100, with the unit pinned before any charge, and the naira-versus-kobo risk guarded at every amount input.

---

## 12. What done looks like, for the plan set

This closes the console plan set, docs 00 through 09. The set is done when the console meets the MANIFESTO's five tests, on real data, in the platform's one voice and one visual system:

- A developer integrates without ever talking to us, because the Developers area, the embedded curl and SDK snippets, the webhook deliveries inspector, and the test instruments answer every question in the console itself.
- A merchant runs a subscription without an engineer, because the no-code wizard, the plan and price forms with naira inputs, the send-a-pay-link action, and the withdraw-to-bank flow carry them from signup to a paid subscription and a payout.
- A skeptic opens devtools and sees the sandbox is real, because the onboarding path, the test clock, and the live event tail are real `/v1` calls they can inspect.
- Something breaks and the error tells them exactly what to do, because every failure across every screen renders a real code, its hint, its doc link, and its offending fields, and a declined charge shows a reason and a recovery path.
- A year from now the money is still never wrong, because the console reads ledger-derived balances, renders integer kobo as naira without floats, pins the money unit before any charge, shows voluntary `subscription.canceled` and involuntary `subscription.churned` as the distinct outcomes they are, and never claims a state the engine has not reached.

Auth, team, environments, and onboarding are the ground floor of all of it. The console-auth API is dependency number one; build it over the verbs that already exist, keep the three identities apart, keep the isolation invariant sacred, and let a founder or a merchant reach a first success in test fast. Build to that bar.
