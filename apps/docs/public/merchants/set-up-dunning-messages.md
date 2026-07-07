---
title: "Set up dunning messages"
type: reference
summary: "Decide what your customer sees when a payment fails: the retry schedule and the message that recovers the payment without you chasing it."
canonical: https://docs.nombaone.xyz/merchants/set-up-dunning-messages
---

# Set up dunning messages

Payments fail: a card has no funds that day, a bank needs the customer to
re-confirm. **Dunning** is how Nomba One recovers those payments for you: it
retries on a schedule and messages the customer to fix it, so you don't have to
notice or chase. From the console you decide what that looks like.

## What happens when a payment fails

Automatically, without you doing anything:

1. Nomba One marks the subscription **past due**, not cancelled.
2. It **retries** the payment over the next few days, because a failure in Nigeria
is usually "not yet," not "no."
3. It **messages the customer** to top up or re-confirm, with a link to fix it.
4. When a retry succeeds, the subscription goes back to normal on its own.

> **Don't cut off the customer at the first failure**
>
> A failed payment is usually temporary. Nomba One keeps the subscription active
> while it retries. Cancelling immediately loses customers who would have paid a
> day later.

## What you control

- **The message.** What the customer receives when a payment fails and when a card
needs re-confirming, your tone, your brand.
- **How long to keep trying.** The retry window before a subscription is finally
treated as cancelled.
- **When to give up.** What happens if every retry fails: cancel, or leave it
paused for you to follow up.

> **The card re-confirm case**
>
> Sometimes a bank asks the customer to approve a renewal with a one-time code.
> When that happens, Nomba One sends them a fresh link to confirm. The payment
> completes when they do. This is normal for cards in Nigeria and is handled for
> you.

- **[Read a settlement](/merchants/read-a-settlement)**: 
See recovered payments arrive.
- **[Share a payment link](/merchants/share-a-payment-link)**: 
Where a subscription begins.
