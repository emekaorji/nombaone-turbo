import openapi from "@/generated/openapi.json";

/**
 * The API-reference operation model (Phase 08+). One source of truth for the
 * disintegrated reference: it turns the committed OpenAPI snapshot into an
 * ordered tree of resources → operations, each with a stable human slug/title,
 * its parameters, request-body fields, and responses. Every page (`/reference`,
 * `/reference/[resource]`, `/reference/[resource]/[operation]`) and the API
 * sidebar are generated from this, so nothing about the reference is hand-typed
 * and it can never drift from what the API actually serves.
 */

// --- raw spec types ---------------------------------------------------------

export interface Schema {
  type?: string;
  $ref?: string;
  enum?: (string | number)[];
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  description?: string;
  format?: string;
  nullable?: boolean;
  example?: unknown;
}

interface RawParam {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: Schema;
}

interface RawOperation {
  summary?: string;
  description?: string;
  parameters?: RawParam[];
  requestBody?: { content?: Record<string, { schema?: Schema }> };
  responses?: Record<string, { description?: string; content?: Record<string, { schema?: Schema }> }>;
  security?: unknown;
}

const spec = openapi as unknown as {
  info?: { title?: string; version?: string; description?: string };
  servers?: { url?: string; description?: string }[];
  paths: Record<string, Record<string, RawOperation>>;
  components?: { schemas?: Record<string, Schema> };
};

export const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

// --- schema resolution ------------------------------------------------------

/** Resolve a `$ref` to its component schema (one hop; components are flat). */
export function resolveSchema(schema?: Schema): Schema | undefined {
  if (!schema) return undefined;
  if (schema.$ref) {
    const name = schema.$ref.split("/").pop();
    return (name && spec.components?.schemas?.[name]) || schema;
  }
  return schema;
}

/** A short human type label for a schema (used in field tables). */
export function typeLabel(schema?: Schema): string {
  const s = resolveSchema(schema);
  if (!s) return "unknown";
  if (s.enum) return s.enum.map((e) => (typeof e === "string" ? `"${e}"` : String(e))).join(" | ");
  if (s.type === "array") return `${typeLabel(s.items)}[]`;
  if (s.format === "date-time") return "timestamp";
  return s.type ?? "object";
}

// --- model types ------------------------------------------------------------

export interface ApiParam {
  name: string;
  in: "path" | "query" | "header";
  required: boolean;
  type: string;
  description?: string;
  schema?: Schema;
}

export interface ApiField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  schema?: Schema;
}

export interface ApiResponse {
  status: string;
  description?: string;
  schema?: Schema;
}

export interface ApiOperation {
  /** `POST /v1/customers` */
  id: string;
  method: HttpMethod;
  /** Full path, e.g. `/v1/customers/{id}`. */
  path: string;
  /** Owning resource slug, e.g. `customers`. */
  resource: string;
  /** Stable, human slug unique within the resource, e.g. `retrieve`, `apply-discount`. */
  slug: string;
  /** Human title, e.g. "Retrieve a customer". */
  title: string;
  /** One-line summary for lists (falls back to the title). */
  summary: string;
  requiresAuth: boolean;
  pathParams: ApiParam[];
  queryParams: ApiParam[];
  /** Top-level request-body fields (JSON), if any. */
  bodyFields: ApiField[];
  bodySchema?: Schema;
  responses: ApiResponse[];
}

export interface ApiResource {
  slug: string;
  title: string;
  operations: ApiOperation[];
}

// --- curation ---------------------------------------------------------------

/**
 * Public reference resources, in the order the sidebar shows them. Utility and
 * scaffold paths (`health`, `openapi.json`, `examples`, `sandbox`) are covered
 * elsewhere (sandbox toolkit) and deliberately excluded.
 */
const RESOURCE_ORDER = [
  "customers",
  "plans",
  "prices",
  "subscriptions",
  "payment-methods",
  "mandates",
  "invoices",
  "coupons",
  "settlements",
  "webhooks",
  "events",
  "organization",
  "metrics",
] as const;

