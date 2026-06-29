import type { Metadata } from 'next';

import { AuthCard } from '@/components/auth/AuthCard';
import { ResetPasswordForm } from './ResetPasswordForm';

export const metadata: Metadata = { title: 'Set a new password · Nombaone Console' };

/**
 * The reset link points here with `?token=<raw>`. The token is read from the URL
 * and submitted alongside the new password; the domain validates + consumes it
 * single-use. (Next 16 `searchParams` is async.)
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthCard
      title="Set a new password"
      subtitle="Choose a strong password you don't use elsewhere."
      footer={{ prompt: 'Changed your mind?', href: '/login', cta: 'Back to log in' }}
    >
      <ResetPasswordForm token={token ?? ''} />
    </AuthCard>
  );
}
