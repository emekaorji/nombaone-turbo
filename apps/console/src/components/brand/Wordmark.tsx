import Link from 'next/link';

import { cn } from '@/lib/cn';
import { LogoIcon } from './LogoIcon';

/**
 * The Nombaone wordmark: the purple glyph tile + "Nombaone" + a CONSOLE tag pill.
 * Used in the sidebar header and the (auth) cards. Links to the overview by
 * default; pass `href={null}` for a non-interactive lockup (auth screens).
 */
export function Wordmark({
  href = '/',
  className,
  showTag = true,
}: {
  href?: string | null;
  className?: string;
  showTag?: boolean;
}) {
  const inner = (
    <>
      <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-sm bg-primary">
        <LogoIcon className="size-3.5 text-purple-50" />
      </span>
      <span className="text-base font-bold tracking-[-0.2px] text-foreground">Nombaone</span>
      {showTag ? (
        <span className="mt-0.5 rounded-sm bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.5px] text-neutral-600">
          CONSOLE
        </span>
      ) : null}
    </>
  );

  if (href === null) {
    return <span className={cn('flex min-w-0 items-center gap-2.5', className)}>{inner}</span>;
  }

  return (
    <Link href={href} className={cn('flex min-w-0 items-center gap-2.5 truncate', className)}>
      {inner}
    </Link>
  );
}
