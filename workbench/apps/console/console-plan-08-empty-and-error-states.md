# Nomba One · Console Plan · 08 · Empty and error states

> **What this is.** The errors-are-a-feature catalog for the console. It specifies the empty state, loading state, and error state for every area, the public error-rendering contract the console binds to (the envelope shape, `hint`, `docUrl`, `requestId`, and inline `fields`), idempotency and concurrency handling, and the honest interim states the console renders for live-gated and unbuilt money movement. This is the doc that decides whether the console passes MANIFESTO Tenet 9 ("errors are a feature") and the test "something breaks, and the error tells them exactly what to do."
>
> **Depends on:** doc 00 (north star, voice, the console-auth dependency), doc 01 (IA, the test/live switch, cursor pagination), doc 06 (the net-new components this doc renders into: empty-state, skeleton, status badge, detail drawer, toast), doc 07 (motion: the recovery peak, toast entrance, reduced-motion fallbacks).
>
> **Grounding read before building:** `packages/errors/src/codes.ts` (the code catalog, `PUBLIC_ERROR_CODES`, `ERROR_CODE_META`), `packages/errors/src/app-error.ts`, `packages/core-contracts/src/types/envelope.ts` (the wire shape), `apps/api/src/shared/http/error-handler.ts` (how internal codes collapse), `apps/api/src/shared/middlewares/idempotency.ts`, `apps/api/src/shared/middlewares/platform-gate.ts`, `apps/api/src/shared/middlewares/rate-limit.ts`, `packages/core-contracts/src/types/{settlement,dunning,metrics}.ts`.

A note on the hint strings shown below. The console renders `error.hint` byte-for-byte as the API returns it from `ERROR_CODE_META`. Where this document reproduces a hint in prose, it may re-punctuate lightly for the page's dash-free house style. The source of truth is `packages/errors/src/codes.ts`, and the console never rewrites a hint.

---

## 1. Principles: an empty state invites, an error directs

Three rules govern this whole document.

1. **An empty state is an invitation to act, never a dead end.** Every empty region names what is missing, says why in one line, and offers the one action that fills it. A no-subscriptions-in-recovery empty state is a *good* state and reads as reassurance, not absence.
2. **An error gives direction, not mood.** The console never renders "something went wrong." Every failure shows what failed, the API's `hint` verbatim, a deep link to the code's reference, the `requestId` to quote, and the one action that resolves it. No apology copy, no shrug, no spinner that never resolves.
3. **The money is rendered as its true state, never as more than we know.** Integer kobo is the wire truth. The console divides by 100 for display and never claims a payout reached a bank when only the ledger is posted. Interim states (`pending`, `ledger_only`, `ledger_posted`, `consent_pending`) render as themselves.

### 1.1 Every region has three states, plus two derived ones

Each screen and each region within it declares five renderings. Doc 06 supplies the components; this doc supplies the copy and the trigger.

| State | When | Component | Rule |
|---|---|---|---|
| **Loading** | Request in flight, no cached data | Skeleton (never a bare spinner for tables or detail) | Shape-matched to the content that will replace it (§8) |
| **Empty** | Request succeeded, zero rows | Empty-state card | Invitation plus primary action |
| **Error** | Request failed | Section error, form banner, inline field, or toast (§2.3) | `hint` verbatim, `docUrl` link, `requestId`, retry |
| **Populated** | Request succeeded, rows present | The screen proper | Out of scope for this doc |
| **Partial** | Some regions loaded, some failed | Per-region independent states | One region's 500 never blanks the page |

### 1.2 The taxonomy of empty states

Not every empty region is the same empty. The console distinguishes five, because each earns a different invitation.

