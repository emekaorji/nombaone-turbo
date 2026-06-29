import { redirect } from 'next/navigation';

import { getSession } from '@/lib/session';

/**
 * (auth) route group — the signed-OUT surface (signup, login, 2FA, password
 * reset). It is the layout/boundary counterpart to (app): a centred, chrome-less
 * card on a muted backdrop. An already-authenticated visitor is bounced to the
 * overview so the auth screens are never shown to a live session.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session) redirect('/');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
