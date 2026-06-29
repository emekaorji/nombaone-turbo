import type { ExampleRow } from '@nombaone/core-db/schema';

import { CURRENCY } from '../money';
import type { ExampleResponseData, ExampleStatus } from './types';

/**
 * ── The serializer paradigm: the wire shape is assembled in ONE place ──
 *
 * A serializer is the only bridge between an internal db row and the public DTO.
 * Two rules it enforces for the whole money path:
 *
 *   1. The public `id` is the resource's stable `reference` (`nbo…exa`), NEVER
 *      the internal UUID PK. The UUID never leaves the domain.
 *   2. `status` is DERIVED — it is computed by the caller from the LEDGER (the
 *      single source of truth for money state) and handed in, rather than read
 *      from a column that could silently drift. The `examples` table has no
 *      `status` column by design; this signature makes that explicit by forcing
 *      the caller to supply a freshly-derived status.
 *
 * Money is emitted as integer kobo with a fixed `NGN` currency tag.
 */
export const serializeExample = (
  row: ExampleRow,
  status: ExampleStatus
): ExampleResponseData => ({
  id: row.reference,
  kind: row.kind,
  status,
  amount: row.amount,
  currency: CURRENCY,
  environment: row.environment,
  createdAt: new Date(row.createdAt).toISOString(),
});
