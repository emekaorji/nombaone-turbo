import { z } from 'zod';

export const createWebhookEndpointBody = z.object({
  url: z.string().url(),
  enabledEvents: z.array(z.string().min(1)).min(1).default(['*']),
});
export type CreateWebhookEndpointBody = z.infer<typeof createWebhookEndpointBody>;

export const updateWebhookEndpointBody = z
  .object({
    url: z.string().url().optional(),
    enabledEvents: z.array(z.string().min(1)).min(1).optional(),
    disabled: z.boolean().optional(),
  })
  .refine((d) => d.url != null || d.enabledEvents != null || d.disabled != null, {
    message: 'at least one of url, enabledEvents, or disabled must be provided',
  });
export type UpdateWebhookEndpointBody = z.infer<typeof updateWebhookEndpointBody>;

export const listWebhookEndpointQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type ListWebhookEndpointQuery = z.infer<typeof listWebhookEndpointQuery>;

export const listEventQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  type: z.string().min(1).optional(),
});
export type ListEventQuery = z.infer<typeof listEventQuery>;

export const listWebhookDeliveryQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z.enum(['pending', 'succeeded', 'failed', 'dead']).optional(),
  eventType: z.string().min(1).optional(),
  endpoint: z.string().min(1).optional(),
});
export type ListWebhookDeliveryQuery = z.infer<typeof listWebhookDeliveryQuery>;
