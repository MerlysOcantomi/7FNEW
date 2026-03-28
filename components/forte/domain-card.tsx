import type { DomainState, DomainLevel } from "@/agents/forte/runtime/business/domain-types"
import { GapItem } from "./gap-item"
import {
  MessageSquare,
  Users,
  FolderKanban,
  Megaphone,
  FileEdit,
  DollarSign,
  Brain,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react"

export const DOMAIN_LABELS: Record<string, string> = {
  communication: "Communication",
  relationship: "Relationship",
  delivery: "Delivery",
  marketing: "Marketing",
  content: "Content",
  finance: "Finance",
  intelligence: "Intelligence",
}

const DOMAIN_ICONS: Record<string, React.ElementType> = {
  communication: MessageSquare,
  relationship: Users,
  delivery: FolderKanban,
  marketing: Megaphone,
  content: FileEdit,
  finance: DollarSign,
  intelligence: Brain,
}

const LEVEL_LABELS: Record<DomainLevel, string> = {
  none: "Not active",
  basic: "Basic",
  intermediate: "Intermediate",
  advanced: "Advanced",
}

const LEVEL_COLORS: Record<DomainLevel, {
  badge: string
  text: string
  bar: string
  track: string
  border: string
}> = {
  none: {
    badge: "bg-[#FEE2E2] border-[#FECACA]",
    text: "text-[#DC2626]",
    bar: "bg-[#FCA5A5]",
    track: "bg-[#FEE2E2]",
    border: "border-l-[#FCA5A5]",
  },
  basic: {
    badge: "bg-[#FEF3C7] border-[#FDE68A]",
    text: "text-[#D97706]",
    bar: "bg-[#FCD34D]",
    track: "bg-[#FEF3C7]",
    border: "border-l-[#FCD34D]",
  },
  intermediate: {
    badge: "bg-[#DBEAFE] border-[#BFDBFE]",
    text: "text-[#2563EB]",
    bar: "bg-[#93C5FD]",
    track: "bg-[#DBEAFE]",
    border: "border-l-[#93C5FD]",
  },
  advanced: {
    badge: "bg-[#D1FAE5] border-[#A7F3D0]",
    text: "text-[#059669]",
    bar: "bg-[#6EE7B7]",
    track: "bg-[#D1FAE5]",
    border: "border-l-[#6EE7B7]",
  },
}

const DOMAIN_INSIGHTS: Record<string, Record<string, string>> = {
  communication: {
    none: "No communication infrastructure. Client interactions happen outside the system.",
    basic: "Basic messaging exists but there's no structured routing or follow-up tracking.",
    intermediate: "Communication works but lacks automation to handle volume efficiently.",
    advanced: "Communication is well structured with routing and automation in place.",
  },
  relationship: {
    none: "No client management. You're tracking relationships in your head or in spreadsheets.",
    basic: "You manage client records but aren't nurturing relationships systematically.",
    intermediate: "Good client management in place, but clients lack direct visibility into their work.",
    advanced: "Strong relationship infrastructure with full client lifecycle management.",
  },
  delivery: {
    none: "No project structure. Work happens but isn't tracked or managed centrally.",
    basic: "Projects exist but lack clear phases, milestones, or task breakdowns.",
    intermediate: "Solid project and task management. Delivery is structured and trackable.",
    advanced: "Delivery is fully structured with projects, tasks, and milestones working together.",
  },
  marketing: {
    none: "No marketing infrastructure. Growth depends entirely on referrals and word of mouth.",
    basic: "Some content exists but there's no campaign structure or audience strategy.",
    intermediate: "Content and campaigns are in place. You can reach and engage your audience.",
    advanced: "Full marketing stack with content, campaigns, and tracking working together.",
  },
  content: {
    none: "No content system. You can't build audience or establish authority at scale.",
    basic: "Some documents exist but there's no structured content creation pipeline.",
    intermediate: "Content creation and document management are functional and organized.",
    advanced: "Complete content infrastructure with creation, management, and AI analysis.",
  },
  finance: {
    none: "No financial visibility. You're operating without knowing your real margins.",
    basic: "You generate invoices but don't track expenses or overall financial health.",
    intermediate: "Invoicing and basic financial tracking are in place.",
    advanced: "Full financial control with invoicing, expense tracking, and margin visibility.",
  },
  intelligence: {
    none: "No AI capabilities active. The system can't learn from or analyze your data.",
    basic: "AI assistance is available but document analysis and automation are missing.",
    intermediate: "AI helps with interpretation and some analysis. Automation is partially active.",
    advanced: "Full intelligence stack with AI assistance, document analysis, and automation.",
  },
}

function getInsight(state: DomainState): string {
  return DOMAIN_INSIGHTS[state.domain]?.[state.level] ?? "No analysis available for this domain."
}

interface DomainCardProps {
  state: DomainState
  routesByCapability?: Record<string, string>
}

export function DomainCard({ state, routesByCapability }: DomainCardProps) {
  const Icon = DOMAIN_ICONS[state.domain] ?? Brain
  const label = DOMAIN_LABELS[state.domain] ?? state.domain
  const colors = LEVEL_COLORS[state.level]
  const insight = getInsight(state)
  const strengthPct = Math.round(state.strength * 100)
  const hasGaps = state.missingCapabilities.length > 0

  return (
    <div className={`bg-white rounded-xl border border-[#E2E8F0] border-l-[3px] ${colors.border} shadow-sm overflow-hidden`}>
      {/* Header */}
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center">
            <Icon size={18} className="text-[#64748B]" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#0F172A]">{label}</h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              {state.supportingModules.length > 0
                ? `${state.supportingModules.length} module${state.supportingModules.length > 1 ? "s" : ""} active`
                : state.supportingSignals.length > 0
                  ? "Signals detected, no dedicated modules"
                  : "No modules active"}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold border ${colors.badge} ${colors.text}`}
        >
          {LEVEL_LABELS[state.level]}
        </span>
      </div>

      {/* Strength bar */}
      <div className="px-5 pb-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-[#94A3B8] font-medium uppercase tracking-wider">Strength</span>
          <span className={`text-[11px] font-semibold ${colors.text}`}>{strengthPct}%</span>
        </div>
        <div className={`h-1.5 w-full rounded-full ${colors.track}`}>
          <div
            className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
            style={{ width: `${strengthPct}%` }}
          />
        </div>
      </div>

      {/* What Forte sees */}
      <div className="px-5 py-4">
        <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-1.5">What Forte sees</p>
        <p className="text-sm text-[#475569] leading-relaxed">
          {insight}
        </p>
      </div>

      {/* Notes (promoted — most specific content) */}
      {state.notes && state.notes.length > 0 && (
        <div className="px-5 pb-3">
          {state.notes.map((note, i) => (
            <p key={i} className="text-xs text-[#64748B] leading-relaxed bg-[#F8FAFC] rounded-md px-3 py-2 border border-[#F1F5F9]">
              {note}
            </p>
          ))}
        </div>
      )}

      {/* Gaps */}
      {hasGaps && (
        <div className="px-5 pb-4 border-t border-[#F1F5F9]">
          <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider pt-4 pb-1">
            What&apos;s missing
          </p>
          <div className="divide-y divide-[#F1F5F9]">
            {state.missingCapabilities.map((cap) => (
              <GapItem key={cap} capabilityId={cap} href={routesByCapability?.[cap]} />
            ))}
          </div>
        </div>
      )}

      {/* Good state */}
      {!hasGaps && (
        <div className="px-5 pb-4 border-t border-[#F1F5F9]">
          <div className="flex items-start gap-2.5 pt-4">
            {state.level === "advanced" ? (
              <ShieldCheck size={15} className="text-[#059669] mt-0.5 shrink-0" strokeWidth={2} />
            ) : (
              <CheckCircle2 size={15} className="text-[#059669] mt-0.5 shrink-0" strokeWidth={2} />
            )}
            <div>
              <p className="text-sm font-medium text-[#059669]">All key capabilities are active</p>
              {state.supportingModules.length > 0 && (
                <p className="text-xs text-[#64748B] mt-0.5">
                  Powered by {state.supportingModules.join(", ")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
