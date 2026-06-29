import { eq } from 'drizzle-orm';

import { platformConfigTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { db } from '../config/db';
import { logger } from '../observability/logger';

import type { RequestHandler } from 'express';

/**
 * ── platformGate — the global kill-switch / maintenance gate ───────────────
 *
 * A single `platform_config` row (`key = 'maintenance'`) can pause mutating
 * traffic platform-wide without a redeploy: set its `value` to `{ enabled: true,
 * message? }` and every gated request gets 503 PLATFORM_MAINTENANCE.
 *
 * Three properties make this cheap and safe to put in front of every mutation:
 *
 *   1. TTL CACHE — the value is read at most once per `CACHE_TTL_MS`, so the
 *      gate adds at most one tiny indexed read every few seconds, not one per
 *      request.
 *   2. IN-FLIGHT DEDUP — concurrent cache misses share ONE database read via a
 *      shared promise, so a cold cache under load cannot stampede the DB.
 *   3. FAIL-OPEN — if the read fails (DB blip), we serve the last known value,
 *      or `off` if we have never read one. A monitoring-table outage must never
 *      take down the whole API.
 *
 * Matched to MUTATING paths only (`isMutating`): reads stay available during
 * maintenance so dashboards/integrations can still inspect state.
 */

interface MaintenanceState {
  enabled: boolean;
  message?: string;
}

/** Re-read the kill-switch at most this often. */
const CACHE_TTL_MS = 5_000;
const MAINTENANCE_KEY = 'maintenance';

let cached: { value: MaintenanceState; readAt: number } | null = null;
let inFlight: Promise<MaintenanceState> | null = null;

const parseMaintenance = (value: unknown): MaintenanceState => {
  if (typeof value === 'object' && value !== null) {
    const record = value as { enabled?: unknown; message?: unknown };
    return {
      enabled: record.enabled === true,
      message: typeof record.message === 'string' ? record.message : undefined,
    };
  }
  return { enabled: false };
};

/** Read the switch through the TTL cache, deduping concurrent misses. */
const readMaintenance = async (): Promise<MaintenanceState> => {
  const now = Date.now();
  if (cached && now - cached.readAt < CACHE_TTL_MS) {
    return cached.value;
  }
  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    const [row] = await db
      .select({ value: platformConfigTable.value })
      .from(platformConfigTable)
      .where(eq(platformConfigTable.key, MAINTENANCE_KEY))
      .limit(1);
    const value = parseMaintenance(row?.value);
    cached = { value, readAt: Date.now() };
    return value;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
};

/** A request that can change state — gated. Safe reads pass through. */
const isMutating = (method: string): boolean =>
  method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';

export const platformGate: RequestHandler = async (req, _res, next) => {
  if (!isMutating(req.method)) {
    next();
    return;
  }

  let state: MaintenanceState;
  try {
    state = await readMaintenance();
  } catch (error) {
    // FAIL-OPEN: serve the last known value, else assume the gate is off. A
    // config-table outage must not block all writes.
    logger.warn(`[api] ${req.requestId} platform-gate read failed; failing open`, {
      error: error instanceof Error ? error.message : String(error),
    });
    state = cached?.value ?? { enabled: false };
  }

  if (state.enabled) {
    next(
      AppError.ServiceUnavailable(
        state.message ?? 'The platform is temporarily in maintenance mode',
        undefined,
        NOMBAONE_ERROR_CODES.PLATFORM_MAINTENANCE
      )
    );
    return;
  }

  next();
};
