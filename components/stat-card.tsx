import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string
  subtitle?: string
  icon?: LucideIcon
  iconClassName?: string
  className?: string
  /** Match `--app-shell-bg` chrome (dark sidebar-adjacent column). */
  tone?: "default" | "canvas"
}

export function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  iconClassName,
  className,
  tone = "default",
}: StatCardProps) {
  const isCanvas = tone === "canvas"

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        isCanvas ? "border-[var(--border-dark)] bg-[var(--app-surface-dark)] shadow-none" : "border-border bg-card",
        className,
      )}
    >
      {Icon && (
        <Icon
          size={16}
          strokeWidth={1.75}
          className={cn(
            "mb-3 text-primary",
            isCanvas && "text-[var(--accent-primary)]",
            iconClassName,
          )}
        />
      )}
      <p
        className={cn(
          "text-2xl font-bold tracking-tight",
          isCanvas ? "text-[var(--text-primary-light)]" : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className={cn("mt-0.5 text-xs font-medium", isCanvas ? "text-[var(--text-primary-light)]" : "text-foreground")}>
        {label}
      </p>
      {subtitle && (
        <p className={cn("mt-0.5 text-[10px]", isCanvas ? "text-[var(--text-secondary-light)]" : "text-muted-foreground")}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
