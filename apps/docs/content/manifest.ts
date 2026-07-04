/**
 * The sidebar / navigation manifest, the single, explicit source of truth for
 * doc ordering and grouping. Nav order is intentional, not derived from the
 * filesystem: a page only appears in the sidebar if it is listed here, in the
 * order listed here.
 *
 * Each `slug` is the URL path under docs.nombaone.xyz (leading slash, no
 * extension); `''` is the home page. The matching MDX file is resolved by the
 * content layer (`src/lib/content.ts`) as `content/<slug>.mdx` (or
 * `content/index.mdx` for home). Pages whose `.mdx` is not yet authored are
 * fine: they render a stub until content lands (P1+).
 *
 * API resources can nest their per-operation pages under `children`; a resource
 * row links to its overview and discloses the operation pages beneath it. The
 * helpers below (`FLAT_NAV`, `findSection`, `findParentResource`) recurse so the
 * pager, slug validation, and the sidebar all treat children as first-class.
 */

export type Badge = "new" | "beta" | "updated";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Diátaxis mode of a section (never mixed within one section). */
export type DiataxisMode = "tutorial" | "how-to" | "reference" | "explanation";

export interface ManifestItem {
  /** URL path, leading slash, no extension. `''` for home. */
  slug: string;
  /** Sidebar label. */
  title: string;
  /** Optional pill rendered next to the label. */
  badge?: Badge;
  /** One-line summary (section-landing cards + search snippet + `<meta>`). */
  summary?: string;
  /** HTTP method, for API operation rows (renders a method chip). */
  method?: HttpMethod;
  /** Per-operation child pages, for an API resource row. */
  children?: ManifestItem[];
}

export interface ManifestSection {
  /** Section heading shown in the sidebar (uppercased by the chrome). */
  title: string;
  /** Stable key for React lists + collapse state. */
  key: string;
  /** `"api"` rows get tighter density and the API-section treatment. */
  kind?: "docs" | "api";
  /** Diátaxis mode — the section's single active reader-need (never mixed). */
  mode?: DiataxisMode;
  items: ManifestItem[];
}

/**
 * The home page sits outside the grouped sections (it has no section header in
 * the rail) but is still part of the routable tree.
 */
export const HOME: ManifestItem = { slug: "", title: "Home" };

/**
 * The full Diátaxis information architecture (docs-plan-02 §5). Order is
 * intentional. Pages whose `.mdx` is not yet authored render a "coming soon"
 * stub (content layer) until their owning phase writes the body — so the whole
 * map is navigable now and no route 404s.
 */
