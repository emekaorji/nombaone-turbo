export interface WebhookEndpointResponseData {
  domain: 'webhook'; // response object-type discriminator
  id: string; // public reference
  url: string;
  /** Event types this endpoint subscribes to (`*` = all). */
  enabledEvents: string[];
  /** The shared HMAC secret the tenant verifies deliveries with (shown once). */
  signingSecretPrefix: string;
  disabledAt: string | null;
  createdAt: string;
}

export type WebhookDeliveryStatus = 'pending' | 'succeeded' | 'failed' | 'dead';

export interface WebhookDeliveryResponseData {
  domain: 'webhook_delivery'; // response object-type discriminator
  id: string;
  eventType: string;
  endpointId: string;
  eventId: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  responseStatus: number | null;
  replayedAt: string | null;
  replayCount: number;
  createdAt: string;
}

/** A domain event as listed by `GET /v1/events`. */
export interface DomainEventResponseData {
  domain: 'event'; // response object-type discriminator
  id: string; // EVT reference — the dedupe key
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

/** The one-time signing secret returned by create + rotate (never on read). */
export interface RotatedWebhookSecretResponseData {
  domain: 'webhook_secret'; // response object-type discriminator
  id: string;
  signingSecret: string;
  signingSecretPrefix: string;
}
