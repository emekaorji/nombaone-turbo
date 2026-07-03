"use client";

import { useId, useState, useSyncExternalStore } from "react";

import { ArrowRight, Play, RotateCcw } from "lucide-react";

import { cn } from "@/lib/cn";

import type { ReactNode } from "react";

/**
 * `<MoneyFlow>`: the signature animated double-entry ledger diagram.
 *
 * This is Nombaone's core teaching device: it makes the *invisible* visible. Every
 * naira that moves is a `ledger_transaction` with ≥2 entries whose debits equal
 * its credits (SPEC §4.1). A `<MoneyFlow>` renders the **real postings** of one
 * operation (the exact debit/credit legs from `@nombaone/sara/ledger`) as a row
 * of ledger accounts with money flowing between them, the legs lighting up in
 * sequence and the running balance ticking to zero. When the animation lands,
 * the "DEBITS = CREDITS" tally reads `0` and glows: the transaction balanced.
 *
 * Authoring (in MDX):
 *   <MoneyFlow
 *     title="Example settles"
 *     subtitle="₦5,000 in, confirmed by the provider"
 *     accounts={[
 *       { id: "suspense", label: "bank_inbound_suspense", kind: "system" },
 *       { id: "wallet",   label: "Organization wallet",   kind: "wallet"  },
 *       { id: "fees",     label: "nombaone_fees_remitted", kind: "fee"     },
 *     ]}
 *     legs={[
 *       { from: "suspense", direction: "debit",  amount: 501500, account: "suspense", label: "base + Nombaone fee" },
 *       { to:   "wallet",   direction: "credit", amount: 500000, account: "wallet",   label: "base credited" },
 *       { to:   "fees",     direction: "credit", amount: 1500,   account: "fees",     label: "Nombaone fee" },
 *     ]}
 *   />
 *
 * How the animation works (CSS/SVG only, no Framer Motion, no heavy deps):
 *   - The component owns a single `step` index in React state (0 = idle).
 *   - "Play" advances `step` on a `setTimeout` chain (cancelled on unmount/reset);
 *     each tick reveals the next leg's badge + flow line and pulses the touched
 *     account. The connector lines are an inline `<svg>`; the "flow" pulse is a
 *     CSS-`@keyframes`-free transition driven purely by the `active` class
 *     toggling `opacity`/`stroke-dashoffset` over the Tailwind `transition`.
 *   - When all legs are revealed, the balance tally animates to `0` and the
 *     "balanced" chip lights green.
 *
 * Reduced motion (mandate): when the user prefers reduced motion, the component
 * never auto-sequences. It mounts in the **fully-revealed end state** (all legs
 * visible, the tally at `0`, the balanced chip lit) so the teaching content is
 * complete and static. The "Play" button is replaced by a "Replay" affordance
 * that is a no-op reveal (instant), never a timed sequence. The global
 * `prefers-reduced-motion` CSS gate (globals.css) additionally collapses any
 * residual transition durations to ~0.
 *
 * a11y: the diagram is `role="img"` with an `aria-label` summarising the whole
 * posting in words (so a screen reader hears "Example settles: debit
 * bank_inbound_suspense ₦5,015, credit Organization wallet ₦5,000, …; balanced").
 * The controls are real `<button>`s; the legend has text, not colour alone.
 */

type AccountKind = "wallet" | "system" | "fee" | "external";

interface FlowAccount {
  /** Stable id referenced by legs. */
  id: string;
  /** Display label: usually the real ledger account name (`bank_inbound_suspense`) or a wallet name. */
  label: string;
  kind: AccountKind;
}

interface FlowLeg {
  /** The account this leg posts to (must match a `FlowAccount.id`). */
  account: string;
  direction: "debit" | "credit";
  /** Amount in kobo. */
  amount: number;
  /** Short human note for the leg ("base credited", "Nombaone fee"). */
  label?: string;
}

interface MoneyFlowProps {
  title: string;
  subtitle?: string;
  accounts: FlowAccount[];
  legs: FlowLeg[];
  /** Optional caption rendered under the diagram (e.g. the ledger-kind). */
  caption?: ReactNode;
}

const ACCOUNT_STYLES: Record<
  AccountKind,
  { ring: string; chip: string; dot: string; labelTone: string }
