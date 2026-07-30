import { forwardRef, type ReactNode } from "react";
import { Input, type InputProps } from "./Input";
import { cn } from "@/lib/utils";

export interface InputFieldProps extends Omit<InputProps, "className"> {
  label: string;
  description?: string;
  labelAction?: ReactNode;
  className?: string;
  inputClassName?: string;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, description, labelAction, className, inputClassName, ...props }, ref) => {
    return (
      <label className={cn("flex flex-col gap-1.5 w-full", className)}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-light text-zinc-500">{label}</span>
          {labelAction}
        </div>
        <Input ref={ref} className={inputClassName} {...props} />
        {description && (
          <span className="text-xs font-light text-zinc-400">{description}</span>
        )}
      </label>
    );
  }
);

InputField.displayName = "InputField";
