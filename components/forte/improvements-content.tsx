"use client"

import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { ForteHeader } from "@/components/forte/forte-header"
import { DomainCard, DOMAIN_LABELS } from "@/components/forte/domain-card"
import type { ForteImprovementsViewModel } from "@/agents/forte/runtime/business/improvements-loader"
import { resolveRecommendationTarget } from "@/agents/forte/runtime/business/recommendation-routing"
import { buildSettingsHandoffUrl } from "@/agents/forte/runtime/business/settings-handoff"
import { AlertTriangle, ArrowRight, Lightbulb, TrendingUp, Inbox } from "lucide-react"

function buildRoutesByCapability(
  viewModel: ForteImprovementsViewModel,
): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {}
  for (const d of viewModel.domains) {
    const map: Record<string, string> = {}
    for (const cap of d.missingCapabilities) {
      const target = resolveRecommendationTarget(d, cap)
      if (target.availability === "available") {
        map[cap] = target.href
      }
    }
    if (Object.keys(map).length > 0) {
      result[d.domain] = map
    }
  }
  return result
}

interface ForteImprovementsContentProps {
  viewModel: ForteImprovementsViewModel
}

export function ForteImprovementsContent({ viewModel }: ForteImprovementsContentProps) {
  const { domains, maturity, recommendations, nextMove } = viewModel
  const sorted = [...domains].sort((a, b) => a.strength - b.strength)
  const routesByDomain = buildRoutesByCapability(viewModel)
  const allGood = recommendations.length === 0

  return (
    <AppShell currentSection="improvements">
      <div className="flex flex-col gap-8 pb-12">
        {/* Empty workspace */}
        {maturity === "empty" && (
          <>
            <ForteHeader domains={domains} />

            <section className="bg-muted border border-border rounded-xl px-6 py-8 text-center">
              <div className="mx-auto w-12 h-12 rounded-xl bg-[var(--tab-info)]/15 border border-transparent flex items-center justify-center mb-4">
                <Inbox size={22} className="text-[var(--tab-info)]" strokeWidth={1.5} />
              </div>
              <h2 className="text-base font-semibold text-foreground mb-1.5">
                Your workspace is just getting started
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                Forte doesn&apos;t see any active modules or business signals yet.
                Start by enabling a few capabilities in your workspace settings,
                and this page will reflect your real business structure.
              </p>
              <Link
                href={buildSettingsHandoffUrl({ reason: "empty-workspace" })}
                className="inline-flex items-center gap-1.5 mt-5 text-sm font-medium text-[var(--tab-info)] hover:underline transition-colors"
              >
                Open Workspace Settings
                <ArrowRight size={14} strokeWidth={2} />
              </Link>
            </section>
          </>
        )}

        {/* Active workspace (emerging or established) */}
        {maturity !== "empty" && (
          <>
            <ForteHeader domains={domains} />

            {/* Recommended next move */}
            {nextMove && (
              <section className="bg-[var(--tab-info)]/15 border border-transparent rounded-xl px-5 py-5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-card border border-transparent flex items-center justify-center shrink-0 mt-0.5">
                    <Lightbulb size={16} className="text-[var(--tab-info)]" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[var(--tab-info)] uppercase tracking-widest mb-1">
                      Recommended next move
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {nextMove.label}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {nextMove.rationale}
                    </p>
                    {nextMove.availability === "available" && (
                      <Link
                        href={nextMove.href}
                        className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-[var(--tab-info)] hover:underline transition-colors"
                      >
                        {nextMove.label}
                        <ArrowRight size={12} strokeWidth={2.5} />
                      </Link>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Priorities */}
            {!allGood && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle size={14} className="text-[var(--status-warning-text)]" strokeWidth={2} />
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    Start here
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {recommendations.map((r, i) => (
                    <div
                      key={`${r.domain}-${r.capabilityId}`}
                      className="bg-card rounded-xl border border-border border-l-[3px] border-l-[var(--status-warning-text)] shadow-sm px-4 py-4 flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[var(--status-warning-bg)] border border-transparent flex items-center justify-center text-[10px] font-bold text-[var(--status-warning-text)]">
                          {i + 1}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">
                          {DOMAIN_LABELS[r.domain] ?? r.domain}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{r.label}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{r.rationale}</p>
                      {r.availability === "available" && (
                        <Link
                          href={r.href}
                          className="flex items-center gap-1.5 mt-auto pt-1 text-xs font-medium text-[var(--tab-info)] hover:underline transition-colors"
                        >
                          {r.label}
                          <ArrowRight size={11} strokeWidth={2.5} />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* All good state */}
            {allGood && (
              <section className="bg-[var(--status-success-bg)] border border-transparent rounded-xl px-5 py-5">
                <div className="flex items-start gap-3">
                  <TrendingUp size={18} className="text-[var(--status-success-text)] mt-0.5 shrink-0" strokeWidth={2} />
                  <div>
                    <p className="text-sm font-medium text-[var(--status-success-text)]">
                      Your workspace is in good shape.
                    </p>
                    <p className="text-xs text-[var(--status-success-text)] mt-1 leading-relaxed">
                      All key areas are covered. Consider deepening Intelligence — document analysis would unlock insights from your existing data.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Domain cards */}
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
                Domain by domain
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {sorted.map((d) => (
                  <DomainCard
                    key={d.domain}
                    state={d}
                    routesByCapability={routesByDomain[d.domain]}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  )
}
