"use client";

import { useState } from "react";

/**
 * `<MoneyUnit>` (Phase 07) — the kobo converter + 100×-trap linter. The reader
 * types a naira amount and sees the exact integer kobo to send, formatted both
 * ways, with a live warning if they'd send the naira figure where kobo is
 * expected. A pure client-side teaching aid — it computes `naira × 100`, the one
 * rule that prevents a 100× overcharge. Nothing is sent anywhere.
 */

const nairaFmt = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
});

export function MoneyUnit() {
  const [naira, setNaira] = useState("2500");

  const nairaNum = Number(naira);
  const valid = naira.trim() !== "" && Number.isFinite(nairaNum) && nairaNum >= 0;
  const kobo = valid ? Math.round(nairaNum * 100) : 0;

  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border bg-muted/40 px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Kobo converter
        </p>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
            You want to charge (naira)
          </span>
          <div className="flex items-center rounded-lg border border-border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
            <span className="mr-1.5 text-muted-foreground">₦</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={naira}
              onChange={(e) => setNaira(e.target.value)}
              aria-label="Amount in naira"
              className="w-full bg-transparent text-lg font-medium text-foreground outline-none"
            />
          </div>
        </label>

        <div className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Send this integer (kobo)
          </span>
          <div className="flex items-center justify-between rounded-lg border border-[--accent]/40 bg-[--accent]/5 px-3 py-2">
            <code className="font-mono text-lg font-semibold text-[--accent]">
              {valid ? kobo : ""}
            </code>
            <span className="text-xs text-muted-foreground">
              {valid ? nairaFmt.format(nairaNum) : ""}
            </span>
          </div>
        </div>
      </div>

      {valid && (
        <div className="border-t border-border px-4 py-3 text-sm">
          <p className="text-foreground">
            Send <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[--accent]">{kobo}</code>,
            not <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{naira}</code>.
          </p>
          <p className="mt-1 text-muted-foreground">
            If you sent{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{valid ? nairaNum : 0}</code>{" "}
            where kobo is expected, you&apos;d charge{" "}
            <strong className="text-foreground">{nairaFmt.format(nairaNum / 100)}</strong>, 100× too
            little. The name ends in <code className="font-mono">InKobo</code> so the unit is never in
            doubt.
          </p>
        </div>
      )}
    </div>
  );
}
