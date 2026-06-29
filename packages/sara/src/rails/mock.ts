import type { RailAdapter, RailCollectInput, RailCollectResult } from './types';

/**
 * MockRailAdapter — the deletable reference rail. Demonstrates BOTH asymmetric
 * shapes so the example slice + tests can exercise the interface without a real
 * provider:
 *  • `mock_pull` immediately "succeeds" (stands in for a card-token / mandate pull)
 *  • `mock_push` returns `pending` with pay instructions (stands in for a
 *    transfer-to-virtual-account that settles later via inbound webhook)
 * Replace with your real card / mandate / transfer adapters.
 */
export const mockPullRail: RailAdapter = {
  key: 'mock_pull',
  direction: 'pull',
  async collect(input: RailCollectInput): Promise<RailCollectResult> {
    return { status: 'succeeded', providerReference: `mockpull_${input.reference}` };
  },
};

export const mockPushRail: RailAdapter = {
  key: 'mock_push',
  direction: 'push',
  async collect(input: RailCollectInput): Promise<RailCollectResult> {
    return {
      status: 'pending',
      payInstructions: {
        accountNumber: '0000000000',
        bankName: 'Mock Bank',
        amountKobo: input.amountKobo,
        narration: input.reference,
      },
    };
  },
};
