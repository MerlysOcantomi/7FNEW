"use client"

import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface DetailSectionProps {
  title: string
  icon?: LucideIcon
  badge?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function DetailSection({ title, icon: Icon, badge, action, children, className }: DetailSectionProps) {
  return (
    <section className={cn("rounded-xl border border-border bg-card p-5 md:p-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
          <h2 className="text-lg font-semibold">{title}</h2>
          {badge}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

interface DetailMetaRowProps {
  label: string
  children: React.ReactNode
  last?: boolean
}

export function DetailMetaRow({ label, children, last }: DetailMetaRowProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-3", !last && "border-b border-border")}>
      <span className="text-sm text-muted-foreground flex-shrink-0">{label}</span>
      <div className="min-w-0 text-right">{children}</div>
    </div>
  )
}

interface DetailEmptyProps {
  message: string
}

export function DetailEmpty({ message }: DetailEmptyProps) {
  return <p className="text-sm text-muted-foreground py-4">{message}</p>
}

export function formatDateES(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return "—"
  }
}

export function formatCurrencyMXN(n: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}
