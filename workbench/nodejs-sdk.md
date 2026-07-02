# `@nombaone/node` — a sample Node.js SDK

A complete, idiomatic Node/TypeScript SDK for the nombaone billing API. This document
is a **worked design** — every resource, the transport, pagination, typed errors, retries,
idempotency, and webhook verification — so it can be lifted into a real package. It mirrors
the surface in [`api-reference.md`](./api-reference.md) 1:1.

```
npm install @nombaone/node
```

```ts
import { Nombaone } from '@nombaone/node';

const nomba = new Nombaone({ apiKey: process.env.NOMBAONE_API_KEY! }); // env baked into the key

const customer = await nomba.customers.create({ email: 'ada@acme.io', name: 'Ada Payer' });
const sub = await nomba.subscriptions.create({
  customerId: customer.id, priceId: 'nbo…prc', paymentMethodId: 'nbo…pmt',
});
```

---

## 1. Layout

```
@nombaone/node
├── src/
│   ├── index.ts              // export { Nombaone, NombaoneError, … }
│   ├── client.ts             // Nombaone: config + resource namespaces
│   ├── http.ts               // transport: fetch, envelope, retries, idempotency
│   ├── errors.ts             // NombaoneError + typed subclasses
│   ├── pagination.ts         // Page<T> + async auto-pager
│   ├── webhooks.ts           // signature verify + typed event construction
│   ├── types.ts              // all response DTOs + param shapes
│   └── resources/
│       ├── customers.ts  plans.ts  prices.ts  subscriptions.ts  invoices.ts
│       ├── coupons.ts  paymentMethods.ts  mandates.ts  settlements.ts
│       ├── settings.ts  webhookEndpoints.ts  events.ts  webhookDeliveries.ts
│       └── metrics.ts  health.ts
```

---

## 2. Configuration & client (`client.ts`)

```ts
import { HttpClient } from './http';
import { Webhooks } from './webhooks';
import * as R from './resources';

export interface NombaoneOptions {
  /** Secret key `nbo_test_…` / `nbo_live_…`. Its prefix selects the environment. */
  apiKey: string;
  /** Override the API host. Default: https://api.nombaone.com/v1 */
  baseUrl?: string;
  /** Per-request timeout (ms). Default 30_000. */
  timeoutMs?: number;
  /** Automatic retries for 429/5xx/network (idempotent + POST-with-key). Default 2. */
  maxRetries?: number;
  /** Supply your own fetch (e.g. undici) or Idempotency-Key generator (default randomUUID). */
  fetch?: typeof fetch;
  idempotencyKeyGenerator?: () => string;
}

export class Nombaone {
  readonly customers: R.Customers;
  readonly plans: R.Plans;
  readonly prices: R.Prices;
  readonly subscriptions: R.Subscriptions;
  readonly invoices: R.Invoices;
  readonly coupons: R.Coupons;
  readonly paymentMethods: R.PaymentMethods;
  readonly mandates: R.Mandates;
  readonly settlements: R.Settlements;
  readonly settings: R.Settings;
  readonly billingSettings: R.BillingSettings;
  readonly webhookEndpoints: R.WebhookEndpoints;
  readonly events: R.Events;
  readonly webhookDeliveries: R.WebhookDeliveries;
  readonly metrics: R.Metrics;
  readonly health: R.Health;
  readonly webhooks: Webhooks;

  constructor(opts: NombaoneOptions) {
    if (!opts.apiKey) throw new Error('Nombaone: apiKey is required');
    const http = new HttpClient({
      apiKey: opts.apiKey,
      baseUrl: opts.baseUrl ?? 'https://api.nombaone.com/v1',
      timeoutMs: opts.timeoutMs ?? 30_000,
      maxRetries: opts.maxRetries ?? 2,
      fetchImpl: opts.fetch ?? globalThis.fetch,
      newIdempotencyKey: opts.idempotencyKeyGenerator ?? (() => crypto.randomUUID()),
    });

    this.customers = new R.Customers(http);
    this.plans = new R.Plans(http);
    this.prices = new R.Prices(http);
    this.subscriptions = new R.Subscriptions(http);
    this.invoices = new R.Invoices(http);
    this.coupons = new R.Coupons(http);
    this.paymentMethods = new R.PaymentMethods(http);
    this.mandates = new R.Mandates(http);
    this.settlements = new R.Settlements(http);
    this.settings = new R.Settings(http);
    this.billingSettings = new R.BillingSettings(http);
    this.webhookEndpoints = new R.WebhookEndpoints(http);
    this.events = new R.Events(http);
    this.webhookDeliveries = new R.WebhookDeliveries(http);
    this.metrics = new R.Metrics(http);
    this.health = new R.Health(http);
    this.webhooks = new Webhooks();
  }
}
```

