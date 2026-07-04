import type { Mode } from './common';

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