const RESOURCE_TITLE: Record<string, string> = {
  customers: "Customers",
  plans: "Plans",
  prices: "Prices",
  subscriptions: "Subscriptions",
  "payment-methods": "Payment methods",
  mandates: "Mandates",
  invoices: "Invoices",
  coupons: "Coupons",
  settlements: "Settlements",
  webhooks: "Webhook endpoints",
  events: "Events",
  organization: "Organization",
  metrics: "Metrics",
};

/** The singular noun used in generated CRUD titles ("Create a customer"). */
const RESOURCE_NOUN: Record<string, string> = {
  customers: "customer",
  plans: "plan",
  prices: "price",
  subscriptions: "subscription",
  "payment-methods": "payment method",
  mandates: "mandate",
  invoices: "invoice",
  coupons: "coupon",
  settlements: "settlement",
  webhooks: "webhook endpoint",
  events: "event",
  organization: "organization",
  metrics: "metric",
};

/**
 * Curated slug + title for the non-CRUD action endpoints, keyed by `METHOD path`.
 * CRUD endpoints (collection POST/GET, item GET/PATCH/PUT/DELETE) are derived by
 * heuristic and don't appear here.
 */
const OVERRIDES: Record<string, { slug: string; title: string }> = {
  // customers
  "POST /v1/customers/{id}/discount": { slug: "apply-discount", title: "Apply a discount" },
  "DELETE /v1/customers/{id}/discount": { slug: "remove-discount", title: "Remove a discount" },
  "POST /v1/customers/{id}/credit": { slug: "grant-credit", title: "Grant credit" },
  "GET /v1/customers/{id}/credit": { slug: "credit-balance", title: "Retrieve credit balance" },
  "DELETE /v1/customers/{id}/credit/{grantId}": { slug: "void-credit-grant", title: "Void a credit grant" },
  // plans
  "POST /v1/plans/{id}/archive": { slug: "archive", title: "Archive a plan" },
  "POST /v1/plans/{id}/prices": { slug: "create-price", title: "Create a price on a plan" },
  "GET /v1/plans/{id}/prices": { slug: "list-prices", title: "List prices on a plan" },
  // prices
  "POST /v1/prices/{id}/deactivate": { slug: "deactivate", title: "Deactivate a price" },
  // subscriptions
  "GET /v1/subscriptions/{id}/events": { slug: "list-events", title: "List subscription events" },
  "POST /v1/subscriptions/{id}/pause": { slug: "pause", title: "Pause a subscription" },
  "POST /v1/subscriptions/{id}/resume": { slug: "resume", title: "Resume a subscription" },
  "POST /v1/subscriptions/{id}/cancel": { slug: "cancel", title: "Cancel a subscription" },
  "POST /v1/subscriptions/{id}/resubscribe": { slug: "resubscribe", title: "Resubscribe a customer" },
  "POST /v1/subscriptions/{id}/change": { slug: "change", title: "Change the plan or price" },
  "GET /v1/subscriptions/{id}/upcoming-invoice": { slug: "upcoming-invoice", title: "Preview the upcoming invoice" },
  "POST /v1/subscriptions/{id}/schedule": { slug: "create-schedule", title: "Schedule a change" },
  "GET /v1/subscriptions/{id}/schedule": { slug: "retrieve-schedule", title: "Retrieve the schedule" },
  "DELETE /v1/subscriptions/{id}/schedule": { slug: "cancel-schedule", title: "Cancel the schedule" },
  "POST /v1/subscriptions/{id}/discount": { slug: "apply-discount", title: "Apply a discount" },
  "DELETE /v1/subscriptions/{id}/discount": { slug: "remove-discount", title: "Remove a discount" },
  "GET /v1/subscriptions/{id}/dunning": { slug: "dunning", title: "Retrieve dunning state" },
  "GET /v1/subscriptions/{id}/dunning/attempts": { slug: "dunning-attempts", title: "List dunning attempts" },
  "POST /v1/subscriptions/{id}/payment-method": { slug: "update-payment-method", title: "Update the payment method" },
  // payment-methods
  "POST /v1/payment-methods/setup": { slug: "setup", title: "Set up a payment method" },
  "POST /v1/payment-methods/virtual-account": { slug: "virtual-account", title: "Create a virtual account" },
  "POST /v1/payment-methods/{id}/default": { slug: "set-default", title: "Set the default method" },
  // invoices
  "POST /v1/invoices/{id}/void": { slug: "void", title: "Void an invoice" },
  // settlements
  "GET /v1/settlements/escrow": { slug: "escrow", title: "Retrieve the escrow balance" },
  "POST /v1/settlements/payout": { slug: "create-payout", title: "Withdraw your balance" },
  "GET /v1/banks": { slug: "list-banks", title: "List banks" },
  "GET /v1/payout-accounts": { slug: "retrieve-payout-account", title: "Retrieve your payout account" },
  "POST /v1/payout-accounts": { slug: "add-payout-account", title: "Add your payout account" },
  "POST /v1/payout-accounts/resolve": { slug: "resolve-payout-account", title: "Look up a bank account name" },
  "POST /v1/settlements/{id}/refund": { slug: "refund", title: "Refund a settlement" },
  // webhooks
  "POST /v1/webhooks/{id}/rotate-secret": { slug: "rotate-secret", title: "Rotate the signing secret" },
  "GET /v1/webhooks/{id}/deliveries": { slug: "list-deliveries", title: "List deliveries" },
  "GET /v1/webhooks/{id}/deliveries/{deliveryId}": { slug: "retrieve-delivery", title: "Retrieve a delivery" },
  "POST /v1/webhooks/{id}/deliveries/{deliveryId}/replay": { slug: "replay-delivery", title: "Replay a delivery" },
  // events
  "GET /v1/events/catalog": { slug: "catalog", title: "Retrieve the event catalog" },
  // organization
  "GET /v1/organization/billing": { slug: "retrieve-billing", title: "Retrieve billing settings" },
  "PUT /v1/organization/billing": { slug: "update-billing", title: "Update billing settings" },
  // metrics
  "GET /v1/metrics/billing": { slug: "billing", title: "Retrieve billing metrics" },
};

