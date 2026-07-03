# Nomba One · Console Plan · 05 · The Hard-Parts Cockpits

> **What this is.** The spec for the four signature honesty surfaces of the console: the dunning and recovery cockpit, the reconciliation and matching surface, the escrow-lock explainer, and the live "watch it bill, fail, recover" subscription timeline. These are the moat made visible. Tenet 8 says we name the hard problems and solve them in the open; these screens are where the console does exactly that, on the tenant's real data, with the real event vocabulary. Each cockpit below carries a Phase A pencil wireframe and a full state spec: purpose, exact DTO fields, real endpoints, FSM-aware action gating, and empty, loading, and error states.
>
> **Depends on:** doc 00 (north star, personas, design language, voice, two-phase method), doc 01 (IA, navigation, the test/live switch, cursor pagination), doc 03 (the money-movement screens this doc deepens), doc 04 (the events feed and webhook tail this doc reuses). Read those first.

---

## 1. One principle across four cockpits

Every other console screen answers "what is the state of my billing?" These four answer the harder question: "when something goes wrong with the money, do you tell me the truth, and do you tell me what to do?" That is the promise of Tenet 1 (the money is never wrong), Tenet 8 (honest about the hard parts), and Tenet 9 (errors are a feature), rendered as UI.

Three rules bind all four cockpits:

1. **Show the real reason, never a shrug.** Every failed attempt renders a concrete `failureReason` and the raw `gatewayMessage` behind it. No cockpit ever displays "something went wrong."
2. **Never offer an action the engine will not honor.** Blind retry is structurally absent for `card_update_required`, `expired_card`, `token_expired`, and `otp_required`. The UI routes to a card update or forwards the `invoice.action_required` checkout link instead. Payout is gated on real available balance and the Nomba account being active. Refund is gated on the tenant net that remains.
3. **Money is integer kobo on the wire.** Every money field ends in `InKobo`. The console renders naira by dividing by 100 for display, never with floats, and never lets an amount reach a charge, payout, or refund endpoint without the unit pinned. The known 100x naira-versus-kobo risk means any amount a person types is captured in naira, multiplied to kobo once at the boundary, and shown back to them in naira before they confirm.

The emotional shape matters. Three of these cockpits spend most of their time in warning and danger tones, because that is the honest color of a failing charge. Exactly one moment earns emerald: the second a payment recovers. That is the one place the reserved `--ease-spring` and the success live dot are spent, and spending it anywhere else cheapens it.

---

## 2. The dunning and recovery cockpit

### 2.1 Purpose

Make the failure-to-retry-to-recovery path legible for one subscription. A founder or merchant opens this to answer: why did this charge fail, what is the engine doing about it, when will it try again, and what do I (or my customer) need to do. It is the console analog of the website simulator's dunning branch, on real attempts.

This cockpit lives on the subscription detail page and opens whenever a subscription is `past_due` or carries any dunning history. It never fabricates a state: a healthy subscription shows an honest empty state, not a placeholder.

### 2.2 Data it shows

Two reads back this screen, both scoped to the tenant's `(organizationId, environment)`.

**`GET /v1/subscriptions/{id}/dunning`** returns `DunningStateResponseData`:
- `domain: 'dunning_state'` (switch on this discriminator, never on the id suffix).
- `subscriptionRef`, `invoiceRef` (the invoice under recovery, or null).
- `status`: the rolled-up latest-attempt status, one of `scheduled`, `attempting`, `succeeded`, `rescheduled`, `card_update_required`, `exhausted`, or `none` when no dunning has started.
- `attemptsUsed`, `maxAttempts`. `maxAttempts` is the tenant's `dunningMaxAttempts` policy (platform default 4).
- `nextAttemptAt`: ISO-8601 UTC, or null. Null is meaningful. A held branch has no next charge scheduled.
- `graceAccessUntil`: ISO-8601 UTC, or null. The instant the subscriber loses access, computed as the first attempt's `createdAt` plus `gracePeriodHours` (platform default 72).
- `attempts[]`: the full ordered list, described next.

