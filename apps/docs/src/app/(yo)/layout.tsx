import { RootShell } from '@/components/chrome/root-shell';
import { baseMetadata, viewport } from '@/lib/l10n/metadata';

export const metadata = baseMetadata('yo');
export { viewport };

export default function LocaleLayout({ children }: { children: React.ReactNode }) {
  return <RootShell locale="yo">{children}</RootShell>;
}
