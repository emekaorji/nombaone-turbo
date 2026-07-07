---
title: "The hard parts"
type: reference
summary: "The parts of subscription billing that are genuinely hard, and how Nomba One handles each. Honest essays on the traps most billing systems hide until you hit them in production."
canonical: https://docs.nombaone.xyz/concepts/hard-parts
---

# The hard parts

Most billing docs show you the happy path and go quiet on the rest. These essays
do the opposite: each one takes a part of subscription billing that is genuinely
hard (especially in Nigeria, where money arrives by transfer and balances are
thin) and explains the trap, why it's easy to get wrong, and how Nomba One
handles it. This is the reading that separates a toy from a billing system.

## Getting the money right

The failures here are the expensive ones: a customer charged twice, a proration
off by a kobo, a webhook replay that credits a balance again.

- **[The double-charge trap](/concepts/hard-parts/the-double-charge-bug)**: 
Why a billing loop that occasionally double-charges is worthless, and how idempotency prevents it.
- **[Proration is a ledger problem](/concepts/hard-parts/proration-is-a-ledger-problem)**: 
How fractional kobo from a mid-cycle change resolve so the legs always balance.
- **[Retrying the webhook ≠ retrying the charge](/concepts/hard-parts/retry-the-webhook-is-not-retry-the-charge)**: 
Why at-least-once delivery means your handler must be idempotent to the ledger.

## The Nigerian rails

Card-on-file-with-a-full-balance is a foreign assumption. Here money is pushed by
transfer, cards need OTP, and a failed charge usually means "not yet."

- **[Bank transfer isn't a 'method'](/concepts/hard-parts/bank-transfer-is-not-just-another-method)**: 
Why a pushed rail can't be pulled, and what "collect" means when the customer initiates.
- **[Card tokens expire](/concepts/hard-parts/card-tokens-expire)**: 
Why a recurring card charge hits OTP, and the checkout-link recovery model.
- **[Mandates and consent](/concepts/hard-parts/mandates-and-consent)**: 
The direct-debit lifecycle (create, consent, activate, debit) and its async gap.
- **[When a transfer doesn't match the invoice](/concepts/hard-parts/when-a-transfer-does-not-match-the-invoice)**: 
Underpayment, overpayment, and the wrong reference: a real case, not an edge.
- **[Dunning for thin balances](/concepts/hard-parts/dunning-for-thin-balances)**: 
Why payday-timed retries beat fixed schedules when balances are thin.

## Time, cycles, and churn

Billing is a scheduling problem, and calendars are hostile: months have different
lengths, and subscriptions end in two very different ways.

- **[The end-of-month billing trap](/concepts/hard-parts/the-end-of-month-billing-trap)**: 
What "bill on the 31st" means in February, and how the anchor is preserved.
- **[Voluntary vs involuntary churn](/concepts/hard-parts/voluntary-vs-involuntary-churn)**: 
Why the two are different events with different handling: cancel vs recover.
- **[A scheduler that survives a crash](/concepts/hard-parts/scheduler-that-survives-a-crash)**: 
How the billing loop resumes exactly-once after a mid-run failure.

## Multi-tenancy and trust

If you run billing for many merchants, isolation and settlement stop being
features and become the whole product.

- **[Settlement without spreadsheets](/concepts/hard-parts/settlement-without-spreadsheets)**: 
Matching money to merchants at scale, without a reconciliation nightmare.
- **[Isolation is a data-model property](/concepts/hard-parts/isolation-is-a-data-model-property)**: 
Why multi-tenancy has to be built into the schema, not bolted on with filters.
- **[What to check before you trust a billing layer](/concepts/hard-parts/what-to-check-before-you-trust-a-billing-layer)**: 
The questions to ask any billing system before you route real money through it.

> **Start with the concepts**
>
> New here? Read [how billing works](/concepts/how-billing-works) and
> [the ledger](/concepts/the-ledger) first. The hard parts build on them.
