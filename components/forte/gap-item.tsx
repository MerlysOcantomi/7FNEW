import { CircleDot, ArrowRight } from "lucide-react"
import { getCapabilityMeta } from "./capability-meta"

interface GapItemProps {
  capabilityId: string
  showAction?: boolean
}

export function GapItem({ capabilityId, showAction = true }: GapItemProps) {
  const meta = getCapabilityMeta(capabilityId)
  if (!meta) return null

  return (
    <div className="flex gap-3 py-3">
      <CircleDot size={14} className="text-[#D97706] mt-0.5 shrink-0" strokeWidth={2} />
      <div className="min-w-0 flex flex-col gap-1">
        <p className="text-sm font-medium text-[#1E293B]">{meta.label}</p>
        <p className="text-xs text-[#64748B] leading-relaxed">{meta.description}</p>
        <p className="text-xs text-[#B45309] leading-relaxed">{meta.impact}</p>
        {showAction && (
          <div className="flex items-center gap-1.5 mt-1">
            <ArrowRight size={11} className="text-[#3B82F6]" strokeWidth={2.5} />
            <span className="text-xs font-medium text-[#3B82F6]">{meta.action}</span>
          </div>
        )}
      </div>
    </div>
  )
}
