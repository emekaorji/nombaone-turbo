import { cn } from "@/lib/utils";

/**
 * Section header: title + one-line deck, gap 18, left-aligned. 1:1 with .pen mxUm8.
 * Title: Geist 56px / 600 / tracking -2.4 / lh 1.05 (foreground).
 * Deck:  Geist 24px / normal / lh 1.5 (muted-foreground).
 * Responsive: title scales down on small screens; desktop is exact.
 */
export function SectionHeader({
  title,
  deck,
  align = "left",
  className,
  deckClassName,
}: {
  title: React.ReactNode;
  deck?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
  deckClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-[18px]",
        align === "center" && "items-center text-center",
        className
      )}
    >
      <h2 className="text-[34px] font-semibold leading-[1.05] tracking-[-1.4px] text-foreground md:text-[56px] md:tracking-[-2.4px]">
        {title}
      </h2>
      {deck ? (
        <p
          className={cn(
            "text-lg leading-[1.5] text-muted-foreground md:text-2xl",
            align === "center" && "mx-auto",
            deckClassName
          )}
        >
          {deck}
        </p>
      ) : null}
    </div>
  );
}
