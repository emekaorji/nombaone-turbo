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

/**
 * A sandbox key means TEST MODE: deterministic cards, no real money.
 *
 * (Lives here rather than in actions.ts because a `'use server'` module may only export
 * async functions — exporting a boolean from one makes Next treat it as a callable server
 * action and refuse to start.)
 */
export const SANDBOX = (process.env.NOMBAONE_API_KEY ?? '').startsWith('nbo_sandbox_');

/** Where this app is reachable — the hosted-checkout callback origin. */
export function gymBaseUrl(): string {
  return (process.env.GYM_BASE_URL || 'http://localhost:8060').replace(/\/$/, '');
}

/* ------------------------------------------------------------------ */
/* The catalog: 3 memberships                                          */
/* ------------------------------------------------------------------ */

export interface GymPlanDef {
  key: 'full-access' | 'elite' | 'flex';
  /** Plan name on the platform — unique per organization. Never shown to a member. */
  name: string;
  /** What a member actually calls it. */
  displayName: string;
  description: string;
  /** Integer kobo (₦1.00 = 100). */
  amountInKobo: number;
  interval: PriceInterval;
  intervalCount: number;
  /** One line under the price. */
  tagline: string;
  /** What you get. Rendered as bullets. */
  features: string[];
  /** The commercial nudge, if any. */
  badge?: string;
  /** Flex is sold differently — it is not a membership, it is floor time. */
  isFlex?: boolean;
}

/**
 * Iron Republic's memberships. Three, and the Flex Pass leads.
 *
 * ── About the Flex Pass ──────────────────────────────────────────────────────
 * `minute × 10` is a REAL cadence in the engine, and here it is a REAL product: ₦100 for ten
 * minutes on the floor, charged again every ten minutes until you stop it. Nothing about it is a
 * simulation, and every sentence we print about it is literally true — which is exactly why it is
 * the best demonstration of what this billing engine does. A member (or a judge) joins it, sits
 * down, and watches a genuine renewal land in their payments list while they wait.
 *
 * ⚠ The price is deliberately small because THIS RUNS ON LIVE KEYS. ₦100 every ten minutes is real
 * naira leaving a real card, on a real Nigerian rail, until someone cancels. Keep it that way.
 *
 * ⚠ Changing an amount here does NOT mutate the price on the platform — prices are immutable.
 * `bootstrapCatalog` matches an existing price on (amount, interval, intervalCount) and CREATES a
 * new one when no match exists, leaving the old price alive for anyone still subscribed to it.
 */
export const GYM_PLANS: GymPlanDef[] = [
  {
    key: 'flex',
    name: 'Iron Republic Flex Pass',
    displayName: 'Flex Pass',
    description: 'Pay-as-you-train floor time, charged every 10 minutes.',
    amountInKobo: 10_000, // ₦100
    interval: 'minute',
    intervalCount: 10,
    tagline: 'Just passing through? Pay for the time you actually use.',
    features: [
      '₦100 to get on the floor',
      '₦100 again every 10 minutes you stay',
      'Stop it yourself the moment you are done',
      'No membership, no commitment',
    ],
    badge: 'Most popular',
    isFlex: true,
  },
  {
    key: 'full-access',
    name: 'Iron Republic Full Access',
    displayName: 'Full Access',
    description: 'Full club access, any hour, seven days.',
    amountInKobo: 3_500_000, // ₦35,000
    interval: 'month',
    intervalCount: 1,
    tagline: 'Best for most people. Train whenever you can get here.',
    features: [
      'Gym floor, all hours, 7 days',
      'All classes and technique clinics',
      'Locker, shower, towel',
      'Bring a friend once a month, free',
    ],
  },
  {
    key: 'elite',
    name: 'Iron Republic Elite',
    displayName: 'Iron Elite',
    description: 'Full access plus one-on-one coaching.',
    amountInKobo: 7_500_000, // ₦75,000
    interval: 'month',
    intervalCount: 1,
    tagline: 'Best if you want a coach in your corner.',
    features: [
      'Everything in Full Access',
      'Two one-on-one sessions a month',
      'A written programme, updated monthly',
      'Four guest passes',
    ],
  },
];

/** Find a plan definition by the price the member picked. */
export function planDefForPrice(cat: GymCatalog, priceId: string): GymPlanDef | undefined {
  return cat.find((entry) => entry.price.id === priceId)?.def;
}

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
