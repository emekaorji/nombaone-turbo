/**
 * ── Response `data` schemas for the OpenAPI document (item 1) ────────────────
 *
 * OpenAPI 3 schema objects mirroring the response DTOs in `@nombaone/core-contracts`.
 * `RESPONSE_SCHEMAS` are registered under `components.schemas`; `RESPONSE_DATA_BY_ROUTE`
 * maps a route (`"<method> <specPath>"`) to the schema its `data` carries (and whether
 * that `data` is a paginated array). A route with no mapping still advertises the typed
 * success envelope with a generic `data` object.
 *
 * These are kept hand-mirrored (not generated) because the DTOs are plain TS interfaces;
 * the conformance e2e round-trips a live response against the advertised schema so drift
 * is caught in CI.
 *
 * Enum VALUES, though, are imported rather than re-typed wherever a shared list exists —
 * a hand-copied `enum: [...]` is exactly the kind of compiler-invisible surface that
 * survives a green type-check while lying to every SDK generated from this document.
 */
import { PRICE_INTERVALS } from '@nombaone/core-contracts/billing';

type JsonSchema = Record<string, unknown>;

const str = (): JsonSchema => ({ type: 'string' });
const nstr = (): JsonSchema => ({ type: 'string', nullable: true });
const int = (): JsonSchema => ({ type: 'integer' });
const nint = (): JsonSchema => ({ type: 'integer', nullable: true });
const num = (): JsonSchema => ({ type: 'number' });
const bool = (): JsonSchema => ({ type: 'boolean' });
const dt = (): JsonSchema => ({ type: 'string', format: 'date-time' });
const ndt = (): JsonSchema => ({ type: 'string', format: 'date-time', nullable: true });
const enm = (...values: string[]): JsonSchema => ({ type: 'string', enum: values });
const nenm = (...values: string[]): JsonSchema => ({ type: 'string', enum: values, nullable: true });
const bag = (): JsonSchema => ({ type: 'object', additionalProperties: true });
const ref = (name: string): JsonSchema => ({ $ref: `#/components/schemas/${name}` });
const arr = (items: JsonSchema): JsonSchema => ({ type: 'array', items });
const modeEnm = (): JsonSchema => enm('sandbox', 'live');
const ngn = (): JsonSchema => ({ type: 'string', enum: ['NGN'] });

const obj = (properties: Record<string, JsonSchema>, required: string[]): JsonSchema => ({
  type: 'object',
  properties,
  required,
});
/** All keys are required unless listed in `optional`. */
const allRequired = (properties: Record<string, JsonSchema>, optional: string[] = []): JsonSchema =>
  obj(properties, Object.keys(properties).filter((k) => !optional.includes(k)));

/** Shared by `Plan` and `PlanWithPrices` — the plan create's response is a plan PLUS
 *  the prices embedded in the same call, and a field added here must reach both. */
const PLAN_PROPERTIES: Record<string, JsonSchema> = {
  domain: enm('plan'),
  id: str(),
  name: str(),
  description: nstr(),
  status: enm('active', 'archived'),
  metadata: bag(),
  mode: modeEnm(),
  createdAt: dt(),
  updatedAt: dt(),
};

