import { Container } from "@/components/layout/Container";
import { Pill } from "@/components/primitives/Pill";
import { SectionHeader } from "@/components/primitives/SectionHeader";

/**
 * Scaffolded route header. The build loop replaces each page body with the real
 * composition against the .pen; this proves routing + chrome + tokens per route.
 */
export function PagePlaceholder({ title, deck }: { title: string; deck: string }) {
  return (
    <Container className="py-24 md:py-32">
      <div className="mb-6">
        <Pill tone="accent">Scaffolded · the loop builds this</Pill>
      </div>
      <SectionHeader title={title} deck={deck} />
    </Container>
  );
}
