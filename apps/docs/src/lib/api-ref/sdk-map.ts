import type { ApiOperation } from "./model";

/**
 * The canonical SDK call for each operation: the namespace chain and method
 * name, in one language-neutral form. The nine SDKs are generated from the same
 * spec and share this shape (`nombaone.plans.prices.create(planId, params)`),
 * so we map it once here and let each language renderer apply its own casing and
 * syntax. CRUD endpoints are derived; only the non-CRUD actions are curated.
 */

export interface SdkCall {
  /** Namespace chain in canonical camelCase, e.g. `["plans","prices"]`. */
  namespace: string[];
  /** Canonical method name in camelCase, e.g. `create`, `applyDiscount`. */
  method: string;
  /** Path-parameter names, in order, that become positional args. */
  pathArgs: string[];
  /** Whether the call takes a params/body object. */
  hasBody: boolean;
}

/** Path resource slug → the SDK's top-level namespace (a few differ by name). */
const NAMESPACE: Record<string, string> = {
  "payment-methods": "paymentMethods",
  webhooks: "webhookEndpoints",
};

function topNamespace(resource: string): string {
  return NAMESPACE[resource] ?? resource;
}

const CRUD_METHOD: Record<string, string> = {
  create: "create",
  list: "list",
  retrieve: "retrieve",
  update: "update",
  delete: "delete",
};

/**
 * Non-CRUD operations: the sub-namespace chain (relative to the resource's top
 * namespace) + method, keyed by `METHOD path`. Path args come from the spec.
 */
const OVERRIDES: Record<string, { ns?: string[]; method: string }> = {
  // customers
  "POST /v1/customers/{id}/discount": { method: "applyDiscount" },
  "DELETE /v1/customers/{id}/discount": { method: "removeDiscount" },
  "POST /v1/customers/{id}/credit": { method: "grantCredit" },
  "GET /v1/customers/{id}/credit": { method: "retrieveCreditBalance" },
  "DELETE /v1/customers/{id}/credit/{grantId}": { method: "voidCreditGrant" },
  // plans
  "POST /v1/plans/{id}/archive": { method: "archive" },
  "POST /v1/plans/{id}/prices": { ns: ["prices"], method: "create" },
  "GET /v1/plans/{id}/prices": { ns: ["prices"], method: "list" },
  // prices
  "POST /v1/prices/{id}/deactivate": { method: "deactivate" },
  // subscriptions
  "GET /v1/subscriptions/{id}/events": { method: "listEvents" },
  "POST /v1/subscriptions/{id}/pause": { method: "pause" },
  "POST /v1/subscriptions/{id}/resume": { method: "resume" },
  "POST /v1/subscriptions/{id}/cancel": { method: "cancel" },
  "POST /v1/subscriptions/{id}/resubscribe": { method: "resubscribe" },
  "POST /v1/subscriptions/{id}/change": { method: "change" },
  "GET /v1/subscriptions/{id}/upcoming-invoice": { method: "retrieveUpcomingInvoice" },
  "POST /v1/subscriptions/{id}/schedule": { ns: ["schedule"], method: "create" },
  "GET /v1/subscriptions/{id}/schedule": { ns: ["schedule"], method: "retrieve" },
  "DELETE /v1/subscriptions/{id}/schedule": { ns: ["schedule"], method: "cancel" },
  "POST /v1/subscriptions/{id}/discount": { method: "applyDiscount" },
  "DELETE /v1/subscriptions/{id}/discount": { method: "removeDiscount" },
  "GET /v1/subscriptions/{id}/dunning": { ns: ["dunning"], method: "retrieve" },
  "GET /v1/subscriptions/{id}/dunning/attempts": { ns: ["dunning"], method: "listAttempts" },
  "POST /v1/subscriptions/{id}/payment-method": { method: "updatePaymentMethod" },
  // payment-methods
  "POST /v1/payment-methods/setup": { method: "setup" },
  "POST /v1/payment-methods/virtual-account": { method: "createVirtualAccount" },
  "POST /v1/payment-methods/{id}/default": { method: "setDefault" },
  // invoices
  "POST /v1/invoices/{id}/void": { method: "void" },
  // settlements
  "GET /v1/settlements/escrow": { method: "retrieveEscrow" },
  "POST /v1/settlements/payout": { method: "createPayout" },
  "POST /v1/settlements/{id}/refund": { method: "refund" },
  // webhooks
  "POST /v1/webhooks/{id}/rotate-secret": { method: "rotateSecret" },
  "GET /v1/webhooks/{id}/deliveries": { ns: ["deliveries"], method: "list" },
  "GET /v1/webhooks/{id}/deliveries/{deliveryId}": { ns: ["deliveries"], method: "retrieve" },
  "POST /v1/webhooks/{id}/deliveries/{deliveryId}/replay": { ns: ["deliveries"], method: "replay" },
  // events
  "GET /v1/events/catalog": { method: "retrieveCatalog" },
  // organization
  "GET /v1/organization/billing": { ns: ["billing"], method: "retrieve" },
  "PUT /v1/organization/billing": { ns: ["billing"], method: "update" },
  // metrics
  "GET /v1/metrics/billing": { method: "retrieveBilling" },
};

/** The canonical SDK call for an operation. */
export function sdkCall(op: ApiOperation): SdkCall {
  const top = topNamespace(op.resource);
  const pathArgs = op.pathParams.map((p) => p.name);
  const hasBody = op.bodyFields.length > 0;

  const override = OVERRIDES[op.id];
  if (override) {
    return {
      namespace: [top, ...(override.ns ?? [])],
      method: override.method,
      pathArgs,
      hasBody,
    };
  }
  return {
    namespace: [top],
    method: CRUD_METHOD[op.slug] ?? op.slug,
    pathArgs,
    hasBody,
  };
}
