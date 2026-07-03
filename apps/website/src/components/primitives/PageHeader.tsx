import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";

/**
 * Inner-page header (.pen PageHeader, e.g. OMRfa): H1 72px / 600 / tracking -3 /
 * lh 1.03, deck 24px muted, padding [120,0,72,0].
 */
export function PageHeader({
  title,
  deck,
  kicker,
  align = "left",
  children,
}: {
  title: React.ReactNode;
  deck?: React.ReactNode;
  kicker?: React.ReactNode;
  align?: "left" | "center";
  children?: React.ReactNode;
}) {
  return (
    <Container className="pb-[72px] pt-24 md:pt-[120px]">
      <div className={cn("flex flex-col gap-6", align === "center" && "items-center text-center")}>
        {kicker ? (
          <span className="-mb-2 text-[16px] font-medium text-accent">{kicker}</span>
        ) : null}
        <h1 className="max-w-[900px] text-[40px] font-semibold leading-[1.03] tracking-[-1.6px] text-foreground md:text-[72px] md:tracking-[-3px]">
          {title}
        </h1>
        {deck ? (
          <p
            className={cn(
              "max-w-[660px] text-lg leading-[1.5] text-muted-foreground md:text-[24px]",
              align === "center" && "mx-auto"
            )}
          >
            {deck}
          </p>
        ) : null}
        {children}
      </div>
    </Container>
  );
}