---

## 3. Transport (`http.ts`)

Handles auth, the success/error/paginated envelopes, idempotency, timeouts, and retries.

```ts
import { toNombaoneError } from './errors';

interface HttpConfig {
  apiKey: string; baseUrl: string; timeoutMs: number; maxRetries: number;
  fetchImpl: typeof fetch; newIdempotencyKey: () => string;
}

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Override/set the Idempotency-Key. Auto-generated for mutating verbs if omitted. */
  idempotencyKey?: string;
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class HttpClient {
  constructor(private readonly cfg: HttpConfig) {}

  /** Single resource → the unwrapped `data`. */
  async request<T>(opts: RequestOptions): Promise<T> {
    const { body } = await this.send<T>(opts);
    return body.data;
  }

  /** List → `data[]` + pagination cursor. */
  async requestPage<T>(opts: RequestOptions): Promise<{ data: T[]; hasMore: boolean; nextCursor: string | null; limit: number }> {
    const { body } = await this.send<T[]>(opts);
    const p = (body as any).pagination ?? { hasMore: false, nextCursor: null, limit: 20 };
    return { data: body.data as unknown as T[], ...p };
  }

  private async send<T>(opts: RequestOptions): Promise<{ status: number; body: any }> {
    const url = new URL(this.cfg.baseUrl + opts.path);
    for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.cfg.apiKey}`,
      Accept: 'application/json',
    };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    // Idempotency-Key is REQUIRED on mutating verbs; stable across retries.
    const idemKey = MUTATING.has(opts.method) ? (opts.idempotencyKey ?? this.cfg.newIdempotencyKey()) : undefined;
    if (idemKey) headers['Idempotency-Key'] = idemKey;

    let attempt = 0;
    for (;;) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), this.cfg.timeoutMs);
      try {
        const res = await this.cfg.fetchImpl(url.toString(), {
          method: opts.method,
          headers,
          body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
          signal: ctl.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success) return { status: res.status, body: json };
        // Retry transient failures (same Idempotency-Key makes POST safe to repeat).
        if (this.retryable(res.status) && attempt < this.cfg.maxRetries) {
          await sleep(backoff(attempt++, res.headers.get('retry-after')));
          continue;
        }
        throw toNombaoneError(res.status, json, res.headers.get('x-request-id'));
      } catch (err) {
        if (isNetworkError(err) && attempt < this.cfg.maxRetries) { await sleep(backoff(attempt++)); continue; }
        throw err instanceof Error && err.name === 'NombaoneError' ? err : toNombaoneError(0, { error: { code: 'NETWORK', message: String(err) } });
      } finally { clearTimeout(timer); }
    }
  }

  private retryable(status: number) { return status === 429 || (status >= 500 && status < 600); }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const backoff = (n: number, retryAfter?: string | null) =>
  retryAfter ? Number(retryAfter) * 1000 : Math.min(500 * 2 ** n, 8000) + Math.random() * 250;
const isNetworkError = (e: unknown) => e instanceof Error && ['AbortError', 'FetchError', 'TypeError'].includes(e.name);
```

---

## 4. Typed errors (`errors.ts`)

The API's `error.code` is exposed on a discriminable error, plus HTTP-status subclasses.

```ts
export class NombaoneError extends Error {
  override name = 'NombaoneError';
  constructor(
    readonly status: number,
    readonly code: string,            // e.g. 'SUBSCRIPTION_NOT_FOUND'
    message: string,
    readonly fields?: Record<string, string[]>,
    readonly requestId?: string | null,
  ) { super(message); }
}
export class AuthenticationError extends NombaoneError {}   // 401
export class PermissionError extends NombaoneError {}       // 403 (scope)
export class NotFoundError extends NombaoneError {}         // 404
export class ConflictError extends NombaoneError {}         // 409 (idempotency reuse)
export class ValidationError extends NombaoneError {}       // 422
export class RateLimitError extends NombaoneError {}        // 429 (RATE_LIMIT_EXCEEDED / QUOTA_EXCEEDED)
export class ServerError extends NombaoneError {}           // 5xx

