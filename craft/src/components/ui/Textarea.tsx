import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "bg-zinc-50/80 border border-zinc-100 rounded-xl py-2.5 px-3.5",
          "text-sm font-light text-zinc-900 outline-none placeholder-zinc-400 w-full",
          "focus:border-green-400 transition-colors resize-none min-h-[100px]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
