---
title: "Move to Nomba One"
type: reference
summary: "Coming from another processor? Map what you already know to Nomba One's cleaner equivalents, and move without downtime by running both in parallel."
canonical: https://docs.nombaone.xyz/migrate/overview
---

# Move to Nomba One

If you're already billing subscriptions on Paystack, Stripe, or Flutterwave, you
don't start from zero: most concepts map directly, and the ones that don't are
usually Nomba One removing a gotcha you'd learned to live with. This section maps
your current mental model to ours, and gives you a safe, zero-downtime way to
switch.

## Pick your starting point

- **[Coming from Paystack](/migrate/from-paystack)**: 
Map Paystack's subscription gotchas to our clean equivalents.
- **[Coming from Stripe Billing](/migrate/from-stripe)**: 
Move a Stripe Billing integration, concept by concept.
- **[Coming from Flutterwave](/migrate/from-flutterwave)**: 
Untangle tx_ref / flw_ref into one reference.
- **[From any processor](/migrate/generic)**: 
A zero-downtime parallel-run playbook.

## What's the same everywhere

Whatever you're coming from, these map cleanly:

- **Plans and prices**: the product and its recurring amount.
- **Customers**: who you bill.
- **Subscriptions**: a customer on a price, billed each cycle.
- **Webhooks**: events telling your server what happened.

## What Nomba One does differently (on purpose)

- **One reference, everywhere.** A resource, its ledger postings, and its webhooks
share one `nbo…` id, no `tx_ref` vs `flw_ref` vs `id` tangle. See
[the ledger](/concepts/the-ledger).
- **Integer kobo, always.** No floats, no ambiguous decimal strings: every money
field ends in `InKobo`. See [money is integer kobo](/concepts/money-is-integer-kobo).
- **Honest about the hard parts.** Thin balances, card OTP, push-vs-pull rails are
first-class, not edge cases you discover in production. See the
[concepts](/concepts/how-billing-works).

> **Move without a big-bang cutover**
>
> You don't have to switch everyone at once. The
> [parallel-run playbook](/migrate/generic) keeps your old processor live while new
> subscriptions start on Nomba One, so nothing breaks mid-migration.
