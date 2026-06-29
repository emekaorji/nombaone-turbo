import { redirect } from 'next/navigation';

/**
 * Two-factor verification has no standalone route: the TOTP step is modeled as a
 * RESULT VALUE of the login action (`status: 'TOTP_REQUIRED'`) and rendered
 * inline on `/login` as a second step, so the email+password attempt that proved
 * the second factor is required is never re-entered. This route exists only so a
 * stale bookmark resolves; it bounces back to login.
 */
export default function Verify2faPage() {
  redirect('/login');
}
