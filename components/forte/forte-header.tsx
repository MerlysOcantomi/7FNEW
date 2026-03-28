import type { DomainState } from "@/agents/forte/runtime/business/domain-types"
import { DOMAIN_LABELS } from "./domain-card"
import { Sparkles } from "lucide-react"

interface ForteHeaderProps {
  domains: DomainState[]
}

interface ForteSummary {
  title: string
  subtitle: string
  forteQuote: string
}

function buildForteSummary(domains: DomainState[]): ForteSummary {
  const weak = domains.filter((d) => d.level === "none" || d.level === "basic")
  const strong = domains.filter((d) => d.level === "intermediate" || d.level === "advanced")
  const totalGaps = domains.reduce((sum, d) => sum + d.missingCapabilities.length, 0)

  const nameOf = (d: DomainState) => DOMAIN_LABELS[d.domain] ?? d.domain
  const weakNames = weak.sort((a, b) => a.strength - b.strength).map(nameOf)
  const strongNames = strong.sort((a, b) => b.strength - a.strength).map(nameOf)
  const weakest = weak.length > 0 ? weak.sort((a, b) => a.strength - b.strength)[0] : null

  if (weak.length === 0) {
    return {
      title: "Your workspace is well structured",
      subtitle: strongNames.length > 0
        ? `${strongNames.slice(0, 3).join(", ")} are performing well. There's always room to deepen.`
        : "All domains are at a healthy level.",
      forteQuote: "Everything looks solid. I'd keep building on what's working and watch for new opportunities.",
    }
  }

  const titleParts = weakNames.slice(0, 3).join(", ")
  const titleSuffix = weakNames.length > 3 ? ` and ${weakNames.length - 3} more` : ""

  const subtitleParts: string[] = []
  if (strongNames.length > 0) {
    subtitleParts.push(`${strongNames.slice(0, 2).join(" and ")} ${strongNames.length === 1 ? "is" : "are"} solid`)
  }
  if (totalGaps > 0) {
    subtitleParts.push(`${totalGaps} gap${totalGaps !== 1 ? "s" : ""} detected across ${weak.length} area${weak.length !== 1 ? "s" : ""}`)
  }

  let forteQuote: string
  if (weakest && weakest.level === "none") {
    forteQuote = `I'd start with ${nameOf(weakest)}. There's no infrastructure there yet, and it's limiting growth.`
  } else if (weakest) {
    forteQuote = `${nameOf(weakest)} has a foundation but gaps that are worth closing soon.`
  } else {
    forteQuote = "Some areas are strong, others need attention. The priorities below show where to focus."
  }

  return {
    title: `${titleParts}${titleSuffix} need${weakNames.length === 1 ? "s" : ""} attention`,
    subtitle: subtitleParts.join(". ") + ".",
    forteQuote,
  }
}

export function ForteHeader({ domains }: ForteHeaderProps) {
  const summary = buildForteSummary(domains)

  return (
    <div className="pb-6 border-b border-[#E2E8F0]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
          <Sparkles size={14} className="text-[#3B82F6]" strokeWidth={2} />
        </div>
        <span className="text-[11px] font-semibold text-[#3B82F6] uppercase tracking-widest">
          Forte Analysis
        </span>
      </div>

      <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight">
        {summary.title}
      </h1>

      <p className="text-sm text-[#64748B] mt-1.5 max-w-2xl leading-relaxed">
        {summary.subtitle}
      </p>

      <p className="text-[13px] text-[#475569] mt-3 leading-relaxed">
        <span className="font-medium text-[#334155]">Forte:</span>{" "}
        &ldquo;{summary.forteQuote}&rdquo;
      </p>
    </div>
  )
}
