import { z } from 'zod';

const apiKeyScope = z.enum(['example:read', 'example:write', 'webhooks:read', 'webhooks:write']);

export const createApiKeyBody = z.object({
  name: z.string().min(1).max(120),
  scopes: z.array(apiKeyScope).min(1),
});
export type CreateApiKeyBody = z.infer<typeof createApiKeyBody>;
