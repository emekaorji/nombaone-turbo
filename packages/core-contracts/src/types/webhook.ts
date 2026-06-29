export interface WebhookEndpointResponseData {
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
  id: string;
  eventType: string;
  endpointId: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  lastAttemptAt: string | null;
  createdAt: string;
}
