import type { Mode } from './common';
import type { PriceResponseData } from './price';

/**
 * PLAN DTO — a tenant's product/offering. The public `id` is the stable
 * `reference` (`nbo…pln`); `status` is the catalog lifecycle. Timestamps ISO-8601.
 */
export type PlanStatus = 'active' | 'archived';

export interface PlanResponseData {
  domain: 'plan'; // response object-type discriminator
  id: string; // public reference, e.g. `nbo749201835566pln`
  name: string;
  description: string | null;
  status: PlanStatus;
  metadata: Record<string, unknown>;
  mode: Mode;
  createdAt: string;
  updatedAt: string;
}

/**
 * The `POST /v1/plans` DTO: the plan PLUS the prices created with it in the same
 * atomic call, in the order they were submitted (a client can zip request and
 * response). `prices` is ALWAYS present — `[]` when none were embedded — so a
 * caller never branches on `undefined`.
 *
 * Deliberately NOT folded into `PlanResponseData`: the plan reads (get/list/patch/
 * archive) do not carry prices, and advertising a field they never return would be
 * a lie in every generated SDK.
 */
export interface PlanWithPricesResponseData extends PlanResponseData {
  prices: PriceResponseData[];
}
