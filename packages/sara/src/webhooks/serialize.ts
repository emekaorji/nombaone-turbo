import type { WebhookDeliveryRow, WebhookEndpointRow } from '@nombaone/core-db/schema';
import type {
  WebhookDeliveryResponseData,
  WebhookEndpointResponseData,
} from '@nombaone/core-contracts/types';

export const serializeWebhookEndpoint = (
  row: WebhookEndpointRow
): WebhookEndpointResponseData => ({
  domain: 'webhook',
  id: row.reference,
  url: row.url,
  enabledEvents: row.enabledEvents,
  signingSecretPrefix: row.signingSecretPrefix,
  disabledAt: row.disabledAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});

export const serializeWebhookDelivery = (
  row: WebhookDeliveryRow,
  endpointRef: string,
  eventRef: string
): WebhookDeliveryResponseData => ({
  domain: 'webhook_delivery',
  id: row.reference,
  eventType: row.eventType,
  endpointId: endpointRef,
  eventId: eventRef, // the EVT reference — the dedupe key
  status: row.status,
  attempts: row.attempts,
  nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
  lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
  responseStatus: row.responseStatus,
  replayedAt: row.replayedAt?.toISOString() ?? null,
  replayCount: row.replayCount,
  createdAt: row.createdAt.toISOString(),
});
