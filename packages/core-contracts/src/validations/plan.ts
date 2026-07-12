import { z } from 'zod';

import { createPriceBody, type CreatePriceBody } from './price';

/** How many prices one `POST /v1/plans` may embed. A catalog offers a handful of
 *  cadences; past that, keep versioning at `POST /v1/plans/:id/prices`. */
export const MAX_EMBEDDED_PRICES = 10;

/**
 * Reject two prices with the SAME `(interval, intervalCount)` cadence inside one
 * embedded array. The DB has NO uniqueness on `(plan_id, interval, interval_count)`
 * and `active` defaults to `true`, so two active monthly prices on one plan is an
 * ambiguous catalog state — nothing downstream can say which one the pricing page
 * should show. Inside a single array the check is free (pure, no DB round-trip),
 * so we close it at the boundary.
 *
 * HONEST LIMIT: this does NOT close the hole globally. `POST /v1/plans/:id/prices`
 * can still add a second active monthly price to the same plan a minute later; only
 * a partial unique index on `(plan_id, interval, interval_count) WHERE active` can
 * do that, and that is a FOLLOW-UP migration, not this change.
 *
 * Runs AFTER the element parse, so `intervalCount` carries its default — i.e.
 * `{ interval: 'month' }` and `{ interval: 'month', intervalCount: 1 }` collide,
 * which is exactly right.
 */
const rejectDuplicateCadence = (prices: CreatePriceBody[], ctx: z.RefinementCtx): void => {
  const firstSeenAt = new Map<string, number>();
  prices.forEach((price, index) => {
    const cadence = `${price.interval}:${price.intervalCount}`;
    const first = firstSeenAt.get(cadence);
    if (first !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, 'interval'],
        message: `duplicate cadence: every ${price.intervalCount} ${price.interval} is already priced at prices[${first}]`,
      });
      return;
    }
    firstSeenAt.set(cadence, index);
  });
};

/** PLAN input schemas. */
export const createPlanBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  /**
   * ONE INTENT = ONE CALL: a plan and the prices it sells at are created together,
   * atomically (either every row lands or none does). The element schema IS
   * `createPriceBody` — the same one `POST /v1/plans/:id/prices` enforces — so the
   * embedded path and the nested route cannot drift apart. It carries no `planId`
   * (the plan is the one being created) and no `currency` (pinned NGN).
   *
   * Omit the key entirely for a plan with no prices yet. An EMPTY array is a client
   * bug (`prices: formRows` where the form collected nothing) — a 422 names it
   * rather than silently creating an unbillable plan.
   */
  prices: z
    .array(createPriceBody)
    .min(1)
    .max(MAX_EMBEDDED_PRICES)
    .superRefine(rejectDuplicateCadence)
    .optional(),
});
export type CreatePlanBody = z.infer<typeof createPlanBody>;

export const updatePlanBody = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'at least one field must be provided',
  });
export type UpdatePlanBody = z.infer<typeof updatePlanBody>;

export const listPlanQuery = z.object({
  status: z.enum(['active', 'archived']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type ListPlanQuery = z.infer<typeof listPlanQuery>;
