/** The unified tenant-config read (H4) — one place a tenant sees "all my config". */
export interface TenantSettingsResponseData {
  domain: 'organization'; // response object-type discriminator
  billing: {
    rateLimitPerMinute: number | null;
    monthlyRequestQuota: number | null;
    settlementMode: 'split_at_collection' | 'collect_then_payout';
    platformFee: { bps: number | null; minInKobo: number | null; maxInKobo: number | null };
    grace: { gracePeriodHours: number; dunningMaxAttempts: number };
    branding: { displayName?: string; supportEmail?: string; logoUrl?: string; primaryColorHex?: string };
  };
  webhook: { url: string | null; signingSecretPrefix: string | null; configured: boolean };
  nombaAccount: { accountRef: string | null; status: string | null };
}
