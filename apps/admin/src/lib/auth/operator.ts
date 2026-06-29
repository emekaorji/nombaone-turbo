import 'server-only';

import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { operatorsTable, type OperatorRole, type OperatorRow } from '@nombaone/core-db/schema';

import { getDb } from '@/lib/db';

/**
 * PARADIGM — OPERATOR JWT WITH A `tokenVersion` CLAIM (instant revocation).
 *
 * Internal staff authenticate with a stateless, signed JWT carried in an
 * httpOnly cookie. The token embeds the operator's `ver` (their
 * `operators.token_version`) at sign time; on EVERY privileged read/mutation we
 * re-fetch the operator row and assert the token's `ver` still equals the row's
 * `token_version`. Bumping that integer in the DB instantly invalidates every
 * outstanding JWT for that operator — a logout-everywhere / compromise kill
 * switch that needs no session table and no per-request DB write on the happy
 * path beyond the one row read we already do to resolve the operator.
 *
 * `jose` is used (not `jsonwebtoken`) because it runs in BOTH the Edge runtime
 * (the route gate / proxy, which has no DB and no bcrypt) and the Node runtime
 * (server actions). The signing secret is `AUTH_JWT_SECRET` (>= 32 chars).
 *
 * The cookie is NOT the authority for what an operator may do — that is the RBAC
 * matrix in `src/lib/rbac.ts`, enforced server-side. The token only proves
 * identity + freshness (`ver`).
 */

export const OPERATOR_COOKIE = 'nombaone_operator';

const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h
const ISSUER = 'nombaone-admin';
const AUDIENCE = 'nombaone-admin/operator';

/** The session-shaped operator the chrome + actions consume. */
export type Operator = {
  id: string;
  name: string;
  email: string;
  role: OperatorRole;
  /** Two-letter avatar fallback derived from the name. */
  initials: string;
};

/** The verified JWT payload. `sub` = operator id, `ver` = tokenVersion. */
export type OperatorTokenPayload = JWTPayload & {
  sub: string;
  role: OperatorRole;
  ver: number;
};

function getSecret(): Uint8Array {
  const raw = process.env.AUTH_JWT_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      'AUTH_JWT_SECRET is not set or is shorter than 32 characters. See apps/admin/.env.example.'
    );
  }
  return new TextEncoder().encode(raw);
}

/** Sign an operator JWT, embedding the current `tokenVersion` as `ver`. */
export async function signOperatorToken(input: {
  operatorId: string;
  role: OperatorRole;
  tokenVersion: number;
}): Promise<string> {
  return new SignJWT({ role: input.role, ver: input.tokenVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(input.operatorId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

/**
 * Verify a token's signature + standard claims. Does NOT check `tokenVersion`
 * against the DB — that requires a DB read and happens in `getCurrentOperator`.
 * Safe to call from the Edge runtime (signature-only freshness for the gate).
 */
export async function verifyOperatorToken(jwt: string): Promise<OperatorTokenPayload> {
  const { payload } = await jwtVerify<OperatorTokenPayload>(jwt, getSecret(), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  return payload;
}

/** Two-letter initials for the avatar fallback. */
function toInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts
    .map((part) => part[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
  return initials || name.slice(0, 2).toUpperCase() || '??';
}

function toOperator(row: OperatorRow): Operator {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    initials: toInitials(row.name),
  };
}

/**
 * Resolve the current operator: read the cookie, verify the JWT, re-fetch the
 * row, and assert the embedded `ver` still matches `operators.token_version`.
 * Returns `null` on ANY failure path (no cookie / expired / bad signature /
 * deleted operator / stale token version). Use this for read surfaces.
 */
export async function getCurrentOperator(): Promise<Operator | null> {
  const jwt = (await cookies()).get(OPERATOR_COOKIE)?.value;
  if (!jwt) return null;

  let payload: OperatorTokenPayload;
  try {
    payload = await verifyOperatorToken(jwt);
  } catch {
    return null;
  }

  const [row] = await getDb()
    .select()
    .from(operatorsTable)
    .where(eq(operatorsTable.id, payload.sub))
    .limit(1);

  if (!row) return null;
  // Instant-revocation check: a bumped token_version invalidates the JWT.
  if (row.tokenVersion !== payload.ver) return null;

  return toOperator(row);
}

/** Thrown by the mutation gate; surfaced as an `ActionResult` error. */
export class OperatorAuthError extends Error {
  constructor(
    public readonly code: 'unauthorized' | 'forbidden',
    message: string
  ) {
    super(message);
    this.name = 'OperatorAuthError';
  }
}

/**
 * Mutation gate. Resolves the current operator or throws `OperatorAuthError`.
 * Capability checks live in `src/lib/rbac.ts` and are applied by the action
 * after this returns; this only proves a fresh, authenticated operator.
 */
export async function requireOperator(): Promise<Operator> {
  const operator = await getCurrentOperator();
  if (!operator) {
    throw new OperatorAuthError('unauthorized', 'Sign-in required.');
  }
  return operator;
}

/** Cookie options for the operator session cookie. */
export function operatorCookieOptions(maxAgeSeconds: number = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
