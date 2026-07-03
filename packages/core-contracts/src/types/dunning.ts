export type DunningAttemptStatus =
  | 'scheduled'
  | 'attempting'
  | 'succeeded'
  | 'rescheduled'
  | 'card_update_required'
  | 'exhausted';

export type DunningBranch = 'reschedule' | 'card_update_required' | 'short_path';

/** One retry of a `past_due` invoice — the audit unit (D11). No PII. */
export interface DunningAttemptResponseData {
  domain: 'dunning_attempt'; // response object-type discriminator
  id: string; // DUN reference
  attemptNumber: number;
  status: DunningAttemptStatus;
  branch: DunningBranch;
  railKey: string | null;
  failureReason: string | null;
  gatewayMessage: string | null;
  outcome: string | null;
  scheduledAt: string; // ISO-8601 UTC
  executedAt: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
}

/** The rolled-up dunning view for a subscription + its open invoice (D11 inspect). */
export interface DunningStateResponseData {
  domain: 'dunning_state'; // response object-type discriminator
  subscriptionRef: string;
  invoiceRef: string | null;
  status: DunningAttemptStatus | 'none';
  attemptsUsed: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  graceAccessUntil: string | null;
  attempts: DunningAttemptResponseData[];
}
