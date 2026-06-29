import { z } from 'zod';

export const createWebhookEndpointBody = z.object({
  url: z.string().url(),
  enabledEvents: z.array(z.string().min(1)).min(1).default(['*']),
});
export type CreateWebhookEndpointBody = z.infer<typeof createWebhookEndpointBody>;
