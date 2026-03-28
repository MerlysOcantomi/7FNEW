/**
 * Guided Recommendation Routing for Forte.
 *
 * Transforms domain gaps and missing capabilities into concrete,
 * navigable destinations within the product. All functions are
 * pure and deterministic — no AI, no side effects.
 *
 * Routing decisions are centralized here. The UI layer consumes
 * resolved targets but never decides routes on its own.
 */

import type { BusinessDomain, DomainState } from "./domain-types"

// ── Types ────────────────────────────────────────────────────────────────────

export type RecommendationDestinationKind =
  | "module"
  | "settings"
  | "workspace"
  | "unknown"

export type RecommendationTargetSource =
  | "capability"
  | "domain-fallback"

export interface GuidedRecommendationTarget {
  domain: BusinessDomain
  capabilityId: string
  label: string
  rationale: string
  href: string
  kind: RecommendationDestinationKind
  source: RecommendationTargetSource
  availability: "available" | "unavailable"
}

// ── Routing tables ───────────────────────────────────────────────────────────

interface RouteEntry {
  href: string
  label: string
  kind: RecommendationDestinationKind
}

const CAPABILITY_ROUTE_MAP: Record<string, RouteEntry> = {
  crm:              { href: "/clientes",          label: "Go to Clients",            kind: "module" },
  portal:           { href: "/clientes",          label: "Go to Clients",            kind: "module" },
  smartInbox:       { href: "/inbox",             label: "Open Inbox",               kind: "module" },
  automations:      { href: "/automatizaciones",  label: "Open Automations",         kind: "module" },
  projectDelivery:  { href: "/proyectos",         label: "Go to Projects",           kind: "module" },
  taskManagement:   { href: "/tareas",            label: "Go to Tasks",              kind: "module" },
  invoicing:        { href: "/facturacion",       label: "Go to Billing",            kind: "module" },
  financeControl:   { href: "/finanzas",          label: "Open Finance",             kind: "module" },
  contentMarketing: { href: "/contenido",         label: "Open Marketing",           kind: "module" },
  campaigns:        { href: "/contenido",         label: "Open Marketing",           kind: "module" },
  documents:        { href: "/archivos",          label: "Go to Files",              kind: "module" },
  documentAnalysis: { href: "/motor",             label: "Open AI Workspace",        kind: "workspace" },
  aiAssistance:     { href: "/motor",             label: "Open AI Workspace",        kind: "workspace" },
}

const DOMAIN_FALLBACK_ROUTE: Record<BusinessDomain, RouteEntry> = {
  communication: { href: "/inbox",       label: "Open Inbox",         kind: "module" },
  relationship:  { href: "/clientes",    label: "Go to Clients",      kind: "module" },
  delivery:      { href: "/proyectos",   label: "Go to Projects",     kind: "module" },
  marketing:     { href: "/contenido",   label: "Open Marketing",     kind: "module" },
  content:       { href: "/contenido",   label: "Open Marketing",     kind: "module" },
  finance:       { href: "/finanzas",    label: "Open Finance",       kind: "module" },
  intelligence:  { href: "/motor",       label: "Open AI Workspace",  kind: "workspace" },
}

// ── Rationale generation ─────────────────────────────────────────────────────

const DOMAIN_RATIONALE: Record<BusinessDomain, Record<string, string>> = {
  communication: {
    _fallback: "Communication needs a structured entry point to work at scale.",
    smartInbox: "A centralized inbox would prevent messages from getting lost.",
    automations: "Automation rules would reduce manual routing of incoming messages.",
  },
  relationship: {
    _fallback: "Managing client relationships systematically prevents churn.",
    crm: "Without CRM, client interactions depend on memory and scattered notes.",
    portal: "A client portal would reduce support requests and build transparency.",
  },
  delivery: {
    _fallback: "Structured delivery keeps projects on track and accountable.",
    projectDelivery: "Projects need clear phases and milestones to stay on schedule.",
    taskManagement: "Tasks fall through without a tracking system.",
  },
  marketing: {
    _fallback: "Without marketing infrastructure, growth depends entirely on referrals.",
    contentMarketing: "A content system enables scalable reach beyond word of mouth.",
    campaigns: "Campaigns bring structure to outreach so you can measure what works.",
  },
  content: {
    _fallback: "Content creation needs a pipeline to scale beyond ad-hoc efforts.",
    contentMarketing: "Systematic content builds audience and authority over time.",
    documents: "Scattered files make collaboration harder than it needs to be.",
  },
  finance: {
    _fallback: "Financial visibility shows whether the business is actually profitable.",
    invoicing: "Invoicing needs to be tracked systematically to avoid revenue leaks.",
    financeControl: "Without expense tracking, you can't tell if a project is profitable.",
  },
  intelligence: {
    _fallback: "AI capabilities unlock insights trapped in existing data.",
    documentAnalysis: "Document analysis extracts actionable information automatically.",
    aiAssistance: "AI assistance accelerates interpretation and content creation.",
    automations: "Automation reduces time spent on repetitive manual work.",
  },
}

function getRationale(domain: BusinessDomain, capabilityId: string): string {
  return DOMAIN_RATIONALE[domain]?.[capabilityId]
    ?? DOMAIN_RATIONALE[domain]?._fallback
    ?? "This area would benefit from improvement."
}

// ── Resolvers ────────────────────────────────────────────────────────────────

export function resolveRecommendationTarget(
  state: DomainState,
  capabilityId: string,
): GuidedRecommendationTarget {
  const capRoute = CAPABILITY_ROUTE_MAP[capabilityId]

  if (capRoute) {
    return {
      domain: state.domain,
      capabilityId,
      label: capRoute.label,
      rationale: getRationale(state.domain, capabilityId),
      href: capRoute.href,
      kind: capRoute.kind,
      source: "capability",
      availability: "available",
    }
  }

  const fallback = DOMAIN_FALLBACK_ROUTE[state.domain]
  if (fallback) {
    return {
      domain: state.domain,
      capabilityId,
      label: fallback.label,
      rationale: getRationale(state.domain, capabilityId),
      href: fallback.href,
      kind: fallback.kind,
      source: "domain-fallback",
      availability: "available",
    }
  }

  return {
    domain: state.domain,
    capabilityId,
    label: "No destination yet",
    rationale: getRationale(state.domain, capabilityId),
    href: "",
    kind: "unknown",
    source: "domain-fallback",
    availability: "unavailable",
  }
}

export function buildGuidedRecommendations(
  domains: DomainState[],
  max = 5,
): GuidedRecommendationTarget[] {
  const targets: GuidedRecommendationTarget[] = []
  const seenHrefs = new Set<string>()

  const sorted = [...domains].sort((a, b) => a.strength - b.strength)

  for (const domain of sorted) {
    if (targets.length >= max) break
    if (domain.missingCapabilities.length === 0) continue

    for (const cap of domain.missingCapabilities) {
      if (targets.length >= max) break

      const target = resolveRecommendationTarget(domain, cap)
      if (target.availability === "unavailable") continue

      if (seenHrefs.has(target.href)) continue
      seenHrefs.add(target.href)

      targets.push(target)
    }
  }

  return targets
}

export function resolveNextMoveTarget(
  domains: DomainState[],
): GuidedRecommendationTarget | null {
  const recommendations = buildGuidedRecommendations(domains, 1)
  return recommendations[0] ?? null
}
