import type { ReactNode } from "react";

// Panel header per docs/design-system/foundations.md typography roles.
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-5 border-b border-zinc-100">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-lg font-medium text-zinc-950 tracking-tight">{title}</h1>
        {description ? (
          <p className="text-xs font-light text-zinc-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}
