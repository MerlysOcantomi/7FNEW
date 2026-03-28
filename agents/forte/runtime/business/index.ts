export { resolveSignals, getActiveSignalNames } from "./signals"
export {
  resolveDomainStates,
  getActiveDomains,
  getDomainGaps,
} from "./domain-resolver"
export { mapIntentToDomains } from "./domain-mapper"
export type {
  NormalizedSignals,
  SignalName,
  ResolveSignalsInput,
} from "./signals"
export type { BusinessDomain, DomainLevel, DomainState } from "./domain-types"
export type { ResolveDomainStatesInput } from "./domain-resolver"
