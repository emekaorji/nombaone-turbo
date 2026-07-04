import type { DomainContext } from '../context';

export interface TenantLogFields {
  organizationId: string;
  mode: string;
  correlationId: string;
}

/**
 * The tenant-filterable log field bag (H8 / M1). Every billing-path log line spreads
 * this so logs carry `organizationId` + `environment` + a request/job correlation id
 * uniformly — no PII. Returns fields (not a bound logger) so `sara` stays free of the
 * app's logger; callers do `logger.info(msg, { ...withTenantLog(ctx, req.requestId) })`.
 */
export const withTenantLog = (ctx: DomainContext, correlationId: string): TenantLogFields => ({
  organizationId: ctx.organizationId,
  mode: ctx.mode,
  correlationId,
});
