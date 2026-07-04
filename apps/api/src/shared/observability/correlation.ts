import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * ── Correlation context (item 5 / M / H8 / M1) ─────────────────────────────
 *
 * A per-flow bag of identifiers carried IMPLICITLY across every `await` via
 * `AsyncLocalStorage`, so a log line emitted deep inside a request or a job does
 * not have to thread the ids through every call. Every HTTP request and every
 * background job runs inside a store; the Winston logger mixes these fields onto
 * every line (see `logger.ts`), which makes the whole log stream filterable by
 * `correlationId` (one flow) and by `{organizationId, environment}` (one tenant).
 *
 * The store object is MUTABLE in place: a request enters with just a
 * `correlationId`, then `setCorrelationFields({ organizationId, environment })`
 * fills the tenant in once auth resolves — later log lines pick it up.
 */
export interface CorrelationFields {
  /** The single id that ties one request or job's log lines together. */
  correlationId: string;
  /** The tenant, once known (HTTP: after apiKeyAuth; jobs: from job data). */
  organizationId?: string;
  mode?: string;
  /** The job/queue name for a background flow (absent for HTTP). */
  task?: string;
}

const store = new AsyncLocalStorage<CorrelationFields>();

/** Run `fn` (and everything it awaits) inside a correlation context. */
export const runWithCorrelation = <T>(fields: CorrelationFields, fn: () => T): T =>
  store.run(fields, fn);

/** The current context, or `undefined` outside any request/job. */
export const getCorrelation = (): CorrelationFields | undefined => store.getStore();

/** Merge fields into the CURRENT context (no-op if there is none). */
export const setCorrelationFields = (fields: Partial<CorrelationFields>): void => {
  const current = store.getStore();
  if (current) Object.assign(current, fields);
};
