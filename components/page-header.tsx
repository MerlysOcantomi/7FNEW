import { cn } from "@/lib/utils"

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
  /** Dark canvas stripe used on legacy workspace routes beside the sidebar (matches `--app-shell-bg` content chrome). */
  tone?: "default" | "canvas"
}

export function PageHeader({ eyebrow, title, description, actions, tone = "default" }: PageHeaderProps) {
  const isCanvas = tone === "canvas"

  return (
    <div
      className={cn(
        "px-5 md:px-8 pt-7 pb-5 border-b",
        isCanvas ? "border-[var(--border-dark)] bg-[var(--app-surface-dark)]" : "border-border bg-background",
      )}
    >
      {eyebrow && (
        <p
          className={cn(
            "text-[10px] font-semibold uppercase tracking-widest mb-1",
            isCanvas ? "text-[var(--text-secondary-light)]" : "text-muted-foreground",
          )}
        >
          {eyebrow}
        </p>
      )}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <h1
            className={cn(
              "text-xl font-semibold tracking-tight",
              isCanvas ? "text-[var(--text-primary-light)]" : "text-foreground",
            )}
          >
            {title}
          </h1>
          {description && (
            <p
              className={cn(
                "mt-0.5 text-sm text-pretty max-w-xl",
                isCanvas ? "text-[var(--text-secondary-light)] leading-relaxed" : "text-muted-foreground",
              )}
            >
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
