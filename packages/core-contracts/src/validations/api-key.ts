import { z } from 'zod';

const apiKeyScope = z.enum([
  'customers:read',
  'customers:write',
  'plans:read',
  'plans:write',
  'prices:read',
  'prices:write',
  'payment_methods:read',
  'payment_methods:write',
  'mandates:write',
  'subscriptions:read',
  'subscriptions:write',
  'invoices:read',
  'invoices:write',
  'example:read',
  'example:write',
  'webhooks:read',
  'webhooks:write',
]);

export const createApiKeyBody = z.object({
  name: z.string().min(1).max(120),
  scopes: z.array(apiKeyScope).min(1),
});
export type CreateApiKeyBody = z.infer<typeof createApiKeyBody>;
