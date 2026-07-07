---
title: "From any processor"
type: reference
summary: "A zero-downtime playbook to move subscriptions to Nomba One: run both in parallel, migrate new business first, and drain the old processor without a cutover."
canonical: https://docs.nombaone.xyz/migrate/generic
---

# From any processor

You don't need a big-bang cutover to move to Nomba One. The safe way is to run
both processors in parallel: new subscriptions start on Nomba One, existing ones
keep billing on the old system until they naturally renew across. Nothing breaks
mid-migration, and you can stop at any point.

## The playbook

### Model your catalog in Nomba One

Re-create your [plans and prices](/guides/create-plans-and-prices) with a test
key. Amounts are [integer kobo](/concepts/money-is-integer-kobo). Verify the
naira figures match before you touch live.

### Wire and verify webhooks

Register your endpoint and confirm signature verification against the
[live secret](/webhooks/signing-and-verification). Use
[verify us in your devtools](/getting-started/verify-in-your-devtools) to prove
the pipe before real events flow.

### Route new subscriptions to Nomba One

Point new sign-ups at Nomba One while existing subscriptions keep billing on
the old processor. This is the moment you start, with zero risk to current
customers.

### Migrate existing customers as they renew

As each old subscription comes up for renewal, start its next cycle on Nomba
One instead. Migrating at the renewal boundary avoids double-charging and
proration headaches.

### Drain and retire the old processor

When the old system has no active subscriptions left, turn it off. There was
never a cutover, just a handover.

## Rules that keep it safe

> **Never bill a customer on both at once**
>
> A customer must be active on exactly one processor at a time. Migrate at the
> renewal boundary, and cancel the old subscription the moment the new one starts,
> not before, not after.

- **Idempotency-Key on every money-moving call**, so a retry during migration never
double-charges. See [going live](/guides/going-live).
- **Reconcile from the ledger, not from memory.** After migrating a customer, the
[ledger](/concepts/the-ledger) is the source of truth for what they've paid.
- **Keep the old webhook handler running** until the old processor is fully
drained: late events still need handling.

> **Card tokens rarely port**
>
> Saved card tokens usually can't move between processors. Plan to re-collect
> payment details at the renewal boundary (a [payment link](/guides/start-a-subscription)
> or a card-setup step) rather than assuming tokens transfer.

- **[Going live](/guides/going-live)**: 
The pre-launch checklist for the switch.
- **[Handle webhooks](/guides/handle-webhooks)**: 
Keep one correct balance through the migration.
