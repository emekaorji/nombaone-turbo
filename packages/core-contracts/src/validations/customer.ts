import { z } from 'zod';

/** CUSTOMER input schemas. Coercion happens here so handlers receive already-
 * typed, already-validated input. `email` is the natural key within (org, env). */
export const createCustomerBody = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  phone: z.string().min(1).max(32).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateCustomerBody = z.infer<typeof createCustomerBody>;

export const updateCustomerBody = z
  .object({
    name: z.string().min(1).max(255).optional(),
    phone: z.string().min(1).max(32).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'at least one field must be provided',
  });
export type UpdateCustomerBody = z.infer<typeof updateCustomerBody>;

export const listCustomerQuery = z.object({
  email: z.string().email().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type ListCustomerQuery = z.infer<typeof listCustomerQuery>;
