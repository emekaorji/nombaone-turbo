# Escrow / withdrawal-lock — design note (apps/console)

> Status: **design note only.** The withdrawal + sweep UI/flow lives in `apps/console`
> (not `apps/api`), which is not built yet. This records the rule so it is not lost.
> Owner surfaces: console withdrawal screen + the automated payout sweep.

## Why

We split collections **at the moment of collection** (already how `apps/api` settlement
works): a ₦10,000 charge splits into ₦9,800 to the tenant's Nomba sub-account and ₦200
to our sub-account (the platform fee). Tenants can move their balance to their local bank
(manual withdrawal or an automated sweep).

The risk: a tenant could drain funds the instant they land, leaving us unable to **refund**
an end-customer who later flags a fraudulent/disputed charge. So we hold a **rolling
3-hour escrow**: a tenant may not move out any funds collected in the last 3 hours. That
window is our buffer to pull the money back for a refund before it leaves the platform.

## The rule (enforced on BOTH manual withdrawal AND the automated sweep)

At withdrawal time, the maximum a tenant may move to their local bank is:

```
withdrawable = subAccountBalance − lockedLast3h − minWithdrawalBuffer
```

- `subAccountBalance` — the tenant's Nomba sub-account balance (console fetches it from
  Nomba; it is the source of truth for available funds).
- `lockedLast3h` — Σ `net_to_tenant_kobo` of that tenant's `settlements` rows with
  `created_at >= now − 3h` (and `status` in the settled/reconciled set). This is the
  amount collected in the escrow window that we may still need to claw back. Computed
  from `apps/api`'s `settlements` table (columns already exist: `sub_account_ref`,
  `net_to_tenant_kobo`, `created_at`, `status`).
- `minWithdrawalBuffer` — a floor so we never sweep a tenant down to zero / below a
  minimum withdrawable amount (dust). A per-tenant or platform config (likely a future
  `org_billing_settings` field, e.g. `min_withdrawable_kobo`).

Concretely: **`balance_after_withdrawal ≥ lockedLast3h`**, and the withdrawal amount must
be **≥ the minimum withdrawable amount**. A withdrawal (or sweep) that would violate
either is rejected/clamped. The lock is a *rolling* window — as settlements age past 3h
they drop out of `lockedLast3h`, freeing that money.

## Refund rule (F3) — the fee is NOT refunded

A refund returns **only the tenant's share** (the ₦9,800), never the platform fee (the
₦200). Our fee is earned at collection and is non-refundable.

- Mechanically: reverse **only the tenant-share leg** — pull ₦9,800 back from the tenant's
  escrowed sub-account balance. The platform-fee leg stays untouched.
- This is exactly why the escrow lock reserves `net_to_tenant_kobo` (₦9,800) and not the
  gross: the locked amount is precisely the refundable amount, so a refund inside the
  window is always fully covered.
- **Accepted trade-off:** the end-customer gets back the net ₦9,800, not the gross
  ₦10,000. (If we ever want gross refunds, the platform must eat the ₦200 — a separate
  product decision; not assumed here.)
- Our ledger already posts the settlement as **separate tenant + fee legs**, so reversing
  just the tenant leg is clean and keeps the books balanced.

The refund *executor* (a Nomba Transfer that moves ₦9,800 off the tenant's sub-account
back to us / the end-customer) is future `apps/console` + Nomba Transfers work.

## ⚠ Core assumption to confirm with Nomba (the whole model depends on it)

This design assumes **we (the parent account) control each tenant's sub-account** — i.e.
Nomba lets the parent:
1. **hold** the tenant's collected funds in a distinct, parent-controlled sub-account balance,
2. **gate/authorize** the tenant's withdrawals to their local bank,
3. run **automated sweeps** of tenant balances,
4. **pull funds back** for a refund.

This is the open **T0 ⚠**: are Nomba sub-accounts *distinct balances the parent controls*,
or merely *virtual-account attribution* (funds actually sit in the parent, sub-account is
just a label)? **Confirm in the live session (Group E).**

- If (2)–(4) hold → this design works as written; the tenant "withdrawal" is a
  parent-authorized transfer.
- If sub-accounts are only attribution → funds already sit with the parent, so the escrow
  is even simpler to enforce on our side, but a tenant "withdrawal" becomes a
  **parent-initiated Transfer** to the tenant's bank. Either way **the lock math is
  identical** — only *who moves the money* changes.

## Optional `apps/api` helper (offer — not built)

Since `apps/api` owns `settlements`, it could expose the lock number so console does not
re-implement it:

- `computeTenantEscrow(db, ctx, { now, lockWindowHours = 3 })` in
  `sara/settlement/escrow.ts` → `{ lockedKobo, since }` (the Σ over recent settlements).
- `GET /v1/settlements/escrow` → console calls it to get `lockedLast3h`; the sub-account
  *balance* still comes from Nomba (console fetches it). `apps/api` supplies the lock, not
  the balance.

Marked **optional** per the directive ("mostly console → just a note"). Build only if the
console team wants `apps/api` to own the computation.
