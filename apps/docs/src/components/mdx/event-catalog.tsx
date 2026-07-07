import {
  WEBHOOK_DELIVERY_GUARANTEE,
  WEBHOOK_EVENT_CATALOG,
  type WebhookEventType,
} from "@nombaone/core-contracts/types";

/**
 * The webhook event catalog (Phase 08). Rendered directly from the API's
 * canonical `WEBHOOK_EVENT_CATALOG` (`@nombaone/core-contracts`), so it is
 * provably complete and can never drift: every event the API can emit has an
 * entry here, anchored by its exact type (`id="<event.type>"`) so a deep link
 * like `/webhooks#invoice.paid` resolves. A pure server component — the catalog
 * is a static import read at build time.
 *
 * The `example.*` scaffold events are excluded: they belong to the reference
 * `example` module and are deleted with it, so they are never documented.
 */

type CatalogEntry = { when: string; payload: readonly string[] };

/** Resource groups, in the order a reader meets them, with human titles. */
const GROUPS: { title: string; prefix: string; blurb: string }[] = [
  {
    title: "Subscription",
    prefix: "subscription.",
    blurb: "The lifecycle of a subscription: created, activated, paused, canceled, churned.",
  },
  {
    title: "Invoice",
    prefix: "invoice.",
    blurb: "Each cycle's invoice: finalized, paid, failed, recovered, or needing customer action.",
  },
  {
    title: "Payment method",
    prefix: "payment_method.",
    blurb: "Cards, mandates, and virtual accounts attached to a customer.",
  },
  {
    title: "Settlement",
    prefix: "settlement.",
    blurb: "Money settling to an organization's sub-account, refunds, and payouts.",
  },
  {
    title: "Plan & price",
    prefix: "plan.|price.",
    blurb: "Your catalog of products and their prices.",
  },
  {
    title: "Coupon & discount",
    prefix: "coupon.|discount.",
    blurb: "Discount rules and their application to a customer.",
  },
  {
    title: "Customer",
    prefix: "customer.",
    blurb: "The people you bill.",
  },
];

function matches(type: string, prefix: string): boolean {
  return prefix.split("|").some((p) => type.startsWith(p));
}

function EventRow({ type, entry }: { type: WebhookEventType; entry: CatalogEntry }) {
  return (
    <div id={type} className="scroll-mt-24 border-t border-border py-4 first:border-t-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <code className="rounded-md bg-[--code-bg] px-2 py-0.5 font-mono text-sm font-semibold text-[--accent]">
          {type}
        </code>
        <span className="text-sm text-muted-foreground">Fires when {entry.when}.</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/70">Payload:</span>
        {entry.payload.map((field) => (
          <code key={field} className="rounded bg-muted px-1.5 py-0.5 font-mono">
            {field}
          </code>
        ))}
      </div>
    </div>
  );
}

export function EventCatalog() {
  const entries = Object.entries(WEBHOOK_EVENT_CATALOG) as [WebhookEventType, CatalogEntry][];
  const documented = entries.filter(([type]) => !type.startsWith("example."));

  return (
    <div className="not-prose my-8 space-y-10">
      {GROUPS.map((group) => {
        const rows = documented.filter(([type]) => matches(type, group.prefix));
        if (rows.length === 0) return null;
        return (
          <section key={group.title}>
            <h3 className="text-lg font-semibold text-foreground">{group.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{group.blurb}</p>
            <div className="mt-3 rounded-xl border border-border bg-card px-4">
              {rows.map(([type, entry]) => (
                <EventRow key={type} type={type} entry={entry} />
              ))}
            </div>
          </section>
        );
      })}
      <p className="text-xs text-muted-foreground">
        Delivery guarantee: <strong className="text-foreground">{WEBHOOK_DELIVERY_GUARANTEE}</strong>.
        Every event carries a stable <code className="font-mono">reference</code> and is signed;
        dedupe on the event id.
      </p>
    </div>
  );
}
