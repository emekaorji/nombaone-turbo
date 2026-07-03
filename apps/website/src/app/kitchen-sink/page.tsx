import { HomeSection } from "@/components/layout/Container";
import { SectionHeader } from "@/components/primitives/SectionHeader";

export const metadata = { title: "Kitchen sink" };

/** Placeholder — this page is rebuilt section-by-section against NOMBAONE.pen in its own pass. */
export default function Page() {
  return (
    <HomeSection divider={false}>
      <SectionHeader
        title="Kitchen sink"
        deck="This page is being rebuilt section-by-section against the Pencil design."
      />
    </HomeSection>
  );
}
