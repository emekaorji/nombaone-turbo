import { z } from 'zod';

export const createCouponBody = z
  .object({
    code: z.string().min(1).max(64),
    amountOff: z.coerce.number().int().positive().optional(), // kobo
    percentOff: z.coerce.number().int().min(1).max(100).optional(),
    duration: z.enum(['once', 'repeating', 'forever']),
    durationInCycles: z.coerce.number().int().positive().optional(),
    redeemBy: z.coerce.date().optional(),
    maxRedemptions: z.coerce.number().int().positive().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((d) => (d.amountOff != null) !== (d.percentOff != null), {
    message: 'exactly one of amountOff or percentOff must be set',
    path: ['amountOff'],
  })
  .refine((d) => d.duration !== 'repeating' || d.durationInCycles != null, {
    message: 'durationInCycles is required when duration is repeating',
    path: ['durationInCycles'],
  });
export type CreateCouponBody = z.infer<typeof createCouponBody>;

export const updateCouponBody = z
  .object({
    redeemBy: z.coerce.date().optional(),
    maxRedemptions: z.coerce.number().int().positive().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'at least one field must be provided' });
export type UpdateCouponBody = z.infer<typeof updateCouponBody>;

export const listCouponQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type ListCouponQuery = z.infer<typeof listCouponQuery>;
