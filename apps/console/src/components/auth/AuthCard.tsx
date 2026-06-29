import Link from 'next/link';

import { Card } from '@nombaone/ui/components/ui/card';

import { Wordmark } from '@/components/brand/Wordmark';

/**
 * The shared (auth) card: the wordmark, a title + subtitle, the form `children`,
 * and an optional footer line (e.g. "Already have an account? Log in"). Every
 * auth screen renders inside this so the lockup is identical across them.
 */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: { prompt: string; href: string; cta: string };
}) {
  return (
    <div className="space-y-6">
      <Wordmark href={null} showTag className="justify-center" />
      <Card className="space-y-6 p-6">
        <div className="space-y-1 text-center">
          <h1 className="text-lg font-semibold tracking-[-0.2px] text-foreground">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
      </Card>
      {footer ? (
        <p className="text-center text-sm text-muted-foreground">
          {footer.prompt}{' '}
          <Link href={footer.href} className="font-medium text-purple-700 hover:underline">
            {footer.cta}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
