import { Container } from "@/components/layout/Container";
import { GuideCard } from "@/components/primitives/GuideCard";
import { getArticlesByGroup } from "@/lib/content";

export const metadata = { title: "Guides" };

export default function GuidesPage() {
  // Show the full roster (the .pen lists drafts too, as "coming soon" entries).
  const groups = getArticlesByGroup();

  return (
    <>
      {/* PageHeader (64px) */}
      <Container className="pb-[72px] pt-24 md:pt-[120px]">
        <h1 className="max-w-[1000px] text-[40px] font-semibold leading-[1.05] tracking-[-1.3px] text-foreground md:text-[64px] md:tracking-[-2.6px]">
          The hard parts of recurring billing, written down.
        </h1>
        <p className="mt-6 max-w-[720px] text-lg leading-[1.5] text-muted-foreground md:text-2xl">
          Durable explanations of the genuinely hard problems, each ending in a place you can see it
          live.
        </p>
      </Container>

      {/* Grouped guide grids */}
      <Container className="pb-24">
        <div className="flex flex-col gap-14">
          {groups.map((g) => (
            <section key={g.group} className="flex flex-col gap-5">
              <h2 className="text-[26px] font-semibold tracking-[-0.8px] text-foreground">
                {g.label}
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {g.articles.map((a) => (
                  <GuideCard
                    key={a.slug}
                    href={`/guides/${a.slug}`}
                    title={a.frontmatter.title}
                    problem={a.frontmatter.problem}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </Container>
    </>
  );
}