export function toNombaoneError(status: number, json: any, requestId?: string | null): NombaoneError {
  const e = json?.error ?? {};
  const args = [status, e.code ?? 'SYSTEM_INTERNAL_ERROR', e.message ?? 'Request failed', e.fields, requestId ?? json?.meta?.requestId] as const;
  switch (status) {
    case 401: return new AuthenticationError(...args);
    case 403: return new PermissionError(...args);
    case 404: return new NotFoundError(...args);
    case 409: return new ConflictError(...args);
    case 422: return new ValidationError(...args);
    case 429: return new RateLimitError(...args);
    default:  return status >= 500 ? new ServerError(...args) : new NombaoneError(...args);
  }
}
```

```ts
try { await nomba.subscriptions.cancel('nbo…sub', { mode: 'now' }); }
catch (err) {
  if (err instanceof NotFoundError) { /* gone */ }
  else if (err instanceof RateLimitError) { /* back off */ }
  else if (err instanceof ValidationError) console.error(err.fields);
  else throw err;
}
```

---

## 5. Pagination (`pagination.ts`)

Cursor-based, with a lazy async iterator so callers never manage cursors.

```ts
export interface Page<T> { data: T[]; hasMore: boolean; nextCursor: string | null; }

export class Paginator<T> implements AsyncIterable<T> {
  constructor(private readonly fetchPage: (cursor?: string) => Promise<Page<T>>) {}

  /** One page. */
  async page(cursor?: string): Promise<Page<T>> { return this.fetchPage(cursor); }

