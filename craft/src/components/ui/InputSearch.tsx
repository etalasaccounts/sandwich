import { forwardRef, type InputHTMLAttributes } from "react";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";

export interface InputSearchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  variant?: "dark" | "light";
  className?: string;
}

export const InputSearch = forwardRef<HTMLInputElement, InputSearchProps>(
  ({ variant = "light", className, placeholder = "Search...", ...props }, ref) => {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl py-2.5 px-3.5 w-full",
          variant === "dark"
            ? "bg-zinc-900"
            : "bg-zinc-50/80 border border-zinc-100 focus-within:border-green-400 transition-colors",
          className
        )}
      >
        <Icon icon="solar:magnifer-linear" className={variant === "dark" ? "text-zinc-500" : "text-zinc-400"} />
        <input
          type="text"
          ref={ref}
          placeholder={placeholder}
          className={cn(
            "bg-transparent border-none outline-none text-xs w-full font-light",
            variant === "dark"
              ? "text-zinc-300 placeholder-zinc-500"
              : "text-zinc-700 placeholder-zinc-400"
          )}
          {...props}
        />
      </div>
    );
  }
);

InputSearch.displayName = "InputSearch";
