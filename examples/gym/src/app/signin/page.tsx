import { redirect } from 'next/navigation';

import { SignInForm } from '@/components/signin-form';
import { currentMember } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function SignInPage() {
  if (await currentMember()) redirect('/account');

  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center px-6 py-24">
      <h1 className="text-2xl font-bold tracking-tight">Welcome back.</h1>
      <p className="mt-2 text-[13.5px] text-fog">See your membership and manage it.</p>
      <div className="mt-8">
        <SignInForm />
      </div>
    </div>
  );
}
