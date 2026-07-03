---
title: "Coming from Flutterwave"
type: reference
summary: "Map Flutterwave's tx_ref / flw_ref split and payment-plan model to Nomba One's one-reference, integer-kobo equivalents."
canonical: https://docs.nombaone.xyz/migrate/from-flutterwave
---

# Coming from Flutterwave

If you've integrated Flutterwave, the biggest change is a relief: **one reference
instead of two**. Where Flutterwave gives you a `tx_ref` you generate and a
`flw_ref` it generates — and you reconcile between them — Nomba One gives every
resource a single `nbo…` id that its ledger postings and webhooks all share.

## Concept map

| Flutterwave | Nomba One | Note |
|---|---|---|
| Payment Plan | [Plan](/reference/plans) + [Price](/reference/prices) | Amount and interval live on the price. |
| `tx_ref` (yours) + `flw_ref` (theirs) | one `nbo…` reference | One id per resource, everywhere. See [the ledger](/concepts/the-ledger). |
| Subscriptions on a plan | [Subscriptions](/reference/subscriptions) | Same idea, richer lifecycle. |
| `amount` (naira, float) | `unitAmountInKobo` (integer kobo) | No floats — `250000` = ₦2,500.00. |
| Webhook `event` | [Catalog events](/webhooks/event-catalog) | Typed, documented, signed. |

## The three things that change

- **One reference.** Stop reconciling `tx_ref` against `flw_ref`. Given any
`nbo…` id you can find the resource, its ledger postings, and its events. This
removes a whole class of "which id do I store?" bugs.
- **Integer kobo, no floats.** Flutterwave amounts are naira and often float.
Nomba One is always integer kobo — see
[money is integer kobo](/concepts/money-is-integer-kobo) and mind the
[100× trap](/concepts/money-is-integer-kobo) when you port amounts.
- **Verify webhooks by HMAC over the raw body.** Replace `verif-hash` header
checks with the [signature recipe](/webhooks/signing-and-verification) —
HMAC-SHA256 over `timestamp.rawBody`, constant-time compare.

> **Bank transfer is first-class, not a workaround**
>
> Flutterwave treats transfers as one-off charges you stitch into a plan. In
> Nomba One a transfer is a real subscription rail — the engine exposes where to
> pay and settles when the money arrives. See
> [multi-rail: push and pull](/concepts/multi-rail-push-and-pull).

- **[From any processor](/migrate/generic)** — 
The zero-downtime parallel-run playbook.
- **[Your first subscription](/getting-started/your-first-subscription)** — 
Build the equivalent flow end to end.
