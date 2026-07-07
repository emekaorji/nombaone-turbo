'use server';

import { customersTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { mintReference } from '@nombaone/sara/reference';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { getSession } from '@/lib/auth';

export type CreateCustomerState =
  | { status: 'idle' }
  | { status: 'error'; message: string; field?: 'name' | 'email' }
  | { status: 'success'; reference: string };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function createCustomerAction(formData: FormData): Promise<CreateCustomerState> {
  const session = await getSession();
  if (!session) return { status: 'error', message: 'Your session expired. Sign in again.' };
  if (session.user.role === 'viewer') return { status: 'error', message: 'Viewers cannot create customers.' };

  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const phone = String(formData.get('phone') ?? '').trim() || null;

  if (!name) return { status: 'error', message: 'Enter a name.', field: 'name' };
  if (!EMAIL_RE.test(email)) return { status: 'error', message: 'Enter a valid email address.', field: 'email' };

  // Email is unique per (org, mode) — a structural 409. Check first for a clean message.
  const existing = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(
      and(
        eq(customersTable.organizationId, session.organizationId),
        eq(customersTable.mode, session.mode),
        eq(customersTable.email, email),
      ),
    )
    .limit(1);
  if (existing[0]) return { status: 'error', message: 'A customer with this email already exists.', field: 'email' };

  const reference = mintReference('CUS');
  await db.insert(customersTable).values({
    reference,
    organizationId: session.organizationId,
    mode: session.mode,
    email,
    name,
    phone,
  });

  revalidatePath('/customers');
  return { status: 'success', reference };
}
