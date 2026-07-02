# Nomba One — Website Plan · 02 · The Live Simulator

> The signature. Depends on docs 00–01. This is the single most differentiating and most difficult piece of the site — treat it as a small product, not a widget. It must feel real, because its whole job is to convert "can I use this?" into "I just did."

---

## 1. What it is and why

A **live, sandbox-backed, time-compressed** subscription lifecycle a visitor can run on the page: pick a rail, subscribe a test customer, watch billing cycles tick by in seconds, trigger a failure, and watch dunning recover it while outbound webhooks stream in a console.

It carries all three site pillars at once:
- **Rail-agnostic** — the rail selector proves the thesis before a word of copy.
- **DX / "yes I can use this"** — real calls to a real sandbox; open devtools and see them.
- **Honesty about the hard parts** — the *failure→recovery* path is the demo. No competitor shows dunning working; you make it the hero moment, landing in emerald.

**Non-negotiable:** it hits an actual public sandbox endpoint (§6), not fake timers. A skeptical developer must be able to open the network tab and see real requests/responses. The illustrative widget shown earlier used `setTimeout` — the production build replaces that with the live contract below.

## 2. The core loop

```
pick rail → subscribe → cycle 1 (charge ✓) → cycle 2 (fail → dunning → recover ✓) → cycle 3 (✓) → done
                                     └─ webhooks stream to the console throughout ─┘
```

Default happy path runs clean. With the failure toggle on, cycle 2 fails and the dunning branch runs to recovery. Every state change emits a webhook line.

## 3. Controls

- **Rail selector** (top, first thing the hand touches): `Card` · `Bank transfer` · `Direct debit` · `Crypto`. Selecting a rail re-themes nothing but changes the lifecycle *mechanics* (§5).
- **Run simulation** — starts the loop.
- **Failure toggle** — `Simulate insufficient funds`. Once the fuller version ships, this becomes a small **reason selector**: insufficient funds · expired card · hard decline — each drives a different dunning branch (§5.3).
- **Reset** — clears state and the console.
- A quiet **"1 cycle ≈ 2s"** label with a tooltip: *"This runs three months in about six seconds. Your real billing runs on its actual schedule."* — honesty so nobody thinks you're claiming instant billing.

## 4. Visual anatomy

```
┌───────────────────────────────────────────────────────────────┐
│ [ Card ][ Bank transfer ][ Direct debit ][ Crypto ]  1 cycle≈2s│
│ ┌── lifecycle timeline ─────────────────────────────────────┐  │
│ │ ● Subscribed → ○ Cycle 1 → ○ Cycle 2 → ○ Cycle 3         │  │
│ │   (pills fill/animate as the run progresses)             │  │
│ └───────────────────────────────────────────────────────────┘  │
│ [ Run simulation ]  [ Simulate insufficient funds ]  [ Reset ] │
│ ┌── outbound webhooks → your endpoint ──────────────────────┐  │
│ │ raw JSON event lines, newest at bottom, mono, streaming   │  │
│ └───────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

- **Timeline pills** move through states using the design-system status colors: pending (neutral) → active (accent) → done (success) → failed (danger) → recovered (success, with a label like "Cycle 2 · recovered").
- **Webhook console** is deliberately **raw JSON**, not a prettified feed — raw payloads read as "this is real" to a developer. Newest line appends at the bottom; the console auto-scrolls.
- All colors/spacing/motion come from the design system. The recovery moment uses emerald — the product's proudest second in the brand color.

## 5. Rail-specific behavior (the important part)

The lifecycle is the same; the *mechanics per rail* differ, and showing that difference is the payoff.

### 5.1 Card & Direct debit (pull rails)
- Billing is a **pull**: the engine charges on the cycle. Webhooks: `invoice.created` → `payment_success`.
- Failure (insufficient funds): `invoice.payment_failed` → `dunning.retry_scheduled` → (retry) `payment_success` → `invoice.payment_recovered`.
- Direct debit adds a one-time consent step at subscribe (`mandate.consent_pending` → `mandate.active`) to show the mandate model.

### 5.2 Bank transfer (push rail)
- Billing **cannot be pulled** — the engine issues the invoice and waits for the customer to push a transfer into a dedicated virtual account. Show this honestly: `invoice.created` → `virtual_account.funded` → reconciliation → `payment_success`.
- "Failure" here = under/no payment: `invoice.created` → (nudge) `reminder.sent` → grace window → recovered on transfer, or churn. This visibly teaches the push/pull asymmetry — a genuinely educational moment most sites can't show.

### 5.3 Crypto
- Same lifecycle framing; settlement path differs. Keep the on-page behavior parallel (subscribe → charge/receive → recover) but don't imply identical settlement to the Nomba rails. Label it clearly as a distinct rail.

### 5.4 Failure reasons (fuller version)
- **Insufficient funds** → payday-timed retry, recovers.
- **Expired card / token** → *no blind retry*; triggers a `card.update_requested` flow, then recovers on update. This teaches the smartest dunning behavior.
- **Hard decline** → fewer retries, faster escalation, ends in involuntary cancel — showing the honest sad path too.

## 6. The sandbox data contract (plan this as a real dependency)

The simulator talks to a **public, rate-limited sandbox endpoint** owned by the platform. Suggested shape (adapt to what the sandbox actually exposes):

- **Start a run:** `POST https://api.nombaone.xyz/v1/sandbox/simulations`
  - body: `{ rail: 'card'|'transfer'|'mandate'|'crypto', failureMode?: 'insufficient_funds'|'expired_card'|'hard_decline', cycles?: number, compressed?: true }`
  - returns: `{ simulationId, stream }` — where `stream` is an SSE/websocket URL, or the client polls.
