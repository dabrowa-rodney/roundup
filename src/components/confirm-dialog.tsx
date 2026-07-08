"use client";

import { useEffect, useState } from "react";

/**
 * Shared "are you sure?" dialog for destructive actions across the app, so
 * every delete/remove gets the same styled confirmation instead of a native
 * browser prompt (or none at all). Render it with `open` controlled by the
 * parent; it closes itself after a successful confirm.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);

  // Escape closes the dialog (unless a confirm is in flight).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const confirmClass =
    tone === "danger" ? "bg-bad text-white" : "bg-accent text-accent-ink";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-head text-lg font-bold">{title}</h2>
        <div className="mt-3 text-[13.5px] leading-[1.55] text-muted">{body}</div>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-full border border-line px-4 py-2 text-sm font-medium text-muted hover:bg-canvas disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onClose();
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className={`rounded-full px-4 py-2 text-sm font-bold disabled:opacity-40 ${confirmClass}`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
