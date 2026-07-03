import { cn } from "@/lib/utils";

const RAILS = ["Card", "Bank transfer", "Direct debit", "Crypto"];

// Status timeline pills (D5rg1S Timeline).
const TIMELINE: { label: string; cls: string }[] = [
  { label: "Subscribed", cls: "border border-accent-border bg-accent-muted text-accent" },
  { label: "Cycle 1 ✓", cls: "bg-success-bg text-success" },
  { label: "Cycle 2 · recovered", cls: "bg-success-bg text-success" },
  { label: "Cycle 3", cls: "border border-border bg-surface-2 text-muted-foreground" },
];

// Webhook console lines, one colour per event kind (D5rg1S Console).
const EVENTS: { line: string; tone: string }[] = [
  { line: '{"event":"invoice.created","cycle":2,"amount":1250000}', tone: "text-muted-foreground" },
  {
    line: '{"event":"invoice.payment_failed","reason":"insufficient_funds"}',
    tone: "text-danger",
  },
  { line: '{"event":"dunning.retry_scheduled","at":"payday+1"}', tone: "text-warning" },
  {
    line: '{"event":"invoice.action_required","link":"checkout.nombaone.xyz/…"}',
    tone: "text-info",
  },
  { line: '{"event":"invoice.payment_recovered","cycle":2}', tone: "text-success" },
];

/**
 * Static SimulatorStage skin (.pen D5rg1S, doc-02 resting state). The live,
 * sandbox-backed version and its SSE endpoint are a separate Phase-B piece.
 */
export function SimulatorStage({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-[18px] rounded-[14px] border border-border bg-surface-1 p-6",
        className
      )}
    >
      {/* Top: rail selector + cycle label */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {RAILS.map((rail, i) => (
            <span
              key={rail}
              className={cn(
                "rounded-full px-3.5 py-2 text-[13px] font-medium",
                i === 0
                  ? "border border-accent-border bg-accent-muted text-accent"
                  : "border border-border bg-surface-2 text-muted-foreground"
              )}
            >
              {rail}
            </span>
          ))}
        </div>
        <span className="font-mono text-[11.5px] text-subtle-foreground">1 cycle ≈ 2s</span>
      </div>

      {/* Status timeline */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-[8px] border border-border bg-background px-[18px] py-4">
        {TIMELINE.map((p, i) => (
          <span key={p.label} className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex items-center gap-[7px] rounded-full px-3 py-1.5 text-[12.5px] font-medium",
                p.cls
              )}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {p.label}
            </span>
            {i < TIMELINE.length - 1 ? (
              <span className="text-sm text-subtle-foreground">→</span>
            ) : null}
          </span>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-[8px] bg-accent px-4 py-[9px] text-sm font-medium text-accent-foreground"
        >
          Run simulation
        </button>
        <button
          type="button"
          className="rounded-[8px] border border-border bg-surface-2 px-4 py-[9px] text-sm font-medium text-foreground"
        >
          Simulate insufficient funds
        </button>
        <button type="button" className="rounded-[8px] px-4 py-[9px] text-sm font-medium text-muted-foreground">
          Reset
        </button>
      </div>

      {/* Webhook console */}
      <div className="overflow-hidden rounded-[8px] border border-border bg-surface-2">
        <div className="flex items-center gap-[7px] border-b border-border px-4 py-2.5">
          <span className="size-1.5 rounded-full bg-accent" />
          <span className="font-mono text-[11.5px] text-subtle-foreground">
            outbound webhooks → your endpoint
          </span>
        </div>
        <div className="flex flex-col gap-1.5 overflow-x-auto p-4">
          {EVENTS.map((e) => (
            <p key={e.line} className={cn("whitespace-nowrap font-mono text-[12px]", e.tone)}>
              {e.line}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