- **Stream events:** server-sent events, each an object mirroring a real outbound webhook: `{ event, at, cycle?, reason?, rail, data }`. The client renders these verbatim in the console and advances the timeline off the `event` type.
- **Constraints:** rate-limited per IP; runs are ephemeral; no real money, real cards, or PII. Reuse the sandbox test instruments from the integration reference (test cards, test bank) so the events are authentic.
- **Why real:** the entire credibility of the piece rests on these being genuine network calls a developer can inspect. If the sandbox can't be ready at launch, the simulator ships in a clearly-labeled "recorded" mode as a fallback (§8) — but the real contract is the target.

## 7. Motion

- Timeline pills fill and transition with the design-system easing; the active pill has a soft pulse.
- Webhook lines stream in with a quick fade/slide; a blinking cursor implies "listening."
- The **recovery moment** gets a small, earned emphasis — a brief scale-in on the recovered pill and the `payment_recovered` line in emerald. This is the one place a little extra motion is justified because it's the emotional peak.
- All of it respects `prefers-reduced-motion`: reduced mode still runs the logic and shows the states, just without the flourishes. (Catalog: doc 03.)

## 8. Fallbacks & resilience

- **Sandbox unavailable / rate-limited:** fall back to a labeled "recorded run" using canned event streams, with a visible note ("sandbox busy — showing a recorded run"). Never let it look broken.
- **Slow network:** show a lightweight loading state on the timeline; don't block the rest of the page (the simulator lazy-loads and never gates the hero).
- **Mobile:** the timeline stacks vertically, the console shrinks but stays raw; controls wrap. It compacts, it doesn't break.

## 9. Accessibility

- Fully keyboard-operable: rail tabs are a proper tablist; Run/Reset are buttons; focus is visible.
- The webhook console is an `aria-live="polite"` region so screen readers hear events as they arrive (throttled to avoid spam).
- Timeline state changes are announced with concise labels ("Cycle 2 failed", "Cycle 2 recovered"), not just color.
- Reduced motion honored (§7).

## 10. Instrumentation

- Track (privacy-respecting): simulator run started, rail chosen, failure toggled, run completed, "see the docs" click-through. These are your strongest intent signals — a visitor who ran a failure-and-recovery is a hot lead. Feed this into the site's conversion understanding, not a third-party ad tool.

## 11. Reuse

The simulator appears on the **home page** (full stage, §3.3 of doc 01) and can be embedded, in a compacted form, on **/product** and relevant **/guides** articles ("see this exact failure recover" deep-links into the simulator with `failureMode` pre-set). Build it as a self-contained, prop-driven component so those placements are trivial.

Proceed to doc 03 for motion.
