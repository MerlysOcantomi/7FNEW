import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  label: string
  value: string
  subtitle?: string
  icon: LucideIcon
  color?: string
}

export function StatCard({ label, value, subtitle, icon: Icon, color = "#7C3AED" }: StatCardProps) {
  return (
    <div
      className="rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5"
      style={{ backgroundColor: color }}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">{label}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
          {subtitle && (
            <p className="text-xs text-white/60">{subtitle}</p>
          )}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  )
}
