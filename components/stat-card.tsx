import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  label: string
  value: string
  subtitle?: string
  icon: LucideIcon
  accentColor?: string
}

export function StatCard({ label, value, subtitle, icon: Icon, accentColor }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold text-card-foreground">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: accentColor || "var(--muted)" }}
        >
          <Icon className="h-5 w-5 text-foreground/70" />
        </div>
      </div>
    </div>
  )
}
