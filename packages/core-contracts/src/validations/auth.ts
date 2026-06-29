import { z } from 'zod';

/**
 * The SAME zod schema validates the server request AND the console form
 * (react-hook-form + zodResolver). One source of truth for input shape.
 */
export const signupBody = z.object({
  organizationName: z.string().min(2).max(120),
  name: z.string().min(2).max(120),
  email: z.string().email().transform((value) => value.toLowerCase().trim()),
  password: z.string().min(8).max(200),
});
export type SignupBody = z.infer<typeof signupBody>;

export const loginBody = z.object({
  email: z.string().email().transform((value) => value.toLowerCase().trim()),
  password: z.string().min(1),
  /** Present on the second step when the account has TOTP enabled. */
  totpCode: z.string().length(6).optional(),
});
export type LoginBody = z.infer<typeof loginBody>;

export const requestPasswordResetBody = z.object({
  email: z.string().email().transform((value) => value.toLowerCase().trim()),
});

export const resetPasswordBody = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(200),
});
