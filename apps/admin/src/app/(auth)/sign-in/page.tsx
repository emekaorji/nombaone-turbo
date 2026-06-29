import { SignInForm } from './SignInForm';

export const metadata = { title: 'Sign in · Nombaone Admin' };

/**
 * Operator sign-in screen. The route gate (`src/proxy.ts`) keeps already-signed
 * operators away from here; the form posts to the `signInAction` server action.
 */
export default function SignInPage() {
  return <SignInForm />;
}
