import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// Load .env BEFORE any singleton (db pool, redis) binds, so they read real values.
loadDotenv();

/**
 * Zod-validated env schema that fails fast at boot — a misconfigured deploy
 * crashes loudly.
 *
 * TWO orthogonal axes (never conflate again):
 *  • `INFRA_ENVIRONMENT` = the DEPLOYMENT ring (`development` | `production`) —
 *    picks the DB, secrets, log level. Merchants never see it. `development` is
 *    local-only. ONE deployment serves BOTH modes.
 *  • `mode` (`sandbox` | `live`) = the per-request ACCOUNT partition, derived from
 *    the API-key prefix into `ctx.mode`. Never a deployment.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8000),
  INFRA_ENVIRONMENT: z.enum(['development', 'production']).default('development'),
  INFRA_DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  INFRA_PII_ENCRYPTION_KEY: z.string().min(1),
  /**
   * Host-based key guard (DX safety, NOT the isolation boundary — that's the key
   * prefix + RLS). A request that arrives on the LIVE host must carry a `nbo_live_`
   * key, and one on the SANDBOX host a `nbo_sandbox_` key — so a developer can't
   * accidentally use the wrong key against the wrong URL. Both hosts are the SAME
   * deployment (a CNAME alias); this only inspects the client-facing hostname.
   * A request whose host matches NEITHER (localhost, tunnels, DO-internal, tests)
   * is NOT enforced — the guard fails OPEN, never locking out real traffic. Set a
   * value to `''` to disable that side.
   */
  INFRA_LIVE_API_HOST: z.string().default('api.nombaone.xyz'),
  INFRA_SANDBOX_API_HOST: z.string().default('sandbox.api.nombaone.xyz'),
  /**
   * Shared secret used to verify INBOUND provider webhooks (the `/inbound/:provider`
   * route HMACs the raw body against this). One secret per deployment keeps the
   * generic boilerplate simple; a multi-provider build resolves a per-provider
   * secret from a map instead. Optional so the main API can boot without it (the
   * webhook sub-app rejects deliveries when it is unset).
   */
  INFRA_WEBHOOK_SECRET: z.string().min(1).optional(),
  /** Local-only escape hatch to skip the global IP rate limiter. Never in prod. */
  DISABLE_API_RATE_LIMIT: z
    .string()
    .optional()
    .transform((value) => value === 'true' || value === '1'),

  /**
   * Nomba provider credentials (contract C.8), split by ACCOUNT MODE so ONE
   * deployment serves both. `getNombaClient(mode)` picks the matching set;
   * a `sandbox` charge can never reach the `live` Nomba and vice-versa. Both
   * sets are optional so the API can boot for the catalog/customer surfaces
   * without them (each mode's rails wire only when that mode's set is present).
   * Secrets live HERE (env / secret manager), never in source. The `live` set is
   * only USABLE on `INFRA_ENVIRONMENT=production` (guarded in `getNombaClient`),
   * so a dev laptop cannot touch live money even if a live key leaks into its env.
   */
  // NOTE: there is deliberately NO *_SUBACCOUNT_ID key. A sub-account belongs to
  // a MERCHANT, not a deployment — it is provisioned per organization into
  // `org_nomba_accounts` and resolved per request (`findTenantSubAccount`).
  NOMBA_SANDBOX_BASE_URL: z.string().url().optional(),
  NOMBA_SANDBOX_PARENT_ACCOUNT_ID: z.string().min(1).optional(),
  NOMBA_SANDBOX_CLIENT_ID: z.string().min(1).optional(),
  NOMBA_SANDBOX_CLIENT_SECRET: z.string().min(1).optional(),
  NOMBA_LIVE_BASE_URL: z.string().url().optional(),
  NOMBA_LIVE_PARENT_ACCOUNT_ID: z.string().min(1).optional(),
  NOMBA_LIVE_CLIENT_ID: z.string().min(1).optional(),
  NOMBA_LIVE_CLIENT_SECRET: z.string().min(1).optional(),
  // Inbound-webhook HMAC keys, per mode. One inbound endpoint serves both modes
  // (sandbox.api is a CNAME alias of api), so the controller can't know the mode
  // before verifying — it tries every configured key and accepts on any match.
  NOMBA_SANDBOX_WEBHOOK_SIGNATURE_KEY: z.string().min(1).optional(),
  NOMBA_LIVE_WEBHOOK_SIGNATURE_KEY: z.string().min(1).optional(),
  NOMBA_TOKEN_REFRESH_MARGIN_SEC: z.coerce.number().int().positive().default(300),
  // Tenant PAYOUT — does the merchant's withdrawal actually reach their bank?
  // OFF ⇒ `payoutToTenant` posts the ledger debit and records `ledger_posted` but sends
  // NO money: the merchant's balance drops and nothing arrives. That is a lie in the
  // product, so it must be a deliberate, visible choice — never a silent default.
  NOMBA_PAYOUT_ENABLED: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === 'true'),

  /**
   * Billing scheduler (04). A single fixed billing zone + deterministic hour make
   * "due today" one unambiguous instant (B5) for CALENDAR cadences. The lifecycle sweep
   * runs hourly (kept separate so a slow renewal run cannot delay notices).
   *
   * The billing sweep runs EVERY MINUTE. It has to: a WALL-CLOCK cadence (`minute`, e.g.
   * `minute × 10`) is due on the wall clock, and a sweep that only looked once a day would
   * leave a 10-minute plan unbilled for ~144 periods — the cadence exists so a developer can
   * watch a subscription renew in real time, so "we'll look tomorrow" is not an option.
   * This is cheap, not a firehose: the sweep is an indexed `next_billing_at <= now` scan, so
   * on the overwhelming majority of ticks it matches ZERO rows and enqueues nothing. A
   * calendar plan is simply billed AT its boundary now, instead of at the next daily pass.
   */
  BILLING_TIMEZONE: z.string().min(1).default('Africa/Lagos'),
  BILLING_HOUR: z.coerce.number().int().min(0).max(23).default(2),
  BILLING_SWEEP_CRON: z.string().min(1).default('* * * * *'),
  BILLING_BATCH_SIZE: z.coerce.number().int().positive().default(500),
  /**
   * How many periods ONE billing job may drain for a subscription that fell behind (an
   * outage, a deploy, a laptop shut overnight on a `minute` cadence). A RATE LIMIT, not a
   * wall: whatever is left is still due, so the next sweep tick continues. It must never
   * park a subscription — that bug (throw before billing, return without advancing, so
   * `next_billing_at` never moved) killed any plan whose cadence was short enough to run
   * past a period count: 36 periods is 3 years of `month` but six HOURS of `minute × 10`.
   */
  BILLING_MAX_CATCH_UP_PERIODS: z.coerce.number().int().positive().default(36),
  LIFECYCLE_SWEEP_CRON: z.string().min(1).default('0 * * * *'),
  DUNNING_SWEEP_CRON: z.string().min(1).default('*/15 * * * *'),
  WEBHOOK_MAINTENANCE_CRON: z.string().min(1).default('*/15 * * * *'),
  // Nightly local↔Nomba reconcile (item 6) — 02:00 daily by default; the window
  // looks back a little over a day so consecutive runs overlap and nothing is missed.
  RECONCILE_NOMBA_CRON: z.string().min(1).default('0 2 * * *'),
  RECONCILE_NOMBA_WINDOW_HOURS: z.coerce.number().int().positive().default(26),
  // Mandate activation sweep (direct debit): poll `consent_pending` mandates → active.
  MANDATE_ACTIVATION_SWEEP_CRON: z.string().min(1).default('*/10 * * * *'),
  // Request-log retention: daily prune of API request logs older than the window.
  REQUEST_LOG_RETENTION_CRON: z.string().min(1).default('30 3 * * *'),
  REQUEST_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  INCOMPLETE_EXPIRY_WINDOW_HOURS: z.coerce.number().int().positive().default(24),
  TRIAL_NOTICE_WINDOW_HOURS: z.coerce.number().int().positive().default(72),
  PM_EXPIRY_NOTICE_WINDOW_DAYS: z.coerce.number().int().positive().default(14),

  /**
   * Renewal reminders + the send_invoice overdue sweep run every minute: both
   * scan an indexed timestamp window and match zero rows on most ticks, and a
   * `minute × 10` cadence needs minute-level lead times (a lead is capped at
   * one period length, so short cadences self-shrink it).
   */
  RENEWAL_REMINDER_CRON: z.string().min(1).default('* * * * *'),
  OVERDUE_INVOICE_SWEEP_CRON: z.string().min(1).default('* * * * *'),
  /**
   * Daily settlement sweep — 06:00 UTC = 07:00 Africa/Lagos, so a merchant's money is in
   * their bank before the business day opens. NOT per-payment: Nomba's flat NIP fee makes
   * per-payment sweeping cost a small merchant 1-5% of revenue, and its 5-transfers/minute
   * per-recipient cap would reject most of them anyway.
   */
  SETTLEMENT_SWEEP_CRON: z.string().min(1).default('0 6 * * *'),
  /** Nightly ledger audit — 02:30 UTC, after the day's billing has settled. */
  LEDGER_RECONCILE_CRON: z.string().min(1).default('30 2 * * *'),

  // ── End-customer comms (email) ─────────────────────────────────────────────
  // `log` prints instead of sending — the safe default everywhere; `resend`
  // requires RESEND_API_KEY. Mail must never be a boot dependency.
  COMMS_TRANSPORT: z.enum(['resend', 'log']).default('log'),
  RESEND_API_KEY: z.string().min(1).optional(),
  // Our VERIFIED Resend domain. `onboarding@resend.dev` is Resend's shared sandbox
  // sender: it can ONLY deliver to the account owner's own address and 403s for every
  // real customer — so it must never be the default, or production would silently fail
  // to reach a single subscriber.
  COMMS_FROM: z.string().min(1).default('Nomba One <billing@mail.nombaone.xyz>'),
  // Signed end-customer action links (/i, /pm in apps/checkout). Unset ⇒ emails
  // go out without action URLs (degraded, never broken).
  INFRA_ACTION_TOKEN_SECRET: z.string().min(16).optional(),
  CHECKOUT_BASE_URL: z.string().url().default('http://localhost:8040'),
});

export const env = envSchema.parse(process.env);
export type Env = typeof env;