  /** `for await (const item of nomba.customers.list())` — streams every item across pages. */
  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    let cursor: string | undefined;
    do {
      const p = await this.fetchPage(cursor);
      for (const item of p.data) yield item;
      cursor = p.nextCursor ?? undefined;
    } while (cursor);
  }

  /** Collect all pages (guard the total for large sets). */
  async toArray(max = 10_000): Promise<T[]> {
    const out: T[] = [];
    for await (const item of this) { out.push(item); if (out.length >= max) break; }
    return out;
  }
}
```

---

## 6. A base resource + the full namespaces (`resources/*.ts`)

```ts
// resources/base.ts
import { HttpClient } from '../http';
import { Page, Paginator } from '../pagination';

export abstract class Resource {
  constructor(protected readonly http: HttpClient) {}
  protected paginate<T>(path: string, query: Record<string, unknown> = {}): Paginator<T> {
    return new Paginator<T>(async (cursor) => {
      const p = await this.http.requestPage<T>({ method: 'GET', path, query: { ...query, cursor } as any });
      return { data: p.data, hasMore: p.hasMore, nextCursor: p.nextCursor } as Page<T>;
    });
  }
}
```

### Customers (+ discounts, credit)

```ts
import type * as T from '../types';
export class Customers extends Resource {
  create(body: T.CreateCustomer, idempotencyKey?: string) {
    return this.http.request<T.Customer>({ method: 'POST', path: '/customers', body, idempotencyKey });
  }
  retrieve(ref: string) { return this.http.request<T.Customer>({ method: 'GET', path: `/customers/${ref}` }); }
  update(ref: string, body: T.UpdateCustomer, idempotencyKey?: string) {
    return this.http.request<T.Customer>({ method: 'PATCH', path: `/customers/${ref}`, body, idempotencyKey });
  }
  list(query: T.ListCustomers = {}) { return this.paginate<T.Customer>('/customers', query); }

  applyDiscount(ref: string, coupon: string, idempotencyKey?: string) {
    return this.http.request<T.Discount>({ method: 'POST', path: `/customers/${ref}/discount`, body: { coupon }, idempotencyKey });
  }
  removeDiscount(ref: string, idempotencyKey?: string) {
    return this.http.request<void>({ method: 'DELETE', path: `/customers/${ref}/discount`, idempotencyKey });
  }
  grantCredit(ref: string, body: T.GrantCredit, idempotencyKey?: string) {
    return this.http.request<T.CreditGrant>({ method: 'POST', path: `/customers/${ref}/credit`, body, idempotencyKey });
  }
  creditBalance(ref: string) { return this.http.request<T.CreditBalance>({ method: 'GET', path: `/customers/${ref}/credit` }); }
  voidCredit(ref: string, grantRef: string, idempotencyKey?: string) {
    return this.http.request<T.CreditGrant>({ method: 'DELETE', path: `/customers/${ref}/credit/${grantRef}`, idempotencyKey });
  }
}
```

### Plans & Prices

```ts
export class Plans extends Resource {
  create(b: T.CreatePlan, k?: string) { return this.http.request<T.Plan>({ method: 'POST', path: '/plans', body: b, idempotencyKey: k }); }
  retrieve(ref: string) { return this.http.request<T.Plan>({ method: 'GET', path: `/plans/${ref}` }); }
  update(ref: string, b: T.UpdatePlan, k?: string) { return this.http.request<T.Plan>({ method: 'PATCH', path: `/plans/${ref}`, body: b, idempotencyKey: k }); }
  list(q: T.ListPlans = {}) { return this.paginate<T.Plan>('/plans', q); }
  archive(ref: string, k?: string) { return this.http.request<T.Plan>({ method: 'POST', path: `/plans/${ref}/archive`, idempotencyKey: k }); }
  createPrice(planRef: string, b: T.CreatePrice, k?: string) { return this.http.request<T.Price>({ method: 'POST', path: `/plans/${planRef}/prices`, body: b, idempotencyKey: k }); }
  listPrices(planRef: string) { return this.paginate<T.Price>(`/plans/${planRef}/prices`); }
}
export class Prices extends Resource {
  retrieve(ref: string) { return this.http.request<T.Price>({ method: 'GET', path: `/prices/${ref}` }); }
  list(q: T.ListPrices = {}) { return this.paginate<T.Price>('/prices', q); }
  deactivate(ref: string, k?: string) { return this.http.request<T.Price>({ method: 'POST', path: `/prices/${ref}/deactivate`, idempotencyKey: k }); }
}
```

### Subscriptions (+ lifecycle, change, schedule, discount, dunning, upcoming, events)

```ts
export class Subscriptions extends Resource {
  create(b: T.CreateSubscription, k?: string) { return this.http.request<T.Subscription>({ method: 'POST', path: '/subscriptions', body: b, idempotencyKey: k }); }
  retrieve(ref: string) { return this.http.request<T.Subscription>({ method: 'GET', path: `/subscriptions/${ref}` }); }
  list(q: T.ListSubscriptions = {}) { return this.paginate<T.Subscription>('/subscriptions', q); }
  update(ref: string, b: T.UpdateSubscription, k?: string) { return this.http.request<T.Subscription>({ method: 'PATCH', path: `/subscriptions/${ref}`, body: b, idempotencyKey: k }); }

  pause(ref: string, b: T.PauseSubscription = {}, k?: string) { return this.http.request<T.Subscription>({ method: 'POST', path: `/subscriptions/${ref}/pause`, body: b, idempotencyKey: k }); }
  resume(ref: string, k?: string) { return this.http.request<T.Subscription>({ method: 'POST', path: `/subscriptions/${ref}/resume`, body: {}, idempotencyKey: k }); }
  cancel(ref: string, b: T.CancelSubscription, k?: string) { return this.http.request<T.Subscription>({ method: 'POST', path: `/subscriptions/${ref}/cancel`, body: b, idempotencyKey: k }); }
  resubscribe(ref: string, b: T.Resubscribe = {}, k?: string) { return this.http.request<T.Subscription>({ method: 'POST', path: `/subscriptions/${ref}/resubscribe`, body: b, idempotencyKey: k }); }
  change(ref: string, b: T.ChangeSubscription, k?: string) { return this.http.request<T.Subscription>({ method: 'POST', path: `/subscriptions/${ref}/change`, body: b, idempotencyKey: k }); }

  upcomingInvoice(ref: string) { return this.http.request<T.UpcomingInvoice>({ method: 'GET', path: `/subscriptions/${ref}/upcoming-invoice` }); }
  events(ref: string) { return this.paginate<T.DomainEvent>(`/subscriptions/${ref}/events`); }

  applyDiscount(ref: string, coupon: string, k?: string) { return this.http.request<T.Discount>({ method: 'POST', path: `/subscriptions/${ref}/discount`, body: { coupon }, idempotencyKey: k }); }
  removeDiscount(ref: string, k?: string) { return this.http.request<void>({ method: 'DELETE', path: `/subscriptions/${ref}/discount`, idempotencyKey: k }); }

  // schedule (deferred change at next cycle)
  schedule(ref: string, b: T.ScheduleChange, k?: string) { return this.http.request<T.SubscriptionSchedule>({ method: 'POST', path: `/subscriptions/${ref}/schedule`, body: b, idempotencyKey: k }); }
  getSchedule(ref: string) { return this.http.request<T.SubscriptionSchedule>({ method: 'GET', path: `/subscriptions/${ref}/schedule` }); }
  cancelSchedule(ref: string, k?: string) { return this.http.request<void>({ method: 'DELETE', path: `/subscriptions/${ref}/schedule`, idempotencyKey: k }); }

  // dunning
  dunning(ref: string) { return this.http.request<T.DunningState>({ method: 'GET', path: `/subscriptions/${ref}/dunning` }); }
  dunningAttempts(ref: string) { return this.paginate<T.DunningAttempt>(`/subscriptions/${ref}/dunning/attempts`); }
  /** Swap the card mid-dunning (paymentMethodReference XOR checkoutToken) and retry now. */
  updatePaymentMethod(ref: string, b: T.UpdateSubscriptionCard, k?: string) { return this.http.request<T.Subscription>({ method: 'POST', path: `/subscriptions/${ref}/payment-method`, body: b, idempotencyKey: k }); }
}
```

### Invoices · Coupons

```ts
export class Invoices extends Resource {
  retrieve(ref: string) { return this.http.request<T.Invoice>({ method: 'GET', path: `/invoices/${ref}` }); }
  list(q: T.ListInvoices = {}) { return this.paginate<T.Invoice>('/invoices', q); }
  void(ref: string, b: { comment?: string } = {}, k?: string) { return this.http.request<T.Invoice>({ method: 'POST', path: `/invoices/${ref}/void`, body: b, idempotencyKey: k }); }
}
export class Coupons extends Resource {
  create(b: T.CreateCoupon, k?: string) { return this.http.request<T.Coupon>({ method: 'POST', path: '/coupons', body: b, idempotencyKey: k }); }
  retrieve(ref: string) { return this.http.request<T.Coupon>({ method: 'GET', path: `/coupons/${ref}` }); }
  list(q: T.ListCoupons = {}) { return this.paginate<T.Coupon>('/coupons', q); }
  update(ref: string, b: T.UpdateCoupon, k?: string) { return this.http.request<T.Coupon>({ method: 'PATCH', path: `/coupons/${ref}`, body: b, idempotencyKey: k }); }
}
```

### Payment methods & Mandates

```ts
export class PaymentMethods extends Resource {
  /** Hosted-checkout card setup → send the customer to `checkoutLink`; captured via webhook. */
  setupCard(b: T.SetupCard, k?: string) { return this.http.request<T.CheckoutSetup>({ method: 'POST', path: '/payment-methods/setup', body: b, idempotencyKey: k }); }
  issueVirtualAccount(b: T.IssueVirtualAccount, k?: string) { return this.http.request<T.VirtualAccount>({ method: 'POST', path: '/payment-methods/virtual-account', body: b, idempotencyKey: k }); }
  retrieve(ref: string) { return this.http.request<T.PaymentMethod>({ method: 'GET', path: `/payment-methods/${ref}` }); }
  list(q: T.ListPaymentMethods = {}) { return this.paginate<T.PaymentMethod>('/payment-methods', q); }
  setDefault(ref: string, k?: string) { return this.http.request<T.PaymentMethod>({ method: 'POST', path: `/payment-methods/${ref}/default`, idempotencyKey: k }); }
  remove(ref: string, k?: string) { return this.http.request<void>({ method: 'DELETE', path: `/payment-methods/${ref}`, idempotencyKey: k }); }
}
export class Mandates extends Resource {
  create(b: T.CreateMandate, k?: string) { return this.http.request<T.MandateSetup>({ method: 'POST', path: '/mandates', body: b, idempotencyKey: k }); }
  /** Poll status — flips to `active` once NIBSS advice is sent. */
  retrieve(ref: string) { return this.http.request<T.PaymentMethod>({ method: 'GET', path: `/mandates/${ref}` }); }
}
```

### Settlements, Refunds & Payouts

```ts
export class Settlements extends Resource {
  list(q: T.ListSettlements = {}) { return this.paginate<T.Settlement>('/settlements', q); }
  retrieve(ref: string) { return this.http.request<T.Settlement>({ method: 'GET', path: `/settlements/${ref}` }); }
  escrow() { return this.http.request<T.Escrow>({ method: 'GET', path: '/settlements/escrow' }); }
  /** Refund the tenant share (fee non-refundable). Omit amountKobo for a full refund. */
  refund(ref: string, b: { amountKobo?: number } = {}, k?: string) { return this.http.request<T.Refund>({ method: 'POST', path: `/settlements/${ref}/refund`, body: b, idempotencyKey: k }); }
  /** Tenant withdrawal, honouring the 3h escrow lock. */
  payout(b: T.CreatePayout, k?: string) { return this.http.request<T.Payout>({ method: 'POST', path: '/settlements/payout', body: b, idempotencyKey: k }); }
}
```

### Settings · Webhooks · Events · Deliveries · Metrics · Health

```ts
export class Settings extends Resource {
  retrieve() { return this.http.request<T.TenantSettings>({ method: 'GET', path: '/settings' }); }
  update(b: T.UpdateTenantSettings, k?: string) { return this.http.request<T.TenantSettings>({ method: 'PUT', path: '/settings', body: b, idempotencyKey: k }); }
}
export class BillingSettings extends Resource {
  retrieve() { return this.http.request<T.BillingSettings>({ method: 'GET', path: '/billing-settings' }); }
  update(b: T.UpdateBillingSettings, k?: string) { return this.http.request<T.BillingSettings>({ method: 'PUT', path: '/billing-settings', body: b, idempotencyKey: k }); }
}
export class WebhookEndpoints extends Resource {
  create(b: T.CreateWebhookEndpoint, k?: string) { return this.http.request<T.WebhookEndpoint>({ method: 'POST', path: '/webhook-endpoints', body: b, idempotencyKey: k }); }
  list() { return this.paginate<T.WebhookEndpoint>('/webhook-endpoints'); }
  retrieve(ref: string) { return this.http.request<T.WebhookEndpoint>({ method: 'GET', path: `/webhook-endpoints/${ref}` }); }
  update(ref: string, b: T.UpdateWebhookEndpoint, k?: string) { return this.http.request<T.WebhookEndpoint>({ method: 'PATCH', path: `/webhook-endpoints/${ref}`, body: b, idempotencyKey: k }); }
  del(ref: string, k?: string) { return this.http.request<void>({ method: 'DELETE', path: `/webhook-endpoints/${ref}`, idempotencyKey: k }); }
  rotateSecret(ref: string, k?: string) { return this.http.request<T.RotatedSecret>({ method: 'POST', path: `/webhook-endpoints/${ref}/rotate-secret`, idempotencyKey: k }); }
}
export class Events extends Resource {
  list(q: T.ListEvents = {}) { return this.paginate<T.DomainEvent>('/events', q); }
  retrieve(ref: string) { return this.http.request<T.DomainEvent>({ method: 'GET', path: `/events/${ref}` }); }
  catalog() { return this.http.request<Record<string, { when: string; payload: string[] }>>({ method: 'GET', path: '/events/catalog' }); }
}
export class WebhookDeliveries extends Resource {
  list(q: T.ListWebhookDeliveries = {}) { return this.paginate<T.WebhookDelivery>('/webhook-deliveries', q); }
  retrieve(ref: string) { return this.http.request<T.WebhookDelivery>({ method: 'GET', path: `/webhook-deliveries/${ref}` }); }
  replay(ref: string, k?: string) { return this.http.request<T.WebhookDelivery>({ method: 'POST', path: `/webhook-deliveries/${ref}/replay`, idempotencyKey: k }); }
}
export class Metrics extends Resource {
  billing(q: { from?: string; to?: string } = {}) { return this.http.request<T.BillingMetrics>({ method: 'GET', path: '/metrics/billing', query: q }); }
}
export class Health extends Resource {
  live() { return this.http.request<{ status: string }>({ method: 'GET', path: '/health' }); }
  ready() { return this.http.request<{ status: string }>({ method: 'GET', path: '/ready' }); }
}
```

---

## 7. Webhooks (`webhooks.ts`)

Verify the `x-nombaone-signature` and get a typed event. Keeps the raw body for signing.

```ts
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export interface NombaoneEvent<D = Record<string, unknown>> {
  id: string;               // delivery ref (nbo…whd) — DEDUPE on event.id
  type: string;             // 'invoice.paid', 'invoice.action_required', …
  event: { id: string | null; type: string; createdAt: string | null };
  data: D;
}

