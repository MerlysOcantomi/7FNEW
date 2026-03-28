"use client"

import { AppShell } from "@/components/app-shell"
import { ForteHeader } from "@/components/forte/forte-header"
import { DomainCard, DOMAIN_LABELS } from "@/components/forte/domain-card"
import { getCapabilityLabel, getCapabilityAction } from "@/components/forte/capability-meta"
import type { DomainState } from "@/agents/forte/runtime/business/domain-types"
import { AlertTriangle, ArrowRight, Lightbulb, TrendingUp } from "lucide-react"

// ── View model contract ─────────────────────────────────────────────────────
// This is the expected shape when this surface connects to a real endpoint.
// Today it is populated from mock data. When the API exists, the fetch
// should return this structure and the page should consume it directly.

export interface ForteImprovementsViewModel {
  domains: DomainState[]
  workspaceSummary?: string
  topPriorities?: PriorityGap[]
  recommendedNextMove?: {
    domain: string
    capabilityId: string
    reason: string
  }
}

// ── Mock data — replace with real API call when endpoint exists ──────────────
const MOCK_DOMAINS: DomainState[] = [
  {
    domain: "communication",
    level: "intermediate",
    strength: 0.6,
    supportingSignals: ["smartInbox"],
    supportingModules: ["inbox"],
    missingCapabilities: ["automations"],
    notes: ["Inbox is active but no automation rules are configured yet"],
  },
  {
    domain: "relationship",
    level: "basic",
    strength: 0.3,
    supportingSignals: ["crm"],
    supportingModules: ["clientes"],
    missingCapabilities: ["portal"],
    notes: ["Client records exist but clients have no self-service access"],
  },
  {
    domain: "delivery",
    level: "intermediate",
    strength: 0.65,
    supportingSignals: ["projectDelivery", "taskManagement"],
    supportingModules: ["proyectos", "tareas"],
    missingCapabilities: [],
  },
  {
    domain: "marketing",
    level: "none",
    strength: 0,
    supportingSignals: [],
    supportingModules: [],
    missingCapabilities: ["contentMarketing", "campaigns"],
  },
  {
    domain: "content",
    level: "none",
    strength: 0,
    supportingSignals: [],
    supportingModules: [],
    missingCapabilities: ["contentMarketing", "documents"],
  },
  {
    domain: "finance",
    level: "basic",
    strength: 0.25,
    supportingSignals: ["invoicing"],
    supportingModules: ["facturacion"],
    missingCapabilities: ["financeControl"],
    notes: ["Invoicing works but there's no expense tracking or margin visibility"],
  },
  {
    domain: "intelligence",
    level: "basic",
    strength: 0.35,
    supportingSignals: ["aiAssistance"],
    supportingModules: [],
    missingCapabilities: ["documentAnalysis", "automations"],
  },
]

// ── Types ────────────────────────────────────────────────────────────────────

interface PriorityGap {
  domain: string
  domainLabel: string
  capabilityId: string
  capabilityLabel: string
  description: string
  action: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractPriorities(domains: DomainState[], max = 3): PriorityGap[] {
  const gaps: PriorityGap[] = []
  const sorted = [...domains].sort((a, b) => a.strength - b.strength)

  for (const d of sorted) {
    if (gaps.length >= max) break
    if (d.level !== "none" && d.level !== "basic") continue
    for (const cap of d.missingCapabilities) {
      if (gaps.length >= max) break
      if (gaps.some((g) => g.capabilityId === cap)) continue
      gaps.push({
        domain: d.domain,
        domainLabel: DOMAIN_LABELS[d.domain] ?? d.domain,
        capabilityId: cap,
        capabilityLabel: getCapabilityLabel(cap),
        description: getCapabilityAction(cap),
        action: getCapabilityAction(cap),
      })
    }
  }

  return gaps
}

interface NextMove {
  domainLabel: string
  capabilityLabel: string
  reason: string
  action: string
}

function resolveNextMove(domains: DomainState[]): NextMove | null {
  const weakest = [...domains]
    .filter((d) => d.missingCapabilities.length > 0)
    .sort((a, b) => a.strength - b.strength)[0]

  if (!weakest) return null

  const topGap = weakest.missingCapabilities[0]
  const domainLabel = DOMAIN_LABELS[weakest.domain] ?? weakest.domain

  const reasons: Record<string, string> = {
    none: `${domainLabel} has no infrastructure yet. This is the biggest structural gap.`,
    basic: `${domainLabel} has a foundation but critical capabilities are missing.`,
  }

  return {
    domainLabel,
    capabilityLabel: getCapabilityLabel(topGap),
    reason: reasons[weakest.level] ?? `${domainLabel} would benefit most from this improvement.`,
    action: getCapabilityAction(topGap),
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ForteImprovements() {
  const domains = MOCK_DOMAINS
  const sorted = [...domains].sort((a, b) => a.strength - b.strength)
  const priorities = extractPriorities(domains)
  const nextMove = resolveNextMove(domains)
  const allGood = priorities.length === 0

  return (
    <AppShell currentSection="improvements">
      <div className="flex flex-col gap-8 pb-12">
        {/* Header */}
        <ForteHeader domains={domains} />

        {/* Recommended next move */}
        {nextMove && (
          <section className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-5 py-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-white border border-[#BFDBFE] flex items-center justify-center shrink-0 mt-0.5">
                <Lightbulb size={16} className="text-[#2563EB]" strokeWidth={2} />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#2563EB] uppercase tracking-widest mb-1">
                  Recommended next move
                </p>
                <p className="text-sm font-semibold text-[#0F172A]">
                  {nextMove.action}
                </p>
                <p className="text-sm text-[#475569] mt-1 leading-relaxed">
                  {nextMove.reason}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Priorities */}
        {!allGood && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={14} className="text-[#D97706]" strokeWidth={2} />
              <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-widest">
                Start here
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {priorities.map((p, i) => (
                <div
                  key={p.capabilityId}
                  className="bg-white rounded-xl border border-[#E2E8F0] border-l-[3px] border-l-[#FCD34D] shadow-sm px-4 py-4 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FEF3C7] border border-[#FDE68A] flex items-center justify-center text-[10px] font-bold text-[#D97706]">
                      {i + 1}
                    </span>
                    <span className="text-xs font-medium text-[#94A3B8]">{p.domainLabel}</span>
                  </div>
                  <p className="text-sm font-semibold text-[#0F172A]">{p.capabilityLabel}</p>
                  <p className="text-xs text-[#64748B] leading-relaxed">{p.description}</p>
                  <div className="flex items-center gap-1.5 mt-auto pt-1">
                    <ArrowRight size={11} className="text-[#3B82F6]" strokeWidth={2.5} />
                    <span className="text-xs font-medium text-[#3B82F6]">{p.action}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* All good state */}
        {allGood && (
          <section className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-5 py-5">
            <div className="flex items-start gap-3">
              <TrendingUp size={18} className="text-[#059669] mt-0.5 shrink-0" strokeWidth={2} />
              <div>
                <p className="text-sm font-medium text-[#166534]">
                  Your workspace is in good shape.
                </p>
                <p className="text-xs text-[#15803D] mt-1 leading-relaxed">
                  All key areas are covered. Consider deepening Intelligence — document analysis would unlock insights from your existing data.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Domain cards */}
        <section>
          <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-widest mb-4">
            Domain by domain
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sorted.map((d) => (
              <DomainCard key={d.domain} state={d} />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
