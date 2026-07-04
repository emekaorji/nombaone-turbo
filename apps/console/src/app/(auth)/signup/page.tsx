import type { Metadata } from 'next';

import { AuthCard } from '@/components/auth/AuthCard';
import { SignupForm } from './SignupForm';

export const metadata: Metadata = { title: 'Sign up · Nombaone Console' };

export default function SignupPage() {
  return (
    <AuthCard
      title="Create your organization"
      subtitle="Start in sandbox mode — go live whenever you're ready."
      footer={{ prompt: 'Already have an account?', href: '/login', cta: 'Log in' }}
    >
      <SignupForm />
    </AuthCard>
  );
}