export class SignatureVerificationError extends Error {}

export class Webhooks {
  /**
   * Verify a delivery. `payload` MUST be the raw request body (string/Buffer), not the
   * parsed object. `secret` is the plaintext signing secret shown once at endpoint create.
   */
  constructEvent<D = Record<string, unknown>>(payload: string | Buffer, signature: string, secret: string): NombaoneEvent<D> {
    const raw = typeof payload === 'string' ? payload : payload.toString('utf8');
    const key = createHash('sha256').update(secret).digest('hex');
    const expected = createHmac('sha256', key).update(raw, 'utf8').digest('hex');
    const a = Buffer.from(expected); const b = Buffer.from(signature ?? '');
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new SignatureVerificationError('signature mismatch');
    return JSON.parse(raw) as NombaoneEvent<D>;
  }
}
```

Express handler (note: mount a **raw** body parser on the webhook route):

```ts
app.post('/nombaone/webhooks', express.raw({ type: 'application/json' }), (req, res) => {
  let event;
  try {
    event = nomba.webhooks.constructEvent(req.body, req.header('x-nombaone-signature')!, process.env.NOMBAONE_WEBHOOK_SECRET!);
  } catch { return res.status(400).send('bad signature'); }

  if (alreadyHandled(event.id)) return res.sendStatus(200); // at-least-once → dedupe on event.id
  switch (event.type) {
    case 'invoice.paid': /* grant access */ break;
    case 'invoice.action_required': {
      const { reference, checkoutLink } = event.data as { reference: string; checkoutLink: string };
      emailCustomer(reference, checkoutLink); // customer completes OTP/3DS
      break;
    }
    case 'subscription.churned': /* revoke access */ break;
    case 'settlement.created': /* reconcile payout ledger */ break;
  }
  res.sendStatus(200);
});
```

---

## 8. Types (`types.ts`, excerpt)

All response DTOs and param shapes mirror the API 1:1. Amounts are kobo.

```ts
export type Environment = 'test' | 'live';

