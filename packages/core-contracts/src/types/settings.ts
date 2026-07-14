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
  /**
   * The merchant's SETTLEMENT IDENTITY — the key naming the ledger account that holds
   * what we owe them (`tenant_settlement:{accountRef}`). Derived from the organization,
   * so it exists from signup: there is nothing to "connect" and no way to be
   * half-onboarded. (It replaced `nombaAccount`, which reported the state of a Nomba
   * sub-account no merchant could ever obtain.)
   */
  settlement: { accountRef: string };
}
