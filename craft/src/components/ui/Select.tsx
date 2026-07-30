import { forwardRef, type SelectHTMLAttributes } from "react";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className={cn("relative", className)}>
        <select
          ref={ref}
          className={cn(
            "bg-white border border-zinc-200 rounded-xl py-2.5 px-3.5",
            "text-sm font-light text-zinc-900 outline-none w-full",
            "focus:border-green-400 transition-colors appearance-none pr-9",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          {...props}
        >
          {children}
        </select>
        <Icon icon="solar:alt-arrow-down-linear" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
      </div>
    );
  }
);

Select.displayName = "Select";
