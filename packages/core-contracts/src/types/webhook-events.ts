/**
 * ── The frozen outbound event catalog (C.6, rubric G1/G7) ────────────────────
 *
 * The SINGLE source of truth for every event type nombaone emits to tenants.
 * Producers reference `WEBHOOK_EVENT_TYPES.*` instead of bare strings, so an
 * undocumented event cannot ship (a `satisfies WebhookEventType` at the emit site
 * fails to compile). 09 renders this registry into the public OpenAPI + docs.
 *
 * Each entry has a `type`, a one-line `when` (the producing transition), and a
 * `payload` **shape descriptor** (the keys the `data` object carries — mirroring
 * what the producer wrote to `domain_events.payload`). The signed delivery body is
 * `{ id, type, event: { id, type, createdAt }, data }` (see the webhook docs).
 */
export const WEBHOOK_EVENT_CATALOG = {
  'customer.created': { when: 'a customer is created', payload: ['reference'] },

  'plan.created': { when: 'a plan is created', payload: ['reference'] },
  'plan.updated': { when: 'a plan is updated or archived', payload: ['reference'] },

  'subscription.created': { when: 'a subscription is created', payload: ['reference', 'status'] },
  'subscription.updated': {
    when: 'a subscription changes (plan/quantity/metadata/proration/past_due)',
    payload: ['reference'],
  },
  'subscription.trial_will_end': {
    when: 'a trialing subscription nears its trial end (lifecycle sweep)',
    payload: ['reference'],
  },
  'subscription.activated': {
    when: 'a subscription becomes active (first charge / recovery / resume)',
    payload: ['reference'],
  },
  'subscription.paused': { when: 'a subscription is paused', payload: ['reference'] },
  'subscription.resumed': { when: 'a paused subscription resumes', payload: ['reference'] },
  'subscription.canceled': {
    when: 'a subscription is canceled (voluntary)',
    payload: ['reference'],
  },
  'subscription.churned': {
    when: 'a subscription is canceled involuntarily (dunning exhausted)',
    payload: ['reference'],
  },

  'invoice.created': { when: 'an invoice is created for a period', payload: ['reference'] },
  'invoice.finalized': { when: 'an invoice is finalized (amounts locked)', payload: ['reference'] },
  'invoice.paid': { when: 'an invoice is fully paid', payload: ['reference'] },
  'invoice.payment_failed': {
    when: 'a collection attempt failed (dunning begins)',
    payload: ['reference', 'reason'],
  },
  'invoice.payment_partially_collected': {
    when: 'a short collection banked part of the amount (partial collection on)',
    payload: ['reference', 'amountPaid', 'amountRemaining'],
  },
  'invoice.payment_recovered': {
    when: 'a dunning retry recovered a past_due invoice',
    payload: ['reference'],
  },
  'invoice.voided': { when: 'an invoice is voided', payload: ['reference'] },

  'payment_method.attached': {
    when: 'a payment method is attached (card/mandate/virtual account)',
    payload: ['reference', 'kind', 'status'],
  },
  'payment_method.updated': {
    when: 'the subscription payment method is swapped (card update)',
    payload: ['reference', 'subscription'],
  },
  'payment_method.expiring': {
    when: 'a card is expiring / a card update is required (proactive or dunning)',
    payload: ['reference', 'reason'],
  },

  'settlement.created': {
    when: 'collected funds are settled to the tenant sub-account (08)',
    payload: ['reference'],
  },
} as const;

export type WebhookEventType = keyof typeof WEBHOOK_EVENT_CATALOG;

/** Frozen list form (for `GET /v1/events` filter validation + docs rendering). */
export const WEBHOOK_EVENT_TYPES = Object.keys(WEBHOOK_EVENT_CATALOG) as WebhookEventType[];

/** The explicit, stated delivery guarantee (G5). Not exactly-once. */
export const WEBHOOK_DELIVERY_GUARANTEE = 'at-least-once' as const;

/** The header name carrying that guarantee on every outbound POST (G5). */
export const WEBHOOK_DELIVERY_GUARANTEE_HEADER = 'x-nombaone-delivery-guarantee';
