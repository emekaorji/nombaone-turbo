'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowSwapHorizontal } from 'iconsax-react';
import { toast } from 'sonner';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nombaone/ui/components/ui/select';
import type { Environment } from '@nombaone/sara/context';

import { switchEnvironment } from '@/lib/environment-actions';
import { cn } from '@/lib/cn';

/**
 * Active test/live ring switch. Flipping it calls the `switchEnvironment` server
 * action (writes the `console_env` cookie + `revalidatePath('/','layout')`), so
 * every RSC re-reads its scope through `getOrgDomainCtx()` and re-renders the
 * now-active ring's data. The client NEVER passes the ring into a domain request
 * — it only sets the preference; reads re-pin scope server-side.
 */
export function EnvSwitcher({ environment }: { environment: Environment }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onChange = (next: string) => {
    const env = next as Environment;
    if (env === environment) return;
    startTransition(async () => {
      try {
        await switchEnvironment(env);
        router.refresh();
        toast.success(`Switched to ${env === 'live' ? 'Live' : 'Test'} mode`);
      } catch {
        toast.error('Could not switch environment. Please try again.');
      }
    });
  };

  const isLive = environment === 'live';

  return (
    <Select value={environment} onValueChange={onChange} disabled={pending}>
      <SelectTrigger
        className={cn(
          'h-9 w-[7.5rem] gap-1.5 border-border text-xs font-medium',
          isLive
            ? 'border-success-200 bg-success-50 text-success-700'
            : 'border-warning-200 bg-warning-50 text-warning-700'
        )}
        aria-label="Switch environment"
      >
        <ArrowSwapHorizontal size={14} color="currentColor" variant="Outline" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="test">Test mode</SelectItem>
        <SelectItem value="live">Live mode</SelectItem>
      </SelectContent>
    </Select>
  );
}
