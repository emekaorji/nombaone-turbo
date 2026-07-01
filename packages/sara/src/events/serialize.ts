import type { DomainEventRow } from '@nombaone/core-db/schema';
import type { DomainEventResponseData } from '@nombaone/core-contracts/types';

export const serializeDomainEvent = (row: DomainEventRow): DomainEventResponseData => ({
  id: row.reference,
  type: row.type,
  payload: row.payload,
  createdAt: row.createdAt.toISOString(),
});
