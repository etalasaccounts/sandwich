import { type ReactNode } from "react";
import { Icon } from "./Icon";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  children?: ReactNode; // Additional content like dependent records
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  destructive = false,
  children,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-zinc-950/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md flex flex-col gap-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-lg font-medium text-zinc-950 tracking-tight">{title}</span>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500"
          >
            <Icon icon="solar:close-circle-linear" className="text-base" />
          </button>
        </div>
        <p className="text-sm font-light text-zinc-700 leading-relaxed">{message}</p>
        {children}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="rounded-full py-1.5 px-4 text-xs text-zinc-500 hover:bg-zinc-100 font-light transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`transition-colors rounded-xl py-2 px-4 shadow-sm text-white text-xs font-medium tracking-wide ${
              destructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-zinc-950 hover:bg-zinc-800"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
