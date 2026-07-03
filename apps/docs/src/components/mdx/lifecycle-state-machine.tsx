"use client";

import { useId, useState } from "react";

import { ArrowRight, Webhook, Zap } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * `<LifecycleStateMachine>`: an interactive state diagram for a money-movement
 * resource. Each `state` is a status the resource can hold (the **exact** literal
 * from `@nombaone/core-contracts`, e.g. the example resource's `pending |
 * settled | failed`). Each `transition` is an edge: what triggers it, and which
 * webhook (if any) fires.
 *
 * Clicking a state focuses it: the diagram highlights the state, lists the
 * transitions *out of* it (the trigger + the webhook event string), and the
 * incoming edges that reach it. The default focus is the resource's initial
 * state, so a reader sees the start of the lifecycle immediately.
 *
 * This is a *static* interactive component (no timers, no auto-advance) so
 * `prefers-reduced-motion` needs no special branch beyond the global CSS gate
 * (the only motion is a colour/opacity transition on focus, which the gate
 * collapses). Keyboard: each state is a real `<button>` in a `role="tablist"`;
 * ←/→ move focus between states, Enter/Space selects. The detail panel is the
 * tab panel. Colour is never the only signal: terminal/initial states carry a
 * text tag, and webhooks are labelled in words.
 *
 * Authoring (in MDX):
 *   <LifecycleStateMachine
 *     resource="example"
 *     states={[
 *       { id: "pending", label: "pending", tone: "active", initial: true,
 *         description: "The example was collected via the rail; the money has not yet been confirmed as moved." },
 *       { id: "settled", label: "settled", tone: "success", terminal: true,
 *         description: "The provider webhook confirmed the movement and the balanced ledger transaction posted." },
 *       { id: "failed",  label: "failed",  tone: "danger",  terminal: true,
 *         description: "The movement did not complete; nothing was recorded against the ledger." },
 *     ]}
 *     transitions={[
 *       { from: "pending", to: "settled", trigger: "Confirmed by the provider webhook, then re-verified", webhook: "example.settled" },
 *       { from: "pending", to: "failed",  trigger: "The provider reported the movement failed", webhook: "example.settled" },
 *     ]}
 *   />
 */

type StateTone = "neutral" | "active" | "success" | "warning" | "danger";

interface LifecycleState {
  id: string;
  /** Display label: the exact status literal. */
  label: string;
  tone: StateTone;
  description: string;
  /** Marks the resource's entry status (shown with an "initial" tag). */
  initial?: boolean;
  /** Marks a terminal status (no outgoing transitions). */
  terminal?: boolean;
}

interface LifecycleTransition {
  from: string;
  to: string;
  /** What causes the transition, in plain words. */
  trigger: string;
  /** The webhook event string that fires on this transition, if any. */
  webhook?: string;
}

interface LifecycleStateMachineProps {
  /** The resource name, e.g. "example", used in the aria-label. */
  resource: string;
  /** Explicit states. Omit to use the built-in preset for `resource`. */
  states?: LifecycleState[];
  /** Explicit transitions. Omit to use the built-in preset for `resource`. */
  transitions?: LifecycleTransition[];
}

/**
 * Canonical lifecycle preset, so `<LifecycleStateMachine resource="example" />`
 * renders without re-declaring the machine. The data is the real status enum
 * (`@nombaone/core-contracts` → `ExampleStatus`) + the webhook each transition
 * fires. The boilerplate ships exactly one deletable domain resource — the
 * `example` — so there is a single preset; add your own as you ship resources.
 */
const RESOURCE_PRESETS: Record<
  string,
  { states: LifecycleState[]; transitions: LifecycleTransition[] }
> = {
  example: {
    states: [
      { id: "pending", label: "pending", tone: "active", initial: true,
        description: "The example was collected via the rail. The money has not yet been confirmed as moved; the status is derived from the ledger, so it stays pending until a balanced transaction posts." },
      { id: "settled", label: "settled", tone: "success", terminal: true,
        description: "The provider confirmed the movement (via webhook, then re-verified) and the balanced double-entry transaction posted to the ledger. This is the terminal success state." },
      { id: "failed", label: "failed", tone: "danger", terminal: true,
        description: "The provider reported the movement did not complete. Nothing was recorded against the ledger; the example rests here." },
    ],
    transitions: [
      { from: "pending", to: "settled", trigger: "Confirmed by the provider webhook then re-verified; a balanced ledger transaction posts", webhook: "example.settled" },
      { from: "pending", to: "failed", trigger: "The provider reports the movement failed; no ledger transaction posts", webhook: "example.settled" },
    ],
  },
};

const TONE_STYLES: Record<
  StateTone,
  { idle: string; active: string; dot: string }
> = {
  neutral: {
    idle: "border-border bg-muted/50 text-foreground hover:border-foreground/30",
    active: "border-foreground bg-foreground/5 text-foreground ring-1 ring-foreground/20",
    dot: "bg-muted-foreground",
  },
  active: {
    idle: "border-accent-border bg-accent-muted text-accent hover:border-accent-border dark:border-accent-border dark:bg-accent-muted dark:text-accent",
    active:
      "border-accent-border bg-accent-muted text-accent ring-2 ring-accent dark:border-accent-border dark:bg-accent-muted dark:text-accent dark:ring-accent",
    dot: "bg-accent",
  },
  success: {
    idle: "border-success-200 bg-success-50 text-success-700 hover:border-success-400 dark:border-success-900 dark:bg-success-900/20 dark:text-success-300",
    active:
      "border-success-500 bg-success-100 text-success-800 ring-2 ring-success-300 dark:border-success-400 dark:bg-success-900/50 dark:text-success-200 dark:ring-success-800",
    dot: "bg-success-500",
  },
  warning: {
    idle: "border-warning-200 bg-warning-50 text-warning-700 hover:border-warning-400 dark:border-warning-900 dark:bg-warning-900/20 dark:text-warning-300",
    active:
      "border-warning-500 bg-warning-100 text-warning-800 ring-2 ring-warning-300 dark:border-warning-400 dark:bg-warning-900/50 dark:text-warning-200 dark:ring-warning-800",
    dot: "bg-warning-500",
  },
  danger: {
    idle: "border-error-200 bg-error-50 text-error-700 hover:border-error-400 dark:border-error-900 dark:bg-error-900/20 dark:text-error-300",
    active:
      "border-error-500 bg-error-100 text-error-800 ring-2 ring-error-300 dark:border-error-400 dark:bg-error-900/50 dark:text-error-200 dark:ring-error-800",
    dot: "bg-error-500",
  },
};

export function LifecycleStateMachine({
  resource,
  states: statesProp,
  transitions: transitionsProp,
}: LifecycleStateMachineProps) {
  // Explicit props win; otherwise fall back to the canonical preset for `resource`.
  const preset = RESOURCE_PRESETS[resource];
  const states = statesProp ?? preset?.states ?? [];
  const transitions = transitionsProp ?? preset?.transitions ?? [];

  const baseId = useId();
  const initialId = states.find((state) => state.initial)?.id ?? states[0]?.id ?? "";
  const [focused, setFocused] = useState(initialId);

  const focusedState = states.find((state) => state.id === focused) ?? states[0];
  const outgoing = transitions.filter((edge) => edge.from === focused);
  const incoming = transitions.filter((edge) => edge.to === focused);

  function labelFor(id: string): string {
    return states.find((state) => state.id === id)?.label ?? id;
  }

  // Keyboard roving focus across the state buttons.
  function onKey(event: React.KeyboardEvent, index: number) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      setFocused(states[(index + 1) % states.length].id);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      setFocused(states[(index - 1 + states.length) % states.length].id);
    }
  }

  return (
    <div
      className="not-prose my-8 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
      aria-label={`${resource} lifecycle state machine`}
    >
      {/* The state rail: click any status to focus it */}
      <div
        role="tablist"
        aria-label={`${resource} states`}
        aria-orientation="horizontal"
        className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-5 py-4"
      >
        {states.map((state, index) => {
          const style = TONE_STYLES[state.tone];
          const isActive = state.id === focused;
          return (
            <div key={state.id} className="flex items-center gap-2">
              <button
                type="button"
                role="tab"
                id={`${baseId}-tab-${state.id}`}
                aria-selected={isActive}
                aria-controls={`${baseId}-panel`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setFocused(state.id)}
                onKeyDown={(event) => onKey(event, index)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive ? style.active : style.idle,
                )}
              >
                <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden />
                {state.label}
                {state.initial && (
                  <span className="ml-1 rounded bg-background/60 px-1 text-[9px] uppercase tracking-wide opacity-70">
                    start
                  </span>
                )}
                {state.terminal && (
                  <span className="ml-1 rounded bg-background/60 px-1 text-[9px] uppercase tracking-wide opacity-70">
                    final
                  </span>
                )}
              </button>
              {index < states.length - 1 && (
                <ArrowRight size={14} aria-hidden className="text-muted-foreground/40" />
              )}
            </div>
          );
        })}
      </div>

      {/* The detail panel for the focused state */}
      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${focused}`}
        className="px-5 py-5"
      >
        <div className="flex items-baseline gap-2">
          <code className="font-mono text-sm font-semibold text-foreground">
            {focusedState?.label}
          </code>
          {focusedState?.initial && (
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              entry status
            </span>
          )}
          {focusedState?.terminal && (
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              terminal status
            </span>
          )}
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {focusedState?.description}
        </p>

        {/* Outgoing transitions: triggers + webhooks */}
        {outgoing.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Transitions out
            </p>
            <ul className="mt-2 space-y-2.5">
              {outgoing.map((edge, index) => (
                <li
                  key={index}
                  className="rounded-lg border border-border bg-muted/30 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
                    <code className="rounded bg-background px-1.5 py-0.5 text-foreground">
                      {labelFor(edge.from)}
                    </code>
                    <ArrowRight size={13} aria-hidden className="text-accent" />
                    <code className="rounded bg-background px-1.5 py-0.5 text-foreground">
                      {labelFor(edge.to)}
                    </code>
                  </div>
                  <p className="mt-2 flex items-start gap-1.5 text-[13px] leading-relaxed text-foreground/85">
                    <Zap size={13} aria-hidden className="mt-0.5 shrink-0 text-warning-500" />
                    <span>{edge.trigger}</span>
                  </p>
                  {edge.webhook && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[13px]">
                      <Webhook size={13} aria-hidden className="shrink-0 text-accent" />
                      <span className="text-muted-foreground">fires</span>
                      <code className="rounded bg-accent-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-accent dark:bg-accent-muted dark:text-accent">
                        {edge.webhook}
                      </code>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {outgoing.length === 0 && (
          <p className="mt-5 rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
            No transitions out. <code className="font-mono">{focusedState?.label}</code> is a
            terminal status. The resource rests here.
          </p>
        )}

        {/* Incoming edges: how you arrive here */}
        {incoming.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Reached from
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {incoming.map((edge, index) => (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => setFocused(edge.from)}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {labelFor(edge.from)}
                    <ArrowRight size={11} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
