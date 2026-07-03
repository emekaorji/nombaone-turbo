import { cn } from "@/lib/utils";

/**
 * Content column. The .pen keeps the entire site inside a centered 1080 column
 * (Content frame padding [0,180] on the 1440 canvas). On desktop the column is
 * exactly 1080 with 180px gutters; below xl we add a mobile gutter.
 */
export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1080px] px-5 xl:px-0", className)}>{children}</div>
  );
}

/**
 * A home/page section. Full-bleed <section> with the content in the 1080 column.
 * The .pen gives each section (after the hero) a top divider 1080px wide and
 * 128px vertical padding — the divider is on the column, not full-bleed.
 */
export function HomeSection({
  id,
  className,
  children,
  divider = true,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
  divider?: boolean;
}) {
  return (
    <section id={id}>
      <Container
        className={cn(
          divider && "border-t border-border",
          "py-14 md:py-[128px]",
          className
        )}
      >
        {children}
      </Container>
    </section>
  );
}

/** Legacy alias kept for pages not yet migrated to HomeSection. */
export function Section({
  className,
  children,
  id,
}: {
  className?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={cn("py-20 md:py-32", className)}>
      {children}
    </section>
  );
}
