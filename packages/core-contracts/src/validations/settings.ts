import { z } from 'zod';

/**
 * Partial tenant-settings update (H4/H6). All fields optional. A tenant CANNOT
 * self-raise its own rate limit through this body — only an operator seam may (the
 * field is intentionally absent here). Fee overrides are operator-gated in the same
 * spirit but exposed for read; branding/quota/settlement-mode are tenant-editable.
 */
export const updateTenantSettingsBody = z
  .object({
    monthlyRequestQuota: z.coerce.number().int().min(0).optional(),
    settlementMode: z.enum(['split_at_collection', 'collect_then_payout']).optional(),
    branding: z
      .object({
        displayName: z.string().max(120).optional(),
        supportEmail: z.string().email().optional(),
        logoUrl: z.string().url().optional(),
        primaryColorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      })
      .strict()
      .optional(),
  })
  .refine((d) => d.monthlyRequestQuota != null || d.settlementMode != null || d.branding != null, {
    message: 'at least one settable field must be provided',
  });
export type UpdateTenantSettingsBody = z.infer<typeof updateTenantSettingsBody>;
