# nomba one

subscriptions and recurring billing for nigeria, built on nomba.

merchants sell plans. we bill the cards, chase the failures, keep the ledger, and pay them out.

---

## for judges: verify the whole thing in ~10 minutes

everything below is live. no setup, no install.

| what | where |
|---|---|
| website | https://nombaone.xyz |
| docs | https://docs.nombaone.xyz |
| merchant console | https://console.nombaone.xyz |
| api (live) | https://api.nombaone.xyz |
| api (sandbox) | https://sandbox.api.nombaone.xyz |
| a real merchant using us | https://recipe-1.nombaone.xyz |

**console login**
```
email:    emekapraiseo@gmail.com
password: HHMyLiG3uMncxLw
```

---

### 1. see the product (1 min)

go to https://nombaone.xyz

then https://docs.nombaone.xyz. every page is real, no placeholders. the error reference and event catalog are generated from the code, so they cannot drift.

---

### 2. sign in to the console (1 min)

go to https://console.nombaone.xyz/login and use the credentials above.

top right, there is a **sandbox / live** toggle. that is the whole environment model: one deployment, two account modes, decided by the api key prefix (`nbo_sandbox_` / `nbo_live_`).

**start in sandbox.** no real money moves there.

---

### 3. watch a subscription bill itself, in real time (10 min, mostly waiting)

this is the part worth your time.

1. **plans → new plan**
2. name it anything, price it anything
3. for the cadence, pick **every 10 minutes**

that is not a demo mode. `interval: minute, intervalCount: 10` is a first class cadence, identical to monthly in every code path. it exists so a developer can watch billing happen instead of waiting a month.

4. **developers → test**, add a test card with behavior **success**
5. **subscriptions → new subscription**, pick your plan, that customer, that card
6. now wait

come back in ~10 minutes. it billed itself again. **invoices** shows two paid invoices about 10 minutes apart, and the period has advanced.

nothing triggered that but the billing sweep running every minute. that is the product.

**too impatient?** **developers → test → advance cycle** is a test clock. it runs the exact same code the sweep does, just now.

---

### 4. break it on purpose (2 min)

**developers → test** gives you deterministic instruments in sandbox:

- a card with behavior **decline** (always fails)
- a card with behavior **otp** (bank asks for a step up)
- **advance cycle** (skip the wait)
- **simulate** (fire any webhook)

swap the subscription onto a declining card, then advance the cycle.

it goes past due. dunning starts a retry ladder. the customer gets a payment link. **dunning and recovery** shows the whole ladder. pay the link, and it recovers.

a failed payment is not an error page. it is a workflow.

---

### 5. look at the money (2 min)

- **payments** — every charge, and which rail took it
- **settlements and payouts** — gross, our fee, net to the merchant, and the withdraw button
- **reconciliation** — us against nomba, line by line

merchant balances live in a double entry ledger. a payout is refused unless the balance is proven by the sum of the ledger entries, not by a cached number.

---

### 6. use the api yourself (3 min)

**developers** → create a sandbox api key.

```bash
curl https://sandbox.api.nombaone.xyz/v1/plans \
  -H "Authorization: Bearer nbo_sandbox_..."
```

docs and code samples: https://docs.nombaone.xyz

**developers → logs** shows the request you just made, with the response body. **developers → webhooks** lets you register an endpoint and replay any delivery.

---

### 7. see a real merchant on live money

https://recipe-1.nombaone.xyz

iron republic is a gym. it is not a mock. it is a separate next.js app, its own database, talking to us only through our published npm sdk, on **live keys**.

the flex pass is ₦100 per 10 minutes of floor time. joining charges a real card.

it exists because a reference app that cannot be deployed proves nothing. every bug that mattered in this project was found by running this, not by running tests.

---

## the sdks

nine of them, one per language, in `../`:

```
nombaone-node     nombaone-python   nombaone-go
nombaone-ruby     nombaone-php      nombaone-java
nombaone-dotnet   nombaone-rust     nombaone-elixir
```

`@nombaone/node` is published on npm and is what the gym runs on. that is deliberate: the reference app consumes the public sdk, never the internals, so if the sdk cannot build a real app then no merchant can either.

---

## what is in this repo

```
apps/api        the money engine (rest api, billing sweeps, dunning, ledger, webhooks)
apps/console    what a merchant sees
apps/docs       docs.nombaone.xyz
apps/website    nombaone.xyz
apps/checkout   hosted payment pages
apps/admin      our own back office. underway, not shipped yet.
examples/gym    a real merchant, deployed on live keys
packages/*      shared infra: db, queue, rails, ledger, errors, contracts
```

**apps/admin is honest work in progress.** the platform side (approving merchants, watching every tenant's money, forcing a reconcile) is scaffolded and not finished. we would rather tell you that than show you a screen that does nothing.

---

## things worth knowing

**money is integer kobo, everywhere.** nomba's api speaks naira on the wire. we convert at the boundary and never again. a float never touches an amount.

**a price is immutable.** changing a plan's price mints a new price row and retires the old one. subscribers pin a price id, so existing customers keep the deal they signed up for. that is a property of the data model, not a feature.

**we never trust a webhook.** every inbound event is re-queried against nomba before a single naira moves. and because nomba's live account sends us no webhooks at all, the engine polls for payments rather than waiting to be told. it settles either way.

**dunning scales to the cadence.** a 10 minute plan cannot have a 3 day retry ladder. the intervals clamp to the billing period.

---

## running it locally

you do not need to. everything is deployed. but if you want:

```bash
pnpm install
redis-server                       # required: queues, idempotency, rate limits
pnpm --filter @nombaone/api dev    # :8000
pnpm --filter @nombaone/console dev # :8010
```

copy `.env.example` in each app. the api will refuse to boot in production without a real mail transport, on purpose.

---

the previous readme is at [README-old.md](README-old.md).
