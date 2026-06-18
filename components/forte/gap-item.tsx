import Link from "next/link"
import { CircleDot, ArrowRight } from "lucide-react"
import { getCapabilityMeta } from "./capability-meta"

interface GapItemProps {
  capabilityId: string
  href?: string
  showAction?: boolean
}

export function GapItem({ capabilityId, href, showAction = true }: GapItemProps) {
  const meta = getCapabilityMeta(capabilityId)
  if (!meta) return null

  return (
    <div className="flex gap-3 py-3">
      <CircleDot size={14} className="text-[var(--status-warning-text)] mt-0.5 shrink-0" strokeWidth={2} />
      <div className="min-w-0 flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{meta.label}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{meta.description}</p>
        <p className="text-xs text-[var(--status-warning-text)] leading-relaxed">{meta.impact}</p>
        {showAction && (
          <div className="flex items-center gap-1.5 mt-1">
            <ArrowRight size={11} className="text-[var(--tab-info)]" strokeWidth={2.5} />
            {href ? (
              <Link
                href={href}
                className="text-xs font-medium text-[var(--tab-info)] hover:underline transition-colors"
              >
                {meta.action}
              </Link>
            ) : (
              <span className="text-xs font-medium text-[var(--tab-info)]">{meta.action}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