**`GET /v1/subscriptions/{id}/dunning/attempts`** returns `DunningAttemptResponseData[]`, one row per retry, in attempt order:
- `domain: 'dunning_attempt'`, `id` (the `DUN` reference).
- `attemptNumber` (1-based).
- `status`: `scheduled | attempting | succeeded | rescheduled | card_update_required | exhausted`.
- `branch`: `reschedule | card_update_required | short_path`. This is the decision the engine made about how to recover, classified from the failure reason, never from the raw gateway string.
- `railKey`: which rail the attempt charged (null until a method is resolved).
- `failureReason`: the stable internal reason, one of `insufficient_funds`, `expired_card`, `token_expired`, `hard_decline`, `do_not_honor`, `mandate_suspended`, `processor_unavailable`, `otp_required`, or `unknown`. This is what the UI branches on.
- `gatewayMessage`: the raw free-text signal from the bank, shown verbatim in a secondary line for the developer who wants the ground truth.
- `outcome`: a short result string the engine stamped. Observed values include `recovered`, `rescheduled`, `card_update_required`, `action_required`, `hard_decline`, `exhausted`, `pending`, and `invoice_terminal`. Treat it as a free string and render it as a caption, do not switch program logic on it.
- `scheduledAt`, `executedAt` (null until it ran), `nextAttemptAt` (null on held branches), `createdAt`.

The org-wide roll-up for the overview comes from `GET /v1/metrics/billing` → `BillingMetricsData`, specifically `dunningRecoveryRate` (0..1), `failedChargeRate` (0..1), and `dunningFunnel` (`scheduled`, `attempting`, `cardUpdateRequired`, `rescheduled`, `succeeded`, `exhausted`). That funnel is the header stat row of the org-level dunning view; the per-subscription cockpit below is the drill-in.

### 2.3 How the three branches read on screen

The branch is the story. Render each attempt with its branch made explicit, because the branch is what tells a person whether waiting will help.

- **`reschedule`** (from `insufficient_funds`, `processor_unavailable`, `unknown`). The thin-balance case. The engine will retry, and `nextAttemptAt` is payday-biased: it snaps forward onto the tenant's configured `paydayDays` (platform default 26, 27, 28, 29, 30, 1) within `paydayPullForwardDays` (default 4), never earlier than the raw interval candidate. The UI labels this honestly, for example "Next attempt Fri 26 Sep, timed for payday." This is a state where waiting genuinely helps, so the primary posture is patience, not panic.
- **`card_update_required`** (from `expired_card`, `token_expired`, and also `otp_required`, which shares the hold semantics). The engine holds. `nextAttemptAt` is null. Blind retry is off, permanently, for this branch. The UI does not render a "retry now" button. It renders "Update the card" (the mid-dunning swap, section 2.5) or, for the OTP case, it forwards the `invoice.action_required` checkout link the engine already minted. The distinction between an expired-card swap and an OTP re-auth rides on the comms event: `payment_method.expiring` for a card swap, `invoice.action_required` (carrying `checkoutLink`) for the re-auth. Surface both honestly.
- **`short_path`** (from `hard_decline`, `do_not_honor`, `mandate_suspended`). The bank has refused in a way that waiting will not fix. At most one courtesy retry, then exhaustion and involuntary churn. The UI states this plainly: "This card was declined by the bank. One more attempt, then the subscription ends." No false hope.

### 2.4 The wireframe (Phase A pencil)

