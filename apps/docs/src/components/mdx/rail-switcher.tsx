"use client";

import { useState } from "react";

/**
 * `<RailSwitcher>` (Phase 08) — one interface, three rails. The core speaks a
 * single "collect for this reference" verb; each rail adapts it. This switcher
 * shows, per rail, how a customer is set up, what "collect" actually means
 * (pull vs push), the endpoint involved, and the one thing that trips people up.
 * A self-contained client leaf — no data fetch, purely illustrative of the
 * push/pull asymmetry.
 */

type RailKey = "card" | "mandate" | "transfer";

const RAILS: Record<
  RailKey,
  {
    label: string;
    kind: "Pull" | "Push";
    setup: string;
    setupEndpoint: string;
    collect: string;
    gotcha: string;
  }
> = {
  card: {
    label: "Card",
    kind: "Pull",
    setup: "The customer authorizes a card; you store the token.",
    setupEndpoint: "POST /v1/payment-methods/setup",
    collect: "On the billing date the engine charges the saved token — it initiates the debit.",
    gotcha:
      "A recurring card charge in Nigeria often triggers a bank OTP/3-D Secure step it can't complete headlessly. The engine recovers by emitting invoice.action_required with a fresh checkout link.",
  },
  mandate: {
    label: "Direct debit",
    kind: "Pull",
    setup: "The customer authorizes a mandate; the bank confirms it asynchronously.",
    setupEndpoint: "POST /v1/payment-methods/setup",
    collect: "On the billing date the engine pulls from the bank account — silently, no per-charge OTP.",
    gotcha:
      "A new mandate is consent_pending until the bank activates it. The engine sweeps pending mandates to active and fires payment_method.updated — you don't poll.",
  },
  transfer: {
    label: "Bank transfer",
    kind: "Push",
    setup: "The engine mints a virtual account for the customer.",
    setupEndpoint: "POST /v1/payment-methods/virtual-account",
    collect:
      "The engine exposes where to pay and waits — the customer sends the money. There is no API call that reaches in and takes it.",
    gotcha:
      "A transfer can under- or over-pay, or arrive with the wrong reference. Settle only on a verified inbound event, never on the raw notification.",
  },
};

const ORDER: RailKey[] = ["card", "mandate", "transfer"];

export function RailSwitcher() {
  const [active, setActive] = useState<RailKey>("card");
  const rail = RAILS[active];

  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border border-border bg-card">
      <div role="tablist" aria-label="Payment rails" className="flex border-b border-border">
        {ORDER.map((key) => {
          const selected = key === active;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(key)}
              className={
                "flex-1 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring " +
                (selected
                  ? "border-b-2 border-[--accent] text-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {RAILS[key].label}
            </button>
          );
        })}
      </div>

      <div className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <span
            className={
              "rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide " +
              (rail.kind === "Pull"
                ? "bg-[--accent]/15 text-[--accent]"
                : "bg-amber-400/15 text-amber-400")
            }
          >
            {rail.kind} rail
          </span>
          <span className="text-sm text-muted-foreground">
            {rail.kind === "Pull" ? "the engine initiates the debit" : "the customer sends the money"}
          </span>
        </div>

        <Row label="Set up">
          {rail.setup}
          <code className="mt-1 block font-mono text-xs text-[--accent]">{rail.setupEndpoint}</code>
        </Row>
        <Row label="What “collect” means">{rail.collect}</Row>
        <Row label="The thing that trips people up">{rail.gotcha}</Row>
      </div>

      <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        The core never learns the rail&apos;s name — it calls one “collect for this reference” verb, and
        each rail adapts it.
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-foreground">{children}</p>
    </div>
  );
}