/** Singleton resources: one object, no collection/list (the bare path is it). */
const SINGLETONS = new Set(["organization"]);

/** The resource a path belongs to = its first segment after `/v1/`. */
function pathResource(path: string): string {
  return path.replace(/^\/v1\//, "").split("/")[0] ?? "";
}

/** Whether a path ends at a collection (`/x`), an item (`/x/{id}`), or an action. */
function isItemPath(path: string): boolean {
  return /\}$/.test(path);
}

/** Derive the CRUD slug + title for the standard endpoints. */
function crudSlugTitle(
  method: HttpMethod,
  path: string,
  resource: string,
): { slug: string; title: string } {
  const noun = RESOURCE_NOUN[resource] ?? resource;
  const a = /^[aeiou]/i.test(noun) ? "an" : "a";
  const item = isItemPath(path);
  // Singleton resources (organization) have no collection: the bare path is the
  // one object, so GET/PUT act on "the" object, never a list.
  if (SINGLETONS.has(resource)) {
    if (method === "get") return { slug: "retrieve", title: `Retrieve the ${noun}` };
    return { slug: "update", title: `Update the ${noun}` };
  }
  if (method === "post" && !item) return { slug: "create", title: `Create ${a} ${noun}` };
  if (method === "get" && !item) return { slug: "list", title: `List ${pluralNoun(resource)}` };
  if (method === "get" && item) return { slug: "retrieve", title: `Retrieve ${a} ${noun}` };
  if ((method === "patch" || method === "put") && item) return { slug: "update", title: `Update ${a} ${noun}` };
  if (method === "delete" && item) return { slug: "delete", title: `Delete ${a} ${noun}` };
  // Singleton resources with no {id} (e.g. organization, metrics): GET/PUT on the bare path.
  if (method === "get") return { slug: "retrieve", title: `Retrieve the ${noun}` };
  if (method === "put" || method === "patch") return { slug: "update", title: `Update the ${noun}` };
  // Fallback — a bare-path POST with no override.
  return { slug: "create", title: `Create a ${noun}` };
}

function pluralNoun(resource: string): string {
  // The resource slug is already plural for collections ("customers"); title-case-free plural.
  return RESOURCE_NOUN[resource] ? `${RESOURCE_NOUN[resource]}s` : resource;
}

// --- build ------------------------------------------------------------------

