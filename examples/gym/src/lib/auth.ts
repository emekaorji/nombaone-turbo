import 'server-only';

import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import { cookies } from 'next/headers';

import { get, run, type MemberRow } from '@/lib/db';

/**
 * Member sign-up / sign-in for Iron Republic.
 *
 * The gym owns the login (NombaOne does not do end-user auth — it bills customers, it
 * doesn't authenticate them). A member is a row in the gym's own database, linked to a
 * NombaOne customer id.
 */

const scryptAsync = promisify(scrypt);

const SESSION_COOKIE = 'ir_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/* ------------------------------------------------------------------ */
/* Passwords                                                           */
/* ------------------------------------------------------------------ */

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  // Constant-time — a length mismatch would otherwise leak through an early return.
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

/** The cookie holds the RAW token; we store only its hash, so this file is not a set of logins. */
const hashToken = (raw: string): string => createHash('sha256').update(raw).digest('hex');

async function startSession(memberId: string): Promise<void> {
  const raw = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await run(
    `INSERT INTO sessions (token_hash, member_id, expires_at, created_at)
     VALUES (?, ?, ?, ?)`,
    hashToken(raw),
    memberId,
    expiresAt.toISOString(),
    new Date().toISOString()
  );

  const jar = await cookies();
  jar.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (raw) await run('DELETE FROM sessions WHERE token_hash = ?', hashToken(raw));
  jar.delete(SESSION_COOKIE);
}

/* ------------------------------------------------------------------ */
/* Who is signed in?                                                   */
/* ------------------------------------------------------------------ */

export interface Member {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  /** The NombaOne customer this member is. Server-only — never rendered. */
  customerId: string;
  /** OUR member number (IR-2841). This is what a member sees, never a platform id. */
  memberNo: string;
  since: string;
}

const toMember = (row: MemberRow): Member => ({
  id: row.id,
  email: row.email,
  name: row.name,
  phone: row.phone,
  customerId: row.customer_id,
  memberNo: row.member_no,
  since: row.created_at,
});

export async function currentMember(): Promise<Member | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const row = await get<MemberRow>(
    `SELECT m.* FROM sessions s
     JOIN members m ON m.id = s.member_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    hashToken(raw),
    new Date().toISOString()
  );

  return row ? toMember(row) : null;
}

/** For pages that are only for members. Callers redirect when this returns null. */
export async function requireMember(): Promise<Member | null> {
  return currentMember();
}

/* ------------------------------------------------------------------ */
/* Sign up / sign in                                                   */
/* ------------------------------------------------------------------ */

export async function findMemberByEmail(email: string): Promise<MemberRow | undefined> {
  return get<MemberRow>('SELECT * FROM members WHERE email = ?', email.trim().toLowerCase());
}

export async function findMemberByCustomerId(customerId: string): Promise<MemberRow | undefined> {
  return get<MemberRow>('SELECT * FROM members WHERE customer_id = ?', customerId);
}

/**
 * Create the gym's member row. The NombaOne customer must already exist — the caller
 * creates it first, because a member without a customer cannot be billed, and we would
 * rather fail before taking their password than after.
 */
export async function createMember(input: {
  email: string;
  name: string;
  phone: string | null;
  password: string;
  customerId: string;
}): Promise<Member> {
  const id = randomUUID();
  const row: MemberRow = {
    id,
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    phone: input.phone,
    password_hash: await hashPassword(input.password),
    customer_id: input.customerId,
    // A human-friendly membership number. Members quote this at the desk; they should
    // never have to read out an `nbo…` reference.
    member_no: `IR-${String(Math.floor(1000 + Math.random() * 9000))}`,
    created_at: new Date().toISOString(),
  };

  await run(
    `INSERT INTO members (id, email, name, phone, password_hash, customer_id, member_no, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.email,
    row.name,
    row.phone,
    row.password_hash,
    row.customer_id,
    row.member_no,
    row.created_at
  );

  await startSession(id);
  return toMember(row);
}

/** Verify a password and start a session. Wrong email and wrong password are the same
 *  answer to the caller — never confirm which addresses have accounts. */
export async function authenticate(email: string, password: string): Promise<Member | null> {
  const row = await findMemberByEmail(email);
  if (!row) return null;
  if (!(await verifyPassword(password, row.password_hash))) return null;
  await startSession(row.id);
  return toMember(row);
}
