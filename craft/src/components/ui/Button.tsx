import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "compact" | "icon";
  icon?: string;
  children?: ReactNode;
  className?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", icon, children, className, ...props }, ref) => {
    const baseStyles = "flex items-center justify-center transition-colors";
    
    const variants = {
      primary: "gap-2 bg-zinc-950 hover:bg-zinc-800 rounded-xl py-2 px-4 shadow-sm text-white",
      secondary: "gap-2 bg-zinc-50/80 border border-zinc-200 rounded-xl py-2.5 px-4 hover:bg-zinc-100 text-zinc-700",
      compact: "gap-1.5 bg-zinc-900 rounded-full py-1.5 px-3 hover:bg-zinc-800 text-zinc-400",
      icon: "w-8 h-8 rounded-full bg-zinc-200/50 hover:bg-zinc-200 text-zinc-600",
    };

    return (
      <button ref={ref} className={cn(baseStyles, variants[variant], className)} {...props}>
        {icon && <Icon icon={icon} className="text-sm" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