export interface Customer { id: string; email: string; name: string; phone: string | null; metadata: Record<string, unknown>; environment: Environment; createdAt: string; updatedAt: string; }
export interface CreateCustomer { email: string; name: string; phone?: string; metadata?: Record<string, unknown>; }
export interface UpdateCustomer { name?: string; phone?: string | null; metadata?: Record<string, unknown>; }
export interface ListCustomers { email?: string; limit?: number; cursor?: string; }

export interface Price { id: string; planId: string; unitAmount: number; currency: 'NGN'; interval: 'day'|'week'|'month'|'year'; intervalCount: number; usageType: 'licensed'|'metered'; billingScheme: 'per_unit'|'tiered'; trialPeriodDays: number; active: boolean; metadata: Record<string, unknown>; environment: Environment; createdAt: string; }
export interface CreatePrice { unitAmount: number; interval: Price['interval']; intervalCount?: number; usageType?: Price['usageType']; billingScheme?: Price['billingScheme']; trialPeriodDays?: number; metadata?: Record<string, unknown>; }

export interface Subscription { id: string; customerId: string; priceId: string; status: 'incomplete'|'incomplete_expired'|'trialing'|'active'|'past_due'|'paused'|'canceled'; collectionMethod: 'charge_automatically'|'send_invoice'; currentPeriodIndex: number; currentPeriodStart: string | null; currentPeriodEnd: string | null; trialStart: string | null; trialEnd: string | null; cancelAtPeriodEnd: boolean; canceledAt: string | null; endedAt: string | null; cancellationReason: 'voluntary'|'involuntary'|null; defaultPaymentMethodId: string | null; items: { id: string; priceId: string; quantity: number }[]; latestInvoiceId: string | null; currency: 'NGN'; environment: Environment; createdAt: string; }
export interface CreateSubscription { customerId: string; priceId: string; paymentMethodId?: string; collectionMethod?: 'charge_automatically'|'send_invoice'; trialDays?: number; quantity?: number; metadata?: Record<string, unknown>; }
export interface ChangeSubscription { priceId?: string; quantity?: number; intervalSwitch?: boolean; prorationBehavior?: 'create_prorations'|'none'; }
export interface CancelSubscription { mode: 'now'|'at_period_end'; comment?: string; }

