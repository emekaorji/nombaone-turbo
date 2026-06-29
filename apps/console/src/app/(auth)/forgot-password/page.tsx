import type { Metadata } from 'next';

import { AuthCard } from '@/components/auth/AuthCard';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export const metadata: Metadata = { title: 'Reset password · Nombaone Console' };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      subtitle="We'll email you a link to set a new password."
      footer={{ prompt: 'Remembered it?', href: '/login', cta: 'Back to log in' }}
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
