import type { Metadata } from 'next';

import { AuthCard } from '@/components/auth/AuthCard';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Log in · Nombaone Console' };

export default function LoginPage() {
  return (
    <AuthCard
      title="Log in to Nombaone"
      subtitle="Welcome back. Enter your details to continue."
      footer={{ prompt: "Don't have an account?", href: '/signup', cta: 'Sign up' }}
    >
      <LoginForm />
    </AuthCard>
  );
}