export interface Invoice { id: string; customerId: string; subscriptionId: string | null; status: 'draft'|'open'|'partially_paid'|'paid'|'void'|'uncollectible'; billingReason: 'subscription_create'|'subscription_cycle'|'subscription_update'|'manual'; subtotal: number; discountTotal: number; creditTotal: number; total: number; amountDue: number; amountPaid: number; amountRemaining: number; currency: 'NGN'; periodStart: string | null; periodEnd: string | null; dueDate: string | null; lineItems: { id: string; kind: string; description: string; amount: number; quantity: number }[]; finalizedAt: string | null; paidAt: string | null; voidedAt: string | null; environment: Environment; createdAt: string; }

export interface PaymentMethod { id: string; customerId: string; kind: 'card'|'mandate'|'virtual_account'; status: 'setup_pending'|'consent_pending'|'active'|'removed'|'expired'; isDefault: boolean; brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null; environment: Environment; createdAt: string; updatedAt: string; }
export interface CheckoutSetup { reference: string; checkoutLink: string; }
export interface MandateSetup { reference: string; mandateRef: string; status: string; consentInstruction: string; }
export interface VirtualAccount { reference: string; bankName: string; accountNumber: string; accountName: string; accountRef: string; }
export interface CreateMandate { customerRef: string; customerAccountNumber: string; bankCode: string; customerName: string; customerAccountName: string; customerPhoneNumber: string; customerAddress: string; narration: string; maxAmount: number; frequency?: 'VARIABLE'|'WEEKLY'|'EVERY_TWO_WEEKS'|'MONTHLY'|'EVERY_TWO_MONTHS'|'EVERY_THREE_MONTHS'|'EVERY_FOUR_MONTHS'|'EVERY_SIX_MONTHS'|'EVERY_TWELVE_MONTHS'; startDate?: string; endDate?: string; }