```
┌ Subscription  nbo749201835566sub · ACME Gym Monthly ─────────────────┐
│ Status: PAST DUE (warning)          Invoice nbo…inv  ₦9,800 due       │
│                                                                       │
│ ┌ Recovery ──────────────────────────────────────────────────────┐  │
│ │  Attempt 3 of 4        Branch: reschedule (payday-timed)         │  │
│ │  Grace access ends in 41h  ·  Sat 27 Sep, 02:00        [warning] │  │
│ │  Next attempt: Fri 26 Sep, 02:00  (timed for payday)            │  │
│ │                                                                  │  │
│ │  [ Update card ]   [ Send pay link ]      (no "retry now")       │  │
│ └──────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│ ┌ Attempt log ───────────────────────────────────────────────────┐  │
│ │ #1  ✗ failed      insufficient_funds     reschedule    1 Sep     │  │
│ │        "Insufficient funds"  ·  rail: card                       │  │
│ │ #2  ✗ failed      insufficient_funds     reschedule    4 Sep     │  │
│ │        "Insufficient funds"  ·  rescheduled → 26 Sep             │  │
│ │ #3  ⏳ scheduled   —                       reschedule    26 Sep    │  │
│ │        next attempt timed for payday                             │  │
│ └──────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
```

The `card_update_required` variant swaps the recovery panel to an info tone and leads with the update action:

```
┌ Recovery ──────────────────────────────────────────────────────────┐
│  Attempt 2 of 4        Branch: card update required        [info]   │
│  The card expired. Retrying it will not work.                       │
│  No further charge is scheduled until the card is updated.          │
│                                                                     │
│  [ Update card ]   [ Send customer a pay link ]                     │
└─────────────────────────────────────────────────────────────────────┘
```

And the recovery peak, the one emerald moment:

```
┌ Recovery ──────────────────────────────────────────────────────────┐
│  ● Recovered on attempt 3        [success · live dot · spring in]   │
│  invoice.payment_recovered  ·  ₦9,800 settled  ·  26 Sep 02:04      │
│  Subscription is active again.                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.5 Actions and FSM-aware gating

**Mid-dunning card swap.** `POST /v1/subscriptions/{id}/payment-method`, scope `subscriptions:write`, idempotency optional but encouraged. Body is exactly one of `{ paymentMethodReference }` or `{ checkoutToken }` (the validation rejects both or neither). The engine commits the new default in one transaction so there is never a zero-valid-token window, marks the superseded card `removed`, and, when the subscription is mid-dunning, re-arms the held `card_update_required` attempt to a `reschedule` due now. So the person clicks "Update card," and the next sweep retries immediately rather than waiting for the next cron tick.
- Gate: offer only when `dunning.status === 'card_update_required'` or when the subscription is `past_due` with a resolvable customer. Hide on `active`, `paused`, `canceled`.
- After success, the cockpit optimistically shows "New card saved, retrying now" and polls `GET …/dunning` for the attempt to flip to `attempting` then `succeeded`.

**Send a pay link.** For `otp_required` and any held state, surface the `checkoutLink` from the last `invoice.action_required` event (read from `GET /v1/subscriptions/{id}/events`, section 5). The action copies or forwards it. This is not a new API call; the engine already minted the link on the failing charge. The merchant-without-an-engineer path is one button.

**What is deliberately absent.** There is no "retry charge now" button for `card_update_required`, `expired_card`, `token_expired`, or `otp_required`. The absence is the feature. A retry button that the engine refuses to honor would be a lie about how card recurring works on Nigerian rails, which is bank-gated and not completable headlessly.

### 2.6 States

- **Empty (healthy).** When `status === 'none'`, render "No recovery needed. This subscription is billing cleanly." A good state, stated as one, not a blank panel.
- **Loading.** Skeleton the recovery panel and three attempt rows. Do not spin the whole page; the subscription header is already loaded.
- **Grace window.** While `graceAccessUntil` is in the future, show a live countdown ("Grace access ends in 41h") in warning tone. When it passes, switch the copy to "Grace access ended," and stop counting.
- **Exhausted.** When `status === 'exhausted'`, the subscription has churned involuntarily. Render in danger tone: "Recovery exhausted after 4 attempts. Subscription churned." Link to the churn moment on the timeline (section 5), where `subscription.churned` is distinct from a voluntary `subscription.canceled`.
- **Error.** A failed read renders `error.hint` verbatim, the `docUrl` deep link, and `meta.requestId`, with a retry control. A `SUBSCRIPTION_NOT_FOUND` routes back to the list with a direction, not a dead end.

### 2.7 Motion

The attempt log animates rows in with the standard entrance easing. The active attempt (`attempting`) carries the ambient pulse on its status dot. The recovery panel is the only element permitted the `--ease-spring` scale-in, fired once when `status` transitions to `succeeded`, paired with the success live dot. Respect `prefers-reduced-motion`: the logic and states still render, the flourish collapses.

---

## 3. The reconciliation and matching surface (tenant-scoped)

### 3.1 Purpose

Prove to a leader that the money reconciles, without exposing operator internals. A tenant sees its own settlements matched by our reference and verified against Nomba, and the double-entry receipt that shows a collection split cleanly into fee and net. The cross-tenant drift and orphan classification is a different job for a different persona; it lives in admin, not here.

### 3.2 The boundary, stated up front

The console shows the tenant's own settlement `status` and its own ledger-derived balances. It does **not** show `diffAgainstNomba` or `reconcileSettlements` output. Those two functions classify drift across all tenants (`settled_at_nomba_missing_locally`, `local_paid_missing_at_nomba`, `amount_mismatch`, orphans on Nomba, missing on Nomba, amount drift) and are operator territory in `apps/admin`. A tenant seeing another tenant's orphan would break the isolation invariant. So this surface is deliberately narrower than the engine's full reconciliation power: it shows the settled truth for one organization, not the operator's diff.

### 3.3 What "verified" means, made visible

The engine never trusts a webhook. `confirmInvoiceFromWebhook` re-queries Nomba and settles only when the transaction `status === 'settled'` and the settled amount equals the amount due. The match key is our own reference, never Nomba's rotating `orderReference`. The console renders this verification as a small provenance line on each settled invoice: "Matched by your reference, verified against Nomba, settled amount equals amount due." That single line is the honesty. It tells a skeptical CTO the settle was earned, not assumed.

The tenant-scoped ledger integrity comes from `reconcileLedger`, which re-sums every entry and returns a `ReconciliationReport` (`balanced`, `totalDebits`, `totalCredits`, `drift`, where `drift = totalDebits - totalCredits` and a healthy ledger has `drift === 0`). A non-zero drift throws `RECONCILIATION_DRIFT_DETECTED`, which the console surfaces as a hard integrity banner, not a soft warning, because a drifting ledger is the one thing Tenet 1 forbids.

### 3.4 The double-entry receipt

Each `SettlementResponseData` carries the split: `grossInKobo`, `platformFeeInKobo`, `netToTenantInKobo`, plus `merchantTxRef`, `subAccountRef`, `splitReference`, `invoiceReference`, and `status` (`pending | settled | reconciled | failed | refunded`). The console renders the split as a balanced receipt so the invariant `gross = platformFee + net` is visible arithmetic, not a claim. Naira on screen, kobo underneath.

### 3.5 The wireframe (Phase A pencil)

```
┌ Settlement  nbo…stl ─────────────────────────────────────────────────┐
│ Status: SETTLED (success)        Invoice nbo…inv       26 Sep 02:04   │
│                                                                       │
│ ┌ Matched and verified ──────────────────────────────────────────┐   │
│ │  Matched by your reference  →  merchantTxRef  nbo…              │   │
│ │  Verified against Nomba: status settled, amount equals due      │   │
│ └────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│ ┌ Double-entry receipt ──────────────────────────────────────────┐   │
│ │  Gross collected                                    ₦10,000     │   │
│ │    Platform fee (earned, non-refundable)          −    ₦200     │   │
│ │    Net to you                                       ₦9,800      │   │
│ │  ─────────────────────────────────────────────────────────────  │   │
│ │  gross = fee + net   ✓ balances                                 │   │
│ └────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│ Ledger integrity (your books):  balanced ✓  drift ₦0                  │
└───────────────────────────────────────────────────────────────────────┘
```

### 3.6 Data, actions, gating

- **Reads.** `GET /v1/settlements` (cursor-paginated, filter by `status`), `GET /v1/settlements/{id}`. Ledger integrity from the tenant's `reconcileLedger` report, surfaced as a status line.
- **Actions.** This surface is mostly read. The one adjacent write, refund, lives on the money screens (doc 03) and is cross-referenced here because a `refunded` settlement shows its refund provenance.
- **Gating.** Show the "verified against Nomba" line only when `status` is `settled` or `reconciled`. A `pending` settlement shows "Awaiting settlement confirmation from Nomba," a `failed` shows the failure honestly, and a `refunded` shows the reversed tenant leg with the fee retained.

### 3.7 States

- **Empty.** No settlements yet: "Settlements appear here after your first paid invoice." Not a dead end.
- **Loading.** Skeleton the receipt rows.
- **Pending verification.** `status === 'pending'`: warning tone, "We are verifying this against Nomba before we mark it settled. We never settle on the webhook alone." That sentence is the moat spoken aloud.
- **Drift detected.** If the tenant ledger returns non-zero drift, a danger banner: "Ledger integrity check found a discrepancy. Our team has been alerted. Reference: {requestId}." This is the rare honest failure, and it names itself.
- **Error.** Standard `error.hint` plus `docUrl` plus `requestId`.

### 3.8 A known live-gated caveat to render honestly

The reconciliation join field is not yet byte-confirmed against real Nomba webhooks (Nomba mints its own `orderReference` and does not echo ours in the sandbox; `requeryTransaction` reads a field the real payload names differently). Until the live confirmation lands, this surface shows the tenant's own settled truth and flags any settlement it could not verify as "pending verification" rather than claiming a match it did not make. Honesty over optimism.

---

## 4. The escrow-lock explainer

### 4.1 Purpose

Turn a rule that would otherwise read as an error ("you cannot withdraw that much") into a first-class, plain-language explanation. This is the one console rule already written down (`escrow-withdrawal-lock.md`), and it deserves to be taught, not enforced silently. A merchant withdrawing to their bank sees exactly what is available, what is locked, why it is locked, and when it frees.

### 4.2 The rule

We split every collection at the moment of collection: the tenant's net lands in their Nomba sub-account, the platform fee in ours. A tenant could drain funds the instant they land, leaving us unable to claw back for a refund if an end-customer later disputes a charge. So we hold a rolling 3-hour escrow lock on the tenant net. The fee is earned at collection and is non-refundable, so only the net is reserved, which is exactly the refundable amount.

The math the console renders comes straight from `getAvailableForPayout`:

```
available = max(0, balance − lockedLast3h − minWithdrawable)
```

- `lockedLast3h` is `computeTenantEscrow`: the sum of `netToTenantKobo` over the tenant's own `settled` and `reconciled` settlements newer than the 3-hour cutoff. Already-refunded, failed, and pending settlements are excluded, so a refunded settlement does not inflate the lock.
- `minWithdrawable` is a floor so a sweep never drains a tenant to dust.

### 4.3 Data it shows

`GET /v1/settlements/escrow` returns `EscrowResponseData`:
- `domain: 'escrow'`.
- `lockedInKobo`: the rolling-window reserve.
- `since`: the ISO-8601 window start (now minus 3 hours), so the UI can say "locked since 23:04."
- `balanceInKobo`: the tenant settlement balance (the authoritative ledger view; the Nomba sub-account balance reconciles out of band).
- `minWithdrawableInKobo`: the floor.
- `availableInKobo`: what the person can move right now.

All five are integer kobo. The console renders each in naira by dividing by 100, and pins the unit before any amount reaches the payout endpoint.

### 4.4 The wireframe (Phase A pencil)

```
┌ Withdraw to your bank ───────────────────────────────────────────────┐
│                                                                       │
│  Settlement balance                                    ₦412,900       │
│                                                                       │
│  ┌ Available now ─────────────────────────────────────────────────┐  │
│  │            ██████████████████░░░░░░  ₦357,100 available         │  │
│  │  Locked (last 3h refund buffer)      ₦52,300   locked since 23:04│ │
│  │  Minimum kept in account             ₦3,500                     │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Why is some locked?                                                  │
│  Money collected in the last 3 hours is held so we can refund a       │
│  customer if they dispute a charge. It frees automatically as it      │
│  ages past 3 hours. The platform fee is already earned and is never   │
│  part of a refund.                                                    │
│                                                                       │
│  Amount to withdraw   [ ₦ __________ ]   max ₦357,100                 │
│  [ Withdraw ]                                                         │
└───────────────────────────────────────────────────────────────────────┘
```

The locked slice of the bar is warning-tinted and carries the `since` timestamp; the available slice is neutral until the person acts. No emerald here. Emerald is reserved for recovery, and a withdrawal is routine.

### 4.5 Actions and gating

**Withdraw / payout.** `POST /v1/settlements/payout`, scope `settlements:write`, idempotency required (money moves). Returns `PayoutResponseData` with `status` `pending | ledger_posted | succeeded | failed`, plus `bankCode`, `accountNumber`, `resolvedAccountName`, `amountInKobo`, `providerReference`, `failureReason`.
- Gate the amount input to `availableInKobo`. Clamp or reject at the field, before submit, with the reason spoken: "You can withdraw up to ₦357,100 right now. ₦52,300 is in the 3-hour refund buffer and frees by 02:04."
- Gate the whole action on the Nomba account being active (`org_nomba_accounts.status === 'active'`); otherwise show "Connect your Nomba account to withdraw."
- On the error path, `ESCROW_LOCKED` and `PAYOUT_EXCEEDS_AVAILABLE` are distinct and rendered distinctly. `ESCROW_LOCKED` means the amount collides with the rolling buffer; `PAYOUT_EXCEEDS_AVAILABLE` means it exceeds the balance outright. Each renders its own `error.hint`.

**Honest status.** `ledger_posted` is not the same as bank-confirmed `succeeded`. The provider leg is flag-gated (`NOMBA_PAYOUT_ENABLED`), so the console shows `ledger_posted` as "Recorded, awaiting bank confirmation," not "Paid." Claiming a payout succeeded before the bank confirms would violate Tenet 1.

### 4.6 States

- **Empty.** Zero balance: "Nothing to withdraw yet. Your settled net appears here after your first paid invoice."
- **Fully locked.** `availableInKobo === 0` because everything is inside the 3-hour window: "All of your current balance was collected in the last 3 hours. ₦52,300 frees by 02:04." A countdown, not a rejection.
- **Loading.** Skeleton the bar and the three figures.
- **Error.** `ESCROW_LOCKED` and `PAYOUT_EXCEEDS_AVAILABLE` as above; generic errors render `hint` plus `docUrl` plus `requestId`.

### 4.7 A note on the open assumption

The whole model assumes the parent account controls each tenant's sub-account (hold, gate, sweep, claw back). That is the open T0 item to confirm with Nomba. The console renders the lock math either way, because the math is identical whether sub-accounts are distinct parent-controlled balances or mere attribution; only who moves the money changes. The explainer copy does not claim a control model that is not yet confirmed.

---

## 5. The live subscription timeline

### 5.1 Purpose

This is the signature move: the website simulator, but on real data. A per-subscription vertical timeline that renders the real lifecycle as it happened, so a founder can literally watch a subscription bill, fail, recover, or churn. Where the website simulator runs a compressed sandbox loop to convert "can I use this?" into "I did it," the console timeline replays the tenant's actual history to convert "does it work?" into "I can see it working." Same shape, same emerald peak, real events.

### 5.2 What drives it

Three real sources, merged into one time-ordered stream:

1. **`GET /v1/subscriptions/{id}/events`** → `DomainEventResponseData[]`: `domain: 'event'`, `id` (the `EVT` reference, which is the dedupe key), `type`, `payload`, `createdAt`. This is the append-only audit spine.
2. **The subscription's invoices** (`GET /v1/subscriptions/{id}/upcoming-invoice` for the forward edge, plus the invoice list for history), so each cycle's amount and derived status anchor the event.
3. **The dunning attempts** from section 2, so a failure expands into the retry cadence rather than reading as a single dead point.

The console merges these by `createdAt` and renders newest at the bottom, the way the website simulator streams its console, so the eye follows the story downward to the most recent state.

### 5.3 The real event vocabulary (render these verbatim)

The timeline speaks the frozen catalog, never a synonym:
- `subscription.created`, `subscription.activated`, `subscription.trial_will_end`, `subscription.updated`, `subscription.paused`, `subscription.resumed`.
- `invoice.created`, `invoice.finalized`, `invoice.paid`.
- `invoice.payment_failed`, `invoice.action_required` (carries the `checkoutLink`), `invoice.payment_partially_collected`, `invoice.payment_recovered`, `invoice.voided`.
- `payment_method.attached`, `payment_method.updated`, `payment_method.expiring`.
- `settlement.created`, `settlement.refunded`, `settlement.payout_created`.
- The two terminal outcomes, which are visually distinct: `subscription.canceled` (voluntary, the customer or merchant chose to end it) and `subscription.churned` (involuntary, dunning exhausted). Conflating them is a bug. The timeline colors and labels them differently: voluntary reads as a neutral, closed-by-choice endpoint; involuntary reads as a danger-toned loss with a link back to the dunning cockpit that explains why.

### 5.4 The status-to-token mapping

Reuse the design system's semantic tokens, extended to the event vocabulary:
- `subscription.created`, `invoice.created`, `invoice.finalized`: neutral.
- `subscription.activated`, `invoice.paid`: success (no spring; routine success).
- `invoice.payment_failed`: danger.
- `invoice.action_required`: info (customer action pending).
- `invoice.payment_recovered`: success with the live dot and the reserved spring. The one peak.
- `subscription.paused`: warning; `subscription.resumed`: accent.
- `subscription.canceled` (voluntary): neutral, muted.
- `subscription.churned` (involuntary): danger, solid.

### 5.5 The wireframe (Phase A pencil)

```
┌ Timeline  nbo749201835566sub ────────────────────────────────────────┐
│                                                                       │
│  ●  subscription.created            1 Aug 09:12       [neutral]       │
│  │                                                                    │
│  ●  invoice.created  · cycle 1 · ₦9,800   1 Aug 09:12                 │
│  ●  invoice.paid     · ₦9,800 settled     1 Aug 09:13   [success]     │
│  │                                                                    │
│  ●  invoice.created  · cycle 2 · ₦9,800   1 Sep 02:00                 │
│  ✗  invoice.payment_failed · insufficient_funds  1 Sep 02:00 [danger] │
│  │      dunning #1 → reschedule, next 4 Sep                           │
│  ✗  invoice.payment_failed · insufficient_funds  4 Sep 02:00 [danger] │
│  │      dunning #2 → reschedule, payday-timed → 26 Sep                │
│  ●  ● invoice.payment_recovered · ₦9,800   26 Sep 02:04               │
│  │     [success · live dot · spring in]  ← the earned peak            │
│  │                                                                    │
│  ●  invoice.created  · cycle 3 · ₦9,800   1 Oct 02:00                 │
│  ●  invoice.paid     · ₦9,800 settled     1 Oct 02:01   [success]     │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

