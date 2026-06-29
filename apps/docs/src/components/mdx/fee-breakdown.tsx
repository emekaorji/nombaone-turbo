"use client";

import { useId, useMemo, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * `<FeeBreakdown>`: a live, branded visualization of the Nombaone fee model.
 * Drag the slider over `baseAmount` (in naira) and watch
 * `base + nombaoneFee + providerFee = payableAmount` recompute, with each segment of
 * the bar sized to its real share. Makes the clamp formulas tangible.
 *
 * Accuracy: fees are `clamp(min, round(rate × base), max)`, all in kobo (the
 * static defaults; per-org overrides exist but the public docs price off the
 * defaults). The boilerplate ships one deletable domain resource — the
 * `example` — so the sample uses a single generic flow:
 *   • example → nombaone clamp(₦10, 1%, ₦150)   + provider clamp(₦0.50, 0.5%, ₦200)
 *
 * a11y: the slider is a native `<input type="range">` with `aria-valuetext` in
 * naira; the recomputed breakdown is a `role="status"` live region. The bar is
 * decorative. No JS animation, only Tailwind width/colour transitions, already
 * gated by the global `prefers-reduced-motion` rule.
 */

interface FeeSpec {
  /** Floor, in kobo. */
  min: number;
  /** Proportional rate (0.01 = 1%). */
  rate: number;
  /** Ceiling, in kobo. */
  max: number;
}

/** `min(max(min, round(rate × base)), max)`: the real `computeClampedFee`. */
function clamp(spec: FeeSpec, base: number): number {
  return Math.min(Math.max(spec.min, Math.round(spec.rate * base)), spec.max);
}

// ─── The real specs, in kobo ─────────────────────────────────────────────────
const EXAMPLE_NOMBAONE: FeeSpec = { min: 1_000, rate: 0.01, max: 15_000 };
const EXAMPLE_PROVIDER: FeeSpec = { min: 50, rate: 0.005, max: 20_000 };

type Flow = "example";

interface FlowConfig {
  label: string;
  /** Returns the nombaone + provider split for a base amount in kobo. */
  compute: (base: number) => { nombaoneFee: number; providerFee: number };
  /** A one-line description of the clamps, shown under the tabs. */
  formula: string;
  /** Whether the payer pays base + fees (collection) or fees come out of base. */
  payerPays: boolean;
}

const FLOWS: Record<Flow, FlowConfig> = {
  example: {
    label: "Example",
    compute: (base) => ({
      nombaoneFee: clamp(EXAMPLE_NOMBAONE, base),
      providerFee: clamp(EXAMPLE_PROVIDER, base),
    }),
    formula: "nombaone clamp(₦10, 1%, ₦150) + provider clamp(₦0.50, 0.5%, ₦200)",
    payerPays: true,
  },
};

// The slider works in naira for sane stepping; everything else is kobo.
const MIN_NAIRA = 100;
const MAX_NAIRA = 250_000;
const STEP_NAIRA = 100;

/** ₦ formatting from a kobo amount: `150000` → `₦1,500.00`. */
function nairaFromKobo(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function FeeBreakdown({ defaultFlow = "example" }: { defaultFlow?: Flow }) {
  const sliderId = useId();
  const [flow, setFlow] = useState<Flow>(defaultFlow);
  const [naira, setNaira] = useState(15_000);

  const view = useMemo(() => {
    const baseKobo = naira * 100;
    const { nombaoneFee, providerFee } = FLOWS[flow].compute(baseKobo);
    const totalFee = nombaoneFee + providerFee;
    const payableAmount = FLOWS[flow].payerPays ? baseKobo + totalFee : baseKobo;
    // Bar spans the larger of "what the payer pays" or "the base" so segments
    // never overflow 100%.
    const span = Math.max(payableAmount, baseKobo, 1);
    return {
      baseKobo,
      nombaoneFee,
      providerFee,
      totalFee,
      payableAmount,
      pct: {
        base: (baseKobo / span) * 100,
        nombaone: (nombaoneFee / span) * 100,
        provider: (providerFee / span) * 100,
      },
    };
  }, [flow, naira]);

  const config = FLOWS[flow];

  return (
    <div className="not-prose my-6 rounded-xl border border-border bg-card p-5 shadow-sm">
      {/* Flow selector */}
      <div role="tablist" aria-label="Fee flow" className="flex flex-wrap gap-1">
        {(Object.keys(FLOWS) as Flow[]).map((key) => {
          const selected = key === flow;
          return (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => setFlow(key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {FLOWS[key].label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 font-mono text-xs text-muted-foreground">{config.formula}</p>

      {/* Slider */}
      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <label htmlFor={sliderId} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Base amount
          </label>
          <span className="font-mono text-lg font-semibold text-foreground">
            {nairaFromKobo(view.baseKobo)}
          </span>
        </div>
        <input
          id={sliderId}
          type="range"
          min={MIN_NAIRA}
          max={MAX_NAIRA}
          step={STEP_NAIRA}
          value={naira}
          aria-valuetext={`${nairaFromKobo(view.baseKobo)} base`}
          onChange={(event) => setNaira(Number(event.target.value))}
          className="mt-2 w-full accent-purple-600 dark:accent-purple-400"
        />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground/60">
          <span>₦{MIN_NAIRA.toLocaleString()}</span>
          <span>₦{MAX_NAIRA.toLocaleString()}</span>
        </div>
      </div>

      {/* The bar */}
      <div
        aria-hidden
        className="mt-5 flex h-9 w-full overflow-hidden rounded-lg border border-border bg-muted"
      >
        <span
          className="h-full bg-purple-500/80 transition-[width] duration-300"
          style={{ width: `${view.pct.base}%` }}
        />
        {view.nombaoneFee > 0 && (
          <span
            className="h-full bg-magenta-500/80 transition-[width] duration-300"
            style={{ width: `${view.pct.nombaone}%` }}
          />
        )}
        {view.providerFee > 0 && (
          <span
            className="h-full bg-warning-500/80 transition-[width] duration-300"
            style={{ width: `${view.pct.provider}%` }}
          />
        )}
      </div>

      {/* The numbers (live region) */}
      <dl role="status" aria-live="polite" className="mt-4 grid gap-px overflow-hidden rounded-lg border border-border bg-border text-sm">
        <Row swatch="bg-purple-500/80" label="Base amount" value={nairaFromKobo(view.baseKobo)} />
        <Row swatch="bg-magenta-500/80" label="Nombaone fee" value={nairaFromKobo(view.nombaoneFee)} />
        {config.payerPays ? (
          <Row
            swatch="bg-warning-500/80"
            label="Provider fee"
            value={nairaFromKobo(view.providerFee)}
          />
        ) : null}
        <Row label="Total fee" value={nairaFromKobo(view.totalFee)} muted />
        <Row
          label={config.payerPays ? "Payable amount (payer pays)" : "Net to recipient"}
          value={nairaFromKobo(
            config.payerPays ? view.payableAmount : view.baseKobo - view.totalFee,
          )}
          emphasis
        />
      </dl>

      <p className="mt-3 text-xs text-muted-foreground">
        {config.payerPays
          ? "On collection the payer is charged base + fees; your wallet is credited the base."
          : "On disbursement the fee is debited alongside the base from the sending wallet."}{" "}
        All amounts are kobo on the wire.
      </p>
    </div>
  );
}

function Row({
  swatch,
  label,
  value,
  muted,
  emphasis,
}: {
  swatch?: string;
  label: string;
  value: string;
  muted?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 bg-card px-3 py-2",
        emphasis && "bg-purple-50/60 dark:bg-purple-950/40",
      )}
    >
      {swatch ? (
        <span className={cn("size-2.5 shrink-0 rounded-sm", swatch)} aria-hidden />
      ) : (
        <span className="size-2.5 shrink-0" aria-hidden />
      )}
      <dt
        className={cn(
          "flex-1",
          muted ? "text-muted-foreground" : "text-foreground/85",
          emphasis && "font-semibold text-foreground",
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "font-mono tabular-nums",
          emphasis ? "font-semibold text-foreground" : "text-foreground/85",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