export interface Settlement { id: string; invoiceReference: string | null; subAccountRef: string; splitReference: string | null; merchantTxRef: string; grossKobo: number; platformFeeKobo: number; netToTenantKobo: number; status: 'pending'|'settled'|'reconciled'|'failed'|'refunded'; createdAt: string; }
export interface Refund { id: string; settlementReference: string; subAccountRef: string; amountKobo: number; status: 'pending'|'ledger_only'|'succeeded'|'failed'; providerReference: string | null; createdAt: string; }
export interface Payout { id: string; subAccountRef: string; amountKobo: number; bankCode: string; accountNumber: string; resolvedAccountName: string | null; status: 'pending'|'ledger_posted'|'succeeded'|'failed'; providerReference: string | null; failureReason: string | null; createdAt: string; }
export interface Escrow { lockedKobo: number; since: string; balanceKobo: number; minWithdrawableKobo: number; availableKobo: number; }
export interface CreatePayout { amountKobo: number; bankCode: string; accountNumber: string; }

// …Plan, Coupon, Discount, CreditGrant, CreditBalance, DunningState, DunningAttempt,
//   UpcomingInvoice, DomainEvent, WebhookEndpoint, WebhookDelivery, RotatedSecret,
//   TenantSettings, BillingSettings, BillingMetrics + their param shapes follow the same 1:1 pattern.
```

---

## 9. End-to-end example

```ts
import { Nombaone, RateLimitError } from '@nombaone/node';
const nomba = new Nombaone({ apiKey: process.env.NOMBAONE_API_KEY! });

// 1. Catalogue
const plan = await nomba.plans.create({ name: 'Pro' });
const price = await nomba.plans.createPrice(plan.id, { unitAmount: 500_000, interval: 'month' }); // ₦5,000/mo

// 2. Customer + a saved card (hosted checkout)
const customer = await nomba.customers.create({ email: 'ada@acme.io', name: 'Ada Payer' });
const setup = await nomba.paymentMethods.setupCard({ customerRef: customer.id, amount: 5_000, callbackUrl: 'https://acme.io/return' });
//   → redirect the customer to setup.checkoutLink; the card is captured via `payment_method.attached`.

// 3. Subscribe (once the card is active)
const sub = await nomba.subscriptions.create({ customerId: customer.id, priceId: price.id, paymentMethodId: /* captured pmt ref */ 'nbo…pmt' });

// 4. Stream all past-due subscriptions
for await (const s of nomba.subscriptions.list({ status: 'past_due' })) {
  const dunning = await nomba.subscriptions.dunning(s.id);
  if (dunning.status === 'card_update_required') {/* prompt the customer to re-auth */}
}

// 5. Refund a settlement's tenant share, then withdraw
const stl = (await nomba.settlements.list({ status: 'settled' }).page()).data[0];
if (stl) await nomba.settlements.refund(stl.id);          // full tenant-share refund, idempotent
const escrow = await nomba.settlements.escrow();
if (escrow.availableKobo > 0) {
  await nomba.settlements.payout({ amountKobo: escrow.availableKobo, bankCode: '058', accountNumber: '0123456789' });
}
```

---

## Notes on parity & guarantees

- **Idempotency is automatic** for every mutating call — the SDK generates a stable
  `Idempotency-Key` and reuses it across retries, so a retried `POST` never double-charges.
  Pass your own key to make it idempotent across process restarts.
- **Retries** cover 429 (honouring `Retry-After`), 5xx, and network errors, with jittered
  backoff, bounded by `maxRetries`.
- **All amounts are integer kobo**; there is no floating-point money in the SDK.
- **Pagination** is lazy — `for await (…)` fetches pages on demand; `.toArray()` collects
  (guarded). Never construct cursors by hand.
- **Webhooks are at-least-once** — always `constructEvent` to verify, then dedupe on `event.id`.
