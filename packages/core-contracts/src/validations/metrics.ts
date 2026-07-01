import { z } from 'zod';

export const metricsQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type MetricsQuery = z.infer<typeof metricsQuery>;
