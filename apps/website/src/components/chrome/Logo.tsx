import { cn } from "@/lib/utils";

/**
 * Nomba One logo. SVG mark extracted 1:1 from NOMBAONE.pen (node d5x2d,
 * viewBox 0 0 512 379). Uses currentColor so it inherits the theme foreground.
 */
export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-[9px] text-foreground", className)}>
      <svg
        viewBox="0 0 512 379"
        preserveAspectRatio="none"
        className="h-[22px] w-[30px] shrink-0 overflow-visible"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M444.396 378.198C395.484 378.198 371.028 359.585 371.028 322.36C371.028 303.297 376.865 289.63 388.539 281.358C400.213 272.906 418.019 268.679 441.957 268.679C465.896 268.679 483.554 272.906 494.933 281.358C506.311 289.63 512 303.387 512 322.63C512 341.692 506.68 355.719 496.041 364.711C485.549 373.702 468.334 378.198 444.396 378.198Z M188.606 44.2391L319.382 0V379H188.606V44.2391Z M0 186.398C0 155.826 1.921 129.75 5.763 108.17C9.75278 86.4103 16.3285 68.4269 25.4902 54.22C43.5181 25.9861 74.7713 11.8691 119.25 11.8691H136.539V379H119.25C75.3624 379 44.1091 362.455 25.4902 329.366C8.49674 299.334 0 251.678 0 186.398Z" />
      </svg>
      {showWordmark ? (
        <span className="text-[15px] font-semibold tracking-[-0.3px]">Nomba One</span>
      ) : (
        <span className="sr-only">Nomba One</span>
      )}
    </span>
  );
}
