import { createHash, randomBytes } from 'node:crypto';

import { orgSessionsTable, orgUsersTable, organizationsTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import type { OrgUserRole } from '@nombaone/sara/auth';
import { and, eq, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';

/**
 * Console session core — console-owned merchant auth (engineering doc §2).
 * Opaque-token sessions: 32 bytes of entropy handed to the browser once in an
 * httpOnly cookie; the server stores only the SHA-256 hash and validates it
 * against `org_sessions` on every request. Revocation is a row delete, so logout
 * is immediate and server-authoritative. The pinned `{organizationId, mode}` is
 * never read from the client — it comes straight off the session row.
 */

export const SESSION_COOKIE = 'nbo_console_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type SessionMode = 'sandbox' | 'live';

export type ConsoleSession = {
  sessionId: string;
  userId: string;
  organizationId: string;
  mode: SessionMode;
  user: { id: string; email: string; name: string; role: OrgUserRole };
  org: { id: string; name: string; reference: string };
};

const sha256 = (raw: string): string => createHash('sha256').update(raw).digest('hex');

export async function createSession(input: {
  userId: string;
  organizationId: string;
  mode: SessionMode;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(orgSessionsTable).values({
    tokenHash: sha256(token),
    userId: input.userId,
    organizationId: input.organizationId,
    mode: input.mode,
    expiresAt,
  });
  return { token, expiresAt };
}

/** Resolve a raw cookie token to the pinned session + user + org, or null if invalid/expired. */
export async function validateToken(token: string): Promise<ConsoleSession | null> {
  const rows = await db
    .select({
      sessionId: orgSessionsTable.id,
      mode: orgSessionsTable.mode,
      userId: orgUsersTable.id,
      email: orgUsersTable.email,
      name: orgUsersTable.name,
      role: orgUsersTable.role,
      orgId: organizationsTable.id,
      orgName: organizationsTable.name,
      orgRef: organizationsTable.reference,
    })
    .from(orgSessionsTable)
    .innerJoin(orgUsersTable, eq(orgUsersTable.id, orgSessionsTable.userId))
    .innerJoin(organizationsTable, eq(organizationsTable.id, orgSessionsTable.organizationId))
    .where(and(eq(orgSessionsTable.tokenHash, sha256(token)), gt(orgSessionsTable.expiresAt, new Date())))
    .limit(1);

  const r = rows[0];
  if (!r) return null;
  return {
    sessionId: r.sessionId,
    userId: r.userId,
    organizationId: r.orgId,
    mode: r.mode as SessionMode,
    user: { id: r.userId, email: r.email, name: r.name, role: r.role as OrgUserRole },
    org: { id: r.orgId, name: r.orgName, reference: r.orgRef },
  };
}

export async function revokeToken(token: string): Promise<void> {
  await db.delete(orgSessionsTable).where(eq(orgSessionsTable.tokenHash, sha256(token)));
}

export async function setSessionMode(sessionId: string, mode: SessionMode): Promise<void> {
  await db.update(orgSessionsTable).set({ mode }).where(eq(orgSessionsTable.id, sessionId));
}

/* ── cookie plumbing ── */

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSessionCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}
