import type { ExampleResponseData, ExampleKind, ExampleStatus } from '@nombaone/core-contracts/types';

/**
 * ── The example slice's internal types ──
 *
 * The deletable example domain demonstrates the money-path paradigms end to end.
 * Its WIRE shape (`ExampleResponseData`) lives in `@nombaone/core-contracts` and
 * is never re-declared here — the domain imports it so the contract has exactly
 * one home. This file only declares the INPUT shapes the domain functions accept;
 * everything outbound flows through the serializer.
 *
 * Two kinds (`standard` | `priority`) exist purely to show the enum-discriminator
 * convention; they carry no behavioural difference in the boilerplate.
 */
export type { ExampleResponseData, ExampleKind, ExampleStatus };

/** Input to `createExample`. Amount is positive integer kobo (validated). */
export interface CreateExampleInput {
  kind: ExampleKind;
  amount: number;
}

/** Filter / paging options for `listExamples`. */
export interface ListExamplesOptions {
  kind?: ExampleKind;
  limit?: number;
  cursor?: string;
}

/** Inbound-confirm input — what a verified provider webhook hands the domain. */
export interface ConfirmExampleFromWebhookInput {
  /** OUR reference (the join key); we resolve the example by it, server-side. */
  reference: string;
  /** Provider-side id from the webhook — informational, never authoritative. */
  providerReference: string;
}
