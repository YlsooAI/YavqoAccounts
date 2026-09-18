"use client";

import { CheckCircle2, CircleAlert, X } from "lucide-react";

export type ToastItem = {
  id: number;
  kind: "success" | "error";
  message: string;
};

export default function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[80] flex w-[min(420px,calc(100%-2rem))] -translate-x-1/2 flex-col gap-2 md:left-8 md:translate-x-0">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 rounded-lg bg-[#323232] px-4 py-3 text-[13px] text-white shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
          role="status"
        >
          {toast.kind === "success" ? (
            <CheckCircle2 size={18} className="shrink-0 text-[#81c995]" aria-hidden="true" />
          ) : (
            <CircleAlert size={18} className="shrink-0 text-[#f28b82]" aria-hidden="true" />
          )}
          <p className="min-w-0 flex-1 leading-snug">{toast.message}</p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => onDismiss(toast.id)}
            className="rounded-full p-1 text-[#9aa0a6] hover:bg-white/10 hover:text-white"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
