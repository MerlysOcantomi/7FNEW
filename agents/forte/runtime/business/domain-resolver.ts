import type { BusinessDomain, DomainLevel, DomainState } from "./domain-types"
import type { NormalizedSignals, SignalName } from "./signals"

/**
 * Maps each signal to the domain(s) it supports.
 * A signal can support multiple domains.
 */
const SIGNAL_TO_DOMAINS: Record<SignalName, BusinessDomain[]> = {
  crm: ["relationship"],
  smartInbox: ["communication", "relationship"],
  portal: ["relationship"],
  projectDelivery: ["delivery"],
  taskManagement: ["delivery"],
  invoicing: ["finance"],
  financeControl: ["finance"],
  documents: ["intelligence"],
  contentMarketing: ["content"],
  campaigns: ["marketing"],
  automations: ["intelligence"],
  documentAnalysis: ["intelligence"],
  aiAssistance: ["intelligence"],
}

/**
 * Modules that contribute to each domain when present in the catalog.
 * Keys are module IDs from the phase1 catalog.
 */
const MODULE_TO_DOMAINS: Record<string, BusinessDomain[]> = {
  clientes: ["relationship"],
  inbox: ["communication", "relationship"],
  proyectos: ["delivery"],
  tareas: ["delivery"],
  facturacion: ["finance"],
  finanzas: ["finance"],
  documentos: ["intelligence"],
  contenido: ["content"],
  campanas: ["marketing"],
  automatizaciones: ["intelligence"],
}

/**
 * Expected capabilities per domain. When a capability is missing
 * from the active modules, it becomes a gap.
 */
const DOMAIN_EXPECTED_CAPABILITIES: Record<BusinessDomain, string[]> = {
  communication: ["inbox", "conversations", "lead-intelligence"],
  relationship: ["crm", "relationships", "accounts"],
  delivery: ["projects", "delivery", "tasks", "priorities"],
  marketing: ["campaigns", "marketing-plans", "growth"],
  content: ["content", "editorial", "ideas"],
  finance: ["invoicing", "billing", "finance", "cashflow"],
  intelligence: ["ai.ask", "ai.chat", "document-analysis", "automations"],
}

interface ActiveModule {
  id: string
  provides: string[]
}

export interface ResolveDomainStatesInput {
  signals: NormalizedSignals
  activeModules: ActiveModule[]
}

function computeStrength(
  domain: BusinessDomain,
  supportingSignals: string[],
  coveredCapabilities: Set<string>,
): number {
  const expected = DOMAIN_EXPECTED_CAPABILITIES[domain]
  if (expected.length === 0) return 0

  const signalWeight = Math.min(supportingSignals.length / 3, 1) * 0.4
  const capWeight = (expected.filter((c) => coveredCapabilities.has(c)).length / expected.length) * 0.6

  return Math.round((signalWeight + capWeight) * 100) / 100
}

function computeLevel(strength: number, supportingModules: string[]): DomainLevel {
  if (supportingModules.length === 0 && strength === 0) return "none"
  if (strength < 0.3) return "basic"
  if (strength < 0.6) return "intermediate"
  return "advanced"
}

export function resolveDomainStates(input: ResolveDomainStatesInput): DomainState[] {
  const { signals, activeModules } = input

  const allCoveredCapabilities = new Set(
    activeModules.flatMap((m) => m.provides),
  )

  const moduleIdSet = new Set(activeModules.map((m) => m.id))

  const ALL_DOMAINS: BusinessDomain[] = [
    "communication",
    "relationship",
    "delivery",
    "marketing",
    "content",
    "finance",
    "intelligence",
  ]

  return ALL_DOMAINS.map((domain) => {
    const supportingSignals = (Object.keys(SIGNAL_TO_DOMAINS) as SignalName[])
      .filter((signal) => signals[signal] && SIGNAL_TO_DOMAINS[signal].includes(domain))

    const supportingModules = Object.entries(MODULE_TO_DOMAINS)
      .filter(([moduleId, domains]) => moduleIdSet.has(moduleId) && domains.includes(domain))
      .map(([moduleId]) => moduleId)

    const expected = DOMAIN_EXPECTED_CAPABILITIES[domain]
    const missingCapabilities = expected.filter((cap) => !allCoveredCapabilities.has(cap))

    const strength = computeStrength(domain, supportingSignals, allCoveredCapabilities)
    const level = computeLevel(strength, supportingModules)

    const notes: string[] = []

    if (supportingSignals.length > 0 && supportingModules.length === 0) {
      notes.push(`Hay senales de ${domain} pero no hay modulos activos que lo soporten`)
    }

    if (missingCapabilities.length > 0 && level !== "none") {
      notes.push(`Faltan capacidades: ${missingCapabilities.join(", ")}`)
    }

    return {
      domain,
      level,
      strength,
      supportingSignals,
      supportingModules,
      missingCapabilities,
      notes: notes.length > 0 ? notes : undefined,
    }
  })
}

export function getActiveDomains(states: DomainState[]): DomainState[] {
  return states.filter((s) => s.level !== "none")
}

export function getDomainGaps(states: DomainState[]): DomainState[] {
  return states.filter((s) => s.level !== "none" && s.missingCapabilities.length > 0)
}
