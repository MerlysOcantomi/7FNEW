import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string
  subtitle?: string
  icon?: LucideIcon
  className?: string
}

export function StatCard({ label, value, subtitle, icon: Icon, className }: StatCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      {Icon && (
        <Icon size={16} strokeWidth={1.75} className="mb-3 text-primary" />
      )}
      <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-foreground">{label}</p>
      {subtitle && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">{subtitle}</p>
      )}
    </div>
  )
}
