import { z } from 'zod';

/** EXAMPLE input schemas (deletable). Coercion happens here so handlers receive
 * already-typed, already-coerced input. */
export const createExampleBody = z.object({
  kind: z.enum(['standard', 'priority']).default('standard'),
  amountInKobo: z.coerce.number().int().positive(), // kobo
});
export type CreateExampleBody = z.infer<typeof createExampleBody>;

export const listExampleQuery = z.object({
  kind: z.enum(['standard', 'priority']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type ListExampleQuery = z.infer<typeof listExampleQuery>;