export const MANIFEST: ManifestSection[] = [
  {
    title: "Get started",
    key: "get-started",
    mode: "tutorial",
    items: [
      {
        slug: "/getting-started/quickstart",
        title: "Quickstart",
        badge: "new",
        summary: "Get a sandbox key and reach your first real subscription in minutes.",
        children: [
          { slug: "/getting-started/quickstart/node", title: "Node.js" },
          { slug: "/getting-started/quickstart/nextjs", title: "Next.js" },
          { slug: "/getting-started/quickstart/python", title: "Python" },
          { slug: "/getting-started/quickstart/go", title: "Go" },
          { slug: "/getting-started/quickstart/php", title: "PHP" },
          { slug: "/getting-started/quickstart/ruby", title: "Ruby" },
          { slug: "/getting-started/quickstart/curl", title: "cURL" },
        ],
      },
      { slug: "/getting-started/authentication", title: "Authentication", summary: "The per-organization nbo_sandbox_ / nbo_live_ secret key, and how it works." },
      { slug: "/getting-started/environments", title: "Environments", summary: "The two axes: deployment environment vs account mode, and how a key pins every request to sandbox or live." },
      { slug: "/getting-started/your-first-subscription", title: "Your first subscription", summary: "Create a plan, a price, and a subscription that bills — end to end." },
      { slug: "/getting-started/verify-in-your-devtools", title: "Verify us in your devtools", summary: "Fire a real signed webhook and watch it land in your own logs." },
    ],
  },
  {
    title: "Guides",
    key: "guides",
    mode: "how-to",
    items: [
      { slug: "/guides/create-plans-and-prices", title: "Create plans and prices", summary: "Model your pricing: plans, prices, intervals, and trials." },
      { slug: "/guides/start-a-subscription", title: "Start a subscription", summary: "Subscribe a customer on any rail — card, direct debit, transfer." },
      { slug: "/guides/handle-webhooks", title: "Handle webhooks", summary: "Receive, verify, and dedupe events; keep one correct balance." },
      { slug: "/guides/dunning-and-recovery", title: "Dunning and recovery", summary: "Recover a failed charge on a thin balance — the Nigerian way." },
      { slug: "/guides/refunds-payouts-settlement", title: "Refunds, payouts & settlement", summary: "Move money back out: refunds, escrow, and payouts to a bank." },
      { slug: "/guides/proration-and-plan-changes", title: "Proration and plan changes", summary: "Upgrade, downgrade, and switch intervals mid-cycle, correctly." },
      { slug: "/guides/coupons-and-credits", title: "Coupons and credits", summary: "Discounts, credit grants, and how they resolve on an invoice." },
      { slug: "/guides/going-live", title: "Going live", summary: "The checklist to move from a sandbox key to real money." },
    ],
  },
  {
    title: "Concepts",
    key: "concepts",
    mode: "explanation",
    items: [
      { slug: "/concepts/how-billing-works", title: "How billing works", summary: "Cycles, invoices, collection, and the state machine underneath." },
      { slug: "/concepts/money-is-integer-kobo", title: "Money is integer kobo", summary: "Why every amount is integer kobo, and the 100× naira trap." },
      { slug: "/concepts/the-ledger", title: "The double-entry ledger", summary: "The source of truth: every leg of every movement, debits and credits." },
      { slug: "/concepts/multi-rail-push-and-pull", title: "Multi-rail: push and pull", summary: "Card and mandate pull; transfer pushes. Why the asymmetry matters." },
      { slug: "/concepts/settlement-and-sub-accounts", title: "Settlement & sub-accounts", summary: "How a collection splits and settles to a merchant's Nomba sub-account." },
      {
        slug: "/concepts/hard-parts",
        title: "The hard parts",
        summary: "The truths most payments docs hide — told in the open, each runnable.",
        children: [
          { slug: "/concepts/hard-parts/the-double-charge-bug", title: "The double-charge trap", badge: "new" },
          { slug: "/concepts/hard-parts/dunning-for-thin-balances", title: "Dunning for thin balances" },
          { slug: "/concepts/hard-parts/bank-transfer-is-not-just-another-method", title: "Bank transfer isn't a 'method'" },
          { slug: "/concepts/hard-parts/card-tokens-expire", title: "Card tokens expire" },
          { slug: "/concepts/hard-parts/when-a-transfer-does-not-match-the-invoice", title: "When a transfer doesn't match the invoice" },
          { slug: "/concepts/hard-parts/retry-the-webhook-is-not-retry-the-charge", title: "Retrying the webhook ≠ retrying the charge" },
          { slug: "/concepts/hard-parts/mandates-and-consent", title: "Mandates and consent" },
          { slug: "/concepts/hard-parts/proration-is-a-ledger-problem", title: "Proration is a ledger problem" },
          { slug: "/concepts/hard-parts/the-end-of-month-billing-trap", title: "The end-of-month billing trap" },
          { slug: "/concepts/hard-parts/voluntary-vs-involuntary-churn", title: "Voluntary vs involuntary churn" },
          { slug: "/concepts/hard-parts/settlement-without-spreadsheets", title: "Settlement without spreadsheets" },
          { slug: "/concepts/hard-parts/scheduler-that-survives-a-crash", title: "A scheduler that survives a crash" },
          { slug: "/concepts/hard-parts/isolation-is-a-data-model-property", title: "Isolation is a data-model property" },
          { slug: "/concepts/hard-parts/what-to-check-before-you-trust-a-billing-layer", title: "What to check before you trust a billing layer" },
        ],
      },
    ],
  },
  {
    title: "API reference",
    key: "api",
    kind: "api",
    mode: "reference",
    items: [
      { slug: "/reference/glossary", title: "Glossary", summary: "One word, one meaning — the canonical vocabulary." },
      { slug: "/reference/customers", title: "Customers", summary: "Create and manage customers, credit, and discounts." },
      { slug: "/reference/plans", title: "Plans", summary: "Product plans and their lifecycle." },
      { slug: "/reference/prices", title: "Prices", summary: "Recurring prices, intervals, and versioning." },
      { slug: "/reference/subscriptions", title: "Subscriptions", summary: "The engine's lifecycle surface." },
      { slug: "/reference/payment-methods", title: "Payment methods", summary: "Cards, mandates, and virtual accounts." },
      { slug: "/reference/mandates", title: "Mandates", summary: "Direct-debit consent and status." },
      { slug: "/reference/invoices", title: "Invoices", summary: "Generated invoices and their state." },
      { slug: "/reference/coupons", title: "Coupons", summary: "Discount definitions." },
      { slug: "/reference/credits", title: "Credits", summary: "Customer credit grants and balance." },
      { slug: "/reference/dunning", title: "Dunning", summary: "Recovery attempts and state." },
      { slug: "/reference/settlements", title: "Settlements", summary: "Refunds, payouts, and escrow." },
      { slug: "/reference/webhooks", title: "Webhook endpoints", summary: "Register, rotate, and inspect endpoints + deliveries." },
      { slug: "/reference/events", title: "Events", summary: "The domain-event stream + catalog." },
      { slug: "/reference/organization", title: "Organization", summary: "Your organization config + billing settings." },
      { slug: "/reference/metrics", title: "Metrics", summary: "Billing metrics: MRR, churn, dunning funnel." },
      { slug: "/reference/examples", title: "Example", method: "POST", summary: "The deletable worked example (removed with the scaffold)." },
    ],
  },
  {
    title: "Webhooks",
    key: "webhooks",
    mode: "reference",
    items: [
      { slug: "/webhooks/overview", title: "Overview", summary: "How outbound events reach your endpoints." },
      { slug: "/webhooks/event-catalog", title: "Event catalog", summary: "Every event type, when it fires, and its payload." },
      { slug: "/webhooks/signing-and-verification", title: "Signing & verification", summary: "Verify a delivery's signature and timestamp." },
      { slug: "/webhooks/retries-and-replay", title: "Retries & replay", summary: "The retry cadence, dead-letters, and replay." },
      { slug: "/webhooks/delivery-guarantee", title: "Delivery guarantee", summary: "At least once, deduped on event id — never exactly once." },
      { slug: "/webhooks/simulate", title: "Simulate an event", badge: "new", summary: "Fire a real signed event to your endpoint on demand (sandbox)." },
    ],
  },
  {
    title: "Errors",
    key: "errors",
    mode: "reference",
    items: [
      { slug: "/errors", title: "Error reference", summary: "Every error code, what triggers it, and exactly how to fix it." },
    ],
  },
  {
    title: "Sandbox toolkit",
    key: "sandbox-toolkit",
    mode: "reference",
    items: [
      { slug: "/sandbox-toolkit/overview", title: "Overview", summary: "Drive the engine deterministically — no real card, no cron wait." },
      { slug: "/sandbox-toolkit/payment-methods", title: "Sandbox payment methods", summary: "Deterministic success / decline / OTP methods." },
      { slug: "/sandbox-toolkit/clock", title: "The sandbox clock", summary: "Advance a subscription's next cycle on demand." },
      { slug: "/sandbox-toolkit/simulate-webhooks", title: "Simulate webhooks", summary: "Emit and deliver any catalog event on demand." },
    ],
  },
  {
    title: "Changelog",
    key: "changelog",
    mode: "reference",
    items: [{ slug: "/changelog", title: "Changelog", summary: "Every API change, dated, with migration notes." }],
  },
  {
    title: "Migrate",
    key: "migrate",
    mode: "how-to",
    items: [
      { slug: "/migrate/overview", title: "Overview", summary: "Move to Nomba One from another processor." },
      { slug: "/migrate/from-paystack", title: "Coming from Paystack", summary: "Map Paystack's subscription gotchas to our clean equivalents." },
      { slug: "/migrate/from-stripe", title: "Coming from Stripe Billing", summary: "Move a Stripe Billing integration to Nomba One." },
      { slug: "/migrate/from-flutterwave", title: "Coming from Flutterwave", summary: "Map Flutterwave's tx_ref/flw_ref tangle to one reference." },
      { slug: "/migrate/generic", title: "From any processor", summary: "A zero-downtime parallel-run playbook." },
    ],
  },
  {
    title: "For agents",
    key: "agents",
    mode: "reference",
    items: [
      { slug: "/agents", title: "Agent-native docs", summary: "llms.txt, a Markdown mirror of every page, and one-click copy-to-AI." },
    ],
  },
  {
    title: "For merchants",
    key: "merchants",
    mode: "how-to",
    items: [
      { slug: "/merchants/overview", title: "Overview", summary: "Run subscriptions without an engineer." },
      { slug: "/merchants/create-a-plan", title: "Create a plan", summary: "Set up a plan and price from the console." },
      { slug: "/merchants/share-a-payment-link", title: "Share a payment link", summary: "Collect a subscription with a link — no code." },
      { slug: "/merchants/set-up-dunning-messages", title: "Set up dunning messages", summary: "What your customer sees when a charge fails." },
      { slug: "/merchants/read-a-settlement", title: "Read a settlement", summary: "Understand a payout and where your money is." },
    ],
  },
];

