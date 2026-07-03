import { z } from 'zod';

/**
 * ── Test-mode simulation instruments (Stripe-style test helpers) ────────────
 * These bodies drive the `/v1/test/*` endpoints that ONLY exist on a test
 * deployment. They let a developer make renewals, declines, OTP step-ups, and
 * webhook deliveries happen on demand — no waiting on a cron, no real card.
 */

/** The deterministic outcomes a test payment method produces when it is charged. */
export const testMethodBehaviors = [
  'success',
  'decline_insufficient_funds',
  'decline_expired_card',
  'decline_do_not_honor',
  'requires_otp',
] as const;
export type TestMethodBehavior = (typeof testMethodBehaviors)[number];

/** POST /v1/test/payment-methods — mint a ready, deterministic test payment method. */
export const createTestPaymentMethodBody = z.object({
  customerId: z.string().min(1),
  behavior: z.enum(testMethodBehaviors).default('success'),
  kind: z.enum(['card', 'mandate']).default('card'),
});
export type CreateTestPaymentMethodBody = z.infer<typeof createTestPaymentMethodBody>;

/** POST /v1/test/webhooks/simulate — emit + deliver a real catalog event on demand. */
export const simulateWebhookBody = z.object({
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
});
export type SimulateWebhookBody = z.infer<typeof simulateWebhookBody>;