- **First-run empty** (no data has ever existed here): the strongest invitation, tied to onboarding. "Create your first subscription."
- **Filtered empty** (data exists, the current filter excludes all of it): never an onboarding CTA. "No subscriptions match `status=past_due`." plus a clear-filter action.
- **Good empty** (empty is the healthy outcome): reassurance, no urgency. "No subscriptions are in recovery." This is the dunning cockpit at rest.
- **Environment empty** (data exists in the other ring): the test/live switch is the fix. "No live customers yet. You have 12 in test." plus a switch-to-test action.
- **Permission empty** (the data exists but the member's role hides it): honest about access, routes to the owner. "Your viewer role does not show API keys."

### 1.3 Money guardrail (restated wherever an amount appears)

Money is integer kobo on the wire; every amount field ends in `InKobo`. The console renders naira by integer division by 100 and never uses floats. No amount reaches a charge or payout call without the unit pinned to kobo. There is a known 100x naira-versus-kobo risk on the charge path (a value sent as naira where kobo is expected overcharges by 100 times), so every amount input parses to integer kobo at the boundary and every amount display divides at the boundary. This guardrail is repeated in §5 (payouts), §6 (invoices, settlements, credits), and §7 (the amount-shaped error rows) rather than assumed.

---

## 2. The public error-rendering contract

The console binds to exactly one error shape. It is defined in `packages/core-contracts/src/types/envelope.ts` as `ApiError` and produced by `apps/api/src/shared/http/error-handler.ts`. The console parses nothing else.

### 2.1 The envelope shape

```jsonc
{
  "success": false,
  "statusCode": 422,
  "error": {
    "code": "CLIENT_VALIDATION_FAILED",   // NombaoneErrorCode, always public-safe
    "message": "Validation failed",         // human-readable, one line
    "hint": "...",                          // actionable, ALWAYS present
    "docUrl": "https://docs.nombaone.com/errors#CLIENT_VALIDATION_FAILED",
    "fields": {                             // present only on 422 field validation
      "email": ["email must be a valid email address"],
      "amountInKobo": ["amountInKobo must be a positive integer"]
    }
  },
  "meta": { "requestId": "req_..." }        // ALWAYS present
}
```

The console treats `success === false` as the discriminant. It never infers failure from the HTTP status alone, and it never renders a raw status number as the primary message. The five fields it consumes:

- **`error.code`** drives behavior. The console switches on the code to choose the surface (§2.3), the badge, and any automatic recovery (a `SUBSCRIPTION_VERSION_CONFLICT` retries itself, §4.1). Because the code is drawn from `NombaoneErrorCode` and the handler has already run `toPublicErrorCode`, the console can trust the code is public-safe.
- **`error.message`** is the short title of the error surface. Present tense, one line.
- **`error.hint`** is rendered verbatim as the body of the error surface. This is the sentence that tells the reader what to do. The console never paraphrases it, truncates it, or hides it behind a "details" toggle.
- **`error.docUrl`** becomes a "Read the reference" link that deep-links to `https://docs.nombaone.com/errors#CODE`. It opens in a new tab and is present on every error, so the console always has somewhere to send a reader who wants more.
- **`error.fields`** is rendered inline next to the offending inputs on a 422 (§2.4). It is absent on every other status, and the console must not assume it exists.
- **`meta.requestId`** is shown on every error surface as a copyable, monospaced token labeled "Reference for support." On a 5xx it is the primary artifact, because it is what support needs to find the failure.

### 2.2 Non-public codes collapse, and the console renders that honestly

The error handler maps any code outside `PUBLIC_ERROR_CODES` to `SYSTEM_INTERNAL_ERROR` and replaces the message with "Internal server error" before it reaches the wire. So the console will only ever see public codes, and it renders `SYSTEM_INTERNAL_ERROR` honestly rather than pretending to know the cause.

The `SYSTEM_INTERNAL_ERROR` surface shows:
- Title: "Something failed on our side."
- Hint (verbatim from `ERROR_CODE_META.SYSTEM_INTERNAL_ERROR`): "Something failed on our side. Retry shortly; if it persists, contact support with the `requestId` from the response `meta`."
- The `requestId`, copyable, as the headline artifact with a "Copy reference" button.
- A "Retry" action, because a 500 is often transient.
- The `docUrl` link.

The console does not invent a cause, does not blame the reader, and does not bury the `requestId`. `SYSTEM_UPSTREAM_ERROR` renders the same way with its own hint ("An upstream dependency was unavailable or timed out ...") and leans harder on retry, since it is explicitly transient.

```
┌───────────────────────────────────────────────────────────────┐
│  ⚠  Something failed on our side.                              │
│                                                               │
│  Something failed on our side. Retry shortly; if it persists, │
│  contact support with the requestId from the response meta.   │
│                                                               │
│  Reference for support                                        │
│  ┌─────────────────────────────────┐                          │
│  │ req_9f2c1a7b40e6            [Copy]│                         │
│  └─────────────────────────────────┘                          │
│                                                               │
│  [ Retry ]      Read the reference ↗                          │
└───────────────────────────────────────────────────────────────┘
```

### 2.3 Four error surfaces, chosen by shape

The console renders errors in one of four surfaces. The choice is a function of where the error belongs, not a stylistic call.

| Surface | Used for | Trigger shape | Component (doc 06) |
|---|---|---|---|
| **Inline field** | Field-level validation | 422 with `error.fields` | Input `.hint.err` under each field |
| **Form banner** | A submit that failed a business rule | 4xx business codes on a mutation (`CLIENT_CONFLICT`, `SUBSCRIPTION_ILLEGAL_TRANSITION`, `PLAN_HAS_ACTIVE_SUBSCRIBERS`, `INVOICE_NOT_VOIDABLE`, and the like) | Callout at the top of the form or drawer |
| **Section error** | A read that failed | Any non-2xx on a `GET` that owns a region | Section-replacing error card with Retry |
| **Toast** | A transient or background failure | 429 rate limit, background writes, optimistic rollbacks | aria-live toast, top-right, `--warning` or `--danger` |

Every one of the four carries the same four load-bearing parts: the `message` as title, the `hint` verbatim, the `docUrl` link, and the `requestId`. Only the placement changes.

Decision order when a mutation fails: if `statusCode === 422` and `error.fields` is present, render inline fields (and, when a field message has no obvious input, also surface it in the form banner). Otherwise render the form banner. A read failure always renders the section error for its region. A 429 always renders a toast because it is about pace, not about the form.

### 2.4 The 422 rendering: fields inline, next to the offending input

A 422 with `error.fields` is the console's best moment, because the API has already told it exactly which input is wrong and why. Each key in `fields` is a field path; its array of messages renders as `.hint.err` text directly under the matching input, and the input takes the `.invalid` ring. The form banner carries only the top-level `hint` (rendered dash-free here from `ERROR_CODE_META.CLIENT_VALIDATION_FAILED`): "One or more fields are invalid. Read the fields map in this response. Each key is a field path and its messages tell you exactly what to fix."

Rules for the inline rendering:
- **Path mapping.** The console maps `fields` keys to inputs by field path. A nested path (for example `items.0.priceId`) resolves to the specific row control, not the whole form.
- **Unmatched keys.** A `fields` key with no rendered input (a server-only field) surfaces in the form banner as a bullet, so no message is ever dropped.
- **Focus.** On render, focus moves to the first invalid input and the page scrolls it into view.
- **Money fields.** An `amountInKobo` field error renders under the naira input the reader actually typed into, and the message is shown as-is. The console still shows its own boundary conversion (naira to kobo) so the reader can see the value that was sent.
- **Clear on edit.** Editing an input clears its inline error immediately; the console does not wait for resubmit to clear a fixed field.

```
  Create customer
  ┌─────────────────────────────────────────────────────────────┐
  │  ⚠  One or more fields are invalid. Read the fields map in   │
  │     this response. Each key is a field path and its messages│
  │     tell you exactly what to fix.        Read reference ↗    │
  └─────────────────────────────────────────────────────────────┘

  Email
  ┌───────────────────────────────────────────┐  (ring: --danger)
  │ not-an-email                              │
  └───────────────────────────────────────────┘
  ⚠ email must be a valid email address

  Name
  ┌───────────────────────────────────────────┐
  │ Ada Lovelace                              │
  └───────────────────────────────────────────┘

  Reference for support  req_9f2c1a7b40e6  [Copy]
  [ Cancel ]                               [ Create customer ]
```

### 2.5 The docUrl deep-link and the requestId, on every surface

Two elements appear on all four surfaces without exception:
- **`docUrl`** renders as a quiet link, "Read the reference," using the animated-link primitive, opening `error.docUrl` in a new tab. It is never the primary action, and it is never omitted, because the API guarantees it is always present.
- **`requestId`** renders in Geist Mono with a copy button, labeled "Reference for support." On 4xx it sits at the foot of the surface; on 5xx it is promoted next to the title. The reader can always answer "what do I quote to support?" without opening devtools.

---

## 3. Idempotency handling

`Idempotency-Key` is required on money movers and optional-but-encouraged elsewhere, per `apps/api/src/shared/middlewares/idempotency.ts`. The console owns key generation so a reader never sees the header, and it renders each of the four idempotency outcomes correctly.

### 3.1 The console generates the key; the reader never types one

For any mutation, the console generates a stable `Idempotency-Key` (a UUID) at the moment the reader opens the form or arms the action, and it holds that same key across retries of *that same intent*. This is what makes the "Retry" button on a failed money mover safe: retrying reuses the key, so a request that actually succeeded server-side but failed to return replays instead of double-moving money. A brand-new intent (the reader closes the drawer and reopens it) generates a fresh key.

Money movers that carry a required key (a missing key is a 400 `IDEMPOTENCY_KEY_MISSING`): subscription create, change, resubscribe, cancel; credit grant and void; card setup; mandate create; settlement payout and refund. The console never issues one of these without a key, so a reader never sees `IDEMPOTENCY_KEY_MISSING` from the UI. The row exists in the catalog (§7) because a hand-rolled integration hits it, and the console's own request inspector (doc 04) will surface it if it ever occurs.

### 3.2 The four outcomes

Per the middleware, a key drives a state machine with four outcomes. The console renders each.

- **`proceed`** (the claim was won, the handler runs). Normal path. The console shows the optimistic or pending state, then the result.
- **`replay`** (a completed request with this key is re-served, no re-execution). Transparent. The console renders the returned `data` exactly as a fresh success, with no "this was a replay" chrome. The reader who double-clicked "Pay out" sees one payout, not two, and never learns there was a race. This is the point: transparent means invisible.
- **`in_progress`** (409 `IDEMPOTENCY_IN_PROGRESS`, a concurrent request holds the key). The console shows a non-alarming "in progress" state on the action, keeps the button disabled, and auto-retries the same key after a short backoff to collect the final result. Hint verbatim: "A request with this Idempotency-Key is still being processed. Wait briefly and retry with the same key to get the final result." The console follows that hint literally.
- **`mismatch`** (422 `IDEMPOTENCY_KEY_REUSED`, the same key arrived with a different body). This is a client bug and the console treats it as one: it does not auto-retry, it surfaces a form banner, and it regenerates the key for the corrected resubmit. Hint verbatim: "You reused an Idempotency-Key with a different request body. Use a new key for a new operation, or resend the identical body to replay the original result."

```
  in_progress (409)                         mismatch (422)
  ┌───────────────────────────────┐         ┌───────────────────────────────┐
  │ Pay out ₦48,500.00            │         │ ⚠ Idempotency key reused       │
  │                               │         │                               │
  │ ⟳ In progress. Confirming     │         │ You reused an Idempotency-Key  │
  │   with the same request...    │         │ with a different request body. │
  │   [ Working ]  (disabled)     │         │ Use a new key for a new        │
  │                               │         │ operation, or resend the       │
  │ Auto-retries in 2s            │         │ identical body to replay.      │
  └───────────────────────────────┘         │ req_...  [Copy]  Reference ↗   │
                                            │ [ Try again ]                  │
                                            └───────────────────────────────┘
```

### 3.3 Fail-open is invisible, and that is correct

If Redis is unreachable the middleware fails open and the request proceeds as a normal, non-deduped write. The console does not surface this; a signed-up tenant must be able to transact through a dedup-store blip. The trade-off is logged server-side. The console's only responsibility here is to keep reusing the same key on retry so that when the store recovers, the claim behaves.

---

## 4. Concurrency and platform errors

These are the errors that come from the platform's shape rather than from the reader's input. Each has a defined console behavior.

### 4.1 SUBSCRIPTION_VERSION_CONFLICT: silent re-fetch and retry

Subscriptions carry a `version` for optimistic concurrency, and the billing scheduler races the console for the same row. When a console mutation loses that race the API returns `SUBSCRIPTION_VERSION_CONFLICT`. Hint: "The subscription changed since you loaded it (optimistic-concurrency conflict). Re-fetch it, reapply your change on the latest version, and retry."

The console follows the hint automatically and silently. On this code, and only on this code, it re-fetches the subscription (`GET /v1/subscriptions/{id}`), reapplies the reader's pending change onto the fresh `version`, and retries the mutation, up to a small bounded number of attempts. The reader sees a brief "Updating" state, then the result. This is the correct rendering of a concurrency conflict: the scheduler advancing a period underneath the reader is not the reader's problem to solve.

Two guards on the silent retry:
- **Bounded.** After a small number of failed re-fetch-and-retry cycles the console stops and shows a form banner with the code, the `requestId`, and a manual "Reload and try again." A conflict that will not clear is worth showing.
- **Semantic re-apply, not blind replay.** If the re-fetch reveals the change is now moot or illegal (for example, the subscription is now `canceled`), the console does not retry. It surfaces the resulting `SUBSCRIPTION_ILLEGAL_TRANSITION` and re-gates the actions per the FSM (doc 02). Voluntary `subscription.canceled` and involuntary `subscription.churned` are distinct terminal outcomes and the console labels them distinctly; it never resurrects either with a retry.

```
  (reader clicks "Pause")            (scheduler advanced the period; 409 version conflict)

  ⟳ Updating...        →   re-fetch GET /v1/subscriptions/{id}  →  reapply pause on new version  →  ✓ Paused
                           (silent, up to N attempts; reader sees only "Updating")
```

### 4.2 Rate limits: read the headers, respect Retry-After

The rate limiter emits `X-RateLimit-Limit` and `X-RateLimit-Remaining` on every request, and `Retry-After` (seconds) on rejection, then throws 429 `RATE_LIMIT_EXCEEDED`. Hint: "You're sending requests too quickly. Back off and retry after the interval in the Retry-After header."

Console behavior:
- **On rejection (429).** Show a toast, not a page error, because it is about pace. Disable the offending action for the `Retry-After` interval, showing a live countdown, then re-enable. Auto-retry a single background poll after the interval when the action was a read; require a click when the action was a write.
- **Headroom, ambiently.** The developers area (doc 04) surfaces `X-RateLimit-Remaining` against `X-RateLimit-Limit` so a reader can see they are near the limit before they hit it. This is preventive, and it belongs in the request inspector, not in a modal.
- **Quota is a different ceiling.** `QUOTA_EXCEEDED` (429) is the monthly `monthlyRequestQuota`, not the per-minute window. Hint: "You've reached a plan or account quota for this operation. Back off and retry later, or contact support to raise the quota." The console renders this against the org's quota in settings and links to "Contact support to raise the quota," because unlike a rate limit it will not clear on its own within the minute.

### 4.3 Maintenance and the kill-switch: reads live, writes pause

The platform gate pauses mutating traffic platform-wide from a single `platform_config` row, returning 503 `PLATFORM_MAINTENANCE` on `POST`, `PUT`, `PATCH`, and `DELETE` while leaving reads available. Hint: "The platform is briefly paused for maintenance and is rejecting writes. Reads still work; retry your write after a short wait." The 503 may carry a custom `message` set by operators; the console renders that `message` when present and falls back to the hint.

Console behavior:
- **A global banner.** On any `PLATFORM_MAINTENANCE`, the console pins a `--warning` banner across the top: "Nomba One is paused for maintenance. You can still view everything; new changes are paused." It uses the operator `message` when the API supplies one.
- **Reads stay fully usable.** The console does not blank the app. Lists, detail drawers, metrics, and the event feed all keep working, because the gate only touches mutations. This is the honest rendering: the platform is not down, writes are paused.
- **Writes soft-disable.** Primary actions that mutate go to a disabled "Paused for maintenance" state with a tooltip, rather than failing on click. If a write is attempted anyway (a race with the banner), the 503 surfaces as a form banner with a "Retry" that the reader can use once maintenance clears.

```
┌───────────────────────────────────────────────────────────────────────┐
│ ⚠ Nomba One is paused for maintenance. You can still view everything;  │
│   new changes are paused. Retry your write after a short wait.         │
└───────────────────────────────────────────────────────────────────────┘
  Subscriptions                                    [ + New subscription ]  ← disabled, tooltip
  (list renders normally; reads are unaffected)
```

### 4.4 API_KEY_ENVIRONMENT_MISMATCH: the test/live switch is the fix

A live key against a test host, or the reverse, returns `API_KEY_ENVIRONMENT_MISMATCH`. Hint: "You used a live key against a test host (or vice-versa). Use the key whose prefix (nbo_test_/nbo_live_) matches the environment you're calling."

In the console this should be rare, because the console holds one key per environment and the mandatory test/live switch (doc 01) selects it. When it does occur (a stale cached key, an environment switch mid-session), the console:
- Renders the code as a form banner or toast pointing at the switch, not at a raw key field: "This key is for the other environment. Switch to test to use it," with the environment switch as the action.
- Never asks the reader to paste a key to resolve it. The environment switch is the fix, and the console frames it that way.

Related key errors render with their own hints and actions: `API_KEY_MISSING` and `API_KEY_INVALID` route to re-authenticating (the console session, doc 09), and `API_KEY_SCOPE_FORBIDDEN` names the missing scope from its hint ("Grant the required scope (e.g. customers:write) to the key ...") and links a viewer or developer to the owner who can grant it.

---

## 5. Honest live-gated and unbuilt states

The console renders interim states as their true state and never as confirmation. This is Tenet 8 made visible, and it is a hard rule: the console never claims a payout hit a bank when only the ledger is posted.

### 5.1 The interim-state badge treatment

Four status values are interim by construction. Each gets a distinct, honest badge (mapped to doc 06's FSM badge set) with a one-line "what this means" on hover, and none of them reads as a green "done."

| Value | DTO | What it truly means | Badge | Console copy |
|---|---|---|---|---|
| `pending` | `SettlementStatus`, `RefundStatus`, `PayoutStatus` | Recorded, not yet confirmed anywhere | `--warning` | "Pending. Recorded, awaiting confirmation." |
| `ledger_only` | `RefundStatus` | The refund is posted in our ledger; money has not left to the customer | `--info` | "Ledger only. Booked in your ledger. The money return is not confirmed at the bank." |
| `ledger_posted` | `PayoutStatus` | The payout debit is posted in our ledger; the bank transfer leg is flag-gated and not confirmed | `--info` | "Ledger posted. Booked in your ledger. The bank transfer is not confirmed." |
| `consent_pending` | payment method `status` (mandate) | The customer has not finished authorizing the mandate | `--warning`, live dot off | "Consent pending. The customer has not authorized this mandate yet." |

Only `succeeded` (payout, refund) and `settled` or `reconciled` (settlement) render as success. `settled` is a `--success` badge; `reconciled` adds the live dot, because it is the strongest correctness signal the tenant has. `failed` renders `--danger` with the `failureReason` shown verbatim.

### 5.2 Payout: never say "paid to bank" on ledger_posted

The payout provider leg is flag-gated by `NOMBA_PAYOUT_ENABLED` and, until it is live, a payout sits at `ledger_posted`. The `PayoutResponseData` carries `resolvedAccountName`, `bankCode`, `accountNumber`, `providerReference`, and `failureReason`. The console renders `ledger_posted` honestly:

```
┌───────────────────────────────────────────────────────────────┐
│  Payout  PAY-...                          [ Ledger posted ]    │
│                                                               │
│  ₦48,500.00  to  GTBank ****4417                              │
│  Booked in your ledger. The bank transfer is not confirmed.   │
│                                                               │
│  Provider reference   (none yet)                              │
│  When the bank confirms, this moves to Succeeded.             │
└───────────────────────────────────────────────────────────────┘
```

It does not print "Paid," does not show a checkmark, and does not imply the money reached the account. When `providerReference` is null it says so. Only a transition to `succeeded` flips the copy to "Paid to bank" and the badge to `--success`. If the leg fails, `failed` shows `failureReason` verbatim and offers a re-attempt.

### 5.3 Refund: ledger_only is booked, not returned

A refund reverses only the tenant leg; the platform fee is non-refundable, and the console states that on the refund form. Until the provider leg confirms, a refund sits at `ledger_only`, and the console renders "Booked in your ledger. The money return is not confirmed at the bank." rather than "Refunded." Amounts are integer kobo divided by 100 for display, and the form caps the refundable amount at `netToTenantInKobo` to head off `REFUND_AMOUNT_EXCEEDS_NET` before it is sent.

### 5.4 Mandate: consent_pending is honest, and the console polls

The NIBSS mandate rail is the reliable silent recurring rail, and it is live-gated (`/v1/direct-debits/*` returns 404 in sandbox). A newly created mandate returns `consent_pending`, and the console renders it as awaiting the customer, shows the consent instruction, and polls `GET /v1/mandates/{id}` toward `active` rather than claiming it is chargeable. A charge attempted against a non-active mandate returns `MANDATE_CONSENT_PENDING` or `MANDATE_NOT_ACTIVE`, and the console routes back to the consent link per those hints. The console never presents a `consent_pending` mandate as a usable default payment method.

### 5.5 Unbuilt surfaces render as gated, not broken

Two console areas depend on APIs that are not built yet, and the console must render that dependency as a deliberate gate, not as an error.

- **Console-auth-gated areas** (API keys, team and RBAC, session-bound settings) depend on the console-auth API (doc 09), which is unbuilt. Until it lands these render a "coming with team accounts" gated state, not a 404 and not a broken form. This is honest: the DB tables exist, the HTTP surface does not.
- **Operator-only surfaces stay out.** Readiness (`GET /ready`), Prometheus (`GET /metrics`), cross-tenant drift, and kill-switch control belong to admin, not console. The console does not render a broken or empty version of them; it does not render them at all. Its reconciliation view (§6, C11) shows only the tenant's own settlement `status` and ledger-derived balances, never the operator diff.

### 5.6 The money-unit caveat is a build gate, not a UI state

The charge-endpoint money unit (naira versus kobo) is not yet live-confirmed, and a wrong unit overcharges by 100 times. This is not something the console renders; it is a hard gate on the amount boundary. Every amount input converts to integer kobo before it leaves the console, every display divides by 100, and the console never sends a naira-scaled value to a charge path. The plan flags this at every amount surface (§1.3, §5.2, §5.3, §6) so the risk is designed against rather than assumed away.

---

## 6. Empty, loading, and error states per area

Each area declares its three states with the real endpoint and DTO behind it. Wireframes show the notable empties as the Phase A pencil starting point.

### C0 · Overview (`GET /v1/metrics/billing`, `GET /v1/subscriptions`, `GET /v1/organization`)

- **Loading.** Metric tiles render as skeleton numerals; the recent-activity list renders skeleton rows. No spinner.
- **Empty (first-run).** No subscriptions yet is the healthy first state. The tiles show `₦0.00` MRR and `0` active from `BillingMetricsData` (`mrrInKobo`, `activeCount`), and the body is an invitation to the quickstart, not a wall of zeros pretending to be data.
- **Error.** If `GET /v1/metrics/billing` fails, the tile row renders a section error with retry and `requestId`; the rest of the page still loads (partial rendering, §1.1). If `org_nomba_accounts.status !== 'active'`, a `--warning` banner reads "Connect your Nomba account to settle payouts," because settlement and payout require an active account.

```
┌───────────── Overview ─────────────────────────────────────────┐
│  MRR            Active         Recovered        Churn           │
│  ₦0.00          0              0                0               │
│                                                               │
│      You have no subscriptions yet.                            │
│      Create your first one to see it bill, fail, and recover. │
│                                                               │
│                 [ Start the quickstart ]                       │
└───────────────────────────────────────────────────────────────┘
```

### C1 · Subscriptions (`GET /v1/subscriptions`, `SubscriptionResponseData`)

- **Loading.** Skeleton table rows matched to the columns (reference, customer, status badge, next billing).
- **Empty (first-run).** "No subscriptions yet. Create one to start billing." plus a primary "New subscription."
- **Empty (filtered).** "No subscriptions match `status=past_due`." plus "Clear filter." The filter is keyed to the real `?status=` param over the 7-state FSM (`incomplete`, `incomplete_expired`, `trialing`, `active`, `past_due`, `paused`, `canceled`).
- **Error.** Section error with retry. On a detail mutation, `SUBSCRIPTION_VERSION_CONFLICT` self-heals (§4.1); `SUBSCRIPTION_ILLEGAL_TRANSITION` disables the illegal action and explains via its hint; `SUBSCRIPTION_PAYMENT_METHOD_REQUIRED` routes to attach a method.

### C2 · Customers (`GET /v1/customers`, `CustomerResponseData`; credit at `GET /v1/customers/{id}/credit`)

- **Loading.** Skeleton rows.
- **Empty (first-run).** "No customers yet. Add the person you will bill." plus "New customer."
- **Empty (credit, good).** On customer detail, "No credit granted." is a neutral resting state, not an error.
- **Error.** `CUSTOMER_EMAIL_TAKEN` on create renders inline under the email field from `error.fields` when present, else as a form banner with its hint: "A customer with this email already exists in your organization. Reuse the existing customer, or create this one with a different email." `CUSTOMER_NOT_FOUND` on a stale link renders a section error that checks the environment, per its hint.

### C3 · Plans and prices (`GET /v1/plans`, `PlanResponseData`; `PriceResponseData` nested)

- **Loading.** Skeleton cards.
- **Empty (first-run).** "No plans yet. A plan holds the prices customers subscribe to." plus "New plan."
- **Empty (prices).** On a plan with no prices, "This plan has no price yet. Add one to let customers subscribe." Prices are immutable, so the "change price" action reads as "add a new price and deactivate the old," never as an edit.
- **Error.** `PLAN_NAME_TAKEN` inline on the name field; `PLAN_HAS_ACTIVE_SUBSCRIBERS` on archive renders a form banner with its hint ("You cannot archive or delete a plan that still has active subscriptions. Migrate or cancel those subscriptions first, then retry.") and keeps the plan active; `PRICE_ALREADY_INACTIVE` and `PRICE_TIERED_NOT_SUPPORTED` render as form banners with their hints.

### C4 · Invoices (`GET /v1/invoices`, `InvoiceResponseData`)

- **Loading.** Skeleton rows. Amounts render as skeleton chips, never as `₦0.00` placeholders that could be misread as real zeros.
- **Empty (first-run).** "No invoices yet. Your first invoice appears after the first billing cycle." This is an honest good-empty: invoices are engine-issued, so the console never offers a "create invoice" action here.
- **Error.** `INVOICE_NOT_VOIDABLE` on a void attempt renders a form banner with its hint ("Only open, unpaid invoices can be voided. Because this invoice is paid or already void, issue a refund or credit note instead."); the void action is FSM-gated to `draft` and `open` so this is rare. Invoice status is derived, not stored, so the console renders the same precedence the API does and shows no editable status control. Money fields (`subtotalInKobo`, `totalInKobo`, `amountDueInKobo`, `amountPaidInKobo`, `amountRemainingInKobo`, signed `lineItems[]`) divide by 100 for display.

### C5 · Payments and rails (`GET /v1/payment-methods`, `PaymentMethodResponseData`)

- **Loading.** Skeleton method cards.
- **Empty (first-run).** "No payment method yet. Add a card, issue a virtual account, or set up a mandate." with three rail actions. The console configures; it never becomes a card-entry surface, so "Add card" redirects to hosted checkout (`POST /v1/payment-methods/setup` returns a `checkoutLink`; the id arrives later via `payment_method.attached`).
- **Loading (async attach).** After the setup redirect, the method shows `setup_pending` and the console polls or awaits the webhook rather than claiming the card is on file.
- **Error.** `PAYMENT_METHOD_NOT_ACTIVE`, `PAYMENT_METHOD_KIND_MISMATCH`, `MANDATE_NOT_ACTIVE`, `MANDATE_CONSENT_PENDING`, and `MANDATE_MAX_AMOUNT_EXCEEDED` each render as a form banner with their own hint and the matching action (re-authorize, choose the right kind, return to consent, or lower the amount). No PAN ever crosses the wire; the console only shows `brand`, `last4`, `expMonth`, and `expYear`.

### C6 · Dunning and recovery (`GET /v1/subscriptions/{id}/dunning`, `DunningStateResponseData`; attempts array `DunningAttemptResponseData`)

- **Loading.** Skeleton attempt timeline.
- **Empty (good).** "No subscriptions are in recovery." is the healthy resting state of the cockpit and reads as reassurance. When a single subscription has `DunningStateResponseData.status === 'none'`, its panel reads "Not in dunning."
- **Error surface is the feature.** Every attempt shows a concrete `failureReason` and `gatewayMessage`, its `branch` (`reschedule`, `card_update_required`, `short_path`), its `status` (`scheduled`, `attempting`, `succeeded`, `rescheduled`, `card_update_required`, `exhausted`), and `nextAttemptAt`, never a shrug. Blind retry is structurally absent for `card_update_required` and OTP or expired-card cases; the console routes to a card update or forwards `invoice.action_required.checkoutLink` instead, matching the `DUNNING_CARD_UPDATE_REQUIRED` hint ("Send the customer the hosted payment/checkout link ..."). A recovery renders the one earned emerald peak (`--success`, live dot, doc 07).

```
┌───────────── Recovery ─────────────────────────────────────────┐
│                                                               │
│              No subscriptions are in recovery.                │
│         Failed charges will show up here with the reason      │
│              and the next scheduled attempt.                  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### C7 · Settlements, payouts, escrow (`GET /v1/settlements`, `SettlementResponseData`; `GET /v1/settlements/escrow`, `EscrowResponseData`)

- **Loading.** Skeleton rows; the escrow panel renders skeleton figures.
- **Empty (first-run).** "No settlements yet. They appear as customers pay." plus, if `org_nomba_accounts.status !== 'active'`, the connect-account banner from C0.
- **Escrow, at rest.** With nothing locked, the escrow panel shows `lockedInKobo` as `₦0.00`, `availableInKobo`, and the rolling-3-hour explainer as information, not an error. `ESCROW_LOCKED` on a payout is not a failure of the reader; it is the refund buffer, and the console explains it in plain language with the `since` timestamp.
- **Error.** `PAYOUT_EXCEEDS_AVAILABLE` renders against `availableInKobo` with its hint ("Reduce the amount to at most the available balance, or wait for more funds to settle."); `ESCROW_LOCKED` explains the hold; `REFUND_ALREADY_REFUNDED` and `REFUND_AMOUNT_EXCEEDS_NET` render on the refund form. The `gross = platformFee + net` split (`grossInKobo`, `platformFeeInKobo`, `netToTenantInKobo`) renders as a visual receipt, all divided by 100.

### C8 · Coupons, discounts, credits (`GET /v1/coupons`, `CouponResponseData`)

- **Loading.** Skeleton rows.
- **Empty (first-run).** "No coupons yet. Create one to discount a subscription."
- **Error.** `COUPON_INVALID_DEFINITION` renders inline where the definition is inconsistent (its hint names the amount-versus-percent conflict); `COUPON_EXPIRED`, `COUPON_MAX_REDEMPTIONS_REACHED`, and `COUPON_ALREADY_APPLIED` render as form banners with their hints. Credit voids surface `CREDIT_GRANT_ALREADY_VOIDED`; grants surface `CREDIT_INVALID_AMOUNT` inline (its hint: "it must be a positive integer in the smallest currency unit"), which is exactly where the kobo boundary matters.

### C9 · Developers (webhooks, events, test mode; keys gated on console-auth)

- **Webhooks empty.** "No webhook endpoints yet. Add one to receive events." plus "Add endpoint." The event picker lists the 35-type catalog from `GET /v1/events/catalog` plus `*`.
- **Deliveries empty (filtered).** "No deliveries match `status=dead`." with a clear-filter action; `status` is one of `pending`, `succeeded`, `failed`, `dead`.
- **Events empty.** "No events yet. Events appear as things happen in your account." A live-tailing feed (doc 04) renders new events as they arrive, aria-live.
- **Keys (gated).** Until console-auth ships, the API keys panel renders the §5.5 gated state, not a broken form. `API_KEY_SCOPE_FORBIDDEN` and `API_KEY_ENVIRONMENT_MISMATCH` render with their hints and the switch or owner-contact action.
- **Test mode (env-gated).** Mounted only when `INFRA_ENVIRONMENT=test`; the console hides it entirely on live. `WEBHOOK_ENDPOINT_NOT_FOUND` and `WEBHOOK_EVENT_NOT_FOUND` render as section errors with retry.
- **Error.** Any deliveries or events read failure renders a section error with retry and `requestId`.

### C10 · Settings, org, team (`GET/PUT /v1/organization`, `GET/PUT /v1/organization/billing`)

- **Loading.** Skeleton form.
- **Empty.** Settings are rarely empty; unset optional fields (branding `logoUrl`, `supportEmail`) render as clearly optional placeholders, not as errors.
- **Team (gated).** Roles, TOTP, and invites depend on console-auth (doc 09) and render the gated state until it ships. Once live, `AUTH_FORBIDDEN_ROLE` and `MEMBER_LAST_OWNER` render with their hints (the last-owner guard is a form banner, not a silent failure), and a viewer sees the permission-empty state for API keys per §1.2.
- **Error.** `DUNNING_SETTINGS_INVALID` on saving billing settings renders inline on the offending field (non-increasing retry offsets or an empty schedule) with its hint.

### C11 · Reconciliation (tenant-scoped only)

- **Loading.** Skeleton figures.
- **Empty (good).** "Everything reconciles." is the healthy state. The console shows the tenant's own settlement `status` (including `reconciled`) and ledger-derived balances.
- **Boundary.** Cross-tenant drift and orphan classification is admin-only; the console renders no operator diff. If a settlement carries `failed`, it shows `failed` with the reason and routes to support with the `requestId`, rather than exposing the operator reconciliation surface.

---

## 7. The representative error table

Each row is a real code from `packages/errors/src/codes.ts`. "What the console shows and offers" summarizes the surface (§2.3), renders the code's real `hint`, and names the one action. Hints are reproduced from `ERROR_CODE_META`, re-punctuated dash-free for this page; the console renders them verbatim.

| Code | HTTP | When it happens | What the console shows and offers |
|---|---|---|---|
| `CLIENT_VALIDATION_FAILED` | 422 | A field failed validation on a create or update | Inline `.hint.err` under each `fields` key; banner hint "read the fields map"; focus the first invalid input; offer resubmit |
| `IDEMPOTENCY_KEY_MISSING` | 400 | A money mover reached the API without a key (never from the console UI) | Section error with `requestId`; surfaced in the request inspector; the console always sends a key (§3.1) |
| `IDEMPOTENCY_IN_PROGRESS` | 409 | A concurrent request holds the same key | "In progress" state, action disabled, auto-retry same key after backoff (§3.2) |
| `IDEMPOTENCY_KEY_REUSED` | 422 | Same key, different body | Form banner with the hint; regenerate the key; no auto-retry; offer corrected resubmit |
| `SUBSCRIPTION_VERSION_CONFLICT` | 409 | The scheduler advanced the subscription under the reader | Silent re-fetch, reapply, retry, bounded; brief "Updating" (§4.1) |
| `SUBSCRIPTION_ILLEGAL_TRANSITION` | 409 | An action illegal for the current FSM state | Disable the action, explain via hint, re-gate per FSM; distinguish `canceled` from `churned` |
| `SUBSCRIPTION_PAYMENT_METHOD_REQUIRED` | 422 | Billing a subscription with no usable method | Form banner; action "Attach a payment method" |
| `SUBSCRIPTION_NOT_FOUND` | 404 | Stale link or wrong environment | Section error; hint checks id and environment; offer environment switch |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests this minute | Toast; disable action for `Retry-After` with countdown; auto-retry reads (§4.2) |
| `QUOTA_EXCEEDED` | 429 | Monthly `monthlyRequestQuota` reached | Toast plus settings render; action "Contact support to raise the quota" |
| `PLATFORM_MAINTENANCE` | 503 | Kill-switch on; a write was attempted | Global `--warning` banner (operator `message` when present); soft-disable writes; reads stay live (§4.3) |
| `API_KEY_ENVIRONMENT_MISMATCH` | 401 | Key prefix does not match the host ring | Banner or toast pointing at the test/live switch; action "Switch environment" (§4.4) |
| `API_KEY_SCOPE_FORBIDDEN` | 403 | Key lacks the endpoint's scope | Banner naming the scope from the hint; action route to the owner who can grant it |
| `CUSTOMER_EMAIL_TAKEN` | 409 | Duplicate `(org, env, email)` | Inline under email when in `fields`, else form banner; action "Use the existing customer" |
| `PLAN_HAS_ACTIVE_SUBSCRIBERS` | 409 | Archiving a plan that still has subscribers | Form banner with hint; keep plan active; action "Migrate or cancel subscriptions" |
| `PRICE_ALREADY_INACTIVE` | 409 | Deactivating an already-inactive price | Form banner; no-op guidance; action "Create a new active price" |
| `INVOICE_NOT_VOIDABLE` | 409 | Voiding a paid or already-void invoice | Form banner with hint; action "Issue a refund or credit note" |
| `PAYMENT_METHOD_NOT_ACTIVE` | 409 | Charging a pending, expired, or removed method | Form banner; action "Re-authorize or add a method" |
| `MANDATE_CONSENT_PENDING` | 409 | Charging a mandate the customer has not authorized | Banner with hint; action "Send the consent link"; keep badge `consent_pending` |
| `MANDATE_MAX_AMOUNT_EXCEEDED` | 422 | Charge above the mandate ceiling | Form banner; action "Lower the amount or re-authorize a higher limit" |
| `DUNNING_CARD_UPDATE_REQUIRED` | 409 | Card needs OTP or 3DS that cannot run headlessly | No blind retry; action "Send the hosted checkout link" (`invoice.action_required.checkoutLink`) |
| `DUNNING_NO_OPEN_INVOICE` | 409 | Recovery triggered with no past-due invoice | Form banner; hint confirms there is nothing to recover |
| `ESCROW_LOCKED` | 409 | Payout or refund against escrowed funds | Plain-language escrow explainer with `since`; action "Wait for the hold to release" (§C7) |
| `PAYOUT_EXCEEDS_AVAILABLE` | 422 | Payout above `availableInKobo` | Form banner against the available figure; clamp the amount input |
| `REFUND_AMOUNT_EXCEEDS_NET` | 422 | Refund above `netToTenantInKobo` | Inline on the amount; cap the input at net; state fee is non-refundable |
| `REFUND_ALREADY_REFUNDED` | 409 | Refunding a fully refunded charge | Form banner; action "Inspect the existing refund" |
| `COUPON_INVALID_DEFINITION` | 422 | Amount-off and percent-off both set, or non-positive | Inline on the definition fields with hint |
| `CREDIT_INVALID_AMOUNT` | 422 | Non-integer or non-positive credit amount | Inline on the kobo field; hint names the smallest-currency-unit rule |
| `WEBHOOK_ENDPOINT_NOT_FOUND` | 404 | Inspecting a deleted endpoint | Section error with retry; action "List endpoints" |
| `INVALID_CURSOR` | 400 | A malformed or expired pagination cursor | Silent reset to first page (drop the cursor), per the hint; no visible error for the reader |
| `SYSTEM_UPSTREAM_ERROR` | 502 or 503 or 504 | Upstream dependency down or timed out | Section error or toast; hint says transient; prominent "Retry"; `requestId` |
| `SYSTEM_INTERNAL_ERROR` | 500 | Any non-public internal failure (collapsed) | Honest 500 surface, `requestId` promoted and copyable, "Retry," `docUrl` (§2.2) |

---

## 8. Loading, skeletons, optimism, and confirms

The loading contract is as considered as the error one, because a stuck spinner is its own dead end.

- **Skeletons, not spinners, for structured content.** Tables, detail drawers, metric tiles, and timelines render shape-matched skeletons (doc 06). A bare spinner is reserved for a button's own in-flight state (the existing `.btn` spinner) and for a full-page first paint before the shell mounts.
- **Cursor pagination has its own loading.** "Load more" shows an inline loading row at the foot of the list, never a full-list skeleton, because the existing rows stay put. There are no page numbers and no totals, so the console never renders a total count it does not have.
- **Optimistic writes with honest rollback.** Low-risk, non-money mutations (renaming a plan, toggling a webhook) apply optimistically and roll back with a `--danger` toast on failure, showing the error's `hint`. Money movers are never optimistic; they show a pending state and wait for the real result, because the console must not imply money moved before the API confirms it.
- **Confirm dialogs for destructive and money actions.** Cancel a subscription, void an invoice, pay out, refund, revoke a key, and rotate a secret each confirm first. The confirm names the exact consequence ("This cancels the subscription now" versus "at period end," the two distinct operations) and, for money, shows the exact naira amount derived from kobo.
- **Reduced motion.** Every skeleton shimmer, toast entrance, and the recovery peak collapse to near-instant under `prefers-reduced-motion` (doc 07). A loading state must never depend on motion to be legible.
- **The stuck-state escape hatch.** Any loading state that runs past a threshold reveals a "Still working. Retry?" affordance, so a hung request degrades to the error contract instead of an endless spinner.

---

## 9. Phase A and Phase B, and the voice audit

This doc is built the two-phase way, and it is gated by a voice audit because it is where the voice is most tested.

**Phase A (pencil, low-fi).** Design in Pencil every state this doc names: the four error surfaces, the 422 inline rendering, the in-progress and mismatch idempotency states, the version-conflict "Updating," the maintenance banner, the honest `ledger_posted` payout, and one representative empty per area (first-run, filtered, good, environment, permission). Done criteria: every area from C0 through C11 has an empty, loading, and error frame in the `.pen` source, and the four error surfaces exist as reusable frames. The `.pen` design source is the hard 1:1 gate once frames exist.

**Phase B (build to spec).** Build each state against the real envelope. Bind `error.hint`, `error.docUrl`, `error.fields`, and `meta.requestId` from `ApiError`; switch behavior on `error.code`; wire the silent version-conflict retry; render the interim badges from the real `SettlementStatus`, `RefundStatus`, and `PayoutStatus` enums. Done criteria: every public code in `PUBLIC_ERROR_CODES` has a defined console rendering; no error path renders "something went wrong"; every money amount divides by 100 at the display boundary and parses to integer kobo at the input boundary; no charge or payout call can send a naira-scaled amount; test-mode surfaces are hidden unless `INFRA_ENVIRONMENT=test`; and the console-auth-gated areas render the gated state, not a broken form.

**Voice audit (hard gate).** Errors and empty states give direction, not mood. Sentence case everywhere. Present tense, active voice, verb-first. Serial commas. No em dashes and no en dashes used as dashes. None of the banned filler words. Status enums are verbatim from the API, with `subscription.canceled` (voluntary) and `subscription.churned` (involuntary) kept distinct. The console renders every `hint` byte-for-byte and never rewrites it. Re-read the built strings once and remove any dash of that kind before shipping.

---

Proceed to doc 09.
