import type { PlanRow } from '@nombaone/core-db/schema';

import type { PlanResponseData } from './types';

/** Bridge the internal `plans` row to the public DTO: id = the public reference
 * (`nbo…pln`), timestamps ISO-8601 UTC. */
export const serializePlan = (row: PlanRow): PlanResponseData => ({
  id: row.reference,
  name: row.name,
  description: row.description,
  status: row.status,
  metadata: row.metadata,
  environment: row.environment,
  createdAt: new Date(row.createdAt).toISOString(),
  updatedAt: new Date(row.updatedAt).toISOString(),
});
