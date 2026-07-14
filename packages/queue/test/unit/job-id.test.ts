import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { jobId } from '../../src/queues/job-id';

/**
 * ── THE REGRESSION THAT COST US EVERY RENEWAL ────────────────────────────────
 *
 * `enqueueBilling` built its id as `${subscriptionId}:${periodIndex}`. BullMQ rejects a custom job
 * id containing ':' — it throws "Custom Id cannot contain :" at `.add()` time. So the billing sweep
 * threw on EVERY run, enqueued ZERO renewal jobs, and no subscription ever billed itself. The comms
 * queue had the same defect, and its caller swallowed the throw at `warn`, so not one customer email
 * was ever queued either.
 *
 * Nothing caught it: the code type-checks, and the billing tests call the cycle runner directly and
 * never go near the queue. The only thing that would have caught it is a test that looks at the id a
 * producer ACTUALLY builds — which is what this file does.
 */

const QUEUES_DIR = join(__dirname, '../../src/queues');

/** Exactly what BullMQ forbids. */
const BULLMQ_ILLEGAL = /:/;

describe('jobId()', () => {
  it('never emits the one character BullMQ forbids', () => {
    const nasty = [
      'tenant_settlement:NBO-abc', // our own ledger account keys are colon-joined
      'renewal_upcoming:sub_123:4', // the exact dedupeKey shape comms callers pass
      'urn:nomba:event:9f2c', // a provider event id we do not control
      'https://merchant.example/hook?a=1',
      'user@example.com',
    ];
    for (const part of nasty) {
      expect(jobId(part)).not.toMatch(BULLMQ_ILLEGAL);
      expect(jobId('prefix', part, 7)).not.toMatch(BULLMQ_ILLEGAL);
    }
  });

  it('is injective — distinct parts can never collapse onto one id', () => {
    // A job id is an IDEMPOTENCY KEY: BullMQ dedupes on it. If two different (subscription, period)
    // tuples produced the same id, the second real charge would be silently dropped as a duplicate.
    // This is why the naive fix (replace ':' with '_') is wrong: templates here already contain
    // underscores, so `a:b` and `a_b` would collide.
    const tuples: (string | number)[][] = [
      ['a:b'],
      ['a_b'],
      ['a', 'b'],
      ['a|b'],
      ['a%7cb'],
      ['sub_1', 2],
      ['sub_1', 20],
      ['sub_12', 0],
    ];
    const ids = tuples.map((t) => jobId(...t));
    expect(new Set(ids).size).toBe(tuples.length);
  });

  it('is stable — the same parts always produce the same id, so dedupe still works', () => {
    expect(jobId('sub_1', 2)).toBe(jobId('sub_1', 2));
  });
});

describe('every producer in this package', () => {
  /**
   * The guard that actually protects us. It reads the source of every queue and fails if ANY of
   * them hands BullMQ a raw template literal as a job id — which is how all four producers were
   * written, and how the next one will be written unless something stops it.
   */
  it('builds its jobId with jobId(), never a raw template literal', () => {
    const offences: string[] = [];

    for (const file of readdirSync(QUEUES_DIR).filter((f) => f.endsWith('.ts'))) {
      const source = readFileSync(join(QUEUES_DIR, file), 'utf8');

      for (const [index, line] of source.split('\n').entries()) {
        const code = line.split('//')[0] ?? '';
        const match = /jobId:\s*(.+?),?\s*$/.exec(code);
        if (!match) continue;

        const value = match[1]!.trim();
        // The only acceptable form is a call to the shared helper.
        if (!value.startsWith('jobId(')) {
          offences.push(`${file}:${index + 1} → jobId: ${value}`);
        }
      }
    }

    expect(
      offences,
      `A job id must be built with jobId(...parts) from './job-id'. A template literal or a raw\n` +
        `external string can contain ':', which BullMQ rejects — the enqueue throws, the producer's\n` +
        `caller logs and moves on, and the work is silently never done:\n  ${offences.join('\n  ')}`
    ).toEqual([]);
  });
});
