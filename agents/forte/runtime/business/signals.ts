/**
 * Derived from phase1 semantic dictionary (agents/forte/phase1/recommender.ts).
 *
 * This file contains a minimal, isolated extraction of the signal resolution
 * and inference logic used by phase1's NormalizedSignals. It exists here to
 * break the import cycle between runtime/ and phase1/ without duplicating
 * recommendation logic.
 *
 * Rules:
 * - Same signal names as the original NormalizedSignals interface
 * - Same inference rules, same order, no additions or reinterpretations
 * - No recommendation logic, no profiles, no verticals
 *
 * TODO: Unify this with phase1/recommender.ts in a shared semantic layer
 * (e.g. agents/forte/semantic/) in a future refactor phase, so that both
 * phase1 and runtime/business consume signals from a single source of truth.
 */

export interface NormalizedSignals {
  crm: boolean
  smartInbox: boolean
  portal: boolean
  projectDelivery: boolean
  taskManagement: boolean
  invoicing: boolean
  financeControl: boolean
  documents: boolean
  contentMarketing: boolean
  campaigns: boolean
  automations: boolean
  documentAnalysis: boolean
  aiAssistance: boolean
}

export type SignalName = keyof NormalizedSignals

export interface ResolveSignalsInput {
  crm?: boolean
  smartInbox?: boolean
  portal?: boolean
  projectDelivery?: boolean
  taskManagement?: boolean
  invoicing?: boolean
  financeControl?: boolean
  documents?: boolean
  contentMarketing?: boolean
  campaigns?: boolean
  automations?: boolean
  documentAnalysis?: boolean
  aiAssistance?: boolean
}

/**
 * Resolves a complete set of NormalizedSignals from partial/explicit input,
 * applying the same inference rules as phase1/recommender.ts normalizeInput().
 */
export function resolveSignals(input: ResolveSignalsInput): NormalizedSignals {
  const signals: NormalizedSignals = {
    crm: input.crm ?? false,
    smartInbox: input.smartInbox ?? false,
    portal: input.portal ?? false,
    projectDelivery: input.projectDelivery ?? false,
    taskManagement: input.taskManagement ?? false,
    invoicing: input.invoicing ?? false,
    financeControl: input.financeControl ?? false,
    documents: input.documents ?? false,
    contentMarketing: input.contentMarketing ?? false,
    campaigns: input.campaigns ?? false,
    automations: input.automations ?? false,
    documentAnalysis: input.documentAnalysis ?? false,
    aiAssistance: input.aiAssistance ?? false,
  }

  // Inference rules — same as phase1/recommender.ts lines 169-193
  if (signals.projectDelivery && !signals.taskManagement) {
    signals.taskManagement = true
  }

  if (signals.campaigns && !signals.contentMarketing) {
    signals.contentMarketing = true
  }

  if (signals.documentAnalysis && !signals.documents) {
    signals.documents = true
  }

  if (
    (signals.smartInbox || signals.documentAnalysis || signals.contentMarketing || signals.automations) &&
    !signals.aiAssistance
  ) {
    signals.aiAssistance = true
  }

  if ((signals.invoicing || signals.portal) && !signals.crm) {
    signals.crm = true
  }

  return signals
}

export function getActiveSignalNames(signals: NormalizedSignals): SignalName[] {
  return (Object.keys(signals) as SignalName[]).filter((key) => signals[key])
}
