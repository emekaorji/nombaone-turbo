---
title: "Read a settlement"
type: reference
summary: "Understand a payout and find exactly where your money is: what settled, the fee taken, what's available now, and what's held briefly before you can withdraw."
canonical: https://docs.nombaone.xyz/merchants/read-a-settlement
---

# Read a settlement

When a customer pays, the money doesn't vanish into a black box. A **settlement**
is the record of a payment becoming *your* money: what was collected, the fee, and
your net. From the console you can always see where every naira is.

## What a settlement shows

- **Collected**: what the customer paid.
- **Fee**: the platform fee taken from that payment.
- **Your net**: what's left, which is yours.
- **Status**: settled (it's yours), or refunded.

Your net settles to your Nomba account, ready to be paid out to your bank.

## Where your money is

At any moment your balance is in one of three places:

- **Available**: settled and ready to withdraw to your bank now.
- **Held (escrow)**: money from very recent payments, held for a short window so a
refund can be handled cleanly before it leaves. It becomes available shortly.
- **Paid out**: already withdrawn to your bank.

> **Why some money is briefly held**
>
> A recent payment is held for a short escrow window so that if a refund is needed,
> it can be taken from that payment before you've withdrawn it. It's a safety
> feature: the money is still yours and releases to available soon.

## Refunds and payouts

- **Refund**: you can refund a customer's payment. The platform fee on it is not
refunded; the rest goes back to the customer.
- **Payout**: withdraw your available balance to your bank account. What you can
withdraw is your settled net, minus anything still held in escrow.

> **Every number ties back to a payment**
>
> Each settlement links to the exact subscription and invoice it came from, so a
> payout is never a mystery figure: you can trace it to the customer and cycle
> that produced it.

- **[Create a plan](/merchants/create-a-plan)**: 
Where the money starts.
- **[Overview](/merchants/overview)**: 
The whole no-code flow, start to finish.
