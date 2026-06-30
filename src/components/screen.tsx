import { DeadlinePill } from "./deadline-pill";

/**
 * Per-screen wrapper: sticky translucent top bar (title + subtitle + deadline
 * pill) followed by the padded content area. Lives inside the scrollable main
 * column provided by the app layout.
 */
export function Screen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="sticky top-0 z-10 flex items-center gap-5 border-b border-line bg-bg/80 px-9 py-4 backdrop-blur-md">
        <div className="min-w-0">
          <h1 className="font-head text-[21px] font-bold leading-[1.1] tracking-[-0.02em]">
            {title}
          </h1>
          {subtitle && (
            <div className="mt-0.5 text-[13px] text-muted">{subtitle}</div>
          )}
        </div>
        <div className="flex-1" />
        <DeadlinePill />
      </div>
      <div className="fade-up px-9 pb-20 pt-8">{children}</div>
    </>
  );
}
