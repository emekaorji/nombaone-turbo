import { ERROR_CODE_META, PUBLIC_ERROR_CODES } from "@nombaone/errors";

/**
 * The error "failure museum" (Phase 04). Rendered directly from the API's error
 * registry (`@nombaone/errors` — `ERROR_CODE_META` + `PUBLIC_ERROR_CODES`), so it
 * is provably complete and can never drift: every public code the API answers
 * with has an entry here, anchored by its exact code. The live API emits
 * `docUrl: https://docs.nombaone.com/errors#<CODE>` on every failure, and each
 * entry below sets `id="<CODE>"` so that deep link resolves to the fix.
 *
 * A pure server component — the registry is a static import read at build time.
 */

/** Ordered domain groups; a code is placed by its first matching prefix. */
const FAMILIES: readonly (readonly [string, string])[] = [
  ["CLIENT_", "Request"],
  ["INVALID_CURSOR", "Request"],
  ["API_KEY_", "Authentication"],
  ["AUTH_", "Console authentication"],
  ["ORG_", "Organization & members"],
  ["INVITE_", "Organization & members"],
  ["MEMBER_", "Organization & members"],
  ["IDEMPOTENCY_", "Idempotency"],
  ["RATE_LIMIT_", "Rate limiting & quota"],
  ["QUOTA_", "Rate limiting & quota"],
  ["PLATFORM_", "Platform"],
  ["WEBHOOK_", "Webhooks"],
  ["LEDGER_", "Ledger"],
  ["RECONCILIATION_", "Reconciliation"],
  ["RAIL_", "Payment rails"],
  ["CUSTOMER_", "Customers"],
  ["PLAN_", "Plans & prices"],
  ["PRICE_", "Plans & prices"],
  ["CATALOG_", "Plans & prices"],
  ["PAYMENT_METHOD_", "Payment methods & mandates"],
  ["MANDATE_", "Payment methods & mandates"],
  ["NOMBA_", "Provider (Nomba)"],
  ["SUBSCRIPTION_", "Subscriptions & invoices"],
  ["INVOICE_", "Subscriptions & invoices"],
  ["BILLING_", "Subscriptions & invoices"],
  ["PRORATION_", "Proration, coupons & credits"],
  ["COUPON_", "Proration, coupons & credits"],
  ["DISCOUNT_", "Proration, coupons & credits"],
  ["CREDIT_", "Proration, coupons & credits"],
  ["SETTLEMENT_", "Settlement, refunds & payouts"],
  ["REFUND_", "Settlement, refunds & payouts"],
  ["ESCROW_", "Settlement, refunds & payouts"],
  ["PAYOUT_", "Settlement, refunds & payouts"],
  ["DUNNING_", "Dunning"],
  ["EXAMPLE_", "Example (deletable)"],
  ["SYSTEM_", "System"],
];

function familyFor(code: string): string {
  for (const [prefix, label] of FAMILIES) {
    if (code.startsWith(prefix) || code === prefix) return label;
  }
  return "Other";
}

export function ErrorReference() {
  const codes = Array.from(PUBLIC_ERROR_CODES).sort();

  // Group by family, preserving FAMILIES order.
  const order = new Map(FAMILIES.map(([, label], i) => [label, i]));
  const groups = new Map<string, string[]>();
  for (const code of codes) {
    const fam = familyFor(code);
    (groups.get(fam) ?? groups.set(fam, []).get(fam)!).push(code);
  }
  const sortedGroups = [...groups.entries()].sort(
    (a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999),
  );

  return (
    <div className="not-prose mt-8 space-y-10">
      <p className="text-[16px] leading-7 text-foreground/85">
        Every public error code, straight from the API&rsquo;s registry — so this list is
        complete and never drifts. When a request fails, the response carries the{" "}
        <code className="font-mono text-accent">code</code>, a plain-English{" "}
        <code className="font-mono text-accent">hint</code>, and a{" "}
        <code className="font-mono text-accent">docUrl</code> that links straight to the
        matching entry below. Branch on <code className="font-mono text-accent">error.code</code>,
        never on the message.
      </p>

      {sortedGroups.map(([family, familyCodes]) => (
        <section key={family}>
          <h2 className="mb-4 text-lg font-semibold text-foreground">{family}</h2>
          <dl className="divide-y divide-border border-t border-border">
            {familyCodes.map((code) => (
              <div key={code} id={code} className="scroll-mt-20 py-4">
                <dt className="flex flex-wrap items-center gap-2">
                  <code className="rounded-md border border-accent-border bg-accent-muted px-2 py-0.5 font-mono text-[13px] font-medium text-accent">
                    {code}
                  </code>
                </dt>
                <dd className="mt-2 text-[16px] leading-7 text-foreground/85">
                  {ERROR_CODE_META[code as keyof typeof ERROR_CODE_META]?.hint}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
