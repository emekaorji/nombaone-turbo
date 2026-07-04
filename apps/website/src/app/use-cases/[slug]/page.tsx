import { HomeSection } from "@/components/layout/Container";
import { SectionHeader } from "@/components/primitives/SectionHeader";

/** Placeholder — rebuilt against NOMBAONE.pen in its own pass. */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <HomeSection divider={false}>
      <SectionHeader
        title={slug}
        deck="we're working on it."
      />
    </HomeSection>
  );
}
