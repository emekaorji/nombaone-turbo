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
 */

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
const env = (): JsonSchema => enm('test', 'live');
const ngn = (): JsonSchema => ({ type: 'string', enum: ['NGN'] });

const obj = (properties: Record<string, JsonSchema>, required: string[]): JsonSchema => ({
  type: 'object',
  properties,
  required,
});
/** All keys are required unless listed in `optional`. */
const allRequired = (properties: Record<string, JsonSchema>, optional: string[] = []): JsonSchema =>
  obj(properties, Object.keys(properties).filter((k) => !optional.includes(k)));

export const RESPONSE_SCHEMAS: Record<string, JsonSchema> = {
  Customer: allRequired({
    id: str(),
    email: str(),
    name: str(),
    phone: nstr(),
    metadata: bag(),
    environment: env(),
    createdAt: dt(),
    updatedAt: dt(),
  }),

  Plan: allRequired({
    id: str(),
    name: str(),
    description: nstr(),
    status: enm('active', 'archived'),
    metadata: bag(),
    environment: env(),
    createdAt: dt(),
    updatedAt: dt(),
  }),

  Price: allRequired({
    id: str(),
    planId: str(),
    unitAmount: int(),
    currency: ngn(),
    interval: enm('day', 'week', 'month', 'year'),
    intervalCount: int(),
    usageType: enm('licensed', 'metered'),
    billingScheme: enm('per_unit', 'tiered'),
    trialPeriodDays: int(),
    active: bool(),
    metadata: bag(),
    environment: env(),
    createdAt: dt(),
  }),

  SubscriptionItem: allRequired({ id: str(), priceId: str(), quantity: int() }),
  Subscription: allRequired({
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
    currency: ngn(),
    environment: env(),
    createdAt: dt(),
  }),

  InvoiceLineItem: allRequired({
    id: str(),
    kind: enm('subscription', 'proration', 'discount', 'credit', 'adjustment'),
    description: str(),
    amount: int(),
    quantity: int(),
  }),
  Invoice: allRequired({
    id: str(),
    customerId: str(),
    subscriptionId: nstr(),
    status: enm('draft', 'open', 'partially_paid', 'paid', 'void', 'uncollectible'),
    billingReason: enm('subscription_create', 'subscription_cycle', 'subscription_update', 'manual'),
    subtotal: int(),
    discountTotal: int(),
    creditTotal: int(),
    total: int(),
    amountDue: int(),
    amountPaid: int(),
    amountRemaining: int(),
    currency: ngn(),
    periodStart: ndt(),
    periodEnd: ndt(),
    dueDate: ndt(),
    lineItems: arr(ref('InvoiceLineItem')),
    finalizedAt: ndt(),
    paidAt: ndt(),
    voidedAt: ndt(),
    environment: env(),
    createdAt: dt(),
  }),

  Coupon: allRequired({
    id: str(),
    code: str(),
    duration: enm('once', 'repeating', 'forever'),
    amountOff: nint(),
    percentOff: nint(),
    durationInCycles: nint(),
    redeemBy: ndt(),
    maxRedemptions: nint(),
    timesRedeemed: int(),
    environment: env(),
    createdAt: dt(),
  }),

  Discount: allRequired({
    id: str(),
    couponId: str(),
    customerId: nstr(),
    subscriptionId: nstr(),
    status: enm('active', 'ended'),
    cyclesRemaining: nint(),
    startAt: dt(),
    endAt: ndt(),
    environment: env(),
    createdAt: dt(),
  }),

  CreditGrant: allRequired({
    id: str(),
    customerId: str(),
    amount: int(),
    remaining: int(),
    source: enm('downgrade_proration', 'manual', 'goodwill', 'coupon'),
    sourceReference: nstr(),
    environment: env(),
    voidedAt: ndt(),
    createdAt: dt(),
  }),
  CreditBalance: allRequired({
    customerId: str(),
    balance: int(),
    grants: arr(ref('CreditGrant')),
  }),

  PaymentMethod: allRequired({
    id: str(),
    customerId: str(),
    kind: enm('card', 'mandate', 'virtual_account'),
    status: enm('setup_pending', 'consent_pending', 'active', 'removed', 'expired'),
    isDefault: bool(),
    brand: nstr(),
    last4: nstr(),
    expMonth: nint(),
    expYear: nint(),
    environment: env(),
    createdAt: dt(),
    updatedAt: dt(),
  }),

  Settlement: allRequired({
    id: str(),
    invoiceReference: nstr(),
    subAccountRef: str(),
    splitReference: nstr(),
    merchantTxRef: str(),
    grossKobo: int(),
    platformFeeKobo: int(),
    netToTenantKobo: int(),
    status: enm('pending', 'settled', 'reconciled', 'failed', 'refunded'),
    createdAt: dt(),
  }),

  WebhookEndpoint: allRequired({
    id: str(),
    url: str(),
    enabledEvents: arr(str()),
    signingSecretPrefix: str(),
    disabledAt: ndt(),
    createdAt: dt(),
  }),
  WebhookDelivery: allRequired({
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
    id: str(),
    signingSecret: str(),
    signingSecretPrefix: str(),
  }),
  DomainEvent: allRequired({
    id: str(),
    type: str(),
    payload: bag(),
    createdAt: dt(),
  }),

  DunningAttempt: allRequired({
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
    partialCollectionEnabled: bool(),
    prorationCreditPolicy: enm('credit_next_cycle', 'none'),
    dunningMaxAttempts: int(),
    dunningIntervalsHours: arr(int()),
    dunningMaxWindowHours: int(),
    gracePeriodHours: int(),
    paydayDays: arr(int()),
    paydayPullForwardDays: int(),
    paydayBiasEnabled: bool(),
    defaultCollectionMethod: enm('charge_automatically', 'send_invoice'),
    commsEnabled: bool(),
  }),

  TenantSettings: allRequired({
    billing: obj(
      {
        rateLimitPerMinute: nint(),
        monthlyRequestQuota: nint(),
        settlementMode: enm('split_at_collection', 'collect_then_payout'),
        platformFee: obj({ bps: nint(), minKobo: nint(), maxKobo: nint() }, ['bps', 'minKobo', 'maxKobo']),
        grace: obj({ gracePeriodHours: int(), dunningMaxAttempts: int() }, ['gracePeriodHours', 'dunningMaxAttempts']),
        branding: obj(
          { displayName: str(), supportEmail: str(), logoUrl: str(), primaryColorHex: str() },
          []
        ),
      },
      ['rateLimitPerMinute', 'monthlyRequestQuota', 'settlementMode', 'platformFee', 'grace', 'branding']
    ),
    webhook: obj({ url: nstr(), signingSecretPrefix: nstr(), configured: bool() }, ['url', 'signingSecretPrefix', 'configured']),
    nombaAccount: obj({ accountRef: nstr(), status: nstr() }, ['accountRef', 'status']),
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
    mrrKobo: int(),
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
    id: str(),
    subscriptionId: str(),
    status: enm('active', 'released', 'canceled'),
    phases: arr(ref('SchedulePhase')),
    environment: env(),
    createdAt: dt(),
    updatedAt: dt(),
  }),

  UpcomingInvoice: allRequired({
    subscriptionId: str(),
    periodIndex: int(),
    periodStart: dt(),
    periodEnd: dt(),
    billingReason: enm('subscription_create', 'subscription_cycle', 'subscription_update', 'manual'),
    subtotal: int(),
    total: int(),
    amountDue: int(),
    currency: ngn(),
    lineItems: arr(ref('InvoiceLineItem')),
    environment: env(),
  }),

  Example: allRequired({
    id: str(),
    kind: enm('standard', 'priority'),
    status: enm('pending', 'settled', 'failed'),
    amount: int(),
    currency: ngn(),
    environment: env(),
    createdAt: dt(),
  }),

  CheckoutSetup: allRequired({ reference: str(), checkoutLink: str() }),
  MandateSetup: allRequired({ reference: str(), mandateRef: str(), status: str(), consentInstruction: str() }),
  VirtualAccount: allRequired({
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
  'get /v1/customers/{reference}': { ref: 'Customer' },
  'post /v1/customers': { ref: 'Customer' },
  'patch /v1/customers/{reference}': { ref: 'Customer' },
  'get /v1/customers/{reference}/credit': { ref: 'CreditBalance' },
  'post /v1/customers/{reference}/credit': { ref: 'CreditGrant' },
  'delete /v1/customers/{reference}/credit/{grantReference}': { ref: 'CreditGrant' },
  'post /v1/customers/{reference}/discount': { ref: 'Discount' },

  // Plans
  'get /v1/plans': { ref: 'Plan', list: true },
  'get /v1/plans/{reference}': { ref: 'Plan' },
  'post /v1/plans': { ref: 'Plan' },
  'patch /v1/plans/{reference}': { ref: 'Plan' },
  'post /v1/plans/{reference}/archive': { ref: 'Plan' },
  'get /v1/plans/{reference}/prices': { ref: 'Price', list: true },
  'post /v1/plans/{reference}/prices': { ref: 'Price' },

  // Prices
  'get /v1/prices': { ref: 'Price', list: true },
  'get /v1/prices/{reference}': { ref: 'Price' },
  'post /v1/prices/{reference}/deactivate': { ref: 'Price' },

  // Subscriptions
  'get /v1/subscriptions': { ref: 'Subscription', list: true },
  'get /v1/subscriptions/{reference}': { ref: 'Subscription' },
  'post /v1/subscriptions': { ref: 'Subscription' },
  'patch /v1/subscriptions/{reference}': { ref: 'Subscription' },
  'post /v1/subscriptions/{reference}/cancel': { ref: 'Subscription' },
  'post /v1/subscriptions/{reference}/pause': { ref: 'Subscription' },
  'post /v1/subscriptions/{reference}/resume': { ref: 'Subscription' },
  'post /v1/subscriptions/{reference}/resubscribe': { ref: 'Subscription' },
  'post /v1/subscriptions/{reference}/change': { ref: 'Subscription' },
  'post /v1/subscriptions/{reference}/payment-method': { ref: 'Subscription' },
  'post /v1/subscriptions/{reference}/discount': { ref: 'Discount' },
  'get /v1/subscriptions/{reference}/schedule': { ref: 'SubscriptionSchedule' },
  'post /v1/subscriptions/{reference}/schedule': { ref: 'SubscriptionSchedule' },
  'delete /v1/subscriptions/{reference}/schedule': { ref: 'SubscriptionSchedule' },
  'get /v1/subscriptions/{reference}/upcoming-invoice': { ref: 'UpcomingInvoice' },
  'get /v1/subscriptions/{reference}/dunning': { ref: 'DunningState' },
  'get /v1/subscriptions/{reference}/dunning/attempts': { ref: 'DunningAttempt', list: true },
  'get /v1/subscriptions/{reference}/events': { ref: 'DomainEvent', list: true },

  // Invoices
  'get /v1/invoices': { ref: 'Invoice', list: true },
  'get /v1/invoices/{reference}': { ref: 'Invoice' },
  'post /v1/invoices/{reference}/void': { ref: 'Invoice' },

  // Coupons
  'get /v1/coupons': { ref: 'Coupon', list: true },
  'get /v1/coupons/{reference}': { ref: 'Coupon' },
  'post /v1/coupons': { ref: 'Coupon' },
  'patch /v1/coupons/{reference}': { ref: 'Coupon' },

  // Payment methods
  'get /v1/payment-methods': { ref: 'PaymentMethod', list: true },
  'get /v1/payment-methods/{reference}': { ref: 'PaymentMethod' },
  'post /v1/payment-methods/setup': { ref: 'CheckoutSetup' },
  'post /v1/payment-methods/virtual-account': { ref: 'VirtualAccount' },
  'post /v1/payment-methods/{reference}/default': { ref: 'PaymentMethod' },
  'delete /v1/payment-methods/{reference}': { ref: 'PaymentMethod' },

  // Mandates
  'post /v1/mandates': { ref: 'MandateSetup' },

  // Settlements
  'get /v1/settlements': { ref: 'Settlement', list: true },
  'get /v1/settlements/{reference}': { ref: 'Settlement' },

  // Billing settings / settings / metrics
  'get /v1/billing-settings': { ref: 'BillingSettings' },
  'put /v1/billing-settings': { ref: 'BillingSettings' },
  'get /v1/settings': { ref: 'TenantSettings' },
  'put /v1/settings': { ref: 'TenantSettings' },
  'get /v1/metrics/billing': { ref: 'BillingMetrics' },

  // Events
  'get /v1/events': { ref: 'DomainEvent', list: true },
  'get /v1/events/{reference}': { ref: 'DomainEvent' },

  // Webhook endpoints / deliveries
  'get /v1/webhook-endpoints': { ref: 'WebhookEndpoint', list: true },
  'get /v1/webhook-endpoints/{reference}': { ref: 'WebhookEndpoint' },
  'post /v1/webhook-endpoints': { ref: 'WebhookEndpoint' },
  'patch /v1/webhook-endpoints/{reference}': { ref: 'WebhookEndpoint' },
  'post /v1/webhook-endpoints/{reference}/rotate-secret': { ref: 'RotatedWebhookSecret' },
  'get /v1/webhook-deliveries': { ref: 'WebhookDelivery', list: true },
  'get /v1/webhook-deliveries/{reference}': { ref: 'WebhookDelivery' },
  'post /v1/webhook-deliveries/{reference}/replay': { ref: 'WebhookDelivery' },

  // Example (reference resource)
  'get /v1/examples': { ref: 'Example', list: true },
  'get /v1/examples/{reference}': { ref: 'Example' },
  'post /v1/examples': { ref: 'Example' },
};
