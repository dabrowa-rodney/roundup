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
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  // No title → content-first screen (e.g. the Roundup viewer, whose header
  // lives in the content per the dashboard design).
  if (!title) {
    return (
      <div className="fade-up px-5 pb-20 pt-7 sm:px-8">
        <div className="mx-auto w-full max-w-[1170px]">{children}</div>
      </div>
    );
  }
  return (
    <>
      <div className="sticky top-0 z-10 border-b border-line bg-bg/80 px-5 py-4 backdrop-blur-md sm:px-9">
        <div className="mx-auto flex w-full max-w-[1170px] flex-wrap items-center gap-x-5 gap-y-2">
          <div className="min-w-fit">
            <h1 className="font-head text-[21px] font-bold leading-[1.1] tracking-[-0.02em]">
              {title}
            </h1>
            {subtitle && (
              <div className="mt-0.5 text-[13px] text-muted">{subtitle}</div>
            )}
          </div>
          <div className="ml-auto">
            <DeadlinePill />
          </div>
        </div>
      </div>
      <div className="fade-up px-5 pb-20 pt-8 sm:px-9">
        <div className="mx-auto w-full max-w-[1170px]">{children}</div>
      </div>
    </>
  );
}
