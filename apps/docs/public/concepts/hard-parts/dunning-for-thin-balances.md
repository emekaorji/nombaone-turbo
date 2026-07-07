---
title: "Dunning for thin balances: why payday-timed retries beat fixed schedules"
type: reference
summary: "Most subscription churn in Nigeria is involuntary. A retry on the wrong day just burns an attempt."
canonical: https://docs.nombaone.xyz/concepts/hard-parts/dunning-for-thin-balances
---

# Dunning for thin balances: why payday-timed retries beat fixed schedules

## The scenario

A customer's card is good, their subscription is active, they intend to pay. On the 1st, the charge fails:
insufficient funds. Their salary lands on the 28th. Whether you keep this customer comes down to one thing:
which day you retry.

## The naive approach

Retry on a fixed ladder: try again in a day, then three days, then a week. It is simple, it is what most
billing libraries ship, and it treats every failure the same.

## Why it breaks

A fixed ladder is blind to why the charge failed and to when money will actually be there. Retry a thin
balance on the 2nd, the 5th, and the 8th, and you have spent your whole retry budget days before payday, on an
account you already know is empty. In Nigeria most subscription churn is involuntary: the customer never chose
to leave, your schedule just gave up before their salary arrived.

## How Nomba One handles it

Dunning first classifies the failure over a stable internal taxonomy, never the raw gateway text, and branches
on it. An expired or invalid card is held for a card update, not retried blindly, because a retry cannot
succeed and only burns the window. A hard decline gets one courtesy attempt and then escalates. Insufficient
funds, a processor blip, or an unknown error get rescheduled, and that reschedule is payday-biased.

Instead of "now plus 24 hours," the next attempt snaps forward onto the first configured payday within a
pull-forward window, fixed to Africa/Lagos time so it does not drift with the server. The defaults encode the
Nigerian pay cycle: paydays around the 26th through the 1st, retries spaced over roughly a week, a handful of
attempts before the subscription is treated as involuntarily churned. You spend attempts when money is likely
to be there, not before.

The distinction is recorded, too. A customer who cancels is marked voluntary and emits `subscription.canceled`;
one lost to failed retries is marked involuntary and emits `subscription.churned`. Your churn metrics never
conflate a customer who left with a customer you lost.

## See it

Run the simulator on the insufficient-funds branch and watch the retry land on payday, then recover.

See the [dunning and recovery guide](/guides/dunning-and-recovery) and [start a subscription](/guides/start-a-subscription).