export const RESPONSE_SCHEMAS: Record<string, JsonSchema> = {
  Customer: allRequired({
    domain: enm('customer'),
    id: str(),
    email: str(),
    name: str(),
    phone: nstr(),
    metadata: bag(),
    mode: modeEnm(),
    createdAt: dt(),
    updatedAt: dt(),
  }),

  Plan: allRequired(PLAN_PROPERTIES),

  // The plan WRITES — `POST /v1/plans` and `PATCH /v1/plans/{id}`. `prices` is ALWAYS on the
  // wire (`[]` when the plan has none): on create, the embedded rows in submission order; on
  // update, the plan's ACTIVE prices after the reconcile. The plan READS return `Plan`, which
  // does not carry it.
  PlanWithPrices: allRequired({ ...PLAN_PROPERTIES, prices: arr(ref('Price')) }),

  Price: allRequired({
    domain: enm('price'),
    id: str(),
    planId: str(),
    unitAmountInKobo: int(),
    currency: ngn(),
    interval: enm(...PRICE_INTERVALS),
    intervalCount: int(),
    usageType: enm('licensed', 'metered'),
    billingScheme: enm('per_unit', 'tiered'),
    trialPeriodDays: int(),
    active: bool(),
    metadata: bag(),
    mode: modeEnm(),
    createdAt: dt(),
  }),

  SubscriptionItem: allRequired({ id: str(), priceId: str(), quantity: int() }),
  Subscription: allRequired({
    domain: enm('subscription'),
    id: str(),
    customerId: str(),
    priceId: str(),
    status: enm('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'paused', 'canceled'),
    collectionMethod: enm('charge_automatically', 'send_invoice'),
    currentPeriodIndex: int(),
    currentPeriodStart: ndt(),
    currentPeriodEnd: ndt(),
    trialStart: ndt(),
    trialEnd: ndt(),
    cancelAtPeriodEnd: bool(),
    canceledAt: ndt(),
    endedAt: ndt(),
    cancellationReason: nenm('voluntary', 'involuntary'),
    defaultPaymentMethodId: nstr(),
    items: arr(ref('SubscriptionItem')),
    latestInvoiceId: nstr(),
    // Hosted-checkout CREATE only — the Nomba page the end user pays on. Null on
    // reads and every non-hosted create.
    checkoutLink: nstr(),
    currency: ngn(),
    mode: modeEnm(),
    createdAt: dt(),
  }),

  InvoiceLineItem: allRequired({
    id: str(),
    kind: enm('subscription', 'proration', 'discount', 'credit', 'adjustment'),
    description: str(),
    amountInKobo: int(),
    quantity: int(),
  }),
  Invoice: allRequired({
    domain: enm('invoice'),
    id: str(),
    customerId: str(),
    subscriptionId: nstr(),
    status: enm('draft', 'open', 'partially_paid', 'paid', 'void', 'uncollectible'),
    billingReason: enm('subscription_create', 'subscription_cycle', 'subscription_update', 'manual'),
    subtotalInKobo: int(),
    discountTotalInKobo: int(),
    creditTotalInKobo: int(),
    totalInKobo: int(),
    amountDueInKobo: int(),
    amountPaidInKobo: int(),
    amountRemainingInKobo: int(),
    currency: ngn(),
    periodStart: ndt(),
    periodEnd: ndt(),
    dueDate: ndt(),
    // Push-rail (bank transfer) invoices only: the dedicated per-invoice NUBAN
    // the payer must push to. `null` on pull-rail invoices.
    payInstructions: {
      type: 'object',
      nullable: true,
      properties: {
        bankName: nstr(),
        accountNumber: nstr(),
        accountName: nstr(),
        amountInKobo: int(),
        reference: nstr(),
      },
      required: ['bankName', 'accountNumber', 'accountName', 'amountInKobo', 'reference'],
    },
    lineItems: arr(ref('InvoiceLineItem')),
    finalizedAt: ndt(),
    paidAt: ndt(),
    voidedAt: ndt(),
    mode: modeEnm(),
    createdAt: dt(),
  }),

  Coupon: allRequired({
    domain: enm('coupon'),
    id: str(),
    code: str(),
    duration: enm('once', 'repeating', 'forever'),
    amountOffInKobo: nint(),
    percentOff: nint(),
    durationInCycles: nint(),
    redeemBy: ndt(),
    maxRedemptions: nint(),
    timesRedeemed: int(),
    mode: modeEnm(),
    createdAt: dt(),
  }),

  Discount: allRequired({
    domain: enm('discount'),
    id: str(),
    couponId: str(),
    customerId: nstr(),
    subscriptionId: nstr(),
    status: enm('active', 'ended'),
    cyclesRemaining: nint(),
    startAt: dt(),
    endAt: ndt(),
    mode: modeEnm(),
    createdAt: dt(),
  }),

  CreditGrant: allRequired({
    domain: enm('credit_grant'),
    id: str(),
    customerId: str(),
    amountInKobo: int(),
    remainingInKobo: int(),
    source: enm('downgrade_proration', 'manual', 'goodwill', 'coupon'),
    sourceReference: nstr(),
    mode: modeEnm(),
    voidedAt: ndt(),
    createdAt: dt(),
  }),
  CreditBalance: allRequired({
    domain: enm('credit_balance'),
    customerId: str(),
    balanceInKobo: int(),
    grants: arr(ref('CreditGrant')),
  }),

  PaymentMethod: allRequired({
    domain: enm('payment_method'),
    id: str(),
    customerId: str(),
    kind: enm('card', 'mandate', 'virtual_account'),
    status: enm('setup_pending', 'consent_pending', 'active', 'removed', 'expired'),
    isDefault: bool(),
    brand: nstr(),
    last4: nstr(),
    expMonth: nint(),
    expYear: nint(),
    mode: modeEnm(),
    createdAt: dt(),
    updatedAt: dt(),
  }),

  Settlement: allRequired({
    domain: enm('settlement'),
    id: str(),
    invoiceReference: nstr(),
    subAccountRef: str(),
    splitReference: nstr(),
    merchantTxRef: str(),
    grossInKobo: int(),
    platformFeeInKobo: int(),
    netToTenantInKobo: int(),
    status: enm('pending', 'settled', 'reconciled', 'failed', 'refunded'),
    createdAt: dt(),
  }),

  WebhookEndpoint: allRequired({
    domain: enm('webhook'),
    id: str(),
    url: str(),
    enabledEvents: arr(str()),
    signingSecretPrefix: str(),
    disabledAt: ndt(),
    createdAt: dt(),
  }),
  WebhookDelivery: allRequired({
    domain: enm('webhook_delivery'),
    id: str(),
    eventType: str(),
    endpointId: str(),
    eventId: str(),
    status: enm('pending', 'succeeded', 'failed', 'dead'),
    attempts: int(),
    nextAttemptAt: ndt(),
    lastAttemptAt: ndt(),
    responseStatus: nint(),
    replayedAt: ndt(),
    replayCount: int(),
    createdAt: dt(),
  }),
  RotatedWebhookSecret: allRequired({
    domain: enm('webhook_secret'),
    id: str(),
    signingSecret: str(),
    signingSecretPrefix: str(),
  }),
  DomainEvent: allRequired({
    domain: enm('event'),
    id: str(),
    type: str(),
    payload: bag(),
    createdAt: dt(),
  }),

  DunningAttempt: allRequired({
    domain: enm('dunning_attempt'),
    id: str(),
    attemptNumber: int(),
    status: enm('scheduled', 'attempting', 'succeeded', 'rescheduled', 'card_update_required', 'exhausted'),
    branch: enm('reschedule', 'card_update_required', 'short_path'),
    railKey: nstr(),
    failureReason: nstr(),
    gatewayMessage: nstr(),
    outcome: nstr(),
    scheduledAt: dt(),
    executedAt: ndt(),
    nextAttemptAt: ndt(),
    createdAt: dt(),
  }),
  DunningState: allRequired({
    domain: enm('dunning_state'),
    subscriptionRef: str(),
    invoiceRef: nstr(),
    status: enm('scheduled', 'attempting', 'succeeded', 'rescheduled', 'card_update_required', 'exhausted', 'none'),
    attemptsUsed: int(),
    maxAttempts: int(),
    nextAttemptAt: ndt(),
    graceAccessUntil: ndt(),
    attempts: arr(ref('DunningAttempt')),
  }),

  BillingSettings: allRequired({
    domain: enm('billing_settings'),
    partialCollectionEnabled: bool(),
    prorationCreditPolicy: enm('credit_next_cycle', 'none'),
    dunningMaxAttempts: int(),
    // Fractional hours are legal (0.25 = 15 minutes — required for sub-day
    // cadences); declaring `integer` here lied to every generated SDK.
    dunningIntervalsHours: arr(num()),
    dunningMaxWindowHours: int(),
    gracePeriodHours: int(),
    paydayDays: arr(int()),
    paydayPullForwardDays: int(),
    paydayBiasEnabled: bool(),
    defaultCollectionMethod: enm('charge_automatically', 'send_invoice'),
    commsEnabled: bool(),
    renewalReminderLeadHours: num(),
  }),

  TenantSettings: allRequired({
    domain: enm('organization'),
    billing: obj(
      {
        rateLimitPerMinute: nint(),
        monthlyRequestQuota: nint(),
        settlementMode: enm('split_at_collection', 'collect_then_payout'),
        platformFee: obj({ bps: nint(), minInKobo: nint(), maxInKobo: nint() }, ['bps', 'minInKobo', 'maxInKobo']),
        grace: obj({ gracePeriodHours: int(), dunningMaxAttempts: int() }, ['gracePeriodHours', 'dunningMaxAttempts']),
        branding: obj(
          { displayName: str(), supportEmail: str(), logoUrl: str(), primaryColorHex: str() },
          []
        ),
      },
      ['rateLimitPerMinute', 'monthlyRequestQuota', 'settlementMode', 'platformFee', 'grace', 'branding']
    ),
    webhook: obj({ url: nstr(), signingSecretPrefix: nstr(), configured: bool() }, ['url', 'signingSecretPrefix', 'configured']),
    settlement: obj({ accountRef: str() }, ['accountRef']),
  }),

  DunningFunnel: allRequired({
    scheduled: int(),
    attempting: int(),
    cardUpdateRequired: int(),
    rescheduled: int(),
    succeeded: int(),
    exhausted: int(),
  }),
  BillingMetrics: allRequired({
    domain: enm('billing_metrics'),
    mrrInKobo: int(),
    activeCount: int(),
    voluntaryChurn: int(),
    involuntaryChurn: int(),
    failedChargeRate: num(),
    dunningRecoveryRate: num(),
    dunningFunnel: ref('DunningFunnel'),
    windowFrom: dt(),
    windowTo: dt(),
  }),

  SchedulePhase: allRequired(
    { startIndex: int(), priceId: str(), quantity: int(), consumedAt: ndt() },
    ['quantity']
  ),
  SubscriptionSchedule: allRequired({
    domain: enm('subscription_schedule'),
    id: str(),
    subscriptionId: str(),
    status: enm('active', 'released', 'canceled'),
    phases: arr(ref('SchedulePhase')),
    mode: modeEnm(),
    createdAt: dt(),
    updatedAt: dt(),
  }),

  UpcomingInvoice: allRequired({
    domain: enm('upcoming_invoice'),
    subscriptionId: str(),
    periodIndex: int(),
    periodStart: dt(),
    periodEnd: dt(),
    billingReason: enm('subscription_create', 'subscription_cycle', 'subscription_update', 'manual'),
    subtotalInKobo: int(),
    totalInKobo: int(),
    amountDueInKobo: int(),
    currency: ngn(),
    lineItems: arr(ref('InvoiceLineItem')),
    mode: modeEnm(),
  }),

  Example: allRequired({
    domain: enm('example'),
    id: str(),
    kind: enm('standard', 'priority'),
    status: enm('pending', 'settled', 'failed'),
    amountInKobo: int(),
    currency: ngn(),
    mode: modeEnm(),
    createdAt: dt(),
  }),

  CheckoutSetup: allRequired({ domain: enm('checkout_setup'), reference: str(), checkoutLink: str() }),
  MandateSetup: allRequired({ domain: enm('mandate_setup'), reference: str(), mandateRef: str(), status: str(), consentInstruction: str() }),
  VirtualAccount: allRequired({
    domain: enm('virtual_account'),
    reference: str(),
    bankName: str(),
    accountNumber: str(),
    accountName: str(),
    accountRef: str(),
  }),
};

export interface RouteDataMapping {
  ref: string;
  list?: boolean;
}

/** `"<method> <specPath>"` → the resource its success `data` carries. */
export const RESPONSE_DATA_BY_ROUTE: Record<string, RouteDataMapping> = {
  // Customers
  'get /v1/customers': { ref: 'Customer', list: true },
  'get /v1/customers/{id}': { ref: 'Customer' },
  'post /v1/customers': { ref: 'Customer' },
  'patch /v1/customers/{id}': { ref: 'Customer' },
  'get /v1/customers/{id}/credit': { ref: 'CreditBalance' },
  'post /v1/customers/{id}/credit': { ref: 'CreditGrant' },
  'delete /v1/customers/{id}/credit/{grantId}': { ref: 'CreditGrant' },
  'post /v1/customers/{id}/discount': { ref: 'Discount' },

  // Plans
  'get /v1/plans': { ref: 'Plan', list: true },
  'get /v1/plans/{id}': { ref: 'Plan' },
  'post /v1/plans': { ref: 'PlanWithPrices' },
  'patch /v1/plans/{id}': { ref: 'PlanWithPrices' },
  'post /v1/plans/{id}/archive': { ref: 'Plan' },
  'get /v1/plans/{id}/prices': { ref: 'Price', list: true },
  'post /v1/plans/{id}/prices': { ref: 'Price' },

  // Prices
  'get /v1/prices': { ref: 'Price', list: true },
  'get /v1/prices/{id}': { ref: 'Price' },
  'post /v1/prices/{id}/deactivate': { ref: 'Price' },

  // Subscriptions
  'get /v1/subscriptions': { ref: 'Subscription', list: true },
  'get /v1/subscriptions/{id}': { ref: 'Subscription' },
  'post /v1/subscriptions': { ref: 'Subscription' },
  'patch /v1/subscriptions/{id}': { ref: 'Subscription' },
  'post /v1/subscriptions/{id}/cancel': { ref: 'Subscription' },
  'post /v1/subscriptions/{id}/pause': { ref: 'Subscription' },
  'post /v1/subscriptions/{id}/resume': { ref: 'Subscription' },
  'post /v1/subscriptions/{id}/resubscribe': { ref: 'Subscription' },
  'post /v1/subscriptions/{id}/change': { ref: 'Subscription' },
  'post /v1/subscriptions/{id}/payment-method': { ref: 'Subscription' },
  'post /v1/subscriptions/{id}/discount': { ref: 'Discount' },
  'get /v1/subscriptions/{id}/schedule': { ref: 'SubscriptionSchedule' },
  'post /v1/subscriptions/{id}/schedule': { ref: 'SubscriptionSchedule' },
  'delete /v1/subscriptions/{id}/schedule': { ref: 'SubscriptionSchedule' },
  'get /v1/subscriptions/{id}/upcoming-invoice': { ref: 'UpcomingInvoice' },
  'get /v1/subscriptions/{id}/dunning': { ref: 'DunningState' },
  'get /v1/subscriptions/{id}/dunning/attempts': { ref: 'DunningAttempt', list: true },
  'get /v1/subscriptions/{id}/events': { ref: 'DomainEvent', list: true },

  // Invoices
  'get /v1/invoices': { ref: 'Invoice', list: true },
  'get /v1/invoices/{id}': { ref: 'Invoice' },
  'post /v1/invoices/{id}/void': { ref: 'Invoice' },

  // Coupons
  'get /v1/coupons': { ref: 'Coupon', list: true },
  'get /v1/coupons/{id}': { ref: 'Coupon' },
  'post /v1/coupons': { ref: 'Coupon' },
  'patch /v1/coupons/{id}': { ref: 'Coupon' },

  // Payment methods
  'get /v1/payment-methods': { ref: 'PaymentMethod', list: true },
  'get /v1/payment-methods/{id}': { ref: 'PaymentMethod' },
  'post /v1/payment-methods/setup': { ref: 'CheckoutSetup' },
  'post /v1/payment-methods/virtual-account': { ref: 'VirtualAccount' },
  'post /v1/payment-methods/{id}/default': { ref: 'PaymentMethod' },
  'delete /v1/payment-methods/{id}': { ref: 'PaymentMethod' },

  // Mandates
  'post /v1/mandates': { ref: 'MandateSetup' },

  // Settlements
  'get /v1/settlements': { ref: 'Settlement', list: true },
  'get /v1/settlements/{id}': { ref: 'Settlement' },

  // Billing settings / settings / metrics
  'get /v1/organization/billing': { ref: 'BillingSettings' },
  'put /v1/organization/billing': { ref: 'BillingSettings' },
  'get /v1/organization': { ref: 'TenantSettings' },
  'put /v1/organization': { ref: 'TenantSettings' },
  'get /v1/metrics/billing': { ref: 'BillingMetrics' },

  // Events
  'get /v1/events': { ref: 'DomainEvent', list: true },
  'get /v1/events/{id}': { ref: 'DomainEvent' },

  // Webhook endpoints / deliveries
  'get /v1/webhooks': { ref: 'WebhookEndpoint', list: true },
  'get /v1/webhooks/{id}': { ref: 'WebhookEndpoint' },
  'post /v1/webhooks': { ref: 'WebhookEndpoint' },
  'patch /v1/webhooks/{id}': { ref: 'WebhookEndpoint' },
  'post /v1/webhooks/{id}/rotate-secret': { ref: 'RotatedWebhookSecret' },
  'get /v1/webhooks/{id}/deliveries': { ref: 'WebhookDelivery', list: true },
  'get /v1/webhooks/{id}/deliveries/{deliveryId}': { ref: 'WebhookDelivery' },
  'post /v1/webhooks/{id}/deliveries/{deliveryId}/replay': { ref: 'WebhookDelivery' },

  // Example (reference resource)
  'get /v1/examples': { ref: 'Example', list: true },
  'get /v1/examples/{id}': { ref: 'Example' },
  'post /v1/examples': { ref: 'Example' },
};
