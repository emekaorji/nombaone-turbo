'use server';

import { organizationsTable } from '@nombaone/core-db';
import { db as poolDb } from '@nombaone/core-db/pool';
import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { getSession } from '@/lib/auth';
import { getOnboardingState, type OnboardingState } from '@/lib/onboarding';

/** The merchant committed to the guided flow — pin the start so the companion rail
 * follows them into the app. Idempotent: the first start time is preserved. */
export async function startOnboardingAction(): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await poolDb
    .update(organizationsTable)
    .set({ onboardingStartedAt: new Date() })
    .where(and(eq(organizationsTable.id, session.organizationId), isNull(organizationsTable.onboardingStartedAt)));
  revalidatePath('/', 'layout');
}

/** Skip or finish — the rail stays hidden from here on. */
export async function dismissOnboardingAction(): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await poolDb
    .update(organizationsTable)
    .set({ onboardingDismissedAt: new Date() })
    .where(eq(organizationsTable.id, session.organizationId));
  revalidatePath('/', 'layout');
}

/** Fresh snapshot for the client rail to re-poll as steps get completed. */
export async function refreshOnboardingAction(): Promise<OnboardingState | null> {
  return getOnboardingState();
}