function toParam(p: RawParam): ApiParam | null {
  if (p.in !== "path" && p.in !== "query" && p.in !== "header") return null;
  return {
    name: p.name,
    in: p.in,
    required: p.in === "path" ? true : Boolean(p.required),
    type: typeLabel(p.schema),
    description: p.description,
    schema: p.schema,
  };
}

function bodyFieldsOf(op: RawOperation): { fields: ApiField[]; schema?: Schema } {
  const raw = op.requestBody?.content?.["application/json"]?.schema;
  const schema = resolveSchema(raw);
  if (!schema?.properties) return { fields: [], schema };
  const required = new Set(schema.required ?? []);
  const fields = Object.entries(schema.properties).map(([name, fieldSchema]) => ({
    name,
    type: typeLabel(fieldSchema),
    required: required.has(name),
    description: resolveSchema(fieldSchema)?.description,
    schema: fieldSchema,
  }));
  return { fields, schema };
}

function responsesOf(op: RawOperation): ApiResponse[] {
  return Object.entries(op.responses ?? {}).map(([status, r]) => ({
    status,
    description: r.description,
    schema: r.content?.["application/json"]?.schema,
  }));
}

/** Build every operation for a resource, ordered create → list → retrieve → … */
function buildOperations(resource: string): ApiOperation[] {
  const ops: ApiOperation[] = [];
  for (const [path, methods] of Object.entries(spec.paths)) {
    if (pathResource(path) !== resource) continue;
    for (const [rawMethod, op] of Object.entries(methods)) {
      const method = rawMethod as HttpMethod;
      if (!HTTP_METHODS.includes(method)) continue;
      const key = `${method.toUpperCase()} ${path}`;
      const { slug, title } = OVERRIDES[key] ?? crudSlugTitle(method, path, resource);
      const params = (op.parameters ?? []).map(toParam).filter((p): p is ApiParam => p !== null);
      const { fields, schema } = bodyFieldsOf(op);
      ops.push({
        id: key,
        method,
        path,
        resource,
        slug,
        title,
        summary: op.summary && !/^[A-Z]+ \//.test(op.summary) ? op.summary : title,
        requiresAuth: Boolean(op.security),
        pathParams: params.filter((p) => p.in === "path"),
        queryParams: params.filter((p) => p.in === "query"),
        bodyFields: fields,
        bodySchema: schema,
        responses: responsesOf(op),
      });
    }
  }
  return sortOperations(ops);
}

const SLUG_ORDER = ["create", "list", "retrieve", "update", "delete"];

function sortOperations(ops: ApiOperation[]): ApiOperation[] {
  return ops.sort((a, b) => {
    const ai = SLUG_ORDER.indexOf(a.slug);
    const bi = SLUG_ORDER.indexOf(b.slug);
    const aRank = ai === -1 ? SLUG_ORDER.length : ai;
    const bRank = bi === -1 ? SLUG_ORDER.length : bi;
    if (aRank !== bRank) return aRank - bRank;
    // Then shorter paths first, then alphabetical for stability.
    if (a.path.length !== b.path.length) return a.path.length - b.path.length;
    return a.id.localeCompare(b.id);
  });
}

let cache: ApiResource[] | null = null;

/** All public reference resources, ordered, each with its operations. */
export function getApiResources(): ApiResource[] {
  if (cache) return cache;
  cache = RESOURCE_ORDER.map((slug) => ({
    slug,
    title: RESOURCE_TITLE[slug] ?? slug,
    operations: buildOperations(slug),
  })).filter((r) => r.operations.length > 0);
  return cache;
}

export function getResource(slug: string): ApiResource | undefined {
  return getApiResources().find((r) => r.slug === slug);
}

export function getOperation(resourceSlug: string, operationSlug: string): ApiOperation | undefined {
  return getResource(resourceSlug)?.operations.find((o) => o.slug === operationSlug);
}

/** `[{ resource, operation }]` for every operation — drives `generateStaticParams`. */
export function allOperationParams(): { resource: string; operation: string }[] {
  return getApiResources().flatMap((r) =>
    r.operations.map((o) => ({ resource: r.slug, operation: o.slug })),
  );
}

export const API_INFO = {
  title: spec.info?.title ?? "nombaone API",
  version: spec.info?.version ?? "v1",
  description: spec.info?.description ?? "",
};
