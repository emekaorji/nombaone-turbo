import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// Load .env BEFORE any singleton (db pool, redis) binds, so they read real values.
loadDotenv();

/**
 * Zod-validated env schema that fails fast at boot — a misconfigured deploy
 * crashes loudly instead of serving the wrong environment. Every deployment is
 * pinned to exactly one `INFRA_ENVIRONMENT`; use a SEPARATE database per env.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(9040),
  INFRA_ENVIRONMENT: z.enum(['test', 'live']),
  INFRA_DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  INFRA_PII_ENCRYPTION_KEY: z.string().min(1),
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
   * Nomba provider credentials (contract C.8). Optional so the API can boot for
   * the catalog/customer surfaces without them; the rail adapters + live charge
   * path are only wired when present. Secrets live HERE (env / secret manager),
   * never in source. The set must match the deployment's `INFRA_ENVIRONMENT`.
   */
  NOMBA_BASE_URL: z.string().url().optional(),
  NOMBA_PARENT_ACCOUNT_ID: z.string().min(1).optional(),
  NOMBA_SUBACCOUNT_ID: z.string().min(1).optional(),
  NOMBA_CLIENT_ID: z.string().min(1).optional(),
  NOMBA_CLIENT_SECRET: z.string().min(1).optional(),
  NOMBA_WEBHOOK_SIGNATURE_KEY: z.string().min(1).optional(),
  NOMBA_TOKEN_REFRESH_MARGIN_SEC: z.coerce.number().int().positive().default(300),
});

export const env = envSchema.parse(process.env);
export type Env = typeof env;
