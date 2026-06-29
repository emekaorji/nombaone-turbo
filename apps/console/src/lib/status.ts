import type { ExampleStatus } from '@nombaone/core-contracts/types';
import type { WebhookDeliveryStatus } from '@nombaone/core-contracts/types';

/**
 * Status-pill registry — centralised enum→(variant,label) maps with a neutral
 * fallback for unknown values, so a new status string degrades gracefully
 * instead of throwing. The `StatusVariant` is the visual contract the
 * `StatusPill` component understands; every screen maps its domain status to one
 * descriptor here rather than choosing colours inline.
 */
export type StatusVariant = 'pending' | 'success' | 'error' | 'neutral' | 'info';

export interface StatusDescriptor {
  variant: StatusVariant;
  label: string;
}

const NEUTRAL: StatusDescriptor = { variant: 'neutral', label: 'Unknown' };

/** Example money-path status → pill. */
const EXAMPLE_STATUS: Record<ExampleStatus, StatusDescriptor> = {
  pending: { variant: 'pending', label: 'Pending' },
  settled: { variant: 'success', label: 'Settled' },
  failed: { variant: 'error', label: 'Failed' },
};

export function exampleStatusPill(status: string): StatusDescriptor {
  return (EXAMPLE_STATUS as Record<string, StatusDescriptor>)[status] ?? NEUTRAL;
}

/** Webhook endpoint enabled/disabled → pill. */
export function webhookEndpointPill(disabledAt: string | null): StatusDescriptor {
  return disabledAt
    ? { variant: 'neutral', label: 'Disabled' }
    : { variant: 'success', label: 'Active' };
}

/** Webhook delivery status → pill. */
const DELIVERY_STATUS: Record<WebhookDeliveryStatus, StatusDescriptor> = {
  pending: { variant: 'pending', label: 'Pending' },
  succeeded: { variant: 'success', label: 'Succeeded' },
  failed: { variant: 'error', label: 'Failed' },
  dead: { variant: 'error', label: 'Dead-lettered' },
};

export function deliveryStatusPill(status: string): StatusDescriptor {
  return (DELIVERY_STATUS as Record<string, StatusDescriptor>)[status] ?? NEUTRAL;
}

/** API key revoked/active → pill. */
export function apiKeyPill(revokedAt: string | null): StatusDescriptor {
  return revokedAt
    ? { variant: 'neutral', label: 'Revoked' }
    : { variant: 'success', label: 'Active' };
}
