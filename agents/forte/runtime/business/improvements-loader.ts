/**
 * Server-side loader for the Forte Improvements surface.
 *
 * Builds a ForteImprovementsViewModel from real workspace data
 * by reusing existing Forte runtime/business functions.
 *
 * This file is the single integration point between the workspace
 * state and the Improvements UI. The page never recalculates
 * domains or routing — it only renders what this loader returns.
 */

import type { ForteContext, ForteEffectiveCapabilities } from "../types"
import type { DomainState } from "./domain-types"
import type { GuidedRecommendationTarget } from "./recommendation-routing"
import { resolveForteCapabilities } from "../capability-resolver"
import { resolveSignals } from "./signals"
import { resolveDomainStates } from "./domain-resolver"
import {
  buildGuidedRecommendations,
  resolveNextMoveTarget,
} from "./recommendation-routing"
import { upsertForteSnapshot } from "./snapshot-store"

// ── View model ───────────────────────────────────────────────────────────────

export type WorkspaceMaturity = "empty" | "emerging" | "established"

export interface ForteImprovementsViewModel {
  domains: DomainState[]
  maturity: WorkspaceMaturity
  recommendations: GuidedRecommendationTarget[]
  nextMove: GuidedRecommendationTarget | null
}

// ── Maturity resolution ──────────────────────────────────────────────────────

export function resolveMaturity(domains: DomainState[]): WorkspaceMaturity {
  const activeCount = domains.filter((d) => d.level !== "none").length
  const hasIntermediate = domains.some(
    (d) => d.level === "intermediate" || d.level === "advanced",
  )

  if (activeCount === 0) return "empty"
  if (hasIntermediate) return "established"
  return "emerging"
}

// ── Pure computation (testable without DB) ───────────────────────────────────

export function buildImprovementsViewModel(
  capabilities: ForteEffectiveCapabilities,
): ForteImprovementsViewModel {
  const activeModules = capabilities.modules.map((m) => ({
    id: m.id,
    provides: m.provides ?? m.models ?? [],
  }))

  const signals = resolveSignals(
    Object.fromEntries(
      capabilities.capabilities.map((cap) => [cap, true]),
    ),
  )

  const domains = resolveDomainStates({ signals, activeModules })
  const recommendations = buildGuidedRecommendations(domains, 3)
  const nextMove = resolveNextMoveTarget(domains)
  const maturity = resolveMaturity(domains)

  return {
    domains,
    maturity,
    recommendations,
    nextMove,
  }
}

// ── Server-side loader ───────────────────────────────────────────────────────

export async function loadForteImprovements(
  context: ForteContext,
): Promise<ForteImprovementsViewModel> {
  const capabilities = await resolveForteCapabilities({ context })
  const viewModel = buildImprovementsViewModel(capabilities)

  // Persist latest analysis snapshot (non-blocking — page renders even if save fails)
  upsertForteSnapshot({
    workspaceId: context.workspaceId,
    maturity: viewModel.maturity,
    domains: viewModel.domains,
    topPriorities: viewModel.recommendations,
    recommendedNextMove: viewModel.nextMove,
  }).catch((err) => {
    console.error("[Forte] Failed to persist analysis snapshot:", err)
  })

  return viewModel
}
