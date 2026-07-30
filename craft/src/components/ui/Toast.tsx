import { type ReactNode } from "react";
import { Icon } from "./Icon";

export type ToastVariant = "success" | "error" | "info";

interface ToastProps {
  variant?: ToastVariant;
  children: ReactNode;
  onClose?: () => void;
}

const variantIcons: Record<ToastVariant, string> = {
  success: "solar:check-circle-linear",
  error: "solar:danger-triangle-linear",
  info: "solar:info-circle-linear",
};

const variantIconColors: Record<ToastVariant, string> = {
  success: "text-green-400",
  error: "text-orange-500",
  info: "text-cyan-400",
};

export function Toast({ variant = "info", children, onClose }: ToastProps) {
  return (
    <div className="flex items-center gap-3 bg-zinc-950 rounded-xl py-3 px-4 shadow-lg">
      <Icon icon={variantIcons[variant]} className={`${variantIconColors[variant]} text-base`} />
      <span className="text-sm font-light text-zinc-50">{children}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-2 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <Icon icon="solar:close-circle-linear" className="text-sm" />
        </button>
      )}
    </div>
  );
}

// Toast container for positioning
export function ToastContainer({ children }: { children: ReactNode }) {
  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      {children}
    </div>
  );
}
