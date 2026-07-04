/**
 * Every deployment is pinned to exactly one environment. The per-org secret API
 * key embeds it (`nbo_sandbox_` / `nbo_live_`); use a SEPARATE database per
 * environment in production.
 */
export type Mode = 'sandbox' | 'live';

/** Money is ALWAYS integer minor units (kobo). ₦1.00 = 100. Never a float. */
export type Kobo = number;