/** Depth-first flatten of an item and its children (parent before children). */
function flattenItem(item: ManifestItem): ManifestItem[] {
  return item.children
    ? [item, ...item.children.flatMap(flattenItem)]
    : [item];
}

/**
 * Flattened, ordered list of every routable page (home first, then each
 * section in manifest order, children inlined after their parent). Drives
 * prev/next paging and slug validation.
 */
export const FLAT_NAV: ManifestItem[] = [
  HOME,
  ...MANIFEST.flatMap((section) => section.items.flatMap(flattenItem)),
];

/** All routable slugs (`''` for home), in nav order. */
export const ALL_SLUGS: string[] = FLAT_NAV.map((item) => item.slug);

/**
 * The single `kind: "api"` section (the API reference), if present. The sidebar
 * renders it in its own "API Reference" view, flattened so each resource is a
 * top-level group.
 */
export const API_SECTION: ManifestSection | undefined = MANIFEST.find(
  (section) => section.kind === "api",
);

/**
 * Every non-API section (Getting started, Core concepts, Guides, References).
 * The sidebar renders these in the "Docs" view.
 */
export const DOCS_SECTIONS: ManifestSection[] = MANIFEST.filter(
  (section) => section.kind !== "api",
);

/** Look up a manifest item (label/badge) by slug. */
export function findNavItem(slug: string): ManifestItem | undefined {
  return FLAT_NAV.find((item) => item.slug === slug);
}

/** The section a slug belongs to, if any (home has none). Searches children. */
export function findSection(slug: string): ManifestSection | undefined {
  return MANIFEST.find((section) =>
    section.items.flatMap(flattenItem).some((item) => item.slug === slug),
  );
}

/**
 * The parent resource row for a slug, if the slug is one of its children. The
 * resource itself returns itself, so the sidebar can auto-open the disclosure
 * when the active path is the resource or any of its operation pages.
 */
export function findParentResource(slug: string): ManifestItem | undefined {
  for (const section of MANIFEST) {
    for (const item of section.items) {
      if (!item.children) continue;
      if (item.slug === slug || item.children.some((child) => child.slug === slug)) {
        return item;
      }
    }
  }
  return undefined;
}

/** Previous / next page in nav order, for the pager. */
export function siblings(slug: string): {
  prev: ManifestItem | null;
  next: ManifestItem | null;
} {
  const index = FLAT_NAV.findIndex((item) => item.slug === slug);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? FLAT_NAV[index - 1] : null,
    next: index < FLAT_NAV.length - 1 ? FLAT_NAV[index + 1] : null,
  };
}
