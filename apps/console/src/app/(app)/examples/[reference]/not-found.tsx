import Link from 'next/link';

import { Button } from '@nombaone/ui/components/ui/button';

import { Section } from '@/components/common/Section';

export default function ExampleNotFound() {
  return (
    <Section title="Example not found">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          No example with that reference exists in this environment, or it belongs to another
          organization.
        </p>
        <Button asChild>
          <Link href="/examples">Back to examples</Link>
        </Button>
      </div>
    </Section>
  );
}
