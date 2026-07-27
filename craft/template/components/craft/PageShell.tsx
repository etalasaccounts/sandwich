import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The floating app shell from docs/design-system/patterns/mailbox.html:
// zinc-100 page, white rounded-3xl shell, rounded-2xl panel columns.
// `sidebar` renders as the dark zinc-950 panel. Each child must style
// itself as a rounded-2xl panel (bg-white or bg-zinc-50) — see
// foundations.md "Surfaces & layout".
export function PageShell({
  sidebar,
  children,
  className,
}: {
  sidebar?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="h-screen w-full flex items-center justify-center p-2 sm:p-4">
      <div
        className={cn(
          "bg-white rounded-3xl p-2 gap-2 flex flex-row w-full max-w-[1440px] h-full max-h-[900px] shadow-sm overflow-hidden",
          className
        )}
      >
        {sidebar ? (
          <aside className="bg-zinc-950 rounded-2xl p-4 gap-5 flex-col w-[320px] flex-shrink-0 hidden lg:flex overflow-y-auto">
            {sidebar}
          </aside>
        ) : null}
        {children}
      </div>
    </div>
  );
}
