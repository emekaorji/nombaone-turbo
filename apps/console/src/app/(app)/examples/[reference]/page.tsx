import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getExampleByReference } from '@nombaone/sara/example';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import type { ExampleResponseData } from '@nombaone/core-contracts/types';

import { DetailLayout } from '@/components/common/DetailLayout';
import { Section } from '@/components/common/Section';
import { KeyValueList } from '@/components/common/KeyValueList';
import { Reference } from '@/components/common/Reference';
import { StatusPill } from '@/components/common/StatusPill';
import { MoneyAmount } from '@/components/common/MoneyAmount';
import { db } from '@/lib/db';
import { getOrgDomainCtx } from '@/lib/auth-context';
import { exampleStatusPill } from '@/lib/status';
import { absoluteDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Example · Nombaone Console' };

/**
 * Example detail. The route param is the public reference, but it's NOT trusted
 * as authority — `getExampleByReference` re-resolves it within the session-pinned
 * scope (a reference from another tenant simply doesn't exist for this caller).
 * A miss surfaces as `EXAMPLE_NOT_FOUND`, which we turn into Next's `notFound()`.
 * Next 16: `params` is async.
 */
export default async function ExampleDetailPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const ctx = await getOrgDomainCtx();

  let example: ExampleResponseData;
  try {
    example = await getExampleByReference(db, ctx, reference);
  } catch (err) {
    if (err instanceof AppError && err.code === NOMBAONE_ERROR_CODES.EXAMPLE_NOT_FOUND) {
      notFound();
    }
    throw err;
  }

  const pill = exampleStatusPill(example.status);

  return (
    <DetailLayout
      backHref="/examples"
      backLabel="Back to examples"
      title="Example"
      badge={<StatusPill variant={pill.variant}>{pill.label}</StatusPill>}
    >
      <Section title="Details">
        <KeyValueList
          items={[
            { label: 'Reference', value: <Reference value={example.id} /> },
            { label: 'Kind', value: <span className="capitalize">{example.kind}</span> },
            {
              label: 'Status',
              value: <StatusPill variant={pill.variant}>{pill.label}</StatusPill>,
            },
            { label: 'Amount', value: <MoneyAmount kobo={example.amountInKobo} /> },
            { label: 'Currency', value: example.currency },
            { label: 'Mode', value: <span className="capitalize">{example.mode}</span> },
            { label: 'Created', value: absoluteDateTime(example.createdAt) },
          ]}
        />
      </Section>
    </DetailLayout>
  );
}
