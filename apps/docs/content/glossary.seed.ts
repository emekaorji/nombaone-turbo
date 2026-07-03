/**
 * The canonical one-noun-per-concept glossary seed. Checked-in so the docs build
 * (and the Vale anti-synonym rule + the STYLE.md locked vocabulary) has a source
 * of truth even before Phase 03 wires the OpenAPI-derived generator
 * (`scripts/gen-glossary.ts`), which will enrich these with live `schemaRef`s and
 * assert no two schemas map to two names for one concept.
 *
 * `term` is the canonical noun. `aliases` are words we deliberately DO NOT use
 * (the Vale rule flags them). `schemaRef` is the OpenAPI component name a term
 * maps to (for the Phase-08 deep-link `api/<module>#schema-<Name>`).
 */
export interface GlossaryEntry {
  term: string;
  definition: string;
  /** OpenAPI schema this noun maps to (deep-linked from the reference). */
  schemaRef?: string;
  /** The concept page that explains it, if any. */
  conceptSlug?: string;
  /** Words we never use for this concept (the Vale anti-synonym list). */
  aliases?: string[];
}

export const GLOSSARY: GlossaryEntry[] = [
  { term: "organization", definition: "The account that owns everything: keys, customers, plans, and settlement. The developer-facing tenant.", schemaRef: "OrgResponseData", aliases: ["tenant"] },
  { term: "customer", definition: "An end-payer (a subscriber) belonging to an organization.", schemaRef: "CustomerResponseData" },
  { term: "plan", definition: "A named product a customer can subscribe to; holds one or more prices.", schemaRef: "PlanResponseData" },
  { term: "price", definition: "A recurring amount + interval on a plan (e.g. ₦5,000 / month). Immutable once used.", schemaRef: "PriceResponseData" },
  { term: "subscription", definition: "A customer on a price, billed each cycle until canceled.", schemaRef: "SubscriptionResponseData" },
  { term: "cycle", definition: "One billing period of a subscription; each cycle produces one invoice.", conceptSlug: "/concepts/how-billing-works" },
  { term: "invoice", definition: "The amount due for a cycle, its line items, and its payment state.", schemaRef: "InvoiceResponseData" },
  { term: "payment method", definition: "A customer's rail instance: a card, a mandate, or a virtual account.", schemaRef: "PaymentMethodResponseData" },
  { term: "mandate", definition: "Consent to pull from a bank account via direct debit; has its own lifecycle.", schemaRef: "MandateSetupResponseData" },
  { term: "dunning", definition: "The recovery process after a failed charge — retries, holds, and fallbacks tuned for thin balances.", conceptSlug: "/concepts/hard-parts/dunning-for-thin-balances", aliases: ["retry loop"] },
  { term: "coupon", definition: "A reusable discount definition (amount- or percent-off).", schemaRef: "CouponResponseData" },
  { term: "discount", definition: "A coupon applied to a specific customer or subscription.", schemaRef: "DiscountResponseData" },
  { term: "credit grant", definition: "Account credit granted to a customer, consumed oldest-first on invoices.", schemaRef: "CreditGrantResponseData" },
  { term: "settlement", definition: "A verified collection split into the platform fee and the organization's net, settled to its Nomba sub-account.", schemaRef: "SettlementResponseData", conceptSlug: "/concepts/settlement-and-sub-accounts" },
  { term: "sub-account", definition: "The organization's account on Nomba that its net settlement lands in.", conceptSlug: "/concepts/settlement-and-sub-accounts" },
  { term: "refund", definition: "Reversing the organization's leg of a settlement back to the payer (the platform fee is non-refundable).", schemaRef: "RefundResponseData" },
  { term: "payout", definition: "Withdrawing settled funds from the organization's balance to a bank account.", schemaRef: "PayoutResponseData" },
  { term: "escrow", definition: "The recent-settlement lock window during which funds are held before they are withdrawable.", schemaRef: "EscrowResponseData" },
  { term: "webhook", definition: "An HTTPS endpoint the organization registers to receive signed event deliveries.", schemaRef: "WebhookEndpointResponseData", aliases: ["webhook config", "webhook-endpoint"] },
  { term: "event", definition: "A record of something that happened, delivered to matching webhooks at least once.", schemaRef: "DomainEventResponseData" },
  { term: "delivery", definition: "One attempt to POST an event to a webhook endpoint; retried on failure, dead-lettered, replayable.", schemaRef: "WebhookDeliveryResponseData" },
  { term: "idempotency key", definition: "A caller-chosen key on a money-moving request; the same key returns the same result, never a double charge.", aliases: ["idempotent token"] },
  { term: "reference", definition: "A resource's stable public id (`nbo…`), used everywhere that resource is named. One reference per resource.", aliases: ["tx_ref", "flw_ref", "trxref"] },
  { term: "kobo", definition: "The integer minor unit of the naira; ₦1 = 100 kobo. Every amount in the API is integer kobo, and every money field is named `…InKobo`.", conceptSlug: "/concepts/money-is-integer-kobo", aliases: ["naira (as a unit)"] },
];
