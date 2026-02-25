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
    <div
      className="rounded-xl border border-border/50 border-l-4 bg-card shadow-sm p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderLeftColor: accentColor || "var(--muted)" }}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold text-card-foreground">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: accentColor || "var(--muted)", opacity: 0.15 }}
          />
          <Icon className="relative h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  )
}
