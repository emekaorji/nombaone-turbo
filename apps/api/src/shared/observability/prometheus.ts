import client from 'prom-client';

import { redis } from '@shared/config/redis';

import type { RequestHandler } from 'express';

/**
 * ── Prometheus metrics (item 5 / M) ────────────────────────────────────────
 *
 * A single process-scoped registry exposed at `GET /metrics` (mounted outside
 * `/v1`, before auth — the payload is process telemetry, never tenant data). It
 * carries the Node/process default metrics plus three product signals:
 *
 *   • `http_request_duration_seconds` — a histogram over every HTTP request,
 *     labelled by method / normalized route / status class.
 *   • `nombaone_charge_failures_total` — a counter incremented whenever a billing
 *     cycle ends `past_due` (a collection attempt failed → dunning begins).
 *   • `nombaone_scheduler_lag_seconds` — a gauge, per sweep, of how long it has
 *     been since that sweep last completed successfully. Each sweep handler
 *     writes a completion marker to Redis; the gauge reads them at scrape time,
 *     so a stalled/skipped scheduler shows a rising lag.
 */
export const registry = new client.Registry();

client.collectDefaultMetrics({ register: registry });

/** Per-request latency + volume. Route is the matched PATTERN (low cardinality). */
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

/** Failed collection attempts (billing cycle → `past_due`), by reason. */
export const chargeFailuresTotal = new client.Counter({
  name: 'nombaone_charge_failures_total',
  help: 'Count of billing charge attempts that failed (invoice went past_due)',
  labelNames: ['reason'] as const,
  registers: [registry],
});

/** Increment the charge-failure counter (called from the billing worker). */
export const recordChargeFailure = (reason = 'past_due'): void => {
  chargeFailuresTotal.inc({ reason });
};

/** Nomba reconcile discrepancies, by class (item 6). A rising count is the signal
 *  that local state and Nomba are drifting — alert on it. */
export const reconcileDiscrepanciesTotal = new client.Counter({
  name: 'nombaone_reconcile_discrepancies_total',
  help: 'Count of local↔Nomba reconcile discrepancies, by class',
  labelNames: ['class'] as const,
  registers: [registry],
});

/** Self-heals performed by the nightly reconcile (settled-at-Nomba invoices re-driven). */
export const reconcileHealedTotal = new client.Counter({
  name: 'nombaone_reconcile_healed_total',
  help: 'Count of invoices self-healed by the nightly Nomba reconcile',
  registers: [registry],
});

export const recordReconcileDiscrepancy = (klass: string): void => {
  reconcileDiscrepanciesTotal.inc({ class: klass });
};
export const recordReconcileHealed = (): void => {
  reconcileHealedTotal.inc();
};

// ── Scheduler lag ────────────────────────────────────────────────────────────

/**
 * The sweeps whose freshness we track.
 *
 * ⚠ A name here only produces a gauge if the handler actually calls `markSweepCompleted`. Seven of
 * the eleven cron handlers — including `settlement-sweep` and `ledger-reconcile` — still call it
 * from nowhere, so a silent death in any of them is invisible. Worth closing; tracked separately.
 */
export const TRACKED_SWEEPS = [
  'billing-sweep',
  'dunning-sweep',
  'lifecycle-sweep',
  'webhook-maintenance',
  // The primary settle path on a provider that never calls us back. If this stops ticking, paying
  // customers simply stop being let in — silently, and with no error anywhere.
  'awaiting-payment-sweep',
] as const;
export type TrackedSweep = (typeof TRACKED_SWEEPS)[number];

const sweepKey = (sweep: string): string => `scheduler:last_sweep:${sweep}`;

/** Record that a sweep completed successfully (Redis marker read by the gauge). */
export const markSweepCompleted = async (sweep: TrackedSweep): Promise<void> => {
  await redis.set(sweepKey(sweep), Date.now().toString());
};

/**
 * Gauge of seconds since each tracked sweep last completed. The value is read
 * lazily at scrape time from the Redis markers, so no background timer is needed
 * and a scheduler that stops ticking shows a monotonically rising lag. A sweep
 * that has never completed reports no sample (rather than a misleading 0).
 */
export const schedulerLag = new client.Gauge({
  name: 'nombaone_scheduler_lag_seconds',
  help: 'Seconds since each scheduler sweep last completed successfully',
  labelNames: ['sweep'] as const,
  registers: [registry],
  async collect() {
    const keys = TRACKED_SWEEPS.map(sweepKey);
    const values = await redis.mget(...keys);
    const now = Date.now();
    TRACKED_SWEEPS.forEach((sweep, i) => {
      const raw = values[i];
      if (raw == null) return; // never completed → no sample
      const last = Number(raw);
      if (!Number.isFinite(last)) return;
      this.set({ sweep }, Math.max(0, (now - last) / 1000));
    });
  },
});

/** Observe every HTTP request's duration. Mount early; reads the matched route on finish. */
export const httpMetrics: RequestHandler = (req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.baseUrl || 'unmatched';
    end({ method: req.method, route, status: String(res.statusCode) });
  });
  next();
};

/** Express handler serving the Prometheus exposition payload. */
export const metricsHandler: RequestHandler = async (_req, res) => {
  res.setHeader('Content-Type', registry.contentType);
  res.end(await registry.metrics());
};
