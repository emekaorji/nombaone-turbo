/**
 * The ONE place Iron Republic touches the NombaOne platform.
 *
 * Everything goes through the public SDK (`@nombaone/node`) — this app never
 * imports from the monorepo's packages/*; it is the reference merchant that
 * proves the engine through the same surface every external merchant gets.
 *
 * Framework-free on purpose: both the Next.js app and `scripts/scenario.ts`
 * (run under tsx) import from here.
 */
import { Nombaone, ConflictError } from '@nombaone/node';

import type { Customer, Plan, Price, PriceInterval } from '@nombaone/node';

/* ------------------------------------------------------------------ */
/* Client singleton                                                    */
/* ------------------------------------------------------------------ */

type GlobalStore = {
  __gymClient?: Nombaone;
  __gymCatalog?: Promise<GymCatalog>;
};

const store = globalThis as unknown as GlobalStore;

/** The singleton SDK client. Throws with a setup hint if the key is missing. */
export function nombaone(): Nombaone {
  if (!store.__gymClient) {
    const apiKey = process.env.NOMBAONE_API_KEY;
    if (!apiKey) {
      throw new Error(
        'NOMBAONE_API_KEY is not set. Put your merchant sandbox key (nbo_sandbox_…) in examples/gym/.env — see .env.example.',
      );
    }
    store.__gymClient = new Nombaone(apiKey, {
      // Point at the local engine in development; omit in production and the
      // SDK derives the host from the key prefix.
      baseUrl: process.env.NOMBAONE_BASE_URL || undefined,
    });
  }
  return store.__gymClient;
}

/** Where this app is reachable — the hosted-checkout callback origin. */
export function gymBaseUrl(): string {
  return (process.env.GYM_BASE_URL || 'http://localhost:8060').replace(/\/$/, '');
}

/* ------------------------------------------------------------------ */
/* The catalog: 3 memberships                                          */
/* ------------------------------------------------------------------ */

export interface GymPlanDef {
  key: 'day-pass' | 'monthly' | 'annual';
  /** Plan name on the platform — unique per organization. */
  name: string;
  /** Short label shown on the membership card. */
  displayName: string;
  description: string;
  /** Integer kobo (₦1.00 = 100). */
  amountInKobo: number;
  interval: PriceInterval;
  intervalCount: number;
  cadenceLabel: string;
  blurb: string;
}

/**
 * The gym's catalog. The Day Pass runs on the wall-clock `minute × 10`
 * cadence — a real 10-minute billing cycle so a silent renewal can be
 * watched end-to-end without waiting a month.
 */
export const GYM_PLANS: GymPlanDef[] = [
  {
    key: 'day-pass',
    name: 'Iron Republic Day Pass',
    displayName: 'Day Pass',
    description: 'Rolling floor access billed every 10 minutes — the demo cadence.',
    amountInKobo: 50_000, // ₦500.00
    interval: 'minute',
    intervalCount: 10,
    cadenceLabel: 'every 10 minutes',
    blurb: 'Walk in, lift, walk out. Renews every 10 minutes so you can watch the engine bill in real time.',
  },
  {
    key: 'monthly',
    name: 'Iron Republic Monthly',
    displayName: 'Monthly',
    description: 'Full club access, billed monthly.',
    amountInKobo: 500_000, // ₦5,000.00
    interval: 'month',
    intervalCount: 1,
    cadenceLabel: 'per month',
    blurb: 'Every rack, every class, every month. Cancel any time — you keep access to the period you paid for.',
  },
  {
    key: 'annual',
    name: 'Iron Republic Annual',
    displayName: 'Annual',
    description: 'Full club access, billed yearly.',
    amountInKobo: 5_000_000, // ₦50,000.00
    interval: 'year',
    intervalCount: 1,
    cadenceLabel: 'per year',
    blurb: 'Two months free versus monthly. One charge a year, silent renewals, no laps around the front desk.',
  },
];

export interface GymCatalogEntry {
  def: GymPlanDef;
  plan: Plan;
  price: Price;
}

export type GymCatalog = GymCatalogEntry[];

/**
 * Idempotently ensure the gym's plans + prices exist on the platform.
 *
 * Finds each plan by name via `plans.list`; creates it if absent. Then finds
 * an active price matching the amount + cadence via `prices.list`; creates it
 * under the plan via `plans.prices.create` if absent. Safe to call on every
 * boot — it only writes what is missing.
 */
export async function bootstrapCatalog(): Promise<GymCatalog> {
  const client = nombaone();

  const plansByName = new Map<string, Plan>();
  for await (const plan of client.plans.list({ status: 'active', limit: 100 })) {
    plansByName.set(plan.name, plan);
  }

  const catalog: GymCatalog = [];
  for (const def of GYM_PLANS) {
    let plan = plansByName.get(def.name);
    if (!plan) {
      try {
        plan = await client.plans.create({ name: def.name, description: def.description });
      } catch (error) {
        // PLAN_NAME_TAKEN — someone else bootstrapped concurrently. Re-find.
        if (!(error instanceof ConflictError)) throw error;
        for await (const existing of client.plans.list({ status: 'active', limit: 100 })) {
          if (existing.name === def.name) plan = existing;
        }
        if (!plan) throw error;
      }
    }

    let price: Price | undefined;
    for await (const candidate of client.prices.list({ planRef: plan.id, active: true, limit: 100 })) {
      if (
        candidate.unitAmountInKobo === def.amountInKobo &&
        candidate.interval === def.interval &&
        candidate.intervalCount === def.intervalCount
      ) {
        price = candidate;
        break;
      }
    }
    if (!price) {
      price = await client.plans.prices.create(plan.id, {
        unitAmountInKobo: def.amountInKobo,
        interval: def.interval,
        intervalCount: def.intervalCount,
      });
    }

    catalog.push({ def, plan, price });
  }

  return catalog;
}

/**
 * Process-memoized catalog for the UI — bootstraps once per server process
 * instead of on every render. Failures are not cached.
 */
export function catalog(): Promise<GymCatalog> {
  if (!store.__gymCatalog) {
    store.__gymCatalog = bootstrapCatalog().catch((error: unknown) => {
      store.__gymCatalog = undefined;
      throw error;
    });
  }
  return store.__gymCatalog;
}

/* ------------------------------------------------------------------ */
/* Small shared helpers                                                */
/* ------------------------------------------------------------------ */

/** Exact-match customer lookup by email (emails are unique per org + mode). */
export async function findCustomerByEmail(email: string): Promise<Customer | null> {
  const page = await nombaone().customers.list({ email });
  return page.data[0] ?? null;
}

/** Integer kobo → "₦5,000.00". Naira = kobo / 100, converted exactly once, here. */
export function formatNaira(amountInKobo: number): string {
  return `₦${(amountInKobo / 100).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
