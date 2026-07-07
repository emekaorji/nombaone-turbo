# The Nomba One Way

_How we build. Read this before you write a line of code, human or agent. It is the standard every surface is held to: `api`, `docs`, `console`, `checkout`, and everything after._

---

## What we are

Nomba ships the primitives that move money. We are the layer that turns moving money once into running a subscription business, plans, cycles, proration, dunning, reconciliation, settlement; so no team ever rebuilds it again.

And we are built for how money _actually_ moves here, not how a slide deck from San Francisco says it should. Most people don't have a card on file. Money arrives by transfer. Balances are thin, so a failed charge usually means "not yet," not "no." We took that reality as the design, not the exception: one subscription over every rail — card, direct debit, transfer, crypto — dunning tuned for thin balances, and reconciliation that turns push payments into managed subscriptions.

That is the product. This document is how we build it.

## Who we serve

Four people are in the room, always:

- **The developer** integrating us, who will carry us by word of mouth.
- **The leader** deciding whether to move their revenue onto us.
- **The founder** shipping fast, who needs something robust that just works.
- **The merchant** who needs subscriptions running quickly, sometimes without an engineer at all.

We serve all four. But when they pull in different directions, we build for the **developer first**, because the fastest way to win the leader is for their own team to say _"use Nomba One."_ Win the developer and the rest follows.

---

## The tenets

### 1. The platform just works, and "works" means the money is never wrong

**Correctness in the money path is the entire job. Everything else is secondary to it.**

We never double-charge. We never lose a kobo. We never let our records silently drift from the truth. Money is integer kobo, no floats, ever. Every charge is idempotent by construction, replay it, crash halfway, retry it, and it resolves to exactly one movement. Boring, verifiable, auditable beats clever every single time. This is our floor _and_ our ceiling: a billing platform that is elegant but occasionally wrong is worthless, and a developer who catches us charging their customer twice never comes back. Guard the money like it's the only thing that matters, because to the person paying, it is.

### 2. The developer is our first user

**Even when the payer is a subscriber and the buyer is a boss, the developer is who we design for.**

Every decision, an endpoint's shape, an error's wording, a default's value, is made from the developer's side of the screen. We ask "what will they feel when they hit this at 2am with a deadline?" and we build so the answer is _relief_, not friction. We do not make developers read our source to understand our behavior. We do not make them guess. We respect their time as the scarcest thing they have, because a developer who feels respected becomes the person who tells ten others about us.

### 3. A buffet, not a menu

**Give developers so much that they eat until they're full, and still there's more.**

"Anywhere, anything, anyhow." Every rail. Every language, an official, idiomatic SDK for Node, Python, Go, Ruby, PHP, Java, Rust, .NET, and Elixir, not a lonely wrapper. Every framework, with real guides. A CLI to tail webhooks and scaffold locally. Drop-in checkout for any stack. No-code bridges for the merchant with no engineer. Mobile, when the demand is there. Raw primitives for the ones who want to build their own thing on top. A developer should almost never hit the wall where we say _"sorry, we don't support that."_ And when they do reach an edge, the primitives are there so they can build past it themselves. We win by having the answer to "can I use this with ___?" always be yes.

### 4. From "can I use this?" to "yes, I can" in minutes

**The gap between curiosity and first success is where we live or die. Close it.**

Sandbox-first, always. Simulations so a developer can _watch the core thing happen_: a subscription bill, fail, and recover, before they've written a line. A quickstart that reaches a real first subscription fast. Test instruments that behave like the real thing. The moment a developer thinks "I wonder if this works" they should be seconds from proving it does, with real calls they can inspect in their own devtools. We don't ask people to trust us. We let them verify us, immediately.

### 5. The API is the product

**An API is a user interface for developers. We design it like one.**

Consistent naming, predictable shapes, sane defaults, the minimum required to get started. Errors that are machine-readable and human-clear. Idempotency keys on everything that moves money. Versioning that never breaks someone's Saturday. A published, accurate OpenAPI spec. Timestamps in one format, money in one representation, everywhere. An API that is a pleasure to hold is not a nice-to-have, it _is_ the thing developers are buying.

### 6. Docs are the demo

**For infrastructure, documentation isn't reference material, it's the product's first surface and its best salesperson.**

Docs are first-class, runnable, and honest. Every endpoint has a real example a person can copy and run. If a behavior isn't in the docs, it effectively doesn't exist. We write docs the way we write code, reviewed, tested, kept true as the API evolves. A developer should be able to go from our landing page to a working integration without ever opening a support ticket, because the docs already answered them.

### 7. Merchants deserve the same care developers do

**Great DX for the engineer and great UX for the merchant - both, not a trade.**

Not everyone who uses us writes code. A merchant who needs subscriptions running today should be able to do it through the console or a no-code path, quickly, without an engineer, without confusion. We name things by what people control and recognize, a person manages _plans_ and _payouts_, never "webhook config." The console is as considered as the API. We refuse the false choice between a platform developers love and one merchants can actually use. We build both.

### 8. We're honest about the hard parts

**We don't hide dunning, reconciliation, or the messy reality of how money moves. We name the hard problems and solve them in the open.**

The hard parts of billing, the double-charge trap, thin-balance dunning, matching a transfer to an invoice, are exactly where teams get burned building it themselves, and exactly where we prove we're worth trusting. So we write them down, plainly, and show our work. Honesty about difficulty is not a weakness to manage; it's our trust and our moat. Anyone can claim "it just works." We show _why_ it's hard and _how_ we handle it.

### 9. Errors are a feature

**When something fails is when a developer needs us most, so failure is where we're at our best, not our most apologetic.**

An error tells you exactly what went wrong and how to fix it, in our voice, without mood or vagueness. An empty state is an invitation to act, not a dead end. A failed payment surfaces a real reason a developer can branch on, not a shrug. We spend disproportionate care on the unhappy paths, because a platform that's delightful when everything works and useless when it breaks is a platform nobody trusts with their revenue.

### 10. One platform, one language

**Learn one surface and you know them all.**

`api`, `docs`, `console`, `checkout`, one vocabulary, one visual system, one voice, one set of conventions. A word means the same thing everywhere. A pattern learned in one place works in the next. Nothing feels bolted on. The whole platform should feel like it was built by one careful team with one point of view, because it was.

---

## The test

You've built it right when:

- A developer integrates us **without ever talking to us**.
- A merchant runs a subscription **without an engineer**.
- A skeptic opens their devtools and sees our sandbox is **real**.
- Something breaks, and the error **tells them exactly what to do**.
- A year from now, the money is still **never wrong**.

If any of those isn't true, we're not done. We're _almost_ done which our developers will notice, and which is not the standard.

We are here to be the best developer and merchant experience in the ecosystem, sitting on infrastructure that works so well it becomes invisible. That's the bar. Build to it.
