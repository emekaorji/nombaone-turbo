import { createHash } from 'node:crypto';

import { orgInvitationsTable, orgUsersTable, organizationsTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { and, desc, eq } from 'drizzle-orm';

import { getSession } from '@/lib/auth';

export type PendingInvite = { reference: string; email: string; role: string; invited: string };

function shortDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export const hashInviteToken = (raw: string): string => createHash('sha256').update(raw).digest('hex');

export async function getPendingInvitations(): Promise<PendingInvite[]> {
  const session = await getSession();
  if (!session) return [];

  const rows = await db
    .select({
      reference: orgInvitationsTable.reference,
      email: orgInvitationsTable.email,
      role: orgInvitationsTable.role,
      createdAt: orgInvitationsTable.createdAt,
    })
    .from(orgInvitationsTable)
    .where(and(eq(orgInvitationsTable.organizationId, session.organizationId), eq(orgInvitationsTable.status, 'pending')))
    .orderBy(desc(orgInvitationsTable.createdAt));

  return rows.map((r) => ({ reference: r.reference, email: r.email, role: r.role, invited: shortDate(r.createdAt) }));
}

export type InvitationForAccept = {
  valid: boolean;
  reason?: 'not_found' | 'expired' | 'used' | 'revoked';
  email?: string;
  role?: string;
  orgName?: string;
};

/** Public lookup (no session) — resolve a raw invite token to its invitation, for the accept page. */
export async function getInvitationByToken(token: string): Promise<InvitationForAccept> {
  const [inv] = await db
    .select({
      email: orgInvitationsTable.email,
      role: orgInvitationsTable.role,
      status: orgInvitationsTable.status,
      expiresAt: orgInvitationsTable.expiresAt,
      orgName: organizationsTable.name,
    })
    .from(orgInvitationsTable)
    .innerJoin(organizationsTable, eq(orgInvitationsTable.organizationId, organizationsTable.id))
    .where(eq(orgInvitationsTable.tokenHash, hashInviteToken(token)));

  if (!inv) return { valid: false, reason: 'not_found' };
  if (inv.status === 'accepted') return { valid: false, reason: 'used' };
  if (inv.status === 'revoked') return { valid: false, reason: 'revoked' };
  if (inv.status === 'expired' || inv.expiresAt < new Date()) return { valid: false, reason: 'expired' };
  // Guard against an email that was claimed elsewhere after the invite was sent.
  const [taken] = await db.select({ id: orgUsersTable.id }).from(orgUsersTable).where(eq(orgUsersTable.email, inv.email));
  if (taken) return { valid: false, reason: 'used' };

  return { valid: true, email: inv.email, role: inv.role, orgName: inv.orgName };
}
