import { z } from 'zod';

/** PLAN input schemas. */
export const createPlanBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreatePlanBody = z.infer<typeof createPlanBody>;

export const updatePlanBody = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'at least one field must be provided',
  });
export type UpdatePlanBody = z.infer<typeof updatePlanBody>;

export const listPlanQuery = z.object({
  status: z.enum(['active', 'archived']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type ListPlanQuery = z.infer<typeof listPlanQuery>;