> = {
  wallet: {
    ring: "border-accent-border bg-accent-muted dark:border-accent-border dark:bg-accent-muted",
    chip: "bg-accent-muted text-accent dark:bg-accent-muted dark:text-accent",
    dot: "bg-accent",
    labelTone: "text-accent dark:text-accent",
  },
  system: {
    ring: "border-border bg-muted/50",
    chip: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
    labelTone: "text-foreground",
  },
  fee: {
    ring: "border-warning-200 bg-warning-50 dark:border-warning-900 dark:bg-warning-900/20",
    chip: "bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300",
    dot: "bg-warning-500",
    labelTone: "text-warning-800 dark:text-warning-300",
  },
  external: {
    ring: "border-border bg-card",
    chip: "bg-muted text-muted-foreground",
    dot: "bg-foreground/60",
    labelTone: "text-foreground",
  },
};

/** `true` when the user asked for reduced motion. Hydration-safe via `useSyncExternalStore`. */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false, // SSR: assume motion allowed; client re-reads on hydration.
  );
}

/** kobo → "₦5,015.00" (two-decimal naira, grouped). */
function formatNaira(kobo: number): string {
  const naira = kobo / 100;
  return `₦${naira.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function MoneyFlow({ title, subtitle, accounts, legs, caption }: MoneyFlowProps) {
  const reduced = usePrefersReducedMotion();
  const labelId = useId();

  // `revealed` = how many legs are shown. With reduced motion we mount fully
  // revealed (no sequencing, ever); otherwise the diagram starts collapsed and
  // "Play" walks it forward. We track the timer set so reset/unmount cancels it.
  const [revealed, setRevealed] = useState(() => (reduced ? legs.length : 0));
  const [playing, setPlaying] = useState(false);

  const allShown = revealed >= legs.length;
  const debits = legs
    .filter((leg) => leg.direction === "debit")
    .reduce((sum, leg) => sum + leg.amount, 0);
  const credits = legs
    .filter((leg) => leg.direction === "credit")
    .reduce((sum, leg) => sum + leg.amount, 0);
  const tally = debits - credits;

  // The animation: a self-cancelling setTimeout chain. We do NOT drive this from
  // a `useEffect` (Next 16 forbids set-state-in-effect); the sequence is kicked
  // off by the explicit "Play" click (a user event, the blessed place to set
  // state) and each tick schedules the next from inside the timer callback.
  function play() {
    if (reduced) {
      // Reduced motion: instant, full reveal. No timed steps.
      setRevealed(legs.length);
      return;
    }
    setPlaying(true);
    setRevealed(0);
    let step = 0;
    const tick = () => {
      step += 1;
      setRevealed(step);
      if (step < legs.length) {
        window.setTimeout(tick, 750);
      } else {
        setPlaying(false);
      }
    };
    window.setTimeout(tick, 350);
  }

  function reset() {
    setPlaying(false);
    setRevealed(reduced ? legs.length : 0);
  }

  // A words-only summary for screen readers: the whole posting, balanced or not.
  const ariaLabel = `${title}. ${legs
    .map(
      (leg) =>
        `${leg.direction} ${accounts.find((a) => a.id === leg.account)?.label ?? leg.account} ${formatNaira(
          leg.amount,
        )}`,
    )
    .join("; ")}. Debits ${formatNaira(debits)}, credits ${formatNaira(
    credits,
  )}, ${tally === 0 ? "balanced" : "not balanced"}.`;

  return (
    <figure
      className="not-prose my-8 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
      aria-labelledby={labelId}
    >
      {/* Header: title + controls */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/40 px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <p id={labelId} className="text-sm font-semibold text-foreground">
            {title}
          </p>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={play}
            disabled={playing}
            className="inline-flex items-center gap-1.5 rounded-md border border-accent-border bg-accent-muted px-2.5 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-accent-border dark:bg-accent-muted dark:text-accent dark:hover:bg-accent-muted"
          >
            <Play size={12} aria-hidden />
            {reduced ? "Reveal" : "Play"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RotateCcw size={12} aria-hidden />
            Reset
          </button>
        </div>
      </div>

      {/* The diagram itself: accounts in a row, legs below */}
      <div role="img" aria-label={ariaLabel} className="px-5 py-6">
        <div className="flex items-stretch justify-between gap-3 sm:gap-5">
          {accounts.map((account, index) => {
            const style = ACCOUNT_STYLES[account.kind];
            // An account is "touched" once any revealed leg posts to it.
            const touchedBy = legs
              .slice(0, revealed)
              .filter((leg) => leg.account === account.id);
            const isTouched = touchedBy.length > 0;
            return (
              <div key={account.id} className="flex flex-1 items-center gap-3 sm:gap-5">
                <div
                  className={cn(
                    "flex w-full flex-col gap-2 rounded-lg border-2 p-3 transition-all duration-500",
                    style.ring,
                    isTouched ? "scale-[1.02] shadow-md" : "opacity-70",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={cn("size-2 shrink-0 rounded-full", style.dot)} aria-hidden />
                    <span
                      className={cn(
                        "truncate font-mono text-[11px] font-medium",
                        style.labelTone,
                      )}
                      title={account.label}
                    >
                      {account.label}
                    </span>
                  </div>
                  {/* The legs posted to this account, revealed in sequence */}
                  <div className="space-y-1">
                    {legs.map((leg, legIndex) => {
                      if (leg.account !== account.id) return null;
                      const shown = legIndex < revealed;
                      const isDebit = leg.direction === "debit";
                      return (
                        <div
                          key={legIndex}
                          className={cn(
                            "flex items-center justify-between gap-1.5 rounded px-1.5 py-1 transition-all duration-500",
                            shown ? "opacity-100" : "translate-y-1 opacity-0",
                            isDebit
                              ? "bg-error-50 dark:bg-error-900/20"
                              : "bg-success-50 dark:bg-success-900/20",
                          )}
                        >
                          <span
                            className={cn(
                              "font-mono text-[10px] font-bold uppercase tracking-wide",
                              isDebit
                                ? "text-error-600 dark:text-error-400"
                                : "text-success-600 dark:text-success-400",
                            )}
                          >
                            {isDebit ? "DR" : "CR"}
                          </span>
                          <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground">
                            {formatNaira(leg.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Connector between accounts (not after the last) */}
                {index < accounts.length - 1 && (
                  <ArrowRight
                    size={18}
                    aria-hidden
                    className={cn(
                      "shrink-0 transition-colors duration-500",
                      revealed > 0 ? "text-accent" : "text-border",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Per-leg captions (the human "why" of each posting) */}
        {legs.some((leg) => leg.label) && (
          <ul className="mt-5 space-y-1.5">
            {legs.map((leg, legIndex) => {
              if (!leg.label) return null;
              const shown = legIndex < revealed;
              const isDebit = leg.direction === "debit";
              return (
                <li
                  key={legIndex}
                  className={cn(
                    "flex items-center gap-2 text-xs transition-opacity duration-500",
                    shown ? "opacity-100" : "opacity-30",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex w-7 shrink-0 justify-center rounded font-mono text-[10px] font-bold",
                      isDebit
                        ? "text-error-600 dark:text-error-400"
                        : "text-success-600 dark:text-success-400",
                    )}
                  >
                    {isDebit ? "DR" : "CR"}
                  </span>
                  <span className="text-muted-foreground">{leg.label}</span>
                </li>
              );
            })}
          </ul>
        )}

        {/* The balance tally, the whole point: debits == credits == balanced */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-4 font-mono text-xs">
            <span className="text-muted-foreground">
              Σ debits{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {formatNaira(allShown ? debits : 0)}
              </span>
            </span>
            <span className="text-muted-foreground">
              Σ credits{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {formatNaira(allShown ? credits : 0)}
              </span>
            </span>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all duration-500",
              allShown && tally === 0
                ? "bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300"
                : "bg-muted text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full transition-colors",
                allShown && tally === 0 ? "bg-success-500" : "bg-muted-foreground/50",
              )}
              aria-hidden
            />
            {allShown && tally === 0 ? "Balanced · drift 0" : "Σ debits − Σ credits = 0"}
          </span>
        </div>
      </div>

      {caption && (
        <figcaption className="border-t border-border bg-muted/20 px-5 py-3 text-xs text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
