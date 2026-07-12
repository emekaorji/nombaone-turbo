import { RootShell } from '@/components/chrome/root-shell';
import { baseMetadata, viewport } from '@/lib/l10n/metadata';

export const metadata = baseMetadata('en');
export { viewport };

export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return <RootShell locale="en">{children}</RootShell>;
}
