import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The only fixed structural convention every screen shares: a consistent
// max-width and padding. Nav chrome comes from a real shadcn sidebar/nav
// block chosen per project, not from a component in this file — don't add
// one here.
export function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl p-6 space-y-6", className)}>
      {children}
    </div>
  );
}