The involuntary sad path, visually distinct from a voluntary cancel:

```
│  ✗  invoice.payment_failed · hard_decline   1 Nov 02:00     [danger]  │
│  │      dunning short_path → one courtesy retry                       │
│  ✗  dunning exhausted after 1 retry                                   │
│  ▣  subscription.churned  (involuntary)     2 Nov 02:00     [danger]  │
│       Lost to a failed payment. See recovery →                        │
```

versus:

```
│  ○  subscription.canceled  (voluntary)      2 Nov 10:22    [neutral]  │
│       Ended by the merchant. cancellationReason: voluntary            │
```

### 5.6 Data, actions, gating

- **Reads.** The three sources in 5.2. Each timeline node can expand to show the raw event `payload` (the developer's "reproduce this" affordance from doc 04) and the invoice's `lineItems`.
- **Actions.** The timeline is primarily a read surface, but action-required nodes carry the relevant action inline: an `invoice.action_required` node offers "Send pay link" (forwarding the `payload.checkoutLink`); a `payment_method.expiring` node offers "Update card" (section 2.5). Actions on the timeline are the same actions, with the same names, as the dunning cockpit. One vocabulary.
- **Gating.** Show inline actions only on nodes whose state still admits them. A resolved `invoice.payment_recovered` node shows no action; a live `invoice.action_required` node whose invoice is still open shows the pay link.

### 5.7 States

- **Empty.** A brand-new subscription with only `subscription.created`: render that single node and the copy "The story starts here. Cycles, charges, and recoveries appear as they happen."
- **Loading.** Skeleton five nodes along the spine.
- **Live.** When the subscription is currently `past_due` and a dunning attempt is `attempting`, the newest node carries the ambient pulse, implying "listening," the same signal the website simulator uses for a run in flight.
- **Error.** A failed events read renders `error.hint`, `docUrl`, and `requestId`, with retry. A partial failure (events load, invoices do not) degrades gracefully: show the event spine and mark the missing amounts "unavailable, retry," never a fabricated figure.

### 5.8 Motion

Nodes enter with the standard entrance easing as the eye scrolls or as new events arrive. The `invoice.payment_recovered` node is the single place the `--ease-spring` scale-in fires, once, with the success live dot. This mirrors the website simulator's recovery beat exactly, deliberately, because a developer who saw it on the marketing site should feel the same beat when it happens to their own subscription. Everything honors `prefers-reduced-motion`.

---

## 6. Money, vocabulary, and the two-phase method

### 6.1 Money discipline, restated because it is load-bearing

Every amount on these four cockpits (`amountDueInKobo`, `netToTenantInKobo`, `lockedInKobo`, `availableInKobo`, `grossInKobo`, `platformFeeInKobo`, and the settled amounts on the timeline) is integer kobo on the wire. The console divides by 100 for display, never touches a float, and shows a naira figure back to the person before any confirm. The two write actions here that move money, payout and the mid-dunning card swap that re-arms a charge, pin the unit at the boundary. The known 100x naira-versus-kobo risk means an unpinned amount is a 100x overcharge or a 100x underpay, so the rule is absolute: capture in naira, convert to kobo once, echo naira back, and never send a bare number to a charge, payout, or refund endpoint.

### 6.2 One vocabulary, no synonyms

These cockpits render the exact enums from the API, verbatim: the six-plus-`none` dunning statuses, the three dunning branches, the nine failure reasons, the five settlement statuses, the four payout statuses, the four refund statuses, and the frozen event catalog. Voluntary `subscription.canceled` and involuntary `subscription.churned` are never conflated, in copy, color, or logic. A word means the same thing on the timeline, in the dunning cockpit, and in the events feed, because it is the same word from the same catalog.

### 6.3 The two-phase method and done criteria

**Phase A (pencil, low-fi).** Design each cockpit in the `.pen` source as a board: the dunning cockpit with its three branch variants and the recovery peak, the reconciliation receipt, the escrow explainer with its locked-versus-available bar, and the subscription timeline with the voluntary-versus-involuntary distinction. Verify in dark and light. Phase A is done when every state in this doc (empty, loading, live, error, and each branch or status variant) has a frame, and every frame carries only real DTO field names.

**Phase B (build to spec).** Build to the frames, deriving every value from the design system tokens. Wire the real endpoints named here. Phase B is done when: the dunning cockpit renders live `DunningStateResponseData` and offers no blind-retry on held branches; the reconciliation surface shows the tenant's own settled truth and never another tenant's diff; the escrow explainer computes `available` from `EscrowResponseData` and gates payout on it; the timeline replays real `DomainEventResponseData` with the recovery spring firing exactly once on `invoice.payment_recovered`; and every error state renders `hint`, `docUrl`, and `requestId`. The `.pen` design source remains the hard 1:1 gate: shipped UI matches the frames exactly.

Proceed to doc 06.
