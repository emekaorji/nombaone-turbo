'use client';

import { useTransition } from 'react';
import type { Mode } from '@nombaone/sara/context';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nombaone/ui/components/ui/select';

import { setEnvironment } from './env-actions';
import { cn } from '@/lib/cn';

/**
 * Topbar environment switcher. The selected ring (sandbox|live) is a SERVER-SIDE
 * preference cookie, not authority — flipping it persists via `setEnvironment`
 * and the layout revalidation re-renders every scoped read filtered to the new
 * ring. `live` is the staff default.
 */
export function EnvSwitcher({ value }: { value: Mode }) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        startTransition(async () => {
          await setEnvironment(next as Mode);
        });
      }}
    >
      <SelectTrigger
        aria-label="Mode"
        className={cn('h-9 w-[112px] gap-2 font-medium', pending && 'opacity-70')}
      >
        <span
          aria-hidden
          className={cn(
            'size-2 shrink-0 rounded-full',
            value === 'live' ? 'bg-emerald-500' : 'bg-amber-500'
          )}
        />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="live">Live</SelectItem>
        <SelectItem value="sandbox">Sandbox</SelectItem>
      </SelectContent>
    </Select>
  );
}
