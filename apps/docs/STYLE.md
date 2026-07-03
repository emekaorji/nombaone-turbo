# Docs — House Style

> The one voice for every Nomba One doc page. Grounded in `MANIFESTO.md` (tenets 2, 6,
> 9, 10) and the Google + Microsoft developer-writing guidance. The Vale pack
> (`.vale/`) enforces the mechanical rules in CI; this file is the human reference.
> One platform, one language — a term means the same thing here, in the console, in
> the API, and in error strings.

## Voice

- **Second person, present tense, active voice.** "You send a request and get back an
  invoice." Not "A request is sent" / "you will get."
- **Verb-first, outcome-first.** Start how-to steps and sentences with a verb: "Create a
  plan," "Send the same key to retry safely." Lead a guide with the command and the
  result (Fly.io style), defer the architecture.
- **Momentum over completeness in tutorials.** Get the reader to a real `201` fast; the
  edge cases come after the first success.
- **No marketing adjectives in reference.** Reference is fact: no "powerful," "seamless,"
  "enterprise-grade," "blazing." Persuasion never touches the money path.
- **Honest about the hard parts.** Name dunning, reconciliation, the double-charge trap,
  and the card-recharge OTP wall plainly. If a behavior isn't documented, it doesn't
  exist. Don't pre-announce unreleased features as if shipped.
- **Errors tell you what to do.** Every error surfaces its `hint` and links to its
  `/errors` entry. Empty states offer the next action, never a dead end.

## Mechanics

- **Sentence case** for every heading ("Handle webhooks", not "Handle Webhooks").
- **Oxford comma.** "cards, mandates, and transfers."
- **Code font** for code, identifiers, fields, and values (`amountInKobo`, `POST`,
  `nbo_test_…`). **Bold** for UI a merchant clicks. Never bold for emphasis in reference.
- **Contractions are fine** ("don't", "you'll") — this is a human talking to a human.
- **Descriptive links.** Link the noun ("see the [error reference]"), never "click
  here" / "this link."
- **One example per idea.** Every endpoint gets a copy-run example; keep it minimal.

## Locked vocabulary (one noun per concept — Vale fails CI on a violation)

| Use | Never | Why |
|---|---|---|
| `:id` (path param) | `:ref`, `:reference` | The URL param matches the `id` field returned. |
| **organization** | tenant | The developer-facing entity is an organization. |
| `/webhooks` (+ nested `/webhooks/:id/deliveries`) | `/webhook-endpoints`, "webhook config" | Name things by what people control. |
| **integer kobo**, `…InKobo` | naira, floats, decimal strings | Money is integer kobo; every money field ends in `InKobo`. `₦1 = 100 kobo`. |
| **idempotency key** | "idempotent token" | Matches the `Idempotency-Key` header. |
| one **reference** per resource | `tx_ref` / `flw_ref` / `trxref` tangle | One concept, one name across API, webhook, dashboard, error. |
| **subscription / plan / price / invoice / mandate / settlement** | synonyms | The glossary is the source of truth; link the noun on first use. |
| dunning **cadence**, **attempt**, **recovery** | "retry loop" (in reference) | Consistent with the engine's vocabulary. |
| snake_case enum values (`monthly`, `past_due`) | UPPERCASE, camelCase values | Enum values are snake_case; keys are camelCase. |

## Diátaxis discipline (never mix modes on one page)

- **Tutorials** (Get started) — learning-oriented; a guided path to a first success. No
  reference tables.
- **How-to guides** (Guides, Migrate, For merchants) — task-oriented; assume a goal.
- **Reference** (API reference, Webhooks, Errors, Test toolkit, Changelog) —
  information-oriented; complete, accurate, dry. No tutorials smuggled in.
- **Explanation** (Concepts, incl. Hard Parts) — understanding-oriented; the "why," the
  trade-offs, the honest hard parts. No step-by-step.

## Money & correctness (tenet 1)

- Every amount is **integer kobo**; state the unit on every money field and link it to
  `/concepts/money-is-integer-kobo`. `250000` is ₦2,500.00.
- Every money-moving `POST` documents its idempotency semantics inline.
- Show the unhappy path with the happy path: declines, `past_due`, `action_required`,
  and the double-charge trap get the same care as `200`.
