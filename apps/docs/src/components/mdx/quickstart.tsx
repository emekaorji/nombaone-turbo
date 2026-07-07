"use client";

import { useId, useState } from "react";

import { ArrowRight, Loader2, Terminal } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/cn";

import { useMounted } from "@/lib/use-client-value";

import { HighlightedCode } from "./highlighted-code";

/**
 * `<Quickstart>`: the home-page hero. Not a generic landing: a branded
 * "zero → first call" path with a genuinely runnable first call. The three
 * stops (key → example → ledger) animate in on mount (reduced-motion-safe), and
 * the "run it" panel fires a real `GET /health` against the sandbox through the
 * docs playground proxy (`/api/playground`): no key required, demo sandbox.
 *
 * a11y: the run button reports its result into a `role="status"` live region;
 * the entrance animation is a CSS opacity/translate that the global
 * `prefers-reduced-motion` rule collapses to nothing. Mount-gated reveal uses
 * `useMounted` (`useSyncExternalStore`); never `setState` in an effect, per the
 * Next-16 `react-hooks/set-state-in-effect` lint rule.
 */

const STOPS = [
  {
    n: "01",
    title: "Grab a sandbox key",
    body: "An nbo_sandbox_ key from the Console. Sandbox money, real shapes.",
  },
  {
    n: "02",
    title: "Create an example",
    body: "POST one example: the worked endpoint that threads the whole money path.",
  },
  {
    n: "03",
    title: "Watch the ledger",
    body: "A balanced double-entry transaction posts; the status derives from it.",
  },
] as const;

type RunState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; code: number; body: string }
  | { status: "error"; message: string };

export function Quickstart() {
  const mounted = useMounted();
  const outputId = useId();
  const [run, setRun] = useState<RunState>({ status: "idle" });

  async function sendHealthCheck() {
    setRun({ status: "loading" });
    try {
      const res = await fetch("/api/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "GET", path: "/health" }),
      });
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // leave raw if upstream returned non-JSON
      }
      setRun({ status: "done", code: res.status, body: pretty });
    } catch {
      setRun({
        status: "error",
        message: "Could not reach the sandbox. Check your connection and try again.",
      });
    }
  }

  return (
    <div className="not-prose my-8">
      {/* Hero band */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-accent-muted via-card to-card p-6 shadow-sm sm:p-8 dark:from-accent-muted dark:via-card dark:to-card">
        {/* Decorative glow, purely cosmetic. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-accent/20 blur-3xl dark:bg-accent/20"
        />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-border bg-accent-muted px-2.5 py-1 font-mono text-[11px] font-medium text-accent dark:border-accent-border dark:bg-accent-muted dark:text-accent">
            <Terminal size={11} aria-hidden />
            Zero → first payment
          </span>
          <h1 className="mt-4 max-w-2xl text-balance text-[34px] font-bold leading-[1.1] tracking-tight text-foreground sm:text-[40px]">
            Move money, not plumbing.
          </h1>
          <p className="mt-3 max-w-xl text-[16px] leading-7 text-foreground/75">
            Wallets, a double-entry ledger, and Nigerian rails behind one typed
            API. Press buttons below. We&apos;ll take the blame if the sandbox
            sulks.
          </p>

          {/* The three stops: animated entrance, reduced-motion-safe. */}
          <ol className="mt-7 grid gap-3 sm:grid-cols-3">
            {STOPS.map((stop, i) => (
              <li
                key={stop.n}
                style={{ transitionDelay: `${i * 90}ms` }}
                className={cn(
                  "rounded-xl border border-border bg-card/80 p-4 backdrop-blur transition-all duration-500",
                  mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
                )}
              >
                <span className="font-mono text-xs font-semibold text-accent dark:text-accent">
                  {stop.n}
                </span>
                <p className="mt-1 text-sm font-semibold text-foreground">{stop.title}</p>
                <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{stop.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/quickstart"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Start the quickstart
              <ArrowRight size={15} aria-hidden />
            </Link>
            <Link
              href="/introduction"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent-border dark:hover:border-accent-border"
            >
              The mental model
            </Link>
          </div>
        </div>
      </div>

      {/* The runnable first call */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="rounded-md bg-success-50 px-2 py-1 font-bold text-success-700 dark:bg-success-900/30 dark:text-success-400">
              GET
            </span>
            <span className="text-foreground">/v1/health</span>
            <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              no key needed
            </span>
          </div>
          <button
            type="button"
            onClick={sendHealthCheck}
            disabled={run.status === "loading"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 dark:bg-accent dark:hover:bg-accent"
          >
            {run.status === "loading" ? (
              <>
                <Loader2 size={13} aria-hidden className="animate-spin" />
                Calling the sandbox…
              </>
            ) : (
              <>Run it against the sandbox</>
            )}
          </button>
        </div>

        <div id={outputId} role="status" aria-live="polite" className="px-4 py-4">
          {run.status === "idle" && (
            <p className="font-mono text-xs leading-6 text-muted-foreground">
              <span className="text-muted-foreground/60">$</span> curl
              https://api.nombaone.xyz/v1/health
              <br />
              <span className="text-muted-foreground/60">↳</span> press{" "}
              <span className="font-semibold text-foreground">Run it</span> to send this
              for real, it&apos;s the one call that needs no auth.
            </p>
          )}
          {run.status === "error" && (
            <p className="text-sm text-error-600 dark:text-error-400">{run.message}</p>
          )}
          {run.status === "done" && (
            <div>
              <p className="mb-2 font-mono text-xs">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 font-semibold",
                    run.code >= 200 && run.code < 300
                      ? "bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-400"
                      : "bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400",
                  )}
                >
                  {run.code}
                </span>{" "}
                <span className="text-muted-foreground">
                  {run.code >= 200 && run.code < 300
                    ? "the rails are up"
                    : "the sandbox replied"}
                </span>
              </p>
              <HighlightedCode code={run.body} lang="json" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
