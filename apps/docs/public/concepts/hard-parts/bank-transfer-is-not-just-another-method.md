---
title: "Why bank transfer isn't just another payment method"
type: reference
summary: "You can charge a card. You cannot charge a bank transfer. The whole billing model changes."
canonical: https://docs.nombaone.xyz/concepts/hard-parts/bank-transfer-is-not-just-another-method
---

# Why bank transfer isn't just another payment method

## The scenario

Your customer wants to pay by bank transfer, the way most people in Nigeria actually move money. You reach for
the same code path you use for cards: charge on the billing date, mark it paid. It does not work, and the
reason is not a bug.

## The naive approach

Treat every rail as a pull: on the cycle date, the engine debits the customer and gets an answer. Cards work
this way. Direct debit works this way. So you assume transfers do too.

## Why it breaks

A bank transfer cannot be pulled. There is no API call that reaches into a customer's account and takes the
money; the customer has to push it. If your billing model assumes it can charge on demand, the transfer rail
has nowhere to fit. And when the money does arrive, the notification that tells you is an untrusted message
from the outside world. Acting on it directly is how you mark an invoice paid for an amount that never landed.

## How Nomba One handles it

Transfers are modeled as push, honestly. Issuing a transfer invoice does not charge anything; it returns a
`pending` status and payment instructions, backed by a dedicated virtual account for that customer. The engine
then waits for the customer to push funds in.

When funding arrives, it comes as an inbound webhook, and the engine treats that webhook as a hint, not a fact.
It verifies the signature over the exact raw bytes, then requeries Nomba by the provider's transaction id to
get the truth from the source. The invoice settles only when the requery says the payment settled and the
settled amount, in integer kobo, equals the amount due. A transfer that comes in short, over, or late does not
quietly settle the invoice; it is surfaced as an amount mismatch by the nightly reconciliation for review, not
banked as a partial.

That verify-then-requery step, and the strict amount match, are the difference between "a message said we got
paid" and "we confirmed the money is here." Conversion between kobo and the naira amounts the provider expects
happens only at that boundary. Everywhere inside the engine, money is integer kobo.

## See it

Run the simulator on the transfer rail and watch the invoice wait for the push, then reconcile against the
provider before it settles.

See [when a transfer does not match the invoice](/concepts/hard-parts/when-a-transfer-does-not-match-the-invoice) and [settlement without spreadsheets](/concepts/hard-parts/settlement-without-spreadsheets).
