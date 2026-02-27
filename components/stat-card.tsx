import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string
  subtitle?: string
  icon: LucideIcon
  accent?: "default" | "finance"
}

export function StatCard({ label, value, subtitle, icon: Icon, accent }: StatCardProps) {
  return (
    <div
      className={cn(
        "group relative rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md",
        accent === "finance" && "border-l-4 border-l-blue-600"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-[#111827]">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
          <Icon className="h-5 w-5 text-blue-600" />
        </div>
      </div>
    </div>
  )
}
