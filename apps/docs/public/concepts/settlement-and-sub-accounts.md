---
title: "Settlement & sub-accounts"
type: explanation
summary: "How a verified collection splits into the platform fee and the merchant's net, settles to their Nomba sub-account, and stays claw-back-safe with an escrow lock."
canonical: https://docs.nombaone.xyz/concepts/settlement-and-sub-accounts
---

# Settlement & sub-accounts

When a subscription charge is collected and verified, the money doesn't just sit in one
pool. It **splits at collection** and settles to the right place. Nomba One is multi-tenant
by design: each organization's money is its own.

## Split at collection

A verified collection is split into two legs, recorded in the [ledger](/concepts/the-ledger):

- **The platform fee**: the fee your platform charges, computed by the fee engine.
- **The organization's net**: what's left, which belongs to the merchant.

The net settles to that organization's **Nomba sub-account**. The split is posted as
balanced ledger legs, so gross always equals fee plus net, to the exact kobo.

## Sub-accounts

A **sub-account** is the organization's account on Nomba where its settled net lands.
Multi-tenancy means one integration can run many merchants, each with their own sub-account,
their own customers, and their own isolated money. See
[isolation is a data-model property](/concepts/hard-parts/isolation-is-a-data-model-property).

## Escrow, refunds, and payouts

Settled funds are not instantly withdrawable. A recent-settlement **escrow lock** holds
them for a window so a refund can be clawed back before the money leaves:

- **Refund**: reverses **only the organization's leg** back toward the payer; the platform
fee is non-refundable and is never touched. A refund posts a new reversing transaction, so
the ledger stays complete.
- **Payout**: withdraws the organization's available balance (settled net, minus the
escrow lock and any minimum buffer) to a bank account.

> **Never faked, never stranded**
>
> The provider legs of refunds and payouts are guarded: the ledger truth is always posted,
> and the real Nomba transfer flips on only after live confirmation, with a compensating
> reversal if a transfer fails, so funds are never faked as sent and never stranded.

For the operational reality of matching money to merchants without a spreadsheet, see
[settlement without spreadsheets](/concepts/hard-parts/settlement-without-spreadsheets).
