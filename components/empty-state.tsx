import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
  /** Dark-first inbox list / shell surfaces */
  variant?: "default" | "inbox"
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
  variant = "default",
}: EmptyStateProps) {
  const isInbox = variant === "inbox"
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed text-center",
        isInbox
          ? "border-[var(--inbox-list-border)] bg-transparent px-4 py-10"
          : "border-border bg-card p-12",
        className,
      )}
    >
      <Icon
        className={cn(
          "mx-auto mb-4 h-10 w-10",
          isInbox ? "text-[var(--inbox-list-text-secondary)]/35" : "text-muted-foreground/30",
        )}
      />
      <p className={cn("text-sm font-semibold", isInbox ? "text-[var(--inbox-list-text)]" : "text-foreground")}>
        {title}
      </p>
      {description && (
        <p
          className={cn(
            "mx-auto mt-1.5 max-w-xs text-xs leading-relaxed",
            isInbox ? "text-[var(--inbox-list-text-secondary)]" : "text-muted-foreground",
          )}
        >
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
