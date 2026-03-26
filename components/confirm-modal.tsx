"use client"

import { AlertTriangle, X } from "lucide-react"

interface ConfirmModalProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "warning" | "default"
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onCancel} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-start gap-4">
          {variant === "danger" && (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--tab-review)] flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-foreground/60" />
            </div>
          )}
          {variant === "warning" && (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--tab-tasks)] flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-foreground/60" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 ${
              variant === "danger"
                ? "bg-destructive text-card"
                : "bg-foreground text-background"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
